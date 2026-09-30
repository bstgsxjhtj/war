import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';
import { WEAPON_STATS } from '../../core/constants/balance.js';

// 秘法匕首：法师近身应急，发光刃缘+符文柄
export class MageDagger extends Weapon {
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
    this.hitColor = 0xaa44ff;
    this.hitEffect = 'magic';
  }

  createMesh() {
    const g = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xddeeff, metalness: 0.6, roughness: 0.15, emissive: 0x6644aa, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xcc88ff, emissive: 0xaa44ff, emissiveIntensity: 0.9, roughness: 0.1 });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x6a4488, metalness: 0.7, roughness: 0.3, emissive: 0x2a1044, emissiveIntensity: 0.3 });
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x1a0a2a, roughness: 0.8 });
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0xaa44ff, emissive: 0x6622aa, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.3 });
    const runeMat = new THREE.MeshStandardMaterial({ color: 0xddaaff, emissive: 0xaa44ff, emissiveIntensity: 0.7, roughness: 0.3 });

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.04, 0);
    shape.lineTo(0.015, 0.55);
    shape.lineTo(0.008, 0.65);
    shape.lineTo(0, 0.7);
    shape.lineTo(0, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
    bladeGeo.translate(0, 0, -0.01);
    bladeGeo.rotateX(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.castShadow = true;

    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.6), edgeMat);
    edge.position.set(0.025, 0.01, 0.3);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.05), guardMat);
    const runeL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), runeMat);
    runeL.position.set(-0.08, 0, 0.005);
    const runeR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), runeMat);
    runeR.position.set(0.08, 0, 0.005);

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), hiltMat);
    grip.rotation.x = Math.PI / 2; grip.position.z = -0.15;

    const wrap1 = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 4, 6), guardMat);
    wrap1.position.z = -0.1; wrap1.rotation.x = Math.PI / 2;
    const wrap2 = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 4, 6), guardMat);
    wrap2.position.z = -0.2; wrap2.rotation.x = Math.PI / 2;

    const pommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), crystalMat);
    pommel.position.z = -0.27;
    const pommelGlow = new THREE.PointLight(0xaa44ff, 0.5, 2);
    pommelGlow.position.z = -0.27;

    g.add(blade, edge, guard, runeL, runeR, grip, wrap1, wrap2, pommel, pommelGlow);
    return g;
  }

  skill(a, c, now) {
    a._curVel.addScaledVector(a.forward, 20);
    c.resolveMelee(a, this, 2, now);
    return true;
  }
}
