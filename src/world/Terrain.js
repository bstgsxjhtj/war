import * as THREE from 'three';
import { TextureFactory } from '../render/TextureFactory.js';

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const v00 = hash(xi, yi), v10 = hash(xi + 1, yi);
  const v01 = hash(xi, yi + 1), v11 = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(v00, v10, u), THREE.MathUtils.lerp(v01, v11, u), v);
}
function fbm(x, y) {
  let a = 0, amp = 1, freq = 1, sum = 0;
  for (let i = 0; i < 4; i++) { a += valueNoise(x * freq, y * freq) * amp; sum += amp; amp *= 0.5; freq *= 2; }
  return a / sum;
}

// 地形：多色+河流横切(z[-10,10]河床)+台地高低+水体判定
export class Terrain {
  constructor(size = 220, seg = 110, opts = {}) {
    this.size = size;
    this._extHeight = opts.heightFn || null;
    this._extWater = opts.waterFn || null;
    this._river = opts.river || { zMin: -10, zMax: 10, depth: 1.5, flowDir: new THREE.Vector3(1, 0, 0), flowSpeed: 1.5 };
    this._bridge = opts.bridge || { xMin: -4, xMax: 4 };
    this._plateaus = opts.plateaus || [
      { cx: -40, cz: -30, r: 14, h: 7 },
      { cx: 45, cz: 35, r: 12, h: 6 }
    ];
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const norm = geo.attributes.normal;
    const colors = [];
    const base = new THREE.Color(0x6b5a3e);
    const grass = new THREE.Color(0x4f6b3a);
    const dirt = new THREE.Color(0x7a6448);
    const stone = new THREE.Color(0x807a70);
    const sand = new THREE.Color(0xb8a878);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let h = this._rawHeight(x, z);
      pos.setY(i, h);
      const ny = norm.getY(i);
      const slope = THREE.MathUtils.clamp((1 - Math.abs(ny)) * 2, 0, 0.6);
      let c = base.clone().lerp(grass, THREE.MathUtils.clamp(h * 0.15 + 0.4, 0, 1));
      c.lerp(stone, slope);
      c.lerp(dirt, valueNoise(x * 0.3, z * 0.3) * 0.22);
      if (this.isWater(x, z)) c.lerp(sand, 0.6);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    // 纹理由上层注入（world 不依赖 render）；未注入时用纯色材质
    const tex = opts.textures || {};
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.map || null, normalMap: tex.normalMap || null, roughness: 0.95, flatShading: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this._geo = geo;
    this._scatterRocks();
  }

  _scatterRocks() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a6258, roughness: 1, flatShading: true });
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 16;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.isWater(x, z)) continue;
      const s = 0.12 + Math.random() * 0.3;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
      rock.position.set(x, this.heightAt(x, z) + s * 0.3, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true; rock.receiveShadow = true;
      this.mesh.add(rock);
    }
  }

  _rawHeight(x, z) {
    if (this._extHeight) return this._extHeight(x, z, this);
    const r = Math.sqrt(x * x + z * z);
    const flatness = THREE.MathUtils.clamp((r - 16) / 40, 0, 1);
    const microR = r < 16 ? (fbm(x * 0.4, z * 0.4) - 0.5) * 0.5 : 0;
    let h = (fbm(x * 0.06, z * 0.06) - 0.5) * 10 * flatness + microR;
    for (const p of this._plateaus) {
      const d = Math.hypot(x - p.cx, z - p.cz);
      if (d < p.r) h = Math.max(h, p.h * (1 - d / p.r) * 0.9 + p.h * 0.1);
    }
    if (this.isWater(x, z)) h = -this._river.depth;
    return h;
  }

  heightAt(x, z) { return this._rawHeight(x, z); }

  isWater(x, z) {
    if (this._extWater) return this._extWater(x, z);
    if (z < this._river.zMin || z > this._river.zMax) return false;
    if (x > this._bridge.xMin && x < this._bridge.xMax) return false;
    return true;
  }

  waterDepth(x, z) {
    if (!this.isWater(x, z)) return 0;
    return this._river.depth;
  }

  get flowDir() { return this._river.flowDir; }
  get flowSpeed() { return this._river.flowSpeed; }
}
