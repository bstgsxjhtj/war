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

describe('Camera 完美格挡慢动作', () => {
  it('FX_PERFECTBLOCK 触发 addShake + FOV 收缩', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    cam.addShake = vi.fn();
    bus.emit(EV.FX_PERFECTBLOCK, {});
    expect(cam.addShake).toHaveBeenCalledWith(0.6);
    expect(cam._curFov).toBe(50);
  });

  it('FX_PERFECTDODGE 仍正常工作（不互相干扰）', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    cam.addShake = vi.fn();
    bus.emit(EV.FX_PERFECTDODGE, {});
    expect(cam.addShake).toHaveBeenCalledWith(0.5);
    expect(cam._curFov).toBe(52);
    // timeScale 死代码已移除：子弹时间改由 EventWiring 的 hitStop.trigger(0.4, 0.5) 提供
    expect(cam.timeScale).toBeUndefined();
  });

  it('Camera 构造时注册了 FX_PERFECTBLOCK 监听', () => {
    const bus = makeBus();
    new Camera(bus);
    expect(bus.on).toHaveBeenCalledWith(EV.FX_PERFECTBLOCK, expect.any(Function));
  });

  it('COMBAT_ULTIMATE 触发 FOV 收缩到 45（大招顿帧）', () => {
    const bus = makeBus();
    const cam = new Camera(bus);
    bus.emit(EV.COMBAT_ULTIMATE, {});
    expect(cam._curFov).toBe(45);
  });

  it('Camera 构造时注册了 COMBAT_ULTIMATE 监听', () => {
    const bus = makeBus();
    new Camera(bus);
    expect(bus.on).toHaveBeenCalledWith(EV.COMBAT_ULTIMATE, expect.any(Function));
  });
});
