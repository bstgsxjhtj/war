// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Camera } from '../../src/engine/Camera.js';
import { EV } from '../../src/core/constants/events.js';

function makeBus() {
  const handlers = {};
  return {
    on: vi.fn((ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); }),
    emit: vi.fn((ev, payload) => { (handlers[ev] || []).forEach(fn => fn(payload)); }),
    _handlers: handlers
  };
}

describe('Camera 震动强度与减少动效', () => {
  it('默认强度 1，addShake 正常累加', () => {
    const cam = new Camera(makeBus());
    cam.addShake(0.4);
    expect(cam._shake).toBeCloseTo(0.4, 5);
  });

  it('setShakeIntensity 按比例缩放震动幅度', () => {
    const cam = new Camera(makeBus());
    cam.setShakeIntensity(0.5);
    cam.addShake(0.4);
    expect(cam._shake).toBeCloseTo(0.2, 5);
  });

  it('setShakeIntensity 夹紧到 [0,1]', () => {
    const cam = new Camera(makeBus());
    cam.setShakeIntensity(2);
    expect(cam._shakeMul).toBe(1);
    cam.setShakeIntensity(-1);
    expect(cam._shakeMul).toBe(0);
  });

  it('setReducedMotion(true) 完全屏蔽震动', () => {
    const cam = new Camera(makeBus());
    cam.setReducedMotion(true);
    cam.addShake(0.5);
    expect(cam._shake).toBe(0);
  });

  it('减少动效时完美格挡不收缩 FOV', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    cam.setReducedMotion(true);
    bus.emit(EV.FX_PERFECTBLOCK, {});
    expect(cam._curFov).toBe(60);
  });

  it('减少动效时大招不收缩 FOV', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    cam.setReducedMotion(true);
    bus.emit(EV.COMBAT_ULTIMATE, {});
    expect(cam._curFov).toBe(60);
  });

  it('未开启减少动效时 FOV 收缩照常生效', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    bus.emit(EV.FX_PERFECTBLOCK, {});
    expect(cam._curFov).toBe(50);
  });
});