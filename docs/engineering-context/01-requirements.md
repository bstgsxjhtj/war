# 01 · 需求文档

## 1. 游戏模式

| 模式 | 胜利条件 | 失败条件 | 备注 |
|---|---|---|---|
| 死斗 | 蓝方比分先到目标 | 红方先到 | 三局两胜制（roundB/roundR） |
| 据点 | 占领积分先到 500 | 对方先到 | |
| 攻城 | 攻方摧毁目标 / 守方撑到结束 | 反之 | SiegeMode |
| 波次 | 存活通过第 10 波 | 玩家死亡 | WaveMode，wave 逐波推进 |
| 战役 | 逐关推进，共 maxStages 关 | 玩家死亡 | 每关有 objective：歼灭/生存/Boss/护送等；第 5、10 关为 Boss 关（须有 bossType） |

## 2. 元进度系统

| 系统 | 数据 | 持久化 |
|---|---|---|
| Progression | score / kills / bestGrade / 解锁标志 | 统一存档 savegame_v1 |
| SkillTree | points + 技能/武器等级 | savegame_v1（skillPoints）+ skilltree_v1（等级明细） |
| Achievements | 成就计数与解锁 | localStorage `achievements` |
| DailyChallenge | 每日任务进度 | localStorage `daily_challenge` |
| Affixes | 词条库存 + 武器装备槽 | `affixes`（库存）+ savegame_v1（装备快照） |
| WeaponSkins | 皮肤解锁/装备 | `weapon_skins` |

## 3. 存档系统需求（Round 13 已定）

- 统一存档键 `savegame_v1`（含 version 字段，支持迁移）
- 旧键一次性迁移：campaign_cleared→stage、progression_v1→score/kills/bestGrade、skilltree_v1→skillPoints
- 自动保存时机：Boss 击杀、过关、每 60s、beforeunload
- 单存档槽；跳过导出/导入
- H 键打开存档面板（查看/立即保存/重置）

## 4. 业务规则红线（修改时不得违反）

1. 击杀/伤害统计只计本地玩家（`isLocal`）。
2. 战役通关后 stage 回 0，需靠 `campaignCompleted` 语义区分"新档"。
3. 词条装备必须消耗库存（不可复制）。
4. "重置所有进度"必须清理全部受管键，重置后重启不得复活旧数据。
5. 成就事件必须由真实游戏行为触发，不得用 UI 刷新事件充数。
