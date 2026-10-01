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
- **engine**：Renderer（后期管线：SSAO+Reflector 静态 import 修 dist 404、UnrealBloom+暗角 Vignette、low 画质降级关 SSAO/Bloom/Reflector）、Scene（黄昏琥珀调色、远山顶点扰动、Fresnel rim 替固定方向光）、Camera、AssetLoader。
- **world**：Terrain、Environment、Water、WeatherSystem、MapGenerator、SiegeStructure、SupplyPoint。
- **gameplay**：Character 基类（Health/Stamina/Skeleton）→ Player / AIController（→BossEnemy/Cavalry）/ RemotePlayer；CombatSystem、ComboSystem、WeaponSkills、Weapon、weapons/*（Sword/Spear/SwordShield/Warhammer/Bow）；AI 辅助（AIManager、UnitFormation、AffixBehavior）；模式类（GameMode/WaveMode/TrainingMode/CampaignMode）；元进度类（Progression、SkillTree、Affixes、Achievements、WeaponSkins、DailyChallenge、RunBuffs）；SaveManager；战斗辅助（EnvironmentHazards、DifficultyAssist、TrajectoryPreview、EscortTarget、DefensePoint）；Spawner（红队生成）。
- **ui**：HUD、MiniMap、ResultScreen、SettingsMenu、SkillTreeUI、Tutorial、SaveUI、AchievementsUI、AffixesUI、ProgressionUI、WeaponSkinsUI、UIPanel（面板基类）、UIStack（Escape 栈）、UpgradePicker（3 选 1 升级）、DeathFeedback（死亡反馈）。
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
- main_entry 主循环在 `qualityGovernor.tick(dt)` 后立即调用 `hud.updatePerf`，`direction` 区分 `hud.flash` 文案为"画质自动回升至"或"画质自动降至"。
