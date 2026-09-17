// 波次生存模式：递增难度 + 每5波 Boss
export class WaveMode {
  constructor(bus) {
    this.bus = bus;
    this.name = '波次';
    this.wave = 0;
    this.alive = 0;
    this.targetWave = 10;
  }

  spawnLayout() {
    this.wave++;
    const isBoss = this.wave % 5 === 0;
    const count = isBoss ? 2 : Math.min(8, 2 + this.wave);
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
    if (!redAlive && this.wave >= this.targetWave) return 'blue';
    return null;
  }

  get waveInfo() { return { wave: this.wave, target: this.targetWave, alive: this.alive }; }
}
