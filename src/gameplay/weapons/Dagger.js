import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';
import { WEAPON_STATS } from '../../core/constants/balance.js';
import { PALETTE } from '../../core/constants/palette.js';

// 匕首：快速近战，低伤害高频次，影刃突进技能
export class Dagger extends Weapon {
  constructor() {
    super({ ...WEAPON_STATS.DAGGER, type: AttackType.MELEE });
    this.weaponClass = 'DAGGER';
    this.arc = Math.PI * 0.4;
    this.comboDamage = [12, 10, 22];
    this.comboKnock = [0.5, 0.4, 1.5];
    this.comboLunge = [2.0, 1.5, 2.8];
    this.hitFrame = 0.22;
    this.skillName = '影刃';
    this.skillDesc = '突进斩击';
    this.hitColor = 0xff8844;
    this.hitEffect = 'normal';
  }

  createMesh() {
    const g = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc0c8d0, metalness: 0.9, roughness: 0.15, emissive: PALETTE.WEAPON.BLADE_EMISSIVE, emissiveIntensity: PALETTE.WEAPON.BLADE_EMISSIVE_INTENSITY });
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.8 });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.7, roughness: 0.3 });

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.05, 0);
    shape.lineTo(0.015, 0.6);
    shape.lineTo(0, 0.7);
    shape.lineTo(0, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false });
    bladeGeo.translate(0, 0, -0.0125);
    bladeGeo.rotateX(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.castShadow = true;

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.08), guardMat);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), hiltMat);
    grip.rotation.x = Math.PI / 2; grip.position.z = -0.15;
    const pommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), guardMat);
    pommel.position.z = -0.27;

    g.add(blade, guard, grip, pommel);
    return g;
  }

  skill(a, c, now) {
    a._curVel.addScaledVector(a.forward, 20);
    c.resolveMelee(a, this, 2, now);
    return true;
  }
}
