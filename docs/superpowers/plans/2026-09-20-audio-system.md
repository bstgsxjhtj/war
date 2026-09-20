# 音效系统深化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`). **重要：SearchReplace 偶发误报，每处编辑后 Grep 验证，若丢失用 node 脚本 fix.mjs 行级处理。AudioEngine 用 Write 完整重写。**

**Goal:** 事件绑定（9 事件）+ 环境音 + UI 音 + 脚步 + 连击音调 + 分类型音量 + resume。

**集成点（已读确认）：**
- `src/audio/AudioEngine.js` 53 行：constructor（3-7）/swing/hit/footstep/block/ultimate/dodge（17-22）/_tone（24-36）/_noise（38-52）
- `src/main_entry.js` 38 import + 163 实例化 + bus.on combat.hit（141）/combat.kill（154/210）/fx.perfectBlock（137）/fx.perfectDodge（138）/achievement.unlock（109）/skill.cast（106）/boss.summon（116）/hud.bossPhase（无，需加）/combo.tier（无，需加）
- `src/gameplay/Character.js` 295 setAudio + update（移动逻辑 Grep `_moving|setMove` 确认）
- `src/world/WeatherSystem.js` setMode（Grep 确认行号）

---

### Task 1: AudioEngine 深化 + 单测（TDD）

**Files:** Write `src/audio/AudioEngine.js`（完整重写）+ Create `tests/audio/AudioEngine.test.js`

- [ ] **Step 1: 写失败测试** — tests/audio/AudioEngine.test.js（playSound 各 type：swing/hit/block/dodge/ultimate/click/achievement/kill；setVolume 分类型 master/sfx/bgm/env + 持久化；resume mock ctx.state='suspended' → resume 调用；environment 切换 mock _envSource stop；achievement 3 音上扬）。mock AudioContext = { currentTime:0, createOscillator:vi.fn(()=>({type,frequency:{setValueAtTime,exponentialRampToValueAtTime},connect,start,stop})), createGain:vi.fn(()=>({gain:{setValueAtTime,exponentialRampToValueAtTime},connect})), createBuffer:vi.fn, createBufferSource:vi.fn, createBiquadFilter:vi.fn, destination:{}, resume:vi.fn, state:'suspended' }。jsdom 无 AudioContext，测试 mock window.AudioContext。
- [ ] **Step 2: 跑验证失败** — `npx vitest run tests/audio/AudioEngine.test.js`，应 FAIL
- [ ] **Step 3: Write 完整 AudioEngine.js** — 现有 6 方法 + 新：
  ```js
  export class AudioEngine {
    constructor() { this.ctx = null; this._vol = 0.7; this._sfxVol = 0.8; this._bgmVol = 0.5; this._envVol = 0.4; this._envSource = null; this._init(); this._loadVolume(); }
    _init() { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    setVolume(type, v) { v = Math.max(0, Math.min(1, v)); if (type === 'master') this._vol = v; else if (type === 'sfx') this._sfxVol = v; else if (type === 'bgm') this._bgmVol = v; else if (type === 'env') this._envVol = v; this._saveVolume(); }
    _volOf(type) { const m = this._vol; if (type === 'sfx') return m * this._sfxVol; if (type === 'bgm') return m * this._bgmVol; if (type === 'env') return m * this._envVol; return m; }
    playSound(type, opts = {}) {
      if (type === 'swing') this.swing();
      else if (type === 'hit') this.hit(opts.heavy, opts.combo);
      else if (type === 'block') this.block();
      else if (type === 'dodge') this.dodge();
      else if (type === 'ultimate' || type === 'kill') this.ultimate();
      else if (type === 'click') this.click();
      else if (type === 'achievement') this.achievement();
      else if (type === 'environment') this.environment(opts.mode);
    }
    swing() { this._tone(200, 0.09, 'sine', this._volOf('sfx') * 0.18, 80); }
    hit(heavy = false, combo = 0) { const f = Math.min(800, 250 + combo * 50); this._noise(heavy ? 0.28 : 0.14, heavy ? 500 : f, this._volOf('sfx') * (heavy ? 0.4 : 0.3)); }
    footstep() { this._noise(0.05, 90, this._volOf('sfx') * 0.12); }
    block() { this._tone(700, 0.12, 'square', this._volOf('sfx') * 0.22, 400); }
    ultimate() { this._tone(120, 0.5, 'sawtooth', this._volOf('sfx') * 0.35, 60); this._noise(0.4, 800, this._volOf('sfx') * 0.3); }
    dodge() { this._tone(400, 0.1, 'triangle', this._volOf('sfx') * 0.15, 200); }
    click() { this._tone(600, 0.05, 'square', this._volOf('sfx') * 0.15, 400); }
    achievement() { const t = this.ctx ? this.ctx.currentTime : 0; [523, 659, 784].forEach((f, i) => { this._toneAt(f, 0.15, 'triangle', this._volOf('sfx') * 0.2, t + i * 0.12); }); }
    environment(mode) { if (this._envSource) { try { this._envSource.stop(); } catch (e) {} this._envSource = null; } if (!this.ctx || mode === 'clear' || mode === 'night') return; const freq = mode === 'rain' ? 800 : (mode === 'snow' ? 400 : 1200); const len = this.ctx.sampleRate * 2; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = this.ctx.createGain(); g.gain.value = this._volOf('env') * 0.15; src.connect(f).connect(g).connect(this.ctx.destination); src.start(); this._envSource = src; }
    _tone(freq, dur, type, vol, endFreq) { this._toneAt(freq, dur, type, vol, this.ctx ? this.ctx.currentTime : 0, endFreq); }
    _toneAt(freq, dur, type, vol, t, endFreq) { if (!this.ctx) return; const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur); }
    _noise(dur, filterFreq, vol) { if (!this.ctx) return; const len = this.ctx.sampleRate * dur; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; const src = this.ctx.createBufferSource(); src.buffer = buf; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq; const g = this.ctx.createGain(); const t = this.ctx.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); src.connect(f).connect(g).connect(this.ctx.destination); src.start(t); }
    _saveVolume() { try { localStorage.setItem('audio_volume', JSON.stringify({ master: this._vol, sfx: this._sfxVol, bgm: this._bgmVol, env: this._envVol })); } catch (e) {} }
    _loadVolume() { try { const d = localStorage.getItem('audio_volume'); if (d) { const v = JSON.parse(d); this._vol = v.master ?? 0.7; this._sfxVol = v.sfx ?? 0.8; this._bgmVol = v.bgm ?? 0.5; this._envVol = v.env ?? 0.4; } } catch (e) {} }
  }
  ```
- [ ] **Step 4: 跑验证通过** — EXIT=0
- [ ] **Step 5: Grep 验证** — `Select-String -Path src/audio/AudioEngine.js -Pattern 'playSound|setVolume|environment|achievement|_volOf'`，应 5+ 行
- [ ] **Step 6: 提交** — `git commit -m "feat: AudioEngine 深化（playSound+分类型音量+环境音+UI音） + 单测"`

---

### Task 2: main_entry 事件绑定 + resume + setAudio 注入

**Files:** Modify `src/main_entry.js`

- [ ] **Step 1: bus.on 音效绑定**（9 事件，在现有 bus.on 区加或复用现有 handler 内调 audio）：
  - combat.hit 现有 141 handler 内加 `audio.playSound('swing'); audio.playSound('hit', { heavy: p.heavy, combo: p.combo });`
  - combat.kill 现有 154/210 handler 内加 `audio.playSound('ultimate');`
  - fx.perfectBlock 现有 137 内加 `audio.playSound('block');`
  - fx.perfectDodge 现有 138 内加 `audio.playSound('dodge');`
  - achievement.unlock 现有 109 内加 `audio.playSound('achievement');`
  - skill.cast 现有 106 内加 `audio.playSound('ultimate');`
  - boss.summon 现有 116 内加 `audio.playSound('ultimate');`
  - 新加 bus.on('hud.bossPhase', () => audio.playSound('ultimate'));
  - 新加 bus.on('combo.tier', (p) => audio.playSound('hit', { combo: p.combo || 0 }));
- [ ] **Step 2: 首次交互 resume**（audio 实例化 163 后）：
  ```js
  const _resumeOnce = () => { audio.resume(); window.removeEventListener('keydown', _resumeOnce); window.removeEventListener('mousedown', _resumeOnce); };
  window.addEventListener('keydown', _resumeOnce); window.addEventListener('mousedown', _resumeOnce);
  ```
- [ ] **Step 3: Character.setAudio 注入**（spawnAll 内 player 创建后 + AI spawn 后）：
  `player.setAudio(audio); for (const ai of ais) ai.setAudio(audio);`
- [ ] **Step 4: WeatherSystem 环境音**（weather.setMode 后 + bus 无 weather 事件则直接调）：
  loadMap/重启时 `audio.environment(weather._mode || 'clear');` 或 weather.setMode 内调（Task 4 改 WeatherSystem）
- [ ] **Step 5: Grep 验证** — `Select-String -Path src/main_entry.js -Pattern 'audio\.playSound|audio\.resume|setAudio|_resumeOnce'`，应 10+ 行
- [ ] **Step 6: build + 全量单测**
- [ ] **Step 7: 提交** — `git commit -m "feat: main_entry 绑定音效事件 + resume + setAudio 注入"`

---

### Task 3: Character 脚步音

**Files:** Modify `src/gameplay/Character.js`

- [ ] **Step 1: constructor 加 _footstepTimer** — `this._footstepTimer = 0;`
- [ ] **Step 2: update 加脚步触发** — 在移动逻辑后（Grep `setMove\(` 确认位置）加：
  ```js
    if (this._footstepTimer > 0) this._footstepTimer -= dt;
    if (this._moving && this._footstepTimer <= 0 && this._audio) { this._audio.footstep(); this._footstepTimer = 0.35; }
  ```
  注意：`this._moving` 字段需 Grep 确认（若无用 `this._moveDir.lengthSq() > 0` 或 setMove 后设标志）
- [ ] **Step 3: Grep 验证** — `Select-String -Path src/gameplay/Character.js -Pattern '_footstepTimer|footstep'`，应 3+ 行
- [ ] **Step 4: build + 单测**
- [ ] **Step 5: 提交** — `git commit -m "feat: Character 移动脚步音"`

---

### Task 4: WeatherSystem 环境音

**Files:** Modify `src/world/WeatherSystem.js`

- [ ] **Step 1: setMode 后触发环境音** — Grep `setMode` 确认行号，setMode 末尾加 `if (this._audio) this._audio.environment(mode);`
- [ ] **Step 2: setAudio 方法** — `setAudio(a) { this._audio = a; }`
- [ ] **Step 3: main_entry 注入** — Task 2 Step 3 weather 实例化后 `weather.setAudio(audio);`（若 Task 2 未加，此处补）
- [ ] **Step 4: Grep 验证** — `Select-String -Path src/world/WeatherSystem.js -Pattern 'setAudio|environment|_audio'`，应 3+ 行
- [ ] **Step 5: build**
- [ ] **Step 6: 提交** — `git commit -m "feat: WeatherSystem 天气环境音"`

---

### Task 5: 冒烟 + 全量验证

**Files:** e2e/smoke.spec.js（无需改，0 error 覆盖）

- [ ] **Step 1: 跑 Playwright** — `npx playwright test`，应 1 passed（0 error，AudioContext 在浏览器正常）
- [ ] **Step 2: 最终全量** — vitest + build + playwright 全 0
- [ ] **Step 3: 清理临时文件 + git status 干净**

---

## Self-Review

1. **Spec 覆盖**：事件绑定（Task2）、环境音（Task1+4）、UI 音（Task1）、脚步（Task3）、连击音调（Task1 hit opts.combo + Task2 combo.tier）、音量（Task1）、resume（Task2）——全覆盖。
2. **Placeholder**：无 TBD，每步含关键代码。
3. **类型一致**：playSound(type, opts) Task1/2 一致；_volOf(type) Task1 一致；environment(mode) Task1/2/4 一致；setAudio(a) Character/WeatherSystem + Task2 注入一致；_footstepTimer Task3 一致。
4. **SearchReplace 误报防护**：Task1 AudioEngine 用 Write 完整重写；Task2 main_entry 每步 Grep；Task3/4 小改 Grep 验证。
5. **依赖**：Task1 独立；Task2 依赖 Task1；Task3/4 独立；Task5 依赖 Task1-4。
