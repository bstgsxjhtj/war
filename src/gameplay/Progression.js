const RANKS = [
  { name: '新兵', min: 0, color: '#999' },
  { name: '步兵', min: 100, color: '#8c8' },
  { name: '老兵', min: 300, color: '#6c6' },
  { name: '百夫长', min: 600, color: '#4a4' },
  { name: '校尉', min: 1000, color: '#fc0' },
  { name: '偏将', min: 1600, color: '#f80' },
  { name: '总兵', min: 2500, color: '#f40' },
  { name: '大将', min: 4000, color: '#f0f' },
  { name: '战神', min: 6000, color: '#fff' }
];

export class Progression {
  constructor() {
    this._key = 'progression_v1';
    this._data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(this._key);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { score: 0, kills: 0, deaths: 0, wins: 0, losses: 0, unlocks: { boss: false, elite: false }, bestGrade: null, bestTime: null };
  }

  _save() {
    try { localStorage.setItem(this._key, JSON.stringify(this._data)); } catch (e) { /* ignore */ }
  }

  get score() { return this._data.score; }
  get kills() { return this._data.kills; }
  get deaths() { return this._data.deaths; }
  get wins() { return this._data.wins; }
  get losses() { return this._data.losses; }

  get rank() {
    let r = RANKS[0];
    for (const rk of RANKS) if (this._data.score >= rk.min) r = rk;
    return r;
  }

  get nextRank() {
    for (const rk of RANKS) if (this._data.score < rk.min) return rk;
    return null;
  }

  get progressPct() {
    const cur = this.rank, next = this.nextRank;
    if (!next) return 100;
    return Math.min(100, ((this._data.score - cur.min) / (next.min - cur.min)) * 100);
  }

  get unlocks() { return this._data.unlocks; }

  recordKill() {
    this._data.kills++;
    this._data.score += 25;
    this._checkUnlocks();
    this._save();
  }

  recordDeath() { this._data.deaths++; this._save(); }
  recordWin(grade, time) {
    this._data.wins++;
    this._data.score += 100;
    if (grade && (!this._data.bestGrade || this._gradeVal(grade) > this._gradeVal(this._data.bestGrade))) {
      this._data.bestGrade = grade;
    }
    if (time && (!this._data.bestTime || time < this._data.bestTime)) {
      this._data.bestTime = time;
    }
    this._checkUnlocks();
    this._save();
  }
  recordLoss() { this._data.losses++; this._save(); }
  addScore(n) {
    this._data.score += n;
    this._checkUnlocks();
    this._save();
  }

  _gradeVal(g) { return { S: 4, A: 3, B: 2, C: 1 }[g] || 0; }

  _checkUnlocks() {
    if (this._data.score >= 300) this._data.unlocks.elite = true;
    if (this._data.score >= 1000) this._data.unlocks.boss = true;
  }

  reset() {
    this._data = { score: 0, kills: 0, deaths: 0, wins: 0, losses: 0, unlocks: { boss: false, elite: false }, bestGrade: null, bestTime: null };
    this._save();
  }

  getStats() {
    return {
      rank: this.rank.name, rankColor: this.rank.color,
      score: this._data.score, kills: this._data.kills,
      deaths: this._data.deaths, wins: this._data.wins, losses: this._data.losses,
      nextRank: this.nextRank ? this.nextRank.name : 'MAX',
      progressPct: Math.round(this.progressPct),
      bestGrade: this._data.bestGrade, bestTime: this._data.bestTime,
      unlocks: this._data.unlocks
    };
  }
}

export class ProgressionUI {
  constructor(progression, bus) {
    this.prog = progression;
    this.bus = bus;
    this.el = document.createElement('div');
    this.el.id = 'progression-ui';
    Object.assign(this.el.style, {
      position: 'fixed', top: '8px', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '8px', alignItems: 'center', zIndex: 12,
      fontFamily: 'Segoe UI, sans-serif', fontSize: '12px', pointerEvents: 'none',
      color: '#ddd', textShadow: '0 0 3px #000'
    });
    document.body.appendChild(this.el);
    this._render();
  }

  _render() {
    const s = this.prog.getStats();
    const bar = `<div style="width:80px;height:6px;background:rgba(0,0,0,.5);border-radius:3px;overflow:hidden"><div style="width:${s.progressPct}%;height:100%;background:${s.rankColor};transition:width .3s"></div></div>`;
    this.el.innerHTML = `<span style="color:${s.rankColor};font-weight:bold">${s.rank}</span>${bar}<span>${s.score}分</span><span style="color:#6f6">${s.wins}胜</span>`;
  }

  update(dt) { if (Math.random() < dt * 0.5) this._render(); }
  refresh() { this._render(); }
}
