# 06 · 已知问题台账

> 来源：2026-09-21 三专家联合审查（业务/架构/代码质量）。状态：⬜未修 / 🔧修复中 / ✅已修 / ⚠️误报（代码实际正确）。

## P0 功能性 Bug

| # | 问题 | 位置 | 状态 |
|---|---|---|---|
| 1 | 战役 Boss 关（objective=Boss 但无 bossType）永不胜利 | CampaignMode.js STAGES / main_entry spawnAll | ⚠️误报：STAGES 第5/8/10关均有 bossType，spawnRed L286 已生成 Boss |
| 2 | 生存关 surviveTimer 未声明，进入第8关 tick 即 ReferenceError 崩溃 | main_entry.js L97/L354/L549 | ✅已修：声明 surviveTimer，生存关初始化 s.surviveTime |
| 3 | WaveMode 未接线（spawnLayout 从不调用，wave 恒 0） | main_entry.js / WaveMode.js | ⚠️误报：L350 已调用 spawnLayout（内含 wave++），L562 有波次推进，checkWin L28 正确 |
| 4 | 成就事件 combat.perfectblock/dodge/cavalrykill 未发射 | Achievements.js 监听定义 | ✅已修：fx.perfectBlock/Dodge 桥接 emit，combat.kill 判 victim instanceof CavalryEnemy 发射 cavalrykill |
| 5 | daily_10/daily_30 用 daily.update 计数，口径错误 | main_entry.js combat.hit 处 | ⚠️误报：成就监听 daily.completed（非 daily.update），DailyChallenge L70 完成翻转时 emit，口径正确 |
| 6 | playerDamage 恒 0，评级失真 + 无伤判定白送 | main_entry.js | ⚠️误报：L158 attacker.isLocal 时已累加 playerDamage；无伤判定 L465/L431 用 playerTaken（承伤）正确 |
| 7 | skins.changed 在 spawnAll 内重复注册（监听器泄漏） | main_entry.js:305 | ⚠️误报：main_entry 无 skins.changed 注册点；但该事件无监听者（归 #12） |
| 8 | Player 输入监听每局累积（document/canvas/window 8 个） | Player.js:28-68 | ✅已修：加 dispose()（存 handler 引用逐条移除），spawnAll 重建前调用 |
| 9 | K 键双重绑定（main_entry + SkillTreeUI）面板关不掉 | main_entry.js:411 / SkillTreeUI.js:45 | ✅已修：SkillTreeUI 改为全权 toggle（document 自监听），main_entry 移除 KeyK 绑定 |
| 10 | Affixes.equip 不移除库存 → 词条可复制 | Affixes.js:29-34 | ✅已修：splice 出新词条 + 旧词条 push 回库存 |
| 11 | ResultScreen 两套评级算法并存 | ResultScreen.js:31 vs gradeOf | ✅已修：show() 改用 ResultScreen.gradeOf(kills,damage,time) |
| 12 | 死事件：hud.flash / hud.miss / settings.closed / skins.changed 无监听 | SkillTreeUI/BossEnemy/SettingsMenu/WeaponSkins | ✅部分修：HUD 已加 bus.on('hud.flash')；hud.miss/settings.closed/skins.changed 仍 ⬜ |
| 13 | "重置所有进度"不清成就/词条/每日/皮肤/旧键 | main_entry resetSave | ✅已修：resetSave 现清理全部受管键 + 各模块 _data 重置 |
| 14 | 成就击杀计数未过滤 killer.isLocal | main_entry.js:106 | ⚠️误报：L106 已有 `if (p.killer.isLocal)` 过滤 |
| 15 | Progression.restore 不触发 _checkUnlocks | Progression.js:78-83 | ✅已修：restore 末尾加 this._checkUnlocks() |

## P1 一致性/架构

| # | 问题 | 状态 |
|---|---|---|
| 16 | 存档双轨：旧键与新档并行读写，重置后可复活 | ⬜（目标态见 02 架构文档 §4.2） |
| 17 | 通关 stage=0 与新档无法区分（需 campaignCompleted 标志） | ⬜ |
| 18 | 词条效果只在 AOE 路径生效，近战/箭矢不吃词条 | ⬜ |
| 19 | 每日挑战"单局击杀"语义矛盾（resetSession 从未调用）；战役胜利不发每日奖励 | ✅部分修：战役通关补 daily.claim()；desc 语义/resetSession 仍 ⬜ |
| 20 | 音量双份真相（settings vs audio_volume） | ✅已修：AudioEngine 加 getVolume，SettingsMenu 从 audio 读、_save 不再写 volume |
| 21 | main.js 整文件死代码（旧入口） | ✅已修：删除 main.js |
| 22 | tryUltimate 调用不存在的方法（死代码）+ rage getter 返回错误值 | ✅部分修：rage getter 改返回 _rage（语义正确）；tryUltimate 骨架保留为未完成功能（无调用者，不崩溃） |
| 23 | _killstreak 体系断裂（HUD 分支永远走不到，Character 无 getter） | ✅已修：Character 加 get killstreak()，启用 HUD 连杀提示 |
| 24 | DailyChallenge 构造不支持 bus 参数（测试与实现不匹配） | ✅已修：构造加可选 bus 参数 |

## P2 债（记录暂不强制）

- ~~main_entry 上帝文件三步拆分（MatchController → SaveOrchestrator → InputRouter）~~ ✅2026-09-21 完成，见 02 架构文档 §4.1
- ~~持久化双轨收敛（SaveManager 唯一事实来源，7 模块 serialize/restore，6 旧键迁移后删除）~~ ✅2026-09-21 完成，见 02 架构文档 §4.2
- ~~UI 类错位（ProgressionUI/WeaponSkinsUI 移至 ui/）~~ ✅2026-09-21 完成，见 02 架构文档 §4.3
- ~~依赖注入不统一（bus 必选走构造、audio/affixes 可选走 setter、_bus 命名统一）~~ ✅2026-09-21 完成，见 02 架构文档 §4.4 与 05 §6；顺带修复 DailyChallenge 未注入 bus 致 daily.completed 死事件
- ~~监听器生命周期（bus.on 返回 off / 跨回合注册集中 bootstrap / spawnAll 内禁注册）~~ ✅2026-09-21 完成，见 02 架构文档 §4.5 与 05 §7；三条款经查均已满足，加回归守卫锁定
- ⬜ combat.kill 的 ultimate 音效重复：main_entry（progression 处理器 L173）与 MatchController（比分处理器）各调一次 audio.playSound('ultimate')，每次击杀播两声。架构债 #5 调查时发现，非生命周期问题，择机去重（保留比分处理器一处）
- UI 面板四胞胎 → UIPanel 基类；近战武器 _perform 上提 Weapon 基类
- 事件名/存储键/平衡数值常量模块化
- 每帧 Vector3 分配池化；miniMap.setWorldSize 每帧调用
- 测试缺口：Character/CombatSystem 主路径/GameMode/MapGenerator
- Escape 多面板同时响应（需统一 UI 栈）

## 修复记录

| 日期 | commit | 问题编号 |
|---|---|---|
| 2026-09-21 | P0 fix commit | #2 #4 #9 #10 #12(hud.flash) #13 #15 #24 |
| 2026-09-21 | P1 fix commit | #11 #19(战役奖励) #20 #21 #22(rage) #23 |
| 2026-09-21 | 收尾 fix commit（本轮） | #8 #12(全) #16 #17 #18 |
| 2026-09-21 | main_entry 三步拆分 commit | P2 架构债#1（MatchController/SaveOrchestrator/InputRouter） |
| 2026-09-21 | 持久化双轨收敛 commits | P2 架构债#2（SaveManager 唯一事实来源 / 7 模块 serialize/restore / 6 旧键迁移后删除） |
| 2026-09-21 | UI 类错位 commit | P2 架构债#3（ProgressionUI/WeaponSkinsUI 移至 ui/） |
| 2026-09-21 | 依赖注入统一 commit | P2 架构债#4（bus 走构造 / _bus 命名统一 / 修复 DailyChallenge 死事件） |
| 2026-09-21 | 监听器生命周期 commit | P2 架构债#5（三条款已满足 + 回归守卫 + 05 §7 约定）；登记 ultimate 音效重复次要缺陷 |
