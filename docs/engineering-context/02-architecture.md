# 02 · 架构文档

## 1. 分层与依赖方向

```
main_entry.js（组合根 / composition root）
   ├── app/         → 组合根辅助：MatchController（比分/回合/胜负）、SaveOrchestrator（存档编排）、InputRouter（全局按键）、GameClock（随 timeScale 缩放的延迟任务）、EventWiring（17 个纯事件处理器下沉）；依赖 core/gameplay/world/ui
   ├── ui/          → 单向依赖 gameplay（仅引用常量/数据类）
   ├── gameplay/    → 可依赖 core、render 的纯工厂/特效接口（显式例外）
   ├── world/       → 依赖 core（bus）；纹理由组合根经 opts.textures 注入（✅2026-09-22 移除 render 依赖）
   ├── engine/      → 依赖 render
   └── core/        → EventBus / GameState / Time / input/KeyBindings，不依赖任何上层
net/ audio/ render/ 为基础设施，被上层使用。
ESM 依赖图必须保持无环（DAG）。
```

## 2. 模块职责

- **core**：EventBus（on 返回 off 函数）、GameState 状态机、Time 主循环、input/KeyBindings（20 动作可重绑 + 冲突检测 + localStorage 持久化，纯数据输入基础设施）、constants/events（EV，50 个 bus 事件）、constants/storage-keys（LS，14 个键）、constants/balance（WEAPON_STATS/COMBAT/CAMERA/EXECUTE/POSTURE/ENEMY_MODS）。ECS.js 当前未被使用（保留待决）。
- **engine**：Renderer（后期管线：SMAA 后处理 AA 替无效 MSAA renderer flag、SSAO+Reflector 静态 import 修 dist 404、UnrealBloom+暗角 Vignette、low 画质降级关 SSAO/SMAA/Bloom/Reflector）、Scene（黄昏琥珀调色、远山顶点扰动、Fresnel rim 替固定方向光）、Camera、AssetLoader。
- **world**：Terrain、Environment（树/石/残骸均 InstancedMesh：树 1 trunk + 3 leaf InstancedMesh 共 4 drawcall 替代 ~136、石 1 drawcall 替代 24、残骸≤2 drawcall 替代 16；草 6 InstancedMesh 已有）、Water、WeatherSystem、MapGenerator、SiegeStructure、SupplyPoint。
- **gameplay**：Character 基类（Health/Stamina/Skeleton，非本地角色 skeleton.update 降频至 30fps）→ Player / AIController（→BossEnemy/Cavalry）/ RemotePlayer；CombatSystem、ComboSystem、WeaponSkills、Weapon、weapons/*（Sword/Spear/SwordShield/Warhammer/Bow）；AI 辅助（AIManager、UnitFormation、AffixBehavior）；模式类（GameMode/WaveMode/TrainingMode/CampaignMode）；元进度类（Progression、SkillTree、Affixes、Achievements、WeaponSkins、DailyChallenge、RunBuffs）；SaveManager；战斗辅助（EnvironmentHazards、DifficultyAssist、TrajectoryPreview、EscortTarget、DefensePoint）；Spawner（红队生成）。
- **ui**：HUD、MiniMap、ResultScreen、SettingsMenu、SkillTreeUI、Tutorial、SaveUI、AchievementsUI、AffixesUI、ProgressionUI、WeaponSkinsUI、UIPanel（面板基类）、UIStack（Escape 栈，支持 closable=false 不可关面板）、UpgradePicker（3 选 1 升级）、DeathFeedback（死亡反馈）、MainMenuUI（标题屏）、StageSelectUI（选关/地图）、ClassSelectUI（职业选择）、GameMenu（Esc 菜单）。
- **render**：TextureFactory（程序纹理 canvas 缓存）、disposeUtils、WeaponTrail、DodgeGhosts、EnvMap、LODManager、ParticleFX、TelegraphIndicator。
- **app**：MatchController（比分/回合/胜负）、SaveOrchestrator（存档编排）、InputRouter（全局按键）、GameClock（随 timeScale 缩放的延迟任务）、EventWiring（17 个纯事件处理器下沉）、AchievementWiring（成就接线）、QualityGovernor（自适应画质：双向——持续低帧率降级 + 持续高帧率回升，回升不越过用户设定 ceiling；tick 返回新档位与 direction 标志）。

## 3. 运行期解耦

模块间通过字符串事件（`域.动作`，如 `combat.hit`、`fx.shake`）在 EventBus 上通信，约 50 个事件名（全部常量化于 `core/constants/events.js`）。事件契约见 05-conventions.md。

## 4. 已知架构债（按优先级）

1. ~~**main_entry.js 上帝文件**~~（✅2026-09-21 偿还）：三步拆分完成——
   ① `app/MatchController`（比分/回合/checkWin/startRound/restart + 战役目标状态字段）
   ② `app/SaveOrchestrator`（capture/reset/applyOnBoot/tickPlayTime/startTimers）
   ③ `app/InputRouter`（R/M/,/C/D/N/Escape + 音频解锁）。main_entry 仅剩组合根装配、spawnAll/spawnRed 与主循环；跨模块可变状态（player/ais/mode）经 getter/setter 回调注入。
   ④ `gameplay/Spawner`（✅2026-09-22 下沉）：红队兵种生成（Boss/精英/骑兵门槛、武器轮换、阵型编排）与战役增援 spawnReinforce 收进 Spawner，精英技能随机逻辑去重；main_entry 的 spawnRed 只剩一行委托。
   ⑤ `app/AchievementWiring`（✅2026-09-22 下沉）：成就 10 触发源 check + 解锁奖励分发 + 词条掉落提示收敛为 wireAchievements(bus, deps)，晚绑定依赖经 getter 注入。
2. ~~**持久化双轨**~~（✅2026-09-21 偿还）：SaveManager（savegame_v1）成为游戏进度唯一事实来源；Progression/SkillTree/CampaignMode/Achievements/Affixes/DailyChallenge/WeaponSkins 七模块停止自写旧键，改为 serialize/restore 由 SaveOrchestrator 统一采集与恢复；6 个旧键（campaign_cleared/progression_v1/skilltree_v1/achievements/affixes/daily_challenge/weapon_skins）在首次启动一次性迁移后删除。保留独立键：settings/audio_volume/tutorial_done/skilltree_profile_*（UI/音频偏好与多档位特性）。
3. ~~**UI 类错位**~~（✅2026-09-21 偿还）：ProgressionUI 与 WeaponSkinsUI 从 gameplay/ 抽出至 `ui/ProgressionUI.js`、`ui/WeaponSkinsUI.js`，gameplay 层只留领域模型；ui/ 单向依赖 gameplay（仅引用 SKINS 等常量/数据类）的约定现对全部 UI 一致。
4. ~~**依赖注入不统一**~~（✅2026-09-21 偿还）：约定落地到 05 §6——必选依赖（bus）走构造、可选依赖（audio/affixes）走 setter、总线属性统一 `_bus`；DailyChallenge/Achievements 改为构造注入 bus（顺带修复 DailyChallenge 未传 bus 导致 `daily.completed` 事件死掉的 bug），Player 4 处 emit 统一 `_bus`。Character 群"注册时注入"为显式例外。
5. ~~**监听器生命周期**~~（✅2026-09-21 偿还）：bus.on 返回 off、跨回合监听集中 bootstrap 顶层、spawnAll/spawnRed 内禁注册常驻监听——三条款经查均已满足（Player.dispose #8、死事件 #12 先前已修）；本轮落地 05 §7 约定 + 回归守卫（tests/core/listener-lifecycle.test.js 大括号匹配提取 spawnAll/spawnRed 函数体断言无 bus.on）。调查中发现并修复一无关次要缺陷：combat.kill 的 ultimate 音效在 main_entry 与 MatchController 各播一次，已去重（保留 main_entry 进度处理器一处，MatchController 移除 audio 依赖）。
6. ~~**gameplay/ui→app 反向依赖（KeyBindings 错位）**~~（✅2026-09-28 偿还，Round 6 P1-2）：KeyBindings 原放 `app/` 层，导致 `gameplay/Player.js`、`ui/SettingsMenu.js`、`ui/Tutorial.js` 被迫向上反向依赖 app 层。已下沉至 `core/input/KeyBindings.js`（与 events.js / storage-keys.js 同级，"纯数据 + localStorage" 输入基础设施归 core）；main_entry / Player / SettingsMenu / Tutorial 同步改 import；导出与行为不变。新增架构守卫 `tests/core/input/KeyBindings.architecture.test.js` 锁定 gameplay 层与 ui 层不再 import 任何 `app/` 模块（扫描 src/gameplay 与 src/ui 全树）。
7. **main_entry 拆分（P3-1，2026-09-29）**：沿用 `wireAchievements` 模式新增 `app/EventWiring.js` 的 `wireCoreHandlers(bus, deps)`，将 17 个无 mutable-local 依赖的纯事件处理器（FX_PERFECTBLOCK/FX_BLOCK/FX_PERFECTDODGE/COMBAT_HIT/COMBAT_KILL×3/COMBAT_EXECUTE/SETTINGS_DIFFICULTY×2/SETTINGS_SHAKE_INTENSITY/HUD_BOSSPHASE/FX_BOSSROAR/FX_DODGE/COMBAT_ULTIMATE/COMBAT_COUNTER/COMBO_TIER）从 main_entry 下沉；main_entry 从 594 行降至 538 行。余下 7 个引用 mutable let 绑定（player/ais/enemies/terrain/_colorblind/_reducedMotion）或位于条件块（net）的处理器（BOSS_SUMMON/SETTINGS_QUALITY/SETTINGS_SENSITIVITY/SETTINGS_COLORBLIND/SETTINGS_REDUCED_MOTION/COMBAT_HIT-net/SKINS_CHANGED）仍留在 main_entry，待引入 getter/setter 统一后再全量下沉。GameLoop（主循环）与 SpawnFlow（spawnAll 链路）因与每帧/每局 mutable 状态深度耦合，本轮暂不提取。P3-4（2026-09-29）扩展 HUD_BOSSPHASE 处理器，新增 `weather` 依赖（按 phase 调 `weather.setMode` 切环境光照）；Camera 同期新增自订阅 `bus.on(HUD_BOSSPHASE)` 收缩 FOV（balance.js `FOV_BOSS_PHASE2/3`）。

## 5. 组合根规则

- main_entry 是唯一装配点；新增系统的实例化、事件接线、按键绑定都在此完成。
- UI 面板按键惯例：面板组件在 `document` 上自监听 keydown（KeyI/J/V/H），main_entry 的 window handler **不得重复绑定**同一键（会双 toggle 抵消）。

## 6. LOD 可见性规则（P1-4，2026-09-28）

`render/LODManager` 按相机距离分 4 级（0 全显 / 1 藏装饰 / 2 藏 root 用代理胶囊 / 3 完全隐藏）。远距角色原本统一降为灰色 InstancedMesh 代理，导致两个体验级问题，已修复：

- **远距隐形威胁**：`_isThreat(char)` 判定角色是否正在 `char._attacking`（攻击中）/ `char._windupTimer > 0`（AI telegraph 前摇）/ `char._chargeState ∈ {'windup','charge'}`（骑兵冲锋）。命中任一即把 `effectiveLevel = min(level, 1)`——root 保持可见，telegraph/武器动画不再被代理胶囊吞掉，玩家可看到远距来袭；威胁解除后恢复按距离降级到 proxy。
- **精英代理区分**：proxy 基础材质改为白色（`0xffffff`）以承载 `instanceColor`——普通敌人 `setColorAt(灰 0x888888)`、精英（`char._isElite`，含 Boss）`setColorAt(金 0xffd070)` 且矩阵缩放 `1.3×`，远距一眼可辨威胁等级。每帧 `instanceColor.needsUpdate` 与 `instanceMatrix.needsUpdate` 同步。
- **tick 降频（P2-6）**：`tick(dt)` 内部累积 dt 到 `_accumDt`，未达 0.25s 间隔直接返回，达到后才执行一次完整距离/降级/proxy 写入，减少每帧全量遍历开销。无参 `tick()`（旧调用约定）跳过节流立即执行，保持向后兼容。

## 7. 箭矢对象池（P2-6，2026-09-29）

`CombatSystem` 发射箭矢（`spawnArrow` / `spawnPierceArrow`）原每次 `new THREE.Mesh` + `Vector3.clone()` 分配，高频战斗下产生 GC 压力。改为池化：

- `_acquireArrow()`：从 `_arrowPool`（上限 64）弹出复用对象，池空时新建；mesh 为空时才创建并设 `castShadow`；`scene.add(mesh)` 后返回。每个池对象自带 `pos`/`vel` 两个 `Vector3`，发射时 `pos.copy(_tmpOrigin)`、`vel.copy(forward)`，不再 `.clone()`。
- `_releaseArrow(a)`：`scene.remove(mesh)` 后压回池（超上限则丢弃，让 GC 回收）。
- 复用时重置状态字段：普通箭 `pierce=0 / hitSet=null`；穿刺箭 `pierce=PIERCE_ARROW_PIERCE / hitSet=new Set()`，避免上一支箭的穿透命中集合残留。

## 8. 自适应画质双向调节 + 性能 HUD（P0-1，2026-10-01）

**QualityGovernor 双向化**：原实现仅降级（持续低帧率下调一档），低端机一旦降级永不回升。改为双向：

- **降级**：连续 `slowFrames`（90）帧 FPS < `slowFps`（30）→ 下调一档。
- **回升**：连续 `recoverFrames`（240）帧 FPS ≥ `recoverFps`（55）→ 上调一档，**但不超过 `_ceiling`**（用户/启动时 `setQuality` 设定的档位），避免与用户显式选择冲突。
- 冷却期（`cooldownFrames` 300）对降级与回升均生效，避免抖动；触发任一方向后重置计数与冷却。
- `tick()` 返回新档位或 `null`；`direction` getter 暴露 `'down'`/`'up'`/`null`，供调用方区分提示文案。
- `setQuality(q)` 同时抬升 `_ceiling = q`，用户在设置面板手动选档后，自动回升上限随之调整。

**HUD 性能面板（F4）**：左上角诊断叠层，默认关闭。

- `togglePerf()` 切换可见性；`updatePerf(dt, info)` 每帧由 main_entry 主循环调用（含菜单/结算态）。
- 显示：FPS（指数平滑 `0.9*旧+0.1*新`）、帧时 ms、Min/Max（每刷新周期重置）、drawcall（`renderer.webgl.info.render.calls`）、三角面（k）、画质档位（低/中/高）、单位数。
- 关闭时 `updatePerf` 仅做 FPS 采样（供下次开启即有值）不写 DOM；开启时 0.25s 节流刷新 `textContent`，避免每帧 DOM 写入。
- main_entry 主循环在 `qualityGovernor.tick(rdt)` 后立即调用 `hud.updatePerf`，`direction` 区分 `hud.flash` 文案为"画质自动回升至"或"画质自动降至"。
- **战役一#1 真实帧间隔接线**：governor/perf 在 `onRender(alpha, rdt)` 回调中调用（每真实渲染帧一次），喂 `rdt`（Time 测的真实墙上帧间隔），而非旧接线的 `onFixed(fixedStep)`（恒为 1/60 → fps 恒 60 → 自适应降级/回升全失效）。`Time.tick(onFixed, onRender)` 的 `onRender` 签名扩展为 `(alpha, delta)`，delta 为 clamped 真实帧间隔。逻辑更新（env/AI/战斗）仍在 `onFixed(fixedStep)` 保证确定性。

## 9. 环境物 InstancedMesh（P0-2，2026-10-01）

`Environment` 的树/石/残骸原为 per-item `Group`/`Mesh`，数百 drawcall 浪费。改为 InstancedMesh：

- **树**（`_scatterTrees`）：1 trunk `InstancedMesh`（CylinderGeometry）+ 3 leaf `InstancedMesh`（每层 ConeGeometry 一份，共享 white base material + `setColorAt` per-instance 从 3 色随机取一）。34 棵树从 ~136 drawcall 降至 4。`_collidables` 碰撞体保持 `r: 0.6 * scale`。
- **石**（`_scatterRocks`）：1 `InstancedMesh`（unit DodecahedronGeometry(1,1) + per-instance scale）。24 石从 24 drawcall 降至 1。`s > 0.8` 的碰撞体保持。
- **残骸**（`_wreckage`）：预分盾/矛两类，各建一个 `InstancedMesh`（≤2 drawcall 替代 16）。
- 矩阵用共享 `dummy` Object3D 组装（position + rotation + scale → `updateMatrix` → `setMatrixAt`），`instanceMatrix.needsUpdate` 末尾统一置位。
- `setQuality` 仍只缩放 grass/dust/leaves 计数（结构物树/石/残骸 count 不随画质变化，避免 popping）；`deepDispose` 遍历 group 自动释放 InstancedMesh 几何/材质/实例缓冲。

## 10. 主菜单标题屏 + UIStack closable（P1-1，2026-10-01）

启动流程原为 `classSelectUI.show()` 直入职业选择，无标题屏。改为 `MainMenuUI.show()` 作为首个面板，选择后进入职业选择：

- **MainMenuUI**（`src/ui/MainMenuUI.js`）：全屏标题叠层，4 按钮——开始新游戏（`campaign.reset()` 保留 cleared 存档解锁进度 + `applyModeByName('战役')` 载入第 1 关地图 + `classSelectUI.show()`）、继续战役（存档存在时可用，`applyModeByName('战役')` 恢复 campaign.stage + `classSelectUI.show()`）、快速对战（保持当前/默认模式直接 `classSelectUI.show()`）、设置（`settings.show()` 叠于标题屏之上）。
- **存档检测**：`hasSave: () => !!saveManager.load()` 决定"继续战役"禁用态；`getCampaignStage`/`getCampaignCleared` 在按钮文案显示"第X关"/"已通关X关"。
- **UIStack closable 扩展**：`installUIStackEscape` 的捕获阶段 Escape 处理器在 `e.preventDefault() + e.stopImmediatePropagation()` 之后检查 `top.closable === false`——若不可关则直接 return（Escape 已被吞掉、不泄露到 InputRouter，但面板保持打开）。MainMenuUI 设 `closable = false`，避免标题屏被 Esc 关闭后无路可走；SettingsMenu 叠于其上时 Esc 正常关闭 SettingsMenu（栈顶 closable 未设，默认可关）。现有面板不设 closable 属性（`undefined === false` 为 false），行为完全向后兼容。
- **模式切换时机**：`applyModeByName('战役')` 内部 `match.restart() → startRound() → spawnAll()`，在 `classSelectUI.show()` 前以默认职业生成实体；职业选择回调再次 `spawnAll()` 覆写为所选职业。叠层覆盖画面，用户不可见中间态。

## 11. 选关/地图面板（P1-2，2026-10-01）

`StageSelectUI`（`src/ui/StageSelectUI.js`）：双 tab 面板，由主菜单"选关/地图"按钮进入，`onBack` 返回主菜单。

- **战役选关 tab**：从 `CampaignMode.STAGES`（10 关）生成卡片网格，每卡显示关名/地图名（`MapGenerator.MAPS[mapKey].name`）/天气/目标/难度星条。`refresh()` 按 `getCleared()` 标记 `index > cleared` 的关卡为锁定（半透明 + `cursor: not-allowed` + `dataset.locked='1'`）。点击已解锁关卡 → `campaign.skipTo(index)` + `applyModeByName('战役')` + `classSelectUI.show()`。
- **自由对战 tab**：难度 3 档按钮（简单/普通/困难，`getDifficulty` 高亮当前）+ 8 地图卡片网格（`MapGenerator.MAPS` 全量）。难度切换 → `settings.difficulty = level` + `bus.emit(SETTINGS_DIFFICULTY)`（与 SettingsMenu 同一事件，EventWiring 已处理 `assist.setBaseLevel` + `aiManager.setDifficulty`）。地图点击 → `loadMap(mapKey)` + `classSelectUI.show()`（保持当前模式，用户可 Esc 切模式）。
- **面板返回语义**：`_selecting` 标志区分选择态与关闭态——`hide()` 在 `_selecting=false` 时调 `onBack`（Esc 关闭或返回按钮触发），`_selecting=true` 时跳过（已选关/地图，由回调自行转场 classSelectUI）。面板可关（closable 未设，默认可关），Esc 经 UIStack 关闭后自动 `onBack` 回主菜单。

## 12. 菜单统一视觉 + 次级入口（P1-3，2026-10-01）

- **视觉统一**：ClassSelectUI 遮罩背景从 `rgba(8,12,18,0.92)` + `fontFamily: sans-serif` 对齐为 `rgba(6,9,14,0.94)` + `Segoe UI, sans-serif`（与 MainMenuUI/StageSelectUI/GameMenu 一致）；卡片背景从 `rgba(20,28,40,0.85)` 对齐为 `rgba(30,40,55,0.9)`（与 StageSelectUI 卡片一致）。全部菜单面板现共用同一套色板：遮罩 `rgba(6,9,14,0.9x)` / 面板 `#161c26` / 边框 `#3a4a60` / 文字 `#e0d8c8` / 强调金 `#e0b050`+`#ffd070` / 字体 `Segoe UI, sans-serif`。
- **次级入口**：MainMenuUI 主按钮列下方新增次级按钮行——成就 / 词条 / 存档。与"设置"按钮同模式：不隐藏标题屏，面板（AchievementsUI/AffixesUI/SaveUI，均 UIPanel 子类）经 `show()` 压入 UIStack 叠于标题屏之上；Esc 经 UIStack 先关栈顶面板（closable 未设，默认可关），再关标题屏（closable=false 吞 Esc 不关）。回调 `onOpenAchievements/onOpenAffixes/onOpenSave` 在 main_entry 分别委托 `achievementsUI.show()/affixesUI.show()/saveUI.show()`（三者已在 L419-420/L280 构造）。

## 13. SMAA 抗锯齿 + AI 动画降频（P2，2026-10-01）

**SMAA 替无效 MSAA**：`WebGLRenderer({ antialias: true })` 的 MSAA 在 EffectComposer 管线下无效——composer 将场景渲染到非多重采样 render target，renderer 层的 MSAA 从不生效。改为后处理形态学 AA：

- `Renderer` 构造 `antialias: true` → `antialias: false`（关闭无效的 renderer MSAA flag）。
- `setup()` 在 `RenderPass` 之后、`SSAOPass` 之前插入 `SMAAPass`（`three/examples/jsm/postprocessing/SMAAPass.js`）——对原始渲染边沿做形态学 AA，紧跟 RenderPass 保证作用于未降采样画面。`this._smaa` 缓存实例引用。
- `setQuality(q)` 低画质关闭 SMAA（`this._smaa.enabled = !low`），与 SSAO/Bloom 同列降级；中/高画质保持开启。
- SMAA 不可用（import/构造异常）时 try/catch 降级为无 AA，不阻断管线。

**AI 动画降频**：`Character._tickAnimState` 原每帧每角色调 `skeleton.update(dt)` 更新骨骼矩阵，战场多 AI 时为纯 CPU 开销。改为分档：

- 构造时 `isLocal ? 0 : 1/30` 设 `_animInterval`（本地玩家=0 满帧保证输入响应；非本地 AI=1/30 即 30fps）。
- `_tickAnimState` 中非本地角色累积 `dt` 到 `_animAccum`，未达 `_animInterval` 早返回（姿态保持上一帧，30fps 仍视觉流畅），达阈值才调 `skeleton.update(累积dt)` 并清零。`skeleton.applyState`（姿态计算）与 `_tickFace`（表情）每帧执行不受影响——只降频骨骼矩阵写入。
- 本地玩家走 else 分支每帧 `skeleton.update(dt)`，响应不受降频影响。

## 14. 菜单暂停闸门 + installUIStackEscape 幂等修复（C1-6，2026-10-01）

**暂停闸门**：打开任何菜单面板时冻结 gameplay（AI/战斗/玩家更新全跳过），仅保留环境氛围动画。

- **UIStack `pausing` getter**：`_stack.some(p => p.pausesGame)`——栈中任意面板 `pausesGame=true` 时返回 true。
- **pausesGame 属性**：`UIPanel` 子类构造默认 `this.pausesGame = true`（成就/词条/存档/皮肤）；`GameMenu`/`SettingsMenu`/`SkillTreeUI` 显式设 `this.pausesGame = true`。`UpgradePicker` 不设（已有独立的 `upgradePicker.visible` 早返回路径）。
- **main_entry 暂停闸门**：`onFixed` 回调中，`upgradePicker.visible` 检查之后、`combat.hitstop` 之前，插入 `if (UIStack.pausing) { env.update(dt, now); return; }`——跳过 gameplay 更新但保留环境动画（云/雾漂移）。

**installUIStackEscape 幂等修复**：vitest `singleFork: true` 下模块在测试文件间重新求值（产生新 `UIStack` 对象 + 新 `_escapeHandler` 闭包），但 `window` 不重建——旧监听器仍留在 window 上且闭包捕获了旧 `UIStack`。旧监听器先触发（捕获阶段、先注册）时若旧栈非空调 `stopImmediatePropagation`，新监听器永远不执行 → 测试失败。

- **解法**：监听器只安装一次（`window._uiStackEscapeInstalled` 幂等标志），监听器内部通过 `window._uiStack` 动态读取当前 `UIStack` 引用（每次 `installUIStackEscape` 调用时更新 `window._uiStack = UIStack`）。单一监听器始终看到最新模块的 UIStack，跨模块重求值安全。
- 生产环境：模块只求值一次，`installUIStackEscape` 只调用一次，行为与原 `_installed` 标志等价。

## 15. 会话闭环：结算屏三键 + 退出到主菜单（C1-7，2026-10-01）

**结算屏三键**：`ResultScreen` 原仅一个"继续 (R)"按钮，`hide()` 自动 `emit(ROUND_RESTART)` → 只能重开。改为三按钮 + `hide()` 不再 emit：

- **重试 (R)**：`this.hide(); bus.emit(ROUND_RESTART)` ——与原行为等价，KeyR 快捷键同效。
- **换模式**：`this.hide(); opts.onChangeMode()` ——关闭结算屏后打开 GameMenu（不 emit ROUND_RESTART，用户选模式后 `match.restart()` 自然重置）。
- **回主菜单**：`this.hide(); opts.onExitToMenu()` ——关闭结算屏后显示 MainMenuUI。
- `hide()` 仅做 UIStack.remove + 移除 keyHandler，不再 emit。ROUND_RESTART 由重试按钮/KeyR 显式触发。
- `constructor(bus, opts = {})` 新增第二参数 `opts`（`onChangeMode` / `onExitToMenu`），向后兼容（默认 `{}`）。

**GameMenu 退出到主菜单**：操作行下方新增全宽按钮"退出到主菜单"（`data-action="exit"`），回调 `opts.onExitToMenu`。main_entry 中 `onExitToMenu: () => { gameMenu.hide(); mainMenuUI.show(); }`——关闭 Esc 菜单后显示标题屏，`UIStack.pausing` 仍为 true（MainMenuUI.pausesGame=true），gameplay 冻结。

**MainMenuUI pausesGame**：标题屏增设 `this.pausesGame = true`。从结算屏/GameMenu 回主菜单时，gameplay 立即冻结（AI/战斗/玩家更新全跳过）。从主菜单开始新游戏时 `mainMenuUI.hide()` → `UIStack.pausing = false` → `applyModeByName` → `match.restart()` → `startRound()` → `state.transit(PLAYING)`，gameplay 恢复。

## 16. 纹理实例缓存消除换波 GPU 尖峰（C1-8，2026-10-01）

**问题**：`Character._build()` 每个角色创建 3 个 `THREE.CanvasTexture`（armor 的 map/normalMap/roughnessMap，经 `TextureFactory.noise/normal/rough`）。`TextureFactory` 原仅缓存 `<canvas>` 元素（`_canvasCache`），但每次调用 `new THREE.CanvasTexture(canvas)` 创建新包装 → 首次渲染触发 GPU `texImage2D` 上传。换波时 N 个角色同步构造 → 3N 次 GPU 上传 → 帧尖峰。

**解法**：`TextureFactory` 新增 `_textureCache` Map，按参数键缓存 `CanvasTexture` 实例。同一参数只创建一次纹理 → GPU 只上传一次。`noise` 的纹理键含 `repeat`（canvas 键不含，canvas 不受 repeat 影响）。

- **共享标记**：缓存纹理设 `t._shared = true`。`disposeUtils.disposeMaterial` 检查 `!t._shared` 跳过 dispose——角色 dispose 后其他角色仍引用同一纹理。
- **deepDispose 安全**：`deepDispose` 遍历材质时，`_shared=true` 的纹理不被 dispose；`_shared` 未设（falsy）的纹理照常 dispose（向后兼容）。
- **缓存生命周期**：`_textureCache` 为模块级 Map，无淘汰策略。实际键数极少（noise 256x256 #4a4a4a amp18 r4 × 1、normal 256x256 0.4 × 1、rough 256x256 0.5 × 1、terrain noise × 2、boss noise 128x128 × 1、brick 256x256 × 1 ≈ 7 条），内存可忽略。
