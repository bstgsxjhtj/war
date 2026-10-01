// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: { noise: () => ({ isTexture: true }), rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }), brick: () => ({ isTexture: true }) }
}));
vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(class { constructor() {} spawnBurst() {} spawn() {} update() {} }, { blood: () => ({ isTexture: true }) })
}));

import { Character } from '../../src/gameplay/Character.js';

function mkSpy() {
  const calls = [];
  return { applyState: () => {}, update: (dt) => calls.push(dt), calls };
}

describe('Character AI 动画降频 (P2)', () => {
  it('非本地角色 _animInterval=1/30 且 _animAccum=0', () => {
    const c = new Character({ team: 1 });
    expect(c.isLocal).toBe(false);
    expect(c._animInterval).toBeCloseTo(1 / 30, 6);
    expect(c._animAccum).toBe(0);
  });

  it('本地角色 _animInterval=0（满帧保证响应）', () => {
    const c = new Character({ team: 0, isLocal: true });
    expect(c.isLocal).toBe(true);
    expect(c._animInterval).toBe(0);
  });

  it('非本地角色：未达间隔不调 skeleton.update，累积 dt', () => {
    const c = new Character({ team: 1 });
    const spy = mkSpy();
    c.skeleton = spy;
    c._face = null;
    c._tickAnimState(0.01, 0, 0);
    expect(spy.calls.length).toBe(0);
    expect(c._animAccum).toBeCloseTo(0.01, 6);
  });

  it('非本地角色：累积达间隔后调 skeleton.update 传累积 dt 并清零', () => {
    const c = new Character({ team: 1 });
    const spy = mkSpy();
    c.skeleton = spy;
    c._face = null;
    c._tickAnimState(0.02, 0, 0);
    c._tickAnimState(0.02, 0, 0);
    expect(spy.calls.length).toBe(1);
    expect(spy.calls[0]).toBeCloseTo(0.04, 6);
    expect(c._animAccum).toBe(0);
  });

  it('本地角色：每次 _tickAnimState 都调 skeleton.update 传原始 dt', () => {
    const c = new Character({ team: 0, isLocal: true });
    const spy = mkSpy();
    c.skeleton = spy;
    c._face = null;
    c._tickAnimState(0.016, 0, 0);
    c._tickAnimState(0.016, 0, 0);
    expect(spy.calls.length).toBe(2);
    expect(spy.calls[0]).toBeCloseTo(0.016, 6);
    expect(spy.calls[1]).toBeCloseTo(0.016, 6);
  });
});
