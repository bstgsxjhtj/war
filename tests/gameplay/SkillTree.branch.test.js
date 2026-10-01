import { SkillTree } from '../../src/gameplay/SkillTree.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SkillTree branches', () => {
  let st;
  beforeEach(() => {
    localStorage.clear();
    st = new SkillTree();
  });

  it('has 17 branch skills (11 base + 4 Tier3 + 2 Keystone) with req array and excl fields', () => {
    const keys = Object.keys(st.branches);
    expect(keys).toHaveLength(17);
    expect(Array.isArray(st.branches.berserk.req)).toBe(true);
    expect(st.branches.berserk.req).toContain('power>=2');
    expect(st.branches.berserk.excl).toBe('guardian');
    expect(st.branches.guardian.excl).toBe('berserk');
    expect(st.branches.regen.req).toContain('vigor>=2');
    expect(st.branches.frenzy.req).toContain('mastery>=2');
    expect(st.branches.ironwall.reqClass).toBe('warrior');
    expect(st.branches.spellpower.reqClass).toBe('mage');
    expect(st.branches.precision.reqClass).toBe('archer');
    // P1-A Tier3 多前置
    expect(st.branches.warlord.req).toContain('power>=3');
    expect(st.branches.warlord.req).toContain('berserk>=1');
    expect(st.branches.druid.req).toContain('vigor>=3');
    // P1-A Keystone
    expect(st.branches.colossus.keystone).toBe(true);
    expect(st.branches.overload.keystone).toBe(true);
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

  it('upgradeBranch fails when already maxed (berserk max:3)', () => {
    st.addPoint(20);
    st.upgrade('power'); st.upgrade('power');
    expect(st.upgradeBranch('berserk')).toBe(true);
    expect(st.upgradeBranch('berserk')).toBe(true);
    expect(st.upgradeBranch('berserk')).toBe(true);
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

  it('branchDamageMul returns 1.15 when berserk level 1 (15%/级)', () => {
    st.branches.berserk.level = 1;
    expect(st.branchDamageMul).toBeCloseTo(1.15, 2);
  });

  it('branchDefenseMul returns 0.90 when guardian level 1 (10%/级)', () => {
    st.branches.guardian.level = 1;
    expect(st.branchDefenseMul).toBeCloseTo(0.90, 2);
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

describe('P1-A 科技树深化：Tier3 冠顶 + Keystone + req 数组解析', () => {
  let st;
  beforeEach(() => {
    localStorage.clear();
    st = new SkillTree();
  });

  it('Tier3 warlord 需 power>=3 + berserk>=1（多前置网状依赖）', () => {
    st.points = 20;
    expect(st.upgradeBranch('warlord')).toBe(false);
    st.skills.power.level = 3;
    expect(st.upgradeBranch('warlord')).toBe(false);
    st.branches.berserk.level = 1;
    expect(st.upgradeBranch('warlord')).toBe(true);
    expect(st.branchWarlordDmg).toBeCloseTo(0.40);
    expect(st.branchWarlordExec).toBeCloseTo(0.10);
  });

  it('Tier3 druid 需 vigor>=3 + regen>=1 + lifesteal>=1（三前置跨分支）', () => {
    st.points = 20;
    st.skills.vigor.level = 3;
    expect(st.upgradeBranch('druid')).toBe(false);
    st.branches.regen.level = 1;
    expect(st.upgradeBranch('druid')).toBe(false);
    st.branches.lifesteal.level = 1;
    expect(st.upgradeBranch('druid')).toBe(true);
    expect(st.branchDruidRegen).toBe(12);
    expect(st.branchDruidLifesteal).toBeCloseTo(0.08);
  });

  it('Tier3 tempest 需 agility>=3 + swift>=1 + evade>=1', () => {
    st.points = 20;
    st.skills.agility.level = 3;
    st.branches.swift.level = 1;
    st.branches.evade.level = 1;
    expect(st.upgradeBranch('tempest')).toBe(true);
    expect(st.branchTempestSpeed).toBeCloseTo(0.15);
    expect(st.branchTempestDodge).toBeCloseTo(0.15);
  });

  it('Keystone colossus 机制改写：禁闪避 + 减伤 + 移速降', () => {
    st.points = 20;
    st.skills.power.level = 3;
    st.branches.guardian.level = 1;
    expect(st.upgradeBranch('colossus')).toBe(true);
    expect(st.keystoneNoDodge).toBe(true);
    expect(st.keystoneColossusDef).toBeCloseTo(0.40);
    expect(st.keystoneColossusSpeed).toBeCloseTo(-0.15);
  });

  it('Keystone overload 仅法师可用', () => {
    st.points = 20;
    st.skills.mastery.level = 3;
    st.branches.frenzy.level = 1;
    expect(st.upgradeBranch('overload')).toBe(false);
    st.setClassType('mage');
    expect(st.upgradeBranch('overload')).toBe(true);
    expect(st.keystoneOverloadStamina).toBeCloseTo(-0.50);
    expect(st.keystoneOverloadSpell).toBeCloseTo(0.60);
  });

  it('Tier3 warlord 与 bastion 互斥', () => {
    st.points = 30;
    st.skills.power.level = 3;
    st.branches.berserk.level = 1;
    st.upgradeBranch('warlord');
    st.branches.guardian.level = 1;
    expect(st.upgradeBranch('bastion')).toBe(false);
  });

  it('req 数组表达式解析支持 >= > <= < == 与 skills/branches 引用', () => {
    st.skills.power.level = 2;
    expect(st._checkReqs(['power>=2'])).toBe(true);
    expect(st._checkReqs(['power>=3'])).toBe(false);
    expect(st._checkReqs(['power==2'])).toBe(true);
    expect(st._checkReqs(['power>2'])).toBe(false);
    st.branches.berserk.level = 1;
    expect(st._checkReqs(['power>=2', 'berserk>=1'])).toBe(true);
    expect(st._checkReqs(['power>=2', 'berserk>=2'])).toBe(false);
  });

  it('向后兼容：旧字符串 req 仍按 >=2 解析', () => {
    expect(st._checkReqs('power')).toBe(false);
    st.skills.power.level = 2;
    expect(st._checkReqs('power')).toBe(true);
  });

  it('berserk 3 级渐进：branchDamageMul 1.15→1.30→1.45', () => {
    st.branches.berserk.level = 1;
    expect(st.branchDamageMul).toBeCloseTo(1.15, 2);
    st.branches.berserk.level = 2;
    expect(st.branchDamageMul).toBeCloseTo(1.30, 2);
    st.branches.berserk.level = 3;
    expect(st.branchDamageMul).toBeCloseTo(1.45, 2);
  });
});
