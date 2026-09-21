// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIPanel } from '../../src/ui/UIPanel.js';

function key(code) {
  document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
}

describe('UIPanel 基类（面板四胞胎共性）', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('构造创建居中面板容器并挂到 body，默认隐藏', () => {
    const p = new UIPanel({ id: 'test-panel', toggleKey: 'KeyT' });
    expect(p.el).toBeDefined();
    expect(p.el.id).toBe('test-panel');
    expect(p.el.parentElement).toBe(document.body);
    expect(p.el.style.display).toBe('none');
    expect(p.visible).toBe(false);
  });

  it('按 toggleKey 切换显隐并触发 render', () => {
    const p = new UIPanel({ id: 'test-panel', toggleKey: 'KeyT' });
    p.render = vi.fn();
    key('KeyT');
    expect(p.visible).toBe(true);
    expect(p.el.style.display).toBe('block');
    expect(p.render).toHaveBeenCalledTimes(1);
    key('KeyT');
    expect(p.visible).toBe(false);
    expect(p.el.style.display).toBe('none');
  });

  it('show/hide 控制 visible 与 display', () => {
    const p = new UIPanel({ id: 'test-panel', toggleKey: 'KeyT' });
    p.show();
    expect(p.visible).toBe(true);
    expect(p.el.style.display).toBe('block');
    p.hide();
    expect(p.visible).toBe(false);
    expect(p.el.style.display).toBe('none');
  });

  it('Escape 在可见时隐藏，隐藏时无操作', () => {
    const p = new UIPanel({ id: 'test-panel', toggleKey: 'KeyT' });
    p.show();
    key('Escape');
    expect(p.visible).toBe(false);
    expect(p.el.style.display).toBe('none');
    key('Escape');
    expect(p.visible).toBe(false);
  });

  it('show 时调用 render 一次，hide 不调用', () => {
    const p = new UIPanel({ id: 'test-panel', toggleKey: 'KeyT' });
    p.render = vi.fn();
    p.show();
    p.hide();
    expect(p.render).toHaveBeenCalledTimes(1);
  });

  it('支持自定义样式与宽度', () => {
    const p = new UIPanel({ id: 'x', toggleKey: 'KeyX', width: '600px', style: { border: '1px solid red' } });
    expect(p.el.style.width).toBe('600px');
    expect(p.el.style.border).toBe('1px solid red');
  });

  it('render 默认是空实现（子类覆写）', () => {
    const p = new UIPanel({ id: 'x', toggleKey: 'KeyX' });
    expect(() => p.render()).not.toThrow();
  });
});
