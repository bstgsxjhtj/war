import { Affixes, AFFIX_TYPES } from '../../src/gameplay/Affixes.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Affixes', () => {
  let a;
  beforeEach(() => { a = new Affixes(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('drop 概率：小值入背包，大值不入背包', () => {
    const spy = vi.spyOn(Math, 'random');
    spy.mockReturnValue(0.0);
    const res = a.drop();
    expect(res).toBeTruthy();
    expect(a.inventory.length).toBe(1);
    spy.mockReturnValue(1.0);
    const res2 = a.drop();
    expect(res2).toBe(false);
    expect(a.inventory.length).toBe(1);
  });

  it('grant 入背包', () => {
    expect(a.grant('锋锐', 1)).toBe(true);
    expect(a.inventory.length).toBe(1);
    expect(a.inventory[0]).toEqual({ type: '锋锐', tier: 1 });
  });

  it('equip 装备到 weapon.affixes[slot]', () => {
    a.grant('锋锐', 1);
    const weapon = { affixes: [null, null] };
    expect(a.equip(weapon, 0, 0)).toBe(true);
    expect(weapon.affixes[0]).toEqual({ type: '锋锐', tier: 1 });
  });

  it('affixBonus 单词条锋锐 tier1 返回 0.20', () => {
    const weapon = { affixes: [{ type: '锋锐', tier: 1 }, null] };
    expect(a.affixBonus(weapon, '锋锐')).toBeCloseTo(0.20);
  });

  it('affixBonus 双词条同 type 叠加 tier1+tier2 = 0.50', () => {
    const weapon = { affixes: [{ type: '锋锐', tier: 1 }, { type: '锋锐', tier: 2 }] };
    expect(a.affixBonus(weapon, '锋锐')).toBeCloseTo(0.50);
  });

  it('affixBonus 无词条返回 0', () => {
    const weapon = { affixes: [null, null] };
    expect(a.affixBonus(weapon, '锋锐')).toBe(0);
  });

  it('背包上限 20：满则 drop 返 false', () => {
    for (let i = 0; i < 20; i++) a.grant('锋锐', 0);
    expect(a.inventory.length).toBe(20);
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    expect(a.drop()).toBe(false);
    expect(a.inventory.length).toBe(20);
  });

  it('持久化：_save 后新建实例 _load 还原', () => {
    a.grant('锋锐', 2);
    a.grant('吸血', 0);
    a._save();
    const a2 = new Affixes();
    expect(a2.inventory.length).toBe(2);
    expect(a2.inventory[0]).toEqual({ type: '锋锐', tier: 2 });
    expect(a2.inventory[1]).toEqual({ type: '吸血', tier: 0 });
  });
});
