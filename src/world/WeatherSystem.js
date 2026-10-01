import * as THREE from 'three';
import { PALETTE } from '../core/constants/palette.js';
// 天气系统：晴/雨/夜/雪/雷暴
export class WeatherSystem {
  constructor(scene, sun = null, hemi = null, audio = null) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.audio = audio;
    this._audio = null;
    this._mode = 'clear';
    this._modes = ['clear', 'rain', 'night', 'snow', 'storm'];
    this._rain = null;
    this._snow = null;
    this._lightning = null;
    this._lightningTimer = 0;
    this._flashPhase = 0;
    this._flashTimer = 0;
    this._quality = 'high';
    this._forecast = null;
    this._autoSchedule = false;
    this._onLightning = null;
    this._initRain();
    this._initSnow();
    this._initLightning();
  }

  _initRain() {
    const N = 2000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120;
      pos[i * 3 + 1] = Math.random() * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setDrawRange(0, N);
    this._rainGeo = geo;
    this._rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaaccee, size: 0.12, transparent: true, opacity: 0.6 }));
    this._rain.visible = false;
    this.scene.add(this._rain);
  }

  _initSnow() {
    const N = 1500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120;
      pos[i * 3 + 1] = Math.random() * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setDrawRange(0, N);
    this._snowGeo = geo;
    this._snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.8 }));
    this._snow.visible = false;
    this.scene.add(this._snow);
  }

  _initLightning() {
    this._lightning = new THREE.PointLight(0xb0d0ff, 0, 80);
    this._lightning.position.set(0, 30, 0);
    this.scene.add(this._lightning);
  }

  setAudio(a) { this._audio = a; }

  // 画质降级：按比例缩减雨/雪粒子的绘制数量（不重建几何体）
  setQuality(q) {
    this._quality = q;
    const f = q === 'low' ? 0.3 : q === 'mid' ? 0.65 : 1;
    if (this._rainGeo) this._rainGeo.setDrawRange(0, Math.max(1, Math.floor(2000 * f)));
    if (this._snowGeo) this._snowGeo.setDrawRange(0, Math.max(1, Math.floor(1500 * f)));
  }

  dispose() {
    for (const o of [this._rain, this._snow, this._lightning]) {
      if (!o) continue;
      this.scene.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    }
    this._rain = null; this._snow = null; this._lightning = null;
  }

  onLightning(cb) { this._onLightning = cb; }

  setMode(mode) {
    if (this._modes.indexOf(mode) >= 0) {
      this._mode = mode;
      this.apply();
      if (this._audio) this._audio.environment(mode);
    }
  }

  toggle() {
    this._mode = this._modes[(this._modes.indexOf(this._mode) + 1) % this._modes.length];
    this.apply();
  }

  get mode() { return this._mode; }

  get forecast() { return this._forecast; }

  scheduleNext(mode, delay) {
    if (this._modes.indexOf(mode) >= 0) this._forecast = { mode, timer: delay };
  }

  clearForecast() { this._forecast = null; }

  enableAutoSchedule(enabled) { this._autoSchedule = enabled; }

  _scheduleRandom() {
    const _wm = ['clear', 'rain', 'night', 'snow', 'storm'];
    const next = _wm[Math.floor(Math.random() * _wm.length)];
    this.scheduleNext(next, 30 + Math.random() * 30);
  }

  getCombatEffects() {
    switch (this._mode) {
      case 'rain':
        return { speedMul: 0.85, bowAccuracy: 0.7, staminaRegenMul: 0.9, visibility: 0.8 };
      case 'snow':
        return { speedMul: 0.75, bowAccuracy: 0.5, staminaRegenMul: 0.8, visibility: 0.6 };
      case 'storm':
        return { speedMul: 0.7, bowAccuracy: 0.4, staminaRegenMul: 0.7, visibility: 0.5 };
      case 'night':
        return { speedMul: 1.0, bowAccuracy: 0.6, staminaRegenMul: 1.0, visibility: 0.7 };
      default:
        return { speedMul: 1.0, bowAccuracy: 1.0, staminaRegenMul: 1.0, visibility: 1.0 };
    }
  }

  apply() {
    this._rain.visible = false;
    this._snow.visible = false;
    this._lightning.intensity = 0;
    // 天气切换时终止进行中的闪光序列，避免残留
    this._flashPhase = 0;
    this._flashTimer = 0;
    if (this._mode === 'rain') {
      this._rain.visible = true;
      if (this.scene.fog) this.scene.fog.density = 0.012;
      if (this.sun) { this.sun.intensity = 0.7; this.sun.color.setHex(0x8888aa); }
      if (this.hemi) this.hemi.intensity = 0.4;
    } else if (this._mode === 'night') {
      if (this.scene.fog) this.scene.fog.density = 0.006;
      if (this.sun) { this.sun.intensity = 0.25; this.sun.color.setHex(0x4a5a8a); }
      if (this.hemi) { this.hemi.intensity = 0.25; this.hemi.color.setHex(0x202038); }
    } else if (this._mode === 'snow') {
      this._snow.visible = true;
      if (this.scene.fog) this.scene.fog.density = 0.015;
      if (this.sun) { this.sun.intensity = 0.85; this.sun.color.setHex(0xc0d0e0); }
      if (this.hemi) { this.hemi.intensity = 0.55; this.hemi.color.setHex(0xa0b0c0); }
    } else if (this._mode === 'storm') {
      this._rain.visible = true;
      if (this.scene.fog) this.scene.fog.density = 0.018;
      if (this.sun) { this.sun.intensity = 0.5; this.sun.color.setHex(0x606080); }
      if (this.hemi) this.hemi.intensity = 0.3;
    } else {
      // C2-15：clear 复位到场景基准黄昏调（PALETTE.SCENE），否则一次天气循环后雾密度/日照/半球色永久漂移
      if (this.scene.fog) this.scene.fog.density = PALETTE.SCENE.FOG_DENSITY;
      if (this.sun) { this.sun.intensity = 1.4; this.sun.color.setHex(PALETTE.SCENE.SUN); }
      if (this.hemi) { this.hemi.intensity = 0.65; this.hemi.color.setHex(PALETTE.SCENE.HEMI_SKY); }
    }
  }

  update(dt) {
    if (this._forecast) {
      this._forecast.timer -= dt;
      if (this._forecast.timer <= 0) {
        const m = this._forecast.mode;
        this._forecast = null;
        this.setMode(m);
        if (this._autoSchedule) this._scheduleRandom();
      }
    }
    if (this._rain.visible) {
      const pos = this._rainGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - 30 * dt;
        if (y < 0) y = 40;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    if (this._snow.visible) {
      const pos = this._snowGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - 4 * dt;
        let x = pos.getX(i) + Math.sin(y * 2) * 0.5 * dt;
        if (y < 0) { y = 40; }
        pos.setY(i, y); pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }
    if (this._mode === 'storm') {
      this._lightningTimer -= dt;
      if (this._lightningTimer <= 0) {
        this._lightningTimer = 2 + Math.random() * 4;
        this._lightning.intensity = 8;
        this._lightning.position.set((Math.random() - 0.5) * 80, 25, (Math.random() - 0.5) * 80);
        if (this._onLightning) this._onLightning({ x: this._lightning.position.x, z: this._lightning.position.z });
        if (this.audio) this.audio.hit(true);
        // 闪光序列用 dt 状态机驱动（0.08s 灭→0.08s 二次闪→0.08s 灭），替代 setTimeout 避免天气切走/dispose 后残留回调
        this._flashPhase = 0;
        this._flashTimer = 0.08;
      }
      if (this._flashTimer > 0) {
        this._flashTimer -= dt;
        if (this._flashTimer <= 0) {
          this._flashPhase += 1;
          if (this._flashPhase === 1) { this._lightning.intensity = 0; this._flashTimer = 0.08; }
          else if (this._flashPhase === 2) { this._lightning.intensity = 5; this._flashTimer = 0.08; }
          else { this._lightning.intensity = 0; this._flashTimer = 0; }
        }
      }
    }
  }
}
