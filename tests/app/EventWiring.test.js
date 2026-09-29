// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { wireCoreHandlers } from '../../src/app/EventWiring.js';
import { EV } from '../../src/core/constants/events.js';

function makeBus() {
  const handlers = {};
  return {
    on: vi.fn((ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); }),
    emit: vi.fn((ev, payload) => { (handlers[ev] || []).forEach(fn => fn(payload)); }),
    _handlers: handlers
  };
}

function makeDeps(overrides = {}) {
  return {
    audio: { playSound: vi.fn() },
    hitStop: { trigger: vi.fn() },
    hitDirection: { show: vi.fn() },
    weaponTrail: { activate: vi.fn() },
    daily: { track: vi.fn(() => false), challenges: [] },
    progression: { recordKill: vi.fn(), recordDeath: vi.fn() },
    progressUI: { refresh: vi.fn() },
    deathFeedback: { show: vi.fn() },
    assist: { onPlayerDeath: vi.fn(), setBaseLevel: vi.fn() },
    aiManager: { setDifficulty: vi.fn() },
    camera: { yaw: 0, addShake: vi.fn(), setShakeIntensity: vi.fn() },
    dodgeGhosts: { begin: vi.fn() },
    match: { playerDamage: 0, playerTaken: 0 },
    weather: { setMode: vi.fn() },
    ...overrides
  };
}

describe('EventWiring HUD_BOSSPHASE 演出接线（P3-4：吼叫 + 天气）', () => {
  it('phase 2 → bossRoar + bgmIntensity + weather.setMode(storm)', () => {
    const bus = makeBus();
    const deps = makeDeps();
    wireCoreHandlers(bus, deps);
    bus.emit(EV.HUD_BOSSPHASE, { phase: 2 });
    expect(deps.audio.playSound).toHaveBeenCalledWith('bossRoar');
    expect(deps.audio.playSound).toHaveBeenCalledWith('bgmIntensity', { intensity: 2 });
    expect(deps.weather.setMode).toHaveBeenCalledWith('storm');
  });

  it('phase 3 → weather.setMode(night)', () => {
    const bus = makeBus();
    const deps = makeDeps();
    wireCoreHandlers(bus, deps);
    bus.emit(EV.HUD_BOSSPHASE, { phase: 3 });
    expect(deps.weather.setMode).toHaveBeenCalledWith('night');
  });

  it('无 weather 时不报错（deps.weather 可缺）', () => {
    const bus = makeBus();
    const deps = makeDeps({ weather: undefined });
    wireCoreHandlers(bus, deps);
    expect(() => bus.emit(EV.HUD_BOSSPHASE, { phase: 2 })).not.toThrow();
  });
});
