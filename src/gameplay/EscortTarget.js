import * as THREE from 'three';
import { Health } from './Health.js';

export class EscortTarget {
  constructor(startPos, goalPos, maxHp = 80) {
    this.root = new THREE.Group();
    this.root.position.set(startPos.x || 0, 0, startPos.z || 0);
    this.pos = this.root.position;
    this.goal = new THREE.Vector3(goalPos.x || 0, 0, goalPos.z || 0);
    this.health = new Health(maxHp);
    this.alive = true;
    this.position = this.root.position;
    this.team = 0;
    this.forward = new THREE.Vector3(0, 0, 1);
    this._curVel = new THREE.Vector3();
    this.vy = 0;
    this.weapon = null;
    this._build();
  }
  _build() {
    const geo = new THREE.BoxGeometry(1.2, 2, 1.2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4fa84f });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = 1;
    this.root.add(this.mesh);
  }
  update(dt, player) {
    if (!this.alive || !player) return;
    const d = this.pos.distanceTo(player.root.position);
    if (d < 8) {
      const dir = new THREE.Vector3().subVectors(player.root.position, this.pos).normalize();
      this.pos.add(dir.multiplyScalar(5 * dt));
    }
  }
  takeDamage(amount) {
    if (!this.alive) return 0;
    const lost = this.health.damage(amount);
    if (this.health.hp <= 0) { this.alive = false; this.root.visible = false; }
    return lost;
  }
}
