# 武器主动技能（Weapon Skills）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每把武器一个主动技（刀-旋斩/弓-穿透箭/枪-突刺/锤-震地），KeyF 触发，冷却制 8s，不消耗 rage。

**Architecture:** 新增 `WeaponSkills` 冷却管理器（独立可测）；Weapon 基类加 `skill()` + `skillCd`/`skillName`，4 子类各实现；Player 加 `trySkill`/`_lunge`/KeyF 绑定；CombatSystem 复用 `spawnAoE`（补 onHit）+ 新 `spawnPierceArrow`；HUD 4 技能图标 + 冷却遮罩；main_entry 实例化注入。

**Tech Stack:** Three.js + Vite 5 + Vitest 2 + jsdom（沿用 Round 7 护栏）

**集成点（已读确认）：**
- `src/gameplay/Weapon.js:4-20`（constructor + `_perform`）
- `src/gameplay/weapons/Sword.js:5-39` / `Bow.js:5-14` / `Spear.js:5-16` / `Warhammer.js:5-16`（constructor + `_perform`）
- `src/gameplay/CombatSystem.js:162-173`（spawnAoE，补 onHit）/ `175-216`（spawnArrow + update arrow 循环，穿透改造）
- `src/gameplay/Player.js:55-64`（keydown）/ `120-158`（update）
- `src/ui/HUD.js:138-147`（_counterEl 图标模式）
- `src/main_entry.js:124-125`（实例化区）/ `184-190`（spawnAll player）

---

### Task 1: WeaponSkills 冷却管理器 + 单测（TDD）

**Files:**
- Create: `src/gameplay/WeaponSkills.js`
- Test: `tests/gameplay/WeaponSkills.test.js`

- [ ] **Step 1: 写失败测试**

Create `tests/gameplay/WeaponSkills.test.js`:
```js
import { WeaponSkills } from '../../src/gameplay/WeaponSkills.js';
import { describe, it, expect } from 'vitest';

describe('WeaponSkills', () => {
  it('canCast 初始 true（全 4 槽）', () => {
    const ws = new WeaponSkills();
    expect(ws.canCast(0)).toBe(true);
    expect(ws.canCast(3)).toBe(true);
  });
  it('trigger 后 canCast false', () => {
    const ws = new WeaponSkills();
    ws.trigger(0);
    expect(ws.canCast(0)).toBe(false);
  });
  it('trigger 不影响其他槽', () => {
    const ws = new WeaponSkills();
    ws.trigger(0);
    expect(ws.canCast(1)).toBe(true);
  });
  it('update 递减冷却', () => {
    const ws = new WeaponSkills();
    ws.trigger(0);
    ws.update(3);
    expect(ws.cdRemaining(0)).toBe(5);
  });
  it('update 到 0 后 canCast true', () => {
    const ws = new WeaponSkills();
    ws.trigger(0);
    ws.update(8);
    expect(ws.canCast(0)).toBe(true);
    expect(ws.cdRemaining(0)).toBe(0);
  });
  it('update 不低于 0', () => {
    const ws = new WeaponSkills();
    ws.trigger(0);
    ws.update(100);
    expect(ws.cdRemaining(0)).toBe(0);
  });
  it('reset 全清', () => {
    const ws = new WeaponSkills();
    ws.trigger(0); ws.trigger(2);
    ws.reset();
    expect(ws.canCast(0)).toBe(true);
    expect(ws.canCast(2)).toBe(true);
  });
  it('cdRemaining 查询', () => {
    const ws = new WeaponSkills();
    ws.trigger(1);
    expect(ws.cdRemaining(1)).toBe(8);
    ws.update(2);
    expect(ws.cdRemaining(1)).toBe(6);
  });
});
```

- [ ] **Step 2: 跑验证失败**

Run: `npx vitest run tests/gameplay/WeaponSkills.test.js *> t1.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content t1.txt -Tail 4`
Expected: FAIL（WeaponSkills 未定义）

- [ ] **Step 3: 写实现**

Create `src/gameplay/WeaponSkills.js`:
```js
export class WeaponSkills {
  constructor(cdMax = 8) {
    this._cd = [0, 0, 0, 0];
    this._cdMax = cdMax;
  }
  canCast(idx) { return this._cd[idx] <= 0; }
  cdRemaining(idx) { return this._cd[idx]; }
  trigger(idx) { this._cd[idx] = this._cdMax; }
  update(dt) { for (let i = 0; i < 4; i++) if (this._cd[i] > 0) this._cd[i] = Math.max(0, this._cd[i] - dt); }
  reset() { this._cd = [0, 0, 0, 0]; }
}
```

- [ ] **Step 4: 跑验证通过**

Run: `npx vitest run tests/gameplay/WeaponSkills.test.js *> t1.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content t1.txt -Tail 4`
Expected: PASS（8 passed）

- [ ] **Step 5: 提交**

```bash
git add src/gameplay/WeaponSkills.js tests/gameplay/WeaponSkills.test.js
git commit -m "feat: WeaponSkills 冷却管理器 + 8 单测"
```

---

### Task 2: Weapon 基类 + 4 子类 skill 方法

**Files:**
- Modify: `src/gameplay/Weapon.js`
- Modify: `src/gameplay/weapons/Sword.js` / `Bow.js` / `Spear.js` / `Warhammer.js`

- [ ] **Step 1: Weapon 基类加 skillCd/skillName/skill 方法**

`src/gameplay/Weapon.js` constructor 内 `this._timer = 0;` 后加：
```js
    this.skillCd = 8;
    this.skillName = '技能';
    this.skillDesc = '';
```
`_perform` 行后加基类空方法：
```js
  skill(_attacker, _combat, _now) { return false; }
```

- [ ] **Step 2: Sword 加旋斩**

`src/gameplay/weapons/Sword.js` constructor `this.hitFrame = 0.35;` 后加：
```js
    this.skillName = '旋斩';
```
`_perform` 方法后加：
```js
  skill(a, c, now) { c.spawnAoE(a.position, 4, 40, a, now); return true; }
```

- [ ] **Step 3: Bow 加穿透箭**

`src/gameplay/weapons/Bow.js` constructor `this._stringMesh = null;` 后加：
```js
    this.skillName = '穿透箭';
```
类末尾 `_perform` 后加：
```js
  skill(a, c, now) { c.spawnPierceArrow(a, this, 1.0); return true; }
```

- [ ] **Step 4: Spear 加突刺**

`src/gameplay/weapons/Spear.js` constructor `this.hitFrame = 0.4;` 后加：
```js
    this.skillName = '突刺';
```
`_perform` 后加：
```js
  skill(a, c, now) { a._lunge(6); c.resolveMelee(a, this, 2, now); return true; }
```

- [ ] **Step 5: Warhammer 加震地**

`src/gameplay/weapons/Warhammer.js` constructor `this.hitFrame = 0.45;` 后加：
```js
    this.skillName = '震地';
```
`_perform` 后加：
```js
  skill(a, c, now) { c.spawnAoE(a.position, 5, 50, a, now); return true; }
```

- [ ] **Step 6: build 验证**

Run: `npx vite build --mode development *> b.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content b.txt -Tail 3`
Expected: 0 errors

- [ ] **Step 7: 提交**

```bash
git add src/gameplay/Weapon.js src/gameplay/weapons/Sword.js src/gameplay/weapons/Bow.js src/gameplay/weapons/Spear.js src/gameplay/weapons/Warhammer.js
git commit -m "feat: Weapon 基类 + 4 子类 skill 方法（旋斩/穿透箭/突刺/震地）"
```

---

### Task 3: CombatSystem spawnAoE 补 onHit + spawnPierceArrow + update 穿透

**Files:**
- Modify: `src/gameplay/CombatSystem.js:162-173`（spawnAoE）/ `175-192`（spawnArrow 后加 spawnPierceArrow）/ `205-216`（update arrow 循环穿透改造）

- [ ] **Step 1: spawnAoE 补 onHit（连击协同）**

`src/gameplay/CombatSystem.js:167` spawnAoE 内 `const lost = c.takeDamage(...)` 行后、`if (lost > 0) this._emitHit` 前加：
```js
        if (lost > 0 && this._comboSys) this._comboSys.onHit(false, false, now);
```
用 SearchReplace，old_str 匹配：
```
        const lost = c.takeDamage(damage * (1 - d / radius), false, attacker, now);
        if (lost > 0) this._emitHit(attacker, c, lost, '冲击', 0xaa8866, 0, false, now);
```
new_str:
```
        const lost = c.takeDamage(damage * (1 - d / radius), false, attacker, now);
        if (lost > 0) {
          if (this._comboSys) this._comboSys.onHit(false, false, now);
          this._emitHit(attacker, c, lost, '冲击', 0xaa8866, 0, false, now);
        }
```

- [ ] **Step 2: 加 spawnPierceArrow 方法**

`src/gameplay/CombatSystem.js` spawnArrow 方法后（约 192 行 `}` 后）加：
```js
  spawnPierceArrow(attacker, weapon, charge) {
    const mesh = new THREE.Mesh(this._arrowGeo, this._arrowMat);
    mesh.castShadow = true;
    this._tmpOrigin.copy(attacker.position).add(this._tmpTo.set(0, 1.5, 0)).add(attacker.forward.clone().multiplyScalar(0.7));
    const vel = attacker.forward.clone().multiplyScalar(weapon.speedFor(charge) * 1.2);
    vel.y += 1.0;
    mesh.position.copy(this._tmpOrigin);
    this.scene.add(mesh);
    this.arrows.push({ mesh, pos: this._tmpOrigin.clone(), vel, team: attacker.team, damage: weapon.damageFor(charge) * 1.5, life: 4, attacker, charge, pierce: 3, hitSet: new Set() });
  }
```

- [ ] **Step 3: update arrow 循环穿透改造**

`src/gameplay/CombatSystem.js:205-215` for characters 循环。old_str:
```
      for (const c of this.characters) {
        if (!c.alive || c.team === a.team) continue;
        const cap = c.capsule;
        if (a.pos.distanceTo(cap.center) < cap.radius + cap.halfHeight * 0.5) {
          const heavy = (a.charge ?? 0) >= 0.8;
          const lost = c.takeDamage(a.damage, heavy, a.attacker, now);
          if (lost > 0) this._emitHit(a.attacker, c, lost, '弓', 0xff5522, 0, heavy, now);
          if (!c.health.alive) this.bus.emit('combat.kill', { victim: c, team: c.team, killer: a.attacker });
          hit = true; break;
        }
      }
```
new_str:
```
      for (const c of this.characters) {
        if (!c.alive || c.team === a.team) continue;
        const cap = c.capsule;
        if (a.pos.distanceTo(cap.center) < cap.radius + cap.halfHeight * 0.5) {
          if (a.hitSet && a.hitSet.has(c)) continue;
          const heavy = (a.charge ?? 0) >= 0.8;
          const lost = c.takeDamage(a.damage, heavy, a.attacker, now);
          if (lost > 0) this._emitHit(a.attacker, c, lost, '弓', 0xff5522, 0, heavy, now);
          if (!c.health.alive) this.bus.emit('combat.kill', { victim: c, team: c.team, killer: a.attacker });
          if (a.pierce !== undefined) {
            a.hitSet.add(c);
            a.pierce--;
            if (a.pierce <= 0) { hit = true; break; }
            continue;
          }
          hit = true; break;
        }
      }
```

- [ ] **Step 4: build 验证**

Run: `npx vite build --mode development *> b.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content b.txt -Tail 3`
Expected: 0 errors

- [ ] **Step 5: 全量单测（确保不破 CombatSystem.counter.test.js）**

Run: `npx vitest run *> t.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content t.txt -Tail 4`
Expected: EXIT=0（93 + 8 WeaponSkills = 101 passed）

- [ ] **Step 6: 提交**

```bash
git add src/gameplay/CombatSystem.js
git commit -m "feat: CombatSystem spawnAoE 补 combo.onHit + spawnPierceArrow 穿透箭"
```

---

### Task 4: Player trySkill + KeyF + _lunge + setWeaponSkills

**Files:**
- Modify: `src/gameplay/Player.js:55-64`（keydown）/ constructor / update / 加方法

- [ ] **Step 1: constructor 加 _weaponSkills**

`src/gameplay/Player.js` constructor `this._blocking = false;`（Player.js:21）后加：
```js
    this._weaponSkills = null;
```

- [ ] **Step 2: keydown 加 KeyF**

`src/gameplay/Player.js:61` `if (e.code === 'KeyQ') this.tryDodge(this.camera.forward());` 后加：
```js
      if (e.code === 'KeyF') this.trySkill(this._pendingCombat);
```

- [ ] **Step 3: 加 setWeaponSkills + trySkill + _lunge**

在 Player 类内 `_tryExecute` 方法前加：
```js
  setWeaponSkills(ws) { this._weaponSkills = ws; }

  trySkill(combat) {
    if (!combat || !this.alive || !this._weaponSkills) return;
    const idx = this.weaponIdx;
    if (!this._weaponSkills.canCast(idx)) { this.bus?.emit('skill.reject', { weaponIdx: idx }); return; }
    const now = performance.now() / 1000;
    const ok = this.weapon.skill(this, combat, now);
    if (ok) {
      this._weaponSkills.trigger(idx);
      this.bus?.emit('skill.cast', { weaponIdx: idx, name: this.weapon.skillName });
    }
  }

  _lunge(dist) {
    this.position.add(this.forward.clone().multiplyScalar(dist));
    this._iFrame = Math.max(this._iFrame, 0.25);
  }
```

- [ ] **Step 4: update 内加 _weaponSkills.update**

`src/gameplay/Player.js:156` `super.update(dt, terrain, combat, now);` 前加：
```js
    if (this._weaponSkills) this._weaponSkills.update(dt);
```

- [ ] **Step 5: build 验证**

Run: `npx vite build --mode development *> b.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content b.txt -Tail 3`
Expected: 0 errors

- [ ] **Step 6: 提交**

```bash
git add src/gameplay/Player.js
git commit -m "feat: Player trySkill + KeyF + _lunge + setWeaponSkills"
```

---

### Task 5: HUD 4 技能图标 + 冷却遮罩

**Files:**
- Modify: `src/ui/HUD.js`（constructor 加图标 + bus.on / update 遮罩 / setSkillCooldown）

- [ ] **Step 1: constructor 加 4 技能图标 + bus.on**

`src/ui/HUD.js` constructor `_comboEl` 创建块后（Task 4 连击系统加的 `this._comboTimer = 0;` 等 combo 块后）加。用 SearchReplace，old_str 匹配 combo.finisher 监听块末尾 `this._comboTimer = 1.5;`，new_str 在其后加：
```js
    this._skillEls = [];
    const skillColors = ['#dfe7ee', '#b98a4a', '#c9a44a', '#7a7a82'];
    for (let i = 0; i < 4; i++) {
      const el = document.createElement('div');
      el.id = 'skill-' + i;
      Object.assign(el.style, {
        position: 'fixed', bottom: '12px', right: (12 + i * 56) + 'px', zIndex: '14',
        width: '48px', height: '48px', borderRadius: '6px',
        border: '2px solid ' + skillColors[i], background: 'rgba(0,0,0,.4)',
        fontFamily: 'Segoe UI, sans-serif', fontSize: '11px', color: skillColors[i],
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', pointerEvents: 'none', overflow: 'hidden', position: 'relative'
      });
      el.textContent = '?';
      document.body.appendChild(el);
      const cd = document.createElement('div');
      Object.assign(cd.style, {
        position: 'absolute', inset: '0', background: 'rgba(0,0,0,.65)',
        display: 'none', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px', fontWeight: 'bold', color: '#fff'
      });
      el.appendChild(cd);
      this._skillEls.push({ el, cd });
    }
    bus.on('skill.cast', ({ weaponIdx, name }) => {
      const s = this._skillEls[weaponIdx];
      if (!s) return;
      s.el.textContent = name || '?';
      s.cd.style.display = 'flex';
      s.cd.textContent = '8';
    });
    bus.on('skill.reject', ({ weaponIdx }) => {
      const s = this._skillEls[weaponIdx];
      if (!s) return;
      s.el.style.transform = 'scale(1.15)';
      setTimeout(() => { s.el.style.transform = 'scale(1)'; }, 100);
    });
```

- [ ] **Step 2: setSkillCooldown 方法 + update 遮罩递减**

在 HUD 类内 `setComboHit` 附近加方法：
```js
  setSkillCooldowns(ws) {
    if (!ws) return;
    for (let i = 0; i < 4; i++) {
      const s = this._skillEls[i];
      if (!s) continue;
      const r = ws.cdRemaining(i);
      if (r > 0) { s.cd.style.display = 'flex'; s.cd.textContent = Math.ceil(r); }
      else { s.cd.style.display = 'none'; }
    }
  }
```
main_entry 主循环调 `hud.setSkillCooldowns(weaponSkills)`（Task 6）。或在 HUD update 内查——但 HUD 不持有 ws，用 setSkillCooldowns 由 main_entry 每帧调。

- [ ] **Step 3: build 验证**

Run: `npx vite build --mode development *> b.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content b.txt -Tail 3`
Expected: 0 errors

- [ ] **Step 4: 提交**

```bash
git add src/ui/HUD.js
git commit -m "feat: HUD 4 技能图标 + 冷却遮罩 + skill.cast/reject 事件"
```

---

### Task 6: main_entry 实例化 + 注入 + spawnAll reset + 主循环

**Files:**
- Modify: `src/main_entry.js:12`（import）/ `124-125`（实例化）/ `187-190`（spawnAll）/ `370-400`（主循环）

- [ ] **Step 1: import + 实例化**

`src/main_entry.js` 顶部 import 区加：
```js
import { WeaponSkills } from './gameplay/WeaponSkills.js';
```
`main_entry.js:124` `const skills = new SkillTree();` 后加：
```js
  const weaponSkills = new WeaponSkills();
```

- [ ] **Step 2: spawnAll 注入 player + reset**

`main_entry.js:188` `player.setComboSys(comboSys);` 后加（连击系统 Task 5 加的行附近）：
```js
    player.setWeaponSkills(weaponSkills);
    weaponSkills.reset();
```

- [ ] **Step 3: 主循环加 HUD 技能冷却刷新**

`main_entry.js:400` `hud.setCombo(player);` 后加：
```js
        hud.setSkillCooldowns(weaponSkills);
```

- [ ] **Step 4: build 验证**

Run: `npx vite build --mode development *> b.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content b.txt -Tail 3`
Expected: 0 errors

- [ ] **Step 5: 全量单测**

Run: `npx vitest run *> t.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content t.txt -Tail 4`
Expected: EXIT=0（101 passed）

- [ ] **Step 6: 提交**

```bash
git add src/main_entry.js
git commit -m "feat: main_entry 集成 WeaponSkills（实例化+注入+spawnAll reset+HUD 冷却刷新）"
```

---

### Task 7: 冒烟 + 全量验证

**Files:**
- Modify: `e2e/smoke.spec.js`（加技能图标断言）

- [ ] **Step 1: smoke 加技能图标断言**

`e2e/smoke.spec.js` `#combo` 断言后加：
```js
  const skillEl = await page.locator('#skill-0').count();
  expect(skillEl).toBeGreaterThan(0);
```
用 SearchReplace，old_str 匹配 `  const comboEl = await page.locator('#combo').count();\n  expect(comboEl).toBeGreaterThan(0);`，new_str 加 skill 断言。

- [ ] **Step 2: 跑 Playwright smoke**

Run: `npx playwright test *> p.txt 2>&1; Write-Host "EXIT=$LASTEXITCODE"; Get-Content p.txt -Tail 6`
Expected: 1 passed（含 #skill-0 断言，0 运行时致命 error）

若失败：检查 console error（如 `trySkill is not a function` 说明 Player 集成断裂，或 `spawnPierceArrow is not a function` 说明 CombatSystem 未加）。

- [ ] **Step 3: 提交**

```bash
git add e2e/smoke.spec.js
git commit -m "test: smoke 增 #skill-0 元素断言"
```

- [ ] **Step 4: 最终全量验证**

Run:
```powershell
npx vitest run *> t.txt 2>&1; $vt=$LASTEXITCODE
npx vite build --mode development *> b.txt 2>&1; $bd=$LASTEXITCODE
npx playwright test *> p.txt 2>&1; $pt=$LASTEXITCODE
Write-Host "VITEST=$vt BUILD=$bd PLAYWRIGHT=$pt"
Get-Content t.txt -Tail 3
```
Expected: VITEST=0 BUILD=0 PLAYWRIGHT=0

- [ ] **Step 5: 清理临时文件 + 确认干净**

Run: `Remove-Item t.txt,b.txt,p.txt -ErrorAction SilentlyContinue; git status --short`
Expected: 无未提交改动（仅 `.superpowers/` untracked）

---

## Self-Review（已执行）

1. **Spec 覆盖**：能量冷却制（Task1+Player update）、KeyF（Task4）、4 技能（Task2）、spawnAoE 补 onHit（Task3）、spawnPierceArrow（Task3）、数据流（Task2-6）、组件（Task1-6）、测试（Task1 单测+Task7 smoke）、协同连击（Task3 spawnAoE 补 onHit）、边界（_weaponSkills null 用 ?.、_lunge iFrame）——全覆盖。
2. **Placeholder 扫描**：无 TBD/TODO，每步含完整代码。
3. **类型一致**：`skill(attacker, combat, now)` 签名 Task2/Task4 一致；`spawnPierceArrow(attacker, weapon, charge)` Task2 Bow.skill 调用与 Task3 定义一致；`skill.cast/skill.reject` 事件 Task4/Task5 一致；`#skill-0..3` id Task5/Task7 一致；`setSkillCooldowns(ws)` Task5/Task6 一系；`cdRemaining/canCast/trigger/update/reset` Task1/Task5/Task6 一致。

## 执行选择

**计划已保存到 `docs/superpowers/plans/2026-09-18-weapon-skills.md`。两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 派新子代理执行，任务间审查
2. **Inline Execution** — 当前会话内批量执行
