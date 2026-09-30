import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';
import { WEAPON_STATS } from '../../core/constants/balance.js';

// 猎手匕首：弓箭手近身应急，弯曲刃+皮绳孔
export class HuntDagger extends Weapon {
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
    this.hitColor = 0x44ff44;
    this.hitEffect = 'wind';
  }

  createMesh() {
    const g = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xb0c8a0, metalness: 0.85, roughness: 0.2, emissive: 0x224422, emissiveIntensity: 0.08 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x88cc66, metalness: 0.6, roughness: 0.15, emissive: 0x448844, emissiveIntensity: 0.2 });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, metalness: 0.6, roughness: 0.4 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x3a2008, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.8 });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 0.6 });

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.05, 0);
    shape.bezierCurveTo(0.05, 0.3, 0.03, 0.55, 0.01, 0.68);
    shape.lineTo(0, 0.72);
    shape.lineTo(0, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false });
    bladeGeo.translate(0, 0, -0.0125);
    bladeGeo.rotateX(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.castShadow = true;

    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.55), edgeMat);
    edge.position.set(0.035, 0.01, 0.32);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.06), guardMat);
    const guardCurve = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 4, 8, Math.PI), guardMat);
    guardCurve.position.set(0.09, 0, 0); guardCurve.rotation.y = Math.PI / 2;

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), woodMat);
    grip.rotation.x = Math.PI / 2; grip.position.z = -0.15;
    for (let i = 0; i < 3; i++) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 4, 6), leatherMat);
      wrap.position.z = -0.1 + i * 0.08; wrap.rotation.x = Math.PI / 2;
      g.add(wrap);
    }

    const lanyard = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 4, 8), leatherMat);
    lanyard.position.z = -0.3; lanyard.rotation.y = Math.PI / 2;

    const pommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), boneMat);
    pommel.position.z = -0.34;

    g.add(blade, edge, guard, guardCurve, grip, lanyard, pommel);
    return g;
  }

  skill(a, c, now) {
    a._curVel.addScaledVector(a.forward, 20);
    c.resolveMelee(a, this, 2, now);
    return true;
  }
}
