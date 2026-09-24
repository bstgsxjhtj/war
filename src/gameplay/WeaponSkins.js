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
    this._data = {};
    if (!this._data.unlocked) this._data.unlocked = { default: true };
    if (!this._data.equipped) this._data.equipped = { 0: 'default', 1: 'default', 2: 'default', 3: 'default' };
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
    return true;
  }

  forceUnlock(id) {
    const skin = SKINS[id];
    if (!skin || this.isUnlocked(id)) return false;
    this._data.unlocked[id] = true;
    return true;
  }

  equip(weaponIdx, skinId) {
    if (!this.isUnlocked(skinId)) return false;
    this._data.equipped[weaponIdx] = skinId;
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
