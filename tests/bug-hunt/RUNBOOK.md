# Bug-Hunt Runbook

低阶 LLM 每次循环按本手册执行。目标：**发散地发现 bug 和游戏不合理之处**，用确定性断言判据记录，不靠主观判断。

## 0. 前置

- 测试对象：线上部署站 `http://106.13.61.192/`（强制刷新 `?t=<timestamp>` 避免缓存）
- 工具：browser_use 系列（`browser_navigate` / `browser_evaluate` / `browser_console_messages` / `browser_snapshot`）
- harness 源文件：`tests/bug-hunt/harness.js`（内容粘贴进 `browser_evaluate` 安装）
- bug 日志：`tests/bug-hunt/BUG_LOG.md`（追加写）
- `window.__game` 暴露：`player` / `combat` / `match` / `state` / `ais`

## 1. 每轮流程（单轮预算 3–5 个场景）

1. **导航**：`browser_navigate({ url: 'http://106.13.61.192/?t=' + Date.now() })`，`browser_wait_for({ time: 3 })`
2. **装 harness**：把 `tests/bug-hunt/harness.js` 全文粘进 `browser_evaluate`。校验：`__hunt.bundle()` 返回当前 hash
3. **去重**：读 `BUG_LOG.md`，记下已有 open bug 的 category+bundle，本轮跳过同类已报
4. **选场景**：从下方分类表随机抽 1 类 + 随机职业/模式/参数，组合出 3–5 个场景
5. **执行**：每个场景用 `__hunt.runScenario(name, fn)` 包裹，`fn` 里串联 `__hunt.inject.*` 调用
6. **判据**：`result.ok === false` 即疑似 bug（不变量失败 / 注入异常 / 运行期异常）
7. **记录**：对每个疑似 bug，按 BUG_LOG 格式追加一条；用 `__hunt.snapshot()` 填 before/after
8. **收尾**：本轮结束前汇报新增条目数与摘要

## 2. 场景分类（变异算子池）

| 类别 | 构造方式 | 重点断言 |
|---|---|---|
| death-edge | `killPlayer` 后 `forceRestart`，复合"切武器中/充能中/锁定中"死亡 | cameraLockNullWhenDead, weaponMeshExistsWhenAlive |
| class-weapon | 每职业每武器 `doAttack` + `doSkill` | hasWeapons, weaponIdxInRange, 无 fnErr |
| state-machine | `forceState('roundEnd')` 后 `forceState('playing')` 等非法越迁 | stateValid |
| resource-edge | `setStamina(0)` 后 `doAttack`；`doSkill` 连按 | playerHpNonNeg |
| numeric-edge | `injectNaNPos`；`setHP(-5)`；`setHP(999999)` | playerPosFinite, playerHpNonNeg, playerHpBounded |
| spawn-integrity | `forceStartRound` 后查 `enemies` 计数；连开多轮 | enemiesFinite |
| ui-panel-stack | 用 browser_click 开 设置/Esc菜单/技能树(B)，各种顺序 | snapshot 看是否卡死（state 不变 + 控制台报错） |
| camera-lock | `killPlayer`（带 lockTarget）后查 camLockTarget | cameraLockNullWhenDead |
| mode-specific | M 切模式后 `forceStartRound`，查 roundR/targetWins 一致性 | stateValid, snapshot |

## 3. 判据与防误报

- **只信硬断言**：`__hunt.assertInvariants().ok === false` 或 `runScenario().fnErr !== null` 才算 bug
- **console 误差**：`browser_console_messages` 里只采信 `bundle` 字段匹配当前 `__hunt.bundle()` 的条目；不匹配的是陈旧消息，忽略
- **不报主观**："画面看起来怪"不算 bug，要有不变量失败或异常佐证
- **去重**：grep BUG_LOG，已 open 的同类不重报

## 4. pilot 校准基准（已知应通过/应失败的锚点）

- **应通过**：正常 `forceStartRound` 后 `assertInvariants().ok === true`（健康基线）
- **应失败（注入人造 bug 验证断言灵敏度）**：手动 `__hunt.inject.killPlayer()` 后立刻 `cam().lockTarget = {alive:true}`（人造残留），`cameraLockNullWhenDead` 应红——证明断言真能抓到这类 bug

## 5. 输出

每轮结束给一段摘要：本轮跑了几个场景、新增几条 bug、各条 id+category+severity。
