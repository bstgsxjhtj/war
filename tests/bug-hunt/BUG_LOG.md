# Bug Hunt Log — 自动发现的 bug 记录

> 追加写。每条 bug 一个条目。高阶 LLM 读本文件逐条修复，修完把 `status` 改 `fixed` 并注明 commit。
> 去重规则：开新条目前先 grep 本文件，已存在的 open bug 不重报。

## 条目格式

```
### [id] title
- category: combat | camera | input | ui | spawning | mode | balance | crash | perf
- severity: crash | broken | visual | balance | minor
- bundle: <部署 bundle hash>
- scenario: <可复现步骤，用 __hunt 方法名描述>
- expected: <期望行为>
- actual: <实际行为>
- invariant_violations: [<__hunt.assertInvariants 返回的 violations>]
- fn_err: <如有运行期异常>
- snapshot_before: { ... }
- snapshot_after: { ... }
- repro_seed: <class|mode|seed|seq>
- status: open | fixed(<commit>)
- found_by: pilot | scheduled-<n>
```

---

## 条目

### [20260930-pilot-01] NaN 位置不被检测/夹紧，玩家位置可永久变 NaN
- category: combat
- severity: broken
- bundle: CyI9s-b-
- scenario: `__hunt.inject.forceRestart()` → `__hunt.inject.injectNaNPos()` → `__hunt.assertInvariants()`
- expected: 游戏应检测 player.position 含 NaN 并夹紧/重置到安全位置（出生点或上一帧位置）
- actual: NaN 注入后 position 持续为 NaN，不报错不夹紧；后续渲染/碰撞/相机全部受 NaN 污染，可能软锁玩家
- invariant_violations: ["playerPosFinite"]
- fn_err: null
- snapshot_before: { state: "playing", alive: true, pos: [-180,1.72,0], hp: 200 }
- snapshot_after: { state: "playing", alive: true, pos: [null,null,null], hp: 200, camYaw: "NaN" }
- repro_seed: warrior|deathmatch|seed=nan|seq=forceRestart,injectNaNPos,assertInvariants
- status: open
- found_by: pilot
- note: 正常游戏内 NaN 由除零/未初始化产生；本注入模拟该路径。建议在 Character.update 位移后加 `Number.isFinite` 守卫，NaN 时回退到上一帧或出生点。

### [20260930-pilot-02] match.restart() 从 playing 态触发非法状态机迁移
- category: mode
- severity: minor
- bundle: CyI9s-b-
- scenario: `__hunt.inject.forceRestart()`（在 state=playing 时调用 match.restart()→startRound()）
- expected: restart 应先重置状态机到合法的前回合态，再开新局，无非法迁移告警
- actual: startRound 连续尝试 `playing->ready` 与 `playing->playing` 两次迁移，均被 GameState 拒绝并打 `[GameState] illegal` 告警。游戏仍能运行（spawnAll 等副作用已执行），但状态机记录不干净
- invariant_violations: []
- fn_err: null
- console: `[GameState] illegal playing->ready` + `[GameState] illegal playing->playing` (at startRound→restart)
- snapshot_before: { state: "playing", alive: true, roundR: 0, roundB: 0, target: 1 }
- snapshot_after: { state: "playing", alive: true, roundR: 0, roundB: 0, enemies: 3 }
- repro_seed: warrior|deathmatch|seed=rest|seq=forceRestart(in playing)
- reachability: 用户 Esc 打开菜单→点"重开"即可从 playing 态触发（非仅注入可达）
- status: open
- found_by: pilot
- note: MatchController.restart() 只清 roundR/roundB/roundEndTimer 就直调 startRound，未先 transit 到 ended/intro。建议 restart 开头加 `state.transit(States.ENDED)` 或让 startRound 用 force 重置。
