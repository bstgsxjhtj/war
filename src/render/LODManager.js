import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const PROXY_MAX = 80;
const QUALITY_SCALE = { high: 1.0, mid: 0.8, low: 0.5 };
const PROXY_GRAY = 0x888888;
const PROXY_GOLD = 0xffd070;
const ELITE_SCALE = 1.3;
// 代理胶囊半高：CapsuleGeometry(0.5, 1.2) 总高 = 1.2 + 2*0.5 = 2.2 → 半高 1.1（C3-23：脚底对齐用）
const PROXY_HALF = 1.1;
const DECORATIVE = ['cape', 'emblem', 'factionFlag', 'rKneeguard', 'lKneeguard'];
const MID_EXTRA = ['rPauldron', 'lPauldron', 'visor', 'belt', 'chestplate'];
const TICK_INTERVAL = 0.25;

export class LODManager {
  constructor({ camera, scene, thresholds = { mid: 25, far: 55, hidden: 110 } } = {}) {
    this._camera = camera;
    this._scene = scene;
    this._baseThresholds = { mid: 25, far: 55, hidden: 110, ...thresholds };
    this._thresholds = { ...this._baseThresholds };
    this._chars = [];
    this._enabled = true;
    this._proxyGeo = new THREE.CapsuleGeometry(0.5, 1.2, 2, 4);
    this._proxyMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this._proxyMesh = new THREE.InstancedMesh(this._proxyGeo, this._proxyMat, PROXY_MAX);
    this._proxyMesh.count = 0;
    this._proxyMesh.castShadow = false;
    this._proxyMesh.frustumCulled = false;
    this._proxyGray = new THREE.Color(PROXY_GRAY);
    this._proxyGold = new THREE.Color(PROXY_GOLD);
    this._tmpMatrix = new THREE.Matrix4();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpScale = new THREE.Vector3(1, 1, 1);
    this._tmpPos = new THREE.Vector3();
    this._tickInterval = TICK_INTERVAL;
    this._accumDt = 0;
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

  _isThreat(char) {
    if (char._attacking) return true;
    if (char._windupTimer && char._windupTimer > 0) return true;
    if (char._chargeState === 'windup' || char._chargeState === 'charge') return true;
    return false;
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
    // 降频：内部累积 dt，未达间隔时直接返回；无参调用（旧行为）立即执行
    if (dt !== undefined) {
      this._accumDt += dt;
      if (this._accumDt < this._tickInterval) return;
      this._accumDt -= this._tickInterval;
    }
    let proxyIdx = 0;
    // 倒序遍历：死亡/失效角色直接注销，防止 _chars 无限持有已销毁对象阻止 GC
    for (let i = this._chars.length - 1; i >= 0; i--) {
      const char = this._chars[i];
      if (!char.alive || !char.root || !char.position) { this._chars.splice(i, 1); continue; }
      const d = this._distance(char);
      const level = this._levelForDistance(d);
      const effective = this._isThreat(char) ? Math.min(level, 1) : level;
      if (effective !== char._lodLevel) this._applyLevel(char, effective);
      if (effective === 2 && proxyIdx < PROXY_MAX) {
        const s = char._isElite ? ELITE_SCALE : 1;
        this._tmpPos.copy(char.position);
        // C3-23：char.position 位于脚底，而胶囊几何以自身中心为原点——不补竖直偏移会有一半埋入地下、
        // 可见高度仅为实际一半。偏移半高（capsule 高 2.2 → 半高 1.1）随精英缩放同步。
        this._tmpPos.y += PROXY_HALF * s;
        this._tmpQuat.setFromAxisAngle(UP, 0);
        this._tmpScale.set(s, s, s);
        this._tmpMatrix.compose(this._tmpPos, this._tmpQuat, this._tmpScale);
        this._proxyMesh.setMatrixAt(proxyIdx, this._tmpMatrix);
        this._proxyMesh.setColorAt(proxyIdx, char._isElite ? this._proxyGold : this._proxyGray);
        proxyIdx++;
      }
    }
    this._proxyMesh.count = proxyIdx;
    if (this._proxyMesh.instanceMatrix) this._proxyMesh.instanceMatrix.needsUpdate = true;
    if (this._proxyMesh.instanceColor) this._proxyMesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.clear();
    this._proxyGeo.dispose();
    this._proxyMat.dispose();
    this._chars = [];
  }
}
