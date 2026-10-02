import { LS } from '../core/constants/storage-keys.js';

// P2-B 武器形态改造目录：武器 Lv3 后二选一改变攻击形态（类 Daedalus Hammer）；
// 效果由 CombatSystem 消费：range=攻击范围 +25%，pierce=无视格挡，knock=击退 +50%
export const WEAPON_MODS = [
  { key: 'range',  name: '延展', desc: '攻击范围 +25%' },
  { key: 'pierce', name: '贯穿', desc: '攻击无视格挡' },
  { key: 'knock',  name: '重击', desc: '击退 +50%' },
];

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
      berserk:     { level: 0, max: 3, name: '狂暴',     desc: '伤害+15%/级',         cost: 2, req: ['power>=2'],   excl: 'guardian' },
      guardian:    { level: 0, max: 3, name: '守护',     desc: '减伤+10%/级',         cost: 2, req: ['power>=2'],   excl: 'berserk' },
      regen:       { level: 0, max: 1, name: '回复',     desc: '每秒回血+5',          cost: 2, req: ['vigor>=2'],   excl: 'lifesteal' },
      lifesteal:   { level: 0, max: 1, name: '吸血',     desc: '吸血+5%',            cost: 2, req: ['vigor>=2'],   excl: 'regen' },
      swift:       { level: 0, max: 1, name: '疾风',     desc: '移速+10%',           cost: 2, req: ['agility>=2'], excl: 'evade' },
      evade:       { level: 0, max: 1, name: '闪避',     desc: '闪避率+10%',         cost: 2, req: ['agility>=2'], excl: 'swift' },
      frenzy:      { level: 0, max: 1, name: '狂热',     desc: '攻速+15%',           cost: 2, req: ['mastery>=2'], excl: 'critical' },
      critical:    { level: 0, max: 1, name: '暴击',     desc: '暴击率+15%',         cost: 2, req: ['mastery>=2'], excl: 'frenzy' },
      ironwall:    { level: 0, max: 1, name: '铁壁',     desc: '减伤+20%（战士）',    cost: 2, req: ['power>=2'],   excl: 'berserk',  reqClass: 'warrior' },
      spellpower:  { level: 0, max: 1, name: '法力涌动', desc: '伤害+30%（法师）',    cost: 2, req: ['mastery>=2'], excl: 'critical', reqClass: 'mage' },
      precision:   { level: 0, max: 1, name: '鹰眼',     desc: '伤害+25%（弓箭手）',  cost: 2, req: ['agility>=2'], excl: 'swift',    reqClass: 'archer' },
      // P1-A Tier3 冠顶：需基础满级 + 本系分支已点，给予天花板回报（类 Hades Legendary）
      warlord:     { level: 0, max: 1, name: '军阀',     desc: '伤害+40%+处决阈值+0.10', cost: 3, req: ['power>=3','berserk>=1'], excl: 'bastion' },
      bastion:     { level: 0, max: 1, name: '堡垒',     desc: '减伤+35%+架势恢复×2',    cost: 3, req: ['power>=3','guardian>=1'], excl: 'warlord' },
      druid:       { level: 0, max: 1, name: '德鲁伊',   desc: '回血+12+吸血+8%',        cost: 3, req: ['vigor>=3','regen>=1','lifesteal>=1'] },
      tempest:     { level: 0, max: 1, name: '风暴',     desc: '移速+15%+闪避+15%',     cost: 3, req: ['agility>=3','swift>=1','evade>=1'] },
      // P1-A Keystone 机制改写：改变核心机制而非数值（类 PoE Keystone）
      colossus:    { level: 0, max: 1, name: '巨像',     desc: '【改写】禁闪避，减伤+40%，移速-15%', cost: 4, req: ['power>=3','guardian>=1'], keystone: true },
      overload:    { level: 0, max: 1, name: '过载',     desc: '【改写】耐力上限-50%，法伤+60%',     cost: 4, req: ['mastery>=3','frenzy>=1'], keystone: true, reqClass: 'mage' },
      // P2-A Duo 组合解锁：跨系双前置同时满足→解锁第三层组合技（类 Hades Duo Boon）
      warbringer:  { level: 0, max: 1, name: '战神',     desc: '伤害+30%+暴击+15%（Duo）',  cost: 5, req: ['berserk>=1','critical>=1'], duo: true },
      warden:      { level: 0, max: 1, name: '守护者',   desc: '减伤+30%+回血+8（Duo）',    cost: 5, req: ['guardian>=1','regen>=1'],   duo: true },
      phantom:     { level: 0, max: 1, name: '幻影',     desc: '移速+15%+闪避+15%（Duo）', cost: 5, req: ['swift>=1','evade>=1'],     duo: true },
    };
    this.weaponMods = {}; // P2-B 武器形态改造（Lv3 二选一，类 Daedalus Hammer）
    this._classType = null;
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
    if (b.reqClass && this._classType !== b.reqClass) return false;
    if (!this._checkReqs(b.req)) return false;
    if (this.branches[b.excl] && this.branches[b.excl].level > 0) return false;
    b.level++; this.points -= b.cost; return true;
  }

  // P1-A：req 表达式解析，支持 ['power>=2','berserk>=1'] 多前置网状依赖（向后兼容旧字符串 'power' → power>=2）
  _checkReqs(reqs) {
    if (!reqs) return true;
    const arr = Array.isArray(reqs) ? reqs : [reqs];
    for (const r of arr) {
      const m = String(r).match(/^(\w+)(>=|>|<=|<|==)?(\d+)?$/);
      if (!m) return false;
      const name = m[1], op = m[2] || '>=', val = m[3] !== undefined ? parseInt(m[3], 10) : 2;
      const level = this._nodeLevel(name);
      if (level < 0) return false;
      if (op === '>=' && !(level >= val)) return false;
      if (op === '>' && !(level > val)) return false;
      if (op === '<=' && !(level <= val)) return false;
      if (op === '<' && !(level < val)) return false;
      if (op === '==' && level !== val) return false;
    }
    return true;
  }

  _nodeLevel(name) {
    if (this.skills[name]) return this.skills[name].level;
    if (this.branches[name]) return this.branches[name].level;
    return -1;
  }

  // P2-B 武器形态改造：Lv3 时二选一改变攻击形态（类 Daedalus Hammer）
  upgradeWeaponMod(idx, modKey) {
    if (this.weaponLevel[idx] < 3) return false;
    if (this.weaponMods[idx]) return false;
    if (this.points < 2) return false;
    this.weaponMods[idx] = modKey;
    this.points -= 2;
    return true;
  }

  getWeaponMod(idx) { return this.weaponMods[idx] || null; }

  // P2-A 局内外桥接：局外分支提升对应 RunBuffs 升级的出现权重（meta↔run 耦合，本工程独有）
  runBuffModifiers() {
    const m = {};
    if (this.branches.berserk.level > 0) m.damage = { weightMul: 1 + 0.3 * this.branches.berserk.level };
    if (this.branches.critical.level > 0) m.crit = { weightMul: 1 + 0.5 * this.branches.critical.level };
    if (this.branches.lifesteal.level > 0) m.lifesteal = { weightMul: 1.5 };
    if (this.branches.regen.level > 0) m.regen = { weightMul: 1.5 };
    if (this.branches.warlord.level > 0) m.execdmg = { weightMul: 2 };
    if (this.branches.tempest.level > 0) m.dodgecd = { weightMul: 2 };
    return m;
  }

  setClassType(type) { this._classType = type; }

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

  setWeaponSlots(names) {
    const n = names.length;
    const oldLevel = this.weaponLevel;
    const oldNames = this.weaponNames;
    this.weaponNames = [...names];
    this.weaponLevel = {};
    this.weaponOrder = [];
    for (let i = 0; i < n; i++) {
      this.weaponLevel[i] = 1;
      this.weaponOrder.push(i);
    }
    for (let i = 0; i < n; i++) {
      const oldIdx = oldNames.indexOf(names[i]);
      if (oldIdx >= 0 && oldLevel[oldIdx]) this.weaponLevel[i] = oldLevel[oldIdx];
    }
  }

  reset() {
    for (const s of Object.values(this.skills)) { this.points += s.level * s.cost; s.level = 0; }
    for (let i = 0; i < this.weaponOrder.length; i++) { this.points += (this.weaponLevel[i] - 1) * 2; this.weaponLevel[i] = 1; }
    for (const b of Object.values(this.branches)) { this.points += b.level * b.cost; b.level = 0; }
    for (const [k, v] of Object.entries(this.weaponMods)) { if (v) { this.points += 2; delete this.weaponMods[k]; } }
  }

  get damageMul() { return 1 + this.skills.power.level * 0.1; }
  get maxHpBonus() { return this.skills.vigor.level * 20; }
  get maxStaminaBonus() { return this.skills.agility.level * 20; }
  get dodgeIFrameBonus() { return this.skills.agility.level * 0.05; }
  get masteryMul() { return 1 + this.skills.mastery.level * 0.15; }
  weaponDamageMul(idx) { return 1 + (this.weaponLevel[idx] - 1) * 0.25; }

  get branchDamageMul() { return 1 + 0.15 * this.branches.berserk.level; }
  get branchDefenseMul() { return 1 - 0.10 * this.branches.guardian.level; }
  get branchLifesteal() { return 0.05 * this.branches.lifesteal.level; }
  get branchRegen() { return 5 * this.branches.regen.level; }
  get branchMoveSpeedMul() { return 1 + 0.10 * this.branches.swift.level; }
  get branchDodgeChance() { return 0.10 * this.branches.evade.level; }
  get branchAttackSpeedMul() { return 1 - 0.15 * this.branches.frenzy.level; }
  get branchCritChance() { return 0.15 * this.branches.critical.level; }
  get branchIronwall() { return 1 - 0.20 * this.branches.ironwall.level; }
  get branchSpellpower() { return 1 + 0.30 * this.branches.spellpower.level; }
  get branchPrecision() { return 1 + 0.25 * this.branches.precision.level; }
  // P1-A Tier3 冠顶 getter
  get branchWarlordDmg() { return 0.40 * this.branches.warlord.level; }
  get branchWarlordExec() { return 0.10 * this.branches.warlord.level; }
  get branchBastionDef() { return 0.35 * this.branches.bastion.level; }
  get branchBastionRegenMul() { return this.branches.bastion.level > 0 ? 2 : 1; }
  get branchDruidRegen() { return 12 * this.branches.druid.level; }
  get branchDruidLifesteal() { return 0.08 * this.branches.druid.level; }
  get branchTempestSpeed() { return 0.15 * this.branches.tempest.level; }
  get branchTempestDodge() { return 0.15 * this.branches.tempest.level; }
  // P1-A Keystone 机制改写 getter（改写核心机制而非纯数值乘算）
  get keystoneNoDodge() { return this.branches.colossus.level > 0; }
  get keystoneColossusDef() { return 0.40 * this.branches.colossus.level; }
  get keystoneColossusSpeed() { return -0.15 * this.branches.colossus.level; }
  get keystoneOverloadStamina() { return -0.50 * this.branches.overload.level; }
  get keystoneOverloadSpell() { return 0.60 * this.branches.overload.level; }
  // P2-A Duo 组合解锁 getter（跨系双前置满足后解锁，类 Hades Duo Boon）
  get duoWarbringerDmg() { return 0.30 * this.branches.warbringer.level; }
  get duoWarbringerCrit() { return 0.15 * this.branches.warbringer.level; }
  get duoWardenDef() { return 0.30 * this.branches.warden.level; }
  get duoWardenRegen() { return 8 * this.branches.warden.level; }
  get duoPhantomSpeed() { return 0.15 * this.branches.phantom.level; }
  get duoPhantomDodge() { return 0.15 * this.branches.phantom.level; }

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
      weaponMods: { ...this.weaponMods },
    };
  }

  saveProfile(name) { try { localStorage.setItem(LS.SKILLTREE_PROFILE_PREFIX + name, JSON.stringify(this.serialize())); return true; } catch (e) { return false; } }
  loadProfile(name) {
    try {
      const d = JSON.parse(localStorage.getItem(LS.SKILLTREE_PROFILE_PREFIX + name));
      if (!d) return false;
      this.points = d.points || 0;
      for (const [k, v] of Object.entries(d.skills || {})) if (this.skills[k]) this.skills[k].level = v;
      for (let i = 0; i < this.weaponOrder.length; i++) this.weaponLevel[i] = (d.weaponLevel && d.weaponLevel[i]) || 1;
      if (Array.isArray(d.skillOrder)) this.skillOrder = d.skillOrder;
      if (Array.isArray(d.weaponOrder)) this.weaponOrder = d.weaponOrder;
      return true;
    } catch (e) { return false; }
  }
  restore(data = {}) {
    if (typeof data.points === 'number') this.points = data.points;
    for (const [k, v] of Object.entries(data.skills || {})) if (this.skills[k] && typeof v === 'number') this.skills[k].level = Math.max(0, Math.min(this.skills[k].max, v));
    for (let i = 0; i < this.weaponOrder.length; i++) if (typeof (data.weaponLevel && data.weaponLevel[i]) === 'number') this.weaponLevel[i] = Math.max(1, Math.min(3, data.weaponLevel[i]));
    if (Array.isArray(data.skillOrder) && data.skillOrder.length === 4) this.skillOrder = data.skillOrder;
    if (Array.isArray(data.weaponOrder) && data.weaponOrder.length === this.weaponNames.length) this.weaponOrder = data.weaponOrder;
    for (const [k, v] of Object.entries(data.branches || {})) if (this.branches[k] && typeof v === 'number') this.branches[k].level = Math.max(0, Math.min(this.branches[k].max, v));
    if (data.weaponMods) this.weaponMods = { ...data.weaponMods };
  }

  hasProfile(name) { return !!localStorage.getItem(LS.SKILLTREE_PROFILE_PREFIX + name); }
  deleteProfile(name) { try { localStorage.removeItem(LS.SKILLTREE_PROFILE_PREFIX + name); } catch (e) {} }
}
