# 04 · 页面设计

## 1. 界面清单

| 界面 | 触发 | 说明 |
|---|---|---|
| HUD | 常驻 | 血条/体力/怒气/比分/小地图/击杀提示；暴露 flash()/flashKill() 方法 |
| HUD 性能面板 | F4 | 左上 FPS/帧时/Min/Max + drawcall/三角面/画质档位/单位数；HUD.togglePerf/updatePerf，默认关闭，0.25s 节流刷新 |
| HUD 错误面板 | F3 | 右上错误计数 + 最近 10 条 ENGINE_ERROR 日志；HUD._errEl/_errPanel |
| 设置菜单 | Esc | SettingsMenu |
| 技能树面板 | K | SkillTreeUI |
| 成就面板 | J | AchievementsUI |
| 词条面板 | I | AffixesUI |
| 皮肤面板 | V | WeaponSkinsUI |
| 存档面板 | H | SaveUI（#save-panel，右上 fixed，含 #save-info/#save-now/#save-reset） |
| 结算界面 | 回合结束 | ResultScreen（评级统一用 gradeOf） |

## 2. 按键映射（全局唯一，新增按键前必须查此表）

**KeyBindings 可重绑（20 动作，DEFAULT_BINDINGS）**：W/A/S/D（移动）、Shift（冲刺）、Space（跳跃）、Q（闪避）、F（技能）、T（大招）、E（处决）、Tab（锁定）、1/2/3/4（武器切换）、K（技能树）、I（词条）、M（模式）、N（天气）、Escape（设置）。

**InputRouter 硬编码**：R（重开/下一回合）、`,`（切图）、C（战役信息）、D（每日挑战进度）。

**面板自监听**：J（成就 AchievementsUI）、V（皮肤 WeaponSkinsUI）、H（存档 SaveUI）。

已占用合计 29 个按键：W A S D Shift Space Q F T E Tab 1 2 3 4 K I M N Escape R , C D J V H F3 F4。
**F3/F4 为 HUD 诊断面板专用键**（不走 KeyBindings 可重绑体系，固定于 document keydown 监听）：F3 切错误日志面板，F4 切性能（FPS/drawcall/档位）面板；两者默认关闭、互不干扰，面板关闭时 updatePerf 仅做极轻量 FPS 指数平滑采样（0.9*旧+0.1*新）不写 DOM。
面板开关键（I/J/V/H/K）由**面板组件在 document 自监听**，main_entry 不重复绑定。
**新手引导（Tutorial）读 KeyBindings**（P0-3，2026-09-28）：步骤匹配与文案由 `kb.get(action)` 反查当前键码（dodge/ultimate/execute/lock/weapon1-4/移动），重绑后不再卡死；`kb=null` 回退 DEFAULT_BINDINGS。
**UI 快捷键纳入 KeyBindings**（P2-2，2026-09-28）：新增 skilltree(K)/affix(I)/mode(M)/weather(N)/settings(Esc) 5 个可重绑动作（共 20 项）。InputRouter 读 `kb.get('mode'/'weather'/'settings')` 替代硬编码 KeyM/KeyN/Escape；UIPanel 接受可选 `kb+action` 参数、AffixesUI 透传；SkillTreeUI 接受 `kb` 读 skilltree 键；Tutorial ⑪⑫步改 `actions` 驱动、_renderFinal 全键位动态化。无 kb 时回退默认键码（向后兼容）。
**提示文案随键位动态化**（P1-3，2026-09-28）：键码→显示文本的格式化逻辑（`KeyR`→`R`、`Digit5`→`5`、`ShiftLeft`→`Shift`、`Space`/`Tab` 原样、空值→`''`）抽为 `keyLabel(code)` 导出函数，下沉至 `core/input/KeyBindings.js`（输入基础设施层），Tutorial 与 main_entry 共用同一份逻辑（Tutorial.keyLabel 方法委托该函数，消除重复）。两处消费点改为动态反查：① main_entry 处决提示 `hud.flash('按 ' + keyLabel(keyBindings.get('execute')) + ' 处决！')`；② Tutorial `_renderFinal` 完成条全部 7 键由 `bindLabel()` 渲染（lock/dodge/execute/skilltree/mode/weather/settings）。

## 3. UI 约定

1. 面板默认 `display:none`，toggle 切换；Escape 关闭。
2. 面板样式：fixed 定位卡片。**UIPanel 基类**（`src/ui/UIPanel.js`）封装居中/定位容器 + toggleKey 开关 + show/hide/toggle/render 契约；AffixesUI/AchievementsUI/WeaponSkinsUI/SaveUI 继承之，子类只覆写 `render()` 提供内容。SkillTreeUI 因全屏遮罩 + opacity 渐变 + ui.locklost 语义不继承，保持独立。
3. **Escape 统一走 UIStack**（`src/ui/UIStack.js`）：所有可 Escape 关闭的面板（UIPanel 子类、SkillTreeUI、SettingsMenu、ResultScreen、GameMenu）show 时入栈、hide 时出栈；UIStack 捕获阶段监听 Escape 只关**栈顶**并 stopImmediatePropagation，杜绝多面板同时响应；栈空时 Escape 才由 InputRouter 打开设置。面板自身不得再监听 Escape。面板可设 `closable = false`（如 MainMenuUI 标题屏），Escape 仍被吞掉但不关闭该面板——避免标题屏被误关后无路可走；栈顶为可关面板时正常关闭（closable 未设默认可关，向后兼容）。
4. UI 只依赖 gameplay 的数据/常量，不反向被依赖。
5. UI 测试用 `// @vitest-environment jsdom` pragma，模板见 tests/ui/SettingsMenu.test.js。
6. 面板内提示统一走 `bus.emit('hud.flash', ...)` → HUD 监听显示（禁止发无人监听的事件）。
7. **面板双关语义**（P1-2，StageSelectUI）：面板同时有"返回"（回上级面板）与"选择"（转场到下级面板）两种关闭路径时，用 `_selecting` 标志区分——`hide()` 在 `_selecting=false` 时调 `onBack`（Esc 关闭或返回按钮），`_selecting=true` 时跳过（选择回调自行转场）。选择回调在调 `hide()` 前置 `_selecting=true`。

## 4. 结算评级

评级算法唯一来源：`ResultScreen.gradeOf(kills, damage, time)`；界面展示与存档记录必须使用同一结果。
