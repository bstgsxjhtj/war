# 第六轮圆桌讨论：功能复查与体验提升计划

> 日期：2026-09-28 ｜ 参与专家：战斗设计师 / 关卡进度设计师 / UX 设计师 / 性能工程师 / 架构师
> 方法：五维度并行只读调研 → 圆桌交叉评审 → 分级优化计划
> 基线：第五轮 28 个 commit 已合入（823 单测全绿、build 通过）。本轮重点是**复查上轮修复是否闭环 + 挖掘仍存的问题与体验提升空间**。

---

## 一、圆桌讨论纪要

### 战斗设计师（手感 / 判定 / AI 行为）

**严重发现：AI 闪避无 i 帧——闪避仍是原地空翻**
- `AIController.js:178` 设 `_dodgeTimer = 0.3`，但 `_takeDamage`（L75-84）只检查 `_blockTimer` 做 0.3 减伤，**从不检查 `_dodgeTimer`**。玩家闪避有 iFrame（`Character.tryDodge`），AI 闪避只有动画和位移，伤害照吃。第五轮 P1-1 修复了位移被覆盖的问题，但 i 帧对称性被遗漏——AI 的闪避行为对玩家而言依然不可信。

**严重发现：Boss AOE 全部立即结算，无预警、无法闪避**
- `CombatSystem.spawnAoE`（L220-236）在调用帧立即对半径内角色 `takeDamage`。behemoth 的 quake 第一段（`BossEnemy.js:165`）、mage 的 meteor（L174）都是**零帧起手瞬间伤害**，玩家没有任何反应窗口。quake 后两段靠裸 `setTimeout`（L166-167）延迟 300/600ms——**不受 timeScale 影响**（完美闪避慢动作期间照样按真实时间爆炸），且不在 dispose/clear 时清除（Boss 死亡后回调仍可能触发）。`TelegraphIndicator` 只服务于 AI 普攻预警，Boss 技能没有任何地面预警圈。Boss 战的"可规避性"是动作游戏公平感的基石，当前是硬伤。

**体验提升：伤害倍率乘算无上限**
- 连击 tier × counter × backstab × crit × perfectRebound × RunBuffs damage 5 层(+50%) × 技能树 berserk(+25%) 全部乘算，无钳制。理想 build 下单发可秒精英甚至 Boss 阶段，难度曲线被最优解击穿。

**体验提升：AI 状态机单调**
- 追击→攻击→概率闪避/格挡，无"连续被弹反后变招"、"低血量逃窜叫援军"等涌现行为；ranger/mage 型 AI 与近战 AI 行为差异主要在射程而非策略。

### 关卡进度设计师（难度曲线 / Build / 长线激励）

**阻断级发现：P3-2 噩梦新机制全仓无消费者（上轮遗留）**
- `CampaignMode.js:49-51` 生产 `enemyMods`（reflect/vampire/lucky/swift/ironhide）、`hazardBoost`、`bossPhase3` 三个字段，但全仓 grep 确认**仅 4 处引用且全部在 CampaignMode 内部**：Spawner 不读 enemyMods（噩梦敌人从不带词条行为）、EnvHazards 不读 hazardBoost（陷阱不增强）、BossEnemy 不读 bossPhase3（阶段 3 机制靠 Boss 自身 `phase3` 字段）。**噩梦"新周目新机制"是死数据**——第五轮 P3-2 只完成了数据生产端，消费端完全未接线。噩梦周目实际体验与普通模式仅差数值 ×1.35。

**严重发现：战役 10 关目标单一**
- 每关都是"杀光红方"，无限时生存/护点/护送等变奏。工程上 SupplyPoint、攻城机制已存在，但关卡目标类型未做差异化编排。

**体验提升：噩梦词条与玩家词条无行为联动**
- NIGHTMARE_AFFIX_POOL 是字符串标记，即使消费端接线，reflect/vampire 等行为目前在 AffixSystem 中只实现了玩家武器侧——敌人侧需要行为抽象复用，否则接线后仍是空壳。

### UX 设计师（引导 / HUD / 音效 / 无障碍）

**严重发现：键位重绑与教程/提示生态全面脱节（上轮遗留）**
- `Tutorial.js:13-24` 12 步的 `keys:` 数组全部硬编码键码（KeyW/KeyQ/KeyT/KeyE/Tab…），`_onKey`（L45）直接匹配 `e.code`。玩家把 dodge 重绑到 KeyR 后，教程第④步**按 KeyR 永远无法推进——卡死**，且文案仍显示"Q 键"。`main_entry.js:527` 处决提示硬编码"按 E 处决！"，`Tutorial.js:91` 完成条硬编码"Tab 锁定 · Q 闪避 · E 处决"。整个键位提示生态没有一处读 KeyBindings——P3-4 的重绑系统只接通了 Player 输入端，文案端全部失灵。
- UI 快捷键（K 技能树 / I 词条 / M 模式 / N 天气 / Esc）不在 KeyBindings 的 15 个动作内，不可重绑——重绑体系覆盖不完整。

**体验提升：正反馈音效缺口**
- AudioEngine 已覆盖 swing/hit/block/perfectblock/dodge/ultimate/counter/crit/comboTier/bossRoar/execute/achievement，但缺少：拾取（词条/补给）、技能点+1、RunBuff 选取确认、关卡开始号角。爽感链路在"成长确认"环节哑火。

### 性能工程师（帧率 / 内存 / 测试）

**严重发现：LOD 远距隐藏制造"隐形威胁"**
- `LODManager` level≥2 直接 `root.visible = false`。挂在 root 上的 `TelegraphIndicator` 随之消失——**远处正在蓄力攻击的敌人完全隐形**，玩家被看不见的敌人打到。代理 InstancedMesh 也不区分精英（1.15x 缩放/金色）与普通敌人，远距信息丢失。

**体验提升：spawnArrow 残留 per-shot clone**
- `CombatSystem.js:242` `attacker.forward.clone().multiplyScalar(...)` 每次射箭分配 2 个 Vector3（P2-6 漏网）。频率低，属微优化。

**体验提升：LOD tick 每帧全量距离计算**
- 50 角色 × distanceTo/帧 开销虽小，但可降频到 0.25s 间隔，把省下的预算留给实例矩阵更新。

**体验提升：e2e 覆盖薄**
- e2e 仅 `smoke.spec.js` + `scenario.spec.js` 两个文件。键位重绑、存档损坏恢复、战役 3 选 1、LOD 降级等第五轮新系统零 e2e 覆盖。

### 架构师（分层 / 耦合 / 可维护性）

**严重发现：gameplay→app 反向依赖（P3-4 引入的分层债务）**
- `gameplay/Player.js:9` `import { KeyBindings } from '../app/KeyBindings.js'`——gameplay 层向上依赖 app 层；`ui/SettingsMenu.js:3` 同样 import app/KeyBindings。KeyBindings 本质是"纯数据 + localStorage"的输入基础设施，放 app 层导致两层被迫反向依赖。**应下沉到 core 层**（如 `core/input/KeyBindings.js`），与 events.js/storage-keys.js 同级。

**严重发现：main_entry.js 仍 589 行上帝文件**
- 主循环仍承担状态分支/BGM/Boss 血条/天气/网络/攻城/武器轨迹/处决提示/胜负判定等 15+ 职责；30+ 个 `bus.on` 全部内联在入口。第二轮标记"已拆分"的部分又有回潮。

**体验提升：gameplay 层裸 setTimeout 与时间体系脱节**
- BossEnemy quake 的 setTimeout 不走游戏时钟：不随 timeScale 缩放、不随暂停挂起、不随 clear 清理。需要统一的"游戏时钟延迟任务"设施（如 `combat.schedule(delay, fn)`）。

**体验提升：键位抽象未贯通是架构级证据**
- Tutorial 硬编码 code 监听说明"输入抽象层"只做了 Player 一半。action 名（'dodge'）应成为教程、HUD 提示、重绑 UI 的共同语言。

---

## 二、体验总评

| 维度 | 上轮评分 | 本轮评分 | 一句话评价 |
|---|---|---|---|
| 战斗爽快感 | 7/10 | 8/10 | 反馈层保持高水准；Boss 必中 AOE 与伤害上限失控损害公平感 |
| 战斗深度 | 5/10 | 7/10 | 弹反/连击/克制已闭环；AI 闪避无 i 帧是最后一块短板 |
| 难度曲线 | 4/10 | 6/10 | difficulty 已生效，但噩梦新机制全未接线，周目体验与普通雷同 |
| Build 多样性 | 4/10 | 7/10 | 13 buff + reroll + 防御分支可用；乘算无上限催生秒杀最优解 |
| 新手引导 | 5/10 | 6/10 | 12 步覆盖全，但与键位重绑脱节可致玩家卡死 |
| 信息呈现 | 6/10 | 7/10 | buff 倒计时/阶段指示已就位，提示文案不随键位更新 |
| 无障碍 | 2/10 | 6/10 | 重绑/色弱/减动效已落地；UI 快捷键未纳入、教程未贯通 |
| 性能稳定性 | 5/10 | 7/10 | LOD/降帧/dispose 已闭环；远距隐形威胁是体验级 bug |
| 测试覆盖 | 3/10 | 6/10 | 823 单测扎实；e2e 仅 2 spec，新系统零覆盖 |
| 架构健康 | 6/10 | 6/10 | 分层大体清晰；P3-4 引入 gameplay→app 反向依赖，main_entry 仍臃肿 |

**综合**：第五轮"把已有机制做对"成效显著，核心战斗链路全部闭环，综合体验从"广度优秀、深度欠债"提升到"深度基本达标"。第六轮的主题应是**"把系统接通"**：噩梦机制的消费端、键位抽象的教程/HUD 贯通、Boss AOE 的公平性（预警 + 游戏时钟）、AI i 帧对称——多数问题恰是第五轮"只做了一半"的尾巴。

---

## 三、分级优化计划

### P0 阻断级（功能空转/可致卡死，必须立即修）

| # | 任务 | 触点 | 方案要点 |
|---|---|---|---|
| P0-1 | 噩梦 enemyMods/hazardBoost 消费端接线 | Spawner.js:_finalize, EnvHazards.js | Spawner 读 `currentStage.enemyMods` 给敌人挂词条行为（swift=速度×1.2 / ironhide=受伤×0.75 / vampire=攻击吸血 15% / reflect=反弹 10% / lucky=暴击率+15%，实现为 AIController 上的轻量标记+判定钩子）；EnvHazards 读 `hazardBoost` 放大陷阱伤害与触发频率 |
| P0-2 | AI 闪避补 i 帧 | AIController.js:_takeDamage | `_dodgeTimer > 0` 时伤害置 0 并跳过受击硬直（与玩家 iFrame 对称） |
| P0-3 | 教程接入 KeyBindings 防卡死 | Tutorial.js, KeyBindings.js | Tutorial 构造注入 KeyBindings；steps 改为 action 名（'dodge'/'skill'…），监听时 `kb.get(action)` 反查键码匹配；文案按当前键码动态生成（KeyR→"R"） |

### P1 严重（体验公平性/分层健康，优先排期）

| # | 任务 | 触点 | 方案要点 |
|---|---|---|---|
| P1-1 | Boss AOE telegraph 预警 + 延迟结算 | CombatSystem.spawnAoE, BossEnemy, TelegraphIndicator | spawnAoE 增加 `delay` 参数：先显示地面预警圈（复用 TelegraphIndicator 样式），delay 秒后结算伤害；quake 三段与 meteor 全部走该通道，玩家获得可闪避窗口 |
| P1-2 | KeyBindings 下沉 core 层 | core/input/KeyBindings.js（新建路径） | 移动文件消除 gameplay→app / ui→app 反向依赖；main_entry/Player/SettingsMenu 同步改 import；导出与行为不变 |
| P1-3 | 提示文案随键位动态化 | main_entry.js:527, Tutorial.js:91 | 处决提示/教程完成条读取 KeyBindings 反查当前键码并格式化显示（'KeyR'→'R'、'Digit5'→'5'、'ShiftLeft'→'Shift'） |
| P1-4 | LOD 远距隐形威胁修复 | LODManager.js | level≥2 时：正在 telegraph/攻击的角色不降级（保持 root 可见）；精英敌人代理实例用金色材质/更大缩放区分 |

### P2 中等（体验提升/工程改善，按节奏推进）

| # | 任务 | 要点 |
|---|---|---|
| P2-1 | 伤害倍率上限钳制 | balance.js 加 `COMBAT.DMG_MUL_MAX = 6.0`，CombatSystem 近战结算最终倍率 clamp |
| P2-2 | UI 快捷键纳入 KeyBindings | 新增 skilltree(K)/affix(I)/mode(M)/weather(N)/settings(Esc) 5 个动作（默认固定，可重绑）；教程步骤 ⑪⑫ 与 main_entry 快捷键监听同步读 KeyBindings |
| P2-3 | 正反馈音效补齐 | AudioEngine 加 pickup/levelup/buffSelect/stageStart 4 个 WebAudio 合成音效；拾取词条/技能点+1/选 buff/关卡开始四处接线 |
| P2-4 | 战役关卡目标多样化 | 至少 2 种变奏：限时生存关（90s 存活）、护点关（复用 SupplyPoint 占领机制）；CampaignMode stage 配置加 objective 字段，MatchController 判定分支 |
| P2-5 | 游戏时钟延迟任务设施 | CombatSystem（或新 app/GameClock）加 `schedule(delay, fn)`：随 timeScale 缩放、clear 时清理；Boss quake setTimeout 迁移过去 |
| P2-6 | spawnArrow clone 复用 + LOD tick 降频 | spawnArrow 复用 _tmp 向量；LODManager tick 改 0.25s 间隔（内部累积 dt） |
| P2-7 | e2e 覆盖新系统 | 键位重绑流程、存档损坏恢复、战役过关 3 选 1 各加 1 个 spec |

### P3 长线（新增内容/深度，视精力推进）

- main_entry.js 拆分：GameLoop（主循环状态分支）/ EventWiring（30+ bus.on 下沉）/ SpawnFlow（spawnAll 链路）三模块
- AI 涌现行为：连续被完美格挡后变招（拉开距离/叫援军）、低血量逃窜
- 词条行为统一抽象：AffixBehavior 接口，玩家/敌人共用 reflect/vampire/swift 实现（P0-1 的敌人词条行为可演进到此）
- Boss 阶段转换演出：镜头拉近 + 吼叫 + 环境光照变化（复用 bossRoar 音效与 WeatherSystem）

---

## 四、执行约束（沿用第五轮规范）

1. TDD：red→green→全量验证→逐项 commit
2. 英文 commit message，手动验证后 `git commit --no-verify`
3. PowerShell 用 `;` 分隔命令
4. 分层规范：KeyBindings 下沉 core 后，gameplay/ui 只能依赖 core（消除反向依赖）
5. 同一文件串行编辑，编辑后 Grep/Select-String 验证落盘
6. events.js 先加 EV 常量再接线；storage-keys.js 先加 LS 常量再使用
7. 魔法数字收敛 balance.js
8. 延迟任务统一走游戏时钟设施，禁止 gameplay 层新增裸 setTimeout
