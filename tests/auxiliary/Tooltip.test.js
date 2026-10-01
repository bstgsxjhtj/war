// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Tooltip, tooltip } from '../../src/auxiliary/Tooltip.js';

describe('Tooltip 独立提示系统', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('register 为元素挂载 mouseenter/mousemove/mouseleave 监听', () => {
    const t = new Tooltip();
    const el = document.createElement('div');
    const addSpy = vi.spyOn(el, 'addEventListener');
    t.register(el, 'hello');
    expect(addSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  });

  it('show/hide 切换 display 显隐', () => {
    const t = new Tooltip();
    expect(t.el.style.display).toBe('none');
    t.show('content', 10, 10);
    expect(t.el.style.display).toBe('block');
    t.hide();
    expect(t.el.style.display).toBe('none');
  });

  it('纯文本内容用 textContent 渲染（不走 innerHTML）', () => {
    const t = new Tooltip();
    const textSetter = vi.spyOn(t.el, 'textContent', 'set');
    const htmlSetter = vi.spyOn(t.el, 'innerHTML', 'set');
    t.show('plain text', 5, 5);
    expect(textSetter).toHaveBeenCalledWith('plain text');
    expect(htmlSetter).not.toHaveBeenCalled();
  });

  it('unregister 移除已挂载的监听', () => {
    const t = new Tooltip();
    const el = document.createElement('div');
    t.register(el, 'hello');
    const removeSpy = vi.spyOn(el, 'removeEventListener');
    t.unregister(el);
    expect(removeSpy).toHaveBeenCalledWith('mouseenter', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));
  });

  it('模块导出默认单例实例', () => {
    expect(tooltip).toBeInstanceOf(Tooltip);
  });
});
