# 装备词条 + 成就系统设计（Affixes & Achievements）

> Round 8 内容深化 · 玩法机制深化 · 第三 + 第四个子项目（协同设计）
> 日期：2026-09-19
> 状态：已确认，待实现计划

## 1. 目标

装备词条：武器获随机词条（6 种×3 档），加成属性（伤害/冷却/暴击/吸血/生命/掉落），增加 build 深度。
成就系统：~25 成就跨 6 类（战斗/连击/战役/每日/特殊/技能），解锁奖励（技能点/皮肤/词条），增加长期目标。
协同：成就奖励含词条掉落，词条来源含成就解锁，一次性实现。

## 2. 装备词条

### 2.1 词条类型（6 种×3 档）

| 词条 | 档位（普通/精良/史诗） | 应用点 |
|------|------------------------|--------|
| 锋锐 | +10/+20/+30% 伤害 | CombatSystem.resolveMelee/spawnAoE baseDmg *= |
| 迅捷 | -15/-25/-40% 技能冷却 | WeaponSkills._cdMax *= (1-减) |
| 暴怒 | +10/+20/+30% 暴击率 | CombatSystem 命中 roll，暴击×2 伤害 |
| 吸血 | 5/10/15% 吸血 | Character 命中后回血（attacker） |
| 坚韧 | +20/+40/+60 最大生命 | Character health.maxHp |
| 幸运 | +10/+20/+30% 掉落率 | Affixes.drop 概率 |

稀有度色：普通#ccc / 精良#4af / 史诗#fa4

### 2.2 词条槽

- 每武器 2 词条槽（`weapon.affixes = [null, null]`）
- 替换制：新词条覆盖选中槽（玩家选）
- 词条实例：`{ type: '锋锐', tier: 2 }`（tier 0/1/2 = 普通/精良/史诗）

### 2.3 来源

- **击杀掉落**：击杀后概率掉落（基础 8%，幸运加成），随机词条+随机档位（档位权重 60/30/10）
- **成就奖励**：成就解锁 grant 固定词条（指定 type+tier）
- **通关奖励**：战役关卡通关 grant 词条

### 2.4 UI（I 键，未占用）

- 词条面板：当前武器 2 槔 + 词条池预览（6 种说明）
- 替换：点击槽位 + 选新词条（若背包有）
- 词条背包：`Affixes.inventory`（待装词条，最多 20）

## 3. 成就系统

### 3.1 成就列表（6 类 ~25 项）

| 类别 | 成就（示例） | 目标 | 奖励 |
|------|-------------|------|------|
| 战斗 | 初战告捷/百人斩/千人斩 | 1/100/1000 击杀 | 技能点1/2 + 词条 |
| 连击 | 连击新星/连击大师/连击之王 | 连击10/20/50 | 词条/称号 |
| 战役 | 通关战役/全关无伤 | 通关5关/全关无伤 | 皮肤 + 词条 |
| 每日 | 每日初心/每日达人 | 完成10/30每日挑战 | 技能点 |
| 特殊 | 背刺者/完美防御/骑马杀 | 背刺10/完美格挡20/骑马击杀5 | 词条 + 皮肤 |
| 技能 | 技能初试/全武器大师 | 主动技100次/全武器技能 | 词条 |

### 3.2 奖励类型

- **技能点**：`SkillTree.addPoint(n)`（main_entry skills）
- **皮肤**：`WeaponSkins.unlock(skinId)`
- **词条**：`Affixes.grant(type, tier)`（固定词条入背包）
- **称号**：HUD 显示（可选，本轮简化为数组，不显示）

### 3.3 UI（J 键，未占用）

- 成就面板：6 类 tab + 进度条 + 已解锁标记
- localStorage：`achievements`（`{ id: { progress, unlocked } }`）

### 3.4 触发（EventBus 事件驱动）

| 事件 | 成就检查 |
|------|----------|
| `combat.kill` | 战斗击杀 / 背刺 / 骑马杀 |
| `combo.tier` | 连击里程碑 |
| `campaign.clear`/`campaign.perfect` | 战役通关 / 无伤 |
| `daily.update` | 每日挑战完成 |
| `skill.cast` | 主动技使用 |

## 4. 协同数据流

```
击杀/连击/通关/每日/技能 → EventBus 事件
  → Achievements.check(event) → 进度更新 → 达标解锁
  → 奖励：SkillTree.addPoint / WeaponSkins.unlock / Affixes.grant
  → bus achievement.unlock({ id, name, reward })（HUD 提示 + 面板更新）

击杀 → Affixes.drop(luck=attacker.weapon.affixBonus('幸运'))
  → 概率掉落 → 随机词条+档位 → 入背包
  → bus affix.drop({ type, tier })（HUD 提示 + 面板更新）

词条装备 → weapon.affixes = [affix1, affix2]
应用：
  - CombatSystem.resolveMelee: baseDmg *= (1+锋锐); 暴怒 roll; 吸血 attacker 回血
  - WeaponSkills: _cdMax *= (1-迅捷)
  - Character: health.maxHp += 坚韧（setAffix 时重算）
```

## 5. 组件

### 5.1 src/gameplay/Affixes.js（新增）
```js
export const AFFIX_TYPES = {
  锋锐: { name: '锋锐', tiers: [0.10, 0.20, 0.30], apply: 'damage' },
  迅捷: { name: '迅捷', tiers: [0.15, 0.25, 0.40], apply: 'cooldown' },
  暴怒: { name: '暴怒', tiers: [0.10, 0.20, 0.30], apply: 'crit' },
  吸血: { name: '吸血', tiers: [0.05, 0.10, 0.15], apply: 'lifesteal' },
  坚韧: { name: '坚韧', tiers: [20, 40, 60], apply: 'maxhp' },
  幸运: { name: '幸运', tiers: [0.10, 0.20, 0.30], apply: 'luck' },
};

export class Affixes {
  constructor() { this.inventory = []; this._load(); }
  drop(luck = 0) { /* 概率 0.08+luck，随机 type+tier(权重60/30/10)，入背包 */ }
  grant(type, tier) { /* 固定词条入背包 */ }
  equip(weapon, slot, invIdx) { /* 装备到 weapon.affixes[slot] */ }
  affixBonus(weapon, type) { /* 查 weapon.affixes 中 type 词条 tier 值之和 */ }
  _save() / _load() { /* localStorage 'affixes' */ }
}
```

### 5.2 src/gameplay/Achievements.js（新增）
```js
export const ACHIEVEMENTS = [
  { id: 'kill_1', cat: '战斗', name: '初战告捷', target: 1, event: 'combat.kill', reward: { skillPoint: 1 } },
  { id: 'kill_100', cat: '战斗', name: '百人斩', target: 100, event: 'combat.kill', reward: { skillPoint: 2, affix: ['锋锐', 2] } },
  // ... ~25 项
];

export class Achievements {
  constructor() { this._data = {}; this._load(); }
  check(event, payload) { /* 匹配 event 的成就，progress++，达标解锁+发奖励+emit */ }
  progress(id) / isUnlocked(id) / allByCat(cat)
  _save() / _load() { /* localStorage 'achievements' */ }
}
```

### 5.3 src/gameplay/weapons/Weapon.js（修改）
- constructor 加 `this.affixes = [null, null];`（2 槽）
- 加 `affixBonus(type, affixes)` 查询方法（或由 Affixes 管）

### 5.4 src/gameplay/CombatSystem.js（修改，应用词条）
- resolveMelee 121-126：baseDmg 计算后加
  ```js
  const affixes = this._affixes;
  if (affixes) {
    baseDmg *= (1 + affixes.affixBonus(attacker.weapon, '锋锐'));
    if (Math.random() < affixes.affixBonus(attacker.weapon, '暴怒')) baseDmg *= 2;
  }
  ```
- 命中后（takeDamage 返回 lost）：`if (affixes && lost > 0) attacker.health.cur += lost * affixes.affixBonus(attacker.weapon, '吸血');`
- spawnAoE 同理（锋锐/暴怒/吸血）

### 5.5 src/gameplay/WeaponSkills.js（修改，迅捷词条）
- trigger 时 `_cd[idx] = this._cdMax * (1 - 迅捷 affixBonus)`——但 WeaponSkills 不持 weapon，需传 affixBonus 或由 Player 调用时传 cdMul
- 简化：Player.trySkill trigger 时传 `cdMul = 1 - affixes.affixBonus(weapon, '迅捷')`，WeaponSkills.trigger(idx, cdMul)

### 5.6 src/gameplay/Character.js（修改，坚韧词条）
- setAffix(affixes) 或 applyAffix：`this.health.maxHp = baseMaxHp + 坚韧; this.health.cur = min(cur, maxHp)`
- 需存 baseMaxHp（constructor 时记）

### 5.7 src/ui/AchievementsUI.js + AffixesUI.js（新增）
- AchievementsUI：J 键面板（6 类 tab + 进度 + 解锁）
- AffixesUI：I 键面板（当前武器 2 槽 + 背包 + 替换）

### 5.8 src/main_entry.js（修改）
- 实例化 `const affixes = new Affixes(); const achievements = new Achievements();`
- bus.on 事件 → achievements.check
- bus.on achievement.unlock → HUD 提示
- bus.on affix.drop → HUD 提示
- combat.setAffixes(affixes)（注入 CombatSystem）
- player.setAffixes(affixes)（注入 Player/Character）
- I/J 键绑定面板
- spawnAll：affixes 不 reset（持久化），achievements 不 reset

## 6. 测试

### 6.1 单测 tests/gameplay/Affixes.test.js
- drop 概率（mock Math.random）
- grant 入背包
- equip 装备到槽
- affixBonus 查询（单/双词条同 type 叠加）
- 持久化

### 6.2 单测 tests/gameplay/Achievements.test.js
- check 进度更新
- 达标解锁
- 奖励触发（mock bus.emit）
- 持久化

### 6.3 冒烟 e2e/smoke.spec.js 增断言
- I 键词条面板 + J 键成就面板可见

## 7. 与现有系统协同

- **SkillTree**：成就奖励 `skills.addPoint(n)`（SkillTree.js:18）
- **WeaponSkins**：成就奖励 `skins.unlock(id)`（WeaponSkins.js:33）
- **ComboSystem**：连击里程碑成就（combo.tier 事件）
- **CampaignMode/DailyChallenge**：通关/每日成就（campaign.clear/daily.update 事件）
- **WeaponSkills**：迅捷词条减冷却；技能使用成就（skill.cast 事件）
- **Weapon**：affixes 2 槔 + affixBonus 查询

## 8. 边界与错误处理

- `affixes`/`achievements` 可为 null（注入前），调用处用 `?.`
- `affixBonus` 无词条返回 0（不影响计算）
- 词条背包上限 20（满则 drop 失败，HUD 提示）
- 成就已解锁不重复奖励（isUnlocked 检查）
- 坚韧词条 maxHp 重算时 cur 不超 maxHp

## 9. 不做的事（YAGNI）

- 不做词条升级/熔炼（替换制）
- 不做词条套装效果（单词条独立）
- 不做成就隐藏/条件链（全显式）
- 不做成就积分/排行（仅解锁奖励）
- 不做词条交易/分解（背包管理最小化）
- 不做称号显示（本轮只存不显）
