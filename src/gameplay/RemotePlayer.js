import * as THREE from 'three';
import { Character } from './Character.js';

// 远端玩家：由网络状态驱动插值渲染，不本地模拟移动/攻击
export class RemotePlayer extends Character {
  constructor({ id, team }) {
    super({ team, isLocal: false, speed: 0, maxHp: 160 });
    this.netId = id;
    this._targetPos = new THREE.Vector3();
    this._targetYaw = 0;
    this._targetHp = 160;
    this._targetAnim = 'idle';
    this._animTimer = 0;
  }

  setTarget(pos, yaw, hp, weapon, alive, anim) {
    this._targetPos.set(pos.x, pos.y, pos.z);
    this._targetYaw = yaw;
    this._targetHp = hp;
    if (weapon !== undefined && weapon !== this.weaponIdx && weapon < this.weapons.length) {
      this.switchWeapon(weapon);
    }
    if (alive === false && this.alive) this.die(null);
    this._targetAnim = anim || 'idle';
    if (anim === 'attack') this._animTimer = 0.4;
  }

  update(dt, terrain, combat, now) {
    if (!this.alive) {
      if (this._deadTimer > 0) {
        this._deadTimer -= dt;
        const k = Math.min(1, (1.2 - this._deadTimer) / 0.4);
        this.root.rotation.x = -Math.PI / 2 * k;
        this.root.position.y = this.position.y - 0.3 * k;
        if (this._deadTimer <= 0) this.root.visible = false;
      }
      return;
    }
    this.position.lerp(this._targetPos, Math.min(1, dt * 12));
    this.root.position.copy(this.position);
    let dy = this._targetYaw - this._yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this._yaw += dy * Math.min(1, dt * 12);
    this.forward.set(Math.sin(this._yaw), 0, Math.cos(this._yaw));
    this.root.rotation.y = this._yaw;
    if (this._targetHp < this.health.cur) {
      this.health.cur = this._targetHp;
      this._updateHpBar();
      if (!this.health.alive) this.die(null);
    }
    if (this._animTimer > 0) {
      this._animTimer -= dt;
      this.weaponPivot.rotation.x = Math.sin((0.4 - this._animTimer) * Math.PI / 0.4) * 1.8;
    } else {
      this.weaponPivot.rotation.x *= 0.8;
    }
    this.cape.material.uniforms.uTime.value = now;
    this.cape.material.uniforms.uMove.value = this.position.distanceTo(this._targetPos) > 0.5 ? 1 : 0;
  }

  applyHit(dmg, heavy, attacker) {
    return this.takeDamage(dmg, heavy, attacker, performance.now() * 0.001);
  }
}
