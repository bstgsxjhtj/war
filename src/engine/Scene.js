import * as THREE from 'three';
import { deepDispose } from '../render/disposeUtils.js';
import { PALETTE } from '../core/constants/palette.js';

// 黄昏氛围：FogExp2 指数雾（density 属性可被 WeatherSystem 动态调节），太阳 fog:false，远山3层色阶向雾色靠拢
// 颜色统一取自 PALETTE.SCENE（中央色板唯一事实来源）；hemi 需暴露给 WeatherSystem 调节环境光
export class Scene {
  constructor() {
    this.scene = new THREE.Scene();
    const fogColor = PALETTE.SCENE.FOG;
    this.scene.background = new THREE.Color(PALETTE.SCENE.BG);
    this.scene.fog = new THREE.FogExp2(fogColor, PALETTE.SCENE.FOG_DENSITY);

    const hemi = new THREE.HemisphereLight(PALETTE.SCENE.HEMI_SKY, PALETTE.SCENE.HEMI_GROUND, 0.65);
    this.scene.add(hemi);
    // C2-15：暴露半球光供 WeatherSystem 按天气调节强度/色温（此前未暴露 → 天气环境光分支全为死代码）
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(PALETTE.SCENE.SUN, 1.4);
    sun.position.set(70, 90, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 320;
    sun.shadow.camera.left = -130;
    sun.shadow.camera.right = 130;
    sun.shadow.camera.top = 130;
    sun.shadow.camera.bottom = -130;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.sun = sun;

    // 远山 3 层（色阶向雾色靠拢，均在 fog 内）
    this._mountains = new THREE.Group();
    const layers = [
      { r: 100, col: PALETTE.SCENE.MOUNTAIN_FAR, h: [18, 30] },
      { r: 140, col: PALETTE.SCENE.MOUNTAIN_MID, h: [20, 36] },
      { r: 180, col: PALETTE.SCENE.MOUNTAIN_NEAR, h: [22, 40] }
    ];
    for (const L of layers) {
      const mat = new THREE.MeshStandardMaterial({ color: L.col, roughness: 1 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + L.r * 0.01;
        const h = L.h[0] + Math.random() * (L.h[1] - L.h[0]);
        const mGeo = new THREE.ConeGeometry(16 + Math.random() * 14, h, 8);
        const mp = mGeo.attributes.position;
        for (let v = 0; v < mp.count; v++) { mp.setX(v, mp.getX(v) + (Math.random() - 0.5) * 2); mp.setZ(v, mp.getZ(v) + (Math.random() - 0.5) * 2); }
        mp.needsUpdate = true; mGeo.computeVertexNormals();
        const cone = new THREE.Mesh(mGeo, mat);
        cone.position.set(Math.cos(a) * L.r, h / 2 - 4, Math.sin(a) * L.r);
        cone.rotation.y = Math.random() * Math.PI;
        cone.castShadow = false;
        this._mountains.add(cone);
      }
    }
    this.scene.add(this._mountains);

    // 天穹渐变 + 地平线暖光带
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(PALETTE.SCENE.SKY_TOP) }, bottom: { value: new THREE.Color(PALETTE.SCENE.SKY_BOTTOM) } },
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){
        float h=normalize(vP).y;
        vec3 base=mix(bottom,top,smoothstep(-0.05,0.6,h));
        float horizon=exp(-abs(h)*8.0);
        gl_FragColor=vec4(mix(base,vec3(0.98,0.78,0.55),horizon*0.4),1.0);
      }`
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(400, 16, 12), skyMat));

    // 太阳球（禁用雾，距离 380 在天穹内）
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 12, 8),
      new THREE.MeshBasicMaterial({ color: PALETTE.SCENE.SUN_BALL, fog: false })
    );
    sunMesh.position.set(70, 90, 40).normalize().multiplyScalar(380);
    this.scene.add(sunMesh);

    // 体积云层（噪声 ShaderMaterial）
    const cloudMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform float uTime; varying vec2 vUv; float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);} float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);} void main(){ vec2 uv=vUv*6.; float n=noise(uv+uTime*0.02)+0.5*noise(uv*2.+uTime*0.03); float c=smoothstep(0.4,0.85,n); gl_FragColor=vec4(1.0,0.96,0.9,c*0.55);} `
    });
    this._cloud = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 1, 1), cloudMat);
    this._cloud.position.y = 130; this._cloud.rotation.x = -0.15;
    this.scene.add(this._cloud);
  }
  updateCloud(now) { if (this._cloud) this._cloud.material.uniforms.uTime.value = now; }

  add(obj) { this.scene.add(obj); }
  remove(obj) { this.scene.remove(obj); }
  dispose() { deepDispose(this.scene); }
}
