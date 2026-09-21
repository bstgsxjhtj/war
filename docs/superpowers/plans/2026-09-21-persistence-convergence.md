# 持久化双轨收敛实施计划

> **For agentic workers:** 按 02-architecture.md §4.2 路线收敛架构债 #2。执行方式：内联执行（用户要求一次性完成），每步独立 commit，全程保持测试全绿。

**Goal:** SaveManager（savegame_v1）成为游戏进度的唯一事实来源；Progression/SkillTree/CampaignMode/Achievements/Affixes/DailyChallenge/WeaponSkins 七个模块停止自写旧 localStorage 键，改为由 SaveOrchestrator 通过 serialize/restore 统一采集与恢复；旧键在首次迁移后被删除。

**Architecture:** 各模块新增 `serialize()`（产出纯数据快照）与 `restore(data)`（从快照恢复，幂等）；SaveOrchestrator.capture 拉取全部模块快照写入 savegame_v1，applyOnBoot 启动时一次性 restore，reset 清空全部内存态并删 savegame_v1 + 残留旧键。保留独立键：settings/audio_volume/tutorial_done/skilltree_profile_*（UI/音频偏好与多档位特性，非游戏进度）。

**Tech Stack:** ES Module + Vitest（node 默认 / DOM 用 jsdom pragma）+ Playwright 冒烟。

---

## 现状锚点

**双轨键（savegame_v1 已采集 + 模块仍自写）**：progression_v1、skilltree_v1、campaign_cleared
**仅旧键（未纳入 savegame_v1）**：achievements、affixes、daily_challenge、weapon_skins
**保留独立键**：settings、audio_volume、tutorial_done、skilltree_profile_*

**测试影响**（4 处直接断言旧键跨实例持久化，需改写为 serialize/restore）：
- tests/gameplay/Affixes.test.js:57-65
- tests/gameplay/Achievements.test.js:64-73
- tests/gameplay/CampaignMode.test.js:104-110
- tests/gameplay/WeaponSkins.test.js:42-49

**启动顺序**（main_entry）：affixes(L100)→achievements(L101)→progression(L140)→campaign(L141)→daily(L142)→skins(L143)→…→saveOrch(L226，在所有领域模块之后)，故 applyOnBoot 可统一 restore 全部模块。

## Task 1: 计划文档（本文件）

## Task 2: 为 6 模块加 serialize/restore（加法，不破坏现有）

Progression 已有 restore（仅 score/kills/bestGrade）→扩为全量（deaths/wins/losses/unlocks/bestTime）；新增 serialize()。Achievements/Affixes/DailyChallenge/WeaponSkins/CampaignMode 各加 serialize/restore。SkillTree 已有 serialize/restore，无需动。每模块加单测。

## Task 3: SaveManager 扩字段 + 迁移全部旧键 + 迁移后删除

serialize() 加 achievements/affixInventory/daily/skins/progressionFull 字段；_migrateOld 读全部 6 旧键（campaign_cleared/progression_v1/skilltree_v1/achievements/affixes/daily_challenge/weapon_skins）合并；_load 迁移成功后删除被迁移的旧键（一次性）。加迁移+删除单测。

## Task 4: SaveOrchestrator capture/applyOnBoot/reset 接全 serialize/restore

capture 拉取全部模块 serialize；applyOnBoot 调全部 restore；reset 清空全部内存态（调各模块 reset/restore({})）+ saveManager.reset + 删残留旧键。扩 SaveOrchestrator.test。

## Task 5: 移除各模块自写 _save/_load + 修 4 个旧键持久化测试

Progression/SkillTree/CampaignMode/Achievements/Affixes/DailyChallenge/WeaponSkins：构造不再 _load，mutator 不再 _save（SkillTree 保留 profile 档位 saveProfile/loadProfile/hasProfile/deleteProfile）。4 处旧测试改写为 serialize→restore 断言。

## Task 6: main_entry 清理死接线

移除模块自写后遗留的 `_save` 调用点（如 SaveOrchestrator.reset 里 `campaign._saveCleared()`/`skills._save()`/`affixes._save()`/`daily._save()`/`skins._save()`/`achievements._save()` 改为调 reset 或 restore({})）。确认 SaveOrchestrator 是唯一持久化路径。

## Task 7: 文档同步 + build + 冒烟 + 提交

02 §4.2 标记偿还；03 §1 调整 SaveManager 描述；05 §2 存储键表更新（独立键保留、游戏进度键收敛到 savegame_v1）；06 台账 P2 #2 完成。全量 npm test + build + Playwright 冒烟。

## 验证命令

- 单测：`npx vitest run`
- 构建：`npm run build`
- 冒烟：`node node_modules/vite/bin/vite.js preview --port 4173`（后台）→ `npx playwright test e2e/smoke.spec.js` → 杀进程
