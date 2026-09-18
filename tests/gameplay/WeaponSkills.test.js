import { WeaponSkills } from '../../src/gameplay/WeaponSkills.js';
import { describe, it, expect } from 'vitest';

describe('WeaponSkills', () => {
  it('canCast 初始 true（全 4 槽）', () => {
    const ws = new WeaponSkills();
    expect(ws.canCast(0)).toBe(true);
    expect(ws.canCast(3)).toBe(true);
  });
  it('trigger 后 canCast false', () => {
    const ws = new WeaponSkills();
    ws.trigger(0);
    expect(ws.canCast(0)).toBe(false);
  });
  it('trigger 不影响其他槽', () => {
    const ws = new WeaponSkills();
    ws.trigger(0);
    expect(ws.canCast(1)).toBe(true);
  });
  it('update 递减冷却', () => {
    const ws = new WeaponSkills();
    ws.trigger(0);
    ws.update(3);
    expect(ws.cdRemaining(0)).toBe(5);
  });
  it('update 到 0 后 canCast true', () => {
    const ws = new WeaponSkills();
    ws.trigger(0);
    ws.update(8);
    expect(ws.canCast(0)).toBe(true);
    expect(ws.cdRemaining(0)).toBe(0);
  });
  it('update 不低于 0', () => {
    const ws = new WeaponSkills();
    ws.trigger(0);
    ws.update(100);
    expect(ws.cdRemaining(0)).toBe(0);
  });
  it('reset 全清', () => {
    const ws = new WeaponSkills();
    ws.trigger(0); ws.trigger(2);
    ws.reset();
    expect(ws.canCast(0)).toBe(true);
    expect(ws.canCast(2)).toBe(true);
  });
  it('cdRemaining 查询', () => {
    const ws = new WeaponSkills();
    ws.trigger(1);
    expect(ws.cdRemaining(1)).toBe(8);
    ws.update(2);
    expect(ws.cdRemaining(1)).toBe(6);
  });
});
