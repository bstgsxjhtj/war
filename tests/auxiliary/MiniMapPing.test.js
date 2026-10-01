// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MiniMapPing } from '../../src/auxiliary/MiniMapPing.js';
import { EV } from '../../src/core/constants/events.js';

HTMLCanvasElement.prototype.getContext = function () {
  const self = this;
  return new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return self;
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: () => {} });
      if (k === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set() { return true; }
  });
};

function mkBus() {
  return { on: vi.fn(), off: vi.fn() };
}

function mkBaseCanvas(w = 160, h = 160) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.style.position = 'fixed';
  c.style.right = '12px';
  c.style.top = '12px';
  c.style.width = '140px';
  c.style.height = '140px';
  document.body.appendChild(c);
  return c;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('MiniMapPing 构造与覆盖层', () => {
  it('构造时创建与 minimap 同尺寸、pointerEvents=none 的覆盖 canvas', () => {
    const base = mkBaseCanvas(200, 200);
    const bus = mkBus();
    const mp = new MiniMapPing(bus, { canvas: base });
    expect(mp.overlay).toBeInstanceOf(HTMLCanvasElement);
    expect(mp.overlay.width).toBe(200);
    expect(mp.overlay.height).toBe(200);
    expect(mp.overlay.style.pointerEvents).toBe('none');
    expect(mp.overlay.parentNode).toBeTruthy();
    expect(bus.on).toHaveBeenCalledWith(EV.MAP_PING, expect.any(Function));
    mp.destroy();
  });

  it('默认参数 pingTTL/pingRadius/worldSize 正确', () => {
    const mp = new MiniMapPing(mkBus(), { canvas: mkBaseCanvas() });
    expect(mp.pingTTL).toBe(4000);
    expect(mp.pingRadius).toBe(20);
    expect(mp.worldSize).toBe(220);
    mp.destroy();
  });
});

describe('MiniMapPing MAP_PING 事件添加 ping', () => {
  it('收到 MAP_PING payload 后入队一个 ping', () => {
    const bus = mkBus();
    const mp = new MiniMapPing(bus, { canvas: mkBaseCanvas() });
    const handler = bus.on.mock.calls[0][1];
    handler({ x: 10, z: -5, type: 'danger' });
    expect(mp._pings.length).toBe(1);
    expect(mp._pings[0].type).toBe('danger');
    expect(mp._pings[0].color).toBe('#ff3333');
    mp.destroy();
  });

  it('addPing 公共方法同样入队', () => {
    const mp = new MiniMapPing(mkBus(), { canvas: mkBaseCanvas() });
    mp.addPing(0, 0, 'objective');
    expect(mp._pings.length).toBe(1);
    expect(mp._pings[0].color).toBe('#33ff66');
    mp.destroy();
  });
});

describe('MiniMapPing update 老化与过期', () => {
  it('未过期 ping 保留，扩散进度推进', () => {
    const mp = new MiniMapPing(mkBus(), { canvas: mkBaseCanvas(), pingTTL: 4000 });
    mp.addPing(0, 0, 'normal');
    mp.update(0.5);
    expect(mp._pings.length).toBe(1);
    expect(mp._pings[0].t).toBeCloseTo(500, 1);
    mp.destroy();
  });

  it('超过 expand+TTL 的 ping 被移除', () => {
    const mp = new MiniMapPing(mkBus(), { canvas: mkBaseCanvas(), pingTTL: 4000 });
    mp.addPing(0, 0, 'normal');
    mp.update(6);
    expect(mp._pings.length).toBe(0);
    mp.destroy();
  });
});

describe('MiniMapPing clear', () => {
  it('clear 清空全部 ping', () => {
    const mp = new MiniMapPing(mkBus(), { canvas: mkBaseCanvas() });
    mp.addPing(1, 1, 'normal');
    mp.addPing(2, 2, 'danger');
    expect(mp._pings.length).toBe(2);
    mp.clear();
    expect(mp._pings.length).toBe(0);
    mp.destroy();
  });
});

describe('MiniMapPing destroy', () => {
  it('destroy 移除 bus 监听并从 DOM 摘除覆盖 canvas', () => {
    const bus = mkBus();
    const mp = new MiniMapPing(bus, { canvas: mkBaseCanvas() });
    const handler = bus.on.mock.calls[0][1];
    mp.destroy();
    expect(bus.off).toHaveBeenCalledWith(EV.MAP_PING, handler);
    expect(mp.overlay.parentNode).toBeNull();
  });
});
