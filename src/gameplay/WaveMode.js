// 波次生存模式：递增难度 + 每5波 Boss + 无尽模式 + 本地最佳波数
import { LS } from '../core/constants/storage-keys.js';

export class WaveMode {
  constructor(bus, endless = false) {
    this.bus = bus;
    this.endless = endless;
    this.name = endless ? '无尽' : '波次';
    this.wave = 0;
    this.alive = 0;
    this.targetWave = endless ? Infinity : 10;
  }

  spawnLayout() {
    this.wave++;
    const isBoss = this.wave % 5 === 0;
    const maxCount = this.endless ? 12 : 8;
    const count = isBoss ? 2 : Math.min(maxCount, 2 + (this.endless ? Math.floor(this.wave * 1.5) : this.wave));
    const red = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 20 + Math.random() * 6;
      red.push({ x: Math.cos(a) * r, z: 40 + Math.sin(a) * r, ang: Math.PI, isBoss: isBoss && i === 0 });
    }
    return { blue: [{ x: -16, z: -30 }], red, isBoss, wave: this.wave };
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
