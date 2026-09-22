import { EV } from '../core/constants/events.js';

const CHALLENGE_POOL = [
  { id: 'kills5', desc: '今日累计击杀5人', target: 5, type: 'kills', reward: 50 },
  { id: 'kills10', desc: '今日累计击杀10人', target: 10, type: 'kills', reward: 100 },
  { id: 'perfect3', desc: '完美格挡3次', target: 3, type: 'perfect', reward: 60 },
  { id: 'dodge5', desc: '完美闪避5次', target: 5, type: 'dodge', reward: 60 },
  { id: 'win_s', desc: '以S评分获胜', target: 1, type: 'winGrade', grade: 'S', reward: 120 },
  { id: 'combo3', desc: '3连击以上3次', target: 3, type: 'combo3', reward: 50 },
  { id: 'backstab', desc: '背刺击杀3次', target: 3, type: 'backstab', reward: 80 },
  { id: 'no_damage', desc: '无伤获胜', target: 1, type: 'noDamageWin', reward: 150 },
  { id: 'speedrun', desc: '90秒内获胜', target: 90, type: 'speedWin', reward: 100 },
  { id: 'boss_kill', desc: '击杀Boss', target: 1, type: 'bossKill', reward: 100 }
];

export class DailyChallenge {
  constructor(progression, bus) {
    this.prog = progression;
    this._bus = bus || null;
    this._data = { date: '', challenges: [], progress: {} };
    if (this._isExpired()) this._regenerate();
  }

  serialize() { return JSON.parse(JSON.stringify(this._data)); }
  restore(data = {}) {
    this._data = (data && typeof data === 'object') ? JSON.parse(JSON.stringify(data)) : { date: '', challenges: [], progress: {} };
    if (!this._data.challenges) this._data.challenges = [];
    if (!this._data.progress) this._data.progress = {};
    if (this._isExpired()) this._regenerate();
  }

  _todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  _isExpired() { return this._data.date !== this._todayKey(); }

  _regenerate() {
    const pool = [...CHALLENGE_POOL];
    const picked = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    this._data = { date: this._todayKey(), challenges: picked, progress: {}, claimed: false };
  }

  get challenges() {
    return this._data.challenges.map(c => ({
      ...c,
      progress: this._data.progress[c.id] || 0,
      done: (this._data.progress[c.id] || 0) >= c.target
    }));
  }

  get allDone() { return this.challenges.every(c => c.done); }

  track(type, value = 1) {
    let changed = false;
    for (const c of this._data.challenges) {
      if (c.type === type && (this._data.progress[c.id] || 0) < c.target) {
        this._data.progress[c.id] = (this._data.progress[c.id] || 0) + value;
        changed = true;
        if (this._data.progress[c.id] >= c.target && this._bus) this._bus.emit(EV.DAILY_COMPLETED, { id: c.id, type });
      }
    }
    return changed;
  }

  claim() {
    if (!this.allDone || this._data.claimed) return 0;
    let total = 0;
    for (const c of this._data.challenges) total += c.reward;
    this._data.claimed = true;
    return total;
  }

  resetSession() {
    this._data.progress = {};
  }
}
