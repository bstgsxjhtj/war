# 冷兵器 TPS 战斗系统进化实施计划

> **目标工程师须知：** 本计划面向 Web 端 Three.js 冷兵器 TPS Demo 的第三轮进化。每任务含目标、文件、关键实现、验证。游戏无单元测试，以"实现 + 浏览器运行验证"替代 TDD。

**Goal:** 在保持现有遭遇战闭环基础上，补齐耐力/格挡/锁定/完美闪避的操作深度，引入武器克制与 AI 战术的机制层，并新增据点模式与河流地形，使画面与手感向 CS:GO 级别靠近。

**Architecture:** 沿用自建轻量 ECS + 状态机。新增 Stamina(资源)/GameMode(模式)/Obstacle(障碍)/Water(水体) 模块；Character 扩展 lockTarget/blocking/perfectDodge/launch 状态；AIController 增加 tactics 层；CombatSystem 增加克制矩阵与 AOE。所有改动向后兼容现有 spawnAll/checkWin 调用。

**Tech Stack:** Three.js + Vite + 自建 EventBus/GameState。无物理引擎，胶囊碰撞手动解算。

---

## File Structure

**新建文件：**
- `src/gameplay/Stamina.js` — 耐力资源条（max/cur/consume/regen）
- `src/gameplay/weapons/Spear.js` — 长枪（长距突刺，窄弧）
- `src/gameplay/weapons/SwordShield.js` — 剑盾（含持盾格挡）
- `src/gameplay/weapons/Warhammer.js` — 重锤（破盾高伤慢攻）
- `src/gameplay/GameMode.js` — 模式基类 + 死斗/据点子类
- `src/world/Water.js` — 水面 ShaderMaterial + 流速/深度
- `src/world/Obstacle.js` — 障碍物（圆柱碰撞 + 挡箭射线）

**修改文件：**
- `src/gameplay/Character.js` — lockTarget/blocking/perfectDodge/launch/terrainType/stamina
- `src/gameplay/Player.js` — Tab 锁定 / 右键格挡 / 完美闪避输入 / 武器切换扩展
- `src/gameplay/CombatSystem.js` — 克制矩阵 / AOE / 弹刀 / 处决判定
- `src/gameplay/AIController.js` — tactics 层（包抄/撤退/集火协调）
- `src/gameplay/Weapon.js` — weaponClass/armorPierce 字段
- `src/main_entry.js` — 模式选择 / 水体/障碍注册 / 武器分配
- `src/ui/HUD.js` — 耐力条 / 锁定标记 / 据点进度 / 模式选择界面
- `src/world/Terrain.js` — 台地高度 + isWater/waterDepth + 河流定义
- `src/world/Environment.js` — 注册障碍物 + 体积云 + 河流装饰
- `src/engine/Scene.js` — 体积云层

---

## Task 1: 耐力/体力系统

**目标：** 限制闪避/冲刺/蓄力 spam，建立资源博弈底座。

**Files:** Create `src/gameplay/Stamina.js`; Modify `Character.js`, `Player.js`, `HUD.js`

**关键实现：**
```js
// Stamina.js
export class Stamina {
  constructor(max=100){ this.max=max; this.cur=max; this._debuff=false; }
  get ratio(){ return this.cur/this.max; }
  consume(n){ this.cur=Math.max(0,this.cur-n); this._debuff=this.cur<30; return this.cur>0; }
  regen(dt,inCombat){ if(!inCombat) this.cur=Math.min(this.max,this.cur+22*dt); }
}
```
- Character 构造 `this.stamina=new Stamina()`；update 中 `this.stamina.regen(dt, this._attacking||this._dodgeTimer>0)`
- tryDodge：`if(!this.stamina.consume(25)){ 降级翻滚 iFrame=0 speed*0.6 } else 正常`
- Player 冲刺：`if(this._sprint) this.character.stamina.consume(18*dt)`，耗尽 setSprint(false)
- Bow 蓄力释放：`consume(35)`
- HUD：耐力条紧贴血条下方，`<30` 时淡蓝

**验证：** 浏览器中连续闪避 4 次后耐力耗尽变翻滚，停止后 5s 回满。

---

## Task 2: 硬锁定 + 镜头缓动跟随

**目标：** Tab 锁定视野内最近敌方，镜头平滑跟随，近战不再难瞄准。

**Files:** Modify `Player.js`, `Character.js`, `Camera.js`, `HUD.js`

**关键实现：**
- Character 新增 `lockTarget=null`；`_softLock` 改：若 lockTarget alive 且 <15m，`_targetYaw=atan2(target)` 持续追瞄，否则 fallback 5m±30°
- Player：`keydown Tab` 边沿触发 `_acquireLock(combat)`（视野内最近敌方）；再按或目标死/超距解除
- Camera.follow：若 player.lockTarget，`this.yaw` lerp(0.08) 朝向目标方位
- HUD：锁定标记 Sprite 贴目标头顶，`setLockTarget(c)` 控制显隐

**验证：** 按 Tab 后镜头缓动转向锁定目标，头顶出现标记，目标死后自动解除。

---

## Task 3: 格挡 + 精格挡

**目标：** 持刀右键格挡，正面减伤 70%；按下瞬间 0.15s 精格挡完全免伤+弹刀。

**Files:** Modify `Character.js`, `Player.js`, `CombatSystem.js`

**关键实现：**
- Character：`_blocking=false,_perfectWindow=0`；`tryBlock()` 设 `_blocking=true,_perfectWindow=0.15`；update 中 `_perfectWindow-=dt`，`_blocking` 时 `spd*=0.5`，weaponPivot 设防御姿态
- Player：右键 mousedown 若 `weapon.type!=='projectile'` 调 tryBlock()，mouseup `_blocking=false`
- takeDamage：若 `_blocking` 且攻击者在前方±60°（dot 判定）：`_perfectWindow>0` 则 lost=0 + attacker._hurt+=0.4(弹刀) + 白闪；否则 lost=amount*0.3 + stamina.consume(12)
- CombatSystem._emitHit：精格挡 fx.shake 降 0.05 + 白色粒子

**验证：** 持刀右键格挡减伤，瞬间格挡弹刀白闪且敌方硬直。

---

## Task 4: 完美闪避

**目标：** 受击前 0.12s 闪避触发完美闪避，iFrame 延长 + 慢放 + 下次攻击+50%。

**Files:** Modify `Character.js`, `CombatSystem.js`, `Camera.js`

**关键实现：**
- Character：`_perfectDodge=false,_perfectBuff=0,_incomingThreat=null`
- CombatSystem.resolveMelee：命中前对 victim 调 `c._flagIncoming(attacker,now,0.12)`
- tryDodge：若 `_incomingThreat && now-_incomingThreat.time<0.12` → `_perfectDodge=true,_dodgeIFrame=0.45,_perfectBuff=2`
- takeDamage：完美闪避时 bus.emit('fx.perfectDodge')；resolveMelee：`attacker._perfectBuff>0` 则 dmg*1.5
- Camera 监听 fx.perfectDodge：`_timeScale=0.5,_timeRecover=0.15`
- 蓝色残影粒子（复用粒子池 vertex color 0x88ccff）

**验证：** 在敌方挥砍将命中瞬间闪避，触发慢放 + 蓝光，后续攻击伤害提升。

---

## Task 5: 命中方向性推力 + 击飞

**目标：** 三段连击方向分化（横扫/上挑/下劈），蓄力重击纵向击飞，落地震动。

**Files:** Modify `Sword.js`, `CombatSystem.js`, `Character.js`

**关键实现：**
- Sword 新增 `comboLaunch=[{y:0,rot:0.3},{y:3,rot:0},{y:-2,aoe:1.5}]`
- resolveMelee：`c._curVel.addScaledVector(attacker.forward,knock*2.5)` + `c.vy+=launch.y` + `c._launchRot=launch.rot`
- Character.update：`_launchRot` 存在时 `root.rotation.z += _launchRot*dt`，落地清零；落地 vy<-3 触发 shake + 土色粒子
- combo2 下劈 AOE：命中点 1.5m 内对 arc 外敌人 50% 伤害

**验证：** 上挑将敌人挑空，下劈落地有冲击，蓄力重击纵向击飞。

---

## Task 6: 武器差异化 + 克制三角

**目标：** 新增长枪/剑盾/重锤，形成"枪>盾>锤>枪"+弓克制网。

**Files:** Create `Spear.js`,`SwordShield.js`,`Warhammer.js`; Modify `Weapon.js`,`CombatSystem.js`,`main_entry.js`

**关键实现：**
- Weapon 新增 `weaponClass('SPEAR'/'SHIELD'/'HEAVY'/'SWORD'/'BOW')`, `armorPierce`, `shieldBlock`
- Spear：range4.2/damage18/arc PI*0.15/comboLunge[4,3,4.5]
- SwordShield：持盾格挡（weaponClass SHIELD，格挡减伤 60% 非 HEAVY）
- Warhammer：damage55/cooldown1.2/armorPierce true（无视格挡）
- CombatSystem：`_counterMatrix`，HEAVY vs SHIELD=1.8, SPEAR vs SHIELD=1.5, SHIELD vs HEAVY=1.3 等
- main spawnAll：AI 按索引分配不同武器组合

**验证：** 切换武器手感差异明显，重锤破盾，长枪风筝盾。

---

## Task 7: AI 战术行为层

**目标：** AI 包抄侧翼、低血撤退、集火协调，从"4个1v1"变团队战。

**Files:** Modify `AIController.js`

**关键实现：**
- 新增 `_focusTarget`（每2s由id最小AI广播血量最低敌方）
- `_calcFlankDir(target,allies)`：计算被包围角度，从缺口侧接近
- `health.ratio<0.3` → `_state='retreat'`，远离最近敌方+弓兵sprint
- 弓兵近战逼近时后撤而非横移

**验证：** AI 不再直线追击，会侧翼包抄，残血后撤。

---

## Task 8: 游戏模式选择器 + 河流水体

**目标：** 大厅选模式（死斗/据点）；河流横切地图，涉水减速+流速推移+水面shader。

**Files:** Create `GameMode.js`,`Water.js`; Modify `main_entry.js`,`Terrain.js`,`Environment.js`,`HUD.js`

**关键实现：**
- GameMode 基类 + Deathmatch（存活判定）+ Domination（3 旗帜点占领积分）
- Terrain：`_river={z范围,flowDir,flowSpeed,depth}`，`isWater(x,z)`/`waterDepth(x,z)`，台地高度叠加
- Water.js：PlaneGeometry+ShaderMaterial（法线波动+折射色+透明）
- Character.update：涉水 spd*0.6 + 不可冲刺 + 流速推移 + 深水溺水
- HUD：模式选择卡片 + 据点占领进度条

**验证：** 选据点模式后争夺旗帜积分；河流涉水减速且被水流推移，水面波动。

---

## Self-Review

**1. Spec coverage：** 操作（耐力1/锁定2/格挡3/完美闪避4/方向推力5）+ 机制（武器6/AI战术7/模式8）+ 画面（水面8）覆盖三大方向。✓ 缺格挡耐力联动（Task1+3 互引）、弓弹道预览（降优先级未含，后续轮次）、处决（低优先级未含）。

**2. Placeholder scan：** 无 TBD/TODO，关键代码已给骨架。实现阶段补全细节。✓

**3. Type consistency：** Stamina.consume/regen、Character.lockTarget/_blocking/_perfectDodge/_launchRot、CombatSystem._counterMatrix/spawnAoE、Weapon.weaponClass 命名一致。✓

**4. 优先级取舍：** 8 项均为"高/中优先级+本期可落地"。攻城/多人/怒气/处决列为后续轮次（依赖未完成的基础设施或工程量过大）。
