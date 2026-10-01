import { EV } from '../core/constants/events.js';
import { LS } from '../core/constants/storage-keys.js';
import { BINDING_ORDER, BINDING_LABELS } from '../core/input/KeyBindings.js';
import { UIStack } from './UIStack.js';
export class SettingsMenu {
  constructor(bus, audio, kb) {
    this.bus = bus; this.audio = audio; this.kb = kb || null; this.open = false;
    this.pausesGame = true; // 战役一#6：设置面板打开时冻结 gameplay
    this.quality = 'high'; this.sensitivity = 1; this.difficulty = 'normal';
    this.colorblind = false; this.reducedMotion = false; this.shakeIntensity = 1;
    this._vol = { master: 0.7, sfx: 0.8, bgm: 0.5, env: 0.4 };
    this._listeningAction = null;
    this._listenHandler = null;
    const keybindHtml = this.kb ? this._buildKeybindHtml() : '';
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
        <div style="margin-bottom:8px;"><div style="font-size:13px;margin-bottom:4px;">鼠标灵敏度 <span id="set-sens-v">1.0</span></div><input id="set-sens" type="range" min="30" max="300" value="100" style="width:100%;"></div>
        <div style="margin-bottom:8px;"><label style="font-size:13px;display:flex;align-items:center;gap:8px;cursor:pointer;"><input id="set-cb" type="checkbox"> 色弱模式（敌我形状区分）</label></div>
        <div style="margin-bottom:8px;"><label style="font-size:13px;display:flex;align-items:center;gap:8px;cursor:pointer;"><input id="set-rm" type="checkbox"> 减少动效（关闭脉冲/震动/顿帧）</label></div>
        <div style="margin-bottom:14px;"><div style="font-size:13px;margin-bottom:4px;">屏幕震动强度 <span id="set-shake-v">100%</span></div><input id="set-shake" type="range" min="0" max="100" value="100" style="width:100%;"></div>
        ${keybindHtml}
        <button id="set-reset-tut" style="width:100%;padding:6px;background:#3a3a4a;font-family:inherit;border:1px solid #567;border-radius:6px;color:#cdd;font-size:13px;cursor:pointer;margin-bottom:8px;">重置新手引导（下次进入生效）</button>
        <button id="set-close" style="width:100%;padding:8px;background:#6b5;font-family:inherit;border:none;border-radius:6px;color:#fff;font-size:14px;cursor:pointer;margin-top:8px;">关闭</button>
      </div>`;
    document.body.appendChild(this.el);
    this._qual = this.el.querySelector('#set-qual');
    this._diff = this.el.querySelector('#set-diff');
    this._volEl = this.el.querySelector('#set-vol'); this._sfxEl = this.el.querySelector('#set-sfx');
    this._bgmEl = this.el.querySelector('#set-bgm'); this._envEl = this.el.querySelector('#set-env');
    this._sens = this.el.querySelector('#set-sens');
    this._cb = this.el.querySelector('#set-cb'); this._rm = this.el.querySelector('#set-rm');
    this._shakeEl = this.el.querySelector('#set-shake'); this._shakeV = this.el.querySelector('#set-shake-v');
    this._volV = this.el.querySelector('#set-vol-v'); this._sfxV = this.el.querySelector('#set-sfx-v');
    this._bgmV = this.el.querySelector('#set-bgm-v'); this._envV = this.el.querySelector('#set-env-v');
    this._sensV = this.el.querySelector('#set-sens-v');
    this._qual.addEventListener('change', () => { this.quality = this._qual.value; this.bus.emit(EV.SETTINGS_QUALITY, { quality: this.quality }); this._save(); });
    this._diff.addEventListener('change', () => { this.difficulty = this._diff.value; this.bus.emit(EV.SETTINGS_DIFFICULTY, { difficulty: this.difficulty }); this._save(); });
    this._volEl.addEventListener('input', () => { const v = this._volEl.value/100; this._vol.master = v; this._volV.textContent = this._volEl.value+'%'; if(this.audio) this.audio.setVolume('master', v); this._save(); });
    this._sfxEl.addEventListener('input', () => { const v = this._sfxEl.value/100; this._vol.sfx = v; this._sfxV.textContent = this._sfxEl.value+'%'; if(this.audio) this.audio.setVolume('sfx', v); this._save(); });
    this._bgmEl.addEventListener('input', () => { const v = this._bgmEl.value/100; this._vol.bgm = v; this._bgmV.textContent = this._bgmEl.value+'%'; if(this.audio) this.audio.setVolume('bgm', v); this._save(); });
    this._envEl.addEventListener('input', () => { const v = this._envEl.value/100; this._vol.env = v; this._envV.textContent = this._envEl.value+'%'; if(this.audio) this.audio.setVolume('env', v); this._save(); });
    this._sens.addEventListener('input', () => { this.sensitivity = this._sens.value/100; this._sensV.textContent = this.sensitivity.toFixed(1); this.bus.emit(EV.SETTINGS_SENSITIVITY, { sensitivity: this.sensitivity }); this._save(); });
    this._cb.addEventListener('change', () => { this.colorblind = this._cb.checked; this.bus.emit(EV.SETTINGS_COLORBLIND, { colorblind: this.colorblind }); this._save(); });
    this._rm.addEventListener('change', () => { this.reducedMotion = this._rm.checked; this.bus.emit(EV.SETTINGS_REDUCED_MOTION, { reducedMotion: this.reducedMotion }); this._save(); });
    this._shakeEl.addEventListener('input', () => { this.shakeIntensity = this._shakeEl.value/100; this._shakeV.textContent = this._shakeEl.value+'%'; this.bus.emit(EV.SETTINGS_SHAKE_INTENSITY, { shakeIntensity: this.shakeIntensity }); this._save(); });
    this.el.querySelector('#set-reset-tut').addEventListener('click', () => {
      try { localStorage.removeItem(LS.TUTORIAL_DONE); } catch (e) {}
      this.bus.emit(EV.HUD_FLASH, { text: '新手引导已重置，下次进入游戏生效' });
    });
    this.el.querySelector('#set-close').addEventListener('click', () => this.hide());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.hide(); });
    if (this.kb) this._wireKeybind();
    this._load();
    if (this.audio) { this._vol = { master: this.audio.getVolume('master'), sfx: this.audio.getVolume('sfx'), bgm: this.audio.getVolume('bgm'), env: this.audio.getVolume('env') }; this._volEl.value = Math.round(this._vol.master*100); this._sfxEl.value = Math.round(this._vol.sfx*100); this._bgmEl.value = Math.round(this._vol.bgm*100); this._envEl.value = Math.round(this._vol.env*100); this._volV.textContent = this._volEl.value+'%'; this._sfxV.textContent = this._sfxEl.value+'%'; this._bgmV.textContent = this._bgmEl.value+'%'; this._envV.textContent = this._envEl.value+'%'; }
  }
  _load() { try { const d = localStorage.getItem(LS.SETTINGS); if (d) { const v = JSON.parse(d); this.quality = v.quality ?? 'high'; this.difficulty = v.difficulty ?? 'normal'; this.sensitivity = v.sensitivity ?? 1; this.colorblind = v.colorblind ?? false; this.reducedMotion = v.reducedMotion ?? false; this.shakeIntensity = v.shakeIntensity ?? 1; this._qual.value = this.quality; this._diff.value = this.difficulty; this._sens.value = Math.round(this.sensitivity*100); this._sensV.textContent = this.sensitivity.toFixed(1); this._cb.checked = this.colorblind; this._rm.checked = this.reducedMotion; this._shakeEl.value = Math.round(this.shakeIntensity*100); this._shakeV.textContent = Math.round(this.shakeIntensity*100)+'%'; } } catch (e) {} }
  _save() { try { localStorage.setItem(LS.SETTINGS, JSON.stringify({ quality: this.quality, sensitivity: this.sensitivity, difficulty: this.difficulty, colorblind: this.colorblind, reducedMotion: this.reducedMotion, shakeIntensity: this.shakeIntensity })); } catch (e) {} }
  _applyAll() { if (this.audio) { this.audio.setVolume('master', this._vol.master); this.audio.setVolume('sfx', this._vol.sfx); this.audio.setVolume('bgm', this._vol.bgm); this.audio.setVolume('env', this._vol.env); } this.bus.emit(EV.SETTINGS_QUALITY, { quality: this.quality }); this.bus.emit(EV.SETTINGS_SENSITIVITY, { sensitivity: this.sensitivity }); this.bus.emit(EV.SETTINGS_DIFFICULTY, { difficulty: this.difficulty }); this.bus.emit(EV.SETTINGS_COLORBLIND, { colorblind: this.colorblind }); this.bus.emit(EV.SETTINGS_REDUCED_MOTION, { reducedMotion: this.reducedMotion }); this.bus.emit(EV.SETTINGS_SHAKE_INTENSITY, { shakeIntensity: this.shakeIntensity }); }
  _buildKeybindHtml() {
    const rows = BINDING_ORDER.map(action => `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:13px;"><span>${BINDING_LABELS[action]}</span><button data-bind="${action}" style="padding:4px 12px;background:#2a2a3a;color:#eee;border:1px solid #456;border-radius:4px;cursor:pointer;font-family:inherit;min-width:80px;text-align:center;">${this.kb.get(action)}</button></div>`).join('');
    return `<div style="margin-bottom:12px;"><div style="font-size:14px;font-weight:600;margin-bottom:8px;border-top:1px solid #456;padding-top:12px;">键位</div>${rows}<button id="set-reset-keys" style="width:100%;padding:6px;background:#3a3a4a;font-family:inherit;border:1px solid #567;border-radius:6px;color:#cdd;font-size:13px;cursor:pointer;margin-top:8px;">恢复默认键位</button></div>`;
  }
  _wireKeybind() {
    this._keyButtons = this.el.querySelectorAll('[data-bind]');
    this._keyButtons.forEach(btn => btn.addEventListener('click', () => this._startListen(btn)));
    this.el.querySelector('#set-reset-keys').addEventListener('click', () => {
      this._cancelListen();
      this.kb.reset();
      this._refreshKeyButtons();
      this.bus.emit(EV.SETTINGS_KEYBIND, { bindings: this.kb.getAll() });
    });
  }
  _startListen(btn) {
    if (this._listeningAction) return;
    const action = btn.dataset.bind;
    this._listeningAction = action;
    btn.textContent = '按下任意键';
    btn.style.background = '#4a4a5a';
    this._listenHandler = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.code === 'Escape') { this._cancelListen(); return; }
      this.kb.set(action, e.code);
      this._cancelListen();
      this.bus.emit(EV.SETTINGS_KEYBIND, { action, code: e.code, bindings: this.kb.getAll() });
    };
    window.addEventListener('keydown', this._listenHandler, true);
  }
  _cancelListen() {
    if (this._listenHandler) { window.removeEventListener('keydown', this._listenHandler, true); this._listenHandler = null; }
    this._listeningAction = null;
    this._refreshKeyButtons();
  }
  _refreshKeyButtons() { if (this._keyButtons) this._keyButtons.forEach(btn => { btn.textContent = this.kb.get(btn.dataset.bind); btn.style.background = '#2a2a3a'; }); }
  toggle() { this.open ? this.hide() : this.show(); }
  show() { this.el.style.display = 'flex'; this.open = true; UIStack.push(this); if (this.audio) this.audio.resume(); this._applyAll(); }
  hide() { this._cancelListen(); this.el.style.display = 'none'; this.open = false; UIStack.remove(this); }
}
