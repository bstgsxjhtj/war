// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Accessibility } from '../../src/auxiliary/Accessibility.js';

function mockLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] ?? null
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
  document.body.style.cssText = '';
  document.head.innerHTML = '';
  vi.stubGlobal('localStorage', mockLocalStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Accessibility 构造与默认值', () => {
  it('constructor 加载默认设置', () => {
    const a = new Accessibility();
    expect(a.get('uiScale')).toBe(1.0);
    expect(a.get('fontSize')).toBe('medium');
    expect(a.get('highContrast')).toBe(false);
    expect(a.get('holdToToggle')).toBe(false);
    expect(a.get('subtitleEnabled')).toBe(true);
    expect(a.getAll()).toEqual({
      uiScale: 1.0,
      fontSize: 'medium',
      highContrast: false,
      holdToToggle: false,
      subtitleEnabled: true
    });
  });

  it('constructor 注入高对比度样式标签', () => {
    new Accessibility();
    const style = document.getElementById('accessibility-style');
    expect(style).toBeTruthy();
    expect(style.textContent).toContain('high-contrast');
  });
});

describe('Accessibility set 与 DOM 应用', () => {
  it('set/uiScale 对 body 应用 zoom', () => {
    const a = new Accessibility();
    a.set('uiScale', 1.2);
    expect(document.body.style.zoom).toBe('1.2');
    expect(a.get('uiScale')).toBe(1.2);
  });

  it('set/uiScale 越界自动钳制到 [0.8, 1.3]', () => {
    const a = new Accessibility();
    a.set('uiScale', 2.5);
    expect(a.get('uiScale')).toBe(1.3);
    a.set('uiScale', 0.1);
    expect(a.get('uiScale')).toBe(0.8);
  });

  it('set/fontSize 对 body 应用对应 font-size', () => {
    const a = new Accessibility();
    a.set('fontSize', 'large');
    expect(document.body.style.fontSize).toBe('18px');
    a.set('fontSize', 'small');
    expect(document.body.style.fontSize).toBe('13px');
    a.set('fontSize', 'medium');
    expect(document.body.style.fontSize).toBe('15px');
  });

  it('set/highContrast 给 body 加/移 high-contrast 类', () => {
    const a = new Accessibility();
    expect(document.body.classList.contains('high-contrast')).toBe(false);
    a.set('highContrast', true);
    expect(document.body.classList.contains('high-contrast')).toBe(true);
    a.set('highContrast', false);
    expect(document.body.classList.contains('high-contrast')).toBe(false);
  });
});

describe('Accessibility 持久化', () => {
  it('set 后写入 localStorage，新实例加载该值', () => {
    const a1 = new Accessibility();
    a1.set('uiScale', 1.3);
    a1.set('fontSize', 'large');
    a1.set('highContrast', true);

    const raw = localStorage.getItem('accessibility');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.uiScale).toBe(1.3);
    expect(parsed.fontSize).toBe('large');
    expect(parsed.highContrast).toBe(true);

    const a2 = new Accessibility();
    expect(a2.get('uiScale')).toBe(1.3);
    expect(a2.get('fontSize')).toBe('large');
    expect(a2.get('highContrast')).toBe(true);
    expect(document.body.style.zoom).toBe('1.3');
    expect(document.body.style.fontSize).toBe('18px');
    expect(document.body.classList.contains('high-contrast')).toBe(true);
  });
});

describe('Accessibility reset', () => {
  it('reset 恢复默认值并回滚 DOM', () => {
    const a = new Accessibility();
    a.set('uiScale', 1.3);
    a.set('fontSize', 'small');
    a.set('highContrast', true);

    a.reset();
    expect(a.get('uiScale')).toBe(1.0);
    expect(a.get('fontSize')).toBe('medium');
    expect(a.get('highContrast')).toBe(false);
    expect(document.body.style.zoom).toBe('1');
    expect(document.body.style.fontSize).toBe('15px');
    expect(document.body.classList.contains('high-contrast')).toBe(false);

    const parsed = JSON.parse(localStorage.getItem('accessibility'));
    expect(parsed.uiScale).toBe(1.0);
    expect(parsed.highContrast).toBe(false);
  });
});

describe('Accessibility destroy', () => {
  it('destroy 移除注入样式与 body 类、清理内联样式', () => {
    const a = new Accessibility();
    a.set('highContrast', true);
    a.set('uiScale', 1.2);
    a.set('fontSize', 'large');
    expect(document.getElementById('accessibility-style')).toBeTruthy();
    expect(document.body.classList.contains('high-contrast')).toBe(true);

    a.destroy();
    expect(document.getElementById('accessibility-style')).toBeNull();
    expect(document.body.classList.contains('high-contrast')).toBe(false);
    expect(document.body.style.zoom).toBe('');
    expect(document.body.style.fontSize).toBe('');
  });
});

describe('Accessibility 可选 bus 通信', () => {
  it('set/highContrast 时通过 bus 发射 settings.colorblind 事件', () => {
    const bus = { emit: vi.fn() };
    const a = new Accessibility({ bus });
    a.set('highContrast', true);
    expect(bus.emit).toHaveBeenCalledWith('settings.colorblind', expect.objectContaining({ value: true }));
    a.set('highContrast', false);
    expect(bus.emit).toHaveBeenLastCalledWith('settings.colorblind', expect.objectContaining({ value: false }));
  });

  it('无 bus 时不抛错', () => {
    const a = new Accessibility();
    expect(() => a.set('highContrast', true)).not.toThrow();
  });
});
