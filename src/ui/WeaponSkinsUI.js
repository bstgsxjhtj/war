// 皮肤面板（V 键开关）；自 gameplay/WeaponSkins.js 抽出，纯移动不改行为
import { SKINS } from '../gameplay/WeaponSkins.js';

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
      html += '<div style="margin-bottom:12px"><div style="font-weight:bold;margin-bottom:6px;color:#8af">' + weaponNames[w] + '</div>';
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
      for (const [id, skin] of Object.entries(SKINS)) {
        const unlocked = this.skins.isUnlocked(id);
        const equipped = (this.skins.equipped[w] || 'default') === id;
        const cls = equipped ? 'border:2px solid #ffd700;background:rgba(255,215,0,.15)' : (unlocked ? 'border:1px solid #555' : 'border:1px solid #333;opacity:.4');
        const label = unlocked ? skin.name : skin.name + '(' + skin.cost + '分)';
        html += '<div data-weapon="' + w + '" data-skin="' + id + '" class="skin-card" style="' + cls + ';padding:6px 10px;border-radius:6px;cursor:pointer;flex:1;min-width:60px;text-align:center;font-size:12px">' + label + '</div>';
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
