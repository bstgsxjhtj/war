# 第五轮圆桌讨论：功能审计与优化计划

> 日期：2026-09-24 ｜ 参与专家：战斗设计师 / 关卡进度设计师 / UX 设计师 / 性能工程师 / 架构师
> 方法：五维度并行只读调研 → 圆桌交叉评审 → 分级优化计划
> 调研范围：src/gameplay、src/ui、src/audio、src/engine、src/world、src/app、src/core、src/main_entry.js、tests/、e2e/

---

## 一、圆桌讨论纪要

### 战斗设计师（手感 / 判定 / AI 行为）

**致命发现：处决双向 9999 互杀竞态**
- `Character.startExecute` 同时给 `target._executing` 和 `target._executingTarget` 赋值，而 `_tickExecuting` 在目标自身 update 中也会跑，到期时目标会对自己 `_executingTarget`（即玩家）造成 9999。结果取决于 `combat.characters` 遍历顺序——敌人先 tick 就反杀玩家。这是处决系统在群战中的高危炸弹。

**致命发现：AI 永不格挡（字段错误）**
- `AIController.js:181` 检查 `weapon.type === 'shield'`，但所有近战武器 `type` 都是 `'melee'`，剑盾的标识是 `weaponClass === 'SHIELD'`。这个恒为 false 的条件让 blockChance（0.10~0.30）永远不触发——剑盾敌人从不举盾，格挡系统对 AI 完全失效。

**严重发现：Boss 位移技能全部失效**
- `BossEnemy` 的 charge/dodge/teleport 都写 `root.position.add/set`，但 `super.update` 的 `_tickPhysics` 会用 `this.position` 覆盖回 `root.position`。Boss 冲锋一闪即回原位，只有伤害和 AOE 生效，空间压迫感归零。AI 闪避同理：只设翻滚动画不设 i 帧，位移被覆盖 = 原地空翻。

**严重发现：完美格挡链路断裂**
- `CombatSystem.js:185` 读取 `attacker._perfectRebound`，但全仓 grep 确认它从未被赋值为 true（Character 完美格挡分支缺这一行）。完美格挡的 +3 连击加成、perfect 倍率、tier 跃升全部失效——玩家弹反只有视觉爽，无数值闭环。

**严重发现：Warhammer 连击不可达 + windup 死代码**
- comboWindow 0.6s < cooldown 1.2s，重锤三段连击（45/80 伤害、combo2 AOE）永远无法触发。`balance.js` 定义的 windup（0.06~0.18）属性全仓无人读取，五武器起手速度无差异。所有武器共用 0.42s 动画时长，重武器"沉重起手"丢失。

**体验评价**：核心战斗框架丰富（克制/连击/暴击/背刺/处决/完美格挡闪避），但多条链路在"最后一公里"断裂——数值反馈与机制设计脱节。玩家能感受到爽快（hitstop、残影、闪屏），但深入玩会发现"弹反没收益、重锤没连招、AI 不举盾"。

### 关卡进度设计师（难度曲线 / Boss / Build 多样性）

**严重发现：关卡 difficulty 对主敌人完全未生效**
- `CampaignMode` 返回 difficulty 1.0→2.4，但 `main_entry` 只取 `.red` 丢弃 difficulty 字段，`Spawner` 主敌人 HP = BASE×maxHpMul×hpMul（不含关卡 difficulty）。设计的难度曲线对 90% 敌人无效，关卡间唯一变化是"敌人数量"，单兵威胁无成长。

**严重发现：Boss 阶段切换单调**
- 阶段 1 只会普攻，到 60% HP 瞬间全技能解锁（断崖），阶段 3 仅 speed+15% 无新机制。mini Boss 只有 2 阶段。4 个 Boss 都是 3 技能，差异主要是 HP 数值而非玩法类型。CampaignMode 配置的 bossPhase 0.5 阈值被 Boss 自身 0.6 覆盖，设计意图失效。

**严重发现：技能树防御分支废掉**
- guardian -15% 受伤（省 4.5 点）远不如 berserk +25% 伤害的击杀效率；regen +2HP/s 杯水车薪，lifesteal 跟 DPS 走。8 分支实质只有 4 个可用，互斥设计让防御连"搭配进攻"的机会都没有。

**体验评价**：肉鸽深度不足——RunBuffs 池子仅 6 项且 damage 可无限叠加（无脑选），战役模式完全不触发 RunBuffs 选取（10 关靠初始 build 打到底），噩梦新周目仅数值 ×1.35 无新机制。通关激励链在噩梦即断裂。

### UX 设计师（引导 / HUD / 音效 / 无障碍）

**严重发现：普通格挡音效已实现但从未调用**
- `AudioEngine.block()` 存在但全仓 `playSound('block')` 零结果，Character 格挡分支无事件 emit。玩家无法通过声音确认格挡是否生效。这是音效覆盖最刺眼的缺口。

**严重发现：教程缺少 7 项进阶机制引导**
- 技能树(K)、词条(I)、锁定(Tab)、连击终结、完美闪避 buff、波次升级选择、模式特色玩法，教程全部无交互引导。STEP_TIMEOUT 仅 6s，新手来不及操作就跳步。无"重新查看教程"入口。

**严重发现：无障碍全面缺失**
- 无键位重绑、无色弱模式、无减少动效选项、无 UI 缩放、无 FOV 调节、无屏幕震动强度调节。低血量全屏脉冲红光无关闭选项，前庭敏感玩家可能不适。无 ARIA 语义化。

**体验评价**：HUD 信息密度过高（25+ 并发元素），radar 和 MiniMap 功能重叠同时渲染，buff 无剩余时长，Boss 血条无阶段指示。结算屏只有 kills/damage/time，缺连击/格挡/闪避/处决次数等复盘维度，评级算法单一（刮痧通关也能拿 S）。

### 性能工程师（帧率 / 内存 / 渲染 / 测试）

**阻断级 bug：_releaseArrow 调用从未定义的方法**
- `CombatSystem.js:321` `this._releaseArrow(a)` 全仓仅此 1 处引用、无定义。箭矢命中目标时抛 `TypeError`。

**严重发现：六大核心模块全部缺少 dispose**
- Character / CombatSystem / Scene / Environment / WeatherSystem / Water 均无 dispose 方法。Character 的 4 个 MeshStandardMaterial + 骨骼几何体永不释放，50 角色 ×4 = 200 个未释放材质。场景重建时 GPU 资源系统性泄漏。

**严重发现：每帧分配热点残留**
- `Skeleton.js:131` 每帧每角色 `new Set([...keys])` + 展开运算符，50 角色 = 50 Set + 100 临时数组/帧。`CombatSystem.js:86-87` 每命中 double clone Vector3。

**严重发现：低端机无降级**
- setQuality('low') 仅关 shadow + 降 pixelRatio 到 0.7，后处理 SSAO+Bloom+Vignette 全开。天气粒子（雨 2000/雪 1500）和草（5000 实例）硬编码不随 quality 缩减。无 LOD、无自适应降帧。

**体验评价**：测试覆盖严重不足——18+ 核心模块无单测（含 349 行 CombatSystem 和 566 行 main_entry），根因之一是 tests/setup.js 缺 Three.js mock。e2e 仅冒烟路径，战斗深度/Boss/骑兵/天气/攻城全未覆盖。

### 架构师（分层 / 死代码 / 可维护性）

**严重发现：AchievementWiring 整模块死代码 + 死事件**
- `AchievementWiring.wireAchievements()` 从未被调用（02 架构文档声称"已下沉"名不副实），main_entry 仍用内联接线。导致 `CAMPAIGN_NIGHTMARE_CLEAR` 成就永不触发、`reward.forceSkin` 强制皮肤解锁两处功能静默丢失。

**严重发现：WeaponTrail 拖尾不跟随武器**
- trail.line 挂到 scene 根（恒等变换），tail/tip 永远是固定 (0,0,-0.6)/(0,0,0.8) 世界坐标，武器拖尾轨迹静止不动。06 台账标记"观察项"至今未修。

**严重发现：分层违规 + 死导入**
- `world/Terrain.js:2` 仍 `import { TextureFactory } from '../render/TextureFactory.js'`（文档声称 0c8cfc3 已修但实际是死导入+残留违规）。`ECS.js` 75 行全仓无人使用。`STATE_CHANGE` 死事件无监听者。`UpgradePicker` 用字符串字面量事件名违反常量化约定。

**严重发现：main_entry 上帝文件回归**
- 主循环 158 行包含 15+ 职责（状态分支/BGM 扫描/Boss 血条/天气/玩家 AI 调度/网络/攻城/武器轨迹/HUD/轨迹预览/处决提示/模式 tick/死亡反馈/胜负判定）。02 文档标记"已拆分"但 spawnAll 58 行仍内联、成就接线仍内联。

**体验评价**：初始化存在 TDZ 隐性依赖（audio 在 L209 声明但 L132+ 的 handler 闭包提前引用），当前靠"事件在循环中才触发"的时序巧合保平安。魔法数字散布全仓（balance.js 仅覆盖 5 武器）。

---

## 二、体验总评

| 维度 | 当前评分 | 一句话评价 |
|---|---|---|
| 战斗爽快感 | 7/10 | hitstop/残影/闪屏等反馈层优秀，但弹反无收益、AI 不格挡、Boss 位移失效让深度打折 |
| 战斗深度 | 5/10 | 框架齐全但多条链路断裂，完美格挡/重锤连招/弓箭克制均未闭环 |
| 难度曲线 | 4/10 | difficulty 对主敌人未生效，曲线锯齿式，Boss 阶段切换断崖 |
| Build 多样性 | 4/10 | 防御分支废掉、RunBuffs 池子太小、damage 无限叠加，最优解单一 |
| 新手引导 | 5/10 | 基础 8 步够用，但 7 项进阶机制无引导，6s 超时过短 |
| 信息呈现 | 6/10 | HUD 元素齐全但过载，radar/MiniMap 重叠，buff 无倒计时 |
| 无障碍 | 2/10 | 键位/色弱/动效/缩放全部缺失，前庭敏感玩家无保护 |
| 性能稳定性 | 5/10 | dispose 系统性缺失、低端机无降级、阻断级 _releaseArrow bug |
| 测试覆盖 | 3/10 | 18+ 核心模块无单测、e2e 仅冒烟、缺 Three.js mock |
| 架构健康 | 6/10 | 分层大体清晰，但死代码/死事件/上帝循环/分层违规残留 |

**综合**：项目在"广度"上做得很好（5 武器/4 Boss/8 技能分支/6 词条/4 模式/天气/骑兵/攻城/教程），反馈层（第四轮手感优化）已达到较高水准。但"深度"上存在系统性欠债——多条机制在"最后一公里"断裂，性能/无障碍/测试三大基础工程缺口明显。第五轮应聚焦"把已有机制做对"而非"再加新机制"。

---

## 三、分级优化计划

### P0 阻断级 / 致命 bug（必须立即修，影响功能正确性）

| # | 任务 | 触点 | 方案要点 |
|---|---|---|---|
| P0-1 | 处决双向 9999 互杀竞态 | Character.js:577-583, 328, 375 | 处决改为单向：仅攻击者 tick 执行 `target.takeDamage(9999)`，目标侧 `_executing` 仅作动画/锁定标记不触发伤害；或给目标 `_executing` 时跳过 `_tickExecuting` 的伤害行 |
| P0-2 | _releaseArrow 未定义方法 | CombatSystem.js:321 | 定义 `_releaseArrow(arrow)`（移除 mesh + dispose geo/mat），或将调用改为内联的 `_arrows.splice + scene.remove` |
| P0-3 | AI 永不格挡（字段错误） | AIController.js:181 | `weapon.type === 'shield'` → `weapon.weaponClass === 'SHIELD'`；接入 Character 格挡分支（设 `_blocking`/`_perfectWindow`）而非静默减伤 |
| P0-4 | AchievementWiring 死代码 + NIGHTMARE_CLEAR 死事件 | main_entry.js:68,130-147 / AchievementWiring.js | 移除 main_entry 内联成就接线，改调 `wireAchievements(bus, progression, achievements, skins)`；恢复 CAMPAIGN_NIGHTMARE_CLEAR 监听 + forceSkin 处理 |
| P0-5 | 完美格挡链路断裂 | Character.js:270-275 | 完美格挡分支补 `this._perfectRebound = true`；可选补 `_perfectBuff`（与完美闪避对称的伤害增益） |

### P1 严重（影响体验/性能，应优先排期）

| # | 任务 | 触点 | 方案要点 |
|---|---|---|---|
| P1-1 | Boss + AI 位移技能失效 | BossEnemy.js:62/81/110/130, AIController.js:173-180 | 位移写到 `this.position`（Character 真实坐标）而非 `root.position`；或让 `_tickPhysics` 读 `this.position` 后不清零外部位移，改为累加 |
| P1-2 | 关卡 difficulty 对主敌人未生效 | main_entry.js:338, Spawner.js:59 | spawnRed 时把 `stage.difficulty` 传入 Spawner，主敌人 HP = BASE×maxHpMul×hpMul×stageDifficulty |
| P1-3 | Warhammer 连击不可达 | Character.js:37, balance.js | comboWindow 改为按武器 `weapon.comboWindow`（重锤 1.3s）或 `cooldown+0.1` 动态取值；激活 windup 属性区分起手前摇 |
| P1-4 | 普通格挡无音效 | Character.js:263-282, AudioEngine | 普通格挡分支 emit `EV.FX_BLOCK`（新增）→ main_entry → `audio.playSound('block')` |
| P1-5 | 六大模块 dispose 缺失 | Character/CombatSystem/Scene/Environment/WeatherSystem/Water | 各加 dispose()：遍历释放 geometry/material/texture；spawnAll 重建前调旧实例 dispose |
| P1-6 | 事件监听 + setInterval 泄漏 | Camera/Time/SaveOrchestrator/HUD/UIPanel/UIStack | 各保存 handler 引用 + 加 dispose() 移除；SaveOrchestrator 存 intervalId 并 clearInterval；EventBus 加 clear() |
| P1-7 | Boss 阶段切换断崖 | BossEnemy.js:163-166, 188-204 | 阶段 2 解锁 1 个技能、阶段 3 再解锁 1 个（逐个而非全开）；阶段 3 给各 Boss 类型一个专属新机制 |
| P1-8 | 死代码/死事件清理 | Terrain.js:2, ECS.js, GameState STATE_CHANGE | 删 Terrain→TextureFactory 死导入；删 ECS.js；移除 STATE_CHANGE emit 或补监听 |

### P2 中等（体验提升 / 工程改善，按节奏推进）

| # | 任务 | 要点 |
|---|---|---|
| P2-1 | 教程进阶引导 | 加技能树/词条/锁定/连击 4 个可选步骤，STEP_TIMEOUT 提到 10s，设置菜单加"重置教程" |
| P2-2 | HUD 精简 + 信息补全 | 合并 radar/MiniMap；buff 加倒计时条；Boss 血条加阶段指示器；濒死敌人加图标标记 |
| P2-3 | 结算屏复盘 | 加最大连击/完美格挡闪避/处决/暴击/命中率次数；评级纳入承伤和表现维度；战役隐藏 0:00 用时 |
| P2-4 | 无障碍基础 | 色弱模式（敌我加形状区分）、减少动效开关（关脉冲/震动/hitstop）、屏幕震动强度滑块 |
| P2-5 | 低端机降级 | setQuality('low') 关 SSAO+Bloom；天气粒子/草实例随 quality 缩减；加自适应降帧（帧率<30 连续 N 帧自动降 quality） |
| P2-6 | 每帧分配热点 | Skeleton.js:131 改预分配数组+索引遍历去 new Set；CombatSystem double clone 复用单对象；AIController._calcFlankDir 返回预分配实例 |
| P2-7 | Build 多样性平衡 | 防御分支数值上调（guardian -25%、regen +5HP/s）；RunBuffs 池子扩到 12+，damage 改加法不可无限叠加，加 reroll 机制 |
| P2-8 | 魔法数字收敛 | CombatSystem 阈值/倍率、Camera FOV/shake、处决距离、hitstop 上限等收敛到 balance.js |
| P2-9 | WeaponTrail 跟随武器 | attach 时缓存 weaponMesh，update 改用 weaponMesh.parent.matrixWorld |
| P2-10 | 测试基建 | tests/setup.js 加 Three.js mock（Proxy + 桩几何/材质）；补 CombatSystem/Character/AIController 主路径单测 |

### P3 长线（新增内容/深度，视精力推进）

- Boss 阶段 3 专属机制（behemoth 地震波、mage 陨石、ranger 分身）
- 噩梦新周目加新机制（词条反伤、环境陷阱增强、Boss 新阶段）
- 战役模式接入 RunBuffs 选取（过关 3 选 1）
- 键位重绑系统（输入抽象层 + 设置面板）
- LOD 系统 + 角色批渲染（InstancedMesh）
- 存档版本迁移框架 + 损坏备份恢复

---

## 四、执行约束（沿用第四轮规范）

1. TDD：red→green→全量验证→逐项 commit
2. 英文 commit message，手动验证后 `git commit --no-verify`
3. PowerShell 用 `;` 分隔命令
4. UI 模块不得 import gameplay 模块（仅常量豁免）
5. 同一文件串行编辑，编辑后 Select-String 验证落盘
6. events.js 先加 EV 常量再接线
7. balance.js 收敛魔法数字
8. dispose 链路：spawnAll 重建前调旧实例 dispose
