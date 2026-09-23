// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { ComboSystem } from '../../src/gameplay/ComboSystem.js';
import { EventBus } from '../../src/core/EventBus.js';
import { EV } from '../../src/core/constants/events.js';

describe('ComboSystem', () => {
  it('普通命中 +1，counter +2，perfect +3', () => {
    const cs = new ComboSystem();
    expect(cs.onHit(false, false, 0)).toBe(1.0);
    expect(cs.count).toBe(1);
    cs.onHit(true, false, 0);
    expect(cs.count).toBe(3);
    cs.onHit(false, true, 0);
    expect(cs.count).toBe(6);
  });

  it('连击升档提升伤害倍率并发 COMBO_TIER', () => {
    const bus = new EventBus();
    const tiers = [];
    bus.on(EV.COMBO_TIER, (p) => tiers.push(p.tier));
    const cs = new ComboSystem(bus);
    for (let i = 0; i < 5; i++) cs.onHit(false, false, i);
    expect(cs.tier).toBe(1);
    expect(cs.damageMul).toBe(1.1);
    expect(tiers).toContain(1);
  });

  it('到最高档触发 finisher 并发 COMBO_FINISHER，下一次命中 1.5 倍加成', () => {
    const bus = new EventBus();
    let finisher = 0;
    bus.on(EV.COMBO_FINISHER, () => finisher++);
    const cs = new ComboSystem(bus);
    for (let i = 0; i < 20; i++) cs.onHit(false, false, i);
    expect(cs.tier).toBe(3);
    expect(cs.hasFinisher).toBe(true);
    expect(finisher).toBe(1);
    const mul = cs.onHit(false, false, 21);
    expect(mul).toBeCloseTo(1.3 * 1.5);
    expect(cs.hasFinisher).toBe(false);
  });

  it('受击减半连击（高连击数不归零）', () => {
    const bus = new EventBus();
    let broken = 0;
    bus.on(EV.COMBO_BREAK, () => broken++);
    const cs = new ComboSystem(bus);
    for (let i = 0; i < 10; i++) cs.onHit(false, false, i);
    expect(cs.count).toBe(10);
    cs.onHurt();
    expect(cs.count).toBe(5);
    expect(broken).toBe(0);
    cs.onHurt();
    expect(cs.count).toBe(2);
    cs.onHurt();
    expect(cs.count).toBe(1);
    cs.onHurt();
    expect(cs.count).toBe(0);
    expect(broken).toBe(1);
  });

  it('低连击数受击归零发 COMBO_BREAK', () => {
    const bus = new EventBus();
    let broken = 0;
    bus.on(EV.COMBO_BREAK, () => broken++);
    const cs = new ComboSystem(bus);
    cs.onHit(false, false, 0);
    cs.onHurt();
    expect(cs.count).toBe(0);
    expect(cs.tier).toBe(0);
    expect(broken).toBe(1);
    cs.onHurt();
    expect(broken).toBe(1);
  });

  it('3 秒无命中后衰减至清零', () => {
    const bus = new EventBus();
    let broken = 0;
    bus.on(EV.COMBO_BREAK, () => broken++);
    const cs = new ComboSystem(bus);
    cs.onHit(false, false, 0);
    cs.update(0.5, 2);
    expect(cs.count).toBe(1);
    cs.update(2, 5);
    expect(cs.count).toBe(0);
    expect(broken).toBe(1);
  });

  it('无 bus 不抛错', () => {
    const cs = new ComboSystem();
    cs.onHit(false, false, 0);
    cs.onHurt();
    cs.update(1, 10);
  });
});
