export const AFFIX_TYPES = {
  锋锐: { name: '锋锐', tiers: [0.10, 0.20, 0.30], apply: 'damage' },
  迅捷: { name: '迅捷', tiers: [0.15, 0.25, 0.40], apply: 'cooldown' },
  暴怒: { name: '暴怒', tiers: [0.10, 0.20, 0.30], apply: 'crit' },
  吸血: { name: '吸血', tiers: [0.05, 0.10, 0.15], apply: 'lifesteal' },
  坚韧: { name: '坚韧', tiers: [20, 40, 60], apply: 'maxhp' },
  幸运: { name: '幸运', tiers: [0.10, 0.20, 0.30], apply: 'luck' },
};

// P1-B：协同从 3→6 条，新增 3 条行为改变协同（处决阈值/受击反伤/暴伤倍率）
export const SYNERGIES = [
  { types: ['锋锐', '暴怒'], name: '狂战', desc: '伤害 +15%', bonus: { apply: 'damage', value: 0.15 } },
  { types: ['吸血', '坚韧'], name: '不灭', desc: '吸血 +10%', bonus: { apply: 'lifesteal', value: 0.10 } },
  { types: ['迅捷', '幸运'], name: '幸运一击', desc: '暴击 +10%', bonus: { apply: 'crit', value: 0.10 } },
  { types: ['锋锐', '吸血'], name: '嗜血', desc: '处决阈值 +0.08', bonus: { apply: 'execute', value: 0.08 } },
  { types: ['坚韧', '幸运'], name: '荆棘', desc: '受击反伤 15%', bonus: { apply: 'reflect', value: 0.15 } },
  { types: ['暴怒', '迅捷'], name: '风暴', desc: '暴伤倍率 +0.5', bonus: { apply: 'critmul', value: 0.5 } },
];

export class Affixes {
  constructor() { this.inventory = []; }
  drop(luck = 0) {
    if (this.inventory.length >= 20) return false;
    if (Math.random() > 0.08 + luck) return false;
    const types = Object.keys(AFFIX_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const r = Math.random();
    const tier = r < 0.6 ? 0 : (r < 0.9 ? 1 : 2);
    // P1-B：greater 品质标记（数值 1.5×，掉率 8% 受 luck 加成）
    const greater = Math.random() < 0.08 + luck * 0.5;
    this.inventory.push({ type, tier, greater });
    return { type, tier, greater };
  }
  grant(type, tier, greater = false) {
    if (this.inventory.length >= 20) return false;
    this.inventory.push({ type, tier, greater });
    return true;
  }
  equip(weapon, slot, invIdx) {
    if (!weapon || !weapon.affixes || slot < 0 || slot >= weapon.affixes.length) return false;
    if (!this.inventory[invIdx]) return false;
    const oldAffix = weapon.affixes[slot];
    const newAffix = this.inventory.splice(invIdx, 1)[0];
    weapon.affixes[slot] = newAffix;
    if (oldAffix) this.inventory.push(oldAffix);
    return true;
  }
  affixBonus(weapon, type) {
    if (!weapon || !weapon.affixes) return 0;
    let sum = 0;
    for (const a of weapon.affixes) {
      if (a && a.type === type) sum += AFFIX_TYPES[type].tiers[a.tier] * (a.greater ? 1.5 : 1);
    }
    return sum;
  }
  checkSynergy(weapon) {
    if (!weapon || !weapon.affixes) return null;
    const types = weapon.affixes.map(a => a && a.type).filter(Boolean);
    if (types.length < 2) return null;
    for (const syn of SYNERGIES) {
      if (syn.types.every(t => types.includes(t))) return syn;
    }
    return null;
  }
  synergyBonus(weapon, applyType) {
    const syn = this.checkSynergy(weapon);
    if (!syn || syn.bonus.apply !== applyType) return 0;
    return syn.bonus.value;
  }
  serialize() { return JSON.parse(JSON.stringify(this.inventory)); }
  restore(data = []) { this.inventory = Array.isArray(data) ? JSON.parse(JSON.stringify(data)) : []; }
}
