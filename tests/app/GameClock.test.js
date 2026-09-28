import { describe, it, expect, vi } from 'vitest';
import { GameClock } from '../../src/app/GameClock.js';

describe('GameClock', () => {
  it('schedule(delay, fn) 在 update 累积满 delay 秒后触发 fn', () => {
    const clock = new GameClock();
    const fn = vi.fn();
    clock.schedule(0.5, fn);
    clock.update(0.3);
    expect(fn).not.toHaveBeenCalled();
    clock.update(0.3);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('多个 schedule 独立计时', () => {
    const clock = new GameClock();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    clock.schedule(0.2, fn1);
    clock.schedule(0.5, fn2);
    clock.update(0.2);
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).not.toHaveBeenCalled();
    clock.update(0.3);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('clear 清理全部待执行任务', () => {
    const clock = new GameClock();
    const fn = vi.fn();
    clock.schedule(0.5, fn);
    clock.clear();
    clock.update(1.0);
    expect(fn).not.toHaveBeenCalled();
  });

  it('setTimeScale 缩放 delay（ts=0.5 时实际等待翻倍）', () => {
    const clock = new GameClock();
    clock.setTimeScale(0.5);
    const fn = vi.fn();
    clock.schedule(0.5, fn);
    clock.update(0.5);
    expect(fn).not.toHaveBeenCalled();
    clock.update(0.5);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('schedule 返回取消函数，调用后不再触发', () => {
    const clock = new GameClock();
    const fn = vi.fn();
    const cancel = clock.schedule(0.5, fn);
    cancel();
    clock.update(1.0);
    expect(fn).not.toHaveBeenCalled();
  });

  it('fn 触发后从内部队列移除（不重复触发）', () => {
    const clock = new GameClock();
    const fn = vi.fn();
    clock.schedule(0.3, fn);
    clock.update(0.3);
    expect(fn).toHaveBeenCalledTimes(1);
    clock.update(0.3);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
