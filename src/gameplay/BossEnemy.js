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
    this._chargeCd = 0;
    this._roarCd = 0;
    this._summoned = false;
    this._chargeDir = new THREE.Vector3();
  }

  get displayName() { return '【Boss】' + this._name; }

  enterPhase(p) { if (p > this._phase) { this._phase = p; this.speed *= 1.15; this._enrageTimer = 5; } }

  _skillCharge(target, combat, now) {
    if (!target) return;
    this._chargeDir.subVectors(target.position, this.root.position).setY(0).normalize();
    this.root.position.add(this._chargeDir.clone().multiplyScalar(8));
    const enemies = combat.characters || [];
    for (const e of enemies) {
      if (!e.alive || e.team === this.team) continue;
      if (e.root.position.distanceTo(this.root.position) < 2.5) {
        e.root.position.add(this._chargeDir.clone().multiplyScalar(3));
        e.takeDamage(40, true, this, now);
      }
    }
    this._bus && this._bus.emit('fx.shake', { amount: 0.3 });
  }

  _skillRoar(combat, now) {
    const enemies = combat.characters || [];
    for (const e of enemies) {
      if (!e.alive || e.team === this.team) continue;
      const d = e.root.position.distanceTo(this.root.position);
      if (d < 6) {
        const back = new THREE.Vector3().subVectors(e.root.position, this.root.position).setY(0).normalize().multiplyScalar(4);
        e.root.position.add(back);
        e._slowTimer = (e._slowTimer || 0) + 1.5;
      }
    }
    combat.spawnAoE(this.root.position, 6, 15, this, now);
    this._bus && this._bus.emit('fx.shake', { amount: 0.5 });
  }

  _skillSummon() {
    if (this._summoned) return;
    this._summoned = true;
    this._bus && this._bus.emit('boss.summon', { pos: this.root.position.clone(), team: this.team, count: 2 });
  }

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
    this._chargeCd -= dt;
    this._roarCd -= dt;
    if (this._slamTimer <= 0 && this._phase >= 2 && enemies && enemies.length > 0) {
      const nearest = enemies.find(e => e.alive && e.root.position.distanceTo(this.root.position) < this._aoeRadius + 2);
      if (nearest) {
        combat.spawnAoE(this.root.position, this._aoeRadius, 25 + this._phase * 10, this, now);
        this._slamTimer = this._phase === 3 ? 3 : 5;
        this._bus && this._bus.emit('fx.shake', { amount: 0.4 });
      } else this._slamTimer = 1;
    }
    if (this._phase >= 2 && this._chargeCd <= 0 && enemies) {
      const tgt = enemies.find(e => e.alive && e.team !== this.team);
      if (tgt) { this._skillCharge(tgt, combat, now); this._chargeCd = 8; }
    }
    if (this._phase >= 2 && this._roarCd <= 0) {
      this._skillRoar(combat, now); this._roarCd = 12;
    }
    if (this._phase >= 3 && !this._summoned) {
      this._skillSummon();
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
