import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';

// 重锤：破盾高伤慢攻，无视格挡
export class Warhammer extends Weapon {
  constructor() {
    super({ name: '重锤', damage: 55, range: 2.4, cooldown: 1.2, type: AttackType.MELEE, windup: 0.18 });
    this.weaponClass = 'HEAVY';
    this.armorPierce = true;
    this.arc = Math.PI * 0.4;
    this.comboDamage = [55, 45, 80];
    this.comboKnock = [3.0, 2.8, 5.0];
    this.comboLunge = [2.5, 2.0, 4.0];
    this.comboLaunch = [{ y: 0, rot: 0.4 }, { y: 4, rot: 0 }, { y: 8, rot: 0 }];
    this.hitFrame = 0.45;
    this.skillName = '震地';
  }
  createMesh() {
    const g = new THREE.Group();
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x7a7a82, metalness: 0.85, roughness: 0.35, emissive: 0x101018, emissiveIntensity: 0.1 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), handleMat);
    handle.rotation.x = Math.PI / 2; handle.position.z = -0.3; handle.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.4), metalMat);
    head.position.z = 0.5; head.castShadow = true;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), metalMat);
    spike.rotation.x = Math.PI / 2; spike.position.z = 0.95;
    g.add(handle, head, spike);
    return g;
  }
  _perform(attacker, combat, opts) {
    combat.resolveMelee(attacker, this, (opts.combo | 0), (opts.now ?? 0));
    return { type: AttackType.MELEE };
  }
  skill(a, c, now) { c.spawnAoE(a.position, 5, 50, a, now); return true; }
}
