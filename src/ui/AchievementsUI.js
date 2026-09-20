import { ACHIEVEMENTS } from '../gameplay/Achievements.js';

export class AchievementsUI {
  constructor(achievements) {
    this.achievements = achievements;
    this._panel = null;
    this._visible = false;
    this._cat = '战斗';
    this._build();
    document.addEventListener('keydown', (e) => this._onKey(e));
  }
  _build() {
    const el = document.createElement('div');
    el.id = 'achievements-panel';
    Object.assign(el.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: '520px', maxHeight: '75vh', overflowY: 'auto',
      background: 'rgba(15,15,20,.95)', border: '2px solid #2a6a5a',
      borderRadius: '8px', padding: '16px', color: '#eee',
      fontFamily: 'Segoe UI, sans-serif', fontSize: '13px', zIndex: '30', display: 'none'
    });
    document.body.appendChild(el);
    this._panel = el;
  }
  toggle() { this._visible = !this._visible; this._panel.style.display = this._visible ? 'block' : 'none'; if (this._visible) this.render(); }
  render() {
    const cats = ['战斗', '连击', '战役', '每日', '特殊', '技能'];
    let html = '<h3 style="color:#ffd070">成就</h3>';
    html += '<div style="margin-bottom:8px">';
    for (const c of cats) {
      const cur = c === this._cat ? 'background:#3a5a2a' : '';
      html += `<span data-cat="${c}" style="cursor:pointer;border:1px solid #444;padding:2px 8px;margin:2px;${cur}">${c}</span>`;
    }
    html += '</div>';
    const list = this.achievements.allByCat(this._cat);
    for (const a of list) {
      const pct = Math.min(100, Math.floor(a.progress / a.target * 100));
      const color = a.unlocked ? '#4f4' : (a.progress > 0 ? '#ffd070' : '#888');
      const icon = a.unlocked ? '✓' : (a.progress > 0 ? '○' : '·');
      html += `<div style="margin:4px 0;padding:4px;border:1px solid #333;color:${color}">${icon} ${a.name} (${a.progress}/${a.target}) <div style="background:#222;height:4px;margin-top:2px"><div style="background:${color};height:4px;width:${pct}%"></div></div></div>`;
    }
    this._panel.innerHTML = html;
    this._panel.querySelectorAll('[data-cat]').forEach(s => {
      s.onclick = () => { this._cat = s.dataset.cat; this.render(); };
    });
  }
  _onKey(e) {
    if (e.code === 'KeyJ') { e.preventDefault(); this.toggle(); }
    else if (e.code === 'Escape' && this._visible) this.toggle();
  }
}
