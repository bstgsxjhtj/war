// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UIStack, installUIStackEscape } from '../../src/ui/UIStack.js';

function esc() { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true })); }

describe('UIStack 面板栈', () => {
  beforeEach(() => { UIStack._stack.length = 0; installUIStackEscape(); });

  it('push/remove/top/empty 基本语义', () => {
    expect(UIStack.empty).toBe(true);
    const a = { hide() {} }, b = { hide() {} };
    UIStack.push(a); UIStack.push(b);
    expect(UIStack.top).toBe(b);
    UIStack.remove(a);
    expect(UIStack.top).toBe(b);
    UIStack.remove(b);
    expect(UIStack.empty).toBe(true);
  });

  it('重复 push 同一面板不产生重复项', () => {
    const a = { hide() {} };
    UIStack.push(a); UIStack.push(a);
    expect(UIStack._stack.length).toBe(1);
  });

  it('Escape 只关栈顶，其他面板保持', () => {
    const bottom = { hide: vi.fn() }, top = { hide: vi.fn() };
    UIStack.push(bottom); UIStack.push(top);
    esc();
    expect(top.hide).toHaveBeenCalledTimes(1);
    expect(bottom.hide).not.toHaveBeenCalled();
  });

  it('栈空时 Escape 不拦截（事件未被取消）', () => {
    const spy = vi.fn();
    window.addEventListener('keydown', spy);
    esc();
    expect(spy).toHaveBeenCalled();
    window.removeEventListener('keydown', spy);
  });

  it('栈非空时 Escape 阻止后续 window 监听器', () => {
    const p = { hide: vi.fn() };
    UIStack.push(p);
    const spy = vi.fn();
    window.addEventListener('keydown', spy);
    esc();
    expect(p.hide).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener('keydown', spy);
  });

  it('installUIStackEscape 幂等（多次安装不重复关闭）', () => {
    installUIStackEscape(); installUIStackEscape();
    const p = { hide: vi.fn() };
    UIStack.push(p);
    esc();
    expect(p.hide).toHaveBeenCalledTimes(1);
  });

  it('closable=false 的栈顶面板 Escape 不关闭但仍吞掉事件', () => {
    const p = { hide: vi.fn(), closable: false };
    UIStack.push(p);
    const spy = vi.fn();
    window.addEventListener('keydown', spy);
    esc();
    expect(p.hide).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    expect(UIStack.top).toBe(p);
    window.removeEventListener('keydown', spy);
  });

  it('closable=false 栈底时栈顶可正常关闭', () => {
    const bottom = { hide: vi.fn(), closable: false };
    const top = { hide: vi.fn() };
    UIStack.push(bottom); UIStack.push(top);
    esc();
    expect(top.hide).toHaveBeenCalledTimes(1);
    expect(bottom.hide).not.toHaveBeenCalled();
    expect(UIStack.top).toBe(bottom);
  });
});
