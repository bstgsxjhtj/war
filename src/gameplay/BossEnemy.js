import { AIController } from './AIController.js';
import * as THREE from 'three';

export class BossEnemy extends AIController {
  constructor({ team = 1, type = 'warlord' } = {}) {
    super({ team });
    this._isBoss = true;
    this._bossType = type;
    this._phase = 1;
    this._maxHp = type === 'warlord' ? 300 : 220;
    this.maxHp = this._maxHp;
    this.hp = this._maxHp;
    this.speed = type === 'warlord' ? 5.5 : 6.0;
    this._phaseTimer = 0;
    this._enrageTimer = 0;
    this._slamTimer = 4;
    this._aoeRadius = 6;
    this._name = type === 'warlord' ? '战将' : '游侠';
    this._meshScaled = false;
    this.damageReduction = 0;
  }

  get displayName() { return '【Boss】' + this._name; }

  update(dt, terrain, combat, enemies, now) {
    if (!this._meshScaled && this.root) {
      this.root.scale.set(1.35, 1.35, 1.35);
      this._meshScaled = true;
    }
    const hpPct = this.hp / this._maxHp;
    if (this._phase === 1 && hpPct < 0.6) {
      this._phase = 2; this.speed *= 1.2; this._enrageTimer = 5;
      this._bus && this._bus.emit('hud.bossPhase', { boss: this, phase: 2 });
    }
    if (this._phase === 2 && hpPct < 0.3) {
      this._phase = 3; this.speed *= 1.15; this._enrageTimer = 8;
      this._bus && this._bus.emit('hud.bossPhase', { boss: this, phase: 3 });
    }
    if (this._enrageTimer > 0) {
      this._enrageTimer -= dt;
      this.damageReduction = 0.4;
    } else this.damageReduction = 0;
    this._slamTimer -= dt;
    if (this._slamTimer <= 0 && this._phase >= 2 && enemies && enemies.length > 0) {
      const nearest = enemies.find(e => e.alive && e.root.position.distanceTo(this.root.position) < this._aoeRadius + 2);
      if (nearest) {
        combat.spawnAoE(this.root.position, this._aoeRadius, 25 + this._phase * 10, this, now);
        this._slamTimer = this._phase === 3 ? 3 : 5;
        this._bus && this._bus.emit('fx.shake', { amount: 0.4 });
      } else this._slamTimer = 1;
    }
    super.update(dt, terrain, combat, enemies, now);
  }
}

export class EliteEnemy extends AIController {
  constructor({ team = 1 } = {}) {
    super({ team });
    this._isElite = true;
    this._maxHp = 140;
    this.maxHp = this._maxHp;
    this.hp = this._maxHp;
    this.speed = 6.8;
    this._name = '精兵';
    this._meshScaled = false;
    this._dodgeChance = 0.25;
  }

  get displayName() { return '【精英】' + this._name; }

  update(dt, terrain, combat, enemies, now) {
    if (!this._meshScaled && this.root) {
      this.root.scale.set(1.15, 1.15, 1.15);
      this._meshScaled = true;
    }
    super.update(dt, terrain, combat, enemies, now);
  }

  takeDamage(amount, heavy = false, attacker = null, now = 0) {
    if (Math.random() < this._dodgeChance && this.alive && this._dodgeIFrame <= 0) {
      this._bus && this._bus.emit('hud.miss', { target: this });
      return 0;
    }
    return super.takeDamage(amount, heavy, attacker, now);
  }
}
