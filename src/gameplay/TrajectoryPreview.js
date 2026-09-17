import * as THREE from 'three';

// 弓弹道预览：抛物线虚线 + 落点圆环
export class TrajectoryPreview {
  constructor(scene) {
    this.scene = scene;
    this._pts = new Float32Array(60 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this._pts, 3));
    const mat = new THREE.LineDashedMaterial({ color: 0xffe070, dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.7, depthTest: false });
    this.line = new THREE.Line(geo, mat);
    this.line.renderOrder = 500;
    this.line.visible = false;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.8, 16),
      new THREE.MeshBasicMaterial({ color: 0xff5533, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthTest: false })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.line, this.ring);
  }

  show(origin, forward, speed, gravity = 9.5) {
    const vel = forward.clone().multiplyScalar(speed); vel.y += 1.8;
    let pos = origin.clone();
    let landed = false;
    for (let i = 0; i < 60; i++) {
      this._pts[i * 3] = pos.x; this._pts[i * 3 + 1] = pos.y; this._pts[i * 3 + 2] = pos.z;
      vel.y -= gravity * 0.05;
      pos.addScaledVector(vel, 0.05);
      if (!landed && pos.y <= 0) { landed = true; this.ring.position.set(pos.x, 0.1, pos.z); this.ring.visible = true; }
    }
    this.line.geometry.attributes.position.needsUpdate = true;
    this.line.computeLineDistances();
    this.line.visible = true;
  }

  hide() { this.line.visible = false; this.ring.visible = false; }

  dispose() { this.scene.remove(this.line, this.ring); }
}
