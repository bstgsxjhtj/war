# 02 · 架构文档

## 1. 分层与依赖方向

```
main_entry.js（组合根 / composition root）
   ├── app/         → 组合根辅助：MatchController（比分/回合/胜负）、SaveOrchestrator（存档编排）、InputRouter（全局按键）；依赖 core/gameplay/world/ui
   ├── ui/          → 单向依赖 gameplay（仅引用常量/数据类）
   ├── gameplay/    → 可依赖 core、render 的纯工厂/特效接口（显式例外）
   ├── world/       → 依赖 core（bus）
   ├── engine/      → 依赖 render
   └── core/        → EventBus / GameState / Time，不依赖任何上层
net/ audio/ render/ 为基础设施，被上层使用。
ESM 依赖图必须保持无环（DAG）。
```

## 2. 模块职责

- **core**：EventBus（on 返回 off 函数）、GameState 状态机、Time 主循环。ECS.js 当前未被使用（保留待决）。
- **engine**：Renderer（three 后期管线）、Scene、Camera、AssetLoader。
- **world**：Terrain、Environment、Water、WeatherSystem、MapGenerator、SiegeStructure、SupplyPoint。
- **gameplay**：Character 基类（Health/Stamina/Skeleton）→ Player / AIController（→BossEnemy/CavalryEnemy）/ RemotePlayer；CombatSystem、ComboSystem、WeaponSkills、weapons/*；元进度类（Progression、SkillTree、Affixes、Achievements、WeaponSkins、DailyChallenge）；模式类（GameMode/WaveMode/TrainingMode/CampaignMode）；SaveManager。
- **ui**：HUD、MiniMap、ResultScreen、SettingsMenu、SkillTreeUI、Tutorial、SaveUI、AchievementsUI、AffixesUI。

## 3. 运行期解耦

模块间通过字符串事件（`域.动作`，如 `combat.hit`、`fx.shake`）在 EventBus 上通信，约 25 个事件名。事件契约见 05-conventions.md。

## 4. 已知架构债（按优先级）

1. ~~**main_entry.js 上帝文件**~~（✅2026-09-21 偿还）：三步拆分完成——
   ① `app/MatchController`（比分/回合/checkWin/startRound/restart + 战役目标状态字段）
   ② `app/SaveOrchestrator`（capture/reset/applyOnBoot/tickPlayTime/startTimers）
   ③ `app/InputRouter`（R/M/,/C/D/N/Escape + 音频解锁）。main_entry 仅剩组合根装配、spawnAll/spawnRed 与主循环；跨模块可变状态（player/ais/mode）经 getter/setter 回调注入。
2. ~~**持久化双轨**~~（✅2026-09-21 偿还）：SaveManager（savegame_v1）成为游戏进度唯一事实来源；Progression/SkillTree/CampaignMode/Achievements/Affixes/DailyChallenge/WeaponSkins 七模块停止自写旧键，改为 serialize/restore 由 SaveOrchestrator 统一采集与恢复；6 个旧键（campaign_cleared/progression_v1/skilltree_v1/achievements/affixes/daily_challenge/weapon_skins）在首次启动一次性迁移后删除。保留独立键：settings/audio_volume/tutorial_done/skilltree_profile_*（UI/音频偏好与多档位特性）。
3. ~~**UI 类错位**~~（✅2026-09-21 偿还）：ProgressionUI 与 WeaponSkinsUI 从 gameplay/ 抽出至 `ui/ProgressionUI.js`、`ui/WeaponSkinsUI.js`，gameplay 层只留领域模型；ui/ 单向依赖 gameplay（仅引用 SKINS 等常量/数据类）的约定现对全部 UI 一致。
4. ~~**依赖注入不统一**~~（✅2026-09-21 偿还）：约定落地到 05 §6——必选依赖（bus）走构造、可选依赖（audio/affixes）走 setter、总线属性统一 `_bus`；DailyChallenge/Achievements 改为构造注入 bus（顺带修复 DailyChallenge 未传 bus 导致 `daily.completed` 事件死掉的 bug），Player 4 处 emit 统一 `_bus`。Character 群"注册时注入"为显式例外。
5. **监听器生命周期**：bus.on 返回 off，跨回合的注册必须集中在 bootstrap 顶层一次注册；spawnAll 内禁止注册常驻监听。

## 5. 组合根规则

- main_entry 是唯一装配点；新增系统的实例化、事件接线、按键绑定都在此完成。
- UI 面板按键惯例：面板组件在 `document` 上自监听 keydown（KeyI/J/V/H），main_entry 的 window handler **不得重复绑定**同一键（会双 toggle 抵消）。
