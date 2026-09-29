import * as THREE from 'three';

const _canvasCache = new Map();
function _canvas(key, gen) {
  if (_canvasCache.has(key)) return _canvasCache.get(key);
  const c = gen();
  _canvasCache.set(key, c);
  return c;
}

// 程序化 PBR 纹理工厂：Canvas2D 生成漫反射/法线/粗糙度贴图（canvas 缓存复用，texture 实例独立以便安全 dispose）
export class TextureFactory {
  static noise(w = 256, h = 256, base = '#6a5a3a', amp = 30, repeat = 1) {
    const key = `noise|${w}|${h}|${base}|${amp}`;
    const c = _canvas(key, () => {
      const cc = document.createElement('canvas'); cc.width = w; cc.height = h;
      const x = cc.getContext('2d');
      const br = parseInt(base.slice(1, 3), 16), bg = parseInt(base.slice(3, 5), 16), bb = parseInt(base.slice(5, 7), 16);
      x.fillStyle = base; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        const r = Math.max(0, Math.min(255, br + (Math.random() - 0.5) * amp));
        const g = Math.max(0, Math.min(255, bg + (Math.random() - 0.5) * amp));
        const b = Math.max(0, Math.min(255, bb + (Math.random() - 0.5) * amp));
        x.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        x.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
      return cc;
    });
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) { t.repeat.set(repeat, repeat); }
    return t;
  }

  static normal(w = 256, h = 256, strength = 0.3) {
    const key = `normal|${w}|${h}|${strength}`;
    const c = _canvas(key, () => {
      const cc = document.createElement('canvas'); cc.width = w; cc.height = h;
      const x = cc.getContext('2d');
      const id = x.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const n = (Math.random() - 0.5) * strength;
        id.data[i * 4] = 128 + n * 255;
        id.data[i * 4 + 1] = 128;
        id.data[i * 4 + 2] = 255;
        id.data[i * 4 + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      return cc;
    });
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  static rough(w = 256, h = 256, base = 0.7, amp = 0.3) {
    const key = `rough|${w}|${h}|${base}|${amp}`;
    const c = _canvas(key, () => {
      const cc = document.createElement('canvas'); cc.width = w; cc.height = h;
      const x = cc.getContext('2d');
      const id = x.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const v = Math.max(0, Math.min(255, (base + (Math.random() - 0.5) * amp) * 255));
        id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      return cc;
    });
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  static brick(w = 256, h = 256) {
    const key = `brick|${w}|${h}`;
    const c = _canvas(key, () => {
      const cc = document.createElement('canvas'); cc.width = w; cc.height = h;
      const x = cc.getContext('2d');
      x.fillStyle = '#3a3530'; x.fillRect(0, 0, w, h);
      const bw = 64, bh = 32;
      for (let row = 0; row < h / bh; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let bx = -off; bx < w; bx += bw) {
          const sh = 0.7 + Math.random() * 0.3;
          x.fillStyle = `rgb(${(120 * sh) | 0},${(105 * sh) | 0},${(90 * sh) | 0})`;
          x.fillRect(bx + 2, row * bh + 2, bw - 4, bh - 4);
        }
      }
      return cc;
    });
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
}
