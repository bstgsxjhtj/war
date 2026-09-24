// 波次生存模式：递增难度 + 每5波 Boss + 无尽模式 + 本地最佳波数 + 无尽修饰词
import { LS } from '../core/constants/storage-keys.js';

const MODIFIERS = [
  { key: 'frenzy', name: '狂暴', desc: '敌人移速 +30%', speedMul: 1.3 },
  { key: 'fortify', name: '坚韧', desc: '敌人生命 +60%', hpMul: 1.6 },
  { key: 'swarm', name: '蜂拥', desc: '敌人数量 +50%', countMul: 1.5, hpMul: 0.85 },
  { key: 'elite', name: '精锐', desc: '精英概率大增', eliteChanceMul: 4, hpMul: 1.1 },
  { key: 'night', name: '暗夜', desc: '夜战，敌人生命 +20%', weather: 'night', hpMul: 1.2 },
];

export class WaveMode {
  constructor(bus, endless = false) {
    this.bus = bus;
    this.endless = endless;
    this.name = endless ? '无尽' : '波次';
    this.wave = 0;
    this.alive = 0;
    this.targetWave = endless ? Infinity : 10;
    this.modifier = null;
    this.nextModifier = endless ? this._pickModifier(null) : null;
  }

  _pickModifier(excludeKey) {
    const pool = MODIFIERS.filter(m => m.key !== excludeKey);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  spawnLayout() {
    this.wave++;
    const isBoss = this.wave % 5 === 0;
    if (this.endless && this.wave % 3 === 0) {
      this.modifier = this.nextModifier;
      this.nextModifier = this._pickModifier(this.modifier.key);
    }
    const mod = this.modifier;
    const maxCount = this.endless ? 12 : 8;
    let count = isBoss ? 2 : Math.min(maxCount, 2 + (this.endless ? Math.floor(this.wave * 1.5) : this.wave));
    if (mod && mod.countMul) count = Math.min(maxCount, Math.round(count * mod.countMul));
    const red = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 20 + Math.random() * 6;
      red.push({ x: Math.cos(a) * r, z: 40 + Math.sin(a) * r, ang: Math.PI, isBoss: isBoss && i === 0 });
    }
    return { blue: [{ x: -16, z: -30 }], red, isBoss, wave: this.wave, modifier: mod, nextModifier: this.nextModifier };
  }

  onKill() { this.alive = Math.max(0, this.alive - 1); }

  checkWin(blueAlive, redAlive) {
    if (!blueAlive) return 'red';
    if (!this.endless && !redAlive && this.wave >= this.targetWave) return 'blue';
    return null;
  }

  get waveInfo() { return { wave: this.wave, target: this.endless ? Infinity : this.targetWave, alive: this.alive }; }

  static loadBest() {
    try { return parseInt(localStorage.getItem(LS.WAVE_BEST)) || 0; } catch { return 0; }
  }

  static saveBest(wave) {
    try {
      if (wave <= 0) return;
      const cur = WaveMode.loadBest();
      if (wave > cur) localStorage.setItem(LS.WAVE_BEST, String(wave));
    } catch {}
  }
}

WaveMode.MODIFIERS = MODIFIERS;
