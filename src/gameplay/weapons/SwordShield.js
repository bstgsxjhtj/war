import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';
import { WEAPON_STATS } from '../../core/constants/balance.js';

// 剑盾：持盾格挡减伤非重锤
export class SwordShield extends Weapon {
  constructor() {
    super({ ...WEAPON_STATS.SWORD_SHIELD, type: AttackType.MELEE });
    this.weaponClass = 'SHIELD';
    this.armorPierce = false;
    this.shieldBlock = true;
    this.arc = Math.PI * 0.5;
    this.comboDamage = [20, 18, 34];
    this.comboKnock = [1.0, 0.9, 2.2];
    this.comboLunge = [2.2, 1.8, 2.8];
    this.comboLaunch = [{ y: 0, rot: 0.2 }, { y: 2, rot: 0 }, { y: -1.5, rot: 0 }];
    this.hitFrame = 0.36;
    this.hitColor = 0xffaa44;
    this.hitEffect = 'normal';
  }
  createMesh() {
    const g = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfe7ee, metalness: 0.85, roughness: 0.25, emissive: 0x1a2030, emissiveIntensity: 0.12 });
    const fullerMat = new THREE.MeshStandardMaterial({ color: 0xa0a8b0, metalness: 0.7, roughness: 0.3 });
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x2a4a8a, metalness: 0.6, roughness: 0.4, emissive: 0x081830, emissiveIntensity: 0.1 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xd4b25a, metalness: 0.8, roughness: 0.35 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c0, metalness: 0.9, roughness: 0.2 });

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 1.3), bladeMat);
    blade.position.set(0.15, 0, 0.65); blade.castShadow = true;
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 1.0), fullerMat);
    fuller.position.set(0.15, 0, 0.65);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), bladeMat);
    tip.rotation.x = Math.PI / 2; tip.position.set(0.15, 0, 1.38);
    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.06), steelMat);
    crossguard.position.set(0.15, 0, 0.08);

    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 10), shieldMat);
    shield.rotation.x = Math.PI / 2; shield.position.set(-0.28, 0, 0.2); shield.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 6, 12), trimMat);
    rim.position.set(-0.28, 0, 0.23);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.03), trimMat);
    crossV.position.set(-0.28, 0, 0.24);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.03), trimMat);
    crossH.position.set(-0.28, 0, 0.24);
    const boss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), trimMat);
    boss.position.set(-0.28, 0, 0.28);
    const shieldSpike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 6), steelMat);
    shieldSpike.rotation.x = Math.PI / 2; shieldSpike.position.set(-0.28, 0, 0.36);

    g.add(blade, fuller, tip, crossguard, shield, rim, crossV, crossH, boss, shieldSpike);
    return g;
  }
}
