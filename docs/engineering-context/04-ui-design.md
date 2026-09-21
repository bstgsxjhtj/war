# 04 · 页面设计

## 1. 界面清单

| 界面 | 触发 | 说明 |
|---|---|---|
| HUD | 常驻 | 血条/体力/怒气/比分/小地图/击杀提示；暴露 flash()/flashKill() 方法 |
| 设置菜单 | Esc | SettingsMenu |
| 技能树面板 | K | SkillTreeUI |
| 成就面板 | J | AchievementsUI |
| 词条面板 | I | AffixesUI |
| 皮肤面板 | V | WeaponSkinsUI |
| 存档面板 | H | SaveUI（#save-panel，右上 fixed，含 #save-info/#save-now/#save-reset） |
| 结算界面 | 回合结束 | ResultScreen（评级统一用 gradeOf） |

## 2. 按键映射（全局唯一，新增按键前必须查此表）

已占用：Q F R M , K C D N I J V H Escape。
面板开关键（I/J/V/H/K）由**面板组件在 document 自监听**，main_entry 不重复绑定。

## 3. UI 约定

1. 面板默认 `display:none`，toggle 切换；Escape 关闭。
2. 面板样式：fixed 定位卡片，统一样式样板（后续抽 UIPanel 基类消除四胞胎重复）。
3. UI 只依赖 gameplay 的数据/常量，不反向被依赖。
4. UI 测试用 `// @vitest-environment jsdom` pragma，模板见 tests/ui/SettingsMenu.test.js。
5. 面板内提示统一走 `bus.emit('hud.flash', ...)` → HUD 监听显示（禁止发无人监听的事件）。

## 4. 结算评级

评级算法唯一来源：`ResultScreen.gradeOf(kills, damage, time)`；界面展示与存档记录必须使用同一结果。
