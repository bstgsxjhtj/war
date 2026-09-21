# 06 · 已知问题台账

> 来源：2026-09-21 三专家联合审查（业务/架构/代码质量）。状态：⬜未修 / 🔧修复中 / ✅已修。

## P0 功能性 Bug

| # | 问题 | 位置 | 状态 |
|---|---|---|---|
| 1 | 战役 Boss 关（objective=Boss 但无 bossType）永不胜利 | CampaignMode.js STAGES / main_entry spawnAll | ⬜ |
| 2 | 生存关 surviveWavesDone 永为 false | main_entry.js spawnAll | ⬜ |
| 3 | WaveMode 未接线（spawnLayout 从不调用，wave 恒 0） | main_entry.js / WaveMode.js | ⬜ |
| 4 | 6 个成就事件从未发射（campaign.clear/perfect、backstab、perfectblock、cavalrykill、dodge） | Achievements.js 监听定义 | ⬜ |
| 5 | daily_10/daily_30 用 daily.update 计数，口径错误 | main_entry.js combat.hit 处 | ⬜ |
| 6 | playerDamage 恒 0，评级失真 + 无伤判定白送 | main_entry.js | ⬜ |
| 7 | skins.changed 在 spawnAll 内重复注册（监听器泄漏） | main_entry.js:305 | ⬜ |
| 8 | Player 输入监听每局累积（document/canvas/window 8 个） | Player.js:28-68 | ⬜ |
| 9 | K 键双重绑定（main_entry + SkillTreeUI）面板关不掉 | main_entry.js:398 / SkillTreeUI.js:45 | ⬜ |
| 10 | Affixes.equip 不移除库存 → 词条可复制 | Affixes.js:29-34 | ⬜ |
| 11 | ResultScreen 两套评级算法并存 | ResultScreen.js:31 vs gradeOf | ⬜ |
| 12 | 死事件：hud.flash / hud.miss / settings.closed 无监听 | SkillTreeUI/BossEnemy/SettingsMenu | ⬜ |
| 13 | "重置所有进度"不清成就/词条/每日/皮肤/旧键 | main_entry resetSave | ⬜ |
| 14 | 成就击杀计数未过滤 killer.isLocal | main_entry.js:106 | ⬜ |
| 15 | Progression.restore 不触发 _checkUnlocks | Progression.js:78-83 | ⬜ |

## P1 一致性/架构

| # | 问题 | 状态 |
|---|---|---|
| 16 | 存档双轨：旧键与新档并行读写，重置后可复活 | ⬜（目标态见 02 架构文档 §4.2） |
| 17 | 通关 stage=0 与新档无法区分（需 campaignCompleted 标志） | ⬜ |
| 18 | 词条效果只在 AOE 路径生效，近战/箭矢不吃词条 | ⬜ |
| 19 | 每日挑战"单局击杀"语义矛盾（resetSession 从未调用）；战役胜利不发每日奖励 | ⬜ |
| 20 | 音量双份真相（settings vs audio_volume） | ⬜ |
| 21 | main.js 整文件死代码（旧入口） | ⬜ |
| 22 | tryUltimate 调用不存在的方法（死代码）+ rage getter 返回错误值 | ⬜ |
| 23 | _killstreak 体系断裂（HUD 分支永远走不到） | ⬜ |

## P2 债（记录暂不强制）

- main_entry 上帝文件三步拆分（MatchController → SaveOrchestrator → InputRouter）
- UI 面板四胞胎 → UIPanel 基类；近战武器 _perform 上提 Weapon 基类
- 事件名/存储键/平衡数值常量模块化
- 每帧 Vector3 分配池化；miniMap.setWorldSize 每帧调用
- 测试缺口：Character/CombatSystem 主路径/GameMode/MapGenerator
- Escape 多面板同时响应（需统一 UI 栈）

## 修复记录

（修复后在此追加：日期、commit、问题编号）
