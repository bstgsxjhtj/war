// 战场模式：前半场为波次防守，清空后转入攻城阶段（破城门或全歼守军取胜）
import { WaveMode } from './WaveMode.js';

const SIEGE_GUARDS = [
  { x: 0, z: 34, ang: Math.PI },
  { x: -6, z: 33, ang: Math.PI },
  { x: 6, z: 33, ang: Math.PI },
  { x: -12, z: 31, ang: Math.PI },
  { x: 12, z: 31, ang: Math.PI },
];

export class BattlefieldMode extends WaveMode {
  constructor(bus, waveTarget = 4) {
    super(bus, false);
    this.name = '战场';
    this.targetWave = waveTarget;
    this.phase = 'wave'; // 'wave' 波次防守 | 'siege' 攻城
  }

  get isSiege() { return this.phase === 'siege'; }

  // 攻城阶段布阵：守军在城门前列阵，首位为城门 Boss
  _siegeLayout() {
    return {
      blue: [{ x: -16, z: -30 }],
      red: SIEGE_GUARDS.map((g, i) => (i === 0 ? { ...g, isBoss: true } : { ...g })),
      isBoss: true,
      wave: this.wave,
      modifier: null,
      siege: true,
    };
  }

  spawnLayout() {
    if (this.phase === 'siege') return this._siegeLayout();
    return super.spawnLayout();
  }

  // 波次阶段结束 → 攻城阶段
  advanceToSiege() {
    this.phase = 'siege';
    this.wave++;
    this.alive = 0;
    return this._siegeLayout();
  }

  onKill() {
    if (this.phase === 'wave') this.alive = Math.max(0, this.alive - 1);
  }

  checkWin(blueAlive, redAlive, siegeBroken = false) {
    if (!blueAlive) return 'red';
    if (this.phase !== 'siege') return null; // 波次阶段由主循环推进，不判胜负
    return (siegeBroken || !redAlive) ? 'blue' : null;
  }

  get waveInfo() {
    return { wave: this.wave, target: this.targetWave, alive: this.alive, phase: this.phase, isSiege: this.isSiege };
  }

  reset() {
    this.phase = 'wave';
    this.wave = 0;
    this.alive = 0;
    this.modifier = null;
    this.nextModifier = null;
  }
}