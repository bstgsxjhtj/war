const UPGRADES = [
  { id: 'maxhp', name: '体魄强化', desc: '最大生命 +50', apply: (p) => { p.health.maxHp += 50; p.health.hp = Math.min(p.health.maxHp, p.health.hp + 50); } },
  { id: 'speed', name: '神速', desc: '移速 +20%', apply: (p) => { p.speed *= 1.2; } },
  { id: 'stamina', name: '持久', desc: '最大耐力 +30', apply: (p) => { p.stamina.max += 30; p.stamina.cur = Math.min(p.stamina.max, p.stamina.cur + 30); } },
  { id: 'heal', name: '满血回复', desc: '回复全部生命', apply: (p) => { p.health.hp = p.health.maxHp; } },
  { id: 'damage', name: '锋利', desc: '伤害 +15%', apply: (p) => { p._runDmgMul = (p._runDmgMul || 1) * 1.15; } },
  { id: 'lifesteal', name: '吸血', desc: '攻击吸血 10%', apply: (p) => { p._runLifesteal = (p._runLifesteal || 0) + 0.10; } },
];

export class RunBuffs {
  constructor() { this.picked = []; }
  roll3() {
    const pool = [...UPGRADES];
    const out = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  }
  apply(player, upgradeId) {
    const u = UPGRADES.find(x => x.id === upgradeId);
    if (u) { u.apply(player); this.picked.push(u.id); }
  }
}

RunBuffs.UPGRADES = UPGRADES;
