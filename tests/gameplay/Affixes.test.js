import { Affixes, AFFIX_TYPES, SYNERGIES } from '../../src/gameplay/Affixes.js';
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

  it('grant 入背包（含 greater 标记）', () => {
    expect(a.grant('锋锐', 1)).toBe(true);
    expect(a.inventory.length).toBe(1);
    expect(a.inventory[0]).toEqual({ type: '锋锐', tier: 1, greater: false });
  });

  it('equip 装备到 weapon.affixes[slot]', () => {
    a.grant('锋锐', 1);
    const weapon = { affixes: [null, null] };
    expect(a.equip(weapon, 0, 0)).toBe(true);
    expect(weapon.affixes[0]).toEqual({ type: '锋锐', tier: 1, greater: false });
  });

  it('affixBonus 单词条锋锐 tier1 返回 0.20', () => {
    const weapon = { affixes: [{ type: '锋锐', tier: 1, greater: false }, null] };
    expect(a.affixBonus(weapon, '锋锐')).toBeCloseTo(0.20);
  });

  it('affixBonus 双词条同 type 叠加 tier1+tier2 = 0.50', () => {
    const weapon = { affixes: [{ type: '锋锐', tier: 1, greater: false }, { type: '锋锐', tier: 2, greater: false }] };
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

  it('持久化：serialize→restore 还原背包', () => {
    a.grant('锋锐', 2);
    a.grant('吸血', 0);
    const snap = a.serialize();
    expect(localStorage.getItem('affixes')).toBeNull();
    const a2 = new Affixes();
    a2.restore(snap);
    expect(a2.inventory.length).toBe(2);
    expect(a2.inventory[0]).toEqual({ type: '锋锐', tier: 2, greater: false });
    expect(a2.inventory[1]).toEqual({ type: '吸血', tier: 0, greater: false });
  });
});

describe('P1-B Affixes 品质分层（greater）', () => {
  let a;
  beforeEach(() => { a = new Affixes(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('greater 词条数值 ×1.5', () => {
    const weapon = { affixes: [{ type: '锋锐', tier: 1, greater: true }, null] };
    expect(a.affixBonus(weapon, '锋锐')).toBeCloseTo(0.30);
  });

  it('drop greater 标记随 luck 提升', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const res = a.drop(0.5);
    expect(res).toBeTruthy();
    expect(res.greater).toBe(true);
    expect(a.inventory[0].greater).toBe(true);
  });

  it('grant 支持 greater 参数', () => {
    a.grant('暴怒', 2, true);
    expect(a.inventory[0].greater).toBe(true);
  });

  it('greater 双词条叠加 ×1.5', () => {
    const weapon = { affixes: [{ type: '锋锐', tier: 1, greater: true }, { type: '锋锐', tier: 2, greater: true }] };
    expect(a.affixBonus(weapon, '锋锐')).toBeCloseTo((0.20 + 0.30) * 1.5);
  });
});

describe('Affixes 词条协同', () => {
  let a;
  beforeEach(() => { a = new Affixes(); });

  it('锋锐+暴怒 触发狂战协同', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1, greater: false }, { type: '暴怒', tier: 0, greater: false }] };
    const syn = a.checkSynergy(w);
    expect(syn).not.toBeNull();
    expect(syn.name).toBe('狂战');
  });

  it('协同不受槽位顺序影响', () => {
    const w = { affixes: [{ type: '暴怒', tier: 0, greater: false }, { type: '锋锐', tier: 1, greater: false }] };
    expect(a.checkSynergy(w)).not.toBeNull();
  });

  it('吸血+坚韧 触发不灭协同', () => {
    const w = { affixes: [{ type: '吸血', tier: 0, greater: false }, { type: '坚韧', tier: 1, greater: false }] };
    expect(a.checkSynergy(w).name).toBe('不灭');
  });

  it('迅捷+幸运 触发幸运一击协同', () => {
    const w = { affixes: [{ type: '迅捷', tier: 0, greater: false }, { type: '幸运', tier: 2, greater: false }] };
    expect(a.checkSynergy(w).name).toBe('幸运一击');
  });

  it('仅单词条不触发协同', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1, greater: false }, null] };
    expect(a.checkSynergy(w)).toBeNull();
  });

  it('非协同组合不触发（锋锐+迅捷无协同）', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1, greater: false }, { type: '迅捷', tier: 0, greater: false }] };
    expect(a.checkSynergy(w)).toBeNull();
  });

  it('无词条不触发', () => {
    const w = { affixes: [null, null] };
    expect(a.checkSynergy(w)).toBeNull();
  });

  it('synergyBonus 返回匹配 apply 类型的加成值', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1, greater: false }, { type: '暴怒', tier: 0, greater: false }] };
    expect(a.synergyBonus(w, 'damage')).toBeGreaterThan(0);
  });

  it('synergyBonus 非匹配 apply 返回 0', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1, greater: false }, { type: '暴怒', tier: 0, greater: false }] };
    expect(a.synergyBonus(w, 'lifesteal')).toBe(0);
  });
});

describe('P1-B 新增行为改变协同（处决/反伤/暴伤）', () => {
  let a;
  beforeEach(() => { a = new Affixes(); });

  it('锋锐+吸血 触发嗜血协同（处决阈值 +0.08）', () => {
    const w = { affixes: [{ type: '锋锐', tier: 1, greater: false }, { type: '吸血', tier: 0, greater: false }] };
    const syn = a.checkSynergy(w);
    expect(syn.name).toBe('嗜血');
    expect(a.synergyBonus(w, 'execute')).toBeCloseTo(0.08);
  });

  it('坚韧+幸运 触发荆棘协同（受击反伤 15%）', () => {
    const w = { affixes: [{ type: '坚韧', tier: 1, greater: false }, { type: '幸运', tier: 0, greater: false }] };
    const syn = a.checkSynergy(w);
    expect(syn.name).toBe('荆棘');
    expect(a.synergyBonus(w, 'reflect')).toBeCloseTo(0.15);
  });

  it('暴怒+迅捷 触发风暴协同（暴伤倍率 +0.5）', () => {
    const w = { affixes: [{ type: '暴怒', tier: 1, greater: false }, { type: '迅捷', tier: 0, greater: false }] };
    const syn = a.checkSynergy(w);
    expect(syn.name).toBe('风暴');
    expect(a.synergyBonus(w, 'critmul')).toBeCloseTo(0.5);
  });

  it('SYNERGIES 共 6 条', () => {
    expect(SYNERGIES).toHaveLength(6);
  });
});
