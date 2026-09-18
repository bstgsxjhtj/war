// @vitest-environment jsdom
import { Time } from '../../src/core/Time.js';
import { describe, it, expect } from 'vitest';

describe('Time 基础步长', () => {
  it('构造设默认 fixedStep=1/60', () => {
    const t = new Time();
    expect(t.fixedStep).toBeCloseTo(1 / 60, 6);
    expect(t.frame).toBe(0);
  });

  it('tick 累积步长并回调 onFixed/onRender', () => {
    const t = new Time(1 / 60);
    t._last = performance.now() - 100;
    const fixed = [];
    let rendered = false;
    t.tick((dt) => fixed.push(dt), () => { rendered = true; });
    expect(fixed.length).toBeGreaterThanOrEqual(1);
    expect(fixed.length).toBeLessThanOrEqual(5);
    expect(fixed[0]).toBeCloseTo(1 / 60, 5);
    expect(rendered).toBe(true);
  });

  it('tick 递增 frame', () => {
    const t = new Time(1 / 60);
    t._last = performance.now() - 100;
    const before = t.frame;
    t.tick(() => {}, () => {});
    expect(t.frame).toBeGreaterThan(before);
  });

  it('delta 超 _maxDelta 被截断（不爆步）', () => {
    const t = new Time(1 / 60);
    t._last = performance.now() - 99999;
    let count = 0;
    t.tick(() => { count++; }, () => {});
    expect(count).toBeLessThanOrEqual(5);
  });
});
