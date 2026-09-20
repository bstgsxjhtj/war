# Boss 多样化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`). **重要：SearchReplace 偶发误报，每处编辑后 Grep 验证，若丢失用 node 脚本 fix.mjs 行级处理。BossEnemy 用 Write 完整重写。**

**Goal:** 4 Boss 类型（warlord/ranger/mage/behemoth）+ 差异化技能 + mini-boss（第3/7 关）+ 关卡分配。

**集成点（已读确认）：**
- `src/gameplay/BossEnemy.js` 140 行：constructor（5-21，warlord/游侠 2 类型）/update（45-90，charge/roar/summon）/EliteEnemy（105-140）
- `src/gameplay/CampaignMode.js` STAGES：第5关（field,Boss）/第10关（keep,Boss限时）；第3关（山口伏击）/第7关（雪原生存）需加 bossType+mini
- `src/main_entry.js` 262 `new BossEnemy({ team:1, type:'warlord' })`（硬编码，需按 stage.bossType）

---

### Task 1: BossEnemy 4 类型 + 技能 + 单测（TDD）

**Files:** Write `src/gameplay/BossEnemy.js`（完整重写）+ Create `tests/gameplay/BossEnemy.test.js`

- [ ] **Step 1: 写失败测试** — tests/gameplay/BossEnemy.test.js（6 测试）：
  - 4 类型构造：warlord(300hp/5.5/'战将'/['charge','roar','summon'])、ranger(220/6.0/'游侠'/['rapidshot','dodge','trap'])、mage(180/5.0/'法师'/['fireball','teleport','aoe'])、behemoth(400/4.5/'巨兽'/['slam','charge','regenerate'])
  - mini=true：血量 *0.7（warlord mini 210）、_skillSet slice(0,2)、scale 1.1
  - enterPhase：全 Boss 升 3 / mini 限 2（enterPhase(3) mini 仍 2）
  - 技能方法存在：_skillRapidshot/_skillDodge/_skillTrap/_skillFireball/_skillTeleport/_skillAoe/_skillSlam/_skillRegenerate（typeof === 'function'）
  - _skillSet 正确（4 类型）
  - displayName（【Boss】战将 等）
  mock combat = { characters:[], spawnAoE:vi.fn(), spawnPierceArrow:vi.fn() } + target = { position:{clone:()=>({sub:()=>({normalize:()=>({multiplyScalar:()=>({})}))})} }, root:{position:new THREE.Vector3()} }。BossEnemy extends AIController 需 mock super，但可直接 new BossEnemy({type}) 测字段（不调 update）。
- [ ] **Step 2: 跑验证失败** — `npx vitest run tests/gameplay/BossEnemy.test.js`，应 FAIL
- [ ] **Step 3: Write 完整 src/gameplay/BossEnemy.js**（现有 + 4 类型 + 6 新技能 + mini 分支）：
  - constructor 4 类型分支（spec §6.1）+ mini 分支（_maxHp*0.7 + _skillSet slice(0,2) + scale 1.1）
  - 现有 _skillCharge/_skillRoar/_skillSummon（warlord）
  - 新 _skillRapidshot(target,combat,now)（spawnPierceArrow ×3 扇形）/ _skillDodge(target,now)（位移 4m）/ _skillTrap(combat,now)（spawnAoE 延迟，用 _trapTimer）
  - 新 _skillFireball(target,combat,now)（spawnPierceArrow）/ _skillTeleport(target,now)（root.position = target.pos - forward*5）/ _skillAoe(combat,now)（spawnAoE 8m）
  - 新 _skillSlam(combat,now)（spawnAoE 8m + 击倒）/ _skillRegenerate(dt)（_phase>=2 每秒 +5hp）
  - update 按 _skillSet + _phase + 冷却触发（if _skillSet.includes('rapidshot') && _rapidCd<=0）
  - enterPhase(p)：mini 限 2（`if (this._isMini) p = Math.min(p, 2); this._phase = Math.max(this._phase, p);`）
  - EliteEnemy 保留现有
- [ ] **Step 4: 跑验证通过** — EXIT=0（6 passed）
- [ ] **Step 5: Grep 验证** — `Select-String -Path src/gameplay/BossEnemy.js -Pattern '_skillRapidshot|_skillFireball|_skillSlam|_skillSet|_isMini|behemoth|ranger|mage'`，应 10+ 行
- [ ] **Step 6: 提交** — `git commit -m "feat: BossEnemy 4类型+差异化技能+mini-boss + 单测"`

---

### Task 2: CampaignMode STAGES 加 bossType/mini

**Files:** Modify `src/gameplay/CampaignMode.js`

- [ ] **Step 1: Grep 确认 STAGES** — `Select-String -Path src/gameplay/CampaignMode.js -Pattern '山口伏击|雪原生存|最终决战|终局之战|objective' | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }`
- [ ] **Step 2: 第3关加 bossType/mini** — 山口伏击行加 `bossType: 'ranger', mini: true`（objective 可能需改 'Boss' 或保留+bossType）
- [ ] **Step 3: 第5关加 bossType** — 最终决战行加 `bossType: 'warlord', mini: false`
- [ ] **Step 4: 第7关加 bossType/mini** — 雪原生存行加 `bossType: 'mage', mini: true`
- [ ] **Step 5: 第10关加 bossType** — 终局之战行加 `bossType: 'behemoth', mini: false`
- [ ] **Step 6: Grep 验证** — `Select-String -Path src/gameplay/CampaignMode.js -Pattern 'bossType|mini:'`，应 8+ 行
- [ ] **Step 7: build + 单测**
- [ ] **Step 8: 提交** — `git commit -m "feat: CampaignMode STAGES 加 bossType/mini 字段"`

---

### Task 3: main_entry 按 bossType spawn Boss

**Files:** Modify `src/main_entry.js`

- [ ] **Step 1: Grep 确认 spawnAll Boss 条件** — `Select-String -Path src/main_entry.js -Pattern 'BossEnemy|new Boss|bossType|spawnAll|objective.*Boss|stage\.' | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }`
- [ ] **Step 2: 262 行改 Boss spawn** — `new BossEnemy({ team:1, type:'warlord' })` → `new BossEnemy({ team:1, type: campaign.currentStage.bossType || 'warlord', mini: campaign.currentStage.mini || false })`
- [ ] **Step 3: 第3/7 关也 spawn mini-boss** — spawnAll 内若 `campaign.currentStage.bossType` 则 spawn BossEnemy（而非普通 AIController）。Grep spawnAll 内 Boss 条件（可能 `if (stage.objective === 'Boss')`），改为 `if (campaign.currentStage.bossType)` 触发 Boss spawn。注意：第3关现有 objective 非纯 Boss（攻城/生存），需兼容——若 bossType 存在则 spawn Boss（不影响现有 objective 判定）
- [ ] **Step 4: Grep 验证** — `Select-String -Path src/main_entry.js -Pattern 'bossType|mini:|BossEnemy'`，应 3+ 行
- [ ] **Step 5: build + 全量单测**
- [ ] **Step 6: 提交** — `git commit -m "feat: main_entry 按 bossType spawn Boss + mini-boss"`

---

### Task 4: 冒烟 + 全量验证

**Files:** e2e/smoke.spec.js（无需改，0 error 覆盖）

- [ ] **Step 1: 跑 Playwright** — `npx playwright test`，应 1 passed（0 error，Boss 关不崩溃）
- [ ] **Step 2: 最终全量** — vitest + build + playwright 全 0
- [ ] **Step 3: 清理临时文件 + git status 干净**

---

## Self-Review

1. **Spec 覆盖**：4 类型（Task1）、差异化技能（Task1）、mini-boss（Task1+2+3）、关卡分配（Task2+3）——全覆盖。
2. **Placeholder**：无 TBD，每步含关键代码。
3. **类型一致**：constructor(type,mini) Task1/3 一致；_skillSet Task1 一致；bossType/mini Task2/3 一致；enterPhase mini 限 2 Task1 一致。
4. **SearchReplace 误报防护**：Task1 BossEnemy 用 Write 完整重写；Task2/3 小改 Grep 验证。
5. **依赖**：Task1 独立；Task2 独立；Task3 依赖 Task1+2；Task4 依赖 Task1-3。
