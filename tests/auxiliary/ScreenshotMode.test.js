// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScreenshotMode } from '../../src/auxiliary/ScreenshotMode.js';

const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAAtwCqIr3PYxwAAAAASUVORK5CYII=';

let warnSpy;

beforeEach(() => {
  document.body.innerHTML = '';
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mkCanvas(overrides = {}) {
  return {
    width: 100,
    height: 100,
    toDataURL: vi.fn(() => DATA_URL),
    ...overrides
  };
}

function mkBus() {
  return { on: vi.fn(), off: vi.fn(), emit: vi.fn() };
}

// 跟踪 capture() 创建的 <a> 元素及其 click 调用；canvas（空白基线）走真实 jsdom 实现。
function trackAnchors() {
  const anchors = [];
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    const el = origCreate(tag);
    if (String(tag).toLowerCase() === 'a') {
      vi.spyOn(el, 'click');
      anchors.push(el);
    }
    return el;
  });
  return anchors;
}

describe('ScreenshotMode - 构造与按键监听', () => {
  it('默认 toggleKey 为 F12 并注册 keydown 监听', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const mode = new ScreenshotMode();
    expect(mode.toggleKey).toBe('F12');
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('按下 toggleKey 触发 capture', () => {
    const canvas = mkCanvas();
    const mode = new ScreenshotMode({ canvas });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', cancelable: true }));
    expect(canvas.toDataURL).toHaveBeenCalled();
  });

  it('非 toggleKey 不触发 capture', () => {
    const canvas = mkCanvas();
    const mode = new ScreenshotMode({ canvas });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', cancelable: true }));
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });
});

describe('ScreenshotMode - capture 创建下载链接', () => {
  it('capture 调用 toDataURL 并创建 <a> 触发 click 下载', () => {
    const canvas = mkCanvas();
    const mode = new ScreenshotMode({ canvas });
    const anchors = trackAnchors();

    const filename = mode.capture();

    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
    expect(anchors.length).toBe(1);
    const a = anchors[0];
    expect(a.click).toHaveBeenCalled();
    expect(a.download).toBe(filename);
    expect(a.href).toContain('data:image/png');
    expect(filename).toMatch(/^screenshot_\d{8}_\d{6}\.png$/);
  });

  it('capture 回调 onCapture 并经 bus 发出 aux.screenshot', () => {
    const canvas = mkCanvas();
    const bus = mkBus();
    const onCapture = vi.fn();
    const mode = new ScreenshotMode({ canvas });
    mode.setBus(bus);
    mode.onCapture = onCapture;

    const filename = mode.capture();

    expect(onCapture).toHaveBeenCalledWith(filename);
    expect(bus.emit).toHaveBeenCalledWith('aux.screenshot', { filename });
  });

  it('无 canvas 时打印警告并返回 null', () => {
    const mode = new ScreenshotMode();
    expect(mode.capture()).toBe(null);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('ScreenshotMode - setCanvas', () => {
  it('setCanvas 更新 canvas 引用', () => {
    const mode = new ScreenshotMode();
    expect(mode._canvas).toBe(null);
    const canvas = mkCanvas();
    mode.setCanvas(canvas);
    expect(mode._canvas).toBe(canvas);
    mode.capture();
    expect(canvas.toDataURL).toHaveBeenCalled();
  });
});

describe('ScreenshotMode - destroy', () => {
  it('destroy 移除 keydown 监听', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const mode = new ScreenshotMode();
    mode.destroy();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('destroy 后按键不再触发 capture', () => {
    const canvas = mkCanvas();
    const mode = new ScreenshotMode({ canvas });
    mode.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12', cancelable: true }));
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });
});

describe('ScreenshotMode - 文件名格式', () => {
  it('文件名格式为 screenshot_YYYYMMDD_HHmmss.png', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 1, 14, 30, 45));
    const mode = new ScreenshotMode({ canvas: mkCanvas() });
    const filename = mode.capture();
    expect(filename).toBe('screenshot_20261001_143045.png');
    vi.useRealTimers();
  });
});
