// 游戏模式基类 + 死斗/据点占领
export class GameMode {
  constructor(bus) { this.bus = bus; this.name = 'base'; this.targetScore = 100; }
  spawnLayout() { return { blue: [], red: [] }; }
  onKill(victim, killer) {}
  onTick(dt) {}
  checkWin(state) { return null; }
}

// 死斗：全灭制
export class Deathmatch extends GameMode {
  constructor(bus) { super(bus); this.name = '死斗'; }
  spawnLayout() {
    return {
      blue: [{ x: -16, z: 0 }],
      red: [{ x: 26, z: 0, ang: 0 }, { x: 28, z: 6, ang: 0.8 }, { x: 28, z: -6, ang: -0.8 }, { x: 30, z: 0, ang: 0 }]
    };
  }
  checkWin(blueAlive, redAlive) {
    if (!redAlive) return 'blue';
    if (!blueAlive) return 'red';
    return null;
  }
}

// 据点占领：3 旗帜点，占领方持续得分
export class Domination extends GameMode {
  constructor(bus) {
    super(bus);
    this.name = '据点';
    this.targetScore = 100;
    this.points = [
      { pos: { x: 0, z: 0 }, team: -1, progress: 0, rate: 0 },
      { pos: { x: -20, z: 15 }, team: -1, progress: 0, rate: 0 },
      { pos: { x: 20, z: -15 }, team: -1, progress: 0, rate: 0 }
    ];
    this.scoreB = 0; this.scoreR = 0;
    this._tickAcc = 0;
  }
  spawnLayout() {
    return {
      blue: [{ x: -16, z: -20 }],
      red: [{ x: 26, z: 20, ang: 0 }, { x: 28, z: 26, ang: 0.8 }, { x: 28, z: 14, ang: -0.8 }, { x: 30, z: 20, ang: 0 }]
    };
  }
  // 占领点更新：附近角色推动 progress
  updatePoints(characters, dt) {
    for (const p of this.points) {
      let blue = 0, red = 0;
      for (const c of characters) {
        if (!c.alive) continue;
        const d = Math.hypot(c.position.x - p.pos.x, c.position.z - p.pos.z);
        if (d < 3) { if (c.team === 0) blue++; else red++; }
      }
      if (blue > 0 && red === 0) {
        p.progress = Math.min(1, p.progress + dt * (0.3 + blue * 0.15));
        if (p.progress >= 1) p.team = 0;
      } else if (red > 0 && blue === 0) {
        p.progress = Math.min(1, p.progress + dt * (0.3 + red * 0.15));
        if (p.progress >= 1) p.team = 1;
      } else if (blue === 0 && red === 0) {
        p.progress = Math.max(0, p.progress - dt * 0.1);
      }
      p.rate = blue - red;
    }
  }
  onTick(dt, characters) {
    this.updatePoints(characters, dt);
    this._tickAcc += dt;
    if (this._tickAcc >= 1) {
      this._tickAcc = 0;
      for (const p of this.points) {
        if (p.team === 0) this.scoreB += 5;
        else if (p.team === 1) this.scoreR += 5;
      }
    }
  }
  checkWin() {
    if (this.scoreB >= this.targetScore) return 'blue';
    if (this.scoreR >= this.targetScore) return 'red';
    return null;
  }
}

// 攻城：蓝方破城门获胜，红方守城（击杀攻方获胜）
export class SiegeMode extends GameMode {
  constructor(bus) { super(bus); this.name = '攻城'; }
  spawnLayout() {
    return {
      blue: [{ x: -20, z: -30 }],
      red: [
        { x: 0, z: 35, ang: Math.PI },
        { x: -6, z: 36, ang: Math.PI },
        { x: 6, z: 36, ang: Math.PI },
        { x: 0, z: 38, ang: Math.PI }
      ]
    };
  }
}
