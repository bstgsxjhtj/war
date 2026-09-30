import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';
import { WEAPON_STATS } from '../../core/constants/balance.js';

// 长枪：长距突刺窄弧，风筝盾兵
export class Spear extends Weapon {
  constructor() {
    super({ ...WEAPON_STATS.SPEAR, type: AttackType.MELEE });
    this.weaponClass = 'SPEAR';
    this.armorPierce = false;
    this.arc = Math.PI * 0.15;
    this.comboDamage = [18, 16, 30];
    this.comboKnock = [1.5, 1.2, 3.0];
    this.comboLunge = [4.0, 3.0, 4.5];
    this.comboLaunch = [{ y: 0, rot: 0.2 }, { y: 2, rot: 0 }, { y: 0, rot: 0, aoe: 1.5 }];
    this.hitFrame = 0.4;
    this.skillName = '突刺';
    this.hitColor = 0xff4422;
    this.hitEffect = 'normal';
  }
  createMesh() {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6a4220, roughness: 0.7 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4a2a10, roughness: 0.8 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xc9a44a, metalness: 0.8, roughness: 0.3, emissive: 0x1a1408, emissiveIntensity: 0.15 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c0, metalness: 0.9, roughness: 0.2 });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8), woodMat);
    shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.4; shaft.castShadow = true;

    const band1 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 8), metalMat);
    band1.position.z = 1.0; band1.rotation.x = Math.PI / 2;
    const band2 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 8), metalMat);
    band2.position.z = -0.3; band2.rotation.x = Math.PI / 2;

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.55, 8), steelMat);
    head.rotation.x = Math.PI / 2; head.position.z = 2.05; head.castShadow = true;
    const midrib = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.4), metalMat);
    midrib.position.z = 1.9;

    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.28), new THREE.MeshStandardMaterial({ color: 0xc03030, roughness: 0.9, side: THREE.DoubleSide }));
    banner.position.set(0.06, 0, 1.6);

    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xc03030, roughness: 0.9 }));
    tassel.position.set(0, -0.08, 1.55);

    const ferrule = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 6), metalMat);
    ferrule.rotation.x = -Math.PI / 2; ferrule.position.z = -1.2;

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.4, 8), darkWoodMat);
    grip.rotation.x = Math.PI / 2; grip.position.z = -0.8;

    g.add(shaft, band1, band2, head, midrib, banner, tassel, ferrule, grip);
    return g;
  }
  skill(a, c, now) { a._lunge(6); c.resolveMelee(a, this, 2, now); return true; }
}
