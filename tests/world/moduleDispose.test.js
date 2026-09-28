import { describe, it, expect, vi } from 'vitest';
import { WeatherSystem } from '../../src/world/WeatherSystem.js';
import { Water } from '../../src/world/Water.js';
import { Scene } from '../../src/engine/Scene.js';
import { Environment } from '../../src/world/Environment.js';

describe('WeatherSystem.dispose (P1-5)', () => {
  it('dispose 方法存在，释放雨/雪/闪电资源并从场景移除', () => {
    const scene = { add: vi.fn(), remove: vi.fn() };
    const w = new WeatherSystem(scene, null, null, null);
    expect(typeof w.dispose).toBe('function');
    const rainGeo = vi.spyOn(w._rainGeo, 'dispose');
    const snowGeo = vi.spyOn(w._snowGeo, 'dispose');
    const rainMat = vi.spyOn(w._rain.material, 'dispose');
    const rain = w._rain, snow = w._snow, lightning = w._lightning;
    w.dispose();
    expect(rainGeo).toHaveBeenCalled();
    expect(snowGeo).toHaveBeenCalled();
    expect(rainMat).toHaveBeenCalled();
    expect(scene.remove).toHaveBeenCalledWith(rain);
    expect(scene.remove).toHaveBeenCalledWith(snow);
    expect(scene.remove).toHaveBeenCalledWith(lightning);
  });
});

describe('Water.dispose (P1-5)', () => {
  it('dispose 方法存在，释放水面与浪花资源', () => {
    const w = new Water(50, 10);
    expect(typeof w.dispose).toBe('function');
    const meshGeo = vi.spyOn(w.mesh.geometry, 'dispose');
    const meshMat = vi.spyOn(w.mesh.material, 'dispose');
    const splashGeo = vi.spyOn(w._splashGeo, 'dispose');
    w.dispose();
    expect(meshGeo).toHaveBeenCalled();
    expect(meshMat).toHaveBeenCalled();
    expect(splashGeo).toHaveBeenCalled();
  });

  it('dispose 释放 Reflector 渲染目标', () => {
    const w = new Water(50, 10);
    const rtDispose = vi.fn();
    w.reflector = { getRenderTarget: () => ({ dispose: rtDispose }), geometry: { dispose: vi.fn() }, material: { dispose: vi.fn() } };
    w.mesh.add(w.reflector);
    w.dispose();
    expect(rtDispose).toHaveBeenCalled();
  });
});

describe('Scene.dispose (P1-5)', () => {
  it('dispose 方法存在，深度释放整个场景子树', () => {
    const s = new Scene();
    expect(typeof s.dispose).toBe('function');
    const cloudGeo = vi.spyOn(s._cloud.geometry, 'dispose');
    s.dispose();
    expect(cloudGeo).toHaveBeenCalled();
  });
});

describe('Environment.dispose (P1-5)', () => {
  it('dispose 方法存在，深度释放 group 子树', () => {
    const terrain = { heightAt: () => 0 };
    const env = new Environment(terrain, null);
    expect(typeof env.dispose).toBe('function');
    let meshCount = 0;
    env.group.traverse(o => { if (o.isMesh || o.isPoints) meshCount++; });
    expect(meshCount).toBeGreaterThan(0);
    const spies = [];
    env.group.traverse(o => { if (o.geometry) spies.push(vi.spyOn(o.geometry, 'dispose')); });
    env.dispose();
    for (const s of spies) expect(s).toHaveBeenCalled();
  });
});
