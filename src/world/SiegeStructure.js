import * as THREE from 'three';
import { EV } from '../core/constants/events.js';
import { TextureFactory } from '../render/TextureFactory.js';

// 攻城结构：城门(可破坏) + 投石机(占领后轰击)
export class SiegeStructure {
  constructor(scene, bus) {
    this.scene = scene; this.bus = bus;
    this.gate = {
      hp: 500, maxHp: 500, position: new THREE.Vector3(0, 0, 40),
      mesh: null, broken: false
    };
    this.trebuchet = {
      position: new THREE.Vector3(-20, 0, -30), team: -1, cooldown: 8, timer: 0, occupied: false
    };
    this._buildGate();
    this._buildTrebuchet();
    this._buildWalls();
  }

  // 重置城门与投石机（每回合开局调用，保证新一局城门完好）
  reset() {
    this.gate.hp = this.gate.maxHp;
    this.gate.broken = false;
    if (this.gate.group) this.gate.group.visible = true;
    this.trebuchet.team = -1;
    this.trebuchet.occupied = false;
    this.trebuchet.timer = 0;
  }

  _buildGate() {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a8278, map: TextureFactory.brick(), roughness: 0.9 });
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x6a4220, roughness: 0.8, emissive: 0x1a0a00, emissiveIntensity: 0.1 });
    // 左右城墙
    const lw = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 2), wallMat); lw.position.set(-5, 3.5, 40); lw.castShadow = true; lw.receiveShadow = true;
    const rw = lw.clone(); rw.position.set(5, 3.5, 40);
    // 城门
    const gate = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 0.6), gateMat); gate.position.set(0, 2.5, 40); gate.castShadow = true;
    // 墙顶垛口
    for (let i = -2; i <= 2; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 2), wallMat); m.position.set(i * 2, 7.75, 40); g.add(m);
    }
    g.add(lw, rw, gate);
    this.gate.mesh = gate;
    this.gate.group = g;
    this.scene.add(g);
  }

  _buildTrebuchet() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), wood); base.position.y = 0.25; base.castShadow = true;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), wood); arm.position.set(0, 3, 0); arm.rotation.z = 0.3; arm.castShadow = true;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), wood); counter.position.set(-2.5, 3, 0);
    g.add(base, arm, counter);
    g.position.copy(this.trebuchet.position);
    this.trebuchet.group = g;
    this.scene.add(g);
  }

  _buildWalls() {
    // 简易城墙两侧延伸
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a8278, map: TextureFactory.brick(), roughness: 0.9 });
    for (const side of [-1, 1]) {
      for (let i = 1; i <= 3; i++) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 2), wallMat);
        w.position.set(side * (5 + i * 4), 3.5, 40); w.castShadow = true; w.receiveShadow = true;
        this.scene.add(w);
      }
    }
  }

  // 城门受击
  damageGate(amount, attacker) {
    if (this.gate.broken) return;
    this.gate.hp -= amount;
    if (this.gate.hp <= 0) {
      this.gate.broken = true;
      this.gate.group.visible = false;
      this.bus.emit(EV.COMBAT_KILL, { victim: this.gate, team: 1, killer: attacker });
    }
  }

  // 占领投石机
  tryOccupy(character) {
    if (!character || !character.alive) return false;
    const d = character.position.distanceTo(this.trebuchet.position);
    if (d < 3) {
      if (this.trebuchet.occupied && this.trebuchet.team === character.team) return false;
      this.trebuchet.team = character.team;
      this.trebuchet.occupied = true;
      return true;
    }
    return false;
  }

  get collisionBoxes() {
    const boxes = [];
    for (const cx of [-5, 5]) {
      boxes.push({ minX: cx - 2, maxX: cx + 2, minZ: 39, maxZ: 41 });
    }
    boxes.push({ minX: -2, maxX: 2, minZ: 39.7, maxZ: 40.3 });
    for (const side of [-1, 1]) {
      for (let i = 1; i <= 3; i++) {
        const cx = side * (5 + i * 4);
        boxes.push({ minX: cx - 2, maxX: cx + 2, minZ: 39, maxZ: 41 });
      }
    }
    return boxes;
  }

  update(dt, combat, enemies = null) {
    if (!this.trebuchet.occupied) return;
    this.trebuchet.timer -= dt;
    if (this.trebuchet.timer <= 0) {
      this.trebuchet.timer = this.trebuchet.cooldown;
      // 目标：优先最近存活敌方，否则轰击城门
      let target = this.gate.position.clone();
      if (enemies && enemies.length) {
        let nearest = null, minD = Infinity;
        for (const e of enemies) {
          if (!e.alive || e.team === this.trebuchet.team) continue;
          const d = e.position.distanceTo(this.trebuchet.position);
          if (d < minD) { minD = d; nearest = e; }
        }
        if (nearest) target = nearest.position.clone();
      }
      // 发射投石
      const origin = this.trebuchet.position.clone().add(new THREE.Vector3(0, 5, 0));
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      mesh.position.copy(origin); this.scene.add(mesh);
      const vel = target.clone().sub(origin).multiplyScalar(0.5); vel.y += 8;
      combat.arrows.push({ mesh, pos: origin.clone(), vel, team: this.trebuchet.team, damage: 80, life: 4, attacker: null, charge: 1, isSiege: true });
    }
  }

  // 投石命中城门
  onSiegeHit(pos) {
    const d = pos.distanceTo(this.gate.position);
    if (d < 4) this.damageGate(80, null);
  }
}
