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

describe('Camera killcam 计时步长帧率无关化（E10）', () => {
  it('follow(targetPos, dt) 按 dt 递减 _killTimer', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    const killTarget = { position: { x: 10, y: 2, z: 5 } };
    cam.setKillCam(killTarget);
    expect(cam._killTimer).toBeCloseTo(1.4, 2);
    cam.follow({ x: 0, y: 0, z: 0 }, 0.4);
    expect(cam._killTimer).toBeCloseTo(1.0, 2);
    cam.follow({ x: 0, y: 0, z: 0 }, 0.3);
    expect(cam._killTimer).toBeCloseTo(0.7, 2);
  });

  it('killCam 激活期间 follow 使用 killTarget 位置', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    const killTarget = { position: { x: 10, y: 2, z: 5 } };
    cam.setKillCam(killTarget);
    cam.follow({ x: 0, y: 0, z: 0 }, 0.1);
    expect(cam.target.x).toBe(10);
    expect(cam.target.z).toBe(5);
  });

  it('_killTimer 归零后 follow 回退到 targetPos', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    const killTarget = { position: { x: 10, y: 2, z: 5 } };
    cam.setKillCam(killTarget);
    cam.follow({ x: 0, y: 0, z: 0 }, 1.5);
    expect(cam._killTimer).toBe(0);
    cam.follow({ x: 20, y: 0, z: 20 }, 0.1);
    expect(cam.target.x).toBe(20);
    expect(cam.target.z).toBe(20);
  });

  it('follow 无 dt 参数时默认 1/60 步长（保持旧行为兼容）', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    const killTarget = { position: { x: 10, y: 2, z: 5 } };
    cam.setKillCam(killTarget);
    const before = cam._killTimer;
    cam.follow({ x: 0, y: 0, z: 0 });
    expect(cam._killTimer).toBeCloseTo(before - 1 / 60, 4);
  });
});
