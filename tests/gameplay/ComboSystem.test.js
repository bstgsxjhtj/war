// @vitest-environment jsdom
import { ComboSystem } from '../../src/gameplay/ComboSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import { describe, it, expect, vi } from 'vitest';

describe('ComboSystem', () => {
  it('onHit 普通命中 +1', () => {
    const cs = new ComboSystem(new EventBus());
    cs.onHit(false, false, 1);
    expect(cs.count).toBe(1);
    expect(cs.tier).toBe(0);
  });
  it('onHit 克制命中 +2', () => {
    const cs = new ComboSystem(new EventBus());
    cs.onHit(true, false, 1);
    expect(cs.count).toBe(2);
  });
  it('onHit 完美反击 +3', () => {
    const cs = new ComboSystem(new EventBus());
    cs.onHit(false, true, 1);
    expect(cs.count).toBe(3);
  });
  it('tier 阈值跳变 5→1, 10→2, 20→3', () => {
    const cs = new ComboSystem(new EventBus());
    for (let i = 0; i < 5; i++) cs.onHit(false, false, i + 1);
    expect(cs.tier).toBe(1);
    for (let i = 0; i < 5; i++) cs.onHit(false, false, 10 + i);
    expect(cs.tier).toBe(2);
    for (let i = 0; i < 10; i++) cs.onHit(false, false, 20 + i);
    expect(cs.tier).toBe(3);
  });
  it('damageMul 各层级倍率', () => {
    const cs = new ComboSystem(new EventBus());
    expect(cs.damageMul).toBe(1.0);
    for (let i = 0; i < 5; i++) cs.onHit(false, false, i + 1);
    expect(cs.damageMul).toBe(1.1);
    for (let i = 0; i < 5; i++) cs.onHit(false, false, 10 + i);
    expect(cs.damageMul).toBe(1.2);
    for (let i = 0; i < 10; i++) cs.onHit(false, false, 20 + i);
    expect(cs.damageMul).toBe(1.3);
  });
  it('onHit 返回本次伤害倍率（含 finisher）', () => {
    const cs = new ComboSystem(new EventBus());
    for (let i = 0; i < 20; i++) cs.onHit(false, false, i + 1);
    expect(cs.tier).toBe(3);
    expect(cs.hasFinisher).toBe(true);
    const mul = cs.onHit(false, false, 21);
    expect(mul).toBe(1.3 * 1.5);
    expect(cs.hasFinisher).toBe(false);
  });
  it('onHurt 归零 + combo.break 事件', () => {
    const bus = new EventBus();
    const spy = vi.fn();
    bus.on('combo.break', spy);
    const cs = new ComboSystem(bus);
    cs.onHit(true, false, 1);
    cs.onHurt();
    expect(cs.count).toBe(0);
    expect(cs.tier).toBe(0);
    expect(spy).toHaveBeenCalled();
  });
  it('update 3s 内不衰减', () => {
    const cs = new ComboSystem(new EventBus());
    cs.onHit(true, false, 1);
    cs.update(2, 3);
    expect(cs.count).toBe(2);
  });
  it('update 3s 后线性衰减', () => {
    const cs = new ComboSystem(new EventBus());
    cs.onHit(true, false, 1);
    cs.update(1, 5);
    expect(cs.count).toBeLessThan(2);
    expect(cs.count).toBeGreaterThan(0);
  });
  it('update 衰减到 0 归零 + combo.break', () => {
    const bus = new EventBus();
    const spy = vi.fn();
    bus.on('combo.break', spy);
    const cs = new ComboSystem(bus);
    cs.onHit(false, false, 1);
    cs.update(2, 10);
    expect(cs.count).toBe(0);
    expect(spy).toHaveBeenCalled();
  });
  it('掉 tier3 再升回重新触发 finisher', () => {
    const cs = new ComboSystem(new EventBus());
    for (let i = 0; i < 20; i++) cs.onHit(false, false, i + 1);
    expect(cs.hasFinisher).toBe(true);
    cs.onHit(false, false, 21);
    expect(cs.hasFinisher).toBe(false);
    cs.onHurt();
    for (let i = 0; i < 20; i++) cs.onHit(false, false, 100 + i);
    expect(cs.hasFinisher).toBe(true);
  });
});
