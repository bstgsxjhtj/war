// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tutorial } from '../../src/ui/Tutorial.js';
import { EV } from '../../src/core/constants/events.js';
import { LS } from '../../src/core/constants/storage-keys.js';

function mkBus() {
  const handlers = {};
  return {
    on: vi.fn((name, fn) => { (handlers[name] ||= []).push(fn); return () => {}; }),
    emit: vi.fn((name, payload) => { (handlers[name] || []).forEach((f) => f(payload)); }),
    _handlers: handlers,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

function keydown(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}
function mousedown(button) {
  window.dispatchEvent(new MouseEvent('mousedown', { button }));
}

describe('Tutorial - 构造与初始状态', () => {
  it('5 步 toast，初始 step=0 active=true，渲染第一步', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    expect(t.steps.length).toBe(5);
    expect(t.step).toBe(0);
    expect(t.active).toBe(true);
    expect(t.el.parentNode).toBe(document.body);
    expect(t.el.textContent).toContain('移动');
    expect(t.el.textContent).toContain('WASD');
  });

  it('订阅 COMBAT_COUNTER 与 COMBAT_ULTIMATE 事件', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    expect(bus.on).toHaveBeenCalledWith(EV.COMBAT_COUNTER, expect.any(Function));
    expect(bus.on).toHaveBeenCalledWith(EV.COMBAT_ULTIMATE, expect.any(Function));
  });

  it('bus 可选：不传时不抛错', () => {
    const t = new Tutorial();
    expect(t.active).toBe(true);
    expect(t.el.textContent).toContain('移动');
  });
});

describe('Tutorial - update 透明度与超时推进', () => {
  it('fade-in：FADE 秒后 opacity=1 进入 hold', () => {
    const t = new Tutorial(mkBus());
    expect(parseFloat(t.el.style.opacity)).toBeLessThanOrEqual(0.001);
    t.update(0.3);
    expect(parseFloat(t.el.style.opacity)).toBe(1);
    expect(t.phase).toBe('hold');
  });

  it('hold 超时后自动推进到下一步', () => {
    const t = new Tutorial(mkBus());
    t.update(0.3);
    expect(t.step).toBe(0);
    t.update(6);
    expect(t.step).toBe(1);
    expect(t.el.textContent).toContain('攻击');
  });

  it('fade-in 期间也可被动作推进', () => {
    const t = new Tutorial(mkBus());
    t.update(0.1);
    keydown('KeyW');
    expect(t.step).toBe(1);
    expect(t.el.textContent).toContain('攻击');
  });
});

describe('Tutorial - 动作匹配推进', () => {
  it('① 移动：KeyW/KeyA/KeyS/KeyD 推进', () => {
    const t = new Tutorial(mkBus());
    keydown('KeyA');
    expect(t.step).toBe(1);
  });

  it('② 攻击：鼠标左键(button 0)推进', () => {
    const t = new Tutorial(mkBus());
    keydown('KeyW');
    mousedown(0);
    expect(t.step).toBe(2);
    expect(t.el.textContent).toContain('格挡');
  });

  it('③ 格挡：鼠标右键(button 2)推进', () => {
    const t = new Tutorial(mkBus());
    t.step = 2; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    mousedown(2);
    expect(t.step).toBe(3);
    expect(t.el.textContent).toContain('大招');
  });

  it('④ 大招：KeyT 推进（修复 KeyE bug：按 KeyE 不推进）', () => {
    const t = new Tutorial(mkBus());
    t.step = 3; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    keydown('KeyE');
    expect(t.step).toBe(3);
    keydown('KeyT');
    expect(t.step).toBe(4);
    expect(t.el.textContent).toContain('克制');
  });

  it('④ 大招：COMBAT_ULTIMATE 事件也推进', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    t.step = 3; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    bus.emit(EV.COMBAT_ULTIMATE);
    expect(t.step).toBe(4);
  });

  it('⑤ 克制：COMBAT_COUNTER 事件推进到完成', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    t.step = 4; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    bus.emit(EV.COMBAT_COUNTER);
    expect(t.active).toBe(false);
    expect(t.el.textContent).toContain('引导完成');
    expect(localStorage.getItem(LS.TUTORIAL_DONE)).toBe('1');
  });

  it('非当前步对应的动作不推进', () => {
    const t = new Tutorial(mkBus());
    keydown('KeyT');
    expect(t.step).toBe(0);
    mousedown(2);
    expect(t.step).toBe(0);
  });

  it('完成后不再响应任何动作', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    t._finish();
    keydown('KeyW');
    mousedown(0);
    bus.emit(EV.COMBAT_COUNTER);
    expect(t.active).toBe(false);
  });
});

describe('Tutorial - 完成与收尾', () => {
  it('全部步进后写 tutorial_done 并显示完成语', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    keydown('KeyW');
    mousedown(0);
    mousedown(2);
    keydown('KeyT');
    bus.emit(EV.COMBAT_COUNTER);
    expect(t.active).toBe(false);
    expect(localStorage.getItem(LS.TUTORIAL_DONE)).toBe('1');
    expect(t.el.textContent).toContain('引导完成');
  });

  it('完成语 hold FINAL_HOLD 秒后隐藏元素', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    keydown('KeyW'); mousedown(0); mousedown(2); keydown('KeyT');
    bus.emit(EV.COMBAT_COUNTER);
    expect(t.el.style.display).not.toBe('none');
    t.update(2);
    expect(t.el.style.display).toBe('none');
  });
});

describe('Tutorial - destroy', () => {
  it('移除 window 监听并移除元素', () => {
    const t = new Tutorial(mkBus());
    t.destroy();
    expect(t.el.parentNode).toBe(null);
    keydown('KeyW');
    expect(t.step).toBe(0);
  });
});
