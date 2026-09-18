import { Stamina } from '../../src/gameplay/Stamina.js';
import { describe, it, expect } from 'vitest';

describe('Stamina', () => {
  it('初始满耐力', () => {
    const s = new Stamina(100);
    expect(s.cur).toBe(100);
    expect(s.ratio).toBe(1);
    expect(s.depleted).toBe(false);
  });

  it('consume 扣减且耗尽返 false', () => {
    const s = new Stamina(100);
    expect(s.consume(60)).toBe(true);
    expect(s.cur).toBe(40);
    expect(s.consume(50)).toBe(false);
    expect(s.cur).toBe(0);
  });

  it('consume 至 <30 触发 depleted', () => {
    const s = new Stamina(100);
    s.consume(75);
    expect(s.cur).toBe(25);
    expect(s.depleted).toBe(true);
  });

  it('regen 非战斗按 22/s 恢复', () => {
    const s = new Stamina(100);
    s.consume(100);
    s.regen(1, false);
    expect(s.cur).toBe(22);
    expect(s.depleted).toBe(true);
  });

  it('regen 战斗按 8/s 恢复且超 30 解除 depleted', () => {
    const s = new Stamina(100);
    s.consume(95);
    s.regen(5, true);
    expect(s.cur).toBe(45);
    expect(s.depleted).toBe(false);
  });

  it('regen 不超上限', () => {
    const s = new Stamina(100);
    s.regen(1000, false);
    expect(s.cur).toBe(100);
  });
});
