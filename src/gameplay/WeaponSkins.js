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
  serialize() { return JSON.parse(JSON.stringify(this._data)); }
  restore(data = {}) {
    this._data = (data && typeof data === 'object') ? JSON.parse(JSON.stringify(data)) : {};
    if (!this._data.unlocked) this._data.unlocked = { default: true };
    if (!this._data.equipped) this._data.equipped = { 0: 'default', 1: 'default', 2: 'default', 3: 'default' };
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
