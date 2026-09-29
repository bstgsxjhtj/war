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

  // P0 修复：跨模块字段名混用（health.cur/health.max）需通过别名访问到真实 hp/maxHp
  it('cur/max 别名映射到 hp/maxHp', () => {
    const h = new Health(100);
    expect(h.cur).toBe(100);
    expect(h.max).toBe(100);
    h.cur = 70;
    expect(h.hp).toBe(70);
    h.max = 150;
    expect(h.maxHp).toBe(150);
    expect(h.ratio).toBeCloseTo(70 / 150);
  });

  it('SupplyPoint 风格回血通过别名生效', () => {
    const h = new Health(100);
    h.damage(50);
    h.cur = Math.min(h.max, h.cur + 4);
    expect(h.hp).toBe(54);
    expect(Number.isNaN(h.hp)).toBe(false);
  });

  it('Spawner 风格强化（maxHp*mul 后回满）通过别名生效', () => {
    const h = new Health(90);
    h.maxHp = Math.round(h.maxHp * 1.5);
    h.cur = h.maxHp;
    expect(h.hp).toBe(135);
    expect(h.ratio).toBe(1);
  });
});
