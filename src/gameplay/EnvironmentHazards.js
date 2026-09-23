export class EnvironmentHazards {
  constructor(bus) {
    this._bus = bus;
    this._terrain = null;
    this._waterDPS = 40;
    this._wallBoxes = [];
    this._wallDPS = 15;
    this._pendingStrike = null;
    this._strikeRadius = 6;
    this._strikeDamage = 50;
  }

  setTerrain(t) { this._terrain = t; }

  addWallBox(box) { this._wallBoxes.push(box); }

  onLightningStrike(pos) {
    this._pendingStrike = { x: pos.x, z: pos.z };
  }

  update(dt, characters) {
    const now = Date.now() / 1000;

    for (const c of characters) {
      if (!c.alive) continue;
      const x = c.position.x, z = c.position.z;

      if (this._terrain && this._terrain.isWater(x, z)) {
        c.takeDamage(this._waterDPS * dt, false, null, now);
      }

      for (const box of this._wallBoxes) {
        if (x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ) {
          c.takeDamage(this._wallDPS * dt, false, null, now);
          break;
        }
      }
    }

    if (this._pendingStrike) {
      for (const c of characters) {
        if (!c.alive) continue;
        const dx = c.position.x - this._pendingStrike.x;
        const dz = c.position.z - this._pendingStrike.z;
        if (Math.hypot(dx, dz) < this._strikeRadius) {
          c.takeDamage(this._strikeDamage, true, null, now);
        }
      }
      this._pendingStrike = null;
    }
  }
}
