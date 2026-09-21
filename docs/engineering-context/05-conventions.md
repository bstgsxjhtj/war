# 05 · 工程约定

## 1. 事件命名

格式 `域.动作`：`combat.hit`、`combat.kill`、`fx.shake`、`settings.quality`、`hud.flash`、`daily.update`、`skins.changed`……
禁止发射无监听者的事件；新增事件需在本文件登记 payload 契约。

## 2. localStorage 键登记

| 键 | 属主 |
|---|---|
| savegame_v1 | SaveManager（游戏进度唯一事实来源：mode/stage/campaignCleared/progressionFull/score/kills/bestGrade/affixSlots/affixInventory/skillPoints/skillTree/achievements/daily/skins/playTime） |
| ~~progression_v1 / skilltree_v1 / campaign_cleared / achievements / affixes / daily_challenge / weapon_skins~~ | 旧键，仅启动时一次性迁移到 savegame_v1 后删除 |
| settings | SettingsMenu（UI 偏好，独立保留） |
| audio_volume | AudioEngine（音量，独立保留，05 §5 "音量只留 AudioEngine 一处"） |
| tutorial_done | Tutorial（一次性引导标志，独立保留） |
| skilltree_profile_* | SkillTree（多档位技能方案，独立保留） |

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
- 魔法数字与事件名/存储键字符串逐步收敛到常量模块。
