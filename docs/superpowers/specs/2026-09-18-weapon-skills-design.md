# 武器主动技能设计（Weapon Skills）

> Round 8 内容深化 · 玩法机制深化 · 第二个子项目
> 日期：2026-09-18
> 状态：已确认，待实现计划

## 1. 目标

每把武器一个主动技，按键触发独立效果（旋斩/穿透箭/突刺/震地），增加操作深度与战斗爆发选择。冷却制不与 rage/处决冲突。

## 2. 能量框架：冷却制

- 每个武器技能独立冷却 timer（默认 8s）
- **不消耗 rage**（rage 留给处决 `_executing`，完美闪避留 `_perfectBuff`，零冲突）
- 切武器不重置冷却（各武器独立计时，`_skillCd[weaponIdx]`）
- 冷却中按 F 无效（HUD 图标闪烁提示）

## 3. 触发：KeyF

- 按 F 触发**当前装备武器**的主动技
- Player keydown `KeyF` → `trySkill(combat)`
- KeyF 当前未占用（KeyQ=闪避、KeyK=技能树、KeyR=模式/重试、KeyN=天气、KeyV=皮肤，均不冲突）

## 4. 4 武器主动技

| 武器 | 技能名 | 效果 | 实现 |
|------|--------|------|------|
| 刀 Sword | 旋斩 | 原地 360° 范围伤害 + 击退，半径 4m，伤害 40 | `combat.spawnAoE(player.position, 4, 40, player, now)` + 击退（takeDamage heavy） |
| 弓 Bow | 穿透箭 | 直线穿透箭，伤害不衰减，穿透最多 3 个敌人 | `combat.spawnPierceArrow(player, this, 1.0)` 新方法 |
| 枪 Spear | 突刺 | 直线突进 6m + 突刺伤害 35 + 硬直 0.4s | `player._lunge(6)` + `combat.resolveMelee(player, this, 2, now)`（weapon.arc 小、range 临时大） |
| 锤 Warhammer | 震地 | AOE 范围伤害 50 + 击倒 + 眩晕 0.6s，半径 5m | `combat.spawnAoE(player.position, 5, 50, player, now)` + heavy takeDamage 触发硬直 |

**冷却**：均 8s（`skillCd = 8`）

## 5. 数据流

```
Player keydown KeyF
  → trySkill(combat)
  → 查 _skillCd[weaponIdx] <= 0
  → weapon.skill(player, combat, now)
  → CombatSystem spawnAoE/spawnPierceArrow/resolveMelee（复用）
  → 命中触发 combo.onHit（连击累积，与连击系统协同）
  → bus.emit('skill.cast', { weaponIdx })
  → _skillCd[weaponIdx] = weapon.skillCd
Player update(dt)
  → for i: _skillCd[i] = max(0, _skillCd[i] - dt)
HUD 监听 skill.cast
  → 图标冷却遮罩 + 闪烁
```

## 6. 组件

### 6.1 src/gameplay/weapons/Weapon.js（基类，修改）
```js
constructor({ name, damage, range, cooldown, type, windup = 0 }) {
  // 现有字段...
  this.skillCd = 8;        // 主动技冷却 8s
  this.skillName = '技能';
  this.skillDesc = '';
}
// 基类空实现
skill(_attacker, _combat, _now) { return false; }
```

### 6.2 4 子类（修改，各实现 skill）
- `Sword.js`：`skill(a, c, now) { c.spawnAoE(a.position, 4, 40, a, now); return true; }` + `skillName='旋斩'`
- `Bow.js`：`skill(a, c, now) { c.spawnPierceArrow(a, this, 1.0); return true; }` + `skillName='穿透箭'`
- `Spear.js`：`skill(a, c, now) { a._lunge(6); c.resolveMelee(a, this, 2, now); return true; }` + `skillName='突刺'`
- `Warhammer.js`：`skill(a, c, now) { c.spawnAoE(a.position, 5, 50, a, now); return true; }` + `skillName='震地'`

### 6.3 src/gameplay/WeaponSkills.js（新增，独立可测）
```js
export class WeaponSkills {
  constructor() { this._cd = [0, 0, 0, 0]; this._cdMax = 8; }
  canCast(idx) { return this._cd[idx] <= 0; }
  cdRemaining(idx) { return this._cd[idx]; }
  trigger(idx) { this._cd[idx] = this._cdMax; }
  update(dt) { for (let i = 0; i < 4; i++) if (this._cd[i] > 0) this._cd[i] = Math.max(0, this._cd[i] - dt); }
  reset() { this._cd = [0, 0, 0, 0]; }
}
```

### 6.4 Player.js（修改）
- constructor 加 `this._weaponSkills = null;`
- 加 `setWeaponSkills(ws) { this._weaponSkills = ws; }`
- keydown 加 `if (e.code === 'KeyF') this.trySkill(this._pendingCombat);`
- 加 `trySkill(combat) { if (!combat || !this.alive || !this._weaponSkills) return; const idx = this.weaponIdx; if (!this._weaponSkills.canCast(idx)) { this.bus?.emit('skill.reject'); return; } const ok = this.weapon.skill(this, combat, performance.now()/1000); if (ok) { this._weaponSkills.trigger(idx); this.bus?.emit('skill.cast', { weaponIdx: idx }); } }`
- update 内 `this._weaponSkills?.update(dt);`
- 加 `_lunge(dist)`：突进（沿 forward 位移，`this.position.add(this.forward.clone().multiplyScalar(dist))`，需碰撞保护简化版：直接位移 + 短暂无敌）

### 6.5 CombatSystem.js（修改）
- 加 `spawnPierceArrow(attacker, weapon, charge)`：类似 spawnArrow 但 arrow 击中后不消失，穿透最多 3 个敌人（`_pierceLeft = 3`，击中减 1，到 0 移除）

### 6.6 HUD.js（修改）
- 4 技能图标（右下角，照 `_counterEl` 模式 createElement）
- 监听 `skill.cast`（图标冷却遮罩）/`skill.reject`（闪烁）
- update 内冷却遮罩更新

### 6.7 main_entry.js（修改）
- 实例化 `const weaponSkills = new WeaponSkills();`
- `player.setWeaponSkills(weaponSkills);`
- spawnAll 内 `weaponSkills.reset();`

## 7. 测试

### 7.1 单测 tests/gameplay/WeaponSkills.test.js
- canCast 初始 true
- trigger 后 canCast false
- update 递减冷却
- update 到 0 后 canCast true
- reset 全清
- cdRemaining 查询

### 7.2 单测 tests/gameplay/weapons/各子类 skill.test.js（可选，mock combat）
- Sword.skill 调 spawnAoE
- Bow.skill 调 spawnPierceArrow
- Spear.skill 调 _lunge + resolveMelee
- Warhammer.skill 调 spawnAoE

### 7.3 冒烟 e2e/smoke.spec.js 增断言
- 技能图标元素存在（`#skill-0` 等）

## 8. 与现有系统协同

- **连击系统**：主动技命中也触发连击累积。`resolveMelee` 已调 `combo.onHit`；`spawnAoE` 当前只调 `_emitHit` 不调 onHit，需在 spawnAoE 命中分支补 `this._comboSys?.onHit(false, false, now)`（每次命中累积，AOE 多命中多连击）
- **rage**：主动技不消耗 rage，rage 留处决
- **SkillTree**：被动 mastery 可加成主动技伤害（预留 `skillDamageMul`，本轮不做）
- **天气**：雨天弓术降精度影响穿透箭命中（现有 spawnArrow 已应用 weatherFx）

## 9. 边界与错误处理

- `_weaponSkills` 可为 null（AI 无），Player 调用处用 `?.`
- `weapon.skill` 基类返回 false（无技能），子类返回 true
- `_lunge` 需简单碰撞保护（若突进穿墙，至少限制 y 不入地，或接受简化版直接位移）
- `spawnPierceArrow` 击中友好单位不穿透（team 判断）

## 10. 不做的事（YAGNI）

- 不做技能升级/强化（SkillTree 预留，本轮不做）
- 不做多主动技键位（只 KeyF 一个键，按当前武器触发）
- 不做 AI 主动技（AI 无 _weaponSkills）
- 不做技能符文/词条（装备词条子项目预留）
