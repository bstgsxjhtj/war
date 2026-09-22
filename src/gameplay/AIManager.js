import { EV } from '../core/constants/events.js';

export const DIFFICULTY = {
  easy: { reactTime: 0.5, dodgeChance: 0.10, blockChance: 0.10, maxHpMul: 0.8, callReinforceCd: 90 },
  normal: { reactTime: 0.3, dodgeChance: 0.20, blockChance: 0.20, maxHpMul: 1.0, callReinforceCd: 60 },
  hard: { reactTime: 0.15, dodgeChance: 0.35, blockChance: 0.30, maxHpMul: 1.2, callReinforceCd: 45 },
};

export class AIManager {
  constructor(bus) {
    this.bus = bus;
    this._difficulty = DIFFICULTY.normal;
    this._squads = new Map();
    this._ais = [];
    this._bind();
  }
  setDifficulty(d) { this._difficulty = DIFFICULTY[d] || DIFFICULTY.normal; }
  difficulty() { return this._difficulty; }
  assignSquad(ais) {
    this._ais = ais;
    this._squads.clear();
    for (let i = 0; i < ais.length; i++) {
      const squadId = Math.floor(i / 3);
      if (!this._squads.has(squadId)) this._squads.set(squadId, []);
      this._squads.get(squadId).push(ais[i]);
      ais[i]._squadId = squadId;
      const roleIdx = i % 3;
      let role = ['assault', 'flank', 'ranged'][roleIdx];
      if (ais[i].weapon && ais[i].weapon.type === 'projectile') role = 'ranged';
      ais[i]._squadRole = role;
    }
  }
  _bind() {
    if (!this.bus) return;
    this.bus.on(EV.AI_CALLREINFORCE, ({ pos, team, id }) => {
      for (const a of this._ais) {
        if (a === id || !a.alive || a.team !== team) continue;
        const d = a.position.clone().sub(pos).length();
        if (d < 30) a._reinforceTarget = pos.clone();
      }
    });
    this.bus.on(EV.AI_SPOTPLAYER, ({ target, team, id }) => {
      for (const a of this._ais) {
        if (a === id || !a.alive || a.team !== team) continue;
        const d = a.position.clone().sub(target.position).length();
        if (d < 25) a._focusTarget = target;
      }
    });
  }
}
