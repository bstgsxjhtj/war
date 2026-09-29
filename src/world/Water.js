import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { deepDispose } from '../render/disposeUtils.js';

// 水面：法线波动 + 折射色 + 透明，覆盖河流区域
export class Water {
  constructor(width = 220, depth = 20) {
    this.width = width;
    this.depth = depth;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth, 40, 8),
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uShallow: { value: new THREE.Color(0x6a9ab8) },
          uDeep: { value: new THREE.Color(0x2a4a6a) }
        },
        vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv=uv; vec3 p=position; p.z += sin(p.x*0.3+uTime*1.5)*0.15 + sin(p.y*0.5+uTime*2.0)*0.08; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);} `,
        fragmentShader: `uniform vec3 uShallow; uniform vec3 uDeep; varying vec2 vUv; void main(){ float t=clamp(vUv.y*2.0,0.0,1.0); vec3 c=mix(uDeep,uShallow,t); float n=sin(vUv.x*60.0)*sin(vUv.y*30.0)*0.06; gl_FragColor=vec4(c+n,0.72);} `
      })
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.2;
    const N = 80;
    const sgeo = new THREE.BufferGeometry();
    this._spos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this._spos[i * 3] = (Math.random() - 0.5) * width;
      this._spos[i * 3 + 1] = Math.random() * 0.5;
      this._spos[i * 3 + 2] = (Math.random() - 0.5) * depth;
    }
    sgeo.setAttribute('position', new THREE.BufferAttribute(this._spos, 3));
    this._splash = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xddeeff, size: 0.18, transparent: true, opacity: 0.7, depthWrite: false }));
    this.mesh.add(this._splash);
    this._splashGeo = sgeo;
  }
  async init() {
    try {
      this.reflector = new Reflector(new THREE.PlaneGeometry(this.width, this.depth), { clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: 0x4a4038 });
      this.reflector.rotation.x = -Math.PI / 2;
      this.reflector.position.y = 0.05;
      this.mesh.add(this.reflector);
    } catch (e) { console.warn('[Reflector] unavailable:', e.message); }
  }
  dispose() {
    if (this.reflector) {
      const rt = this.reflector.getRenderTarget && this.reflector.getRenderTarget();
      if (rt && typeof rt.dispose === 'function') rt.dispose();
    }
    deepDispose(this.mesh);
  }

  setQuality(q) {
    if (this.reflector) this.reflector.visible = q === 'high';
  }

  update(dt, now) {
    this.mesh.material.uniforms.uTime.value = now;
    if (this._splashGeo) {
      const pos = this._splashGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + 0.6 * dt;
        if (y > 0.6) { y = 0; pos.setX(i, (Math.random() - 0.5) * this.width); pos.setZ(i, (Math.random() - 0.5) * this.depth); }
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  }
}
