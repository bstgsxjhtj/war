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
    if (this.audio) { this._vol = { master: this.audio.getVolume('master'), sfx: this.audio.getVolume('sfx'), bgm: this.audio.getVolume('bgm'), env: this.audio.getVolume('env') }; this._volEl.value = Math.round(this._vol.master*100); this._sfxEl.value = Math.round(this._vol.sfx*100); this._bgmEl.value = Math.round(this._vol.bgm*100); this._envEl.value = Math.round(this._vol.env*100); this._volV.textContent = this._volEl.value+'%'; this._sfxV.textContent = this._sfxEl.value+'%'; this._bgmV.textContent = this._bgmEl.value+'%'; this._envV.textContent = this._envEl.value+'%'; }
  }
  _load() { try { const d = localStorage.getItem('settings'); if (d) { const v = JSON.parse(d); this.quality = v.quality ?? 'high'; this.difficulty = v.difficulty ?? 'normal'; this.sensitivity = v.sensitivity ?? 1; this._qual.value = this.quality; this._diff.value = this.difficulty; this._sens.value = Math.round(this.sensitivity*100); this._sensV.textContent = this.sensitivity.toFixed(1); } } catch (e) {} }
  _save() { try { localStorage.setItem('settings', JSON.stringify({ quality: this.quality, sensitivity: this.sensitivity, difficulty: this.difficulty })); } catch (e) {} }
  _applyAll() { if (this.audio) { this.audio.setVolume('master', this._vol.master); this.audio.setVolume('sfx', this._vol.sfx); this.audio.setVolume('bgm', this._vol.bgm); this.audio.setVolume('env', this._vol.env); } this.bus.emit('settings.quality', { quality: this.quality }); this.bus.emit('settings.sensitivity', { sensitivity: this.sensitivity }); this.bus.emit('settings.difficulty', { difficulty: this.difficulty }); }
  toggle() { this.open ? this.hide() : this.show(); }
  show() { this.el.style.display = 'flex'; this.open = true; if (this.audio) this.audio.resume(); this._applyAll(); }
  hide() { this.el.style.display = 'none'; this.open = false; this.bus.emit('settings.closed'); }
}
