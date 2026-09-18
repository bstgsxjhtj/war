import { EventBus } from '../../src/core/EventBus.js';
import { describe, it, expect, vi } from 'vitest';

describe('EventBus', () => {
  it('on/emit 触发监听器', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('hit', fn);
    bus.emit('hit', { dmg: 5 });
    expect(fn).toHaveBeenCalledWith({ dmg: 5 });
  });

  it('on 返回取消订阅函数', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const off = bus.on('hit', fn);
    off();
    bus.emit('hit', {});
    expect(fn).not.toHaveBeenCalled();
  });

  it('off 移除指定监听器', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('hit', a);
    bus.on('hit', b);
    bus.off('hit', a);
    bus.emit('hit', {});
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('emit 未注册事件不报错', () => {
    const bus = new EventBus();
    expect(() => bus.emit('none', {})).not.toThrow();
  });

  it('监听器抛错被捕获不影响其他监听器', () => {
    const bus = new EventBus();
    const ok = vi.fn();
    bus.on('hit', () => { throw new Error('boom'); });
    bus.on('hit', ok);
    bus.emit('hit', {});
    expect(ok).toHaveBeenCalled();
  });
});
