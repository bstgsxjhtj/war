# 存档系统设计（Save System）

> Round 13 存档系统
> 日期：2026-09-20
> 状态：已确认，待实现计划（跳过导出/导入；技能点纳入存档）

## 1. 目标

现状问题：
- **装备槽丢失**：词条装备在 `weapon.affixes`（运行时内存），`affixes` 键只存背包 inventory，不存装备槽——刷新/切关后装备消失
- **关卡进度丢失**：`campaign_cleared` 只存通关数，当前关卡 `stage` 未持久化——刷新回第 1 关
- 11+ localStorage 键分散（audio_volume/achievements/affixes/campaign_cleared/settings/tutorial_done/daily_*/progression_v1/skilltree_v1/skilltree_profile_*/weaponskins_*），无统一管理与版本控制

存档系统：SaveManager 统一存档 + 自动保存 + 版本迁移 + 技能点纳入。

## 2. savegame_v1 结构

```js
{
  version: 1,
  savedAt: 1234567890,          // 上次保存时间戳
  mode: '战役',                 // 上次模式（null=无存档）
  stage: 3,                     // 当前关卡（0 基，CampaignMode.stage）
  score: 1200,                  // Progression.score
  kills: 45,
  bestGrade: 'A',
  affixSlots: {                 // 装备槽快照，按武器类型
    'sword': [{ type: '锋锐', tier: 2 }, { type: '吸血', tier: 1 }],
    'bow': [null, { type: '迅捷', tier: 0 }]
  },
  skillPoints: 5,               // SkillTree 技能点
  playTime: 3600                // 累计游玩秒数
}
```

## 3. 自动保存时机

- 过关：`bus.on('stage.clear')`（CampaignMode 通关时 emit，需确认现有事件名）
- 击杀 Boss：`bus.on('boss.kill')` 或 kill 事件（Grep 确认）
- 60s 节流定时：setInterval 60s 一次
- beforeunload：pagehide/beforeunload 时保存

## 4. 启动加载

读 savegame_v1 → 应用：
- 战役模式：`campaign.stage = saved.stage`（若 saved.mode === '战役'）
- Progression：score/kills/bestGrade 合并（取较大值或直接覆盖，取直接覆盖简化）
- affixSlots → 装回各武器 `weapon.affixes`（main_entry 在 spawnAll 建武器后 apply）
- skillPoints → SkillTree（Grep 确认字段，如 tree._data.points）
- playTime → main_entry 累计基数

## 5. 版本迁移

`load()` 时：
- 无 savegame_v1 → 尝试旧键迁移（`campaign_cleared`→stage、`progression_v1`→score/kills/bestGrade、`skilltree_v1`→skillPoints）
- 有 savegame_v1 且 version < 1 → 同样迁移后合并
- 成就/设置/皮肤/音量保留各自键，不迁移

## 6. 存档 UI（H 键）

SaveUI 面板：
- 上次保存时间 + 进度概览（关卡/积分/技能点/时长）
- [立即保存]：调 saveManager.save()
- [重置进度]：确认后删 savegame_v1 + progression_v1 回零 + campaign 回第 1 关 + 技能点清零
- 无导出/导入（本轮跳过）

## 7. 组件

### 7.1 src/gameplay/SaveManager.js（新建）
```js
export class SaveManager {
  constructor() { this._key = 'savegame_v1'; this._data = this._load(); }
  serialize(capture) { ... }   // capture 由 main_entry 提供（stage/score/affixSlots/skillPoints/playTime）
  save(capture) { this._data = {...migrate, ...capture, version: 1, savedAt: Date.now()}; localStorage.setItem(...); }
  load() { return this._data; }
  reset() { localStorage.removeItem(this._key); }
  _migrate(raw) { ... }        // version 处理 + 旧键迁移
}
```

### 7.2 src/ui/SaveUI.js（新建）
- constructor(bus, saveManager, campaign, progression)
- H 键 toggle（bus.on 或独立 keydown，main_entry 绑定）
- 渲染面板：保存时间/进度/保存/重置按钮
- 重置 confirm()

### 7.3 src/main_entry.js（修改）
- 实例化 SaveManager + SaveUI
- H 键绑定（Grep 确认未占用，现有键：Q闪避/K技能树/R模式/N天气/V皮肤/I词条/J成就/F技能/C战役/Escape设置）
- 自动保存事件绑定（stage.clear/boss.kill/60s/beforeunload）
- 启动加载应用（stage/score/affixSlots/skillPoints/playTime）
- playTime 累计（onFixed 或 1s 定时）

## 8. 测试

### 8.1 单测 tests/gameplay/SaveManager.test.js
- serialize/save：字段完整（version/savedAt/stage/score/affixSlots/skillPoints/playTime）
- load：无存档 → 默认 null
- 版本迁移：旧键（campaign_cleared/progression_v1/skilltree_v1）→ 合并到 savegame_v1
- reset：清空 + 返回默认
- localStorage mock（tests/setup.js 已有）

### 8.2 冒烟 e2e/smoke.spec.js
- H 键存档面板渲染（#save-panel + #save-now + #save-reset）

## 9. 与现有系统协同

- CampaignMode：stage 持久化（修复）
- Progression：score/kills/bestGrade 纳入
- Affixes：装备槽持久化（修复，weapon.affixes 快照）
- SkillTree：技能点纳入
- main_entry：事件绑定 + 启动加载
- HUD/菜单：H 键

## 10. 边界与错误处理

- localStorage 异常 try/catch（现有模式）
- affixSlots 引用武器类型 key（weaponClass 或 this.type，Grep Weapon 确认）
- 加载时武器未建 → 延迟到 spawnAll 后 apply
- reset 需确认（confirm）
- 存档损坏 JSON → 默认

## 11. 不做的事（YAGNI）

- 导出/导入 JSON（跳过）
- 多存档槽（单槽）
- 云同步/服务器存档
- 存档加密
- 自动读档复杂场景（仅战役恢复 stage+装备槽+技能点）
