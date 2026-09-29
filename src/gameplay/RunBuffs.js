const UPGRADES = [
  { id: 'maxhp', name: '体魄强化', desc: '最大生命 +50', rarity: 'common', apply: (p) => { p.health.maxHp += 50; p.health.hp = Math.min(p.health.maxHp, p.health.hp + 50); } },
  { id: 'speed', name: '神速', desc: '移速 +20%', rarity: 'common', apply: (p) => { p.speed *= 1.2; } },
  { id: 'stamina', name: '持久', desc: '最大耐力 +30', rarity: 'common', apply: (p) => { p.stamina.max += 30; p.stamina.cur = Math.min(p.stamina.max, p.stamina.cur + 30); } },
  { id: 'heal', name: '满血回复', desc: '回复全部生命', rarity: 'common', apply: (p) => { p.health.hp = p.health.maxHp; } },
  { id: 'regen', name: '回春', desc: '每秒回血 +3', rarity: 'common', apply: (p) => { p._runRegen = (p._runRegen || 0) + 3; } },
  { id: 'atkspd', name: '疾风连击', desc: '攻速 +12%', rarity: 'common', apply: (p) => { p._runAtkSpdMul = (p._runAtkSpdMul || 1) * 0.88; } },
  { id: 'dodgecd', name: '幻影步伐', desc: '闪避冷却 -25%', rarity: 'common', apply: (p) => { p._runDodgeCdMul = (p._runDodgeCdMul || 1) * 0.75; } },
  { id: 'damage', name: '锋利', desc: '伤害 +10%（加算，上限 +50%）', rarity: 'uncommon', apply: (p) => { p._runDmgStacks = Math.min(5, (p._runDmgStacks || 0) + 1); p._runDmgMul = 1 + 0.10 * p._runDmgStacks; } },
  { id: 'lifesteal', name: '吸血', desc: '攻击吸血 10%', rarity: 'uncommon', apply: (p) => { p._runLifesteal = (p._runLifesteal || 0) + 0.10; } },
  { id: 'armor', name: '铁壁', desc: '受伤 -12%', rarity: 'uncommon', apply: (p) => { p._runArmorMul = Math.max(0.5, (p._runArmorMul || 1) - 0.12); } },
  { id: 'crit', name: '鹰眼', desc: '暴击率 +12%', rarity: 'uncommon', apply: (p) => { p._runCritChance = (p._runCritChance || 0) + 0.12; } },
  { id: 'execdmg', name: '终结者', desc: '处决阈值 +8%', rarity: 'rare', apply: (p) => { p._runExecBonus = (p._runExecBonus || 0) + 0.08; } },
  { id: 'counterdmg', name: '以牙还牙', desc: '克制伤害 +20%', rarity: 'rare', apply: (p) => { p._runCounterMul = (p._runCounterMul || 1) + 0.20; } },
];

const RARITY_WEIGHT = { common: 1, uncommon: 0.55, rare: 0.22 };
export const RARITY_COLOR = { common: '#9a9a9a', uncommon: '#5aa0ff', rare: '#ffd24a' };

export class RunBuffs {
  constructor(rerollsPerRun = 2) {
    this.picked = [];
    this.rerollsPerRun = rerollsPerRun;
    this.rerollsLeft = rerollsPerRun;
    this._lastRoll = null;
  }
  roll3() {
    const pool = UPGRADES.map(u => ({ id: u.id, name: u.name, desc: u.desc, rarity: u.rarity, w: RARITY_WEIGHT[u.rarity] }));
    const out = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const total = pool.reduce((s, u) => s + u.w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) { r -= pool[idx].w; if (r <= 0) break; }
      if (idx >= pool.length) idx = pool.length - 1;
      const rolled = pool.splice(idx, 1)[0];
      const u = UPGRADES.find(x => x.id === rolled.id);
      out.push({ id: u.id, name: u.name, desc: u.desc, rarity: u.rarity, color: RARITY_COLOR[u.rarity], apply: u.apply });
    }
    this._lastRoll = out;
    return out;
  }
  reroll() {
    if (this.rerollsLeft <= 0) return null;
    this.rerollsLeft--;
    return this.roll3();
  }
  resetRerolls() { this.rerollsLeft = this.rerollsPerRun; }
  apply(player, upgradeId) {
    const u = UPGRADES.find(x => x.id === upgradeId);
    if (u) { u.apply(player); this.picked.push(u.id); }
  }
}

RunBuffs.UPGRADES = UPGRADES;
