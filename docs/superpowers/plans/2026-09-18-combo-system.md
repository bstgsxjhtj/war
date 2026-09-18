# 连击系统（ComboSystem）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现连击系统：连续命中累积连击数，触发伤害加成/特效/终结爆发，与克制/硬直/天气协同。

**Architecture:** 新增 `ComboSystem` 纯逻辑类（累积/衰减/中断/层级/伤害倍率），CombatSystem 在 `resolveMelee` 命中时调 `onHit` 取伤害倍率并乘入，Character 在 `takeDamage` 掉血时调 `onHurt` 中断，HUD 监听 `combo.tier/combo.break` 事件显示连击 UI，main_entry 实例化并注入。

**Tech Stack:** Three.js + Vite 5 + Vitest 2 + jsdom（沿用 Round 7 工程护栏）

**命名约定（避免与现有冲突）：** 新增连击系统实例/字段统一用 `comboSys` / `_comboSys`（Character 已有 `_comboCount/_comboTimer` 是玩家三段连击计数，HUD 已有 `setCombo(c)` 操作准星 `#comboRing`，均不同概念）。

**集成点（子代理收集确认）：**
- CombatSystem constructor：`src/gameplay/CombatSystem.js:13` `(scene, bus)` → 加 combo 参数
- CombatSystem.resolveMelee:140 `const dmg = baseDmg * this._counterMul(...) * (isBackstab ? 2 : 1);` → 乘 damageMul + 调 onHit
- CombatSystem._counterMul:69-73 → 返回值 >1.2 即克制
- Character constructor:13-61 → 加 `this._comboSys=null; this._perfectRebound=false;`
- Character.takeDamage:254-258 完美格挡分支 → 设 `this._perfectRebound=true`
- Character.takeDamage:268 `const lost = this.health.damage(amount);` 后 `else if (lost>0 && this.alive)` 分支 → 调 `this._comboSys?.onHurt()`
- Player.js:10 `extends Character` → 继承 `_comboSys`，加 `setComboSys(combo){ this._comboSys=combo; }`（或在 Character 加）
- HUD.js:138-147 `_counterEl` 模式 → 照此加 `#combo` 元素
- HUD.js:224-241 update timer 模式 → 照此加 `_comboTimer`
- main_entry.js:84 `new CombatSystem(scene.scene, bus)` → 加 combo 参数
- main_entry.js:184 `player = new Player(camera, bus)` 后 → `player.setComboSys(combo)`
- main_entry.js:370 `combat.update(ldt, terrain, now);` 后 → `comboSys.update(ldt, now);`
- main_entry.js:400 `hud.setCombo(player);`（现有，不改）→ 新增 `hud.setComboHit(comboSys);`

---

### Task 1: ComboSystem 核心类 + 单测（TDD）

**Files:**
- Create: `src/gameplay/ComboSystem.js`
- Test: `tests/gameplay/ComboSystem.test.js`

- [ ] **Step 1: 写失败测试**

Create `tests/gameplay/ComboSystem.test.js`:
```js
// @vitest-environment jsdom
import { ComboSystem } from '../../src/gameplay/ComboSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import { describe, it, expect, vi } from 'vitest';

describe('ComboSystem', () => {
  it('onHit 普通命中 +1', () => {
    const cs = new ComboSystem(new EventBus());
    cs.onHit(false, false, 1);
    expect(cs.count).toBe(1);
    expect(cs.tier).toBe(0);
  });
  it('onHit 克制命中 +2', () => {
    const cs = new ComboSystem(new EventBus());
    cs.onHit(true, false, 1);
    expect(cs.count).toBe(2);
  });
  it('onHit 完美反击 +3', () => {
    const cs = new ComboSystem(new EventBus());
    cs.onHit(false, true, 1);
    expect(cs.count).toBe(3);
  });
  it('tier 阈值跳变 5→1, 10→2, 20→3', () => {
    const cs = new ComboSystem(new EventBus());
    for (let i = 0; i < 5; i++) cs.onHit(false, false, i + 1);
    expect(cs.tier).toBe(1);
    for (let i = 0; i < 5; i++) cs.onHit(false, false, 10 + i);
    expect(cs.tier).toBe(2);
    for (let i = 0; i < 10; i++) cs.onHit(false, false, 20 + i);
    expect(cs.tier).toBe(3);
  });
  it('damageMul 各层级倍率', () => {
    const cs = new ComboSystem(new EventBus());
    expect(cs.damageMul).toBe(1.0);
    for (let i = 0; i < 5; i++) cs.onHit(false, false, i + 1);
    expect(cs.damageMul).toBe(1.1);
    for (let i = 0; i < 5; i++) cs.onHit(false, false, 10 + i);
    expect(cs.damageMul).toBe(1.2);
    for (let i = 0; i < 10; i++) cs.onHit(false, false, 20 + i);
    expect(cs.damageMul).toBe(1.3);
  });
  it('onHit 返回本次伤害倍率（含 finisher）', () => {
    const cs = new ComboSystem(new EventBus());
    for (let i = 0; i < 20; i++) cs.onHit(false, false, i + 1);
    expect(cs.tier).toBe(3);
    expect(cs.hasFinisher).toBe(true);
    const mul = cs.onHit(false, false, 21);
    expect(mul).toBe(1.3 * 1.5);
    expect(cs.hasFinisher).toBe(false);
  });
  it('onHurt 归零 + combo.break 事件', () => {
    const bus = new EventBus();
    const spy = vi.fn();
    bus.on('combo.break', spy);
    const cs = new ComboSystem(bus);
    cs.onHit(true, false, 1);
    cs.onHurt();
    expect(cs.count).toBe(0);
    expect(cs.tier).toBe(0);
    expect(spy).toHaveBeenCalled();
  });
  it('update 3s 内不衰减', () => {
    const cs = new ComboSystem(new EventBus());
    cs.onHit(true, false, 1);
    cs.update(2, 3);
    expect(cs.count).toBe(2);
  });
  it('update 3s 后线性衰减', () => {
    const cs = new ComboSystem(new EventBus());
    cs.onHit(true, false, 1);
    cs.update(1, 5);
    expect(cs.count).toBeLessThan(2);
    expect(cs.count).toBeGreaterThan(0);
  });
  it('update 衰减到 0 归零 + combo.break', () => {
    const bus = new EventBus();
    const spy = vi.fn();
    bus.on('combo.break', spy);
    const cs = new ComboSystem(bus);
    cs.onHit(false, false, 1);
    cs.update(2, 10);
    expect(cs.count).toBe(0);
    expect(spy).toHaveBeenCalled();
  });
  it('掉 tier3 再升回重新触发 finisher', () => {
    const cs = new ComboSystem(new EventBus());
    for (let i = 0; i < 20; i++) cs.onHit(false, false, i + 1);
    expect(cs.hasFinisher).toBe(true);
    cs.onHit(false, false, 21);
    expect(cs.hasFinisher).toBe(false);
    cs.onHurt();
    for (let i = 0; i < 20; i++) cs.onHit(false, false, 100 + i);
    expect(cs.hasFinisher).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `npx vitest run tests/gameplay/ComboSystem.test.js *> t1.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content t1.txt -Tail 5`
Expected: FAIL（ComboSystem 未定义/导入失败）

- [ ] **Step 3: 写 ComboSystem 实现**

Create `src/gameplay/ComboSystem.js`:
```js
export class ComboSystem {
  constructor(bus = null) {
    this._bus = bus;
    this.count = 0;
    this._lastHit = 0;
    this._tier = 0;
    this._finisher = false;
    this._decayDelay = 3;
    this._decayRate = 2;
    this._tiers = [[0, 1.0], [5, 1.1], [10, 1.2], [20, 1.3]];
  }

  onHit(countered, perfect, now) {
    const oldTier = this._tier;
    this.count += countered ? 2 : (perfect ? 3 : 1);
    this._lastHit = now;
    this._updateTier();
    let mul = this._tiers[this._tier][1];
    if (this._finisher) { mul *= 1.5; this._finisher = false; }
    if (oldTier < 3 && this._tier >= 3) {
      this._finisher = true;
      this._bus?.emit('combo.finisher');
    }
    if (this._tier !== oldTier) this._bus?.emit('combo.tier', { tier: this._tier, count: this.count });
    return mul;
  }

  onHurt() {
    if (this.count > 0 || this._finisher) {
      this.count = 0;
      this._tier = 0;
      this._finisher = false;
      this._bus?.emit('combo.break', { count: 0 });
    }
  }

  update(dt, now) {
    if (this.count <= 0) return;
    if (now - this._lastHit > this._decayDelay) {
      this.count -= this._decayRate * dt;
      if (this.count <= 0) {
        this.count = 0;
        this._tier = 0;
        this._finisher = false;
        this._bus?.emit('combo.break', { count: 0 });
      } else {
        this._updateTier();
      }
    }
  }

  _updateTier() {
    let t = 0;
    for (let i = 0; i < this._tiers.length; i++) if (this.count >= this._tiers[i][0]) t = i;
    this._tier = t;
  }

  get tier() { return this._tier; }
  get damageMul() { return this._tiers[this._tier][1]; }
  get hasFinisher() { return this._finisher; }
}
```

- [ ] **Step 4: 跑测试验证通过**

Run: `npx vitest run tests/gameplay/ComboSystem.test.js *> t1.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content t1.txt -Tail 5`
Expected: PASS（11 passed）

- [ ] **Step 5: 提交**

```bash
git add src/gameplay/ComboSystem.js tests/gameplay/ComboSystem.test.js
git commit -m "feat: ComboSystem 核心类 + 11 单测（累积/衰减/中断/层级/finisher）"
```

---

### Task 2: CombatSystem 集成 onHit + damageMul + countered + perfect 消费

**Files:**
- Modify: `src/gameplay/CombatSystem.js:13`（constructor 加 comboSys 参数）
- Modify: `src/gameplay/CombatSystem.js:119-141`（resolveMelee 命中点）

- [ ] **Step 1: 改 constructor 加 comboSys 参数**

`src/gameplay/CombatSystem.js:13`：
old: `  constructor(scene, bus) {`
new:
```js
  constructor(scene, bus, comboSys = null) {
```
在构造体内 `this.bus = bus;` 后加：
```js
    this._comboSys = comboSys;
```

- [ ] **Step 2: 改 resolveMelee 命中点调 onHit + 乘 damageMul**

`src/gameplay/CombatSystem.js:140`：
old: `        const dmg = baseDmg * this._counterMul(attacker.weapon, c.weapon) * (isBackstab ? 2 : 1);`
new:
```js
        const counterMul = this._counterMul(attacker.weapon, c.weapon);
        const countered = counterMul > 1.2;
        const perfect = !!attacker._perfectRebound;
        if (perfect) attacker._perfectRebound = false;
        const comboMul = this._comboSys ? this._comboSys.onHit(countered, perfect, now) : 1;
        const dmg = baseDmg * counterMul * (isBackstab ? 2 : 1) * comboMul;
```

- [ ] **Step 3: build 验证**

Run: `npx vite build --mode development *> b.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content b.txt -Tail 3`
Expected: 0 errors

- [ ] **Step 4: 提交**

```bash
git add src/gameplay/CombatSystem.js
git commit -m "feat: CombatSystem 集成 ComboSystem（resolveMelee 调 onHit + 乘 damageMul + countered/perfect 消费）"
```

---

### Task 3: Character 集成（_comboSys + _perfectRebound + onHurt + setComboSys）

**Files:**
- Modify: `src/gameplay/Character.js:13-61`（constructor 加字段）
- Modify: `src/gameplay/Character.js:254-258`（完美格挡设 _perfectRebound）
- Modify: `src/gameplay/Character.js:268-271`（掉血调 onHurt）
- Modify: `src/gameplay/Character.js` 末尾或 setBus 附近（加 setComboSys）

- [ ] **Step 1: constructor 加字段**

在 `src/gameplay/Character.js` constructor 内 `this._rage = 0;` 附近加：
```js
    this._comboSys = null;
    this._perfectRebound = false;
```

- [ ] **Step 2: 加 setComboSys 方法**

在 `setBus(b) { this._bus = b; }` 附近加：
```js
  setComboSys(cs) { this._comboSys = cs; }
```

- [ ] **Step 3: 完美格挡分支设 _perfectRebound**

`src/gameplay/Character.js:254-258` 完美格挡 `return 0` 前：
old:
```js
          if (this._perfectWindow > 0) {
            attacker._hurt = Math.max(attacker._hurt, 0.4); // 弹刀
            this.stamina.consume(0);
            if (this._bus) this._bus.emit('fx.perfectBlock', { char: this });
            return 0;
          }
```
new:
```js
          if (this._perfectWindow > 0) {
            attacker._hurt = Math.max(attacker._hurt, 0.4); // 弹刀
            this.stamina.consume(0);
            this._perfectRebound = true; // 标记下次反击 perfect
            if (this._bus) this._bus.emit('fx.perfectBlock', { char: this });
            return 0;
          }
```

- [ ] **Step 4: 掉血分支调 onHurt**

`src/gameplay/Character.js:268-271`：
old:
```js
    const lost = this.health.damage(amount);
    if (attacker) this.lastAttacker = attacker;
    if (!this.health.alive && this.alive) { this.die(attacker); }
    else if (lost > 0 && this.alive) {
```
new:
```js
    const lost = this.health.damage(amount);
    if (attacker) this.lastAttacker = attacker;
    if (!this.health.alive && this.alive) { this.die(attacker); }
    else if (lost > 0 && this.alive) {
      if (this._comboSys) this._comboSys.onHurt();
```

- [ ] **Step 5: build 验证**

Run: `npx vite build --mode development *> b.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content b.txt -Tail 3`
Expected: 0 errors

- [ ] **Step 6: 提交**

```bash
git add src/gameplay/Character.js
git commit -m "feat: Character 集成 ComboSystem（_comboSys/_perfectRebound + onHurt + setComboSys）"
```

---

### Task 4: HUD 连击 UI（#combo 元素 + 事件监听 + 衰减淡出）

**Files:**
- Modify: `src/ui/HUD.js` constructor（加 #combo 元素 + bus.on 监听）
- Modify: `src/ui/HUD.js` update（加 _comboTimer 淡出）
- Modify: `src/ui/HUD.js` 加 setComboHit 方法

- [ ] **Step 1: constructor 加 #combo 元素 + bus.on 监听**

在 `src/ui/HUD.js` constructor 内 `_counterEl` 创建后（约第 147 行 `this._counterTimer = 0;` 后）加：
```js
    this._comboEl = document.createElement('div');
    this._comboEl.id = 'combo';
    Object.assign(this._comboEl.style, {
      position: 'fixed', top: '30%', right: '8%', zIndex: '14',
      fontFamily: 'Segoe UI, sans-serif', fontSize: '40px', fontWeight: 'bold',
      color: '#fff', textShadow: '0 0 10px rgba(255,255,255,.6)',
      pointerEvents: 'none', display: 'none', opacity: '0',
      transition: 'opacity .2s, transform .2s'
    });
    document.body.appendChild(this._comboEl);
    this._comboTimer = 0;
    this._comboTier = 0;
    bus.on('combo.tier', ({ tier, count }) => {
      this._comboTier = tier;
      this._comboEl.textContent = count + ' 连击';
      const colors = ['#fff', '#fff5c8', '#ffd700', '#ff4433'];
      this._comboEl.style.color = colors[tier] || '#fff';
      this._comboEl.style.display = 'block';
      this._comboEl.style.opacity = '1';
      this._comboEl.style.transform = 'scale(1.2)';
      setTimeout(() => { this._comboEl.style.transform = 'scale(1)'; }, 100);
      this._comboTimer = 2;
    });
    bus.on('combo.break', () => {
      this._comboEl.style.opacity = '0';
      this._comboTimer = 0.3;
    });
    bus.on('combo.finisher', () => {
      this._comboEl.textContent = '终结就绪';
      this._comboEl.style.color = '#ff4433';
      this._comboEl.style.display = 'block';
      this._comboEl.style.opacity = '1';
      this._comboTimer = 1.5;
    });
```

- [ ] **Step 2: update 加 _comboTimer 淡出**

在 `src/ui/HUD.js` update 内 `_counterTimer` 块后加：
```js
    if (this._comboTimer > 0) {
      this._comboTimer -= dt;
      if (this._comboTimer < 0.5) this._comboEl.style.opacity = (this._comboTimer / 0.5).toString();
      if (this._comboTimer <= 0) this._comboEl.style.display = 'none';
    }
```

- [ ] **Step 3: build 验证**

Run: `npx vite build --mode development *> b.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content b.txt -Tail 3`
Expected: 0 errors

- [ ] **Step 4: 提交**

```bash
git add src/ui/HUD.js
git commit -m "feat: HUD 连击 UI（#combo 元素 + tier/break/finisher 事件 + 衰减淡出）"
```

---

### Task 5: main_entry 集成（实例化 + 注入 + 主循环 update + spawnAll reset）

**Files:**
- Modify: `src/main_entry.js:84-85`（combo 实例化 + 传 combat）
- Modify: `src/main_entry.js:184-186`（spawnAll 内 player.setComboSys + combo.reset）
- Modify: `src/main_entry.js:370`（主循环 combo.update）

- [ ] **Step 1: 实例化 combo + 传 combat**

`src/main_entry.js:84`：
old: `  const combat = new CombatSystem(scene.scene, bus);`
new:
```js
  const comboSys = new ComboSystem(bus);
  const combat = new CombatSystem(scene.scene, bus, comboSys);
```
在文件顶部 import 区加：
```js
import { ComboSystem } from './gameplay/ComboSystem.js';
```

- [ ] **Step 2: spawnAll 内注入 player + reset combo**

`src/main_entry.js:184` 附近 `player = new Player(camera, bus);` 后加：
```js
    player.setComboSys(comboSys);
    comboSys.count = 0; comboSys._tier = 0; comboSys._finisher = false;
```
（comboSys 是 bootstrap 顶层定义，spawnAll 闭包可访问；每局 reset 防止上局连击残留）

- [ ] **Step 3: 主循环加 combo.update**

`src/main_entry.js:370` `combat.update(ldt, terrain, now);` 后加：
```js
        comboSys.update(ldt, now);
```

- [ ] **Step 4: build 验证**

Run: `npx vite build --mode development *> b.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content b.txt -Tail 3`
Expected: 0 errors

- [ ] **Step 5: 全量单测**

Run: `npx vitest run *> t.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content t.txt -Tail 4`
Expected: EXIT=0（全部 passed，含 ComboSystem 11 + 既有 82 = 93）

- [ ] **Step 6: 提交**

```bash
git add src/main_entry.js
git commit -m "feat: main_entry 集成 ComboSystem（实例化+注入+主循环 update+spawnAll reset）"
```

---

### Task 6: 冒烟验证 + Playwright smoke 增 #combo 断言

**Files:**
- Modify: `e2e/smoke.spec.js`（加 #combo 存在断言）

- [ ] **Step 1: smoke spec 加 #combo 断言**

`e2e/smoke.spec.js` 在 `expect(errors.length).toBe(0);` 前加：
```js
  const comboEl = await page.locator('#combo').count();
  expect(comboEl).toBeGreaterThan(0);
```

- [ ] **Step 2: 跑 Playwright smoke**

Run: `npx playwright test *> p.txt 2>&1; Write-Host $LASTEXITCODE; Get-Content p.txt -Tail 8`
Expected: 1 passed（含 #combo 断言）

- [ ] **Step 3: 提交**

```bash
git add e2e/smoke.spec.js
git commit -m "test: smoke 增 #combo 元素断言"
```

---

### Task 7: 最终全量验证

- [ ] **Step 1: 全量单测 + build + smoke**

Run:
```powershell
npx vitest run *> t.txt 2>&1; $vt=$LASTEXITCODE
npx vite build --mode development *> b.txt 2>&1; $bd=$LASTEXITCODE
npx playwright test *> p.txt 2>&1; $pt=$LASTEXITCODE
Write-Host "VITEST=$vt BUILD=$bd PLAYWRIGHT=$pt"
Get-Content t.txt -Tail 4
```
Expected: VITEST=0 BUILD=0 PLAYWRIGHT=0

- [ ] **Step 2: 清理临时文件**

Run: `Remove-Item t.txt,b.txt,p.txt -ErrorAction SilentlyContinue`

- [ ] **Step 3: 确认工作区干净**

Run: `git status --short`
Expected: 无未提交改动（仅 `.superpowers/` untracked）

---

## Self-Review（已执行）

1. **Spec 覆盖**：累积（Task1 onHit）、中断（Task1 onHurt + Task3 Character.onHurt）、衰减（Task1 update + Task5 main_entry）、层级奖励（Task1 tier/damageMul）、数据流（Task2 resolveMelee + Task3 onHurt + Task5 update）、组件（Task1-5）、测试（Task1 单测 + Task6 smoke）、协同（克制→countered Task2、硬直→不涉及代码、天气→不涉及代码）、边界（combo null 用 ?. Task2、now 缺省 Task1）——全覆盖。
2. **Placeholder 扫描**：无 TBD/TODO，每步含完整代码。
3. **类型一致**：`onHit(countered, perfect, now)` 签名 Task1/Task2 一致；`_comboSys` 命名 Task2/3/5 一致；`combo.tier/combo.break/combo.finisher` 事件 Task1/Task4 一致；`#combo` id Task4/Task6 一致。

## 执行选择

**计划已保存到 `docs/superpowers/plans/2026-09-18-combo-system.md`。两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个 Task 派新子代理执行，任务间审查，快速迭代
2. **Inline Execution** — 当前会话内批量执行，检查点审查
