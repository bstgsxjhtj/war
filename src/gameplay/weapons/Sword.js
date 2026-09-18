import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';

// 刀：三段连击，cooldown 调优消除冷却死区，突进降防穿模
export class Sword extends Weapon {
  constructor() {
    super({ name: '刀', damage: 24, range: 2.9, cooldown: 0.27, type: AttackType.MELEE, windup: 0.06 });
    this.arc = Math.PI * 0.55;
    this.comboDamage = [24, 20, 40];
    this.comboKnock = [1.2, 1.0, 2.6];
    this.comboLunge = [2.8, 2.0, 3.5];
    this.hitFrame = 0.35;
    this.skillName = '旋斩';
  }

  createMesh() {
    const g = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfe7ee, metalness: 0.85, roughness: 0.25, emissive: 0x1a2030, emissiveIntensity: 0.12 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xc8d4dc, metalness: 0.9, roughness: 0.2, emissive: 0x1a2030, emissiveIntensity: 0.15 });
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xd4b25a, metalness: 0.8, roughness: 0.35 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.04, 1.7), bladeMat);
    blade.position.set(0, 0, 0.85); blade.castShadow = true;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 1.7), edgeMat);
    edge.position.set(0, 0.04, 0.85);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.25, 4), edgeMat);
    tip.rotation.x = Math.PI / 2; tip.position.set(0, 0, 1.78);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.12), guardMat);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8), hiltMat);
    grip.rotation.x = Math.PI / 2; grip.position.z = -0.2;
    const pommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), guardMat);
    pommel.position.z = -0.38;
    g.add(blade, edge, tip, guard, grip, pommel);
    return g;
  }

  _perform(attacker, combat, opts) {
    combat.resolveMelee(attacker, this, (opts.combo | 0), (opts.now ?? 0));
    return { type: AttackType.MELEE };
  }
  skill(a, c, now) { c.spawnAoE(a.position, 4, 40, a, now); return true; }
}
