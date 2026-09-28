import { LS } from '../core/constants/storage-keys.js';

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
    this.branches = {
      berserk:   { level: 0, max: 1, name: '狂暴',   desc: '伤害+25%',           cost: 2, req: 'power',   excl: 'guardian' },
      guardian:  { level: 0, max: 1, name: '守护',   desc: '减伤+25%',           cost: 2, req: 'power',   excl: 'berserk' },
      regen:     { level: 0, max: 1, name: '回复',   desc: '每秒回血+5',          cost: 2, req: 'vigor',   excl: 'lifesteal' },
      lifesteal: { level: 0, max: 1, name: '吸血',   desc: '吸血+5%',            cost: 2, req: 'vigor',   excl: 'regen' },
      swift:     { level: 0, max: 1, name: '疾风',   desc: '移速+10%',           cost: 2, req: 'agility', excl: 'evade' },
      evade:     { level: 0, max: 1, name: '闪避',   desc: '闪避率+10%',         cost: 2, req: 'agility', excl: 'swift' },
      frenzy:    { level: 0, max: 1, name: '狂热',   desc: '攻速+15%',           cost: 2, req: 'mastery', excl: 'critical' },
      critical:  { level: 0, max: 1, name: '暴击',   desc: '暴击率+15%',         cost: 2, req: 'mastery', excl: 'frenzy' },
    };
  }

  addPoint(n = 1) { this.points += n; }

  upgrade(key) {
    const s = this.skills[key];
    if (!s || s.level >= s.max || this.points < s.cost) return false;
    s.level++; this.points -= s.cost; return true;
  }

  upgradeWeapon(idx) {
    if (this.weaponLevel[idx] >= 3 || this.points < 2) return false;
    this.weaponLevel[idx]++; this.points -= 2; return true;
  }

  upgradeBranch(key) {
    const b = this.branches[key];
    if (!b || b.level >= b.max || this.points < b.cost) return false;
    const reqSkill = this.skills[b.req];
    if (!reqSkill || reqSkill.level < 2) return false;
    if (this.branches[b.excl] && this.branches[b.excl].level > 0) return false;
    b.level++; this.points -= b.cost; return true;
  }

  reorderSkill(from, to) {
    if (from < 0 || to < 0 || from >= this.skillOrder.length || to >= this.skillOrder.length) return;
    const arr = this.skillOrder;
    const item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
  }

  reorderWeapon(from, to) {
    if (from < 0 || to < 0 || from >= this.weaponOrder.length || to >= this.weaponOrder.length) return;
    const arr = this.weaponOrder;
    const item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
  }

  reset() {
    for (const s of Object.values(this.skills)) { this.points += s.level * s.cost; s.level = 0; }
    for (let i = 0; i < 4; i++) { this.points += (this.weaponLevel[i] - 1) * 2; this.weaponLevel[i] = 1; }
    for (const b of Object.values(this.branches)) { this.points += b.level * b.cost; b.level = 0; }
  }

  get damageMul() { return 1 + this.skills.power.level * 0.1; }
  get maxHpBonus() { return this.skills.vigor.level * 20; }
  get maxStaminaBonus() { return this.skills.agility.level * 20; }
  get dodgeIFrameBonus() { return this.skills.agility.level * 0.05; }
  get masteryMul() { return 1 + this.skills.mastery.level * 0.15; }
  weaponDamageMul(idx) { return 1 + (this.weaponLevel[idx] - 1) * 0.25; }

  get branchDamageMul() { return 1 + 0.25 * this.branches.berserk.level; }
  get branchDefenseMul() { return 1 - 0.25 * this.branches.guardian.level; }
  get branchLifesteal() { return 0.05 * this.branches.lifesteal.level; }
  get branchRegen() { return 5 * this.branches.regen.level; }
  get branchMoveSpeedMul() { return 1 + 0.10 * this.branches.swift.level; }
  get branchDodgeChance() { return 0.10 * this.branches.evade.level; }
  get branchAttackSpeedMul() { return 1 - 0.15 * this.branches.frenzy.level; }
  get branchCritChance() { return 0.15 * this.branches.critical.level; }

  totalMul(weaponIdx) {
    return this.damageMul * this.masteryMul * this.weaponDamageMul(weaponIdx);
  }

  serialize() {
    return {
      points: this.points,
      skills: Object.fromEntries(Object.entries(this.skills).map(([k, v]) => [k, v.level])),
      weaponLevel: { ...this.weaponLevel },
      skillOrder: [...this.skillOrder],
      weaponOrder: [...this.weaponOrder],
      branches: Object.fromEntries(Object.entries(this.branches).map(([k, v]) => [k, v.level])),
    };
  }

  saveProfile(name) { try { localStorage.setItem(LS.SKILLTREE_PROFILE_PREFIX + name, JSON.stringify(this.serialize())); return true; } catch (e) { return false; } }
  loadProfile(name) {
    try {
      const d = JSON.parse(localStorage.getItem(LS.SKILLTREE_PROFILE_PREFIX + name));
      if (!d) return false;
      this.points = d.points || 0;
      for (const [k, v] of Object.entries(d.skills || {})) if (this.skills[k]) this.skills[k].level = v;
      for (let i = 0; i < 4; i++) this.weaponLevel[i] = (d.weaponLevel && d.weaponLevel[i]) || 1;
      if (Array.isArray(d.skillOrder)) this.skillOrder = d.skillOrder;
      if (Array.isArray(d.weaponOrder)) this.weaponOrder = d.weaponOrder;
      return true;
    } catch (e) { return false; }
  }
  restore(data = {}) {
    if (typeof data.points === 'number') this.points = data.points;
    for (const [k, v] of Object.entries(data.skills || {})) if (this.skills[k] && typeof v === 'number') this.skills[k].level = Math.max(0, Math.min(this.skills[k].max, v));
    for (let i = 0; i < 4; i++) if (typeof (data.weaponLevel && data.weaponLevel[i]) === 'number') this.weaponLevel[i] = Math.max(1, Math.min(3, data.weaponLevel[i]));
    if (Array.isArray(data.skillOrder) && data.skillOrder.length === 4) this.skillOrder = data.skillOrder;
    if (Array.isArray(data.weaponOrder) && data.weaponOrder.length === 4) this.weaponOrder = data.weaponOrder;
    for (const [k, v] of Object.entries(data.branches || {})) if (this.branches[k] && typeof v === 'number') this.branches[k].level = Math.max(0, Math.min(this.branches[k].max, v));
  }

  hasProfile(name) { return !!localStorage.getItem(LS.SKILLTREE_PROFILE_PREFIX + name); }
  deleteProfile(name) { try { localStorage.removeItem(LS.SKILLTREE_PROFILE_PREFIX + name); } catch (e) {} }
}
