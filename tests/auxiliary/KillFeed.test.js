// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KillFeed } from '../../src/auxiliary/KillFeed.js';
import { EV } from '../../src/core/constants/events.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mkBus() {
  return { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
}

function handlerFor(bus, event) {
  const call = bus.on.mock.calls.find((c) => c[0] === event);
  return call && call[1];
}

describe('KillFeed - 构造', () => {
  it('构造创建 DOM 容器并挂载 body', () => {
    const kf = new KillFeed(mkBus());
    expect(kf.el).toBeInstanceOf(HTMLDivElement);
    expect(kf.el.parentNode).toBe(document.body);
    expect(kf.el.style.position).toBe('fixed');
    expect(kf.el.style.right).toBe('12px');
    expect(kf.el.style.bottom).toBe('12px');
  });
});

describe('KillFeed - COMBAT_KILL', () => {
  it('COMBAT_KILL 事件创建一条条目', () => {
    const bus = mkBus();
    const kf = new KillFeed(bus);
    const h = handlerFor(bus, EV.COMBAT_KILL);
    expect(h).toBeTruthy();
    const before = kf.el.children.length;
    h({ team: 1, killer: { isLocal: true }, victim: { team: 1 } });
    expect(kf.el.children.length).toBe(before + 1);
  });

  it('条目文案为 "🔵 击杀 🔴"', () => {
    const bus = mkBus();
    const kf = new KillFeed(bus);
    handlerFor(bus, EV.COMBAT_KILL)({ team: 1 });
    expect(kf.el.lastChild.textContent).toBe('🔵 击杀 🔴');
  });
});

describe('KillFeed - F5 全量面板', () => {
  it('F5 切换全量面板显示/隐藏', () => {
    const kf = new KillFeed(mkBus());
    expect(kf._fullPanel).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', cancelable: true }));
    expect(kf._fullPanel).toBe(true);
    expect(kf._panel && kf._panel.parentNode).toBe(document.body);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', cancelable: true }));
    expect(kf._fullPanel).toBe(false);
  });
});

describe('KillFeed - destroy', () => {
  it('destroy 移除 DOM 并解绑 bus 监听', () => {
    const bus = mkBus();
    const kf = new KillFeed(bus);
    kf.destroy();
    expect(kf.el.parentNode).toBe(null);
    expect(bus.off).toHaveBeenCalled();
  });
});
