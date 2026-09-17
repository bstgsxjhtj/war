import * as THREE from 'three';

// 黄昏氛围：fog 60-220 覆盖远山，太阳 fog:false，远山3层色阶向雾色靠拢
export class Scene {
  constructor() {
    this.scene = new THREE.Scene();
    const fogColor = 0x9a8a78;
    this.scene.background = new THREE.Color(fogColor);
    this.scene.fog = new THREE.Fog(fogColor, 60, 220);

    const hemi = new THREE.HemisphereLight(0xffd9a8, 0x5a4a36, 0.65);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffc070, 1.4);
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

    const rim = new THREE.DirectionalLight(0x88a0c8, 0.28);
    rim.position.set(-50, 35, -30);
    this.scene.add(rim);

    // 远山 3 层（色阶向雾色靠拢，均在 fog 内）
    this._mountains = new THREE.Group();
    const layers = [
      { r: 100, col: 0x6a5848, h: [18, 30] },
      { r: 140, col: 0x807466, h: [20, 36] },
      { r: 180, col: 0x948878, h: [22, 40] }
    ];
    for (const L of layers) {
      const mat = new THREE.MeshStandardMaterial({ color: L.col, roughness: 1, flatShading: true });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + L.r * 0.01;
        const h = L.h[0] + Math.random() * (L.h[1] - L.h[0]);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(16 + Math.random() * 14, h, 5), mat);
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
      uniforms: { top: { value: new THREE.Color(0x5a6a8a) }, bottom: { value: new THREE.Color(0xd8a060) } },
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
      new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false })
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
}
