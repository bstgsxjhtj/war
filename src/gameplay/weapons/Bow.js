import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';
import { WEAPON_STATS } from '../../core/constants/balance.js';

// 弓：蓄力远程，hitFrame 提高使前摇可反应
export class Bow extends Weapon {
  constructor() {
    super({ ...WEAPON_STATS.BOW, type: AttackType.PROJECTILE });
    this.weaponClass = 'BOW';
    this.baseSpeed = 42;
    this.maxSpeed = 78;
    this.gravity = 9.5;
    this.hitFrame = 0.35;
    this._stringMesh = null;
    this.skillName = '穿透箭';
  }

  damageFor(charge) { return this.damage + 32 * Math.max(0, Math.min(1, charge)); }
  speedFor(charge) { return this.baseSpeed + (this.maxSpeed - this.baseSpeed) * Math.max(0, Math.min(1, charge)); }

  pullString(charge) {
    if (this._stringMesh) this._stringMesh.position.z = -0.32 * Math.max(0, Math.min(1, charge));
  }

  createMesh() {
    const g = new THREE.Group();
    const limbMat = new THREE.MeshStandardMaterial({ color: 0x6a4220, roughness: 0.6 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xc9a44a, metalness: 0.7, roughness: 0.4 });
    for (let i = 0; i < 5; i++) {
      const t = (i / 4 - 0.5) * Math.PI * 0.8;
      const seg = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 8, Math.PI / 5), limbMat);
      seg.rotation.z = -Math.PI / 2 + t;
      seg.position.set(0, Math.sin(t) * 0.62, 0);
      g.add(seg);
    }
    const string = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 1.25, 0.015),
      new THREE.MeshStandardMaterial({ color: 0xb0a888, roughness: 0.9 })
    );
    this._stringMesh = string;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), metalMat);
    grip.rotation.x = Math.PI / 2;
    const arrow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5),
      new THREE.MeshStandardMaterial({ color: 0xb98a4a, emissive: 0x2a1808, emissiveIntensity: 0.3 })
    );
    arrow.rotation.x = Math.PI / 2; arrow.position.set(0, 0, 0.45);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), metalMat);
    head.rotation.x = Math.PI / 2; head.position.set(0, 0, 0.95);
    g.add(string, grip, arrow, head);
    return g;
  }

  _perform(attacker, combat, opts) {
    combat.spawnArrow(attacker, this, opts.charge ?? 1);
    return { type: AttackType.PROJECTILE };
  }
  skill(a, c, now) { c.spawnPierceArrow(a, this, 1.0); return true; }
}
