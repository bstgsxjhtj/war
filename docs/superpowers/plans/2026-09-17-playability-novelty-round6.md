# 可玩性与新颖性进化计划 Round 6

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 围绕专家评审三大方向（中期目标缺失、博弈感不足、主题差异化），实现战役模式、每日挑战、皮肤解锁、武器克制可见性、近战硬直、骑兵系统、天气战术、兵种阵型共8个子系统，让游戏从"3局就腻"进化到"2周+中期目标"。

**Architecture:** 三层并行推进。方向一（中期目标）新增 CampaignMode/DailyChallenge/WeaponSkins 三个独立模块 + Progression 扩展。方向二（博弈感）在 CombatSystem 和 Character 现有方法上增量修改，不新增文件。方向三（差异化）新增 Cavalry/UnitFormation 模块 + WeatherSystem 扩展。所有新系统通过 main_entry.js 集成，HUD 增加克制指示器。

**Tech Stack:** Three.js 0.160 + Vite 5 + 现有 EventBus/GameState/Skeleton 架构，无新增依赖。

---

## 文件结构

### 新建文件
| 文件 | 职责 |
|------|------|
| `src/gameplay/CampaignMode.js` | 5关PVE战役模式，每关不同地图+敌人+目标 |
| `src/gameplay/DailyChallenge.js` | 每日随机挑战任务生成+完成追踪+localStorage |
| `src/gameplay/WeaponSkins.js` | 武器皮肤定义+解锁条件+材质替换 |
| `src/gameplay/Cavalry.js` | 马匹实体+骑乘状态+马背战斗 |
| `src/gameplay/UnitFormation.js` | 兵种阵型AI（盾阵推进/弓墙齐射） |

### 修改文件
| 文件 | 修改内容 |
|------|----------|
| `src/gameplay/CombatSystem.js` | _emitHit 添加克制闪光 emit + resolveMelee 添加硬直 |
| `src/gameplay/Character.js` | 添加 _stun 字段 + takeDamage 硬直 + 骑乘接口 |
| `src/gameplay/Progression.js` | 添加 campaign/daily/skins 数据 + 解锁逻辑 |
| `src/world/WeatherSystem.js` | 添加 getCombatEffects() 返回天气战斗修正 |
| `src/ui/HUD.js` | 添加克制指示器 + 挑战任务显示 + 战役进度 |
| `src/main_entry.js` | 集成全部新系统 + 键位绑定（C战役/D挑战/V皮肤） |

---

## 方向一：中期目标缺失（最优先）

### Task 1: CampaignMode 战役模式

**Files:**
- Create: `src/gameplay/CampaignMode.js`
- Modify: `src/main_entry.js`（导入+集成，在 M 键模式循环中加入"战役"选项）

- [ ] **Step 1: 创建 CampaignMode.js 基础结构**

```javascript
const STAGES = [
  { name: '渡桥遭遇', mapKey: 'bridge', enemyCount: 3, objective: '全灭敌军', weather: 'clear' },
  { name: '山口伏击', mapKey: 'pass', enemyCount: 4, objective: '全灭敌军', weather: 'rain' },
  { name: '攻城战', mapKey: 'fortress', enemyCount: 5, objective: '攻破城门', weather: 'clear' },
  { name: '风雪遭遇', mapKey: 'field', enemyCount: 6, objective: '全灭敌军', weather: 'snow' },
  { name: '最终决战', mapKey: 'field', enemyCount: 8, objective: '击败Boss', weather: 'storm', isBoss: true }
];

export class CampaignMode {
  constructor(bus) {
    this.bus = bus;
    this.name = '战役';
    this.stage = 0;
    this.maxStages = STAGES.length;
    this.cleared = this._loadCleared();
  }

  _loadCleared() {
    try { return JSON.parse(localStorage.getItem('campaign_cleared') || '0'); } catch (e) { return 0; }
  }
  _saveCleared() {
    try { localStorage.setItem('campaign_cleared', JSON.stringify(this.cleared)); } catch (e) {}
  }

  get currentStage() { return STAGES[Math.min(this.stage, STAGES.length - 1)]; }
  get stageInfo() { return { ...this.currentStage, index: this.stage, total: this.maxStages, cleared: this.cleared }; }

  spawnLayout() {
    const s = this.currentStage;
    const layout = { blue: [{ x: -180, z: 0 }], red: [], weather: s.weather, mapKey: s.mapKey };
    for (let i = 0; i < s.enemyCount; i++) {
      const ang = (i / s.enemyCount) * Math.PI * 2;
      layout.red.push({ x: 180 * Math.cos(ang) * 0.8, z: 160 * Math.sin(ang) * 0.8 });
    }
    return layout;
  }

  checkWin(blueAlive, redAlive, siegeGate) {
    const s = this.currentStage;
    if (!blueAlive) return 'red';
    if (s.objective === '攻破城门' && siegeGate && siegeGate.broken) return 'blue';
    if (!redAlive) return 'blue';
    return null;
  }

  onStageClear() {
    this.cleared = Math.max(this.cleared, this.stage + 1);
    this._saveCleared();
    this.stage++;
    if (this.stage >= this.maxStages) { this.stage = 0; return 'campaign_complete'; }
    return 'next_stage';
  }

  reset() { this.stage = 0; }
  skipTo(stage) { this.stage = Math.min(stage, this.maxStages - 1); }
}
```

- [ ] **Step 2: 在 main_entry.js 导入 CampaignMode**

在 main_entry.js 顶部导入区域，在 `import { Progression, ProgressionUI } from './gameplay/Progression.js';` 之后添加：

```javascript
import { CampaignMode } from './gameplay/CampaignMode.js';
```

- [ ] **Step 3: 在 main_entry.js 初始化 CampaignMode**

在 `const progression = new Progression();` 之后添加：

```javascript
const campaign = new CampaignMode(bus);
```

- [ ] **Step 4: 在 main_entry.js 的 M 键模式切换中加入战役模式**

找到 `modes` 数组定义处（搜索 `const modes =`），在数组末尾 `'训练场'` 之前添加 `'战役'`。然后在 `startRound()` 函数中，找到模式判断逻辑，添加：

```javascript
if (mode.name === '战役') {
  const layout = campaign.spawnLayout();
  currentMapKey = layout.mapKey;
  await loadMap(currentMapKey);
  if (layout.weather) weather.setMode(layout.weather);
}
```

- [ ] **Step 5: 在 checkWin 中添加战役判定**

在 checkWin 函数中，在现有模式分支之前添加：

```javascript
if (mode.name === '战役') {
  const winner = campaign.checkWin(player.alive, ais.some(a => a.alive), siege.gate);
  if (winner === 'blue') {
    const result = campaign.onStageClear();
    if (result === 'campaign_complete') {
      hud.flashEnd('战役通关！按 R 重玩');
      progression.recordWin('S', 0);
      state.transit(States.ENDED);
      resultScreen.show({ kills: playerKills, damage: playerDamage, time: 0, win: true });
    } else {
      hud.flash('关卡通过！按 R 进入下一关');
      state.transit(States.ROUND_END);
      roundEndTimer = 3;
    }
    return;
  } else if (winner === 'red') {
    hud.flashEnd('战役失败！按 R 重试本关');
    state.transit(States.ENDED);
    resultScreen.show({ kills: playerKills, damage: playerDamage, time: 0, win: false });
    return;
  }
  return;
}
```

---

### Task 2: DailyChallenge 每日挑战

**Files:**
- Create: `src/gameplay/DailyChallenge.js`
- Modify: `src/ui/HUD.js`（添加挑战任务显示）
- Modify: `src/main_entry.js`（集成+D键查看）

- [ ] **Step 1: 创建 DailyChallenge.js**

```javascript
const CHALLENGE_POOL = [
  { id: 'kills5', desc: '单局击杀5人', target: 5, type: 'kills', reward: 50 },
  { id: 'kills10', desc: '单局击杀10人', target: 10, type: 'kills', reward: 100 },
  { id: 'perfect3', desc: '完美格挡3次', target: 3, type: 'perfect', reward: 60 },
  { id: 'dodge5', desc: '完美闪避5次', target: 5, type: 'dodge', reward: 60 },
  { id: 'win_s', desc: '以S评分获胜', target: 1, type: 'winGrade', grade: 'S', reward: 120 },
  { id: 'combo3', desc: '3连击以上3次', target: 3, type: 'combo3', reward: 50 },
  { id: 'backstab', desc: '背刺击杀3次', target: 3, type: 'backstab', reward: 80 },
  { id: 'no_damage', desc: '无伤获胜', target: 1, type: 'noDamageWin', reward: 150 },
  { id: 'speedrun', desc: '90秒内获胜', target: 90, type: 'speedWin', reward: 100 },
  { id: 'boss_kill', desc: '击杀Boss', target: 1, type: 'bossKill', reward: 100 }
];

export class DailyChallenge {
  constructor(progression) {
    this.prog = progression;
    this._key = 'daily_challenge';
    this._data = this._load();
    if (this._isExpired()) this._regenerate();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this._key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { date: '', challenges: [], progress: {} };
  }

  _save() {
    try { localStorage.setItem(this._key, JSON.stringify(this._data)); } catch (e) {}
  }

  _todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  }

  _isExpired() { return this._data.date !== this._todayKey(); }

  _regenerate() {
    const pool = [...CHALLENGE_POOL];
    const picked = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    this._data = { date: this._todayKey(), challenges: picked, progress: {}, claimed: false };
    this._save();
  }

  get challenges() {
    return this._data.challenges.map(c => ({
      ...c,
      progress: this._data.progress[c.id] || 0,
      done: (this._data.progress[c.id] || 0) >= c.target
    }));
  }

  get allDone() { return this.challenges.every(c => c.done); }

  track(type, value = 1) {
    let changed = false;
    for (const c of this._data.challenges) {
      if (c.type === type && (this._data.progress[c.id] || 0) < c.target) {
        this._data.progress[c.id] = (this._data.progress[c.id] || 0) + value;
        changed = true;
      }
    }
    if (changed) this._save();
    return changed;
  }

  claim() {
    if (!this.allDone || this._data.claimed) return 0;
    let total = 0;
    for (const c of this._data.challenges) total += c.reward;
    this._data.claimed = true;
    this._save();
    return total;
  }

  resetSession() {
    this._data.progress = {};
    this._save();
  }
}
```

- [ ] **Step 2: 在 Progression.js 添加 addScore 方法（每日挑战领奖需要）**

在 `recordLoss()` 方法之后添加：

```javascript
addScore(n) {
  this._data.score += n;
  this._checkUnlocks();
  this._save();
}
```

- [ ] **Step 3: 在 HUD.js 添加挑战任务显示**

在 HUD 类的 constructor 中，在现有 DOM 创建之后添加：

```javascript
this._challengeEl = document.createElement('div');
this._challengeEl.id = 'daily-challenges';
Object.assign(this._challengeEl.style, {
  position: 'fixed', left: '12px', top: '40%', transform: 'translateY(-50%)',
  zIndex: '11', fontFamily: 'Segoe UI, sans-serif', fontSize: '12px',
  color: '#ddd', textShadow: '0 0 3px #000', pointerEvents: 'none',
  lineHeight: '1.6'
});
document.body.appendChild(this._challengeEl);
this._daily = null;

bus.on('daily.update', (challenges) => {
  this._daily = challenges;
  this._renderChallenges();
});
```

在 HUD 类中添加方法：

```javascript
_renderChallenges() {
  if (!this._daily) { this._challengeEl.innerHTML = ''; return; }
  let html = '<div style="font-weight:bold;color:#ffd700;margin-bottom:4px">每日挑战</div>';
  for (const c of this._daily) {
    const icon = c.done ? '✓' : (c.progress > 0 ? '○' : '·');
    const color = c.done ? '#4f4' : (c.progress > 0 ? '#ffd700' : '#888');
    html += `<div style="color:${color}">${icon} ${c.desc} (${c.progress}/${c.target})</div>`;
  }
  this._challengeEl.innerHTML = html;
}
```

- [ ] **Step 3: 在 main_entry.js 集成 DailyChallenge**

导入：

```javascript
import { DailyChallenge } from './gameplay/DailyChallenge.js';
```

初始化（在 campaign 之后）：

```javascript
const daily = new DailyChallenge(progression);
bus.emit('daily.update', daily.challenges);
```

在 `bus.on('combat.kill', ...)` 监听器中添加：

```javascript
daily.track('kills');
if (victim && victim._isBoss) daily.track('bossKill');
```

在 `bus.on('combat.hit', ...)` 监听器中添加：

```javascript
if (heavy && heavy.perfect) daily.track('perfect');
if (heavy && heavy.dodge) daily.track('dodge');
if (combo >= 3) daily.track('combo3');
if (isBackstab) daily.track('backstab');
bus.emit('daily.update', daily.challenges);
```

注意：`combat.hit` 事件当前 payload 不含 `isBackstab`。需在 CombatSystem.js 的 `_emitHit` 方法中，`bus.emit('combat.hit', {...})` 的 payload 添加 `backstab: !!opts.backstab`（需给 `_emitHit` 增加第9个参数 `backstab = false`），并在 `resolveMelee` 中调用 `_emitHit` 时把 `isBackstab` 传入。上例中 `isBackstab` 即事件 payload 中的 `backstab` 字段。

在 checkWin 蓝方获胜分支中添加：

```javascript
if (playerDamage === 0) daily.track('noDamageWin');
if (time < 90) daily.track('speedWin', time);
const grade = ResultScreen.gradeOf(playerKills, playerDamage, time);
if (grade === 'S') daily.track('winGrade');
const reward = daily.claim();
if (reward > 0) { progression.addScore(reward); hud.flash(`每日挑战完成！+${reward}分`); progressUI.refresh(); }
```

---

### Task 3: WeaponSkins 武器皮肤解锁

**Files:**
- Create: `src/gameplay/WeaponSkins.js`
- Modify: `src/gameplay/Progression.js`（添加皮肤数据）
- Modify: `src/main_entry.js`（V键打开皮肤面板）

- [ ] **Step 1: 创建 WeaponSkins.js**

```javascript
import * as THREE from 'three';

export const SKINS = {
  default: { name: '默认', cost: 0, color: 0x8a8a8a, trim: 0xc0a040, emissive: 0x000000, metalness: 0.6, roughness: 0.4 },
  bronze: { name: '青铜', cost: 100, color: 0xCD7F32, trim: 0xFFD700, emissive: 0x1a0a00, metalness: 0.7, roughness: 0.35 },
  steel: { name: '精钢', cost: 300, color: 0xE8E8F0, trim: 0x4080FF, emissive: 0x000510, metalness: 0.85, roughness: 0.2 },
  obsidian: { name: '黑曜', cost: 600, color: 0x1a1a2e, trim: 0xAA00FF, emissive: 0x100020, metalness: 0.5, roughness: 0.3 },
  dragon: { name: '龙纹', cost: 1000, color: 0x2e1a0a, trim: 0xFF4500, emissive: 0x200500, metalness: 0.6, roughness: 0.25 },
  legend: { name: '传说', cost: 2000, color: 0xFFD700, trim: 0xFF1493, emissive: 0x331100, metalness: 0.9, roughness: 0.15 }
};

export class WeaponSkins {
  constructor(progression) {
    this.prog = progression;
    this._key = 'weapon_skins';
    this._data = this._load();
    if (!this._data.unlocked) this._data.unlocked = { default: true };
    if (!this._data.equipped) this._data.equipped = { 0: 'default', 1: 'default', 2: 'default', 3: 'default' };
  }

  _load() {
    try { return JSON.parse(localStorage.getItem(this._key)) || {}; } catch (e) { return {}; }
  }
  _save() {
    try { localStorage.setItem(this._key, JSON.stringify(this._data)); } catch (e) {}
  }

  get unlocked() { return this._data.unlocked; }
  get equipped() { return this._data.equipped; }

  isUnlocked(id) { return !!this._data.unlocked[id]; }

  unlock(id) {
    const skin = SKINS[id];
    if (!skin || this.isUnlocked(id)) return false;
    if (this.prog.score < skin.cost) return false;
    this._data.unlocked[id] = true;
    this._save();
    return true;
  }

  equip(weaponIdx, skinId) {
    if (!this.isUnlocked(skinId)) return false;
    this._data.equipped[weaponIdx] = skinId;
    this._save();
    return true;
  }

  getEquippedSkin(weaponIdx) {
    const id = this._data.equipped[weaponIdx] || 'default';
    return SKINS[id] || SKINS.default;
  }

  applyToWeapon(weaponMesh, weaponIdx) {
    const skin = this.getEquippedSkin(weaponIdx);
    if (!weaponMesh) return;
    weaponMesh.traverse(obj => {
      if (obj.isMesh && obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => {
            if (m.isMeshStandardMaterial) {
              m.color.setHex(skin.color);
              m.emissive.setHex(skin.emissive);
              m.metalness = skin.metalness;
              m.roughness = skin.roughness;
            }
          });
        } else if (obj.material.isMeshStandardMaterial) {
          obj.material.color.setHex(skin.color);
          obj.material.emissive.setHex(skin.emissive);
          obj.material.metalness = skin.metalness;
          obj.material.roughness = skin.roughness;
        }
      }
    });
  }
}

export class WeaponSkinsUI {
  constructor(skins, bus) {
    this.skins = skins;
    this.bus = bus;
    this.el = document.createElement('div');
    this.el.id = 'skins-panel';
    Object.assign(this.el.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: '480px', maxHeight: '80vh', overflowY: 'auto', zIndex: '80',
      background: 'rgba(15,15,25,.95)', borderRadius: '12px', padding: '20px',
      border: '2px solid rgba(180,160,80,.5)', display: 'none', fontFamily: 'Segoe UI, sans-serif',
      color: '#ddd', boxShadow: '0 0 30px rgba(0,0,0,.6)'
    });
    document.body.appendChild(this.el);
    this._render();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'v' || e.key === 'V') { this.el.style.display = this.el.style.display === 'none' ? 'block' : 'none'; }
      if (e.key === 'Escape') this.el.style.display = 'none';
    });
  }

  _render() {
    let html = '<h2 style="margin:0 0 16px;color:#ffd700;text-align:center">武器皮肤</h2>';
    const weaponNames = ['刀', '弓', '枪', '锤'];
    for (let w = 0; w < 4; w++) {
      html += `<div style="margin-bottom:12px"><div style="font-weight:bold;margin-bottom:6px;color:#8af">${weaponNames[w]}</div>`;
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
      for (const [id, skin] of Object.entries(SKINS)) {
        const unlocked = this.skins.isUnlocked(id);
        const equipped = (this.skins.equipped[w] || 'default') === id;
        const cls = equipped ? 'border:2px solid #ffd700;background:rgba(255,215,0,.15)' : (unlocked ? 'border:1px solid #555' : 'border:1px solid #333;opacity:.4');
        const label = unlocked ? skin.name : `${skin.name}(${skin.cost}分)`;
        html += `<div data-weapon="${w}" data-skin="${id}" class="skin-card" style="${cls};padding:6px 10px;border-radius:6px;cursor:pointer;flex:1;min-width:60px;text-align:center;font-size:12px">${label}</div>`;
      }
      html += '</div></div>';
    }
    html += '<div style="text-align:center;margin-top:12px;color:#888;font-size:12px">点击装备已解锁皮肤 · V键关闭</div>';
    this.el.innerHTML = html;
    this.el.querySelectorAll('.skin-card').forEach(card => {
      card.addEventListener('click', () => {
        const w = parseInt(card.dataset.weapon);
        const s = card.dataset.skin;
        if (this.skins.isUnlocked(s)) {
          this.skins.equip(w, s);
          this.bus.emit('skins.changed', { weaponIdx: w, skinId: s });
          this._render();
        } else {
          if (this.skins.unlock(s)) {
            this.bus.emit('skins.changed', { weaponIdx: w, skinId: s });
            this._render();
          }
        }
      });
    });
  }

  refresh() { this._render(); }
}
```

- [ ] **Step 2: 在 main_entry.js 集成 WeaponSkins**

导入：

```javascript
import { WeaponSkins, WeaponSkinsUI } from './gameplay/WeaponSkins.js';
```

初始化（在 daily 之后）：

```javascript
const skins = new WeaponSkins(progression);
const skinsUI = new WeaponSkinsUI(skins, bus);
```

在 spawnAll 函数中，给 AI 装备武器之后，给 player 武器应用皮肤：

```javascript
if (player._weaponMesh) {
  skins.applyToWeapon(player._weaponMesh, player.weaponIdx);
}
bus.on('skins.changed', () => {
  if (player._weaponMesh) skins.applyToWeapon(player._weaponMesh, player.weaponIdx);
});
```

---

## 方向二：博弈感不足

### Task 4: 武器克制可见性

**Files:**
- Modify: `src/gameplay/CombatSystem.js`（_emitHit 添加克制闪光 emit）
- Modify: `src/ui/HUD.js`（添加克制指示器）

- [ ] **Step 1: 在 WeatherSystem.js 添加 setMode 方法（战役关卡需要直接设置天气）**

在 WeatherSystem 类的 `toggle()` 方法之前添加：

```javascript
setMode(mode) {
  if (this._modes && this._modes.indexOf(mode) >= 0) {
    this._mode = mode;
    this.apply();
  }
}
```

若构造函数中无 `this._modes`，在构造函数中初始化 `this._modes = ['clear', 'rain', 'night', 'snow', 'storm'];` 并将 `toggle()` 内的 modes 数组改为使用 `this._modes`。

- [ ] **Step 2: 在 CombatSystem._emitHit 中添加克制判定和 emit**

在 CombatSystem.js 的 `_emitHit` 方法中，在 `bus.emit('combat.hit', {...})` 之前添加克制判定：

```javascript
const counterMul = this._counterMul(attacker._weapons ? attacker._weapons[attacker.weaponIdx] : null, victim._weapons ? victim._weapons[victim.weaponIdx] : null);
const isCounter = counterMul > 1.2;
if (isCounter) {
  this.bus.emit('combat.counter', { attacker, victim, mul: counterMul });
}
```

- [ ] **Step 2: 在 HUD 中添加克制指示器**

在 HUD constructor 中添加：

```javascript
this._counterEl = document.createElement('div');
this._counterEl.id = 'counter-indicator';
Object.assign(this._counterEl.style, {
  position: 'fixed', top: '35%', left: '50%', transform: 'translate(-50%,-50%)',
  fontSize: '28px', fontWeight: 'bold', fontFamily: 'Segoe UI, sans-serif',
  color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,.8)', zIndex: '13',
  pointerEvents: 'none', display: 'none', opacity: '0', transition: 'opacity 0.3s'
});
document.body.appendChild(this._counterEl);
this._counterTimer = 0;

bus.on('combat.counter', ({ attacker, victim, mul }) => {
  const isPlayerAttacker = attacker && attacker.isLocal;
  const isPlayerVictim = victim && victim.isLocal;
  if (isPlayerAttacker) {
    this._counterEl.textContent = '克制! x' + mul.toFixed(1);
    this._counterEl.style.color = '#4f4';
  } else if (isPlayerVictim) {
    this._counterEl.textContent = '被克制!';
    this._counterEl.style.color = '#f44';
  } else return;
  this._counterEl.style.display = 'block';
  this._counterEl.style.opacity = '1';
  this._counterTimer = 1.5;
});
```

在 HUD.update(dt) 中添加：

```javascript
if (this._counterTimer > 0) {
  this._counterTimer -= dt;
  if (this._counterTimer < 0.5) this._counterEl.style.opacity = (this._counterTimer / 0.5).toString();
  if (this._counterTimer <= 0) { this._counterEl.style.display = 'none'; }
}
```

---

### Task 5: 近战命中硬直

**Files:**
- Modify: `src/gameplay/Character.js`（添加 _stun 字段 + takeDamage 硬直）
- Modify: `src/gameplay/CombatSystem.js`（resolveMelee 命中后施加硬直）

- [ ] **Step 1: 在 Character.js 构造函数中添加 _stun 字段**

在构造函数中 `_iFrame = 0` 附近添加：

```javascript
this._stun = 0;
```

- [ ] **Step 2: 在 Character.update 中处理硬直**

在 update 方法中，在 `if (this._iFrame > 0)` 之后添加：

```javascript
if (this._stun > 0) {
  this._stun -= dt;
  this._hurt = true;
  moveSpeed *= 0.3;
  if (this._attacking) { this._attacking = false; this._anim = 'hurt'; }
}
```

- [ ] **Step 3: 在 Character.takeDamage 中添加硬直触发**

在 takeDamage 方法中，在 `this._iFrame = 0.15` 之后添加：

```javascript
this._stun = heavy ? 0.3 : 0.15;
```

- [ ] **Step 4: 在 CombatSystem.resolveMelee 中施加硬直**

在 resolveMelee 方法中，在 `c.takeDamage(dmg, heavy||isBackstab, attacker, now)` 之后，硬直已在 takeDamage 内部设置，无需额外代码。但需要在弓箭命中时也添加硬直，在 spawnArrow 命中判定处，在 `c.takeDamage(dmg, ...)` 之后添加：

```javascript
c._stun = 0.15;
```

---

## 方向三：主题差异化

### Task 6: Cavalry 骑兵系统

**Files:**
- Create: `src/gameplay/Cavalry.js`
- Modify: `src/gameplay/Character.js`（添加骑乘接口）
- Modify: `src/main_entry.js`（集成骑兵敌人）

- [ ] **Step 1: 创建 Cavalry.js**

```javascript
import * as THREE from 'three';

export class Horse {
  constructor(scene) {
    this.scene = scene;
    this._pool = [];
  }

  create() {
    const g = new THREE.Group();
    const matBody = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.7, metalness: 0.1 });
    const matMane = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const matHoof = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.5), matBody);
    body.position.y = 1.8; body.castShadow = true;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), matBody);
    neck.position.set(0.9, 2.1, 0); neck.rotation.z = -0.3; neck.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), matBody);
    head.position.set(1.2, 2.3, 0); head.castShadow = true;
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.1), matMane);
    mane.position.set(0.5, 2.15, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), matMane);
    tail.position.set(-0.9, 1.9, 0); tail.rotation.z = 0.5;

    const legs = [];
    for (const [x, z] of [[0.6, 0.2], [0.6, -0.2], [-0.6, 0.2], [-0.6, -0.2]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 1.4), matBody);
      leg.position.set(x, 0.7, z); leg.castShadow = true;
      legs.push(leg);
    }
    const saddles = [];
    for (const [x, z] of [[0.6, 0.2], [0.6, -0.2], [-0.6, 0.2], [-0.6, -0.2]]) {
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1), matHoof);
      hoof.position.set(x, 0.05, z);
      saddles.push(hoof);
    }

    g.add(body, neck, head, mane, tail, ...legs, ...saddles);
    this.scene.add(g);
    const horse = { group: g, body, legs, speed: 0, rider: null, update: (dt) => this._updateHorse(horse, dt) };
    this._pool.push(horse);
    return horse;
  }

  _updateHorse(horse, dt) {
    if (!horse.rider) return;
    const rider = horse.rider;
    const riderPos = rider.mesh.position;
    horse.group.position.set(riderPos.x, riderPos.y - 1.5, riderPos.z);
    horse.group.rotation.y = rider.mesh.rotation.y;
    const moveSpeed = Math.abs(rider._moveF || 0) + Math.abs(rider._moveR || 0);
    horse.speed = moveSpeed > 0.1 ? 1 : 0;
    if (horse.speed > 0) {
      const t = performance.now() * 0.008;
      horse.legs.forEach((leg, i) => {
        const phase = i * Math.PI / 2;
        leg.position.y = 0.7 + Math.sin(t + phase) * 0.15;
      });
    }
  }

  update(dt) { for (const h of this._pool) h.update(dt); }
  dispose() { for (const h of this._pool) this.scene.remove(h.group); this._pool = []; }
}

export class CavalryEnemy extends AIController {
  constructor({ team = 1 } = {}) {
    super({ team });
    this._isCavalry = true;
    this.maxHp = 120;
    this.hp = 120;
    this.speed = 9;
    this._horse = null;
    this._name = '骑兵';
  }

  mount(horse) { this._horse = horse; horse.rider = this; }
  unmount() { if (this._horse) { this._horse.rider = null; this._horse = null; } }

  update(dt, terrain, combat, enemies, now) {
    super.update(dt, terrain, combat, enemies, now);
    if (this._horse && this.mesh) {
      this.mesh.position.y = terrain.heightAt(this.mesh.position.x, this.mesh.position.z) + 1.5;
    }
  }
}
```

需要在文件顶部添加 AIController 导入：

```javascript
import { AIController } from './AIController.js';
```

- [ ] **Step 2: 在 main_entry.js 集成骑兵**

导入：

```javascript
import { Horse, CavalryEnemy } from './gameplay/Cavalry.js';
```

初始化（在 skins 之后）：

```javascript
const horses = new Horse(scene.scene);
```

在 spawnAll 函数中，AI 创建逻辑里添加骑兵（在 EliteEnemy 判断之后）：

```javascript
if (i === 2 && mode.name !== '训练场' && progression.score >= 500) {
  ai = new CavalryEnemy({ team: 1 });
  const horse = horses.create();
  ai.mount(horse);
}
```

在游戏循环中添加 `horses.update(dt);`

---

### Task 7: 天气战术效果

**Files:**
- Modify: `src/world/WeatherSystem.js`（添加 getCombatEffects 方法）
- Modify: `src/gameplay/Character.js`（update 中应用天气修正）
- Modify: `src/gameplay/CombatSystem.js`（弓箭在雨/雪天精度下降）

- [ ] **Step 1: 在 WeatherSystem.js 添加 getCombatEffects 方法**

在 WeatherSystem 类中添加：

```javascript
getCombatEffects() {
  switch (this._mode) {
    case 'rain':
      return { speedMul: 0.85, bowAccuracy: 0.7, staminaRegenMul: 0.9, visibility: 0.8 };
    case 'snow':
      return { speedMul: 0.75, bowAccuracy: 0.5, staminaRegenMul: 0.8, visibility: 0.6 };
    case 'storm':
      return { speedMul: 0.7, bowAccuracy: 0.4, staminaRegenMul: 0.7, visibility: 0.5 };
    case 'night':
      return { speedMul: 1.0, bowAccuracy: 0.6, staminaRegenMul: 1.0, visibility: 0.7 };
    default:
      return { speedMul: 1.0, bowAccuracy: 1.0, staminaRegenMul: 1.0, visibility: 1.0 };
  }
}
```

- [ ] **Step 2: 在 Character.update 中应用天气修正**

在 update 方法中，在 `moveSpeed` 计算之后（在涉水减速之后）添加：

```javascript
if (this._weatherEffects) {
  moveSpeed *= this._weatherEffects.speedMul || 1;
}
```

在耐力恢复逻辑处添加：

```javascript
const staminaMul = (this._weatherEffects && this._weatherEffects.staminaRegenMul) || 1;
this.stamina.regen(staminaRegen * staminaMul * dt);
```

- [ ] **Step 3: 在 main_entry.js 游戏循环中传入天气效果**

在游戏循环中 player.update 和 ai.update 之前添加：

```javascript
const weatherFx = weather.getCombatEffects();
player._weatherEffects = weatherFx;
for (const ai of ais) ai._weatherEffects = weatherFx;
```

- [ ] **Step 4: 在 CombatSystem.spawnArrow 中添加天气精度修正**

在 spawnArrow 方法中，在箭矢速度方向计算之后，添加随机散布：

```javascript
const weatherFx = this._weatherEffects || { bowAccuracy: 1.0 };
const accuracy = weatherFx.bowAccuracy;
if (accuracy < 1.0) {
  const spread = (1 - accuracy) * 0.3;
  vel.x += (Math.random() - 0.5) * spread * 10;
  vel.y += (Math.random() - 0.5) * spread * 10;
  vel.z += (Math.random() - 0.5) * spread * 10;
}
```

在 CombatSystem 构造函数中添加 `this._weatherEffects = null;`，在 main_entry.js 游戏循环中添加 `combat._weatherEffects = weatherFx;`

---

### Task 8: UnitFormation 兵种阵型

**Files:**
- Create: `src/gameplay/UnitFormation.js`
- Modify: `src/gameplay/AIController.js`（添加阵型接口）
- Modify: `src/main_entry.js`（集成阵型AI）

- [ ] **Step 1: 创建 UnitFormation.js**

```javascript
import * as THREE from 'three';

export const FORMATIONS = {
  SHIELD_WALL: 'shield_wall',
  ARCHER_LINE: 'archer_line',
  WEDGE: 'wedge'
};

export class UnitFormation {
  constructor(type, leader, members = []) {
    this.type = type;
    this.leader = leader;
    this.members = members;
    this._offsets = this._calcOffsets();
  }

  _calcOffsets() {
    const offsets = [];
    switch (this.type) {
      case FORMATIONS.SHIELD_WALL:
        for (let i = 0; i < this.members.length; i++) {
          const row = Math.floor(i / 3);
          const col = i % 3;
          offsets.push(new THREE.Vector3((col - 1) * 1.5, 0, row * 1.5));
        }
        break;
      case FORMATIONS.ARCHER_LINE:
        for (let i = 0; i < this.members.length; i++) {
          offsets.push(new THREE.Vector3((i - this.members.length / 2) * 1.8, 0, 0));
        }
        break;
      case FORMATIONS.WEDGE:
        for (let i = 0; i < this.members.length; i++) {
          const row = Math.floor(i / 2) + 1;
          const side = (i % 2 === 0) ? 1 : -1;
          offsets.push(new THREE.Vector3(side * row * 0.8, 0, row * 1.2));
        }
        break;
    }
    return offsets;
  }

  getTargetPos(memberIdx, leaderPos, leaderYaw) {
    const offset = this._offsets[memberIdx] || new THREE.Vector3();
    const cos = Math.cos(leaderYaw), sin = Math.sin(leaderYaw);
    return new THREE.Vector3(
      leaderPos.x + offset.x * cos + offset.z * sin,
      leaderPos.y,
      leaderPos.z - offset.x * sin + offset.z * cos
    );
  }

  update(members, dt) {
    if (!this.leader) return;
    const leaderPos = this.leader.mesh.position;
    const leaderYaw = this.leader.mesh.rotation.y;
    for (let i = 0; i < members.length && i < this._offsets.length; i++) {
      const m = members[i];
      if (!m || !m.alive) continue;
      const target = this.getTargetPos(i, leaderPos, leaderYaw);
      const dx = target.x - m.mesh.position.x;
      const dz = target.z - m.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.5) {
        m._formationTarget = target;
        m._formationYaw = Math.atan2(dx, dz);
      }
    }
  }
}

export class FormationController {
  constructor() {
    this._formations = [];
  }

  createShieldWall(leader, members) {
    const f = new UnitFormation(FORMATIONS.SHIELD_WALL, leader, members);
    this._formations.push(f);
    return f;
  }

  createArcherLine(leader, members) {
    const f = new UnitFormation(FORMATIONS.ARCHER_LINE, leader, members);
    this._formations.push(f);
    return f;
  }

  update(dt) {
    for (const f of this._formations) f.update(f.members, dt);
  }

  clear() { this._formations = []; }
}
```

- [ ] **Step 2: 在 AIController.js 添加阵型目标字段**

在 AIController 构造函数中添加：

```javascript
this._formationTarget = null;
this._formationYaw = null;
```

在 AIController.update 的巡逻逻辑中，在 `_pickPatrol` 之前添加：

```javascript
if (this._formationTarget) {
  this._patrolTarget.copy(this._formationTarget);
  if (this._formationYaw !== null) this._desiredYaw = this._formationYaw;
}
```

- [ ] **Step 3: 在 main_entry.js 集成阵型系统**

导入：

```javascript
import { FormationController } from './gameplay/UnitFormation.js';
```

初始化：

```javascript
const formations = new FormationController();
```

在 spawnAll 函数中，AI 创建完成后，根据模式创建阵型：

```javascript
if (mode.name !== '训练场' && ais.length >= 3) {
  const shieldUsers = ais.filter(a => a._weapons && a._weapons[0] && a._weapons[0].weaponClass === 'SHIELD');
  const bowUsers = ais.filter(a => a._weapons && a._weapons[0] && a._weapons[0].weaponClass === 'BOW');
  if (shieldUsers.length >= 2) formations.createShieldWall(shieldUsers[0], shieldUsers.slice(1));
  if (bowUsers.length >= 2) formations.createArcherLine(bowUsers[0], bowUsers.slice(1));
}
```

在游戏循环中添加 `formations.update(dt);`

在 restart/loadMap 函数中添加 `formations.clear();`

---

## 集成与验证

### Task 9: 全系统集成与键位绑定

**Files:**
- Modify: `src/main_entry.js`

- [ ] **Step 1: 添加所有键位绑定**

在 main_entry.js 的键盘事件监听中添加：

```javascript
if (e.key === 'c' || e.key === 'C') { /* 战役模式信息显示 */ hud.flash(`战役：第${campaign.stage + 1}关 ${campaign.currentStage.name}`); }
```

V 键已在 WeaponSkinsUI 中绑定。D 键显示每日挑战状态：

```javascript
if (e.key === 'd' || e.key === 'D') {
  const done = daily.challenges.filter(c => c.done).length;
  hud.flash(`每日挑战：${done}/${daily.challenges.length} 完成`);
}
```

- [ ] **Step 2: 在 HUD 中添加战役进度显示**

在 HUD.setMode 方法中扩展，添加战役进度：

```javascript
setMode(name, stageInfo) {
  if (stageInfo) {
    this._modeEl.textContent = `${name} · ${stageInfo.name} (${stageInfo.index + 1}/${stageInfo.total})`;
  } else {
    this._modeEl.textContent = name;
  }
}
```

在 main_entry.js 的游戏循环中，当 mode.name === '战役' 时：

```javascript
hud.setMode('战役', campaign.stageInfo);
```

---

### Task 10: 验证与回归测试

- [ ] **Step 1: 验证Vite编译无错误**

Run: `npx vite build --mode development`
Expected: 0 errors

- [ ] **Step 2: 验证server.js语法**

Run: `node --check server.js`
Expected: exit 0

- [ ] **Step 3: 浏览器运行时错误监控**

导航到游戏页面，注入错误捕获，等待8秒，验证0条错误。

- [ ] **Step 4: 验证新功能存在**

检查DOM元素：
- `#daily-challenges` 存在且显示3个挑战
- `#skins-panel` 存在（V键可打开）
- `#counter-indicator` 存在
- 顶部进度条显示段位

- [ ] **Step 5: 验证游戏循环完整**

检查HUD显示"模式"包含正确信息，比分正常更新，4把武器可见。

- [ ] **Step 6: 验证战役模式**

按M切换到"战役"模式，检查HUD显示关卡名和进度（第X关/共5关）。

- [ ] **Step 7: 验证皮肤面板**

按V打开皮肤面板，检查6种皮肤显示，默认皮肤已装备。

- [ ] **Step 8: 回归测试现有功能**

验证骨骼动画、多地图切换、结算页、小地图、进度系统仍正常工作。
