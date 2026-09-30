import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';
import { WEAPON_STATS } from '../../core/constants/balance.js';

// 法杖：远程法术投射物，火球术 AoE 技能，陨石雨终极
export class Staff extends Weapon {
  constructor() {
    super({ ...WEAPON_STATS.STAFF, type: AttackType.PROJECTILE });
    this.weaponClass = 'STAFF';
    this.baseSpeed = 38;
    this.maxSpeed = 52;
    this.hitFrame = 0.3;
    this.skillName = '火球术';
    this.skillDesc = '前方范围爆炸';
    this.hitColor = 0x44aaff;
    this.hitEffect = 'magic';
    this.projectileColor = 0x44aaff;
  }

  damageFor(charge) { return this.damage + 12 * Math.max(0, Math.min(1, charge)); }
  speedFor(charge) { return this.baseSpeed + (this.maxSpeed - this.baseSpeed) * Math.max(0, Math.min(1, charge)); }

  createMesh() {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.7 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.8 });
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, emissive: 0x2266cc, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.3 });
    const innerGlowMat = new THREE.MeshStandardMaterial({ color: 0x88ddff, emissive: 0x44aaff, emissiveIntensity: 1.2, roughness: 0.1 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4b25a, metalness: 0.8, roughness: 0.35 });
    const runeMat = new THREE.MeshStandardMaterial({ color: 0x88ddff, emissive: 0x44aaff, emissiveIntensity: 0.9, roughness: 0.3 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 8), woodMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.2; shaft.castShadow = true;

    for (let i = 0; i < 3; i++) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.04), runeMat);
      rune.position.z = -0.2 + i * 0.2;
      g.add(rune);
    }

    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), crystalMat);
    orb.position.z = 1.05; orb.castShadow = true;
    const innerGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), innerGlowMat);
    innerGlow.position.z = 1.05;

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.015, 4, 16), crystalMat);
    ring.position.z = 1.05; ring.rotation.x = Math.PI / 2;

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), goldMat);
    collar.position.z = 0.85; collar.rotation.x = Math.PI / 2;

    const hornL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.2, 5), darkWoodMat);
    hornL.position.set(0.06, 0, 0.9); hornL.rotation.set(0.3, 0, 0.3);
    const hornR = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.2, 5), darkWoodMat);
    hornR.position.set(-0.06, 0, 0.9); hornR.rotation.set(-0.3, 0, -0.3);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8), goldMat);
    grip.rotation.x = Math.PI / 2; grip.position.z = -0.1;
    const gripWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.2, 8), darkWoodMat);
    gripWrap.rotation.x = Math.PI / 2; gripWrap.position.z = -0.1;

    g.add(shaft, orb, innerGlow, ring, collar, hornL, hornR, grip, gripWrap);
    return g;
  }

  _perform(attacker, combat, opts) {
    combat.spawnArrow(attacker, this, opts.charge ?? 1);
    return { type: AttackType.PROJECTILE };
  }

  skill(a, c, now) {
    const p = a.position.clone().addScaledVector(a.forward, 6);
    c.spawnAoE(p, 5, 55, a, now);
    return true;
  }
}
