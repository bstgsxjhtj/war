// @vitest-environment jsdom
import * as THREE from 'three';
import { WeatherSystem } from '../../src/world/WeatherSystem.js';
import { PALETTE } from '../../src/core/constants/palette.js';
import { describe, it, expect, beforeEach } from 'vitest';

// C2-15：clear 分支必须复位到场景基准黄昏调（PALETTE.SCENE）。
// 否则一次天气循环后 fog 密度/日照色温/半球色永久漂移，且 hemi 此前未暴露 → 环境光分支全为死代码。
describe('WeatherSystem 色板复位（C2-15）', () => {
  let scene, sun, hemi, weather;
  beforeEach(() => {
    scene = { add: () => {}, remove: () => {}, fog: { density: PALETTE.SCENE.FOG_DENSITY } };
    sun = new THREE.DirectionalLight(PALETTE.SCENE.SUN, 1.4);
    hemi = new THREE.HemisphereLight(PALETTE.SCENE.HEMI_SKY, PALETTE.SCENE.HEMI_GROUND, 0.65);
    weather = new WeatherSystem(scene, sun, hemi, null);
  });

  it('rain 会改变雾密度/日照/半球强度（确认复位有意义）', () => {
    weather.setMode('rain');
    expect(scene.fog.density).toBeCloseTo(0.012, 6);
    expect(sun.intensity).toBeCloseTo(0.7, 6);
    expect(hemi.intensity).toBeCloseTo(0.4, 6);
  });

  it('rain → clear 复位雾密度/日照色温与强度/半球强度与色温到 PALETTE.SCENE', () => {
    weather.setMode('rain');
    weather.setMode('clear');
    expect(scene.fog.density).toBeCloseTo(PALETTE.SCENE.FOG_DENSITY, 6);
    expect(sun.intensity).toBeCloseTo(1.4, 6);
    expect(sun.color.getHex()).toBe(PALETTE.SCENE.SUN);
    expect(hemi.intensity).toBeCloseTo(0.65, 6);
    expect(hemi.color.getHex()).toBe(PALETTE.SCENE.HEMI_SKY);
  });

  it('night → clear 复位半球色温（夜间的冷色 0x202038 不得残留）', () => {
    weather.setMode('night');
    expect(hemi.color.getHex()).toBe(0x202038);
    weather.setMode('clear');
    expect(hemi.color.getHex()).toBe(PALETTE.SCENE.HEMI_SKY);
    expect(sun.color.getHex()).toBe(PALETTE.SCENE.SUN);
  });

  it('snow → clear 复位雾密度与半球强度', () => {
    weather.setMode('snow');
    expect(scene.fog.density).toBeCloseTo(0.015, 6);
    weather.setMode('clear');
    expect(scene.fog.density).toBeCloseTo(PALETTE.SCENE.FOG_DENSITY, 6);
    expect(hemi.intensity).toBeCloseTo(0.65, 6);
  });

  it('storm → clear 复位日照强度', () => {
    weather.setMode('storm');
    expect(sun.intensity).toBeCloseTo(0.5, 6);
    weather.setMode('clear');
    expect(sun.intensity).toBeCloseTo(1.4, 6);
  });

  it('未传入 sun/hemi 时不抛错（旧线程兼容）', () => {
    const w = new WeatherSystem({ add: () => {}, remove: () => {}, fog: { density: 0 } }, null, null, null);
    expect(() => w.setMode('rain')).not.toThrow();
    expect(() => w.setMode('clear')).not.toThrow();
  });
});