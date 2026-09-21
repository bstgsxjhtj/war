# 03 · 业务架构（领域模型）

## 1. 核心领域模型

玩家（Player/Character）携带多把武器（Weapon，含 2 个词条槽），在游戏模式中与 AI 敌人（普通/精英/Boss/骑兵）战斗。CombatSystem 结算伤害、克制矩阵与连击；Health 管理生死；击杀经 EventBus 广播。战斗产出驱动四条元进度线：Progression（积分/军衔/解锁）、SkillTree（技能点→技能/武器等级）、Achievements（事件计数→奖励）、DailyChallenge（每日任务→积分）。SaveManager 统一存档；GameState 状态机驱动回合与关卡推进。

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
