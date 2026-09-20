# 设置面板深化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`). **重要：SearchReplace 偶发误报，每处编辑后 Grep 验证，若丢失用 node 脚本 fix.mjs 行级处理。SettingsMenu 用 Write 完整重写。**

**Goal:** 音量分类型（4 slider）+ 画质绑定 + 灵敏度绑定 + 难度选择 + localStorage 持久化。

**集成点（已读确认）：**
- `src/ui/SettingsMenu.js` 48 行：constructor（3-43）/toggle/show/hide（45-47）/画质 _qual + 音量 _vol + 灵敏度 _sens
- `src/engine/Renderer.js` 33-38：WebGLRenderer + setPixelRatio + shadowMap
- `src/main_entry.js` 351 `Escape settings.toggle` + settings.quality/sensitivity 事件未绑
- `src/audio/AudioEngine.js` setVolume(type, v)（Round 10）
- `src/gameplay/AIManager.js` setDifficulty(d)（Round 9）

---

### Task 1: SettingsMenu 深化 + 单测（TDD）

**Files:** Write `src/ui/SettingsMenu.js`（完整重写）+ Create `tests/ui/SettingsMenu.test.js`

- [ ] **Step 1: 写失败测试** — tests/ui/SettingsMenu.test.js（5 测试）：
  - 音量 4 slider change：master/sfx/bgm/env input → audio.setVolume(type, v) 调用 + localStorage _save
  - 画质 change → bus.emit settings.quality + _save
  - 难度 change → bus.emit settings.difficulty + _save
  - 灵敏度 input → bus.emit settings.sensitivity + _save
  - _load 启动加载（localStorage mock 'settings' 返 {quality:'mid',volume:{master:0.5,sfx:0.6,bgm:0.4,env:0.3},sensitivity:1.5,difficulty:'hard'}）→ UI 控件值正确
  mock bus = { on:vi.fn(), emit:vi.fn() } + audio = { setVolume:vi.fn(), resume:vi.fn() }。jsdom document.body。
- [ ] **Step 2: 跑验证失败** — `npx vitest run tests/ui/SettingsMenu.test.js`，应 FAIL
- [ ] **Step 3: Write 完整 src/ui/SettingsMenu.js**：
  ```js
  export class SettingsMenu {
    constructor(bus, audio) {
      this.bus = bus; this.audio = audio; this.open = false;
      this.quality = 'high'; this.sensitivity = 1; this.difficulty = 'normal';
      this._vol = { master: 0.7, sfx: 0.8, bgm: 0.5, env: 0.4 };
      this.el = document.createElement('div');
      Object.assign(this.el.style, { position:'fixed', inset:'0', background:'rgba(0,0,0,.8)', display:'none', alignItems:'center', justifyContent:'center', zIndex:100, fontFamily:'Segoe UI, sans-serif' });
      this.el.innerHTML = `
        <div style="background:#1e1e2e;border:1px solid #456;border-radius:12px;padding:24px;width:360px;color:#eee;max-height:90vh;overflow-y:auto;">
          <div style="font-size:18px;font-weight:600;margin-bottom:16px;text-align:center;">设置</div>
          <div style="margin-bottom:12px;">
            <div style="font-size:13px;margin-bottom:6px;">画质</div>
            <select id="set-qual" style="width:100%;padding:6px;background:#2a2a3a;color:#eee;border:1px solid #456;border-radius:6px;">
              <option value="high">高（4096阴影+2x像素）</option>
              <option value="mid">中（2048阴影+1x像素）</option>
              <option value="low">低（无阴影+0.7x像素）</option>
            </select>
          </div>
          <div style="margin-bottom:12px;">
            <div style="font-size:13px;margin-bottom:6px;">难度</div>
            <select id="set-diff" style="width:100%;padding:6px;background:#2a2a3a;color:#eee;border:1px solid #456;border-radius:6px;">
              <option value="easy">简单</option>
              <option value="normal">普通</option>
              <option value="hard">困难</option>
            </select>
          </div>
          <div style="margin-bottom:8px;"><div style="font-size:13px;margin-bottom:4px;">主音量 <span id="set-vol-v">70%</span></div><input id="set-vol" type="range" min="0" max="100" value="70" style="width:100%;"></div>
          <div style="margin-bottom:8px;"><div style="font-size:13px;margin-bottom:4px;">音效 <span id="set-sfx-v">80%</span></div><input id="set-sfx" type="range" min="0" max="100" value="80" style="width:100%;"></div>
          <div style="margin-bottom:8px;"><div style="font-size:13px;margin-bottom:4px;">BGM <span id="set-bgm-v">50%</span></div><input id="set-bgm" type="range" min="0" max="100" value="50" style="width:100%;"></div>
          <div style="margin-bottom:12px;"><div style="font-size:13px;margin-bottom:4px;">环境 <span id="set-env-v">40%</span></div><input id="set-env" type="range" min="0" max="100" value="40" style="width:100%;"></div>
          <div style="margin-bottom:14px;"><div style="font-size:13px;margin-bottom:6px;">鼠标灵敏度 <span id="set-sens-v">1.0</span></div><input id="set-sens" type="range" min="30" max="300" value="100" style="width:100%;"></div>
          <button id="set-close" style="width:100%;padding:8px;background:#6b5;font-family:inherit;border:none;border-radius:6px;color:#fff;font-size:14px;cursor:pointer;margin-top:8px;">关闭</button>
        </div>`;
      document.body.appendChild(this.el);
      this._qual = this.el.querySelector('#set-qual');
      this._diff = this.el.querySelector('#set-diff');
      this._volEl = this.el.querySelector('#set-vol'); this._sfxEl = this.el.querySelector('#set-sfx');
      this._bgmEl = this.el.querySelector('#set-bgm'); this._envEl = this.el.querySelector('#set-env');
      this._sens = this.el.querySelector('#set-sens');
      this._volV = this.el.querySelector('#set-vol-v'); this._sfxV = this.el.querySelector('#set-sfx-v');
      this._bgmV = this.el.querySelector('#set-bgm-v'); this._envV = this.el.querySelector('#set-env-v');
      this._sensV = this.el.querySelector('#set-sens-v');
      this._qual.addEventListener('change', () => { this.quality = this._qual.value; this.bus.emit('settings.quality', { quality: this.quality }); this._save(); });
      this._diff.addEventListener('change', () => { this.difficulty = this._diff.value; this.bus.emit('settings.difficulty', { difficulty: this.difficulty }); this._save(); });
      this._volEl.addEventListener('input', () => { const v = this._volEl.value/100; this._vol.master = v; this._volV.textContent = this._volEl.value+'%'; if(this.audio) this.audio.setVolume('master', v); this._save(); });
      this._sfxEl.addEventListener('input', () => { const v = this._sfxEl.value/100; this._vol.sfx = v; this._sfxV.textContent = this._sfxEl.value+'%'; if(this.audio) this.audio.setVolume('sfx', v); this._save(); });
      this._bgmEl.addEventListener('input', () => { const v = this._bgmEl.value/100; this._vol.bgm = v; this._bgmV.textContent = this._bgmEl.value+'%'; if(this.audio) this.audio.setVolume('bgm', v); this._save(); });
      this._envEl.addEventListener('input', () => { const v = this._envEl.value/100; this._vol.env = v; this._envV.textContent = this._envEl.value+'%'; if(this.audio) this.audio.setVolume('env', v); this._save(); });
      this._sens.addEventListener('input', () => { this.sensitivity = this._sens.value/100; this._sensV.textContent = this.sensitivity.toFixed(1); this.bus.emit('settings.sensitivity', { sensitivity: this.sensitivity }); this._save(); });
      this.el.querySelector('#set-close').addEventListener('click', () => this.hide());
      this.el.addEventListener('click', (e) => { if (e.target === this.el) this.hide(); });
      this._load();
    }
    _load() { try { const d = localStorage.getItem('settings'); if (d) { const v = JSON.parse(d); this.quality = v.quality ?? 'high'; this.difficulty = v.difficulty ?? 'normal'; this.sensitivity = v.sensitivity ?? 1; this._vol = Object.assign({master:0.7,sfx:0.8,bgm:0.5,env:0.4}, v.volume || {}); this._qual.value = this.quality; this._diff.value = this.difficulty; this._sens.value = Math.round(this.sensitivity*100); this._volEl.value = Math.round(this._vol.master*100); this._sfxEl.value = Math.round(this._vol.sfx*100); this._bgmEl.value = Math.round(this._vol.bgm*100); this._envEl.value = Math.round(this._vol.env*100); this._volV.textContent = this._volEl.value+'%'; this._sfxV.textContent = this._sfxEl.value+'%'; this._bgmV.textContent = this._bgmEl.value+'%'; this._envV.textContent = this._envEl.value+'%'; this._sensV.textContent = this.sensitivity.toFixed(1); } } catch (e) {} }
    _save() { try { localStorage.setItem('settings', JSON.stringify({ quality: this.quality, volume: this._vol, sensitivity: this.sensitivity, difficulty: this.difficulty })); } catch (e) {} }
    _applyAll() { if (this.audio) { this.audio.setVolume('master', this._vol.master); this.audio.setVolume('sfx', this._vol.sfx); this.audio.setVolume('bgm', this._vol.bgm); this.audio.setVolume('env', this._vol.env); } this.bus.emit('settings.quality', { quality: this.quality }); this.bus.emit('settings.sensitivity', { sensitivity: this.sensitivity }); this.bus.emit('settings.difficulty', { difficulty: this.difficulty }); }
    toggle() { this.open ? this.hide() : this.show(); }
    show() { this.el.style.display = 'flex'; this.open = true; if (this.audio) this.audio.resume(); this._applyAll(); }
    hide() { this.el.style.display = 'none'; this.open = false; this.bus.emit('settings.closed'); }
  }
  ```
- [ ] **Step 4: 跑验证通过** — EXIT=0（5 passed）
- [ ] **Step 5: Grep 验证** — `Select-String -Path src/ui/SettingsMenu.js -Pattern 'setVolume|settings\.|_load|_save|_applyAll'`，应 10+ 行
- [ ] **Step 6: 提交** — `git commit -m "feat: SettingsMenu 深化（4音量+难度+持久化） + 单测"`

---

### Task 2: Renderer.setQuality

**Files:** Modify `src/engine/Renderer.js`

- [ ] **Step 1: Grep 确认** — `Select-String -Path src/engine/Renderer.js -Pattern 'shadowMap|setPixelRatio|class Renderer' | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }`
- [ ] **Step 2: 加 setQuality 方法** — Renderer 类内加（spec §7.2 代码）
- [ ] **Step 3: Grep 验证** — `Select-String -Path src/engine/Renderer.js -Pattern 'setQuality'`，应 1+ 行
- [ ] **Step 4: build**
- [ ] **Step 5: 提交** — `git commit -m "feat: Renderer.setQuality 画质动态调整"`

---

### Task 3: main_entry 事件绑定 + 加载

**Files:** Modify `src/main_entry.js`

- [ ] **Step 1: Grep 确认 player/camera look 字段** — `Select-String -Path src -Pattern 'lookSensitivity|_sensitivity|sensitivity|pointerLock|movementX' | ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }` 确认灵敏度应用点
- [ ] **Step 2: 绑定 settings 事件**（bus.on 区，settings 实例化后）：
  ```js
  bus.on('settings.quality', ({ quality }) => { if (renderer) renderer.setQuality(quality); });
  bus.on('settings.sensitivity', ({ sensitivity }) => { if (player) player.lookSensitivity = sensitivity; });
  bus.on('settings.difficulty', ({ difficulty }) => { if (aiManager) aiManager.setDifficulty(difficulty); });
  ```
  注意：player.lookSensitivity 字段需 Grep 确认存在；若无，加 player.lookSensitivity = 1 字段 + look 逻辑乘数（或简化 console.warn）
- [ ] **Step 3: 启动应用** — settings 实例化后 `settings.show(); settings.hide();`（触发 _applyAll）或直接 `settings._applyAll();`（但 _applyAll 私有，用 show/hide 触发）
- [ ] **Step 4: Grep 验证** — `Select-String -Path src/main_entry.js -Pattern 'settings\.quality|settings\.sensitivity|settings\.difficulty|setQuality|lookSensitivity'`，应 5+ 行
- [ ] **Step 5: build + 全量单测**
- [ ] **Step 6: 提交** — `git commit -m "feat: main_entry 绑定 settings 事件 + 启动应用"`

---

### Task 4: 冒烟 + 全量验证

**Files:** e2e/smoke.spec.js（加设置面板断言）

- [ ] **Step 1: smoke 加设置面板断言** — Escape 切换 + #set-close + 4 slider + 难度 select：
  ```js
  test('settings panel', async ({ page }) => {
    await page.goto('http://127.0.0.1:5176/');
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const close = await page.locator('#set-close').count();
    const vol = await page.locator('#set-vol').count();
    const sfx = await page.locator('#set-sfx').count();
    const diff = await page.locator('#set-diff').count();
    expect(close).toBe(1);
    expect(vol).toBe(1);
    expect(sfx).toBe(1);
    expect(diff).toBe(1);
  });
  ```
- [ ] **Step 2: 跑 Playwright** — `npx playwright test`，应 2 passed
- [ ] **Step 3: 最终全量** — vitest + build + playwright 全 0
- [ ] **Step 4: 提交** — `git commit -m "test: smoke 设置面板断言"`
- [ ] **Step 5: 清理临时文件 + git status 干净**

---

## Self-Review

1. **Spec 覆盖**：音量分类型（Task1）、画质绑定（Task2+3）、灵敏度（Task3）、难度（Task1+3）、持久化（Task1）——全覆盖。键位重绑跳过（spec §11）。
2. **Placeholder**：无 TBD，每步含关键代码。
3. **类型一致**：audio.setVolume(type,v) Task1/3 一致；renderer.setQuality(q) Task2/3 一致；aiManager.setDifficulty(d) Task3 一致；bus.emit settings.* Task1/3 一致；_load/_save/_applyAll Task1 一致。
4. **SearchReplace 误报防护**：Task1 SettingsMenu 用 Write 完整重写；Task2/3 小改 Grep 验证。
5. **依赖**：Task1 独立；Task2 独立；Task3 依赖 Task1+2；Task4 依赖 Task1-3。
