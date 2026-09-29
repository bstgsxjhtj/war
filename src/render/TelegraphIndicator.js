import * as THREE from 'three';

export class TelegraphIndicator {
  constructor(parent) {
    const geo = new THREE.RingGeometry(0.7, 1.1, 28);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3322, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.06;
    this.mesh.visible = false;
    this.mesh.scale.set(0.7, 0.7, 0.7);
    this._mat = mat;
    this._t = 0;
    this._dur = 0.45;
    this._active = false;
    if (parent) parent.add(this.mesh);
  }

  show(duration = 0.45, type = 'blockable') {
    this._active = true;
    this._dur = Math.max(0.05, duration);
    this._t = 0;
    this._mat.color.setHex(type === 'unblockable' ? 0xff3322 : type === 'aoe' ? 0xeef2ff : 0xffcc44);
    this.mesh.visible = true;
    this.mesh.scale.set(0.7, 0.7, 0.7);
  }

  hide() {
    this._active = false;
    this._mat.opacity = 0;
    this.mesh.visible = false;
  }

  update(dt) {
    if (!this._active) return;
    this._t += dt;
    const p = Math.min(1, this._t / this._dur);
    const s = 0.7 + p * 0.5;
    this.mesh.scale.set(s, s, s);
    this._mat.opacity = 0.25 + 0.45 * Math.abs(Math.sin(this._t * 16));
  }

  get active() { return this._active; }

  dispose() {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    this._mat.dispose();
  }
}
