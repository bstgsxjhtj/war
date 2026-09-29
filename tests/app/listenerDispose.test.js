// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {},
    fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {}, measureText: () => ({ width: 10 }),
    save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
    set fillStyle(v) {}, set strokeStyle(v) {}, set font(v) {}, set textAlign(v) {}, set lineWidth(v) {}
  }));
  document.body.innerHTML = '';
});

import { Camera } from '../../src/engine/Camera.js';
import { Time } from '../../src/core/Time.js';
import { SaveOrchestrator } from '../../src/app/SaveOrchestrator.js';
import { UIPanel } from '../../src/ui/UIPanel.js';
import { HUD } from '../../src/ui/HUD.js';
import { States } from '../../src/core/GameState.js';

function mkBus() {
  const offs = [];
  return {
    bus: { on: vi.fn(() => { const off = vi.fn(); offs.push(off); return off; }), emit: vi.fn() },
    offs
  };
}

describe('Camera 监听器可退订 (P1-6)', () => {
  it('dispose 退订 5 个 bus 事件并移除 resize 监听', () => {
    const { bus, offs } = mkBus();
    const rmSpy = vi.spyOn(window, 'removeEventListener');
    const cam = new Camera(bus);
    expect(offs.length).toBe(5);
    cam.dispose();
    for (const off of offs) expect(off).toHaveBeenCalled();
    expect(rmSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    rmSpy.mockRestore();
  });
});

describe('Time 监听器可退订 (P1-6)', () => {
  it('dispose 移除 visibilitychange 监听', () => {
    const rmSpy = vi.spyOn(document, 'removeEventListener');
    const t = new Time(1 / 60, null);
    t.dispose();
    expect(rmSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    rmSpy.mockRestore();
  });
});

describe('SaveOrchestrator 计时器可清理 (P1-6)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('dispose 清理两个 setInterval 与 beforeunload 监听', () => {
    const deps = { state: { current: States.PLAYING } };
    const so = new SaveOrchestrator(deps);
    so.saveNow = vi.fn();
    const ciSpy = vi.spyOn(globalThis, 'clearInterval');
    const rmSpy = vi.spyOn(window, 'removeEventListener');
    so.startTimers();
    expect(vi.getTimerCount()).toBe(2);
    so.dispose();
    expect(ciSpy).toHaveBeenCalledTimes(2);
    expect(rmSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    ciSpy.mockRestore();
    rmSpy.mockRestore();
  });

  it('dispose 后计时器不再触发', () => {
    const deps = { state: { current: States.PLAYING } };
    const so = new SaveOrchestrator(deps);
    so.saveNow = vi.fn();
    so.startTimers();
    so.dispose();
    vi.advanceTimersByTime(5000);
    expect(so.playTimeSec).toBe(0);
  });
});

describe('UIPanel.destroy (P1-6)', () => {
  it('destroy 移除 keydown 监听并从 DOM 移除面板元素', () => {
    const p = new UIPanel({ id: 'test-panel', toggleKey: 'KeyP' });
    expect(document.getElementById('test-panel')).not.toBeNull();
    const rmSpy = vi.spyOn(document, 'removeEventListener');
    p.destroy();
    expect(rmSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(document.getElementById('test-panel')).toBeNull();
    rmSpy.mockRestore();
  });

  it('destroy 后 toggleKey 不再生效', () => {
    const p = new UIPanel({ id: 'test-panel2', toggleKey: 'KeyP' });
    p.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
    expect(p.visible).toBe(false);
  });
});

describe('HUD.dispose (P1-6)', () => {
  it('dispose 退订全部 bus 事件并移除 DOM 监听', () => {
    const { bus, offs } = mkBus();
    const hud = new HUD(bus);
    expect(offs.length).toBeGreaterThanOrEqual(15);
    const rmSpy = vi.spyOn(document, 'removeEventListener');
    hud.dispose();
    for (const off of offs) expect(off).toHaveBeenCalled();
    expect(rmSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    rmSpy.mockRestore();
  });
});
