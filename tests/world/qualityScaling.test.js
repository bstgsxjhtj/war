import { describe, it, expect, vi } from 'vitest';
import { WeatherSystem } from '../../src/world/WeatherSystem.js';
import { Environment } from '../../src/world/Environment.js';

describe('WeatherSystem.setQuality (P2-5)', () => {
  it('低画质缩减雨/雪粒子绘制数量', () => {
    const scene = { add: vi.fn(), remove: vi.fn(), fog: null };
    const w = new WeatherSystem(scene, null, null, null);
    const rainBase = w._rainGeo.drawRange.count;
    const snowBase = w._snowGeo.drawRange.count;
    w.setQuality('low');
    expect(w._rainGeo.drawRange.count).toBeLessThan(rainBase);
    expect(w._snowGeo.drawRange.count).toBeLessThan(snowBase);
    expect(w._rainGeo.drawRange.count).toBeGreaterThan(0);
  });

  it('高画质恢复完整粒子数量', () => {
    const scene = { add: vi.fn(), remove: vi.fn(), fog: null };
    const w = new WeatherSystem(scene, null, null, null);
    const rainBase = w._rainGeo.drawRange.count;
    w.setQuality('low');
    w.setQuality('high');
    expect(w._rainGeo.drawRange.count).toBe(rainBase);
  });

  it('medium 介于两者之间', () => {
    const scene = { add: vi.fn(), remove: vi.fn(), fog: null };
    const w = new WeatherSystem(scene, null, null, null);
    const base = w._rainGeo.drawRange.count;
    w.setQuality('mid');
    const mid = w._rainGeo.drawRange.count;
    expect(mid).toBeLessThan(base);
    expect(mid).toBeGreaterThan(base * 0.35);
  });
});

describe('Environment.setQuality (P2-5)', () => {
  it('低画质缩减草实例数量', () => {
    const terrain = { heightAt: () => 0 };
    const env = new Environment(terrain, null);
    const total = () => env._grassMeshes.reduce((s, m) => s + m.count, 0);
    const base = total();
    expect(base).toBeGreaterThan(0);
    env.setQuality('low');
    expect(total()).toBeLessThan(base);
    env.setQuality('high');
    expect(total()).toBe(base);
  });

  it('低画质缩减尘埃/落叶粒子', () => {
    const terrain = { heightAt: () => 0 };
    const env = new Environment(terrain, null);
    const dustBase = env._dustPts.geometry.drawRange.count;
    env.setQuality('low');
    expect(env._dustPts.geometry.drawRange.count).toBeLessThan(dustBase);
  });
});