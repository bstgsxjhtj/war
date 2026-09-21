# main_entry.js 三步拆分实施计划

> **For agentic workers:** 本计划按 02-architecture.md §4.1 路线拆分上帝文件。执行方式：内联执行（用户要求一次性完成），每 Task 独立 commit，全程保持 174+ 测试全绿。

**Goal:** 将 ~590 行的 main_entry.js 按 ① MatchController → ② SaveOrchestrator → ③ InputRouter 三步小步搬迁，只搬代码不改行为，最终 main_entry 仅保留组合根装配与主循环。

**Architecture:** 新增 `src/app/` 层（组合根辅助层，位于 main_entry 之下、各领域层之上，可依赖 core/gameplay/world/ui）。三个类通过构造注入依赖；跨模块可变状态（player/ais/mode）通过 getter/setter 回调传递，避免全局变量。每步搬迁后 main_entry 调用点改为委托调用。

**Tech Stack:** ES Module + three.js + Vitest（node 默认 / DOM 用 jsdom pragma）+ Playwright 冒烟。

---

## 现状关键锚点（main_entry.js）

- L226-231 比分/回合/统计变量；L282-287 combat.kill 计分
- L233-280 存档块（captureSave/resetSave/SaveUI/启动加载/双 interval/beforeunload）
- L289-324 spawnRed；L326-374 spawnAll（留在 main_entry）
- L376-394 startRound/restart/round.restart
- L396-427 window keydown（R/M/,/C/D/N/Escape）
- L429-482 checkWin
- L495-585 主循环（留在 main_entry）
- 已知约束：面板键 I/J/V/H/K 由面板自监听，main_entry 不得重复绑定（04 按键表）

## Task 1: MatchController（src/app/MatchController.js）

搬入：scoreB/scoreR、roundB/roundR、targetWins、roundEndTimer、playerKills/playerDamage/playerTaken/matchStartTime、战役目标状态（escortTarget/defenseTimer/timeLimit/surviveWavesDone/surviveTimer）、combat.kill 计分监听、round.restart 监听、startRound、restart、checkWin。

构造依赖（全必选，构造传入）：`{ bus, state, hud, resultScreen, camera, progression, progressUI, daily, skills, campaign, siege, weather, saveManager, spawnAll, saveNow, loadMap, mapName, getPlayer, getAis, getMode }`

- `mode` 仍归 main_entry 所有，通过 `getMode()` 读取。
- 战役目标字段公开（`mc.defenseTimer` 等），spawnAll/主循环直接读写。
- `saveNow` 回调 = `() => saveManager.save(captureSave())`，Task 2 后改指向 SaveOrchestrator。
- EscortTarget 实例化留在 spawnAll，写入 `mc.escortTarget`。

测试 `tests/app/MatchController.test.js`（真 GameState/EventBus + mock 其余）：startRound 重置并转 PLAYING；combat.kill 双方计分；本地击杀加分/闪现/Boss 存档；死斗两连胜转 ENDED 并 recordWin；红方两连败 recordLoss；restart 清零回合。

## Task 2: SaveOrchestrator（src/app/SaveOrchestrator.js）

搬入：playTimeSec、captureSave、resetSave、启动加载应用（_saved 块）、playTime/save 双 interval、beforeunload。SaveUI 创建留在 main_entry，改传 `() => so.saveNow()` / `() => so.reset()`。skins.changed 监听属皮肤逻辑，留在 main_entry。

构造依赖：`{ bus, state, hud, saveManager, progression, campaign, skills, affixes, daily, skins, achievements, getPlayer, getMode }`

公开：`capture()`、`saveNow()`、`reset()`、`applyOnBoot()`、`tickPlayTime()`（interval 内调用，PLAYING 才 +1）。

测试 `tests/app/SaveOrchestrator.test.js`（jsdom）：capture 快照字段齐全（mode/stage/campaignCompleted/score/kills/bestGrade/affixSlots/skillPoints/skillTree/playTime）；reset 清空各模块与 localStorage 旧键并清 player 武器词条；applyOnBoot 恢复 progression/skills/playTime/战役 stage；tickPlayTime 仅 PLAYING 递增。

## Task 3: InputRouter（src/app/InputRouter.js）

搬入：window keydown 处理器（R/M/,/C/D/N/Escape）与 `_resumeOnce` 音频解锁监听。模式轮换（M 键 new Deathmatch/Domination/SiegeMode/WaveMode/campaign）与地图切换（, 键 MapGenerator.cycleMap）逻辑随迁，相应 import 移入。

构造依赖：`{ state, hud, campaign, daily, weather, settings, match, getMode, setMode, loadMap, mapName, currentMapKey, restart }`（match = MatchController 实例；KeyR 走 match.restart/startRound）。

测试 `tests/app/InputRouter.test.js`（jsdom，dispatchEvent KeyboardEvent）：KeyC 闪现战役关卡；KeyD 闪现每日进度；KeyN 切换天气；Escape 打开设置；KeyR 在 ENDED/ROUND_END 触发对应重启；KeyM 轮换模式并调 restart。

## Task 4: 文档同步 + 冒烟 + 收尾

- 02-architecture.md：分层图加入 `app/`（组合根辅助：MatchController/SaveOrchestrator/InputRouter，依赖 core/gameplay/world/ui）；§4 债 1 标记已偿还。
- 06-known-issues.md：P2 首条标记完成，修复记录追加。
- 全量 `npm test` + `npm run build` + Playwright 冒烟（vite preview 4173）。
- 收尾 commit。

## 验证命令

- 单测：`npx vitest run`（174+ 用例全绿）
- 构建：`npm run build`
- 冒烟：`node node_modules/vite/bin/vite.js preview --port 4173`（后台）→ `npx playwright test e2e/smoke.spec.js` → 杀进程
