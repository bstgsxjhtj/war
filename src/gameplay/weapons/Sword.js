import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';
import { WEAPON_STATS } from '../../core/constants/balance.js';
import { PALETTE } from '../../core/constants/palette.js';

// 刀：三段连击，cooldown 调优消除冷却死区，突进降防穿模
export class Sword extends Weapon {
  constructor() {
    super({ ...WEAPON_STATS.SWORD, type: AttackType.MELEE });
    this.arc = Math.PI * 0.55;
    this.comboDamage = [24, 20, 40];
    this.comboKnock = [1.2, 1.0, 2.6];
    this.comboLunge = [2.8, 2.0, 3.5];
    this.hitFrame = 0.35;
    this.skillName = '旋斩';
    this.hitColor = 0xff4422;
    this.hitEffect = 'normal';
  }

  createMesh() {
    const g = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfe7ee, metalness: 0.85, roughness: 0.25, emissive: PALETTE.WEAPON.BLADE_EMISSIVE, emissiveIntensity: PALETTE.WEAPON.BLADE_EMISSIVE_INTENSITY });
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xd4b25a, metalness: 0.8, roughness: 0.35 });
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.09, 0);
    shape.lineTo(0.025, 1.55);
    shape.lineTo(0, 1.7);
    shape.lineTo(0, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
    bladeGeo.translate(0, 0, -0.02);
    bladeGeo.rotateX(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.castShadow = true;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.12), guardMat);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 12), hiltMat);
    grip.rotation.x = Math.PI / 2; grip.position.z = -0.2;
    const pommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), guardMat);
    pommel.position.z = -0.38;
    g.add(blade, guard, grip, pommel);
    return g;
  }

  skill(a, c, now) { c.spawnAoE(a.position, 4, 40, a, now); return true; }
}
