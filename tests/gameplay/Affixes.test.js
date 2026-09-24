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

  it('持久化：serialize→restore 还原背包（收敛到 savegame_v1，不再自写 affixes 键）', () => {
    a.grant('锋锐', 2);
    a.grant('吸血', 0);
    const snap = a.serialize();
    expect(localStorage.getItem('affixes')).toBeNull();
    const a2 = new Affixes();
    a2.restore(snap);
    expect(a2.inventory.length).toBe(2);
    expect(a2.inventory[0]).toEqual({ type: '锋锐', tier: 2 });
    expect(a2.inventory[1]).toEqual({ type: '吸血', tier: 0 });
  });
});

describe('Affixes 词条协同', () => {
  let a;
  beforeEach(() => { a = new Affixes(); });

  it('锋锐+暴怒 触发狂战协同', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1 }, { type: '暴怒', tier: 0 }] };
    const syn = a.checkSynergy(w);
    expect(syn).not.toBeNull();
    expect(syn.name).toBe('狂战');
  });

  it('协同不受槽位顺序影响（暴怒+锋锐 仍触发）', () => {
    const w = { affixes: [{ type: '暴怒', tier: 0 }, { type: '锋锐', tier: 1 }] };
    expect(a.checkSynergy(w)).not.toBeNull();
  });

  it('吸血+坚韧 触发不灭协同', () => {
    const w = { affixes: [{ type: '吸血', tier: 0 }, { type: '坚韧', tier: 1 }] };
    const syn = a.checkSynergy(w);
    expect(syn).not.toBeNull();
    expect(syn.name).toBe('不灭');
  });

  it('迅捷+幸运 触发幸运一击协同', () => {
    const w = { affixes: [{ type: '迅捷', tier: 0 }, { type: '幸运', tier: 2 }] };
    const syn = a.checkSynergy(w);
    expect(syn).not.toBeNull();
    expect(syn.name).toBe('幸运一击');
  });

  it('仅单词条不触发协同', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1 }, null] };
    expect(a.checkSynergy(w)).toBeNull();
  });

  it('非协同组合不触发', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1 }, { type: '吸血', tier: 0 }] };
    expect(a.checkSynergy(w)).toBeNull();
  });

  it('无词条不触发', () => {
    const w = { affixes: [null, null] };
    expect(a.checkSynergy(w)).toBeNull();
  });

  it('synergyBonus 返回匹配 apply 类型的加成值', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1 }, { type: '暴怒', tier: 0 }] };
    expect(a.synergyBonus(w, 'damage')).toBeGreaterThan(0);
  });

  it('synergyBonus 非匹配 apply 返回 0', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1 }, { type: '暴怒', tier: 0 }] };
    expect(a.synergyBonus(w, 'lifesteal')).toBe(0);
  });

  it('synergyBonus 无协同返回 0', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1 }, null] };
    expect(a.synergyBonus(w, 'damage')).toBe(0);
  });
});
