// 设置菜单：画质/音量/灵敏度
export class SettingsMenu {
  constructor(bus, audio) {
    this.bus = bus;
    this.audio = audio;
    this.open = false;
    this.sensitivity = 1;
    this.quality = 'high';
    this.el = document.createElement('div');
    Object.assign(this.el.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.8)', display: 'none', alignItems: 'center', justifyContent: 'center', zIndex: 100, fontFamily: 'Segoe UI, sans-serif' });
    this.el.innerHTML = `
      <div style="background:#1e1e2e;border:1px solid #456;border-radius:12px;padding:24px;width:360px;color:#eee;">
        <div style="font-size:18px;font-weight:600;margin-bottom:16px;text-align:center;">设置</div>
        <div style="margin-bottom:14px;">
          <div style="font-size:13px;margin-bottom:6px;">画质</div>
          <select id="set-qual" style="width:100%;padding:6px;background:#2a2a3a;color:#eee;border:1px solid #456;border-radius:6px;">
            <option value="high">高（4096阴影+2x像素）</option>
            <option value="mid">中（2048阴影+1x像素）</option>
            <option value="low">低（无阴影+0.7x像素）</option>
          </select>
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:13px;margin-bottom:6px;">音量 <span id="set-vol-v">70%</span></div>
          <input id="set-vol" type="range" min="0" max="100" value="70" style="width:100%;">
        </div>
        <div style="margin-bottom:14px;">
          <div style="font-size:13px;margin-bottom:6px;">鼠标灵敏度 <span id="set-sens-v">1.0</span></div>
          <input id="set-sens" type="range" min="30" max="300" value="100" style="width:100%;">
        </div>
        <button id="set-close" style="width:100%;padding:8px;background:#6b5;font-family:inherit;border:none;border-radius:6px;color:#fff;font-size:14px;cursor:pointer;margin-top:8px;">关闭</button>
      </div>`;
    document.body.appendChild(this.el);
    this._qual = this.el.querySelector('#set-qual');
    this._vol = this.el.querySelector('#set-vol');
    this._sens = this.el.querySelector('#set-sens');
    this._volV = this.el.querySelector('#set-vol-v');
    this._sensV = this.el.querySelector('#set-sens-v');
    this._qual.addEventListener('change', () => { this.quality = this._qual.value; this.bus.emit('settings.quality', { quality: this.quality }); });
    this._vol.addEventListener('input', () => { const v = this._vol.value / 100; this._volV.textContent = this._vol.value + '%'; if (this.audio) this.audio.setVolume(v); });
    this._sens.addEventListener('input', () => { this.sensitivity = this._sens.value / 100; this._sensV.textContent = this.sensitivity.toFixed(1); });
    this.el.querySelector('#set-close').addEventListener('click', () => this.hide());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.hide(); });
  }

  toggle() { this.open ? this.hide() : this.show(); }
  show() { this.el.style.display = 'flex'; this.open = true; if (this.audio) this.audio.resume(); }
  hide() { this.el.style.display = 'none'; this.open = false; this.bus.emit('settings.closed'); }
}
