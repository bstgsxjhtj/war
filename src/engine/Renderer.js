import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { EnvMap } from '../render/EnvMap.js';

function viewport() {
  return [window.innerWidth || 1280, window.innerHeight || 720];
}

// 暗角(0.22)+暖调分级(0.15)，收窄暗角范围避免中心变暗
const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.22 }, grade: { value: 0.15 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette; uniform float grade; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float lum = dot(c.rgb, vec3(0.299,0.587,0.114));
      vec3 warm = vec3(1.08,1.0,0.88);
      c.rgb = mix(c.rgb, vec3(lum)*warm, grade);
      float d = distance(vUv, vec2(0.5,0.52));
      float v = smoothstep(0.92, 0.40, d);
      c.rgb *= mix(1.0-vignette, 1.0, v);
      gl_FragColor = c;
    }`
};

export class Renderer {
  constructor(canvas) {
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const [w, h] = viewport();
    this.webgl.setSize(w, h);
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.05;

    this.composer = new EffectComposer(this.webgl);
    this._bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.3, 1.05);
    this._vignette = new ShaderPass(VignetteShader);
    this.composer.addPass(new OutputPass());
    this._resizeHandler = () => this._onResize();
    window.addEventListener('resize', this._resizeHandler);
  }

  async setup(scene, camera) {
    this.composer.passes = [];
    this.composer.addPass(new RenderPass(scene, camera));
    try { scene.environment = EnvMap.create(); } catch (e) { console.warn('[EnvMap] fail:', e.message); }
    try {
      const [w, h] = viewport();
      const { SSAOPass } = await import(/* @vite-ignore */ '/node_modules/three/examples/jsm/postprocessing/SSAOPass.js');
      this._ssao = new SSAOPass(scene, camera, w, h);
      this._ssao.kernelRadius = 8;
      this._ssao.minDistance = 0.005;
      this._ssao.maxDistance = 0.1;
      this.composer.addPass(this._ssao);
    } catch (e) { console.warn('[SSAO] unavailable, fallback:', e.message); }
    this.composer.addPass(this._bloom);
    this.composer.addPass(this._vignette);
    this.composer.addPass(new OutputPass());
  }

  setQuality(q) {
    if (!this.webgl) return;
    if (q === 'low') { this.webgl.shadowMap.enabled = false; this.webgl.setPixelRatio(0.7); }
    else if (q === 'mid') { this.webgl.shadowMap.enabled = true; this.webgl.setPixelRatio(1); }
    else { this.webgl.shadowMap.enabled = true; this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2)); }
  }

  render() { this.composer.render(); }

  _onResize() {
    const [w, h] = viewport();
    this.webgl.setSize(w, h);
    this.composer.setSize(w, h);
    this._bloom.setSize(w, h);
  }

  dispose() { window.removeEventListener('resize', this._resizeHandler); }
}
