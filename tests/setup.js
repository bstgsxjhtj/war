function makeStorage() {
  let s = {};
  return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
    clear: () => { s = {}; }
  };
}

// P2-10: Three.js 轻量 mock 工具——用于不需要真实 WebGL 的纯逻辑单测。
// 用法：在测试文件顶部 `vi.mock('three', () => createThreeMock())` 即可注入。
export function createThreeMock() {
  function makeVec(x = 0, y = 0, z = 0) {
    const v = { x, y, z, _isMock: true };
    v.set = (a, b, c) => { v.x = a; v.y = b; v.z = c; return v; };
    v.copy = (o) => { v.x = o.x; v.y = o.y; v.z = o.z; return v; };
    v.clone = () => makeVec(v.x, v.y, v.z);
    v.add = (o) => { v.x += o.x; v.y += o.y; v.z += o.z; return v; };
    v.sub = (o) => { v.x -= o.x; v.y -= o.y; v.z -= o.z; return v; };
    v.addScaledVector = (o, s) => { v.x += o.x * s; v.y += o.y * s; v.z += o.z * s; return v; };
    v.multiplyScalar = (s) => { v.x *= s; v.y *= s; v.z *= s; return v; };
    v.setY = (y) => { v.y = y; return v; };
    v.normalize = () => {
      const len = Math.hypot(v.x, v.y, v.z) || 1;
      v.x /= len; v.y /= len; v.z /= len; return v;
    };
    v.length = () => Math.hypot(v.x, v.y, v.z);
    v.distanceTo = (o) => Math.hypot(v.x - o.x, v.y - o.y, v.z - o.z);
    v.dot = (o) => v.x * o.x + v.y * o.y + v.z * o.z;
    v.applyMatrix4 = () => v;
    return v;
  }
  const Ctor = function () {};
  Ctor.prototype = Object.assign(Ctor.prototype, {
    position: makeVec(),
    rotation: { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } },
    scale: { setScalar() {}, set() {} },
    add() { return this; },
    remove() { return this; },
    traverse() {},
    updateMatrixWorld() {},
    updateWorldMatrix() {},
    lookAt() {},
  });
  const Mock = {
    Vector3: (...a) => makeVec(...a),
    Vector2: (...a) => makeVec(...a),
    Color: function (h) { this.r = 1; this.g = 1; this.b = 1; this.setHex = () => this; },
    Object3D: Ctor,
    Mesh: Ctor,
    Group: Ctor,
    Scene: Ctor,
    Camera: Ctor,
    BufferGeometry: function () { this.setAttribute = () => this; this.setDrawRange = () => this; this.dispose = () => {}; },
    BufferAttribute: function () {},
    Float32Array,
    MeshStandardMaterial: function () { this.dispose = () => {}; },
    PointsMaterial: function () { this.dispose = () => {}; },
    LineBasicMaterial: function () { this.dispose = () => {}; },
    ShaderMaterial: function () { this.uniforms = {}; this.dispose = () => {}; },
    Points: Ctor,
    LineSegments: Ctor,
    InstancedMesh: Ctor,
    ConeGeometry: Ctor, CylinderGeometry: Ctor, BoxGeometry: Ctor, PlaneGeometry: Ctor,
    SphereGeometry: Ctor, IcosahedronGeometry: Ctor, DodecahedronGeometry: Ctor, CircleGeometry: Ctor,
    PerspectiveCamera: Ctor,
    MathUtils: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
    DoubleSide: 2, AdditiveBlending: 2, PCFSoftShadowMap: 2, ACESFilmicToneMapping: 2,
  };
  return Mock;
}

beforeEach(() => {
  globalThis.localStorage = makeStorage();
});