// 血量：受击扣血、死亡、复活
export class Health {
  constructor(maxHp = 100) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.alive = true;
  }

  // 别名：兼容 Stamina 风格的 cur/max 访问（修复跨模块字段名混用）
  get cur() { return this.hp; }
  set cur(v) { this.hp = v; }
  get max() { return this.maxHp; }
  set max(v) { this.maxHp = v; }

  damage(amount) {
    if (!this.alive) return 0;
    const before = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this.alive = false;
    return before - this.hp;
  }

  heal(amount) {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  revive() {
    this.hp = this.maxHp;
    this.alive = true;
  }

  get ratio() { return this.hp / this.maxHp; }
}
