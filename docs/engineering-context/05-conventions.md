# 05 · 工程约定

## 1. 事件命名

格式 `域.动作`：`combat.hit`、`combat.kill`、`fx.shake`、`settings.quality`、`hud.flash`、`daily.update`、`skins.changed`、`campaign.nightmare_clear`……
禁止发射无监听者的事件；新增事件需在本文件登记 payload 契约。
**事件名常量化**：全部 bus 事件名收敛于 `src/core/constants/events.js`（`EV.XXX`，当前 50 个事件），代码中禁止再写事件名字符串字面量。

## 2. localStorage 键登记

**键名常量化**：全部 localStorage 键收敛于 `src/core/constants/storage-keys.js`（`LS.XXX`，当前 14 个键），代码中禁止再写键名字符串字面量。

| 键 | 属主 |
|---|---|
| savegame_v1 | SaveManager（游戏进度唯一事实来源：mode/stage/campaignCleared/progressionFull/score/kills/bestGrade/affixSlots/affixInventory/skillPoints/skillTree/achievements/daily/skins/playTime） |
| savegame_v1_bak | SaveManager（损坏备份恢复） |
| ~~progression_v1 / skilltree_v1 / campaign_cleared / achievements / affixes / daily_challenge / weapon_skins~~ | 旧键，仅启动时一次性迁移到 savegame_v1 后删除 |
| settings | SettingsMenu（UI 偏好，独立保留） |
| keybindings | KeyBindings（键位重绑，独立保留） |
| audio_volume | AudioEngine（音量，独立保留，05 §5 "音量只留 AudioEngine 一处"） |
| tutorial_done | Tutorial（一次性引导标志，独立保留） |
| skilltree_profile_* | SkillTree（多档位技能方案，独立保留） |
| wave_best | WaveMode（波次/无尽模式历史最高波数，独立保留） |

## 3. 测试规范

- vitest node 环境默认；DOM 测试加 `// @vitest-environment jsdom`。
- tests/setup.js 提供 localStorage mock，beforeEach 注入。
- TDD：先写失败测试 → 实现 → 通过 → commit。
- 全量验证命令：`npm test`（vitest run）、`npm run build`、Playwright 冒烟（e2e/smoke.spec.js）。

## 4. 提交规范

- 每 Task 独立 commit，中文提交信息；pre-commit hook 自动跑 build + 全量 vitest，禁止 --no-verify。
- PowerShell：不支持 `&&`（用 `;`）；git commit 输出重定向 `*> c.txt 2>&1` 后删 c.txt。

## 5. 代码风格

- 私有字段 `_` 前缀仅为约定，禁止外部穿透（反例：`player._weaponMesh`）。
- 面板字段命名、toggle/show-hide 风格向多数派看齐。
- 事件名/存储键字符串已常量化（`core/constants/events.js`/`storage-keys.js`，见 §1/§2）；魔法数字（平衡数值/伤害/冷却）收敛待后续。

## 6. 依赖注入

- **必选依赖走构造函数**：构造时即需的依赖（如 `bus`——用于 emit/listen 的 EventBus）必须经构造函数注入，不得用 setter 后补。此类依赖在构造完成即可用，避免"忘 setter → 事件不发射"的隐性 bug（2026-09-21 修复 DailyChallenge 此类 bug）。
- **可选依赖走 setter**：运行时才配置、或可为 null 的依赖（如 `audio`/`affixes`——缺失时降级）用 setter，构造时置 null。
- **总线属性统一 `_bus`**：所有持有 EventBus 的类用 `this._bus`（非 `this.bus`），保持全仓命名一致。
- **Character 群的 bus 注入例外**：Character 基类不强制构造 bus（敌人由 spawnAll 创建后经 `CombatSystem.register` 注入）；Player/AIController/RemotePlayer 等在自身构造调用 `this.setBus(bus)`。这是"注册时注入"的显式例外，不算违规。
- **不得同时暴露构造与 setter 两套必选注入**：选其一，避免双真相。

## 7. 监听器生命周期

- **bus.on 返回 off**：`EventBus.on(event, handler)` 返回取消函数 `() => bus.off(event, handler)`；需在非启动期移除的监听必须捕获该返回值。启动期常驻监听（bootstrap 一次注册、随页面生命周期存在）可不捕获。
- **跨回合监听集中在 bootstrap 顶层**：跨回合的 bus 监听必须集中在 main_entry bootstrap 顶层一次注册，handler 通过闭包引用 `player`/`ais`/`mode` 等 `let` 变量（重新赋值后闭包见最新值），无需每回合重注册。
- **spawnAll / spawnRed 内禁止注册常驻监听**：每回合重建的函数体内不得调用 `bus.on`，否则监听随回合数线性累积导致事件重复处理。回归守卫见 `tests/core/listener-lifecycle.test.js`（大括号匹配提取函数体，断言无 `bus.on(`）。
- **每回合重建对象的 document/window 监听必须随 dispose 清理**：如 Player 构造注册 8 个输入监听，`Player.dispose()` 逐条 `removeEventListener` 并清空 `_handlers`；spawnAll 重建 Player 前必先 dispose 旧实例（已实现，回归守卫见 `tests/gameplay/Player.dispose.test.js`）。
- **UI 面板的 document 监听**：面板（SkillTreeUI/AffixesUI/AchievementsUI/WeaponSkinsUI/SaveUI/HUD/Tutorial/ResultScreen）在构造注册 document/window keydown，因面板仅 bootstrap 创建一次，无累积风险；后续若引入可销毁面板，须补 dispose。
