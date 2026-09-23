# 03 · 业务架构（领域模型）

## 1. 核心领域模型

玩家（Player/Character）携带多把武器（Weapon，含 2 个词条槽），在游戏模式中与 AI 敌人（普通/精英/Boss/骑兵）战斗。CombatSystem 结算伤害、克制矩阵与连击；Health 管理生死；击杀经 EventBus 广播。战斗产出驱动四条元进度线：Progression（积分/军衔/解锁）、SkillTree（技能点→技能/武器等级）、Achievements（事件计数→奖励）、DailyChallenge（每日任务→积分）。SaveManager（savegame_v1）为游戏进度唯一事实来源，各领域模块通过 serialize/restore 由 SaveOrchestrator 统一采集与恢复（不再自写 localStorage）；GameState 状态机驱动回合与关卡推进。

## 2. 战斗管线

```
输入 → Player → CombatSystem.resolveMelee / 箭矢 / spawnAoE
     → 克制矩阵 + 词条效果 + 连击加成
     → Character.takeDamage（格挡/完美闪避判定）
     → bus.emit('combat.hit'|'combat.kill', ...)
     → Progression / Achievements / DailyChallenge / HUD 各自消费
```

词条效果必须在**所有伤害路径**（近战/箭矢/AOE）一致生效。

## 3. 战役模式规则

- STAGES 数组定义每关 objective、敌人配置、Boss 关须有 `bossType`。
- objective 类型与 checkWin 的对应：歼灭→全灭敌人；Boss→ctx.boss 死亡；生存→surviveWavesDone；护送→目标存活到达。
- `onStageClear()` 推进 stage；通关后 stage 回 0（配合 cleared 记录历史最高）。
- main_entry 的 checkWin 直接调用 `campaign.onStageClear()`（CampaignMode 不发事件）。
- **噩梦战役**：`CampaignMode(bus, nightmare=true)`，难度 ×1.35、敌数 +2，name 保持 '战役'（复用全部战役分支逻辑），displayName 为 '噩梦战役'；战役通关后 M 键循环解锁。

## 3.1 本轮玩法增强（2026-09-23 P0-P3）

- **大招（怒气）**：受击 +5 / 完美格挡/闪避 +15 / 命中 +3，满 100 后 T 键释放（Character.tryUltimate），COMBAT_ULTIMATE 事件。
- **连击护盾**：受击连击数减半而非清零（ComboSystem.onHurt）。
- **克制可视化**：克制伤害数字青色 (#66ddff) + counter 音效（COMBAT_COUNTER）。
- **天气预告**：非战役模式每 30-60s 随机换天气，HUD `#wforecast` 倒计时显示（WeatherSystem.scheduleNext）。
- **环境杀**：EnvironmentHazards——深水 40 DPS、城墙碰撞 15 DPS、雷暴落雷半径 6 内 50 伤害。
- **无尽模式**：WaveMode(bus, true)，敌人增长更快（上限 12），历史最高波数存 wave_best。
- **投石机争夺**：靠近自动占领/夺占（SiegeStructure.tryOccupy），占领后轰击最近敌方。
- **动态难度辅助**：DifficultyAssist——连续 2 次死亡降一档（easy 为下限），获胜逐步恢复，HUD 提示。

## 4. 成就事件契约

成就系统监听的事件必须由真实行为发射：

| 事件 | 发射点 |
|---|---|
| combat.kill | CombatSystem/致死处（成就侧须过滤 killer.isLocal） |
| campaign.clear / campaign.perfect | 战役通关处 |
| combat.backstab | 背刺命中处 |
| combat.perfectblock / combat.dodge | 完美格挡/闪避处（现有 fx.perfectBlock/fx.perfectDodge，可桥接） |
| combat.cavalrykill | 骑杀处 |
| daily.completed | 每日挑战完成翻转时（不可用 daily.update 计数） |

## 5. 统计口径

- `playerDamage`：本地玩家本场造成的伤害，combat.hit 且 attacker.isLocal 时累加；用于结算评级 gradeOf 与无伤判定。
- 无伤判定应用"玩家本场承伤"，而非 playerDamage。
