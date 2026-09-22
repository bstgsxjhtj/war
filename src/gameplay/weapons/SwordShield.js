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
  }
  createMesh() {
    const g = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdfe7ee, metalness: 0.85, roughness: 0.25, emissive: 0x1a2030, emissiveIntensity: 0.12 });
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x2a4a8a, metalness: 0.6, roughness: 0.4, emissive: 0x081830, emissiveIntensity: 0.1 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xd4b25a, metalness: 0.8, roughness: 0.35 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 1.3), bladeMat);
    blade.position.set(0.15, 0, 0.65); blade.castShadow = true;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), bladeMat);
    tip.rotation.x = Math.PI / 2; tip.position.set(0.15, 0, 1.38);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 8), shieldMat);
    shield.rotation.x = Math.PI / 2; shield.position.set(-0.28, 0, 0.2);
    const boss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), trimMat);
    boss.position.set(-0.28, 0, 0.28);
    g.add(blade, tip, shield, boss);
    return g;
  }
}
