import * as THREE from 'three';
import { Character } from './Character.js';

// AI：战术层(包抄/撤退/集火) + 反应延迟
export class AIController extends Character {
  constructor({ team = 1 } = {}) {
    super({ team, isLocal: false, speed: 6.2, maxHp: 90 });
    this._state = 'patrol';
    this._patrolTarget = new THREE.Vector3();
    this._formationTarget = null;
    this._formationYaw = null;
    this._retargetTimer = 0;
    this._reactTimer = 0;
    this._swordReactTimer = 0;
    this._strafePhase = 0;
    this._focusTarget = null;
    this._focusTimer = 0;
    this._vDir = new THREE.Vector3();
    this._vFlank = new THREE.Vector3();
    this._pickPatrol();
  }

  _pickPatrol(center) {
    const base = center || this.position;
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 14;
    this._patrolTarget.set(base.x + Math.cos(a) * r, 0, base.z + Math.sin(a) * r);
  }

  // 包抄方向：计算友军覆盖角度，从缺口侧接近
  _calcFlankDir(target, allAllies) {
    this._vFlank.subVectors(target.position, this.position).setY(0).normalize();
    let cover = 0;
    for (const a of allAllies) {
      if (a === this || !a.alive) continue;
      const d = a.position.clone().sub(target.position).setY(0).normalize();
      const dot = d.dot(this._vFlank);
      if (dot > 0.3) cover += 1;
    }
    if (cover >= 2) {
      // 已有友军从正面，侧翼包抄
      const perp = new THREE.Vector3(-this._vFlank.z, 0, this._vFlank.x);
      return perp.multiplyScalar(Math.sin(this._strafePhase) > 0 ? 1 : -1);
    }
    return this._vFlank.clone();
  }

  update(dt, terrain, combat, enemies, now) {
    if (!this.alive) { super.update(dt, terrain, combat, now); return; }
    if (this._passive) { this.setMove(0, 0); this.setSprint(false); super.update(dt, terrain, combat, now); return; }
    this._strafePhase += dt * 1.2;
    if (this._swordReactTimer > 0) this._swordReactTimer -= dt;
    this._focusTimer -= dt;

    // 集火协调：每2s选血量最低敌方
    if (this._focusTimer <= 0) {
      this._focusTimer = 2;
      let best = null, minHp = Infinity;
      for (const e of enemies) {
        if (!e.alive || e.team === this.team) continue;
        if (e.health.ratio < minHp) { minHp = e.health.ratio; best = e; }
      }
      this._focusTarget = best;
    }

    // 撤退：低血量
    if (this.health.ratio < 0.3) {
      this._state = 'retreat';
      let nearest = null, minD = Infinity;
      for (const e of enemies) {
        if (!e.alive || e.team === this.team) continue;
        const d = e.position.distanceTo(this.position);
        if (d < minD) { minD = d; nearest = e; }
      }
      if (nearest) {
        this._vDir.subVectors(this.position, nearest.position).setY(0).normalize();
        this.setLook(Math.atan2(this._vDir.x, this._vDir.z));
        this.setMove(1, 0);
        this.setSprint(true);
        super.update(dt, terrain, combat, now);
        return;
      }
    }

    let target = this._focusTarget && this._focusTarget.alive ? this._focusTarget : null;
    let minDist = target ? target.position.distanceTo(this.position) : Infinity;
    if (!target) {
      for (const e of enemies) {
        if (!e.alive || e.team === this.team) continue;
        const d = e.position.distanceTo(this.position);
        if (d < minDist) { minDist = d; target = e; }
      }
    }

    const w = this.weapon;
    const isBow = w.type === 'projectile';
    const engageRange = isBow ? 40 : w.range * 0.9;

    if (target) {
      this._reactTimer -= dt;
      this._vDir.subVectors(target.position, this.position);
      this._vDir.y = 0;
      const dist = this._vDir.length();
      this._vDir.normalize();
      this.setLook(Math.atan2(this._vDir.x, this._vDir.z));

      if (isBow && dist < 14) {
        // 弓兵近战逼近后撤
        this._state = 'retreat';
        this.setMove(-0.8, Math.sin(this._strafePhase) * 0.4);
        this.setSprint(true);
      } else if (dist > engageRange) {
        this._state = 'chase';
        this.setMove(1, 0);
        this.setSprint(dist > 18);
      } else {
        this._state = 'attack';
        if (isBow) {
          this.setMove(dist < 18 ? -0.5 : 0, Math.sin(this._strafePhase) * 0.5);
          this.setSprint(false);
          if (this._reactTimer <= 0 && w.ready) {
            const savedYaw = this._targetYaw;
            this.setLook(savedYaw + (Math.random() - 0.5) * 0.28);
            this.tryAttack(combat, 0.3);
            this.setLook(savedYaw);
            this._reactTimer = 1.2 + Math.random() * 0.8;
          }
        } else {
          // 近战包抄
          const allies = enemies.filter(e => e.team === this.team);
          const flank = this._calcFlankDir(target, allies);
          this.setMove(flank.dot(this.forward) > 0 ? 1 : 0.3, Math.sin(this._strafePhase) * 0.4);
          this.setSprint(false);
          if (this._swordReactTimer <= 0 && w.ready) {
            this.tryAttack(combat, 1);
            this._swordReactTimer = 0.5 + Math.random() * 0.4;
          }
        }
      }
    } else {
      this._state = 'patrol';
      if (this._formationTarget) {
        this._patrolTarget.copy(this._formationTarget);
        if (this._formationYaw !== null) this.setLook(this._formationYaw);
      }
      this._vDir.subVectors(this._patrolTarget, this.position);
      this._vDir.y = 0;
      const dist = this._vDir.length();
      if (dist < 1.5 || this._retargetTimer <= 0) {
        this._pickPatrol(this.position);
        this._retargetTimer = 4 + Math.random() * 4;
      } else {
        this._vDir.normalize();
        this.setLook(Math.atan2(this._vDir.x, this._vDir.z));
        this.setMove(1, 0);
        this.setSprint(false);
      }
    }

    this._retargetTimer -= dt;
    super.update(dt, terrain, combat, now);
  }
}
