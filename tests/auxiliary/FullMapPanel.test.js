// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FullMapPanel } from '../../src/auxiliary/FullMapPanel.js';
import { UIStack } from '../../src/ui/UIStack.js';
import { EV } from '../../src/core/constants/events.js';

function mkCtx() {
  return {
    clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clip() {},
    beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {},
    fillRect() {}, rect() {}, strokeRect() {},
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  UIStack._stack.length = 0;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mkCtx());
});

describe('FullMapPanel 全屏战场全图面板', () => {
  it('构造创建覆盖层并默认隐藏（display none, z-index 200）', () => {
    const bus = { on: vi.fn(), off: vi.fn() };
    const p = new FullMapPanel(bus);
    expect(p.el).toBeDefined();
    expect(p.el.parentElement).toBe(document.body);
    expect(p.el.style.display).toBe('none');
    expect(p.el.style.position).toBe('fixed');
    expect(p.el.style.zIndex).toBe('200');
    expect(p.visible).toBe(false);
    expect(bus.on).toHaveBeenCalledWith(EV.MAP_PING, expect.any(Function));
  });

  it('show/hide 切换 display 并同步 UIStack', () => {
    const bus = { on: vi.fn(), off: vi.fn() };
    const p = new FullMapPanel(bus);
    p.show();
    expect(p.visible).toBe(true);
    expect(p.el.style.display).toBe('flex');
    expect(UIStack.top).toBe(p);
    p.hide();
    expect(p.visible).toBe(false);
    expect(p.el.style.display).toBe('none');
    expect(UIStack.empty).toBe(true);
  });

  it('toggle 切换显隐', () => {
    const bus = { on: vi.fn(), off: vi.fn() };
    const p = new FullMapPanel(bus);
    expect(p.visible).toBe(false);
    p.toggle();
    expect(p.visible).toBe(true);
    expect(p.el.style.display).toBe('flex');
    p.toggle();
    expect(p.visible).toBe(false);
    expect(p.el.style.display).toBe('none');
  });

  it('pausesGame=true，入栈时触发 UIStack.pausing（C1-6 暂停门）', () => {
    const bus = { on: vi.fn(), off: vi.fn() };
    const p = new FullMapPanel(bus);
    expect(p.pausesGame).toBe(true);
    p.show();
    expect(UIStack.pausing).toBe(true);
    p.hide();
    expect(UIStack.pausing).toBe(false);
  });

  it('destroy 移除 DOM、清理栈与事件订阅', () => {
    const bus = { on: vi.fn(), off: vi.fn() };
    const p = new FullMapPanel(bus);
    p.show();
    p.destroy();
    expect(p.el.parentElement).toBe(null);
    expect(document.body.contains(p.el)).toBe(false);
    expect(UIStack.empty).toBe(true);
    expect(bus.off).toHaveBeenCalled();
  });
});
