import * as THREE from 'three';
import { AIController } from './AIController.js';

export class Horse {
  constructor(scene) {
    this.scene = scene;
    this._pool = [];
  }

  create() {
    const g = new THREE.Group();
    const matBody = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.7, metalness: 0.1 });
    const matMane = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const matHoof = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.5), matBody);
    body.position.y = 1.8; body.castShadow = true;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.4), matBody);
    neck.position.set(0.9, 2.1, 0); neck.rotation.z = -0.3; neck.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3), matBody);
    head.position.set(1.2, 2.3, 0); head.castShadow = true;
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.1), matMane);
    mane.position.set(0.5, 2.15, 0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), matMane);
    tail.position.set(-0.9, 1.9, 0); tail.rotation.z = 0.5;

    const legs = [];
    for (const [x, z] of [[0.6, 0.2], [0.6, -0.2], [-0.6, 0.2], [-0.6, -0.2]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 1.4), matBody);
      leg.position.set(x, 0.7, z); leg.castShadow = true;
      legs.push(leg);
    }
    const saddles = [];
    for (const [x, z] of [[0.6, 0.2], [0.6, -0.2], [-0.6, 0.2], [-0.6, -0.2]]) {
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1), matHoof);
      hoof.position.set(x, 0.05, z);
      saddles.push(hoof);
    }

    g.add(body, neck, head, mane, tail, ...legs, ...saddles);
    this.scene.add(g);
    const horse = { group: g, body, legs, speed: 0, rider: null, update: (dt) => this._updateHorse(horse, dt) };
    this._pool.push(horse);
    return horse;
  }

  _updateHorse(horse, dt) {
    if (!horse.rider) return;
    const rider = horse.rider;
    const riderPos = rider.root.position;
    horse.group.position.set(riderPos.x, riderPos.y - 1.5, riderPos.z);
    horse.group.rotation.y = rider.root.rotation.y;
    const moveSpeed = Math.abs(rider._moveF || 0) + Math.abs(rider._moveR || 0);
    horse.speed = moveSpeed > 0.1 ? 1 : 0;
    if (horse.speed > 0) {
      const t = performance.now() * 0.008;
      horse.legs.forEach((leg, i) => {
        const phase = i * Math.PI / 2;
        leg.position.y = 0.7 + Math.sin(t + phase) * 0.15;
      });
    }
  }

  update(dt) { for (const h of this._pool) h.update(dt); }
  dispose() { for (const h of this._pool) this.scene.remove(h.group); this._pool = []; }
}

export class CavalryEnemy extends AIController {
  constructor({ team = 1 } = {}) {
    super({ team, isLocal: false, speed: 9, maxHp: 120 });
    this._isCavalry = true;
    this._horse = null;
    this._name = '骑兵';
  }

  mount(horse) { this._horse = horse; horse.rider = this; }
  unmount() { if (this._horse) { this._horse.rider = null; this._horse = null; } }

  update(dt, terrain, combat, enemies, now) {
    super.update(dt, terrain, combat, enemies, now);
    if (this._horse && this.root) {
      this.root.position.y = terrain.heightAt(this.root.position.x, this.root.position.z) + 1.5;
    }
  }
}
