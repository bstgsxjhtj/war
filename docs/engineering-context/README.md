# 工程设计上下文 · 总览

> 本目录是项目的**工程设计上下文（Engineering Design Context）**。
> 任何涉及架构、代码、设计的修改，**必须先阅读相关文档，修改完成后必须同步更新文档**（由 `engineering-context` skill 强制约束）。

## 文档索引

| 文档 | 内容 | 何时读 |
|---|---|---|
| [01-requirements.md](01-requirements.md) | 需求文档：游戏模式、元进度系统、存档需求 | 新增/修改功能前 |
| [02-architecture.md](02-architecture.md) | 架构文档：分层、依赖方向、组合根、重构路线 | 涉及模块结构/依赖的修改前 |
| [03-business-logic.md](03-business-logic.md) | 业务架构：领域模型、战斗管线、元进度规则、胜负判定 | 修改 gameplay 逻辑前 |
| [04-ui-design.md](04-ui-design.md) | 页面设计：HUD、面板清单、按键映射、UI 约定 | 新增/修改 UI 前 |
| [05-conventions.md](05-conventions.md) | 工程约定：事件名、localStorage 键、测试规范、提交规范 | 任何修改前 |
| [06-known-issues.md](06-known-issues.md) | 已知问题台账：审查发现的问题、状态、修复记录 | 每次修改后更新 |

## 项目概况

- 类型：Web 单机 3D 战斗游戏（three.js）
- 构建：vite；测试：vitest（node 默认，UI 用 jsdom pragma）+ Playwright 冒烟
- 规模：src 91 个文件 / ~9100 行；tests 99 个文件
- 工作流：brainstorm → spec（docs/superpowers/specs）→ plan（docs/superpowers/plans）→ 子代理驱动执行（TDD，每 Task 独立 commit，pre-commit hook 跑 build + 全量 vitest）
