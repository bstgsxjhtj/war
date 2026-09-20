# 装备词条 + 成就系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`). **重要：SearchReplace 工具偶发误报，每处编辑后必须 Grep 验证持久化，若丢失用 node 脚本行级处理。**

**Goal:** 装备词条（6 种×3 档，2 槽/武器）+ 成就系统（~25 成就 6 类），协同实现，EventBus 事件驱动。

**集成点（已读确认）：**
- `src/gameplay/SkillTree.js:18` addPoint(n)
- `src/gameplay/WeaponSkins.js:33` unlock(id)
- `src/gameplay/Character.js:14,29` maxHp/health；`295` setSkill（maxHp 加成模式）
- `src/gameplay/CombatSystem.js:120-126` resolveMelee baseDmg 计算；`162-173` spawnAoE
- `src/gameplay/weapons/Weapon.js:4-24` constructor + skill
- `src/gameplay/WeaponSkills.js` trigger(idx)
- `src/main_entry.js:85-88` 实例化区；`187-191` spawnAll；`405-408` 主循环
- EventBus 事件：combat.kill（CombatSystem emit）、combo.tier（ComboSystem emit）、skill.cast（Player emit）

---

### Task 1: Affixes 管理器 + 单测（TDD）

**Files:** Create `src/gameplay/Affixes.js` + `tests/gameplay/Affixes.test.js`

- [ ] **Step 1: 写失败测试** — tests/gameplay/Affixes.test.js（drop 概率 mock Math.random、grant 入背包、equip 装备、affixBonus 单/双叠加、背包上限 20、持久化）。import { Affixes, AFFIX_TYPES }。
- [ ] **Step 2: 跑验证失败** — `npx vitest run tests/gameplay/Affixes.test.js`，应 FAIL。
- [ ] **Step 3: 写实现** — src/gameplay/Affixes.js：
  - `AFFIX_TYPES`（6 种，spec 5.1）
  - `Affixes`：constructor（inventory=[], _load）、drop(luck=0)（概率 0.08+luck，随机 type+tier 权重 60/30/10，入背包，上限 20）、grant(type,tier)（入背包）、equip(weapon,slot,invIdx)（weapon.affixes[slot]=inventory[invIdx]）、affixBonus(weapon,type)（查 weapon.affixes 中 type 的 tier 值之和，无返 0）、_save/_load（localStorage 'affixes'）
- [ ] **Step 4: 跑验证通过** — EXIT=0
- [ ] **Step 5: Grep 验证持久化** — `Select-String -Path src/gameplay/Affixes.js -Pattern 'AFFIX_TYPES|class Affixes|affixBonus'`，应 3+ 行
- [ ] **Step 6: 提交** — `git add src/gameplay/Affixes.js tests/gameplay/Affixes.test.js; git commit -m "feat: Affixes 词条管理器 + 单测"`

---

### Task 2: Achievements 管理器 + 单测（TDD）

**Files:** Create `src/gameplay/Achievements.js` + `tests/gameplay/Achievements.test.js`

- [ ] **Step 1: 写失败测试** — check 进度更新、达标解锁、奖励触发（mock bus.emit）、isUnlocked 不重复、持久化
- [ ] **Step 2: 跑验证失败**
- [ ] **Step 3: 写实现** — src/gameplay/Achievements.js：
  - `ACHIEVEMENTS`（~25 项，spec 3.1，每项 `{ id, cat, name, target, event, reward }`，reward 含 skillPoint/affix/skin）
  - `Achievements`：constructor（_data={}, bus=null, _load）、setBus(b)、check(event,payload)（匹配 event 成就，progress++，达标且未解锁则解锁+发奖励+emit achievement.unlock）、progress(id)、isUnlocked(id)、allByCat(cat)、_save/_load（localStorage 'achievements'）
- [ ] **Step 4: 跑验证通过**
- [ ] **Step 5: Grep 验证持久化**
- [ ] **Step 6: 提交** — `git add ...; git commit -m "feat: Achievements 成就管理器 + 单测"`

---

### Task 3: Weapon affixes 字段 + affixBonus

**Files:** Modify `src/gameplay/weapons/Weapon.js`

- [ ] **Step 1: constructor 加 affixes** — `this.affixes = [null, null];`（在 skillDesc 后）
- [ ] **Step 2: Grep 验证** — `Select-String src/gameplay/weapons/Weapon.js 'this.affixes'`，应 1 行
- [ ] **Step 3: build 验证** — `npx vite build --mode development`，0 errors
- [ ] **Step 4: 提交** — `git commit -m "feat: Weapon affixes 2 槽字段"`

---

### Task 4: CombatSystem 应用词条（锋锐/暴怒/吸血）

**Files:** Modify `src/gameplay/CombatSystem.js`（resolveMelee 120-126 + spawnAoE 162-173 + setAffixes）

- [ ] **Step 1: setAffixes 方法** — 加 `setAffixes(a) { this._affixes = a; }`
- [ ] **Step 2: resolveMelee baseDmg 后加词条** — 123 行 `if (attacker._skill) baseDmg *= ...` 后：
  ```js
  if (this._affixes && attacker.weapon) {
    baseDmg *= (1 + this._affixes.affixBonus(attacker.weapon, '锋锐'));
    if (Math.random() < this._affixes.affixBonus(attacker.weapon, '暴怒')) baseDmg *= 2;
  }
  ```
- [ ] **Step 3: resolveMelee 命中后吸血** — takeDamage 返回 lost 后（命中分支内）：`if (this._affixes && lost > 0) attacker.health.cur = Math.min(attacker.health.maxHp, attacker.health.cur + lost * this._affixes.affixBonus(attacker.weapon, '吸血'));`
- [ ] **Step 4: spawnAoE 同理** — spawnAoE damage 计算加锋锐/暴怒；命中后吸血（同 resolveMelee）
- [ ] **Step 5: Grep 验证** — `Select-String src/gameplay/CombatSystem.js '_affixes|affixBonus'`，应 6+ 行
- [ ] **Step 6: build + 全量单测** — `npx vite build; npx vitest run`，0 errors + 109+ passed
- [ ] **Step 7: 提交** — `git commit -m "feat: CombatSystem 应用词条（锋锐/暴怒/吸血）"`

---

### Task 5: WeaponSkills 迅捷词条（trigger cdMul）

**Files:** Modify `src/gameplay/WeaponSkills.js`（trigger 签名）+ `src/gameplay/Player.js`（trySkill 传 cdMul）

- [ ] **Step 1: WeaponSkills.trigger 加 cdMul 参数** — `trigger(idx, cdMul = 1) { this._cd[idx] = this._cdMax * cdMul; }`
- [ ] **Step 2: Player.trySkill 传 cdMul** — trigger 调用处：`const cdMul = 1 - (this._affixes?.affixBonus(this.weapon, '迅捷') || 0); this._weaponSkills.trigger(idx, cdMul);`
- [ ] **Step 3: Grep 验证** — `Select-String src/gameplay/WeaponSkills.js 'cdMul'` + `Select-String src/gameplay/Player.js 'cdMul'`，各应 1 行
- [ ] **Step 4: build + 单测** — 0 errors + 109+ passed
- [ ] **Step 5: 提交** — `git commit -m "feat: WeaponSkills 迅捷词条减冷却"`

---

### Task 6: Character 坚韧词条（setAffix maxHp）

**Files:** Modify `src/gameplay/Character.js`（constructor baseMaxHp + setAffixes）

- [ ] **Step 1: constructor 存 baseMaxHp** — `this._baseMaxHp = maxHp;`（health 创建后）
- [ ] **Step 2: setAffixes 方法** — 
  ```js
  setAffixes(a) { this._affixes = a; this._applyAffixMaxHp(); }
  _applyAffixMaxHp() {
    if (!this._affixes) return;
    const bonus = this._affixes.affixBonus(this.weapon, '坚韧');
    this.health.maxHp = this._baseMaxHp + bonus;
    if (this.health.cur > this.health.maxHp) this.health.cur = this.health.maxHp;
  }
  ```
- [ ] **Step 3: Grep 验证** — `Select-String src/gameplay/Character.js '_baseMaxHp|setAffixes|_applyAffixMaxHp'`，应 3+ 行
- [ ] **Step 4: build + 单测**
- [ ] **Step 5: 提交** — `git commit -m "feat: Character 坚韧词条加 maxHp"`

---

### Task 7: AffixesUI（I 键面板）

**Files:** Create `src/ui/AffixesUI.js` + Modify `src/main_entry.js`（I 键 + 实例化）

- [ ] **Step 1: AffixesUI 类** — constructor(affixes, player)、toggle()（显隐 #affixes-panel）、render()（当前武器 2 槔 + 背包列表 + 替换按钮）、_onKey(e)（I 键 toggle + Escape 关）
- [ ] **Step 2: main_entry 实例化 + I 键** — `const affixesUI = new AffixesUI(affixes, player);` + keydown I 键 toggle
- [ ] **Step 3: Grep 验证** — `Select-String src/ui/AffixesUI.js 'class AffixesUI|toggle'` + `Select-String src/main_entry.js 'AffixesUI|KeyI'`
- [ ] **Step 4: build**
- [ ] **Step 5: 提交** — `git commit -m "feat: AffixesUI 词条面板（I 键）"`

---

### Task 8: AchievementsUI（J 键面板）

**Files:** Create `src/ui/AchievementsUI.js` + Modify `src/main_entry.js`（J 键 + 实例化）

- [ ] **Step 1: AchievementsUI 类** — constructor(achievements)、toggle()（J 键）、render()（6 类 tab + 进度条 + 解锁标记）、_onKey(e)
- [ ] **Step 2: main_entry 实例化 + J 键** — `const achievementsUI = new AchievementsUI(achievements);` + keydown J 键 toggle
- [ ] **Step 3: Grep 验证**
- [ ] **Step 4: build**
- [ ] **Step 5: 提交** — `git commit -m "feat: AchievementsUI 成就面板（J 键）"`

---

### Task 9: main_entry 集成（实例化 + 事件绑定 + 注入 + HUD 提示）

**Files:** Modify `src/main_entry.js`

- [ ] **Step 1: import + 实例化** — `import { Affixes } from './gameplay/Affixes.js'; import { Achievements } from './gameplay/Achievements.js';` + `const affixes = new Affixes(); const achievements = new Achievements(); achievements.setBus(bus);`（85 区）
- [ ] **Step 2: 事件绑定** — bus.on('combat.kill'/'combo.tier'/'skill.cast'/'campaign.clear'/'daily.update', (p) => achievements.check(event, p))
- [ ] **Step 3: 注入** — `combat.setAffixes(affixes); player.setAffixes(affixes);`（spawnAll 内，spawnAll 不 reset affixes/achievements）
- [ ] **Step 4: HUD 提示** — bus.on('achievement.unlock', ({name}) => hud.flash('成就解锁：'+name)); bus.on('affix.drop', ({type,tier}) => hud.flash('词条掉落：'+type))
- [ ] **Step 5: Grep 验证** — `Select-String src/main_entry.js 'affixes|achievements|Affixes|Achievements'`，应 8+ 行
- [ ] **Step 6: build + 全量单测**
- [ ] **Step 7: 提交** — `git commit -m "feat: main_entry 集成 Affixes+Achievements（事件+注入+HUD）"`

---

### Task 10: 冒烟 + 全量验证

**Files:** Modify `e2e/smoke.spec.js`

- [ ] **Step 1: smoke 加面板断言** — I 键 + J 键派发 + `#affixes-panel` + `#achievements-panel` count > 0
- [ ] **Step 2: 跑 Playwright** — `npx playwright test`，应 1 passed（0 error + 2 面板可见）
- [ ] **Step 3: 提交** — `git commit -m "test: smoke 增 词条+成就面板断言"`
- [ ] **Step 4: 最终全量** — vitest + build + playwright 全 0
- [ ] **Step 5: 清理临时文件 + git status 干净**

---

## Self-Review

1. **Spec 覆盖**：词条 6×3（Task1/3/4/5/6）、成就 ~25（Task2/9）、UI I/J（Task7/8）、协同数据流（Task9 事件+注入+HUD）、测试（Task1/2 单测+Task10 smoke）——全覆盖。
2. **Placeholder**：无 TBD，每步含关键代码。
3. **类型一致**：affixBonus(weapon, type) Task1/4/5/6 一致；setAffixes(affixes) Task4/6/9 一致；trigger(idx, cdMul) Task5 一致；achievement.unlock/affix.drop 事件 Task2/9 一致；#affixes-panel/#achievements-panel id Task7/8/10 一致。
4. **SearchReplace 误报防护**：每 Task 含 Grep 验证步骤；若丢失用 node 脚本（fix.mjs 模式）行级处理。
