import { ACHIEVEMENTS } from '../gameplay/Achievements.js';
import { UIPanel } from './UIPanel.js';

export class AchievementsUI extends UIPanel {
  constructor(achievements) {
    super({ id: 'achievements-panel', toggleKey: 'KeyJ' });
    this.achievements = achievements;
    this._cat = '战斗';
  }

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
    this.el.innerHTML = html;
    this.el.querySelectorAll('[data-cat]').forEach(s => {
      s.onclick = () => { this._cat = s.dataset.cat; this.render(); };
    });
  }
}
