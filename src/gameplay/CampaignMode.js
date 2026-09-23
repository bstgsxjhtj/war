export const STAGES = [
  { name: '渡桥遭遇', mapKey: 'bridge', objective: '全灭', enemyCount: 3, weather: 'clear', layout: '环形', events: null, difficulty: 1.0, weapons: ['sword'] },
  { name: '山口伏击', mapKey: 'pass', objective: '全灭', enemyCount: 4, weather: 'rain', layout: '伏击', events: null, difficulty: 1.15, weapons: ['sword'] },
  { name: '攻城战', mapKey: 'fortress', objective: '攻破城门', enemyCount: 5, weather: 'clear', layout: '方阵', events: null, difficulty: 1.3, weapons: ['sword', 'spear'] },
  { name: '风雪遭遇', mapKey: 'field', objective: '全灭', enemyCount: 6, weather: 'snow', layout: '线阵', events: { reinforce: 0.5 }, difficulty: 1.45, weapons: ['sword', 'spear'] },
  { name: '最终决战', mapKey: 'field', objective: 'Boss', enemyCount: 8, weather: 'storm', layout: '环形', events: { bossPhase: 0.5 }, difficulty: 1.6, weapons: ['sword', 'spear', 'warhammer'], bossType: 'warlord' },
  { name: '密林伏击', mapKey: 'forest', objective: '全灭', enemyCount: 7, weather: 'clear', layout: '伏击', events: { reinforce: 0.4 }, difficulty: 1.75, weapons: ['sword', 'spear'] },
  { name: '河谷护送', mapKey: 'river', objective: '护送', enemyCount: 6, weather: 'rain', layout: '线阵', events: { weatherShift: { at: 0.5, to: 'storm' } }, difficulty: 1.9, weapons: ['sword', 'spear'] },
  { name: '雪原生存', mapKey: 'snowfield', objective: '生存', enemyCount: 5, weather: 'snow', layout: '方阵', events: { reinforce: 0.3 }, difficulty: 2.05, weapons: ['sword', 'spear', 'warhammer'], bossType: 'mage', mini: true, surviveTime: 90 },
  { name: '要塞防御', mapKey: 'keep', objective: '防御', enemyCount: 8, weather: 'clear', layout: '环形', events: { reinforce: 0.5 }, difficulty: 2.2, weapons: ['sword', 'spear', 'warhammer'] },
  { name: '终局之战', mapKey: 'keep', objective: 'Boss限时', enemyCount: 10, weather: 'storm', layout: '环形', events: { bossPhase: 0.5, reinforce: 0.3 }, difficulty: 2.4, weapons: ['sword', 'spear', 'warhammer'], bossType: 'behemoth' },
];

export class CampaignMode {
  constructor(bus, nightmare = false) {
    this.bus = bus;
    this.name = '战役';
    this.nightmare = nightmare;
    this.stage = 0;
    this.maxStages = STAGES.length;
    this.cleared = 0;
    this._reinforced = false;
    this._bossPhase = 1;
    this._weatherShifted = false;
  }

  get displayName() { return this.nightmare ? '噩梦战役' : '战役'; }

  serialize() { return { cleared: this.cleared }; }
  restore(data = {}) {
    if (data && typeof data.cleared === 'number') this.cleared = data.cleared;
  }

  get currentStage() {
    const s = STAGES[Math.min(this.stage, STAGES.length - 1)];
    if (!this.nightmare) return s;
    return { ...s, difficulty: s.difficulty * 1.35, enemyCount: s.enemyCount + 2 };
  }
  get stageInfo() { return { ...this.currentStage, index: this.stage, total: this.maxStages, cleared: this.cleared }; }

  spawnLayout() {
    const s = this.currentStage;
    const red = [];
    const n = s.enemyCount;
    const cx = 160, cz = 0;
    if (s.layout === '线阵') {
      for (let i = 0; i < n; i++) red.push({ x: cx, z: -60 + (n > 1 ? 120 / (n - 1) * i : 0) });
    } else if (s.layout === '方阵') {
      const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
      for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), c = i % cols; red.push({ x: cx + r * 8, z: -60 + (cols > 1 ? 120 / (cols - 1) * c : 0) }); }
    } else if (s.layout === '伏击') {
      for (let i = 0; i < n; i++) red.push({ x: cx + (Math.random() - 0.5) * 40, z: -80 + Math.random() * 160 });
    } else {
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; red.push({ x: cx + Math.cos(a) * 144, z: cz + Math.sin(a) * 144 }); }
    }
    return { mapKey: s.mapKey, weather: s.weather, blue: [{ x: -180, z: 0 }], red, difficulty: s.difficulty, weapons: s.weapons };
  }

  checkWin(blueAlive, redAlive, siegeGate, ctx = {}) {
    const s = this.currentStage;
    if (!blueAlive) return 'red';
    if (s.objective === '全灭') return !redAlive ? 'blue' : null;
    if (s.objective === '攻破城门') return (siegeGate && siegeGate.broken) ? 'blue' : null;
    if (s.objective === 'Boss') {
      if (ctx.boss && !ctx.boss.alive) return 'blue';
      return null;
    }
    if (s.objective === '护送') {
      const e = ctx.escortTarget;
      if (e && e.alive && e.pos && e.goal && e.pos.distanceTo(e.goal) < 5) return 'blue';
      if (e && !e.alive) return 'red';
      return null;
    }
    if (s.objective === '防御') {
      if (ctx.defenseTimer !== undefined && ctx.defenseTimer <= 0) return 'blue';
      return null;
    }
    if (s.objective === '生存') {
      if (ctx.surviveWavesDone) return 'blue';
      return null;
    }
    if (s.objective === 'Boss限时') {
      if (ctx.boss && !ctx.boss.alive) return 'blue';
      if (ctx.timeLimit !== undefined && ctx.timeLimit <= 0) return 'red';
      return null;
    }
    return null;
  }

  onTick(dt, ctx = {}) {
    const s = this.currentStage;
    if (!s || !s.events) return;
    const ev = s.events;
    if (ev.reinforce && !this._reinforced) {
      const killed = s.enemyCount - (ctx.redAlive !== undefined ? ctx.redAlive : s.enemyCount);
      if (killed / s.enemyCount >= ev.reinforce) { this._reinforced = true; if (ctx.spawnReinforce) ctx.spawnReinforce(Math.ceil(s.enemyCount * 0.3)); }
    }
    if (ev.bossPhase && ctx.boss && this._bossPhase < 2) {
      if (ctx.boss.alive && ctx.boss.health && ctx.boss.health.hp / ctx.boss.health.maxHp <= ev.bossPhase) { this._bossPhase = 2; if (ctx.boss.enterPhase) ctx.boss.enterPhase(2); }
    }
    if (ev.weatherShift && !this._weatherShifted) {
      const progress = ctx.progress || 0;
      if (progress >= ev.weatherShift.at) { this._weatherShifted = true; if (ctx.setWeather) ctx.setWeather(ev.weatherShift.to); }
    }
  }

  onStageClear() {
    this.cleared = Math.max(this.cleared, this.stage + 1);
    this.stage++;
    this._reinforced = false;
    this._bossPhase = 1;
    this._weatherShifted = false;
    if (this.stage >= this.maxStages) { this.stage = 0; return 'campaign_complete'; }
    return 'next_stage';
  }
  reset() { this.stage = 0; this._reinforced = false; this._bossPhase = 1; this._weatherShifted = false; }
  skipTo(stage) { this.stage = Math.min(stage, this.maxStages - 1); this._reinforced = false; this._bossPhase = 1; this._weatherShifted = false; }
}
