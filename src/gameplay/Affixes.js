export const AFFIX_TYPES = {
  锋锐: { name: '锋锐', tiers: [0.10, 0.20, 0.30], apply: 'damage' },
  迅捷: { name: '迅捷', tiers: [0.15, 0.25, 0.40], apply: 'cooldown' },
  暴怒: { name: '暴怒', tiers: [0.10, 0.20, 0.30], apply: 'crit' },
  吸血: { name: '吸血', tiers: [0.05, 0.10, 0.15], apply: 'lifesteal' },
  坚韧: { name: '坚韧', tiers: [20, 40, 60], apply: 'maxhp' },
  幸运: { name: '幸运', tiers: [0.10, 0.20, 0.30], apply: 'luck' },
};

export class Affixes {
  constructor() { this.inventory = []; this._load(); }
  drop(luck = 0) {
    if (this.inventory.length >= 20) return false;
    if (Math.random() > 0.08 + luck) return false;
    const types = Object.keys(AFFIX_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const r = Math.random();
    const tier = r < 0.6 ? 0 : (r < 0.9 ? 1 : 2);
    this.inventory.push({ type, tier });
    this._save();
    return { type, tier };
  }
  grant(type, tier) {
    if (this.inventory.length >= 20) return false;
    this.inventory.push({ type, tier });
    this._save();
    return true;
  }
  equip(weapon, slot, invIdx) {
    if (!weapon || !weapon.affixes || slot < 0 || slot > 1) return false;
    if (!this.inventory[invIdx]) return false;
    weapon.affixes[slot] = this.inventory[invIdx];
    return true;
  }
  affixBonus(weapon, type) {
    if (!weapon || !weapon.affixes) return 0;
    let sum = 0;
    for (const a of weapon.affixes) {
      if (a && a.type === type) sum += AFFIX_TYPES[type].tiers[a.tier];
    }
    return sum;
  }
  _save() { try { localStorage.setItem('affixes', JSON.stringify(this.inventory)); } catch (e) {} }
  _load() { try { const d = localStorage.getItem('affixes'); if (d) this.inventory = JSON.parse(d); } catch (e) {} }
}
