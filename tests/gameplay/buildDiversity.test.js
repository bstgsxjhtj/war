import { describe, it, expect } from 'vitest';
import { SkillTree } from '../../src/gameplay/SkillTree.js';
import { RunBuffs } from '../../src/gameplay/RunBuffs.js';

describe('P2-7 Build 多样性：技能树防御分支上调', () => {
  function treeWith(branchKey) {
    const t = new SkillTree();
    t.points = 20;
    const reqs = t.branches[branchKey].req || [];
    const arr = Array.isArray(reqs) ? reqs : [reqs];
    for (const r of arr) {
      const m = String(r).match(/^(\w+)(>=|>|<=|<|==)?(\d+)?$/);
      if (!m) continue;
      const name = m[1], val = m[3] !== undefined ? parseInt(m[3], 10) : 2;
      if (t.skills[name]) t.skills[name].level = Math.max(t.skills[name].level, val);
      else if (t.branches[name]) t.branches[name].level = Math.max(t.branches[name].level, val);
    }
    expect(t.upgradeBranch(branchKey)).toBe(true);
    return t;
  }

  it('guardian 减伤 10%/级（max:3，P1-A 渐进化）', () => {
    const t = treeWith('guardian');
    expect(t.branchDefenseMul).toBeCloseTo(0.90);
    expect(t.branches.guardian.desc).toContain('10');
  });

  it('regen 回血 5HP/s', () => {
    const t = treeWith('regen');
    expect(t.branchRegen).toBe(5);
    expect(t.branches.regen.desc).toContain('5');
  });

  it('berserk 伤害 15%/级（max:3），lifesteal 保持', () => {
    expect(treeWith('berserk').branchDamageMul).toBeCloseTo(1.15);
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
