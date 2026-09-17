// 耐力资源条：限制闪避/冲刺/格挡/蓄力 spam
export class Stamina {
  constructor(max = 100) {
    this.max = max;
    this.cur = max;
    this._debuff = false;
  }
  get ratio() { return this.cur / this.max; }
  get depleted() { return this._debuff; }
  consume(n) {
    this.cur = Math.max(0, this.cur - n);
    this._debuff = this.cur < 30;
    return this.cur > 0;
  }
  regen(dt, inCombat) {
    const rate = inCombat ? 8 : 22;
    this.cur = Math.min(this.max, this.cur + rate * dt);
    this._debuff = this.cur < 30;
  }
}
