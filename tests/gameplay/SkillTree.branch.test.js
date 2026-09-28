import { SkillTree } from '../../src/gameplay/SkillTree.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SkillTree branches', () => {
  let st;
  beforeEach(() => {
    localStorage.clear();
    st = new SkillTree();
  });

  it('has 8 branch skills with req and excl fields', () => {
    const keys = Object.keys(st.branches);
    expect(keys).toHaveLength(8);
    expect(st.branches.berserk.req).toBe('power');
    expect(st.branches.berserk.excl).toBe('guardian');
    expect(st.branches.guardian.excl).toBe('berserk');
    expect(st.branches.regen.req).toBe('vigor');
    expect(st.branches.frenzy.req).toBe('mastery');
  });

  it('upgradeBranch succeeds when base skill >= 2 and points sufficient', () => {
    st.addPoint(10);
    st.upgrade('power');
    st.upgrade('power');
    expect(st.upgradeBranch('berserk')).toBe(true);
    expect(st.branches.berserk.level).toBe(1);
    expect(st.points).toBe(6);
  });

  it('upgradeBranch fails when base skill < 2', () => {
    st.addPoint(10);
    st.upgrade('power');
    expect(st.upgradeBranch('berserk')).toBe(false);
    expect(st.branches.berserk.level).toBe(0);
  });

  it('upgradeBranch fails when exclusive branch already taken', () => {
    st.addPoint(20);
    st.upgrade('power'); st.upgrade('power');
    st.upgradeBranch('berserk');
    expect(st.upgradeBranch('guardian')).toBe(false);
    expect(st.branches.guardian.level).toBe(0);
  });

  it('upgradeBranch fails when already maxed', () => {
    st.addPoint(20);
    st.upgrade('power'); st.upgrade('power');
    st.upgradeBranch('berserk');
    expect(st.upgradeBranch('berserk')).toBe(false);
  });

  it('upgradeBranch fails when insufficient points', () => {
    st.addPoint(3);
    st.upgrade('power'); st.upgrade('power');
    expect(st.upgradeBranch('berserk')).toBe(false);
  });

  it('reset clears branch levels and refunds points', () => {
    st.addPoint(20);
    st.upgrade('power'); st.upgrade('power');
    st.upgradeBranch('berserk');
    st.reset();
    expect(st.branches.berserk.level).toBe(0);
    expect(st.branches.guardian.level).toBe(0);
    expect(st.skills.power.level).toBe(0);
    expect(st.points).toBeGreaterThanOrEqual(20);
  });

  it('serialize/restore round-trips branch levels', () => {
    st.addPoint(20);
    st.upgrade('power'); st.upgrade('power');
    st.upgradeBranch('berserk');
    const snap = st.serialize();
    const st2 = new SkillTree();
    st2.restore(snap);
    expect(st2.branches.berserk.level).toBe(1);
    expect(st2.branches.guardian.level).toBe(0);
  });

  it('branchDamageMul returns 1.25 when berserk is taken', () => {
    st.branches.berserk.level = 1;
    expect(st.branchDamageMul).toBeCloseTo(1.25, 2);
  });

  it('branchDefenseMul returns 0.75 when guardian is taken', () => {
    st.branches.guardian.level = 1;
    expect(st.branchDefenseMul).toBeCloseTo(0.75, 2);
  });

  it('branchLifesteal returns 0.05 when lifesteal branch taken', () => {
    st.branches.lifesteal.level = 1;
    expect(st.branchLifesteal).toBeCloseTo(0.05, 2);
  });

  it('branchRegen returns 5 when regen branch taken', () => {
    st.branches.regen.level = 1;
    expect(st.branchRegen).toBe(5);
  });

  it('branchMoveSpeedMul returns 1.10 when swift taken', () => {
    st.branches.swift.level = 1;
    expect(st.branchMoveSpeedMul).toBeCloseTo(1.10, 2);
  });

  it('branchDodgeChance returns 0.10 when evade taken', () => {
    st.branches.evade.level = 1;
    expect(st.branchDodgeChance).toBeCloseTo(0.10, 2);
  });

  it('branchAttackSpeedMul returns 0.85 when frenzy taken', () => {
    st.branches.frenzy.level = 1;
    expect(st.branchAttackSpeedMul).toBeCloseTo(0.85, 2);
  });

  it('branchCritChance returns 0.15 when critical taken', () => {
    st.branches.critical.level = 1;
    expect(st.branchCritChance).toBeCloseTo(0.15, 2);
  });

  it('all branch getters return neutral values when no branches taken', () => {
    expect(st.branchDamageMul).toBe(1);
    expect(st.branchDefenseMul).toBe(1);
    expect(st.branchLifesteal).toBe(0);
    expect(st.branchRegen).toBe(0);
    expect(st.branchMoveSpeedMul).toBe(1);
    expect(st.branchDodgeChance).toBe(0);
    expect(st.branchAttackSpeedMul).toBe(1);
    expect(st.branchCritChance).toBe(0);
  });
});
