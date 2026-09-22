// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true })
  }
}));

import { Character } from '../../src/gameplay/Character.js';
import { EV } from '../../src/core/constants/events.js';

function makeAttacker(x = 0, z = 2, armorPierce = false) {
  return { position: { x, z }, weapon: { armorPierce }, _hurt: 0 };
}

describe('Character.takeDamage 主路径', () => {
  let c, bus;
  beforeEach(() => {
    bus = { emit: vi.fn(), on: vi.fn() };
    c = new Character({ team: 0 });
    c.setBus(bus);
  });

  it('普通受击扣血并返回实际损失', () => {
    const lost = c.takeDamage(30, false, null, 1);
    expect(lost).toBe(30);
    expect(c.health.hp).toBe(c.health.maxHp - 30);
  });

  it('iFrame 期间免疫伤害', () => {
    c._iFrame = 0.1;
    expect(c.takeDamage(30, false, null, 1)).toBe(0);
    expect(c.health.hp).toBe(c.health.maxHp);
  });

  it('闪避 iFrame 早期被击触发完美闪避事件', () => {
    c._dodgeIFrame = 0.25; c._dodgeTimer = 0.3;
    expect(c.takeDamage(30, false, null, 1)).toBe(0);
    expect(c._perfectDodge).toBe(true);
    expect(bus.emit).toHaveBeenCalledWith(EV.FX_PERFECTDODGE, expect.objectContaining({ char: c }));
  });

  it('正面格挡减伤至 30%', () => {
    c.forward.set(0, 0, 1);
    c._blocking = true;
    const lost = c.takeDamage(100, false, makeAttacker(0, 2), 1);
    expect(lost).toBeCloseTo(30);
  });

  it('完美格挡窗口免伤并弹刀', () => {
    const atk = makeAttacker(0, 2);
    c.forward.set(0, 0, 1);
    c._blocking = true; c._perfectWindow = 0.1;
    expect(c.takeDamage(100, false, atk, 1)).toBe(0);
    expect(atk._hurt).toBeGreaterThanOrEqual(0.4);
    expect(bus.emit).toHaveBeenCalledWith(EV.FX_PERFECTBLOCK, expect.objectContaining({ char: c }));
  });

  it('背身格挡无效', () => {
    c.forward.set(0, 0, -1);
    c._blocking = true;
    const lost = c.takeDamage(100, false, makeAttacker(0, 2), 1);
    expect(lost).toBe(100);
  });

  it('致死伤害触发 die', () => {
    const atk = makeAttacker();
    c.takeDamage(9999, true, atk, 1);
    expect(c.alive).toBe(false);
    expect(c.lastAttacker).toBe(atk);
  });
});
