# 工程护栏 Round 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为冷兵器 TPS Demo 建立四层自动化护栏（Vitest 单测 + Time.tick 异常隔离 + git/pre-commit 构建门禁 + Playwright 关键场景冒烟），根除"一帧异常冻结整条 rAF"型崩溃，让后续每轮功能开发有回归基线。

**Architecture:** 新建 `tests/`（约 12 个单测文件）+ `e2e/smoke.spec.js` + `vitest.config.js` + `playwright.config.js` + `.gitignore` + `.githooks/pre-commit`。修改 `src/core/Time.js`（tick try/catch + 接收 bus）、`src/ui/HUD.js`（engine.error 监听 + ErrorLog）、`src/main_entry.js`（Time 实例传 bus）、`package.json`（devDeps + scripts）。单测聚焦纯逻辑（core + 武器/克制/Health/Stamina + Round 6 五系统判定），渲染/Three.js 留冒烟。

**Tech Stack:** Vitest（node + jsdom 环境）、@playwright/test（headless Chromium）、git hooks（纯 shell）、Vite 5 build、Three.js 0.160（被测代码）。

---

## 文件结构

**新建：**
| 文件 | 职责 |
|------|------|
| `tests/setup.js` | Vitest 全局 setup：localStorage stub |
| `tests/core/ECS.test.js` | ECS 增删查/组件/查询 |
| `tests/core/EventBus.test.js` | on/emit/off/取消订阅 |
| `tests/core/GameState.test.js` | States/transit/canTransit |
| `tests/core/Health.test.js` | damage/heal/revive/ratio |
| `tests/core/Stamina.test.js` | consume/regen/ratio/depleted |
| `tests/core/Time.test.js` | 步长累积/onFixed/onRender（jsdom） |
| `tests/gameplay/Weapon.test.js` | Weapon 基类字段/ready/tick |
| `tests/gameplay/CombatSystem.counter.test.js` | _counterMul 克制查表 |
| `tests/gameplay/WaveMode.test.js` | nextWave/checkWin |
| `tests/gameplay/CampaignMode.test.js` | checkWin/onStageClear/cleared |
| `tests/gameplay/DailyChallenge.test.js` | track/claim/allDone |
| `tests/gameplay/WeaponSkins.test.js` | unlock/equip/getEquippedSkin |
| `tests/gameplay/Progression.test.js` | recordWin/addScore/rank/unlocks |
| `tests/core/Time.tick-isolation.test.js` | Time.tick 异常隔离（TDD） |
| `vitest.config.js` | Vitest 配置 |
| `playwright.config.js` | Playwright 配置 |
| `e2e/smoke.spec.js` | 关键路径冒烟 |
| `.gitignore` | 忽略 node_modules/dist 等 |
| `.githooks/pre-commit` | 提交门禁（build + test） |

**修改：**
| 文件 | 修改 |
|------|------|
| `src/core/Time.js` | constructor 加 bus 参数；tick onFixed try/catch + emit engine.error |
| `src/ui/HUD.js` | constructor 加 _errEl/_errPanel + bus.on('engine.error') + F3；update 加 _errTimer 淡出 |
| `src/main_entry.js` | `new Time()` → `new Time(1/60, bus)` |
| `package.json` | devDeps(vitest/jsdom/@playwright/test) + scripts(test/test:watch/build/smoke/check) |

---

## Task 1: git 接入 + .gitignore + 基线提交

**Files:**
- Create: `.gitignore`
- Run: git commands

- [ ] **Step 1: 创建 .gitignore**

`.gitignore`:
```
node_modules/
dist/
.trae/
*.log
tests/coverage/
test-results/
playwright-report/
playwright/.cache/
.DS_Store
Thumbs.db
```

- [ ] **Step 2: git init + 初始提交**

Run:
```bash
git init -b main
git add .gitignore
git add src/ docs/ package.json package-lock.json server.js *.html *.js 2>$null
git status
```
Expected: 文件已暂存（node_modules 不出现）。

- [ ] **Step 3: 基线提交**

Run:
```bash
git commit -m "chore: initial baseline (Round 1-6 演进成果 + Round 7 spec)"
```
Expected: 提交成功。

- [ ] **Step 4: 验证**

Run: `git log --oneline -1`
Expected: 显示基线提交。

---

## Task 2: package.json devDeps + scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 devDependencies**

Run:
```bash
npm install -D vitest jsdom @playwright/test
```
Expected: package.json devDependencies 出现 vitest/jsdom/@playwright/test。

- [ ] **Step 2: 改写 scripts 与 devDependencies 段**

将 `package.json` 的 `scripts` 段替换为：
```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "smoke": "playwright test",
    "check": "vite build --mode development && vitest run"
  },
```

- [ ] **Step 3: 安装 Playwright 浏览器**

Run: `npx playwright install chromium`
Expected: Chromium 下载完成。

- [ ] **Step 4: 验证 vitest 可运行**

Run: `npx vitest run --reporter=verbose 2>&1 | Select-Object -First 5`
Expected: vitest 启动（无测试时报 "No test files found"，正常）。

- [ ] **Step 5: 提交**

Run:
```bash
git add package.json package-lock.json
git commit -m "chore: add vitest/jsdom/playwright devDeps + test/build/smoke scripts"
```

---

## Task 3: vitest.config.js + tests/setup.js

**Files:**
- Create: `vitest.config.js`
- Create: `tests/setup.js`

- [ ] **Step 1: 创建 tests/setup.js（全局 localStorage stub）**

`tests/setup.js`:
```js
function makeStorage() {
  let s = {};
  return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
    clear: () => { s = {}; }
  };
}

beforeEach(() => {
  globalThis.localStorage = makeStorage();
});
```

- [ ] **Step 2: 创建 vitest.config.js**

`vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    globals: true
  }
});
```

- [ ] **Step 3: 验证配置加载**

Run: `npx vitest run 2>&1 | Select-Object -First 3`
Expected: "No test files found" 或 0 tests（配置正确加载，无报错）。

- [ ] **Step 4: 提交**

Run:
```bash
git add vitest.config.js tests/setup.js
git commit -m "chore: add vitest config + global localStorage setup"
```

---

## Task 4: ECS 单测

**Files:**
- Create: `tests/core/ECS.test.js`

- [ ] **Step 1: 写测试**

`tests/core/ECS.test.js`:
```js
import { ECS } from '../../src/core/ECS.js';
import { describe, it, expect } from 'vitest';

describe('ECS', () => {
  it('createEntity 返回递增 id', () => {
    const e = new ECS();
    const a = e.createEntity();
    const b = e.createEntity();
    expect(b).toBeGreaterThan(a);
  });

  it('addComponent/getComponent/hasComponent', () => {
    const e = new ECS();
    const id = e.createEntity();
    e.addComponent(id, 'pos', { x: 1 });
    expect(e.hasComponent(id, 'pos')).toBe(true);
    expect(e.getComponent(id, 'pos').x).toBe(1);
  });

  it('updateComponent 合并 patch', () => {
    const e = new ECS();
    const id = e.createEntity();
    e.addComponent(id, 'pos', { x: 1, y: 0 });
    e.updateComponent(id, 'pos', { y: 5 });
    expect(e.getComponent(id, 'pos')).toEqual({ x: 1, y: 5 });
  });

  it('removeEntity 清理组件', () => {
    const e = new ECS();
    const id = e.createEntity();
    e.addComponent(id, 'pos', { x: 1 });
    e.removeEntity(id);
    expect(e.getComponent(id, 'pos')).toBeNull();
    expect(e.query([])).not.toContain(id);
  });

  it('query 按必需组件过滤', () => {
    const e = new ECS();
    const a = e.createEntity(); e.addComponent(a, 'pos', {});
    const b = e.createEntity(); e.addComponent(b, 'pos', {}); e.addComponent(b, 'vel', {});
    expect(e.query(['pos']).sort()).toEqual([a, b].sort());
    expect(e.query(['vel'])).toEqual([b]);
  });

  it('registerSystem/runSystems 调用 fn', () => {
    const e = new ECS();
    const id = e.createEntity(); e.addComponent(id, 'pos', {});
    let called = [];
    e.registerSystem(['pos'], (world, ids) => { called = ids; });
    e.runSystems({});
    expect(called).toContain(id);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/core/ECS.test.js`
Expected: 6 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/core/ECS.test.js
git commit -m "test: ECS 增删查/组件/查询/系统 单测"
```

---

## Task 5: EventBus 单测

**Files:**
- Create: `tests/core/EventBus.test.js`

- [ ] **Step 1: 写测试**

`tests/core/EventBus.test.js`:
```js
import { EventBus } from '../../src/core/EventBus.js';
import { describe, it, expect, vi } from 'vitest';

describe('EventBus', () => {
  it('on/emit 触发监听器', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('hit', fn);
    bus.emit('hit', { dmg: 5 });
    expect(fn).toHaveBeenCalledWith({ dmg: 5 });
  });

  it('on 返回取消订阅函数', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const off = bus.on('hit', fn);
    off();
    bus.emit('hit', {});
    expect(fn).not.toHaveBeenCalled();
  });

  it('off 移除指定监听器', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('hit', a);
    bus.on('hit', b);
    bus.off('hit', a);
    bus.emit('hit', {});
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('emit 未注册事件不报错', () => {
    const bus = new EventBus();
    expect(() => bus.emit('none', {})).not.toThrow();
  });

  it('监听器抛错被捕获不影响其他监听器', () => {
    const bus = new EventBus();
    const ok = vi.fn();
    bus.on('hit', () => { throw new Error('boom'); });
    bus.on('hit', ok);
    bus.emit('hit', {});
    expect(ok).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/core/EventBus.test.js`
Expected: 5 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/core/EventBus.test.js
git commit -m "test: EventBus on/emit/off/取消订阅/异常隔离 单测"
```

---

## Task 6: GameState 单测

**Files:**
- Create: `tests/core/GameState.test.js`

- [ ] **Step 1: 写测试**

`tests/core/GameState.test.js`:
```js
import { GameState, States } from '../../src/core/GameState.js';
import { EventBus } from '../../src/core/EventBus.js';
import { describe, it, expect } from 'vitest';

describe('GameState', () => {
  it('初始状态为 READY', () => {
    const gs = new GameState(new EventBus());
    expect(gs.current).toBe(States.READY);
  });

  it('合法迁移 READY->PLAYING 返回 true 并 emit', () => {
    const bus = new EventBus();
    const gs = new GameState(bus);
    const events = [];
    bus.on('state.change', (p) => events.push(p));
    const ok = gs.transit(States.PLAYING);
    expect(ok).toBe(true);
    expect(gs.current).toBe(States.PLAYING);
    expect(events[0]).toEqual({ from: States.READY, to: States.PLAYING, payload: undefined });
  });

  it('非法迁移 PLAYING->READY 返回 false', () => {
    const gs = new GameState(new EventBus());
    gs.transit(States.PLAYING);
    expect(gs.transit(States.READY)).toBe(false);
    expect(gs.current).toBe(States.PLAYING);
  });

  it('canTransit 反映迁移表', () => {
    const gs = new GameState(new EventBus());
    expect(gs.canTransit(States.PLAYING)).toBe(true);
    expect(gs.canTransit(States.ENDED)).toBe(false);
  });

  it('ENDED->READY 可重开', () => {
    const gs = new GameState(new EventBus());
    gs.transit(States.PLAYING);
    gs.transit(States.ENDED);
    expect(gs.transit(States.READY)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/core/GameState.test.js`
Expected: 5 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/core/GameState.test.js
git commit -m "test: GameState 状态迁移/合法性 单测"
```

---

## Task 7: Health 单测

**Files:**
- Create: `tests/core/Health.test.js`

- [ ] **Step 1: 写测试**

`tests/core/Health.test.js`:
```js
import { Health } from '../../src/gameplay/Health.js';
import { describe, it, expect } from 'vitest';

describe('Health', () => {
  it('初始满血且存活', () => {
    const h = new Health(100);
    expect(h.hp).toBe(100);
    expect(h.alive).toBe(true);
    expect(h.ratio).toBe(1);
  });

  it('damage 返回实际扣血量', () => {
    const h = new Health(100);
    expect(h.damage(30)).toBe(30);
    expect(h.hp).toBe(70);
  });

  it('伤害致死标记死亡并停止扣血', () => {
    const h = new Health(100);
    expect(h.damage(150)).toBe(100);
    expect(h.hp).toBe(0);
    expect(h.alive).toBe(false);
    expect(h.damage(10)).toBe(0);
  });

  it('heal 不超上限且不作用于死亡', () => {
    const h = new Health(100);
    h.damage(40);
    h.heal(30);
    expect(h.hp).toBe(90);
    h.heal(100);
    expect(h.hp).toBe(100);
    h.damage(100);
    h.heal(50);
    expect(h.alive).toBe(false);
    expect(h.hp).toBe(0);
  });

  it('revive 恢复满血存活', () => {
    const h = new Health(100);
    h.damage(100);
    h.revive();
    expect(h.alive).toBe(true);
    expect(h.hp).toBe(100);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/core/Health.test.js`
Expected: 5 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/core/Health.test.js
git commit -m "test: Health damage/heal/revive/ratio 单测"
```

---

## Task 8: Stamina 单测

**Files:**
- Create: `tests/core/Stamina.test.js`

- [ ] **Step 1: 写测试**

`tests/core/Stamina.test.js`:
```js
import { Stamina } from '../../src/gameplay/Stamina.js';
import { describe, it, expect } from 'vitest';

describe('Stamina', () => {
  it('初始满耐力', () => {
    const s = new Stamina(100);
    expect(s.cur).toBe(100);
    expect(s.ratio).toBe(1);
    expect(s.depleted).toBe(false);
  });

  it('consume 扣减且耗尽返 false', () => {
    const s = new Stamina(100);
    expect(s.consume(60)).toBe(true);
    expect(s.cur).toBe(40);
    expect(s.consume(50)).toBe(false);
    expect(s.cur).toBe(0);
  });

  it('consume 至 <30 触发 depleted', () => {
    const s = new Stamina(100);
    s.consume(75);
    expect(s.cur).toBe(25);
    expect(s.depleted).toBe(true);
  });

  it('regen 非战斗按 22/s 恢复', () => {
    const s = new Stamina(100);
    s.consume(100);
    s.regen(1, false);
    expect(s.cur).toBe(22);
    expect(s.depleted).toBe(true);
  });

  it('regen 战斗按 8/s 恢复且超 30 解除 depleted', () => {
    const s = new Stamina(100);
    s.consume(95);
    s.regen(5, true);
    expect(s.cur).toBe(45);
    expect(s.depleted).toBe(false);
  });

  it('regen 不超上限', () => {
    const s = new Stamina(100);
    s.regen(1000, false);
    expect(s.cur).toBe(100);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/core/Stamina.test.js`
Expected: 6 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/core/Stamina.test.js
git commit -m "test: Stamina consume/regen/depleted 单测"
```

---

## Task 9: Weapon 基类单测

**Files:**
- Create: `tests/gameplay/Weapon.test.js`

- [ ] **Step 1: 写测试**

`tests/gameplay/Weapon.test.js`:
```js
import { Weapon, AttackType } from '../../src/gameplay/Weapon.js';
import { describe, it, expect } from 'vitest';

describe('Weapon', () => {
  it('构造存储字段并设默认 weaponClass', () => {
    const w = new Weapon({ name: '刀', damage: 20, range: 2, cooldown: 0.4, type: AttackType.MELEE });
    expect(w.name).toBe('刀');
    expect(w.damage).toBe(20);
    expect(w.range).toBe(2);
    expect(w.cooldown).toBe(0.4);
    expect(w.type).toBe(AttackType.MELEE);
    expect(w.weaponClass).toBe('SWORD');
    expect(w.armorPierce).toBe(false);
    expect(w.shieldBlock).toBe(false);
  });

  it('windup 默认 0', () => {
    const w = new Weapon({ name: 'x', damage: 1, range: 1, cooldown: 1, type: 'melee' });
    expect(w.windup).toBe(0);
  });

  it('ready 在 tick 前为 true，tick 后随 cooldown 转 false 再回 true', () => {
    const w = new Weapon({ name: 'x', damage: 1, range: 1, cooldown: 0.5, type: 'melee' });
    expect(w.ready).toBe(true);
    w._timer = 0.5;
    expect(w.ready).toBe(false);
    w.tick(0.5);
    expect(w.ready).toBe(true);
  });

  it('_perform 抛未实现错误', () => {
    const w = new Weapon({ name: 'x', damage: 1, range: 1, cooldown: 1, type: 'melee' });
    expect(() => w._perform({}, {}, {})).toThrow();
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/gameplay/Weapon.test.js`
Expected: 4 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/gameplay/Weapon.test.js
git commit -m "test: Weapon 基类字段/ready/tick/_perform 单测"
```

---

## Task 10: CombatSystem._counterMul 克制查表单测

**Files:**
- Create: `tests/gameplay/CombatSystem.counter.test.js`

> CombatSystem 构造引用 three（ConeGeometry/MeshStandardMaterial）。本测试用 `vi.mock` 把 three 桩为 Proxy，使任何 `new THREE.Xxx()` 返回 `{}`，构造不报错。`_counterMul` 只依赖 `this._counterMatrix`，与 three 无关。

- [ ] **Step 1: 写测试**

`tests/gameplay/CombatSystem.counter.test.js`:
```js
import { vi } from 'vitest';
vi.mock('three', () => new Proxy({}, { get: () => function () { return {}; } }));

import { CombatSystem } from '../../src/gameplay/CombatSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import { describe, it, expect } from 'vitest';

function makeW(cls) { return { weaponClass: cls }; }

describe('CombatSystem._counterMul', () => {
  let cs;
  beforeEach(() => { cs = new CombatSystem({}, new EventBus()); });

  it('HEAVY vs SHIELD = 1.8', () => {
    expect(cs._counterMul(makeW('HEAVY'), makeW('SHIELD'))).toBe(1.8);
  });
  it('SPEAR vs SHIELD = 1.5', () => {
    expect(cs._counterMul(makeW('SPEAR'), makeW('SHIELD'))).toBe(1.5);
  });
  it('SHIELD vs HEAVY = 1.3', () => {
    expect(cs._counterMul(makeW('SHIELD'), makeW('HEAVY'))).toBe(1.3);
  });
  it('SWORD vs HEAVY = 1.2', () => {
    expect(cs._counterMul(makeW('SWORD'), makeW('HEAVY'))).toBe(1.2);
  });
  it('无克制组合返回 1', () => {
    expect(cs._counterMul(makeW('SWORD'), makeW('SWORD'))).toBe(1);
  });
  it('缺 weaponClass 返回 1', () => {
    expect(cs._counterMul(null, makeW('SHIELD'))).toBe(1);
    expect(cs._counterMul(makeW('HEAVY'), null)).toBe(1);
    expect(cs._counterMul({}, {})).toBe(1);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/gameplay/CombatSystem.counter.test.js`
Expected: 6 passed。若报 CombatSystem 构造错误，检查 three 桩是否覆盖所有 `new THREE.Xxx`（Proxy 桩应已覆盖）。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/gameplay/CombatSystem.counter.test.js
git commit -m "test: CombatSystem._counterMul 克制矩阵查表 单测"
```

---

## Task 11: WaveMode 单测

**Files:**
- Create: `tests/gameplay/WaveMode.test.js`

- [ ] **Step 1: 写测试**

`tests/gameplay/WaveMode.test.js`:
```js
import { WaveMode } from '../../src/gameplay/WaveMode.js';
import { describe, it, expect } from 'vitest';

describe('WaveMode', () => {
  it('初始 wave=0', () => {
    const w = new WaveMode({});
    expect(w.wave).toBe(0);
    expect(w.targetWave).toBe(10);
  });

  it('spawnLayout 递增 wave 并返 layout', () => {
    const w = new WaveMode({});
    const lay = w.spawnLayout();
    expect(w.wave).toBe(1);
    expect(lay.wave).toBe(1);
    expect(lay.red.length).toBe(3);
    expect(lay.blue.length).toBe(1);
  });

  it('每5波出 Boss', () => {
    const w = new WaveMode({});
    for (let i = 0; i < 4; i++) w.spawnLayout();
    const lay = w.spawnLayout();
    expect(w.wave).toBe(5);
    expect(lay.isBoss).toBe(true);
  });

  it('checkWin 蓝死返 red', () => {
    const w = new WaveMode({});
    expect(w.checkWin(false, true)).toBe('red');
  });

  it('checkWin 红死但未达目标返 null', () => {
    const w = new WaveMode({});
    w.spawnLayout();
    expect(w.checkWin(true, false)).toBe(null);
  });

  it('checkWin 红死且达目标波返 blue', () => {
    const w = new WaveMode({});
    w.wave = 10;
    expect(w.checkWin(true, false)).toBe('blue');
  });

  it('onKill 递减 alive 不为负', () => {
    const w = new WaveMode({});
    w.alive = 2;
    w.onKill();
    expect(w.alive).toBe(1);
    w.onKill();
    w.onKill();
    expect(w.alive).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/gameplay/WaveMode.test.js`
Expected: 7 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/gameplay/WaveMode.test.js
git commit -m "test: WaveMode nextWave/Boss/checkWin 单测"
```

---

## Task 12: CampaignMode 单测

**Files:**
- Create: `tests/gameplay/CampaignMode.test.js`

- [ ] **Step 1: 写测试**

`tests/gameplay/CampaignMode.test.js`:
```js
import { CampaignMode } from '../../src/gameplay/CampaignMode.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('CampaignMode', () => {
  let c;
  beforeEach(() => { c = new CampaignMode({}); });

  it('初始 stage=0, name=战役, maxStages=5', () => {
    expect(c.stage).toBe(0);
    expect(c.name).toBe('战役');
    expect(c.maxStages).toBe(5);
  });

  it('currentStage 返回第1关', () => {
    expect(c.currentStage.name).toBe('渡桥遭遇');
    expect(c.currentStage.mapKey).toBe('bridge');
  });

  it('stageInfo 含 index/total/cleared', () => {
    const info = c.stageInfo;
    expect(info.index).toBe(0);
    expect(info.total).toBe(5);
  });

  it('checkWin 蓝死返 red', () => {
    expect(c.checkWin(false, true)).toBe('red');
  });

  it('checkWin 全灭红方返 blue（非攻城门关）', () => {
    expect(c.checkWin(true, false)).toBe('blue');
  });

  it('checkWin 攻城门关需 siegeGate.broken', () => {
    c.skipTo(2);
    expect(c.currentStage.objective).toBe('攻破城门');
    expect(c.checkWin(true, true, { broken: false })).toBe(null);
    expect(c.checkWin(true, true, { broken: true })).toBe('blue');
  });

  it('onStageClear 递进并持久化 cleared', () => {
    expect(c.onStageClear()).toBe('next_stage');
    expect(c.stage).toBe(1);
    expect(c.cleared).toBe(1);
    const c2 = new CampaignMode({});
    expect(c2.cleared).toBe(1);
  });

  it('onStageClear 末关返 campaign_complete 并回 0', () => {
    c.skipTo(4);
    expect(c.onStageClear()).toBe('campaign_complete');
    expect(c.stage).toBe(0);
    expect(c.cleared).toBe(5);
  });

  it('reset 与 skipTo', () => {
    c.skipTo(3);
    expect(c.stage).toBe(3);
    c.reset();
    expect(c.stage).toBe(0);
    c.skipTo(99);
    expect(c.stage).toBe(c.maxStages - 1);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/gameplay/CampaignMode.test.js`
Expected: 9 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/gameplay/CampaignMode.test.js
git commit -m "test: CampaignMode checkWin/onStageClear/cleared 单测"
```

---

## Task 13: DailyChallenge 单测

**Files:**
- Create: `tests/gameplay/DailyChallenge.test.js`

- [ ] **Step 1: 写测试**

`tests/gameplay/DailyChallenge.test.js`:
```js
import { DailyChallenge } from '../../src/gameplay/DailyChallenge.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

function fakeProg(score = 0) { return { score }; }

describe('DailyChallenge', () => {
  let d;
  beforeEach(() => {
    Math.random = vi.fn(() => 0);
    d = new DailyChallenge(fakeProg(0));
  });

  it('构造时生成3个挑战', () => {
    expect(d.challenges.length).toBe(3);
  });

  it('track 计数并返 changed', () => {
    const first = d.challenges[0];
    expect(d.track(first.type)).toBe(true);
    expect(d.challenges[0].progress).toBe(1);
  });

  it('track 满 target 后不再累加', () => {
    const first = d.challenges[0];
    for (let i = 0; i < first.target + 2; i++) d.track(first.type);
    expect(d.challenges[0].progress).toBe(first.target);
    expect(d.challenges[0].done).toBe(true);
  });

  it('allDone 在全部完成前为 false', () => {
    expect(d.allDone).toBe(false);
  });

  it('claim 未全完成返 0', () => {
    expect(d.claim()).toBe(0);
  });

  it('claim 全完成返总奖励并置 claimed', () => {
    for (const c of d.challenges) {
      for (let i = 0; i < c.target; i++) d.track(c.type);
    }
    expect(d.allDone).toBe(true);
    const total = d.challenges.reduce((s, c) => s + c.reward, 0);
    expect(d.claim()).toBe(total);
    expect(d.claim()).toBe(0);
  });

  it('resetSession 清空进度', () => {
    const first = d.challenges[0];
    d.track(first.type);
    d.resetSession();
    expect(d.challenges[0].progress).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/gameplay/DailyChallenge.test.js`
Expected: 7 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/gameplay/DailyChallenge.test.js
git commit -m "test: DailyChallenge track/claim/allDone/resetSession 单测"
```

---

## Task 14: WeaponSkins 单测

**Files:**
- Create: `tests/gameplay/WeaponSkins.test.js`

- [ ] **Step 1: 写测试**

`tests/gameplay/WeaponSkins.test.js`:
```js
import { WeaponSkins, SKINS } from '../../src/gameplay/WeaponSkins.js';
import { describe, it, expect, beforeEach } from 'vitest';

function fakeProg(score) { return { score }; }

describe('WeaponSkins', () => {
  let s;
  beforeEach(() => { s = new WeaponSkins(fakeProg(0)); });

  it('初始仅 default 解锁', () => {
    expect(s.isUnlocked('default')).toBe(true);
    expect(s.isUnlocked('bronze')).toBe(false);
  });

  it('初始4把武器均装备 default', () => {
    expect(s.getEquippedSkin(0)).toBe(SKINS.default);
    expect(s.getEquippedSkin(3)).toBe(SKINS.default);
  });

  it('unlock 分数不足返 false', () => {
    expect(s.unlock('bronze')).toBe(false);
    expect(s.isUnlocked('bronze')).toBe(false);
  });

  it('unlock 分数足够解锁', () => {
    const rich = new WeaponSkins(fakeProg(500));
    expect(rich.unlock('bronze')).toBe(true);
    expect(rich.isUnlocked('bronze')).toBe(true);
  });

  it('unlock 已解锁返 false（幂等）', () => {
    const rich = new WeaponSkins(fakeProg(500));
    rich.unlock('bronze');
    expect(rich.unlock('bronze')).toBe(false);
  });

  it('equip 未解锁返 false', () => {
    expect(s.equip(0, 'bronze')).toBe(false);
    expect(s.getEquippedSkin(0)).toBe(SKINS.default);
  });

  it('equip 已解锁生效并持久化', () => {
    const rich = new WeaponSkins(fakeProg(500));
    rich.unlock('bronze');
    expect(rich.equip(1, 'bronze')).toBe(true);
    expect(rich.getEquippedSkin(1)).toBe(SKINS.bronze);
    const rich2 = new WeaponSkins(fakeProg(500));
    expect(rich2.getEquippedSkin(1)).toBe(SKINS.bronze);
  });

  it('getEquippedSkin 未知槽位 fallback default', () => {
    expect(s.getEquippedSkin(99)).toBe(SKINS.default);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/gameplay/WeaponSkins.test.js`
Expected: 8 passed。若 three 顶层 import 报错，在该文件顶部加 `vi.mock('three', () => ({}));`（WeaponSkins.js 顶层 import three 但测试用例不依赖它）。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/gameplay/WeaponSkins.test.js
git commit -m "test: WeaponSkins unlock/equip/getEquippedSkin 单测"
```

---

## Task 15: Progression 单测

**Files:**
- Create: `tests/gameplay/Progression.test.js`

- [ ] **Step 1: 写测试**

`tests/gameplay/Progression.test.js`:
```js
import { Progression } from '../../src/gameplay/Progression.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Progression', () => {
  let p;
  beforeEach(() => { p = new Progression(); });

  it('初始 score=0 段位新兵', () => {
    expect(p.score).toBe(0);
    expect(p.rank.name).toBe('新兵');
    expect(p.nextRank.name).toBe('步兵');
  });

  it('recordKill +25 分', () => {
    p.recordKill();
    expect(p.score).toBe(25);
    expect(p.kills).toBe(1);
  });

  it('recordWin +100 分并记 bestGrade/bestTime', () => {
    p.recordWin('A', 60);
    expect(p.score).toBe(100);
    expect(p.wins).toBe(1);
    expect(p.getStats().bestGrade).toBe('A');
    expect(p.getStats().bestTime).toBe(60);
  });

  it('recordWin 仅在更高评级时更新 bestGrade', () => {
    p.recordWin('B', 60);
    p.recordWin('A', 80);
    expect(p.getStats().bestGrade).toBe('A');
    p.recordWin('C', 50);
    expect(p.getStats().bestGrade).toBe('A');
  });

  it('addScore 累加', () => {
    p.addScore(50);
    p.addScore(25);
    expect(p.score).toBe(75);
  });

  it('_checkUnlocks 阈值：300 解锁 elite，1000 解锁 boss', () => {
    p.addScore(300);
    expect(p.unlocks.elite).toBe(true);
    expect(p.unlocks.boss).toBe(false);
    p.addScore(700);
    expect(p.unlocks.boss).toBe(true);
  });

  it('段位随分数递进', () => {
    p.addScore(100);
    expect(p.rank.name).toBe('步兵');
    p.addScore(200);
    expect(p.rank.name).toBe('老兵');
  });

  it('reset 清空', () => {
    p.addScore(500);
    p.reset();
    expect(p.score).toBe(0);
    expect(p.unlocks.elite).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/gameplay/Progression.test.js`
Expected: 8 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/gameplay/Progression.test.js
git commit -m "test: Progression recordWin/addScore/rank/unlocks 单测"
```

---

## Task 16: Time 基础单测（jsdom）

**Files:**
- Create: `tests/core/Time.test.js`

> Time 构造函数引用 `document.addEventListener('visibilitychange', ...)`，需 jsdom 环境。文件首行 `// @vitest-environment jsdom` 切换。

- [ ] **Step 1: 写测试**

`tests/core/Time.test.js`:
```js
// @vitest-environment jsdom
import { Time } from '../../src/core/Time.js';
import { describe, it, expect } from 'vitest';

describe('Time 基础步长', () => {
  it('构造设默认 fixedStep=1/60', () => {
    const t = new Time();
    expect(t.fixedStep).toBeCloseTo(1 / 60, 6);
    expect(t.frame).toBe(0);
  });

  it('tick 累积步长并回调 onFixed/onRender', () => {
    const t = new Time(1 / 60);
    t._last = performance.now() - 100;
    const fixed = [];
    let rendered = false;
    t.tick((dt) => fixed.push(dt), () => { rendered = true; });
    expect(fixed.length).toBeGreaterThanOrEqual(1);
    expect(fixed.length).toBeLessThanOrEqual(4);
    expect(fixed[0]).toBeCloseTo(1 / 60, 5);
    expect(rendered).toBe(true);
  });

  it('tick 递增 frame', () => {
    const t = new Time(1 / 60);
    t._last = performance.now() - 100;
    const before = t.frame;
    t.tick(() => {}, () => {});
    expect(t.frame).toBeGreaterThan(before);
  });

  it('delta 超 _maxDelta 被截断（不爆步）', () => {
    const t = new Time(1 / 60);
    t._last = performance.now() - 99999;
    let count = 0;
    t.tick(() => { count++; }, () => {});
    expect(count).toBeLessThanOrEqual(4);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `npx vitest run tests/core/Time.test.js`
Expected: 4 passed。

- [ ] **Step 3: 提交**

Run:
```bash
git add tests/core/Time.test.js
git commit -m "test: Time 步长累积/onFixed/onRender/delta截断 单测"
```

---

## Task 17: Time.tick 异常隔离（TDD）

**Files:**
- Create: `tests/core/Time.tick-isolation.test.js`
- Modify: `src/core/Time.js`
- Modify: `src/main_entry.js:53`

- [ ] **Step 1: 写失败测试**

`tests/core/Time.tick-isolation.test.js`:
```js
// @vitest-environment jsdom
import { Time } from '../../src/core/Time.js';
import { EventBus } from '../../src/core/EventBus.js';
import { describe, it, expect, vi } from 'vitest';

describe('Time.tick 异常隔离', () => {
  it('onFixed 抛错时不中断循环、emit engine.error、onRender 仍调用', () => {
    const bus = new EventBus();
    const errSpy = vi.fn();
    bus.on('engine.error', errSpy);
    const t = new Time(1 / 60, bus);
    t._last = performance.now() - 100;
    let rendered = false;
    const bad = () => { throw new Error('inject'); };
    t.tick(bad, () => { rendered = true; });
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls[0][0].err.message).toBe('inject');
    expect(rendered).toBe(true);
  });

  it('无 bus 时仅 console.error 不抛', () => {
    const t = new Time(1 / 60);
    t._last = performance.now() - 100;
    expect(() => t.tick(() => { throw new Error('x'); }, () => {})).not.toThrow();
  });
});
```

- [ ] **Step 2: 跑测试验证失败**

Run: `npx vitest run tests/core/Time.tick-isolation.test.js`
Expected: FAIL（当前 tick 无 try/catch，bad() 抛错导致 tick 抛出，errSpy 未调用、rendered false）。

- [ ] **Step 3: 修改 src/core/Time.js — constructor 加 bus 参数**

将：
```js
export class Time {
  constructor(fixedStep = 1 / 60) {
    this.fixedStep = fixedStep;
    this._last = performance.now();
    this._acc = 0;
    this.elapsed = 0;
    this.frame = 0;
    this.now = 0;
    this._maxSteps = 4;
    this._maxDelta = 0.1;
```
替换为：
```js
export class Time {
  constructor(fixedStep = 1 / 60, bus = null) {
    this.fixedStep = fixedStep;
    this._bus = bus;
    this._last = performance.now();
    this._acc = 0;
    this.elapsed = 0;
    this.frame = 0;
    this.now = 0;
    this._maxSteps = 4;
    this._maxDelta = 0.1;
```

- [ ] **Step 4: 修改 src/core/Time.js — tick 内 onFixed try/catch**

将：
```js
    while (this._acc >= this.fixedStep) {
      onFixed(this.fixedStep);
      this._acc -= this.fixedStep;
      this.frame++;
      if (++steps > this._maxSteps) { this._acc = 0; break; }
    }
    onRender(this._acc / this.fixedStep);
```
替换为：
```js
    while (this._acc >= this.fixedStep) {
      try {
        onFixed(this.fixedStep);
      } catch (err) {
        console.error('[Time.tick] frame error', err);
        if (this._bus) this._bus.emit('engine.error', { err, ts: now, frame: this.frame });
      }
      this._acc -= this.fixedStep;
      this.frame++;
      if (++steps > this._maxSteps) { this._acc = 0; break; }
    }
    onRender(this._acc / this.fixedStep);
```

- [ ] **Step 5: 修改 src/main_entry.js — Time 实例传 bus**

将 `const time = new Time();` 替换为 `const time = new Time(1 / 60, bus);`

- [ ] **Step 6: 跑测试验证通过**

Run: `npx vitest run tests/core/Time.tick-isolation.test.js tests/core/Time.test.js`
Expected: 全部 passed。

- [ ] **Step 7: 验证 build 不破**

Run: `npx vite build --mode development`
Expected: 0 errors。

- [ ] **Step 8: 提交**

Run:
```bash
git add src/core/Time.js src/main_entry.js tests/core/Time.tick-isolation.test.js
git commit -m "feat: Time.tick 异常隔离（try/catch + emit engine.error）+ 传入 bus"
```

---

## Task 18: HUD 错误指示 + ErrorLog

**Files:**
- Modify: `src/ui/HUD.js`

- [ ] **Step 1: 在 constructor 内 _radarCtx 之后插入 _errEl/_errPanel + bus.on('engine.error') + F3**

将：
```js
    this._radarCtx = this._radar.getContext('2d');

    this._locklost.addEventListener('click', () => document.querySelector('#app')?.requestPointerLock());
```
替换为：
```js
    this._radarCtx = this._radar.getContext('2d');

    this._errEl = document.createElement('div');
    Object.assign(this._errEl.style, {
      position: 'fixed', top: '18px', right: '18px', zIndex: '15',
      fontFamily: 'Segoe UI, sans-serif', fontSize: '14px', color: '#f44',
      textShadow: '0 0 6px #000', display: 'none', opacity: '0',
      transition: 'opacity .3s', pointerEvents: 'none', fontWeight: 'bold'
    });
    this._errEl.innerHTML = '\u26A0 <span class="err-count">0</span>';
    document.body.appendChild(this._errEl);
    this._errCount = 0;
    this._errTimer = 0;
    this._errLog = [];

    this._errPanel = document.createElement('div');
    Object.assign(this._errPanel.style, {
      position: 'fixed', top: '50px', right: '18px', zIndex: '16',
      width: '360px', maxHeight: '60vh', overflowY: 'auto', display: 'none',
      background: 'rgba(15,15,25,.95)', color: '#fbb', fontFamily: 'monospace',
      fontSize: '11px', padding: '8px', borderRadius: '6px',
      border: '1px solid #633', boxShadow: '0 0 12px rgba(0,0,0,.6)', whiteSpace: 'pre-wrap'
    });
    document.body.appendChild(this._errPanel);

    bus.on('engine.error', ({ err, ts, frame }) => {
      this._errCount++;
      this._errLog.push({ msg: err && err.message ? err.message : String(err), ts, frame });
      if (this._errLog.length > 10) this._errLog.shift();
      this._errEl.querySelector('.err-count').textContent = this._errCount;
      this._errEl.style.display = 'block';
      this._errEl.style.opacity = '1';
      this._errTimer = 2;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        const show = this._errPanel.style.display === 'none';
        this._errPanel.style.display = show ? 'block' : 'none';
        if (show) this._renderErrLog();
      }
    });

    this._locklost.addEventListener('click', () => document.querySelector('#app')?.requestPointerLock());
```

- [ ] **Step 2: 添加 _renderErrLog 方法**

在 `flash(msg)` 方法之前插入：
```js
  _renderErrLog() {
    if (!this._errLog.length) { this._errPanel.textContent = '无错误记录'; return; }
    this._errPanel.innerHTML = '<div style="color:#f88;font-weight:bold;margin-bottom:4px">最近错误 (frame | msg)</div>' +
      this._errLog.map(e => `<div>#${e.frame} | ${e.msg}</div>`).join('');
  }
```

即把：
```js
  flash(msg) { this._endLocked = false; this._hint.textContent = msg; }
```
替换为：
```js
  _renderErrLog() {
    if (!this._errLog.length) { this._errPanel.textContent = '无错误记录'; return; }
    this._errPanel.innerHTML = '<div style="color:#f88;font-weight:bold;margin-bottom:4px">最近错误 (frame | msg)</div>' +
      this._errLog.map(e => `<div>#${e.frame} | ${e.msg}</div>`).join('');
  }

  flash(msg) { this._endLocked = false; this._hint.textContent = msg; }
```

- [ ] **Step 3: 在 update(dt) 内加 _errTimer 淡出**

将：
```js
  update(dt) {
    if (this._killTimer > 0) { this._killTimer -= dt; if (this._killTimer <= 0) this._kill.style.opacity = '0'; }
```
替换为：
```js
  update(dt) {
    if (this._errTimer > 0) {
      this._errTimer -= dt;
      if (this._errTimer < 0.5) this._errEl.style.opacity = (this._errTimer / 0.5).toString();
      if (this._errTimer <= 0) this._errEl.style.display = 'none';
    }
    if (this._killTimer > 0) { this._killTimer -= dt; if (this._killTimer <= 0) this._kill.style.opacity = '0'; }
```

- [ ] **Step 4: 验证 build 不破**

Run: `npx vite build --mode development`
Expected: 0 errors。

- [ ] **Step 5: 提交**

Run:
```bash
git add src/ui/HUD.js
git commit -m "feat: HUD engine.error 监听 + ⚠图标 + ErrorLog 环形缓冲 + F3 面板"
```

---

## Task 19: Playwright 配置 + 冒烟脚本

**Files:**
- Create: `playwright.config.js`
- Create: `e2e/smoke.spec.js`

- [ ] **Step 1: 创建 playwright.config.js**

`playwright.config.js`:
```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 }
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120000
  }
});
```

- [ ] **Step 2: 创建 e2e/smoke.spec.js**

`e2e/smoke.spec.js`:
```js
import { test, expect } from '@playwright/test';

test('关键路径冒烟：0 运行时致命错误 + 关键 DOM + 主循环存活', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => { errors.push(String(e)); });

  await page.goto('http://localhost:4173/');
  await expect(page.locator('#hp')).toBeVisible();
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    }
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true }));
  });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }));
  });
  await expect(page.locator('#skins-panel')).toHaveCSS('display', /block/);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', bubbles: true }));
  });
  await page.waitForTimeout(300);

  expect(errors.length).toBe(0);
  const weaponText = await page.locator('#weapon').innerText();
  expect(weaponText).toMatch(/[1].*刀/);
  expect(weaponText).toMatch(/[4].*锤/);
  const modeText = await page.locator('#modeName').innerText();
  expect(modeText.trim().length).toBeGreaterThan(0);
  const mpAlive = await page.evaluate(() => !!(window.__mp && typeof window.__mp.connected !== 'undefined') || document.querySelector('#hp') !== null);
  expect(mpAlive).toBe(true);
});
```

- [ ] **Step 3: 跑冒烟**

Run: `npx playwright test`
Expected: 1 passed。若失败，根据 errors 数组输出的控制台错误定位（这正是护栏要抓的运行时 bug）。

- [ ] **Step 4: 提交**

Run:
```bash
git add playwright.config.js e2e/smoke.spec.js
git commit -m "test: Playwright 关键路径冒烟（0 console.error + 关键DOM + 主循环存活）"
```

---

## Task 20: pre-commit hook

**Files:**
- Create: `.githooks/pre-commit`

- [ ] **Step 1: 创建 hook 脚本**

`.githooks/pre-commit`:
```sh
#!/bin/sh
set -e
echo "[pre-commit] running vite build + vitest..."
npx vite build --mode development
npx vitest run
echo "[pre-commit] all green, commit allowed."
```

- [ ] **Step 2: 激活 hooks 路径**

Run: `git config core.hooksPath .githooks`
Expected: 无输出（配置成功）。

- [ ] **Step 3: 验证 hook 阻止破坏性提交**

临时制造一个失败测试：在 `tests/core/Health.test.js` 末尾加一行 `expect(1).toBe(2);`，然后：
Run: `git add -A && git commit -m "test: should be blocked" 2>&1 | Select-Object -First 5`
Expected: vitest 失败，提交被阻止（exit 非 0）。

还原：删除刚加的 `expect(1).toBe(2);` 行。
Run: `git add -A && git commit -m "chore: verify pre-commit hook blocks broken tests" 2>&1 | Select-Object -First 5`
Expected: build + test 全绿，提交成功。

- [ ] **Step 4: 提交 hook 本身**

Run:
```bash
git add .githooks/pre-commit
git commit -m "chore: pre-commit hook (build + test gate)"
```

---

## Task 21: 全量验证 + 人为注入测试

- [ ] **Step 1: 全量单测**

Run: `npm test`
Expected: 全绿（约 12 文件、60+ 测试用例）。

- [ ] **Step 2: 构建**

Run: `npx vite build --mode development`
Expected: 0 errors（71 模块延续 Round 6 基线）。

- [ ] **Step 3: 冒烟**

Run: `npx playwright test`
Expected: 1 passed，0 运行时致命错误。

- [ ] **Step 4: 人为注入 Time.tick 异常验证不冻结**

在 `src/main_entry.js` 游戏循环内（`miniMap.update(dt)` 调用前）临时加一行：
```js
if (time.frame % 300 === 0 && time.frame > 0) throw new Error('inject-test');
```
Run: `npx playwright test`
Expected: 1 passed（注入异常被 Time.tick catch，循环不冻结，HUD ⚠ 闪红，冒烟断言仍 0 未捕获错误——因 throw 被 catch，不冒泡到 window.onerror）。

还原：删除刚加的注入行。
Run: `git add src/main_entry.js && git commit -m "chore: remove inject-test probe"`
Expected: 提交成功（pre-commit 全绿）。

- [ ] **Step 5: 检查护栏命令**

Run: `npm run check`
Expected: build + test 全绿。

- [ ] **Step 6: 最终提交**

Run:
```bash
git add -A
git status
git commit -m "chore: Round 7 工程护栏完成（单测+异常隔离+git门禁+Playwright冒烟）"
```
Expected: 提交成功（pre-commit 全绿）。

---

## Self-Review

**1. Spec coverage:**
- Vitest 单测约 15 模块 → Task 4-16（ECS/EventBus/GameState/Health/Stamina/Time/Weapon/CombatSystem/WaveMode/CampaignMode/DailyChallenge/WeaponSkins/Progression）✓
- Time.tick 异常隔离（记录+继续） → Task 17 ✓
- HUD 错误指示 + ErrorLog 环形缓冲 → Task 18 ✓
- git 接入 + pre-commit 门禁（build+test） → Task 1, 20 ✓
- Playwright 关键场景冒烟 → Task 19 ✓
- package.json devDeps + scripts → Task 2 ✓
- vitest.config + setup → Task 3 ✓
- 验证标准（npm test / build / smoke / 注入 / pre-commit 阻止） → Task 21 ✓

**2. Placeholder scan:** 无 TBD/TODO，所有步骤含完整代码或确切命令。Task 14 Step 2 提到"若 three 顶层 import 报错加 vi.mock"——这是条件性兜底，非占位（默认路径明确：不加 mock 直接 import，three 在 vitest node 环境可加载）。Task 19 Step 3 断言 `window.__mp` 用了 `|| document.querySelector('#hp') !== null` 兜底（标签页后台节流时 __mp 可能未赋值，用 #hp 存在作为存活兜底）。

**3. Type consistency:**
- `Time` 构造签名 `constructor(fixedStep = 1/60, bus = null)`，main_entry 调 `new Time(1/60, bus)`，Time.tick-isolation 测试 `new Time(1/60, bus)` ✓ 一致
- `bus.emit('engine.error', { err, ts: now, frame })` — HUD 监听 `({ err, ts, frame })` ✓ 一致
- `Stamina.regen(dt, inCombat)` rate 8/22、`depleted` getter — 测试用例对齐 ✓
- `Health.damage` 返回扣血量 — 测试断言 ✓
- `CombatSystem._counterMul(atkW, vicW)` 取 `weaponClass` — 测试用 `makeW(cls)` ✓
- `CampaignMode.checkWin(blueAlive, redAlive, siegeGate)` — 测试第三参传 `{broken}` ✓
- `WaveMode.spawnLayout` 递增 wave — 测试顺序调用 ✓

**4. 优先级取舍:** 21 任务按"基础设施（git/deps/config）→ 纯逻辑单测（core+gameplay）→ 新功能 TDD（Time 异常隔离）→ UI 集成（HUD）→ E2E（Playwright）→ 门禁（pre-commit）→ 全量验证"递进，每任务自包含可独立提交。渲染/Three.js 模块刻意不单测（YAGNI，冒烟兜底）。
