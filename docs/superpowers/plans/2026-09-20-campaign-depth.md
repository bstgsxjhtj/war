# 关卡设计深化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`). **重要：SearchReplace 工具偶发误报，每处编辑后必须 Grep 验证持久化，若丢失用 node 脚本 fix.mjs 行级处理（读文件 split('\n') 找行 splice）。**

**Goal:** 10 关 2 章节 + 6 目标 + 3 事件 + 4 spawn 布局 + 4 新地图 + 难度曲线。

**集成点（已读确认）：**
- `src/gameplay/CampaignMode.js` 56 行：STAGES（1-30）/spawnLayout（31-40）/checkWin（41-47）/onStageClear（48-52）/skipTo（53-55）
- `src/world/MapGenerator.js` 15 行 `static MAPS = {`：bridge（16-34）/pass（35-50）/fortress/field，每地图含 name/size/heightFn/waterFn/river/bridge_/layout/spawns
- `src/main_entry.js` 290 `campaign.spawnLayout()`→loadMap；316-332 checkWin 战役分支；436 hud.setMode('战役', campaign.stageInfo)；307 C 键
- `src/gameplay/BossEnemy.js` _phase 机制（已有二阶段）
- `src/gameplay/WaveMode.js` 波次（生存模式集成）

---

### Task 1: MapGenerator 4 新地图

**Files:** Modify `src/world/MapGenerator.js`（MAPS 加 forest/river/snowfield/keep）

- [ ] **Step 1: forest 地图** — 加 forest 键（密林：多树 60，平坦 heightFn `fbm*1.5+0.3`，waterFn false，无 river，layout trees60/rocks20/tents3/flags/spawns blue[-160,0]/red[160,0]）
- [ ] **Step 2: river 地图** — 加 river 键（河谷：河流 z[-12,12] depth1.5 + 桥 x[-4,4]，heightFn 河谷 `z>-12&&z<12 ? -1+sin : fbm*2`，waterFn 河内，river，layout trees30/rocks15/tents2/bridgeStones2）
- [ ] **Step 3: snowfield 地图** — 加 snowfield 键（雪原：开阔 heightFn `fbm*0.8+0.2`（平），waterFn false，layout trees10/rocks25/tents2/flags）
- [ ] **Step 4: keep 地图** — 加 keep 键（要塞：城墙 heightFn `x<-50||x>50 ? 8+fbm*2 : fbm*1.5`，waterFn false，layout trees15/rocks30/towers4/tents2/flags）
- [ ] **Step 5: Grep 验证** — `Select-String -Path src/world/MapGenerator.js -Pattern 'forest:|river:|snowfield:|keep:'`，应 4 行
- [ ] **Step 6: build** — `npx vite build --mode development`，0 errors
- [ ] **Step 7: 提交** — `git commit -m "feat: MapGenerator 加 forest/river/snowfield/keep 4 地图"`

---

### Task 2: CampaignMode STAGES 扩 10 关 + 字段

**Files:** Modify `src/gameplay/CampaignMode.js`（STAGES 替换为 10 关）

- [ ] **Step 1: STAGES 替换** — 用 node 脚本 fix3.mjs 替换 STAGES 数组（避免 SearchReplace 大块误报）。10 关每项含：`{ name, mapKey, objective, enemyCount, weather, layout, events, difficulty, weapons }`（关卡表见 spec §2）
- [ ] **Step 2: Grep 验证** — `Select-String -Path src/gameplay/CampaignMode.js -Pattern 'STAGES|objective|difficulty|layout:'`，应 10+ 行
- [ ] **Step 3: node --check + build** — `node --check src/gameplay/CampaignMode.js; npx vite build --mode development`，0 errors
- [ ] **Step 4: 提交** — `git commit -m "feat: CampaignMode STAGES 扩 10 关 + objective/layout/events/difficulty 字段"`

---

### Task 3: CampaignMode spawnLayout 4 布局

**Files:** Modify `src/gameplay/CampaignMode.js`（spawnLayout 方法）

- [ ] **Step 1: spawnLayout 按布局分支** — 替换 spawnLayout 方法（用 node 脚本避免误报）：
  ```js
  spawnLayout() {
    const s = this.currentStage;
    const enemies = [];
    const n = s.enemyCount;
    const cx = 160, cz = 0;
    if (s.layout === '线阵') {
      for (let i = 0; i < n; i++) enemies.push({ x: cx, z: -60 + 120/(n-1)*i });
    } else if (s.layout === '方阵') {
      const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n/cols);
      for (let i = 0; i < n; i++) { const r=Math.floor(i/cols), c=i%cols; enemies.push({ x: cx + r*8, z: -60 + 120/(cols-1)*c }); }
    } else if (s.layout === '伏击') {
      for (let i = 0; i < n; i++) enemies.push({ x: cx + (Math.random()-0.5)*40, z: -80 + Math.random()*160 });
    } else {
      for (let i = 0; i < n; i++) { const a = (i/n)*Math.PI*2; enemies.push({ x: cx + Math.cos(a)*144, z: Math.sin(a)*144 }); }
    }
    return { mapKey: s.mapKey, weather: s.weather, enemies, difficulty: s.difficulty, weapons: s.weapons };
  }
  ```
- [ ] **Step 2: Grep 验证** — `Select-String -Path src/gameplay/CampaignMode.js -Pattern '线阵|方阵|伏击|enemies.push'`，应 4+ 行
- [ ] **Step 3: build + 全量单测**
- [ ] **Step 4: 提交** — `git commit -m "feat: CampaignMode spawnLayout 4 布局（环形/线阵/方阵/伏击）"`

---

### Task 4: CampaignMode checkWin 6 目标分支

**Files:** Modify `src/gameplay/CampaignMode.js`（checkWin 方法）

- [ ] **Step 1: checkWin 按 objective 分支** — 替换 checkWin（用 node 脚本）：
  ```js
  checkWin(blueAlive, redAlive, siegeGate, ctx = {}) {
    const s = this.currentStage;
    if (s.objective === '全灭') return !redAlive ? 'blue' : (!blueAlive ? 'red' : null);
    if (s.objective === '攻破城门') return (siegeGate && siegeGate.broken) ? 'blue' : (!blueAlive ? 'red' : null);
    if (s.objective === 'Boss') {
      const boss = ctx.boss;
      if (boss && !boss.alive) return 'blue';
      return !blueAlive ? 'red' : null;
    }
    if (s.objective === '护送') {
      const e = ctx.escortTarget;
      if (e && e.alive && e.pos.distanceTo(e.goal) < 5) return 'blue';
      if (e && !e.alive) return 'red';
      return !blueAlive ? 'red' : null;
    }
    if (s.objective === '防御') {
      if (ctx.defenseTimer !== undefined && ctx.defenseTimer <= 0 && blueAlive) return 'blue';
      return !blueAlive ? 'red' : null;
    }
    if (s.objective === '生存') {
      if (ctx.surviveWavesDone && blueAlive) return 'blue';
      return !blueAlive ? 'red' : null;
    }
    if (s.objective === 'Boss限时') {
      if (ctx.boss && !ctx.boss.alive) return 'blue';
      if (ctx.timeLimit !== undefined && ctx.timeLimit <= 0) return 'red';
      return !blueAlive ? 'red' : null;
    }
    return null;
  }
  ```
- [ ] **Step 2: Grep 验证** — `Select-String -Path src/gameplay/CampaignMode.js -Pattern 'objective ===|ctx\.|escortTarget|defenseTimer|surviveWaves|timeLimit'`，应 10+ 行
- [ ] **Step 3: build**
- [ ] **Step 4: 提交** — `git commit -m "feat: CampaignMode checkWin 6 目标分支（全灭/攻城/Boss/护送/防御/生存/限时）"`

---

### Task 5: CampaignMode onTick 事件系统

**Files:** Modify `src/gameplay/CampaignMode.js`（加 onTick 方法）

- [ ] **Step 1: 加 onTick 方法** — 在 checkWin 后加（用 node 脚本）：
  ```js
  onTick(dt, ctx = {}) {
    const s = this.currentStage;
    if (!s || !s.events) return;
    const ev = s.events;
    if (ev.reinforce && !this._reinforced) {
      const killed = s.enemyCount - (ctx.redAlive || 0);
      if (killed / s.enemyCount >= ev.reinforce) { this._reinforced = true; ctx.spawnReinforce && ctx.spawnReinforce(Math.ceil(s.enemyCount * 0.3)); }
    }
    if (ev.bossPhase && ctx.boss && this._bossPhase < 2) {
      if (ctx.boss.alive && ctx.boss.health.cur / ctx.boss.health.maxHp <= ev.bossPhase) { this._bossPhase = 2; ctx.boss.enterPhase && ctx.boss.enterPhase(2); }
    }
    if (ev.weatherShift && !this._weatherShifted) {
      const progress = ctx.progress || 0;
      if (progress >= ev.weatherShift.at) { this._weatherShifted = true; ctx.setWeather && ctx.setWeather(ev.weatherShift.to); }
    }
  }
  ```
  constructor 加 `this._reinforced = false; this._bossPhase = 1; this._weatherShifted = false;`（skipTo/currentStage 切换时重置）
- [ ] **Step 2: Grep 验证** — `Select-String -Path src/gameplay/CampaignMode.js -Pattern 'onTick|_reinforced|_bossPhase|_weatherShifted|spawnReinforce|enterPhase|setWeather'`，应 8+ 行
- [ ] **Step 3: build**
- [ ] **Step 4: 提交** — `git commit -m "feat: CampaignMode onTick 事件系统（增援/Boss阶段/天气变化）"`

---

### Task 6: EscortTarget + DefensePoint 实体

**Files:** Create `src/gameplay/EscortTarget.js` + `src/gameplay/DefensePoint.js`

- [ ] **Step 1: EscortTarget** — position(THREE.Vector3) + health + goal + alive + mesh（简化为 Box）+ update(dt, player)（距玩家<8 则跟随玩家方向，到 goal 判胜）+ takeDamage
- [ ] **Step 2: DefensePoint** — position + radius + health + alive + mesh（Circle）+ update（简化为空，计时器在 main_entry/campaign 管）
- [ ] **Step 3: Grep 验证** — `Select-String -Path src/gameplay/EscortTarget.js,src/gameplay/DefensePoint.js -Pattern 'class|constructor'`，各 2 行
- [ ] **Step 4: build**
- [ ] **Step 5: 提交** — `git commit -m "feat: EscortTarget 护送实体 + DefensePoint 防御点"`

---

### Task 7: main_entry 集成（onTick + ctx + 目标 spawn + C 键 10 关）

**Files:** Modify `src/main_entry.js`

- [ ] **Step 1: import EscortTarget/DefensePoint** — 加 import
- [ ] **Step 2: spawnAll 加目标 spawn** — 战役模式按 objective：护送 spawn escortTarget（player 附近）+ goal（mapKey 终点）；防御 defenseTimer = stage.defenseTime||60；生存 用 WaveMode；限时 timeLimit = stage.timeLimit||120
- [ ] **Step 3: checkWin 传 ctx** — 316 行 campaign.checkWin 改传 ctx（boss/escortTarget/defenseTimer/surviveWavesDone/timeLimit/redAlive）
- [ ] **Step 4: onTick 调用** — 主循环 onFixed 内加 `campaign.onTick(dt, ctx)`（ctx 含 redAlive/spawnReinforce 回调/boss/progress/setWeather 回调）
- [ ] **Step 5: C 键 10 关** — 307 行 `campaign.stage + 1` 已支持（stage 0-9），确认 flash 显示正确
- [ ] **Step 6: spawnLayout enemies 应用** — spawnAll 用 layout.enemies 替代固定环形（main_entry spawn 红方）
- [ ] **Step 7: Grep 验证** — `Select-String -Path src/main_entry.js -Pattern 'campaign\.onTick|escortTarget|defenseTimer|surviveWaves|timeLimit|EscortTarget|DefensePoint'`，应 8+ 行
- [ ] **Step 8: build + 全量单测**
- [ ] **Step 9: 提交** — `git commit -m "feat: main_entry 集成关卡深化（onTick+ctx+目标spawn+enemies）"`

---

### Task 8: 单测 CampaignMode

**Files:** Create `tests/gameplay/CampaignMode.test.js`

- [ ] **Step 1: 测试** — STAGES 10 项；spawnLayout 4 布局位置（环形圆周/线阵 z 分布/方阵 grid/伏击随机）；checkWin 各 objective（全灭/攻城/Boss/护送/防御/生存/限时）；onStageClear 10 关循环 + campaign_complete；difficulty 应用
- [ ] **Step 2: 跑验证** — `npx vitest run tests/gameplay/CampaignMode.test.js`，EXIT=0
- [ ] **Step 3: 提交** — `git commit -m "test: CampaignMode 10关+4布局+6目标 单测"`

---

### Task 9: 冒烟 + 全量验证

**Files:** Modify `e2e/smoke.spec.js`

- [ ] **Step 1: smoke 加 C 键断言** — C 键 + `#hint` 含"战役：第1关"
- [ ] **Step 2: 跑 Playwright** — `npx playwright test`，应 1 passed（0 error + #affixes-panel + #achievements-panel + C 键）
- [ ] **Step 3: 最终全量** — vitest + build + playwright 全 0
- [ ] **Step 4: 提交** — `git commit -m "test: smoke 增 战役 C 键断言"`
- [ ] **Step 5: 清理临时文件 + git status 干净**

---

## Self-Review

1. **Spec 覆盖**：10 关（Task2/8）、4 地图（Task1）、6 目标（Task4/8）、3 事件（Task5）、4 布局（Task3/8）、难度（Task2）、EscortTarget/DefensePoint（Task6）、main_entry 集成（Task7）、测试（Task8/9）——全覆盖。
2. **Placeholder**：无 TBD，每步含关键代码。
3. **类型一致**：checkWin(ctx) Task4/7 一致；onTick(dt,ctx) Task5/7 一致；spawnLayout layout 字段 Task2/3/7 一致；EscortTarget.pos/goal/alive Task4/6 一致；events.reinforce/bossPhase/weatherShift Task2/5 一致。
4. **SearchReplace 误报防护**：Task2/3/4/5 用 node 脚本 fix3.mjs 替换大块（CampaignMode STAGES/spawnLayout/checkWin/onTick 都是大块替换）；每 Task 含 Grep 验证；Task7 main_entry 每步 Grep。
