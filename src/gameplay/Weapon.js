// 武器基类：数据契约，命中帧由 Character 调用 _perform
export const AttackType = { MELEE: 'melee', PROJECTILE: 'projectile' };

export class Weapon {
  constructor({ name, damage, range, cooldown, type, windup = 0 }) {
    this.name = name;
    this.damage = damage;
    this.range = range;
    this.cooldown = cooldown;
    this.type = type;
    this.windup = windup;
    this.weaponClass = 'SWORD';
    this.armorPierce = false;
    this.shieldBlock = false;
    this._timer = 0;
  }

  get ready() { return this._timer <= 0; }
  tick(dt) { if (this._timer > 0) this._timer -= dt; }
  _perform(_attacker, _combat, _opts) { throw new Error('未实现'); }
}
