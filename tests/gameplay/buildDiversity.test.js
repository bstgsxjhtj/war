import { describe, it, expect } from 'vitest';
import { SkillTree } from '../../src/gameplay/SkillTree.js';
import { RunBuffs } from '../../src/gameplay/RunBuffs.js';

describe('P2-7 Build 多样性：技能树防御分支上调', () => {
  function treeWith(branchKey) {
    const t = new SkillTree();
    t.points = 20;
    const req = t.branches[branchKey].req;
    t.skills[req].level = 2;
    expect(t.upgradeBranch(branchKey)).toBe(true);
    return t;
  }

  it('guardian 减伤上调至 25%', () => {
    const t = treeWith('guardian');
    expect(t.branchDefenseMul).toBeCloseTo(0.75);
    expect(t.branches.guardian.desc).toContain('25');
  });

  it('regen 回血上调至 5HP/s', () => {
    const t = treeWith('regen');
    expect(t.branchRegen).toBe(5);
    expect(t.branches.regen.desc).toContain('5');
  });

  it('berserk/lifesteal 数值保持不变', () => {
    expect(treeWith('berserk').branchDamageMul).toBeCloseTo(1.25);
    expect(treeWith('lifesteal').branchLifesteal).toBeCloseTo(0.05);
  });
});

describe('P2-7 Build 多样性：RunBuffs 扩展', () => {
  it('池子扩充到 12 项以上', () => {
    expect(RunBuffs.UPGRADES.length).toBeGreaterThanOrEqual(12);
  });

  it('damage 为加法式叠层且存在叠加上限', () => {
    const p = { health: { maxHp: 100, hp: 50 }, stamina: { max: 100, cur: 50 }, speed: 5 };
    const rb = new RunBuffs();
    for (let i = 0; i < 10; i++) rb.apply(p, 'damage');
    expect(p._runDmgMul).toBeCloseTo(1.5);
  });

  it('reroll 返回新的一组 3 项且数量有限', () => {
    const rb = new RunBuffs(1);
    const first = rb.roll3();
    expect(first.length).toBe(3);
    expect(rb.rerollsLeft).toBeGreaterThan(0);
    const second = rb.reroll();
    expect(second.length).toBe(3);
    expect(rb.rerollsLeft).toBe(0);
    expect(rb.reroll()).toBeNull();
  });

  it('reroll 每局通过 resetRerolls 恢复', () => {
    const rb = new RunBuffs(1);
    rb.roll3();
    rb.reroll();
    rb.resetRerolls();
    expect(rb.rerollsLeft).toBeGreaterThan(0);
  });
});