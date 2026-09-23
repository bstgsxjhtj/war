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
| 16 | 存档双轨：旧键与新档并行读写，重置后可复活 | ✅已修（2026-09-22 核实）：SaveManager 唯一事实来源，旧键仅 _migrateOld 只读迁移后删除；SaveOrchestrator.reset 清全部旧键 |
| 17 | 通关 stage=0 与新档无法区分（需 campaignCompleted 标志） | ✅已修（2026-09-22 核实）：campaignCompleted 标志已落地 SaveManager serialize/默认值 + SaveOrchestrator capture/恢复 |
| 18 | 词条效果只在 AOE 路径生效，近战/箭矢不吃词条 | ✅已修（2026-09-22）：_affixApply/_affixLeech 实现（此前缺失致箭矢/AOE TypeError 回归），近战/箭矢/AOE/大招四路径统一接入 |
| 19 | 每日挑战"单局击杀"语义矛盾（resetSession 从未调用）；战役胜利不发每日奖励 | ✅已修（2026-09-22）：战役奖励此前已补 daily.claim()；desc 改"今日累计"口径贴实现，resetSession 保留供测试 |
| 20 | 音量双份真相（settings vs audio_volume） | ✅已修：AudioEngine 加 getVolume，SettingsMenu 从 audio 读、_save 不再写 volume |
| 21 | main.js 整文件死代码（旧入口） | ✅已修：删除 main.js |
| 22 | tryUltimate 调用不存在的方法（死代码）+ rage getter 返回错误值 | ✅已修（2026-09-22）：rage getter 改返回 _rage；ultimateLine/ultimateMelee 已在 CombatSystem 实现，弓/重锤/枪/刀剑四类大招全通 |
| 23 | _killstreak 体系断裂（HUD 分支永远走不到，Character 无 getter） | ✅已修：Character 加 get killstreak()，启用 HUD 连杀提示 |
| 24 | DailyChallenge 构造不支持 bus 参数（测试与实现不匹配） | ✅已修：构造加可选 bus 参数 |

## P2 债（记录暂不强制）

- ~~main_entry 上帝文件三步拆分（MatchController → SaveOrchestrator → InputRouter）~~ ✅2026-09-21 完成，见 02 架构文档 §4.1
- ~~持久化双轨收敛（SaveManager 唯一事实来源，7 模块 serialize/restore，6 旧键迁移后删除）~~ ✅2026-09-21 完成，见 02 架构文档 §4.2
- ~~UI 类错位（ProgressionUI/WeaponSkinsUI 移至 ui/）~~ ✅2026-09-21 完成，见 02 架构文档 §4.3
- ~~依赖注入不统一（bus 必选走构造、audio/affixes 可选走 setter、_bus 命名统一）~~ ✅2026-09-21 完成，见 02 架构文档 §4.4 与 05 §6；顺带修复 DailyChallenge 未注入 bus 致 daily.completed 死事件
- ~~监听器生命周期（bus.on 返回 off / 跨回合注册集中 bootstrap / spawnAll 内禁注册）~~ ✅2026-09-21 完成，见 02 架构文档 §4.5 与 05 §7；三条款经查均已满足，加回归守卫锁定
- ~~combat.kill 的 ultimate 音效重复：main_entry（progression 处理器 L173）与 MatchController（比分处理器）各调一次 audio.playSound('ultimate')，每次击杀播两声。架构债 #5 调查时发现，非生命周期问题，择机去重（保留比分处理器一处）~~ ✅2026-09-21 修复：移除 MatchController 的 ultimate 调用，保留 main_entry 进度处理器为唯一击杀音源；顺带从 MatchController deps 移除 audio
- ~~UI 面板四胞胎 → UIPanel 基类~~ ✅2026-09-21 完成：新增 `src/ui/UIPanel.js` 基类（居中/定位容器 + toggleKey + Escape + show/hide/toggle/render 契约），AffixesUI/AchievementsUI/WeaponSkinsUI/SaveUI 继承之，消除四份重复的面板样板；SkillTreeUI 因全屏遮罩+opacity+ui.locklost 语义保持独立；7 单测守卫
- ~~近战武器 _perform 上提 Weapon 基类~~ ✅2026-09-21 完成
- ~~事件名/存储键常量模块化~~ ✅2026-09-21 完成：新增 `src/core/constants/events.js`（EV，36 个 bus 事件）与 `src/core/constants/storage-keys.js`（LS，11 个键）收敛全仓事件名与 localStorage 键，替换 20 文件 90+ 处字面量；05 §1/§2 加常量化约定；平衡数值常量待后续单独处理
- ~~平衡数值常量模块化（伤害/冷却/阈值等魔法数字）~~ ✅2026-09-22 完成：新增 `src/core/constants/balance.js`（WEAPON_STATS），5 武器构造参数收敛
- ~~每帧 Vector3 分配池化；miniMap.setWorldSize 每帧调用~~ ✅2026-09-22 部分偿还：miniMap.setWorldSize 改地图键变化才调用 + MiniMap 内部早退；Vector3 维持既有实例字段模式（_tmpOrigin/_vDir 等）
- ~~测试缺口：Character/CombatSystem 主路径/GameMode/MapGenerator~~ ✅2026-09-22 完成：Character.takeDamage 7 用例 + GameMode 4 + MapGenerator 4 + CombatSystem.resolveMelee 4
- ~~Escape 多面板同时响应（需统一 UI 栈）~~ ✅2026-09-22 完成：新增 `src/ui/UIStack.js`，面板 show/hide 入出栈，捕获阶段只关栈顶；UIPanel/SkillTreeUI/SettingsMenu/ResultScreen 移除各自 Escape 监听，InputRouter 栈空才开设置；04 §3 约定

## 修复记录

| 日期 | commit | 问题编号 |
|---|---|---|
| 2026-09-21 | P0 fix commit | #2 #4 #9 #10 #12(hud.flash) #13 #15 #24 |
| 2026-09-21 | P1 fix commit | #11 #19(战役奖励) #20 #21 #22(rage) #23 |
| 2026-09-21 | 收尾 fix commit（本轮） | #8 #12(全) #16 #17 #18 |
| 2026-09-22 | b3b0905 | #18 真修：_affixApply/_affixLeech 补实现（原提交漏 helper 致箭矢/AOE TypeError 回归），近战/箭矢/AOE 三路径统一词条，7 用例 |
| 2026-09-22 | 68a156d | 实现 ultimateMelee/ultimateLine 大招 API（原 tryUltimate 调不存在方法），spawnPierceArrow 加 opts 覆写修 Boss 连射/火球签名错误，5 用例 |
| 2026-09-22 | 658746e | e2e 冒烟补攻击→伤害断言（__game 调试句柄），堵住箭矢/近战回归类问题 |
| 2026-09-22 | 台账清理 | #12/#16/#17 核实已修标 ✅；#19 desc 改"今日累计"口径 |
| 2026-09-22 | e22f12b | Spawner 下沉：spawnRed/spawnReinforce 收进 gameplay/Spawner.js，精英技能随机去重，+7 用例 |
| 2026-09-22 | 4bc9280 | AIController 构造尊重 passive/maxHp（此前被静默丢弃——隐藏 bug），+9 决策路径用例 |
| 2026-09-22 | 943835c | HUD 高频 setter 接入 _write 脏检查（WeakMap 缓存），消除每帧重复 DOM 写入，+7 用例 |
| 2026-09-22 | 1a0c3b6 | Terrain.heightAt/isWater/waterDepth 8 用例（确定性/出生区平坦/河床/桥面/台地/外部覆写） |
| 2026-09-22 | f685d3a | WeaponTrail 环形缓冲+预分配 Vector3 消除每帧分配；箭矢 lookAt/落点去 clone、Mesh 池化 |
| 2026-09-22 | 0a5336d | Character.update() 189 行拆分为 9 个语义子函数，行为不变 |
| 2026-09-22 | 73e8b88 | 成就接线下沉 app/AchievementWiring.js（10 触发源+奖励分发），+5 用例 |
| 2026-09-22 | 061b943 | playwright webServer 改 reuseExistingServer:false，杜绝残留 preview 服务旧 dist 假失败 |
| 2026-09-22 | 0c8cfc3 | Terrain 纹理改 opts.textures 注入，消除 world→render 分层违规（分层依赖清零） |
| 2026-09-22 | 661acb8 | ComboSystem/AIManager/UnitFormation 补测 +18 用例 |
| 2026-09-21 | main_entry 三步拆分 commit | P2 架构债#1（MatchController/SaveOrchestrator/InputRouter） |
| 2026-09-21 | 持久化双轨收敛 commits | P2 架构债#2（SaveManager 唯一事实来源 / 7 模块 serialize/restore / 6 旧键迁移后删除） |
| 2026-09-21 | UI 类错位 commit | P2 架构债#3（ProgressionUI/WeaponSkinsUI 移至 ui/） |
| 2026-09-21 | 依赖注入统一 commit | P2 架构债#4（bus 走构造 / _bus 命名统一 / 修复 DailyChallenge 死事件） |
| 2026-09-21 | 监听器生命周期 commit | P2 架构债#5（三条款已满足 + 回归守卫 + 05 §7 约定）；登记 ultimate 音效重复次要缺陷 |
| 2026-09-21 | ultimate 音效去重 commit | 修复 combat.kill 音效重复（移除 MatchController 调用 + audio 依赖，保留 main_entry 进度处理器单一音源） |
| 2026-09-21 | UIPanel 基类 commit | UI 面板四胞胎消除：新增 UIPanel 基类，AffixesUI/AchievementsUI/WeaponSkinsUI/SaveUI 继承（7 单测） |
| 2026-09-21 | 常量化 commit | 事件名/存储键收敛 core/constants/，20 文件 90+ 处字面量替换；平衡数值拆分独立条目 |
| 2026-09-21 | Weapon 基类 commit | 近战武器 _perform 上提 Weapon 基类（Sword/Spear/SwordShield/Warhammer 去重复，Bow 保留覆写），3 单测守卫 |
| 2026-09-22 | balance 常量 commit | 平衡数值常量化（WEAPON_STATS，5 武器） |
| 2026-09-22 | miniMap commit | setWorldSize 改地图键变化才调用 + MiniMap 内部早退 |
| 2026-09-22 | 测试缺口 commit | Character.takeDamage/GameMode/MapGenerator/CombatSystem.resolveMelee 共 19 用例 |
| 2026-09-22 | UIStack commit | Escape 统一 UI 栈：新增 UIStack，4 类面板接入，多面板同时响应消除 |
