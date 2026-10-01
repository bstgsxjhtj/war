// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationSystem } from '../../src/auxiliary/NotificationSystem.js';
import { EV } from '../../src/core/constants/events.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mkBus() {
  return { on: vi.fn(), off: vi.fn() };
}

const P = NotificationSystem.PRIORITY;

describe('NotificationSystem 基础', () => {
  it('constructor 创建 3 个容器', () => {
    const bus = mkBus();
    const ns = new NotificationSystem(bus);
    expect(document.querySelectorAll('.notif-container').length).toBe(3);
    expect(Object.keys(ns._containers).length).toBe(3);
    expect(ns._containers.HIGH).toBeTruthy();
    expect(ns._containers.NORMAL).toBeTruthy();
    expect(ns._containers.LOW).toBeTruthy();
  });

  it('notify 创建 DOM 元素', () => {
    const bus = mkBus();
    const ns = new NotificationSystem(bus);
    const el = ns.notify('你好世界');
    expect(el).toBeTruthy();
    expect(el.textContent).toBe('你好世界');
    expect(document.body.textContent).toContain('你好世界');
  });

  it('HIGH 优先级显示在顶部容器', () => {
    const bus = mkBus();
    const ns = new NotificationSystem(bus);
    ns.notify('危险来袭', P.HIGH);
    expect(ns._containers.HIGH.children.length).toBe(1);
    expect(ns._containers.HIGH.textContent).toContain('危险来袭');
    expect(ns._containers.NORMAL.children.length).toBe(0);
    expect(ns._containers.LOW.children.length).toBe(0);
  });

  it('队列限制 maxVisible：超出淘汰最旧', () => {
    const bus = mkBus();
    const ns = new NotificationSystem(bus, { maxVisible: 3 });
    ns.notify('一', P.NORMAL);
    ns.notify('二', P.NORMAL);
    ns.notify('三', P.NORMAL);
    ns.notify('四', P.NORMAL);
    const normal = ns._containers.NORMAL;
    expect(normal.children.length).toBe(3);
    expect(normal.textContent).not.toContain('一');
    expect(normal.textContent).toContain('四');
  });

  it('destroy 清理 DOM 与监听', () => {
    const bus = mkBus();
    const ns = new NotificationSystem(bus);
    ns.notify('残留', P.NORMAL);
    expect(document.querySelectorAll('.notif-container').length).toBe(3);
    ns.destroy();
    expect(document.querySelectorAll('.notif-container').length).toBe(0);
    expect(bus.off).toHaveBeenCalled();
    expect(ns._items.length).toBe(0);
  });
});

describe('NotificationSystem 事件订阅与自动消失', () => {
  it('订阅 EV.UI_NOTIFY 并以默认 NORMAL 转发', () => {
    const bus = mkBus();
    const ns = new NotificationSystem(bus);
    const events = bus.on.mock.calls.map(c => c[0]);
    expect(events).toContain(EV.UI_NOTIFY);
    const handler = bus.on.mock.calls.find(c => c[0] === EV.UI_NOTIFY)[1];
    handler({ text: '事件通知' });
    expect(ns._containers.NORMAL.children.length).toBe(1);
    expect(ns._containers.NORMAL.textContent).toContain('事件通知');
  });

  it('默认不订阅 HUD_FLASH（interceptFlash=false）', () => {
    const bus = mkBus();
    new NotificationSystem(bus);
    const events = bus.on.mock.calls.map(c => c[0]);
    expect(events).not.toContain(EV.HUD_FLASH);
  });

  it('interceptFlash=true 订阅 HUD_FLASH 并以 LOW 转发', () => {
    const bus = mkBus();
    const ns = new NotificationSystem(bus, { interceptFlash: true });
    const events = bus.on.mock.calls.map(c => c[0]);
    expect(events).toContain(EV.HUD_FLASH);
    const handler = bus.on.mock.calls.find(c => c[0] === EV.HUD_FLASH)[1];
    handler({ text: '闪现提示' });
    expect(ns._containers.LOW.children.length).toBe(1);
    expect(ns._containers.LOW.textContent).toContain('闪现提示');
  });

  it('update 到期后自动移除通知', () => {
    const bus = mkBus();
    const ns = new NotificationSystem(bus);
    ns.notify('临时', P.NORMAL, 1000);
    const normal = ns._containers.NORMAL;
    expect(normal.children.length).toBe(1);
    ns.update(0.15);
    ns.update(1.0);
    ns.update(0.3);
    expect(normal.children.length).toBe(0);
  });
});
