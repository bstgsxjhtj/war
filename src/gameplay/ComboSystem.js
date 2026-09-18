export class ComboSystem {
  constructor(bus = null) {
    this._bus = bus;
    this.count = 0;
    this._lastHit = 0;
    this._tier = 0;
    this._finisher = false;
    this._decayDelay = 3;
    this._decayRate = 1;
    this._tiers = [[0, 1.0], [5, 1.1], [10, 1.2], [20, 1.3]];
  }

  onHit(countered, perfect, now) {
    const oldTier = this._tier;
    this.count += countered ? 2 : (perfect ? 3 : 1);
    this._lastHit = now;
    this._updateTier();
    let mul = this._tiers[this._tier][1];
    if (this._finisher) { mul *= 1.5; this._finisher = false; }
    if (oldTier < 3 && this._tier >= 3) {
      this._finisher = true;
      this._bus?.emit('combo.finisher');
    }
    if (this._tier !== oldTier) this._bus?.emit('combo.tier', { tier: this._tier, count: this.count });
    return mul;
  }

  onHurt() {
    if (this.count > 0 || this._finisher) {
      this.count = 0;
      this._tier = 0;
      this._finisher = false;
      this._bus?.emit('combo.break', { count: 0 });
    }
  }

  update(dt, now) {
    if (this.count <= 0) return;
    if (now - this._lastHit > this._decayDelay) {
      this.count -= this._decayRate * dt;
      if (this.count <= 0) {
        this.count = 0;
        this._tier = 0;
        this._finisher = false;
        this._bus?.emit('combo.break', { count: 0 });
      } else {
        this._updateTier();
      }
    }
  }

  _updateTier() {
    let t = 0;
    for (let i = 0; i < this._tiers.length; i++) if (this.count >= this._tiers[i][0]) t = i;
    this._tier = t;
  }

  get tier() { return this._tier; }
  get damageMul() { return this._tiers[this._tier][1]; }
  get hasFinisher() { return this._finisher; }
}
