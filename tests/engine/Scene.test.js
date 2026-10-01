// @vitest-environment jsdom
import * as THREE from 'three';
import { Scene } from '../../src/engine/Scene.js';
import { PALETTE } from '../../src/core/constants/palette.js';
import { describe, it, expect } from 'vitest';

// C2-15：Scene 必须暴露半球光（此前未暴露 → WeatherSystem 环境光分支全为死代码），
// 且雾密度/日照/背景统一取 PALETTE.SCENE（中央色板唯一事实来源）
describe('Scene 光照与色板（C2-15）', () => {
  it('暴露 hemisphere 光供 WeatherSystem 调节，强度 0.65', () => {
    const s = new Scene();
    expect(s.hemi).toBeInstanceOf(THREE.HemisphereLight);
    expect(s.scene.children).toContain(s.hemi);
    expect(s.hemi.intensity).toBeCloseTo(0.65, 5);
  });

  it('半球光色温取自 PALETTE.SCENE', () => {
    const s = new Scene();
    expect(s.hemi.color.getHex()).toBe(PALETTE.SCENE.HEMI_SKY);
    expect(s.hemi.groundColor.getHex()).toBe(PALETTE.SCENE.HEMI_GROUND);
  });

  it('雾为 FogExp2，密度取 PALETTE.SCENE.FOG_DENSITY', () => {
    const s = new Scene();
    expect(s.scene.fog).toBeInstanceOf(THREE.FogExp2);
    expect(s.scene.fog.density).toBeCloseTo(PALETTE.SCENE.FOG_DENSITY, 6);
    expect(s.scene.fog.color.getHex()).toBe(PALETTE.SCENE.FOG);
  });

  it('背景色取 PALETTE.SCENE.BG', () => {
    const s = new Scene();
    expect(s.scene.background.getHex()).toBe(PALETTE.SCENE.BG);
  });

  it('太阳 directional 光颜色/强度取色板基准值', () => {
    const s = new Scene();
    expect(s.sun).toBeInstanceOf(THREE.DirectionalLight);
    expect(s.sun.color.getHex()).toBe(PALETTE.SCENE.SUN);
    expect(s.sun.intensity).toBeCloseTo(1.4, 5);
  });
});