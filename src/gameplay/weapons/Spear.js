import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';

// 长枪：长距突刺窄弧，风筝盾兵
export class Spear extends Weapon {
  constructor() {
    super({ name: '枪', damage: 18, range: 4.2, cooldown: 0.4, type: AttackType.MELEE, windup: 0.1 });
    this.weaponClass = 'SPEAR';
    this.armorPierce = false;
    this.arc = Math.PI * 0.15;
    this.comboDamage = [18, 16, 30];
    this.comboKnock = [1.5, 1.2, 3.0];
    this.comboLunge = [4.0, 3.0, 4.5];
    this.comboLaunch = [{ y: 0, rot: 0.2 }, { y: 2, rot: 0 }, { y: 0, rot: 0, aoe: 1.5 }];
    this.hitFrame = 0.4;
    this.skillName = '突刺';
  }
  createMesh() {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6a4220, roughness: 0.7 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xc9a44a, metalness: 0.8, roughness: 0.3, emissive: 0x1a1408, emissiveIntensity: 0.15 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), woodMat);
    shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.4; shaft.castShadow = true;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 6), metalMat);
    head.rotation.x = Math.PI / 2; head.position.z = 2.0;
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), new THREE.MeshStandardMaterial({ color: 0xc03030, roughness: 0.9 }));
    tassel.position.set(0, -0.1, 1.6);
    g.add(shaft, head, tassel);
    return g;
  }
  skill(a, c, now) { a._lunge(6); c.resolveMelee(a, this, 2, now); return true; }
}
