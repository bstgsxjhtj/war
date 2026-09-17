import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 资产加载，失败时用占位几何兜底，保证不阻塞主流程
export class AssetLoader {
  constructor() {
    this.gltf = new GLTFLoader();
    this.tex = new THREE.TextureLoader();
    this._cache = new Map();
  }

  async loadGLTF(url, fallbackName = 'model') {
    if (this._cache.has(url)) return this._cache.get(url).clone(true);
    try {
      const gltf = await this.gltf.loadAsync(url);
      this._cache.set(url, gltf.scene);
      return gltf.scene.clone(true);
    } catch (e) {
      console.warn(`[AssetLoader] glTF 加载失败，使用占位: ${fallbackName}`, e);
      return this._placeholder(fallbackName);
    }
  }

  async loadTexture(url) {
    try {
      return await this.tex.loadAsync(url);
    } catch (e) {
      console.warn(`[AssetLoader] 贴图加载失败，使用程序贴图: ${url}`, e);
      return this._proceduralTexture();
    }
  }

  _placeholder(name) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x88aabb, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.0, 4, 12), mat);
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);
    g.name = name;
    return g;
  }

  _proceduralTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8a7a5c';
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(${60 + Math.random() * 40},${50 + Math.random() * 30},${30 + Math.random() * 20},${Math.random() * 0.3})`;
      ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
}
