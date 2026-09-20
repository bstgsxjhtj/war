import * as THREE from 'three';

export class DefensePoint {
  constructor(position, radius = 8) {
    this.root = new THREE.Group();
    this.root.position.set(position.x || 0, 0, position.z || 0);
    this.pos = this.root.position;
    this.radius = radius;
    this.alive = true;
    this._build();
  }
  _build() {
    const geo = new THREE.CylinderGeometry(this.radius, this.radius, 0.2, 24);
    const mat = new THREE.MeshBasicMaterial({ color: 0x2a5a8a, transparent: true, opacity: 0.3 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = 0.1;
    this.root.add(this.mesh);
  }
  update() {}
  takeDamage() { return 0; }
}
