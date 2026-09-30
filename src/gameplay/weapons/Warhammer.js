import * as THREE from 'three';
import { Weapon, AttackType } from '../Weapon.js';
import { WEAPON_STATS } from '../../core/constants/balance.js';

// 重锤：破盾高伤慢攻，无视格挡
export class Warhammer extends Weapon {
  constructor() {
    super({ ...WEAPON_STATS.WARHAMMER, type: AttackType.MELEE });
    this.weaponClass = 'HEAVY';
    this.armorPierce = true;
    this.arc = Math.PI * 0.4;
    this.comboDamage = [55, 45, 80];
    this.comboKnock = [3.0, 2.8, 5.0];
    this.comboLunge = [2.5, 2.0, 4.0];
    this.comboLaunch = [{ y: 0, rot: 0.4 }, { y: 4, rot: 0 }, { y: 8, rot: 0 }];
    this.hitFrame = 0.45;
    this.skillName = '震地';
    this.hitColor = 0xff8822;
    this.hitEffect = 'normal';
  }
  createMesh() {
    const g = new THREE.Group();
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.8 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x2a1808, roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x7a7a82, metalness: 0.85, roughness: 0.35, emissive: 0x101018, emissiveIntensity: 0.1 });
    const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x5a5a62, metalness: 0.9, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4b25a, metalness: 0.8, roughness: 0.35 });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), handleMat);
    handle.rotation.x = Math.PI / 2; handle.position.z = -0.3; handle.castShadow = true;

    for (let i = 0; i < 3; i++) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.015, 4, 8), leatherMat);
      wrap.position.z = -0.1 + i * 0.15; wrap.rotation.x = Math.PI / 2;
      g.add(wrap);
    }

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.4), metalMat);
    head.position.z = 0.5; head.castShadow = true;
    const backHead = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), darkMetalMat);
    backHead.position.z = 0.15;

    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 8), metalMat);
    spike.rotation.x = Math.PI / 2; spike.position.z = 0.95; spike.castShadow = true;
    const backSpike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), darkMetalMat);
    backSpike.rotation.x = -Math.PI / 2; backSpike.position.z = -0.02;

    const bandL = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 4, 8), goldMat);
    bandL.position.set(0, 0, 0.32); bandL.rotation.y = Math.PI / 2;
    const bandR = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 4, 8), goldMat);
    bandR.position.set(0, 0, 0.68); bandR.rotation.y = Math.PI / 2;

    const pommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), goldMat);
    pommel.position.z = -1.0;

    g.add(handle, head, backHead, spike, backSpike, bandL, bandR, pommel);
    return g;
  }
  skill(a, c, now) { c.spawnAoE(a.position, 5, 50, a, now); return true; }
}
