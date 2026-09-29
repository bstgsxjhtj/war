// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Camera } from '../../src/engine/Camera.js';
import { EV } from '../../src/core/constants/events.js';
import { CAMERA } from '../../src/core/constants/balance.js';

function makeBus() {
  const handlers = {};
  return {
    on: vi.fn((ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); }),
    emit: vi.fn((ev, payload) => { (handlers[ev] || []).forEach(fn => fn(payload)); }),
    _handlers: handlers
  };
}

describe('Camera Boss 阶段转换演出（P3-4：镜头拉近 + 震屏）', () => {
  it('HUD_BOSSPHASE phase 2 收缩 FOV + 震屏', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    cam.addShake = vi.fn();
    bus.emit(EV.HUD_BOSSPHASE, { phase: 2 });
    expect(cam.addShake).toHaveBeenCalledWith(0.7);
    expect(cam._curFov).toBe(CAMERA.FOV_BOSS_PHASE2);
  });

  it('HUD_BOSSPHASE phase 3 收缩更紧 FOV + 震屏', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    cam.addShake = vi.fn();
    bus.emit(EV.HUD_BOSSPHASE, { phase: 3 });
    expect(cam.addShake).toHaveBeenCalledWith(0.7);
    expect(cam._curFov).toBe(CAMERA.FOV_BOSS_PHASE3);
  });

  it('reducedMotion 时 FOV 不变但震屏仍触发', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    cam._reducedMotion = true;
    cam.addShake = vi.fn();
    bus.emit(EV.HUD_BOSSPHASE, { phase: 2 });
    expect(cam.addShake).toHaveBeenCalledWith(0.7);
    expect(cam._curFov).toBe(CAMERA.FOV_DEFAULT);
  });

  it('Camera 构造时注册了 HUD_BOSSPHASE 监听', () => {
    const bus = makeBus();
    new Camera(bus);
    expect(bus.on).toHaveBeenCalledWith(EV.HUD_BOSSPHASE, expect.any(Function));
  });
});
