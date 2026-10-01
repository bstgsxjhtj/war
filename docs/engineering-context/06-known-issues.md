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
- ~~**WeaponTrail trail.line.parent 指向 scene 根（恒等变换）**：update 中 `wp.parent.localToWorld(...)` 的 `wp = trail.line`，其 parent 是 scene 而非武器 mesh 的父节点，导致 trail 位置始终为固定偏移（0,0,-0.6)/(0,0,0.8）不随武器移动。系既有设计偏差（非本轮回归），暂记观察项，不影响游戏运行；后续如需 trail 跟随武器，需在 attach 时缓存 weaponMesh 引用并改用其 parent 的 matrixWorld~~ ✅2026-09-28 修复（P2-9, caaec5a）：attach 时缓存 weaponMesh 引用，update 改用 `trail.weaponMesh.matrixWorld` 替代场景根 matrixWorld，轨迹现在正确跟随武器

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
| 2026-09-23 | 2d3395b | e2e 扩展换图/模式切换/胜负/重开 4 场景；修 ResultScreen 未 import UIStack 致 hide 崩溃；修 MatchController.restart 重入递归爆栈（_restarting 保护）；playwright timeout 120s；+2 单测 |
| 2026-09-23 | 7d6082a | WeaponTrail localToWorld 优化：2 次 updateWorldMatrix 遍历合并为 1 次 + 2 次 applyMatrix4 原地计算；+8 单测 |
| 2026-09-23 | fb5fb95 | main_entry 主循环瘦身：移除 ROUND_END 双渲染、trajectory 预分配 Vector3 消除每帧 3 次分配、__mp 改 getter 消除每帧对象分配、合并重复 mode.name 检查、ais.filter 改计数循环消除每帧临时数组 |
| 2026-09-24 | 3ad393d | P1-3/P1-4：Boss 血条 HUD（showBoss/setBossHP/hideBoss）+ 低血量红色边框警告（ratio<0.3）；main_entry BGM 扫描块追踪 Boss 显隐血条；+5 用例 |
| 2026-09-24 | f8778b3 | P2-1：骑兵冲锋机制——idle/windup/charging/recovery 状态机，冲锋踩踏 40 伤害（每敌一次），冷却 8s；CavalryEnemy.update 绕过 AIController 直驱 Character；+14 用例 |
| 2026-09-24 | ad3161f | P2-2：技能树分支路径——8 互斥分支（狂暴/守护·回复/吸血·疾风/闪避·狂热/暴击），前置 Lv2+ 解锁，upgradeBranch + 8 效果 getter，CombatSystem/Character/HUD/SkillTreeUI 全链路接入；+17 用例 |
| 2026-09-24 | 4b0afae | P2-3：击杀处决强化——补 canBeExecuted getter（alive && ratio<0.2），KeyE 接 _tryExecute，Boss 击杀 0.3s@15% 慢镜、普通 0.15s@20%，处决提示 HUD hint；+11 用例 |
| 2026-09-24 | e2f5035 | P3-1：教程扩展 5→8 步（补闪避 Q/武器切换 1-4/处决 E）；修复生产 bug——new Tutorial() 未传 bus 致 COMBAT_COUNTER/ULTIMATE 事件步成死路径（仅超时兜底）；完成语补 Tab/Q/E 探索提示；回合结束 destroy 卸载监听；+9 用例（净增 4） |
| 2026-09-24 | 1852330 | 第四轮 P0-1：敌人攻击前摇 0.45s + TelegraphIndicator 地面红圈预警 |
| 2026-09-24 | e44a67a | 第四轮 P0-2：暴击金色伤害数字 + 暴击音 |
| 2026-09-24 | 17da18d | 第四轮 P0-3：玩家受击红色 vignette + 镜头 kick |
| 2026-09-24 | 742aef4 | 第四轮 P1-1：连击里程碑音 + 金屏脉冲（combopulse） |
| 2026-09-24 | 27fb3e9 | 第四轮 P1-2：Boss 阶段横幅 + 咆哮音（HUD_BOSSPHASE / FX_BOSSROAR） |
| 2026-09-24 | 91a21b1 | 第四轮 P1-3：处决专属反馈（COMBAT_EXECUTE → 处决音 + 金色横幅 + hitStop + 震屏） |
| 2026-09-24 | 69819da | 第四轮 P2-1：闪避残影——FX_DODGE 事件 + DodgeGhosts 渲染组件（半透明胶囊幻影 0.4s 消散，仅玩家） |
| 2026-09-24 | a04180c | 第四轮 P2-2：完美格挡视觉闪屏——金色"弹反"横幅 #parryflash + 全屏金闪 #parryglow（FX_PERFECTBLOCK 玩家触发） |
| 2026-09-24 | 28bc43a | 第四轮 P2-3：输入缓冲扩展到闪避/处决——requestDodge/requestExecute 0.25s 缓冲重试，Player.update 消费 |
| 2026-09-24 | 台账核实 | 第四轮 P3-1 核实：COMBAT_COUNTER 音效链路完整（CombatSystem L83 emit → main_entry L236 → AudioEngine.counter），无需修复 |

## 第五轮（2026-09-28）质量审计修复记录

> 来源：`docs/superpowers/plans/2026-09-24-round5-quality-audit.md`。P0 阻断级 bug → P1 一致性 → P2 中等优化 → P3 长线新增。TDD 全程，最终 823 测试全绿。

| 日期 | commit | 内容 |
|---|---|---|
| 2026-09-28 | f75cb8f | P0-1：处决双向 9999 互杀竞态——Character._takeDamage 加 `_executing` 守卫防止处决者被反杀 |
| 2026-09-28 | 3ffc589 | P0-2：_releaseArrow 未定义方法——CombatSystem 箭矢命中调用 `this._releaseArrow(a)` 但无定义，补实现（回收箭矢 mesh + emit FX） |
| 2026-09-28 | fb3a242 | P0-3：AI 永不格挡——AIController 格挡检查用 `_blocking` 但 Character 设 `_isBlocking`，字段名不匹配，修正 |
| 2026-09-28 | 8b111bc | P0-4：AchievementWiring 死代码——从未调用，改为 main_entry 启动时 wireAchievements()；恢复 nightmare clear/forceSkin 事件 |
| 2026-09-28 | 0b4aab7 | P0-5：完美格挡链路断裂——CombatSystem 完美格挡未设 `_perfectRebound`，combo 系统判定为未反弹导致连击中断 |
| 2026-09-28 | b643952 | P1-1：Boss/AI 位移技能失效——技能位移写入 `root.position` 而非 `this.position`，Character.update 用 position 不读 root |
| 2026-09-28 | d09871e | P1-2：关卡 difficulty 对主敌人未生效——Spawner 用 `stageDifficulty` 参数但 spawnRed 未传 |
| 2026-09-28 | 3f6e4f7 | P1-3：Warhammer 连击不可达+windup——连击窗口固定 0.4s，改为动态 `0.4+combo*0.05`；移除死 windup 属性 |
| 2026-09-28 | e6da924 | P1-4：普通格挡无音效——新增 FX_BLOCK 事件，AudioEngine 播 block 音 |
| 2026-09-28 | acd46b8 | P1-5：六大模块 dispose 缺失——HUD/MiniMap/WeatherSystem/SupplyPoint/EnvHazards/DeathFeedback 补 dispose() |
| 2026-09-28 | 8b47e6d | P1-6：事件监听+setInterval 泄漏——SaveOrchestrator/HUD/ProgressionUI/AudioEngine 补 dispose 移除监听和 clearInterval |
| 2026-09-28 | 1ba4e47 | P1-7：Boss 阶段切换断崖——阶段切换直接跳 HP 70%/40%，改为线性插值平滑过渡 |
| 2026-09-28 | cdba941 | P1-8：死代码/死事件清理——移除 STATE_CHANGE 死事件、未引用函数、孤立变量 |
| 2026-09-28 | 1e31c58 | P2-1：教程扩展至 12 步——补闪避/武器切换/处决/大招/锁定/冲刺等高级教学 |
| 2026-09-28 | 3046867 | P2-2：HUD 信息完善——buff 剩余时长、Boss 阶段指示、radar/MiniMap 去重 |
| 2026-09-28 | d4de5de | P2-3：结算屏复盘维度——补连击/格挡/闪避/处决次数，评级算法加入承伤维度 |
| 2026-09-28 | eaa6dbd | P2-4：无障碍——色弱形状区分、减少动效（关脉冲/震动/顿帧）、屏幕震动强度调节 |
| 2026-09-28 | 0472d61 | P2-5：低端机降级——QualityGovernor 自适应降帧 + Renderer/Weather/Environment 画质缩放 |
| 2026-09-28 | 892445d | P2-6：每帧分配热点——Skeleton 缓存骨骼名并集、CombatSystem 去 clone()、AIController 预分配 flank 向量 |
| 2026-09-28 | 2a525cc | P2-7：Build 多样性——RunBuffs 池 6→13，reroll 机制每局 2 次 |
| 2026-09-28 | bbfd131 | P2-8：魔法数字收敛——balance.js 新增 COMBAT/CAMERA/EXECUTE 常量组 |
| 2026-09-28 | caaec5a | P2-9：WeaponTrail 跟随武器——attach 缓存 weaponMesh，update 用 weaponMesh.matrixWorld 替代场景根 |
| 2026-09-28 | a8af555 | P2-10：测试基建——createThreeMock() 轻量 Three.js 桩 + CombatSystem.emitHit 主路径测试 |
| 2026-09-28 | 20bf65c | P3-1/P3-2：Boss 阶段 3 专属机制（quake/meteor/clone）+ 噩梦新周目（enemyMods/hazardBoost/bossPhase3） |
| 2026-09-28 | b4d4644 | P3-3：战役接入 RunBuffs——过关 3 选 1 升级，MatchController 接 upgradePicker |
| 2026-09-28 | 698efc1 | P3-4：键位重绑系统——KeyBindings 模块（15 动作可重绑+冲突检测+持久化）+ SettingsMenu 重绑 UI |
| 2026-09-28 | 3e775d8 | P3-5：LOD 系统+角色批渲染——LODManager 4 级距离降级 + InstancedMesh 代理远距角色 |
| 2026-09-28 | 0ad7ec7 | P3-6：存档版本迁移框架——CURRENT_VERSION=2 + MIGRATIONS 注册表 + 损坏备份恢复（savegame_v1_bak） |
| 2026-09-28 | ee44f79 | Round 6 P0-1：噩梦 enemyMods/hazardBoost 消费端接线——Spawner._applyEnemyMods 注入词条、EnvironmentHazards.setHazardBoost 放大环境伤害 |
| 2026-09-28 | 27e492d | Round 6 P0-2：AI 闪避 i 帧对称——AIController.takeDamage 顶部 _dodgeTimer>0 免伤，与玩家 _dodgeIFrame 对称 |
| 2026-09-28 | c23c19e | Round 6 P0-3：教程读 KeyBindings 防重绑卡死——Tutorial 展示动作名而非硬编码键码 |
| 2026-09-28 | b7eb639 | Round 6 P1-1：Boss AOE 预警+延迟结算——spawnAoE delay 参数+地面单位环预警+_pendingStrikes 队列 |
| 2026-09-28 | 44b312d | Round 6 P1-2：KeyBindings 下沉 core/input 层——消除 gameplay/ui→app 反向依赖+架构守卫测试 |
| 2026-09-28 | 8e3c197 | Round 6 P1-3：处决提示+教程进度条动态键位文本——KeyBindings.getBindingLabel 替换硬编码 |
| 2026-09-28 | 576baeb | Round 6 P1-4：LOD 远距隐形威胁修复+精英代理区分——threat 矩阵+_proxyElite 标志 |
| 2026-09-28 | a4bf6ac | Round 6 P2-1：伤害倍率封顶——resolveMelee/resolveArrow/resolveAoE 统一 Math.min(amount, COMBAT.MAX_DAMAGE) |
| 2026-09-28 | d6fdd94 | Round 6 P2-2：UI 快捷键纳入 KeyBindings——skilltree/affix/mode/weather/settings 5 动作可重绑 |
| 2026-09-28 | c1ec474 | Round 6 P2-3：正反馈音效——pickup/levelup/buffSelect/stageStart 4 音效+4 消费点接线 |
| 2026-09-28 | 2416a11 | Round 6 P2-4：战役目标多样性审计——7 种变奏已全部实现且有测试覆盖 |
| 2026-09-28 | 68fa8b0 | Round 6 P2-5：游戏时钟延迟设施——GameClock schedule(delay,fn) 随 timeScale 缩放+clear-on-reset |
| 2026-09-29 | 59e17ea | Round 6 P2-6：箭矢对象池+LOD tick 降频——_acquireArrow/_releaseArrow 池(64)+LOD 0.25s 节流 |
| 2026-09-29 | ef8ccff | Round 6 P2-7：e2e 覆盖新系统+UpgradePicker 回调修复——键位/存档/战役3选1 覆盖+hide 先于 callback bug 修复 |
| 2026-09-29 | 0d3c7c5 | Round 6 P3-1：main_entry 拆分——EventWiring.js 下沉 17 个纯事件处理器，594→549 行 |
| 2026-09-29 | da634c5 | Round 6 P3-2：AI 涌现行为——连续被完美格挡后变招（叫援军+适应撤退）+计数衰减 |
| 2026-09-29 | 1e5ea90 | Round 6 P3-3：词条行为统一抽象——AffixBehavior 接口+applyEnemyBehaviors 调度器，三消费方收敛 |
| 2026-09-29 | b4e7793 | Round 6 P3-4：Boss 阶段转换演出——镜头 FOV 收缩+吼叫音效+环境天气切换（storm/night） |
| 2026-09-29 | — | Round 6 视觉重塑三阶段：地基（SSAO/Reflector 静态 import 修 dist 404+去 flatShading 提面数+Fresnel 金边轮廓光+琥珀调色+Bloom 降参+low 降级关 SSAO/Bloom/Reflector）+塑形（刀刃 ExtrudeGeometry+头盔 LatheGeometry+甲胄法线贴图+城墙砖纹+远山 8 面扰动+树提段）+精修（雾层次 40-200+帐篷/烟柱/石头/篝火提段+水面反射暖色） |
| 2026-09-29 | 7f8b71c | 体验修复：鼠标 pitch 反向+环境碰撞(树/石头)+卡顿(SSAO high-only/像素比1.5/Reflector high-only/≤4核默认mid)+地面y阻尼+灵敏度0.0018+相机距7.5 |
| 2026-09-29 | d1cfb14 | 击杀 2s 卡顿修复：TextureFactory canvas 静态缓存(根因)+hitstop 双重冻结去重(hitStop active 时不叠加 combat.hitstop) |
| 2026-09-29 | 3bead8e | UX 轮：预警环分级(黄/红/白)+攻击收招取消(tryDodge 反向 bug)+锁定切目标+低血心跳+升级卡稀有度(加权抽取) |
| 2026-09-29 | — | 架势条系统：POSTURE 常量+Character._addPosture(格挡/受击/攻击累积)+崩防可处决+regen(0.6s 延迟)+AIController posture>70 后撤+HUD setPosture 架势条 |
| 2026-09-29 | 1bd6188 | 架势条系统正式提交：Sekiro-style guard break + execute window |
| 2026-09-29 | 7b304cc | 敌人头顶架势条显示：3D Sprite billboard 琥珀色（>0.7 橙红/崩防纯红闪烁），posture=0 时隐藏，与血条同显隐规则 |

## 部署后修复（2026-09-29）

| 日期 | Commit | 内容 |
|------|--------|------|
| 2026-09-29 | 903fefe | 鼠标移动画面消失根因修复——Player 构造未初始化 lookSensitivity，`0.0025 * undefined = NaN` 污染相机 yaw/pitch，WebGL 投影矩阵 NaN 导致只剩底色。修复：Player 构造函数 `this.lookSensitivity = 1`（默认值=1，`0.0025*1=SENSITIVITY_DEFAULT`）。SettingsMenu._applyAll 只在 show() 时 emit，用户首次进入从不开设置面板时 lookSensitivity 永为 undefined。新增 3 个 NaN 根因防护测试。 |
| 2026-09-29 | 10ea72b | docs 补登 903fefe commit hash 至台账 |
| 2026-09-29 | adcab61 | gitignore 排除 .deploy/、.ssh-config/、.env、*.pem、*.key、id_ed25519*/id_rsa*（部署/SSH/git 项目配置本地化，不上 GitHub） |
| 2026-09-29 | cefb4a9 | 视觉重塑：琥珀黄昏调色、smoothshade+Fresnel 金边、SSAO/Reflector 静态 import 修 dist 404 |

## 设计问题深度评审修复（2026-09-29 第七轮）

> 来源：5 专家圆桌评审（架构/游戏设计/性能/代码质量/测试），10 个候选问题全部确认真实并修复（D1-D7 第七轮，D8-D10 第八轮）。

| # | 问题 | 严重级 | 状态 |
|---|---|---|---|
| D1 | Health.cur/max 字段名混用 6 处跨 5 文件（SupplyPoint 回血写 NaN、Spawner Boss 强化失败、net.sendState undefined、setSkill clamp 失效） | P0 | ✅已修：Health 加 cur/max 别名 getter/setter 映射到 hp/maxHp |
| D2 | main_entry.js keyLabel 未导入，处决提示 ReferenceError（Time.tick catch 降级为 console 洪水） | P1 | ✅已修：import 补 keyLabel |
| D3 | 穿透箭机制失效（pierce/hitSet 定义但 update 命中循环无消费分支） | P1 | ✅已修：命中循环加 pierce>0 分支，扣次数+记 hitSet+继续穿透 |
| D4 | 波次/无尽模式 ais 与 combat.characters 无界增长（尸体不 dispose） | P1 | ✅已修：upgradePicker 回调 spawnRed 前倒序清理尸体 |
| D5 | WeaponTrail 无 detach（每回合泄漏 LineSegments + 幽灵拖尾） | P1 | ✅已修：加 clear() 方法（remove+dispose+解除 userData 引用），spawnAll 调用 |
| D6 | switchWeapon/setWeapons 泄漏旧武器 mesh（remove 但不 dispose） | P1 | ✅已修：remove 后调 deepDispose |
| D7 | 完美闪避 timeScale 死代码（Camera 私设字段无消费者） | P1 | ✅已修：Camera 移除 timeScale 字段，EventWiring FX_PERFECTDODGE 改走 hitStop.trigger(0.4, 0.5) |
| D8 | 高速箭矢穿隧（tunneling，60m/s 单帧 1m 可越过判定球） | P2 | ✅已修：命中判定改线段-点扫掠（prev→pos 线段到 capsule.center 最近距离），终极箭 pierce:true 改 pierce:99+hitSet |
| D9 | 锁定解除瞬间角色朝向跳变（两个缓动系统不同步） | P2 | ✅已修：Player 加 _wasLocked/_lockReleaseT/_lockReleaseFrom，解除锁定时 0.2s 角度插值过渡到 camera.yaw |
| D10 | 召唤/增援单位不进 enemies 快照，AI 协同失效 | P2 | ✅已修：enemies 快照数组改 getEnemies() 派生视图，始终反映 player+ais+remotes 当前状态 |

## 设计问题深度评审修复（2026-09-30 第九轮）

> 来源：5 专家圆桌评审（架构/游戏设计/性能/代码质量/测试），12 个候选问题全部确认真实并修复（E1-E12）。

| # | 问题 | 严重级 | 状态 |
|---|---|---|---|
| E1 | Boss hp/maxHp 实例字段遮蔽 health 对象——Boss 阶段机制 hpPct 恒为 1，阶段 2/3 永不进入（summon/quake/meteor/clone 全死代码） | P0 | ✅已修：Character 加 hp/maxHp getter/setter 转发到 health，消除 BossEnemy/EliteEnemy 实例字段双真相 |
| E2 | 投石（attacker=null）命中角色时 CombatSystem 箭矢分支 TypeError 崩溃 | P0 | ✅已修：命中分支对 null attacker 做 null-safe 处理（跳过词缀/吸血/命中事件） |
| E3 | damageGate/onSiegeHit 零调用者——攻城模式不可获胜（城门无敌） | P1 | ✅已修：CombatSystem 加 siege 引用，投石落地调 onSiegeHit，近战 resolveMelee 末尾加砍城门逻辑 |
| E4 | WeaponTrail 无 detach 方法——波次清理 clear() 误清玩家 trail | P1 | ✅已修：新增 detach(weaponMesh) 按 mesh 移除单条 trail，波次清理回调调用 |
| E5 | LODManager 死亡角色 skip 但不注销——_chars 无限持有已销毁对象阻止 GC | P1 | ✅已修：tick 改倒序遍历，死亡/失效角色直接 splice 注销 |
| E6 | AIController._dodgeTimer 遮蔽 Character._dodgeTimer——同帧双重递减 | P1 | ✅已修：改名 _aiDodgeTimer 消除遮蔽 |
| E7 | WeatherSystem 闪电 3 个 setTimeout——回调在 dispose/天气切换后残留 | P2 | ✅已修：改 dt 状态机驱动闪光序列（亮→灭→二次闪→灭），apply() 复位 |
| E8 | getEnemies() 每 AI 每帧调用——main_entry 循环内重复分配 | P2 | ✅已修：hoist 到循环外，AI 和 siege 共享 _all 快照 |
| E9 | 投石机占领逻辑用 _prevT 快照——占领状态切换延迟 | P2 | ✅已修：改为实时 trebuchet.team 比较，删除快照 |
| E10 | Camera killcam 计时用固定 1/60 步长——帧率相关 | P2 | ✅已修：follow() 加 dt 参数，killTimer 用 dt 递减；Player 两处调用传 dt |
| E11 | 波次结算未检查 player.alive——玩家死亡后仍可触发结算 | P2 | ✅已修：波次结算条件加 player.alive 前置检查 |
| E12 | Water 几何体不随地图切换重建——bridge 图水面过窄 | P2 | ✅已修：新增 setSize(width) 重建主几何体与反射面，loadMap 内调用 |

### 回归测试

| 修复 | 测试文件 | 新增用例 |
|---|---|---|
| E1 | BossEnemy.test.js | 4（hp/health 同源、takeDamage 联动、阶段 2 触发、Elite 联动） |
| E2/E3 | CombatSystem.arrows.test.js | 3（投石 null attacker 不崩、onSiegeHit 调用、近战砍城门） |
| E4 | WeaponTrail.test.js | 3（detach 移除/重 attach/未知 mesh 不崩） |
| E5 | LODManager.test.js | 3（死亡注销、部分死亡只移除死亡的、root 失效注销） |
| E7 | WeatherSystem.forecast.test.js | 3（四阶段状态机、apply 终止、dt 递减不残留） |
| E10 | Camera.bossPhase.test.js | 4（dt 递减、killTarget 位置、归零回退、默认 1/60 兼容） |
| E12 | Water.test.js（新建） | 3（setSize 重建/no-op/dispose 旧几何体） |

测试总量：988 → 1011（+23 个回归测试），100 个测试文件全绿。

## 设计问题深度评审修复（2026-09-30 第十轮）

> 来源：5 专家圆桌评审（架构/游戏设计/性能/代码质量/测试），7 个候选问题全部确认真实并修复（F1-F7）。

| # | 问题 | 严重级 | 状态 |
|---|---|---|---|
| F1 | BossEnemy._skillRapidshot 传错参数给 spawnPierceArrow（Vector3 当 attacker）→ 必崩 | P0 | ✅已修：改为正确签名 `(this, this.weapon, 1, { origin, dir, damage })` |
| F2 | RunBuffs 7 个升级字段（regen/atkspd/dodgecd/armor/crit/execdmg/counterdmg）设了从不读——玩家花选了 no-op | P1 | ✅已修：全部接入消费端（Character.update/takeDamage/tryDodge/_tickAttackPose/canBeExecuted + CombatSystem._affixApply/_counterMul） |
| F3 | 投石（isSiege）混入箭矢池——后续普通箭渲染为球体且 isSiege 残留误触发城门伤害 + 几何体内存泄漏 | P1 | ✅已修：_releaseArrow 对 isSiege 箭 dispose 几何体/材质不入池；spawnArrow/spawnPierceArrow 重置 isSiege=false |
| F4 | EscortTarget.takeDamage 从未被调用——护送目标无敌，护送任务不可失败 | P1 | ✅已修：EscortTarget 加 position/team/forward/weapon/_curVel/vy 字段；main_entry 注册到 combat |
| F5 | EnvironmentHazards 用 Date.now()——暂停/卡帧时仍造成伤害，且与 performance.now 时间基不同步 | P1 | ✅已修：改为 performance.now()*0.001 |
| F6 | DefensePoint 导入但从未实例化——死代码增加包体积 | P2 | ✅已修：移除 main_entry.js 中的导入 |
| F7 | AIController 每帧每 AI 调 filter() 分配数组——O(N²) + N 次 GC 压力 | P2 | ✅已修：改用 _allyBuf 可复用缓冲区 |

### 回归测试

| 修复 | 测试文件 | 新增用例 |
|---|---|---|
| F1 | BossEnemy.test.js | 1（rapidshot 正确调用签名） |
| F2 | RunBuffs.test.js | 7（7 个升级字段设值验证） |
| F3 | CombatSystem.arrows.test.js | 3（isSiege 不入池/dispose、spawnArrow/spawnPierceArrow 重置） |
| F4 | EscortTarget.test.js（新建） | 6（combat 字段、takeDamage 扣减/致死/死后、update 移动/无 player） |
| F5 | EnvironmentHazards.test.js | 1（now 值为秒级小数非 epoch） |

测试总量：1011 → 1029（+18 个回归测试），101 个测试文件全绿。

## 设计问题深度评审修复（2026-09-30 第十一轮）

> 来源：5 专家圆桌评审，7 个候选问题全部确认真实并修复（G1-G7）；G8 为测试覆盖建议。

| # | 问题 | 严重级 | 状态 |
|---|---|---|---|
| G1 | F2 修复中 5 个 RunBuffs 字段未持久化（_runRegen/_runDodgeCdMul/_runArmorMul/_runExecBonus/_runCounterMul）——升级仍为 no-op | P1 | ✅已修：PowerShell 直接写入 Character.js + CombatSystem.js，全部 5 个字段接入消费端 |
| G2 | SkillTree 3 个 getter 死代码（dodgeIFrameBonus/branchRegen/branchDodgeChance）——玩家投资技能树无回报 | P1 | ✅已修：tryDodge 加 dodgeIFrameBonus，update 加 branchRegen 回血，takeDamage 加 branchDodgeChance 被动闪避 |
| G3 | switchWeapon 不转移 weaponTrail——拖尾引用已销毁 mesh，切换武器后拖尾永久失效 | P1 | ✅已修：Character 加 setWeaponTrail 方法，switchWeapon 中 detach 旧 mesh + attach 新 mesh |
| G4 | WaveMode.onKill 从未被调用——alive 恒为 0，waveInfo 暴露错误数据 | P2 | ✅已修：MatchController COMBAT_KILL 处理器调 mode.onKill，spawnLayout 设置 alive=red.length |
| G5 | 坚韧词缀 max-HP 在加载存档后不生效——_applyAffixMaxHp 在词缀加载前执行 | P1 | ✅已修：_applyAffixMaxHp 重构含 skill bonus，setSkill 改调 _applyAffixMaxHp，switchWeapon 也调用 |
| G6 | HUD 回复 buff 显示硬编码 +2/s 而非实际 branchRegen 值 | P2 | ✅已修：改为动态 `回复 +${branchRegen}/s` |
| G7 | NetClient.connect 超时不关闭 WebSocket——慢连接后 socket 泄漏 + 竞态 | P2 | ✅已修：超时回调加 `try { this.ws.close(); } catch (e) {}` |
| G8 | RunBuffs 测试只验证字段设值不验证消费——假阳性覆盖 | P2 | ⬜已登记：需补集成测试实例化 Character 验证升级效果 |

### 回归测试

| 修复 | 测试文件 | 新增用例 |
|---|---|---|
| G4 | WaveMode.test.js | 2（spawnLayout 设 alive、waveInfo 联动） |

测试总量：1029 → 1031（+2 个回归测试），101 个测试文件全绿。

## 设计问题深度评审修复（2026-09-30 第十二轮）

> 来源：5 专家圆桌评审，3 个确认问题修复（H1/H2/H5）。

| # | 问题 | 严重级 | 状态 |
|---|---|---|---|
| H1 | F4 修复给 EscortTarget 设 team=1（敌方），敌人同队跳过——护送目标无敌，任务不可失败 | P0 | ✅已修：改为 team=0（玩家方），敌人（team=1）可攻击 |
| H2 | RunBuffs 升级在 spawnAll 重建 player 后丢失——战役模式跨关卡升级消失 | P1 | ✅已修：RunBuffs 加 reapply 方法，spawnAll 中调用 + 更新 upgradePicker.player 引用 |
| H5 | G2 的 branchDodgeChance 在格挡判定前触发——被动闪避劫持了完美格挡 | P1 | ✅已修：加 `!this._blocking` 前置条件，格挡优先于被动闪避 |

### 回归测试

| 修复 | 测试文件 | 新增/修改用例 |
|---|---|---|
| H1 | EscortTarget.test.js | 修正 F4 期望 team=0 |
| H2 | RunBuffs.test.js | 2（reapply 重应用、reapply 空列表不报错） |

测试总量：1031 → 1033（+2 个回归测试），101 个测试文件全绿。

## 体验提升计划（2026-10-01 第十三轮）

> 来源：项目专家全面评审。目标：提升画面、补全面菜单（选关/重开）、消除卡顿。P0 观测+渲染优化为前置，P1 主菜单/选关为旗舰，P2 SMAA/AI 动画收尾。

| # | 内容 | 优先级 | 状态 |
|---|---|---|---|
| P0-1a | QualityGovernor 双向化（回升不越过用户 ceiling）+ direction 标志 | P0 | ✅已修 |
| P0-1b | HUD F4 性能面板（FPS/帧时/Min/Max/drawcall/三角面/档位/单位数） | P0 | ✅已修 |
| P0-2 | 环境物 InstancedMesh（树/石/残骸）削减 drawcall | P0 | ✅已修 |
| P1-1 | 主菜单/标题屏（开始/继续战役/模式选择） | P1 | ✅已修 |
| P1-2 | 战役选关界面 + 地图/难度选择 | P1 | ✅已修 |
| P1-3 | 菜单统一视觉 + 补成就/词条/存档入口 | P1 | ✅已修 |
| P2 | SMAA 替换无效 MSAA + AI 动画降频 | P2 | ⬜待做 |

### P0-1 回归测试

| 修复 | 测试文件 | 新增用例 |
|---|---|---|
| P0-1a | QualityGovernor.test.js | 4（降级后回升 direction=up、回升未达阈值不触发、回升不越 ceiling、无变更 direction=null） |
| P0-1b | HUD.test.js | 5（默认关闭、toggle 切换、关闭时仅采样不写 DOM、开启跨节流刷新文案、F4 键触发） |
| P0-2 | Environment.instancing.test.js（新建） | 6（树 4 InstancedMesh+碰撞体、石单 InstancedMesh、残骸≤2 InstancedMesh、layout 模式、dispose 不抛） |
| P1-1 | MainMenuUI.test.js（新建） | 11（默认隐藏/show 压栈/hide 出栈/closable=false Esc 不关/开始新游戏回调/快速对战/设置不隐藏/有存档显关卡/无存档禁用/禁用不回调/全通关显通关数/dispose 移除） |
| P1-1 | UIStack.test.js | 2（closable=false 栈顶 Esc 不关但吞事件、closable=false 栈底时栈顶正常关闭） |
| P1-2 | StageSelectUI.test.js（新建） | 13（show 压栈/10 关卡片/cleared 解锁锁定/点击解锁关回调/锁定不回调/自由 tab 地图数/地图回调/难度回调/难度高亮/返回 onBack/Esc 关 onBack/选择态不 onBack/dispose） |
| P1-2 | MainMenuUI.test.js | 1（onQuickBattle→onStageSelect 更名适配） |
| P1-3 | MainMenuUI.test.js | 1（次级按钮 成就/词条/存档 分别回调且不隐藏标题屏） |
| P2 | Character.anim-throttle.test.js（新建） | 5（非本地 _animInterval=1/30+累积=0、本地 _animInterval=0、未达间隔不调 update+累积、达间隔调 update 传累积 dt+清零、本地每帧调 update 传原始 dt） |

测试总量：1033 → 1143（+110，含历史新增累计），108 个测试文件全绿。
