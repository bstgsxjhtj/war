// 技能树 + 武器升级：4 技能 + 4 武器等级 + 拖拽排序 + localStorage 持久化
export class SkillTree {
  constructor() {
    this.points = 0;
    this.skills = {
      power: { level: 0, max: 3, name: '\u529b\u91cf', desc: '\u4f24\u5bb3 +10%/\u7ea7', cost: 1 },
      vigor: { level: 0, max: 3, name: '\u4f53\u9b44', desc: '\u8840\u91cf +20/\u7ea7', cost: 1 },
      agility: { level: 0, max: 3, name: '\u654f\u6377', desc: '\u8010\u529b+20/\u7ea7 \u95ea\u907fiFrame+0.05/\u7ea7', cost: 1 },
      mastery: { level: 0, max: 3, name: '\u6b66\u5668\u4e13\u7cbe', desc: '\u5f53\u524d\u6b66\u5668\u4f24\u5bb3 +15%/\u7ea7', cost: 1 },
    };
    this.weaponLevel = { 0: 1, 1: 1, 2: 1, 3: 1 };
    this.weaponNames = ['\u5200', '\u5f13', '\u67aa', '\u9524'];
    this.skillOrder = ['power', 'vigor', 'agility', 'mastery'];
    this.weaponOrder = [0, 1, 2, 3];
    this._load();
  }

  addPoint(n = 1) { this.points += n; this._save(); }

  upgrade(key) {
    const s = this.skills[key];
    if (!s || s.level >= s.max || this.points < s.cost) return false;
    s.level++; this.points -= s.cost; this._save(); return true;
  }

  upgradeWeapon(idx) {
    if (this.weaponLevel[idx] >= 3 || this.points < 2) return false;
    this.weaponLevel[idx]++; this.points -= 2; this._save(); return true;
  }

  reorderSkill(from, to) {
    if (from < 0 || to < 0 || from >= this.skillOrder.length || to >= this.skillOrder.length) return;
    const arr = this.skillOrder;
    const item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    this._save();
  }

  reorderWeapon(from, to) {
    if (from < 0 || to < 0 || from >= this.weaponOrder.length || to >= this.weaponOrder.length) return;
    const arr = this.weaponOrder;
    const item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    this._save();
  }

  reset() {
    for (const s of Object.values(this.skills)) { this.points += s.level * s.cost; s.level = 0; }
    for (let i = 0; i < 4; i++) { this.points += (this.weaponLevel[i] - 1) * 2; this.weaponLevel[i] = 1; }
    this._save();
  }

  get damageMul() { return 1 + this.skills.power.level * 0.1; }
  get maxHpBonus() { return this.skills.vigor.level * 20; }
  get maxStaminaBonus() { return this.skills.agility.level * 20; }
  get dodgeIFrameBonus() { return this.skills.agility.level * 0.05; }
  get masteryMul() { return 1 + this.skills.mastery.level * 0.15; }
  weaponDamageMul(idx) { return 1 + (this.weaponLevel[idx] - 1) * 0.25; }

  totalMul(weaponIdx) {
    return this.damageMul * this.masteryMul * this.weaponDamageMul(weaponIdx);
  }

  serialize() {
    return {
      points: this.points,
      skills: Object.fromEntries(Object.entries(this.skills).map(([k, v]) => [k, v.level])),
      weaponLevel: { ...this.weaponLevel },
      skillOrder: [...this.skillOrder],
      weaponOrder: [...this.weaponOrder]
    };
  }

  saveProfile(name) { try { localStorage.setItem('skilltree_profile_' + name, JSON.stringify(this.serialize())); return true; } catch (e) { return false; } }
  loadProfile(name) {
    try {
      const d = JSON.parse(localStorage.getItem('skilltree_profile_' + name));
      if (!d) return false;
      this.points = d.points || 0;
      for (const [k, v] of Object.entries(d.skills || {})) if (this.skills[k]) this.skills[k].level = v;
      for (let i = 0; i < 4; i++) this.weaponLevel[i] = (d.weaponLevel && d.weaponLevel[i]) || 1;
      if (Array.isArray(d.skillOrder)) this.skillOrder = d.skillOrder;
      if (Array.isArray(d.weaponOrder)) this.weaponOrder = d.weaponOrder;
      this._save();
      return true;
    } catch (e) { return false; }
  }
  hasProfile(name) { return !!localStorage.getItem('skilltree_profile_' + name); }
  deleteProfile(name) { try { localStorage.removeItem('skilltree_profile_' + name); } catch (e) {} }

  _save() { try { localStorage.setItem('skilltree_v1', JSON.stringify(this.serialize())); } catch (e) {} }
  _load() {
    try {
      const d = JSON.parse(localStorage.getItem('skilltree_v1'));
      if (!d) return;
      this.points = d.points || 0;
      for (const [k, v] of Object.entries(d.skills || {})) if (this.skills[k]) this.skills[k].level = v;
      for (let i = 0; i < 4; i++) this.weaponLevel[i] = (d.weaponLevel && d.weaponLevel[i]) || 1;
      if (Array.isArray(d.skillOrder) && d.skillOrder.length === 4) this.skillOrder = d.skillOrder;
      if (Array.isArray(d.weaponOrder) && d.weaponOrder.length === 4) this.weaponOrder = d.weaponOrder;
    } catch (e) {}
  }
}
