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
    this._poisonZones = [];
    this._oilZones = [];
    this._poisonDPS = 25;
    this._oilIgniteDamage = 80;
  }

  setTerrain(t) { this._terrain = t; }

  addWallBox(box) { this._wallBoxes.push(box); }

  setHazardZones(zones) {
    this._poisonZones = [];
    this._oilZones = [];
    if (!zones) return;
    for (const z of zones) {
      if (z.type === 'poison') this._poisonZones.push(z);
      else if (z.type === 'oil') this._oilZones.push(z);
    }
  }

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

      for (const pz of this._poisonZones) {
        const dx = x - pz.x, dz = z - pz.z;
        if (dx * dx + dz * dz < pz.radius * pz.radius) {
          c.takeDamage((pz.dps || this._poisonDPS) * dt, false, null, now);
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

      const remainingOils = [];
      for (const oil of this._oilZones) {
        const dx = this._pendingStrike.x - oil.x;
        const dz = this._pendingStrike.z - oil.z;
        if (Math.hypot(dx, dz) < oil.radius + this._strikeRadius) {
          for (const c of characters) {
            if (!c.alive) continue;
            const cdx = c.position.x - oil.x;
            const cdz = c.position.z - oil.z;
            if (Math.hypot(cdx, cdz) < oil.radius) {
              c.takeDamage(this._oilIgniteDamage, true, null, now);
            }
          }
        } else {
          remainingOils.push(oil);
        }
      }
      this._oilZones = remainingOils;

      this._pendingStrike = null;
    }
  }
}
