export class WeaponSkills {
  constructor(cdMax = 8) {
    this._cd = [0, 0, 0, 0];
    this._cdMax = cdMax;
  }
  canCast(idx) { return this._cd[idx] <= 0; }
  cdRemaining(idx) { return this._cd[idx]; }
  trigger(idx) { this._cd[idx] = this._cdMax; }
  update(dt) { for (let i = 0; i < 4; i++) if (this._cd[i] > 0) this._cd[i] = Math.max(0, this._cd[i] - dt); }
  reset() { this._cd = [0, 0, 0, 0]; }
}
