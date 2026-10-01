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

  // 战役一#1 回归：onRender 必须传出真实帧间隔（delta），而非固定步长。
  // 旧 bug：governor/perf 在 onFixed 被喂 fixedStep(1/60) → fps 恒 60 → 自适应降级全失效。
  it('onRender 第二参数为真实帧间隔（非 fixedStep）', () => {
    const t = new Time(1 / 60);
    t._last = performance.now() - 50; // 50ms ≈ 0.05s = 20fps
    let realDelta = null;
    t.tick(() => {}, (_alpha, delta) => { realDelta = delta; });
    expect(realDelta).not.toBeNull();
    expect(realDelta).toBeCloseTo(0.05, 2);
    // 关键契约：真实帧间隔不应等于固定步长（低帧率时）
    expect(realDelta).not.toBeCloseTo(1 / 60, 4);
  });

  it('onRender 真实帧间隔随墙上时间变化（高帧率时接近 fixedStep 但仍为真实值）', () => {
    const t = new Time(1 / 60);
    t._last = performance.now() - 16; // ~16ms ≈ 一帧 60fps
    let realDelta = null;
    t.tick(() => {}, (_alpha, delta) => { realDelta = delta; });
    expect(realDelta).not.toBeNull();
    expect(realDelta).toBeGreaterThan(0);
    expect(realDelta).toBeLessThan(0.02);
  });
});
