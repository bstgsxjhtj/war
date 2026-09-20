import * as THREE from 'three';
import { Terrain } from './Terrain.js';

function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function smooth(t) { return t * t * (3 - 2 * t); }
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const v00 = hash(xi, yi), v10 = hash(xi + 1, yi), v01 = hash(xi, yi + 1), v11 = hash(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(v00, v10, u), THREE.MathUtils.lerp(v01, v11, u), v);
}
function fbm(x, y) { let a = 0, amp = 1, freq = 1, sum = 0; for (let i = 0; i < 4; i++) { a += vn(x * freq, y * freq) * amp; sum += amp; amp *= 0.5; freq *= 2; } return a / sum; }

export class MapGenerator {
  static MAPS = {
    bridge: {
      name: '渡桥', size: [360, 200],
      heightFn: (x, z, t) => {
        if (z > -15 && z < 15) {
          if (x > -5 && x < 5) return 0.3;
          return -1.5 + Math.sin(x * 0.1) * 0.3;
        }
        return fbm(x * 0.06, z * 0.06) * 2 + 0.5;
      },
      waterFn: (x, z) => z > -15 && z < 15 && !(x > -5 && x < 5),
      river: { zMin: -15, zMax: 15, depth: 1.8, flowDir: new THREE.Vector3(1, 0, 0), flowSpeed: 1.5 },
      bridge_: { xMin: -5, xMax: 5 },
      layout: {
        trees: 40, rocks: 15, tents: 4, flags: [{ x: -160, z: 0, c: 0x2f5fa8 }, { x: 160, z: 0, c: 0xa83030 }],
        supply: [{ x: 0, z: 20 }], campfires: [{ x: -140, z: 30 }, { x: 140, z: -30 }],
        bridgeStones: 3, mode: '死斗',
      },
      spawns: { blue: [{ x: -160, z: 40 }, { x: -160, z: -40 }], red: [{ x: 160, z: 40 }, { x: 160, z: -40 }] },
    },
    pass: {
      name: '山口', size: [280, 160],
      heightFn: (x, z, t) => {
        if (x < -40) return 12 + fbm(x * 0.3, z * 0.3) * 4;
        if (x > 40) return 12 + fbm(x * 0.3, z * 0.3) * 4;
        if (x < -30) { const k = (x + 40) / 10; return (12 + fbm(x * 0.3, z * 0.3) * 4) * (1 - k) + fbm(x, z) * 2 * k; }
        if (x > 30) { const k = (40 - x) / 10; return (12 + fbm(x * 0.3, z * 0.3) * 4) * (1 - k) + fbm(x, z) * 2 * k; }
        return fbm(x, z) * 2;
      },
      waterFn: () => false,
      river: { zMin: 999, zMax: 999, depth: 0, flowDir: new THREE.Vector3(0, 0, 0), flowSpeed: 0 },
      bridge_: { xMin: 999, xMax: 999 },
      layout: {
        trees: 20, rocks: 30, tents: 3, flags: [{ x: -120, z: 0, c: 0x2f5fa8 }, { x: 120, z: 0, c: 0xa83030 }],
        supply: [{ x: 0, z: 0 }], campfires: [{ x: -100, z: 10 }, { x: 100, z: -10 }],
        towers: 2, mode: '死斗',
      },
      spawns: { blue: [{ x: -120, z: 0 }], red: [{ x: 120, z: 0 }] },
    },
    fortress: {
      name: '攻城', size: [320, 220],
      heightFn: (x, z, t) => {
        const r = Math.hypot(x, z);
        if (r > 35 && r < 38) return 8;
        if (r < 35) return 0.5;
        return fbm(x * 0.06, z * 0.06) * 1.5;
      },
      waterFn: () => false,
      river: { zMin: 999, zMax: 999, depth: 0, flowDir: new THREE.Vector3(0, 0, 0), flowSpeed: 0 },
      bridge_: { xMin: 999, xMax: 999 },
      layout: {
        trees: 30, rocks: 10, tents: 6, flags: [{ x: 0, z: 0, c: 0xa83030 }, { x: -140, z: 0, c: 0x2f5fa8 }],
        supply: [{ x: -140, z: 5 }], campfires: [{ x: -120, z: 0 }],
        walls: true, gate: { x: 0, z: 37, hp: 500 }, buildings: 3, mode: '攻城',
      },
      spawns: { blue: [{ x: -140, z: 0 }], red: [{ x: 0, z: 0 }] },
    },
    field: {
      name: '遭遇', size: [400, 240],
      heightFn: (x, z, t) => fbm(x * 0.5, z * 0.5) * 3,
      waterFn: () => false,
      river: { zMin: 999, zMax: 999, depth: 0, flowDir: new THREE.Vector3(0, 0, 0), flowSpeed: 0 },
      bridge_: { xMin: 999, xMax: 999 },
      layout: {
        trees: 50, rocks: 30, tents: 0, flags: [{ x: -180, z: 0, c: 0x2f5fa8 }, { x: 180, z: 0, c: 0xa83030 }],
        supply: [{ x: -60, z: 0 }, { x: 60, z: 0 }, { x: 0, z: 80 }], campfires: [{ x: -100, z: 20 }, { x: 100, z: -20 }],
        mode: '死斗',
      },
      spawns: { blue: [{ x: -180, z: 0 }], red: [{ x: 180, z: 0 }] },
    },
    forest: {
      name: '密林', size: [320, 200],
      heightFn: (x, z) => fbm(x * 0.05, z * 0.05) * 1.5 + 0.3,
      waterFn: () => false,
      river: { zMin: 999, zMax: 999, depth: 0, flowDir: new THREE.Vector3(0,0,0), flowSpeed: 0 },
      bridge_: { xMin: 999, xMax: 999 },
      layout: {
        trees: 60, rocks: 20, tents: 3, flags: [{ x: -160, z: 0, c: 0x2f5fa8 }, { x: 160, z: 0, c: 0xa83030 }],
        supply: [{ x: 0, z: 0 }], campfires: [{ x: -140, z: 20 }, { x: 140, z: -20 }], mode: '死斗',
      },
      spawns: { blue: [{ x: -160, z: 0 }], red: [{ x: 160, z: 0 }] },
    },
    river: {
      name: '河谷', size: [360, 200],
      heightFn: (x, z) => {
        if (z > -12 && z < 12) { if (x > -4 && x < 4) return 0.3; return -1 + Math.sin(x * 0.08) * 0.3; }
        return fbm(x * 0.06, z * 0.06) * 2 + 0.5;
      },
      waterFn: (x, z) => z > -12 && z < 12 && !(x > -4 && x < 4),
      river: { zMin: -12, zMax: 12, depth: 1.5, flowDir: new THREE.Vector3(1,0,0), flowSpeed: 1.2 },
      bridge_: { xMin: -4, xMax: 4 },
      layout: {
        trees: 30, rocks: 15, tents: 2, flags: [{ x: -160, z: 0, c: 0x2f5fa8 }, { x: 160, z: 0, c: 0xa83030 }],
        supply: [{ x: 0, z: 20 }], campfires: [{ x: -140, z: 30 }, { x: 140, z: -30 }], bridgeStones: 2, mode: '死斗',
      },
      spawns: { blue: [{ x: -160, z: 40 }, { x: -160, z: -40 }], red: [{ x: 160, z: 40 }, { x: 160, z: -40 }] },
    },
    snowfield: {
      name: '雪原', size: [340, 220],
      heightFn: (x, z) => fbm(x * 0.04, z * 0.04) * 0.8 + 0.2,
      waterFn: () => false,
      river: { zMin: 999, zMax: 999, depth: 0, flowDir: new THREE.Vector3(0,0,0), flowSpeed: 0 },
      bridge_: { xMin: 999, xMax: 999 },
      layout: {
        trees: 10, rocks: 25, tents: 2, flags: [{ x: -160, z: 0, c: 0x2f5fa8 }, { x: 160, z: 0, c: 0xa83030 }],
        supply: [{ x: 0, z: 0 }], campfires: [{ x: -140, z: 20 }, { x: 140, z: -20 }], mode: '死斗',
      },
      spawns: { blue: [{ x: -160, z: 0 }], red: [{ x: 160, z: 0 }] },
    },
    keep: {
      name: '要塞', size: [300, 200],
      heightFn: (x, z) => {
        if (x < -50 || x > 50) return 8 + fbm(x * 0.1, z * 0.1) * 2;
        return fbm(x * 0.05, z * 0.05) * 1.5 + 0.3;
      },
      waterFn: () => false,
      river: { zMin: 999, zMax: 999, depth: 0, flowDir: new THREE.Vector3(0,0,0), flowSpeed: 0 },
      bridge_: { xMin: 999, xMax: 999 },
      layout: {
        trees: 15, rocks: 30, tents: 2, flags: [{ x: -140, z: 0, c: 0x2f5fa8 }, { x: 140, z: 0, c: 0xa83030 }],
        supply: [{ x: 0, z: 0 }], campfires: [{ x: -120, z: 20 }, { x: 120, z: -20 }], towers: 4, mode: '死斗',
      },
      spawns: { blue: [{ x: -140, z: 0 }], red: [{ x: 140, z: 0 }] },
    },
  };

  static generate(mapKey) {
    const def = this.MAPS[mapKey] || this.MAPS.field;
    const terrain = new Terrain(def.size[0], def.size[1], {
      heightFn: def.heightFn,
      river: def.river,
      bridge: def.bridge_,
      plateaus: [],
    });
    terrain._extWater = def.waterFn;
    return { terrain, layout: def.layout, name: def.name, spawns: def.spawns, size: def.size };
  }

  static recommendMap(modeName) {
    const order = { '攻城': 'fortress', '死斗': 'field', '据点': 'bridge', '波次': 'field', '训练场': 'field' };
    return order[modeName] || 'field';
  }

  static cycleMap(currentKey) {
    const keys = Object.keys(this.MAPS);
    const idx = keys.indexOf(currentKey);
    return keys[(idx + 1) % keys.length];
  }
}
