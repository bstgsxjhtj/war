import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const PROXY_MAX = 80;
const QUALITY_SCALE = { high: 1.0, mid: 0.8, low: 0.5 };
const DECORATIVE = ['cape', 'emblem', 'factionFlag', 'rKneeguard', 'lKneeguard'];
const MID_EXTRA = ['rPauldron', 'lPauldron', 'visor', 'belt', 'chestplate'];

export class LODManager {
  constructor({ camera, scene, thresholds = { mid: 25, far: 55, hidden: 110 } } = {}) {
    this._camera = camera;
    this._scene = scene;
    this._baseThresholds = { mid: 25, far: 55, hidden: 110, ...thresholds };
    this._thresholds = { ...this._baseThresholds };
    this._chars = [];
    this._enabled = true;
    this._proxyGeo = new THREE.CapsuleGeometry(0.5, 1.2, 2, 4);
    this._proxyMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    this._proxyMesh = new THREE.InstancedMesh(this._proxyGeo, this._proxyMat, PROXY_MAX);
    this._proxyMesh.count = 0;
    this._proxyMesh.castShadow = false;
    this._proxyMesh.frustumCulled = false;
    this._tmpMatrix = new THREE.Matrix4();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpScale = new THREE.Vector3(1, 1, 1);
    this._tmpPos = new THREE.Vector3();
    if (scene && scene.add) scene.add(this._proxyMesh);
  }

  get chars() { return this._chars; }
  get proxyCount() { return this._proxyMesh.count; }

  setEnabled(v) { this._enabled = !!v; }
  setCamera(cam) { this._camera = cam; }

  setQuality(q) {
    const scale = QUALITY_SCALE[q] ?? 1.0;
    this._thresholds = {
      mid: this._baseThresholds.mid * scale,
      far: this._baseThresholds.far * scale,
      hidden: this._baseThresholds.hidden * scale
    };
  }

  register(char) {
    if (!this._chars.includes(char)) {
      this._chars.push(char);
      char._lodLevel = 0;
    }
  }

  unregister(char) {
    const i = this._chars.indexOf(char);
    if (i >= 0) {
      this._restoreFull(char);
      this._chars.splice(i, 1);
    }
  }

  clear() {
    for (const c of this._chars) this._restoreFull(c);
    this._chars = [];
    this._proxyMesh.count = 0;
  }

  _restoreFull(char) {
    if (char.root) char.root.visible = true;
    for (const p of [...DECORATIVE, ...MID_EXTRA]) {
      if (char[p]) char[p].visible = true;
    }
    if (char.root) char.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }

  _distance(char) {
    if (!this._camera) return 0;
    const cp = this._camera.position || this._camera;
    return char.position ? char.position.distanceTo(cp) : 999;
  }

  _levelForDistance(d) {
    const t = this._thresholds;
    if (d > t.hidden) return 3;
    if (d > t.far) return 2;
    if (d > t.mid) return 1;
    return 0;
  }

  _applyLevel(char, level) {
    if (level === 0) {
      char.root.visible = true;
      for (const p of DECORATIVE) if (char[p]) char[p].visible = true;
      for (const p of MID_EXTRA) if (char[p]) char[p].visible = true;
      char.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    } else if (level === 1) {
      char.root.visible = true;
      for (const p of DECORATIVE) if (char[p]) char[p].visible = false;
      for (const p of MID_EXTRA) if (char[p]) char[p].visible = true;
      char.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    } else {
      char.root.visible = false;
      char.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
    }
    char._lodLevel = level;
  }

  tick(dt) {
    if (!this._enabled) return;
    let proxyIdx = 0;
    for (const char of this._chars) {
      if (!char.alive || !char.root || !char.position) continue;
      const d = this._distance(char);
      const level = this._levelForDistance(d);
      if (level !== char._lodLevel) this._applyLevel(char, level);
      if (level === 2 && proxyIdx < PROXY_MAX) {
        this._tmpPos.copy(char.position);
        this._tmpQuat.setFromAxisAngle(UP, 0);
        this._tmpMatrix.compose(this._tmpPos, this._tmpQuat, this._tmpScale);
        this._proxyMesh.setMatrixAt(proxyIdx, this._tmpMatrix);
        proxyIdx++;
      }
    }
    this._proxyMesh.count = proxyIdx;
    if (this._proxyMesh.instanceMatrix) this._proxyMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.clear();
    this._proxyGeo.dispose();
    this._proxyMat.dispose();
    this._chars = [];
  }
}
