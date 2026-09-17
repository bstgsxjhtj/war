# 工程护栏 Round 7 设计文档

## 背景

古代冷兵器 TPS Web Demo 经历 6 轮演进，已具备成熟可玩闭环（48 个源文件）。但项目**零自动化测试**，全靠浏览器手动验证，导致 Round 6 收尾时发现致命 bug：`MiniMap.js`/`BossEnemy.js` 使用了不存在的 `this.mesh`（角色只有 `this.root`），在游戏循环每帧调用的 `miniMap.update` 抛 `TypeError`；而 `Time.tick` 无 `try/catch` 兜底，一帧异常直接冻结整条 `requestAnimationFrame` 主循环，造成 #weapon 卡 2 把、比分 0-0、M 键失灵等连锁症状。

根因是缺乏自动化护栏：纯逻辑回归无单测拦截、运行时异常无隔离、提交无构建门禁、关键路径无冒烟。本设计建立四层护栏，根除"一坏全坏"型崩溃，让后续每轮功能开发有兜底。

## 目标与非目标

**目标：**
- 引入 Vitest 单测，覆盖核心纯逻辑与 Round 6 新系统纯判定（约 15 模块）。
- `Time.tick` 异常隔离：每帧 `onFixed` 回调 try/catch，记录 + 继续，不冻结循环。
- HUD 错误指示 + ErrorLog 环形缓冲，运行时异常对玩家/开发者可见。
- git 接入 + pre-commit 构建门禁（build + test），阻止破坏性提交。
- Playwright 关键场景冒烟，脚本化加载/移动/攻击/M 切模式/V 皮肤/N 天气路径，断言 0 运行时致命错误。

**非目标（YAGNI）：**
- 不接 GitHub Actions / 远程 CI（项目非 GitHub 托管，留后续）。
- 不设覆盖率门槛（先建基线，不卡进度）。
- 不测渲染/Three.js 相关模块（Character/Renderer/Terrain/Environment，成本高收益低，由冒烟兜底）。
- 不重构现有代码（仅加护栏，不改行为）。
- 不引入 husky/lint-staged（pre-commit 用简单 shell 脚本减依赖）。

## 决策汇总

| 维度 | 决策 |
|------|------|
| 主攻方向 | 工程护栏优先 |
| 护栏深度 | 标准护栏（单测+异常隔离+git+pre-commit+冒烟） |
| 单测范围 | core + 武器表 + 克制矩阵 + Health/Stamina + 新系统纯判定，约 15 模块 |
| 异常隔离策略 | 记录 + 继续（try/catch + emit engine.error + HUD 闪错，不中断循环） |
| 冒烟形态 | Playwright headless Chromium 关键路径 |

## 架构与组件

### 1. Vitest 单测套件

**新建文件：**
- `tests/` 目录，按模块组织测试文件
- `vitest.config.js`

**覆盖范围（约 15 个测试文件）：**

core 层：
- `tests/core/ECS.test.js` — 实体增删查、组件挂载/查询
- `tests/core/EventBus.test.js` — on/emit/off、多监听、一次性
- `tests/core/GameState.test.js` — States 枚举、transit 合法/非法迁移、current 状态
- `tests/core/Time.test.js` — 固定步长累积、onFixed 回调、帧追赶

gameplay 层（纯逻辑）：
- `tests/gameplay/Weapon.test.js` — 伤害/攻速/距离/weaponClass 字段表
- `tests/gameplay/CombatSystem.counter.test.js` — `_counterMatrix` 克制查表（HEAVY vs SHIELD=1.8 等），阈值 >1.2 触发克制
- `tests/gameplay/Health.test.js` — takeDamage/死亡判定/ratio
- `tests/gameplay/Stamina.test.js` — consume/regen/ratio/debuff 阈值

Round 6 新系统纯判定：
- `tests/gameplay/CampaignMode.test.js` — checkWin（全灭/攻城门）、onStageClear 递进、campaign_complete、cleared 持久化（mock localStorage）
- `tests/gameplay/DailyChallenge.test.js` — _regenerate 抽3不重复、track 计数、allDone、claim 领奖、resetSession
- `tests/gameplay/WeaponSkins.test.js` — unlock（分数门槛）、equip、getEquippedSkin fallback
- `tests/gameplay/WaveMode.test.js` — nextWave 递增、isBoss（每5波）、count 公式
- `tests/gameplay/Progression.test.js` — recordWin/recordLoss、_checkUnlocks 段位、addScore、score/段位 getter

**配置要点：**
- `vitest.config.js`：默认 `environment: 'node'`（多数纯逻辑）；个别需 DOM 的测试用 `// @vitest-environment jsdom` 注释行声明。
- Three.js 相关 import 在纯逻辑测试中通过 mock 或不引入（被测函数若 import three，需评估——CombatSystem._counterMatrix 是纯查表方法，可测；若模块顶层 import three 报错，用 vitest mock `three`）。
- 命令：`npm test`（vitest run，单次）、`npm run test:watch`（watch 模式）。

**依赖：** `vitest`（devDependency）。若需 jsdom 环境个别测试，加 `jsdom`。

### 2. Time.tick 异常隔离

**修改文件：** `src/core/Time.js`

**当前问题：** `tick` 方法纯 while 循环调 `onFixed`，无 try/catch，任一回调抛异常则 rAF 链断裂，游戏冻结。

**设计：**
- 在 `tick` 内对每次 `onFixed(now)` 调用包裹 `try { onFixed(now) } catch (err) { ... }`。
- catch 块：`console.error('[Time.tick] frame error', err)`；若 `this._bus` 存在则 `this._bus.emit('engine.error', { err, ts: now, frame: this._frame })`；`this._frame` 为已存在的帧计数（若无则新增）。
- **不中断 while 循环**——异常帧跳过，后续帧继续。
- 不引入"连续异常降级暂停"（避免误判，留后续）。

**接口要求：** `Time` 构造函数需接收 `bus`（若当前未接，增加可选 `bus` 参数并存储 `this._bus`；`main_entry.js` 实例化时传入 `bus`）。若改动需向后兼容（bus 可选，无 bus 时仅 console.error）。

### 3. HUD 错误指示 + ErrorLog

**修改文件：** `src/ui/HUD.js`（HUD 已持有 `bus` 引用）

**设计：**
- HUD constructor 创建 `_errEl`（右上角 ⚠ 图标 + 计数角标，初始隐藏）。
- 监听 `bus.on('engine.error', ({ err, ts, frame }) => { ... })`：
  - `_errEl` 显示，闪红色 2s（CSS transition opacity）。
  - 计数 +1，角标更新。
  - 推入环形缓冲 `_errLog`（容量 10，存 `{ msg: err.message, ts, frame }`，FIFO 溢出丢最旧）。
- 调试键（**F3**，若已占用则用反引号 `` ` ``）切换 `_errPanel` 显示最近 10 条错误列表（msg + frame + 相对时间）。
- HUD `update(dt)` 维护错误图标淡出计时器。

**注意：** F3 在浏览器可能有默认行为（devtools），需 `e.preventDefault()`；若冲突改用反引号键。spec 标注为"F3 或反引号（实施时确认无冲突）"。

### 4. git 接入 + pre-commit 门禁

**新建文件：**
- `.gitignore`：`node_modules/`、`dist/`、`.trae/`、`*.log`、`tests/coverage/`、`.playwright/`（若产出）、操作系统临时文件
- `.githooks/pre-commit`（或 `.husc/pre-commit` 简单脚本）

**设计：**
- `git init` → 配置默认分支 `main` → 写 `.gitignore` → `git add .` → 初始基线提交 `chore: initial baseline (Round 1-6 演进成果)`。
- pre-commit hook（**纯 shell 脚本，无 husky**）：
  ```sh
  #!/bin/sh
  set -e
  npx vite build --mode development
  npm test
  ```
  通过 `git config core.hooksPath .githooks`（或 `.git/hooks/` 软链）激活；Windows 环境若 sh 不可用，提供 `.githooks/pre-commit.cmd` PowerShell 版本兜底。
- `package.json` scripts 新增：
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`
  - `"build": "vite build"`
  - `"smoke": "playwright test"`（见组件5）
  - `"check": "vite build --mode development && vitest run"`（等价 pre-commit）

**注意：** 项目此前非 git 仓库（`git log` 报 fatal）。git 接入为本护栏实施首步，spec 文档本身也随基线提交。

### 5. Playwright 关键场景冒烟

**新建文件：**
- `e2e/smoke.spec.js`
- `playwright.config.js`

**设计：**
- `playwright.config.js`：单 Chromium project，`headless: true`，`webServer: { command: 'npm run build && vite preview --port 4173', port: 4173, reuseExistingServer: true }`（用 preview 跑 build 产物，更接近生产）。
- `e2e/smoke.spec.js` 关键路径：
  1. `await page.goto('http://localhost:4173/')`
  2. 等待场景渲染（`#hp` 出现）
  3. `page.evaluate` 派发 WASD keydown 几帧 → 等 500ms
  4. 派发鼠标左键 mousedown/up（攻击）→ 等 300ms
  5. 派发 `KeyM` keydown（切模式）→ 等 1.5s（loadMap 重生成）
  6. 派发 `KeyV`（皮肤面板）→ 断言 `#skins-panel` display block → Esc 关
  7. 派发 `KeyN`（天气）→ 断言 `#hint` 文本含"天气"
- 断言：
  - `page.on('console')` 收集 `type === 'error'` 的消息，**assert 数量 === 0**（致命错误为 0）
  - `page.on('pageerror')` 收集未捕获异常，**assert 数量 === 0**
  - `#weapon` innerText 含 4 把武器（"[1] 刀 [2] 弓 [3] 枪 [4] 重锤"或等价）
  - `#modeName` 非空
  - `#hp` 存在
  - `await page.evaluate(() => window.__mp && window.__mp.connected !== undefined)` 主循环存活标记存在（注：标签页前台时才赋值，preview 模式前台运行应满足）
- 命令：`npm run smoke`（前置 build，约 15-30s）

**依赖：** `@playwright/test`（devDependency），首次运行 `npx playwright install chromium`。

## 数据流

**运行时：**
```
游戏循环(rAF) → Time.tick → onFixed(now)
  → try { 各系统.update(dt) } catch(err) {
      console.error + bus.emit('engine.error', {err, ts, frame})
    }
  → 循环继续（不中断）
  → HUD 收 engine.error → 闪 ⚠ + ErrorLog 缓冲推入
```

**提交时：**
```
git commit → .githooks/pre-commit → vite build + vitest run
  → 任一失败 → 退出码非0 → 阻止提交
  → 全绿 → 提交成功
```

**验收时：**
```
npm run smoke → playwright → vite preview 启动 → 关键路径脚本
  → 收集 console.error/pageerror → 断言 0
  → 断言关键 DOM 非空 + 主循环存活
```

## 错误处理策略

- **单元层：** Vitest 纯逻辑输入→输出断言（约 15 模块）。
- **运行时层：** `Time.tick` try/catch 兜底 + `engine.error` 事件 + ErrorLog 环形缓冲。
- **端到端层：** Playwright 收集 `console.error` + `pageerror`，断言 0。
- **门禁层：** pre-commit 跑 build + test；手动 `npm run smoke` 跑冒烟。三重把关。

## 测试策略（元）

本设计自身是"测试基础设施"建设，分层覆盖：
- 纯逻辑回归 → Vitest
- 运行时异常隔离 → Time.tick catch + ErrorLog
- 集成关键路径 → Playwright 冒烟
- 提交门禁 → pre-commit build+test

冒烟不替代单测（覆盖窄但真），单测不替代冒烟（纯逻辑但无运行时），三者互补。

## 文件结构

**新建：**
| 文件 | 职责 |
|------|------|
| `tests/core/*.test.js`（4个） | ECS/EventBus/GameState/Time 单测 |
| `tests/gameplay/*.test.js`（约9个） | Weapon/CombatSystem/Health/Stamina + 5新系统单测 |
| `vitest.config.js` | Vitest 配置（node 环境） |
| `e2e/smoke.spec.js` | Playwright 关键路径冒烟 |
| `playwright.config.js` | Playwright 配置 |
| `.gitignore` | 忽略 node_modules/dist 等 |
| `.githooks/pre-commit` | 提交门禁脚本 |

**修改：**
| 文件 | 修改内容 |
|------|----------|
| `src/core/Time.js` | tick 内 onFixed try/catch + emit engine.error + 接收 bus |
| `src/ui/HUD.js` | engine.error 监听 + ⚠ 图标 + ErrorLog 环形缓冲 + F3 面板 |
| `src/main_entry.js` | Time 实例化传入 bus（若 Time 构造改签名） |
| `package.json` | devDeps(vitest/jsdom/@playwright/test) + scripts(test/build/smoke/check) |

## 验证标准

- `npm test` 全绿，覆盖约 15 模块。
- `npx vite build` 0 错误（71 模块，延续 Round 6 基线）。
- `npm run smoke` 0 运行时致命错误（console.error + pageerror 均为 0）、`#weapon` 含 4 把武器、`#modeName` 非空、主循环存活标记存在。
- 人为注入测试：临时在某系统 update 抛 `throw new Error('inject')`，验证：循环不冻结（rAF 继续）、HUD ⚠ 闪红、ErrorLog 记录该错误、游戏可继续操作。注入测试后还原。
- pre-commit hook：构造一个故意失败的 build（如临时语法错误），`git commit` 被阻止；还原后提交成功。

## 依赖新增

- `vitest`（devDep）
- `jsdom`（devDep，供个别需 DOM 的测试；若全部 node 环境可省）
- `@playwright/test`（devDep）

均不影响生产运行时（devDependency）。
