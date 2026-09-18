import { Health } from '../../src/gameplay/Health.js';
import { describe, it, expect } from 'vitest';

describe('Health', () => {
  it('初始满血且存活', () => {
    const h = new Health(100);
    expect(h.hp).toBe(100);
    expect(h.alive).toBe(true);
    expect(h.ratio).toBe(1);
  });

  it('damage 返回实际扣血量', () => {
    const h = new Health(100);
    expect(h.damage(30)).toBe(30);
    expect(h.hp).toBe(70);
  });

  it('伤害致死标记死亡并停止扣血', () => {
    const h = new Health(100);
    expect(h.damage(150)).toBe(100);
    expect(h.hp).toBe(0);
    expect(h.alive).toBe(false);
    expect(h.damage(10)).toBe(0);
  });

  it('heal 不超上限且不作用于死亡', () => {
    const h = new Health(100);
    h.damage(40);
    h.heal(30);
    expect(h.hp).toBe(90);
    h.heal(100);
    expect(h.hp).toBe(100);
    h.damage(100);
    h.heal(50);
    expect(h.alive).toBe(false);
    expect(h.hp).toBe(0);
  });

  it('revive 恢复满血存活', () => {
    const h = new Health(100);
    h.damage(100);
    h.revive();
    expect(h.alive).toBe(true);
    expect(h.hp).toBe(100);
  });
});
