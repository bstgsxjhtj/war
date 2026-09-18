// @vitest-environment jsdom
import { Time } from '../../src/core/Time.js';
import { EventBus } from '../../src/core/EventBus.js';
import { describe, it, expect, vi } from 'vitest';

describe('Time.tick 异常隔离', () => {
  it('onFixed 抛错时不中断循环、emit engine.error、onRender 仍调用', () => {
    const bus = new EventBus();
    const errSpy = vi.fn();
    bus.on('engine.error', errSpy);
    const t = new Time(1 / 60, bus);
    t._last = performance.now() - 100;
    let rendered = false;
    const bad = () => { throw new Error('inject'); };
    t.tick(bad, () => { rendered = true; });
    expect(errSpy).toHaveBeenCalled();
    expect(errSpy.mock.calls[0][0].err.message).toBe('inject');
    expect(rendered).toBe(true);
  });

  it('无 bus 时仅 console.error 不抛', () => {
    const t = new Time(1 / 60);
    t._last = performance.now() - 100;
    expect(() => t.tick(() => { throw new Error('x'); }, () => {})).not.toThrow();
  });
});
