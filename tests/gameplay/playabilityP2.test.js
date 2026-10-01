// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillTree } from '../../src/gameplay/SkillTree.js';
import { RunBuffs } from '../../src/gameplay/RunBuffs.js';
import { Affixes } from '../../src/gameplay/Affixes.js';
import { CombatSystem, COUNTER_MATRIX } from '../../src/gameplay/CombatSystem.js';

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => new (class { setAttribute() {} })() }
  )
}));

function makeW(cls) { return { weaponClass: cls }; }

describe('P2-A 科技树续深：Duo 组合解锁', () => {
  let st;
  beforeEach(() => { localStorage.clear(); st = new SkillTree(); });

  it('branches 含 3 个 Duo 节点（duo 标记）', () => {
    expect(st.branches.warbringer.duo).toBe(true);
    expect(st.branches.warden.duo).toBe(true);
    expect(st.branches.phantom.duo).toBe(true);
  });

  it('warbringer 需 berserk>=1 + critical>=1（跨系双前置）', () => {
    st.points = 20;
    expect(st.upgradeBranch('warbringer')).toBe(false);
    st.branches.berserk.level = 1;
    expect(st.upgradeBranch('warbringer')).toBe(false);
    st.branches.critical.level = 1;
    expect(st.upgradeBranch('warbringer')).toBe(true);
    expect(st.duoWarbringerDmg).toBeCloseTo(0.30);
    expect(st.duoWarbringerCrit).toBeCloseTo(0.15);
  });

  it('warden 需 guardian>=1 + regen>=1', () => {
    st.points = 20;
    st.branches.guardian.level = 1;
    st.branches.regen.level = 1;
    expect(st.upgradeBranch('warden')).toBe(true);
    expect(st.duoWardenDef).toBeCloseTo(0.30);
    expect(st.duoWardenRegen).toBe(8);
  });

  it('phantom 需 swift>=1 + evade>=1', () => {
    st.points = 20;
    st.branches.swift.level = 1;
    st.branches.evade.level = 1;
    expect(st.upgradeBranch('phantom')).toBe(true);
    expect(st.duoPhantomSpeed).toBeCloseTo(0.15);
    expect(st.duoPhantomDodge).toBeCloseTo(0.15);
  });
});

describe('P2-A 局内外桥接：runBuffModifiers + RunBuffs 权重', () => {
  it('SkillTree.runBuffModifiers 返回分支对应的权重修正', () => {
    const st = new SkillTree();
    expect(st.runBuffModifiers()).toEqual({});
    st.branches.critical.level = 1;
    expect(st.runBuffModifiers().crit.weightMul).toBeCloseTo(1.5);
    st.branches.berserk.level = 2;
    expect(st.runBuffModifiers().damage.weightMul).toBeCloseTo(1.6);
    st.branches.warlord.level = 1;
    expect(st.runBuffModifiers().execdmg.weightMul).toBe(2);
  });

  it('RunBuffs.setModifiers 提升对应升级权重', () => {
    const rb = new RunBuffs(0);
    rb.setModifiers({ crit: { weightMul: 100 } });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const picks = rb.roll3();
    expect(picks[0].id).toBe('crit');
  });

  it('未设 modifiers 时 roll3 行为不变（向后兼容）', () => {
    const rb = new RunBuffs(0);
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const picks = rb.roll3();
    expect(picks).toHaveLength(3);
  });
});

describe('P2-B 装备续深：武器形态改造 + 护甲词缀槽', () => {
  let st;
  beforeEach(() => { localStorage.clear(); st = new SkillTree(); });

  it('upgradeWeaponMod 需武器 Lv3 + 2 点', () => {
    st.points = 10;
    expect(st.upgradeWeaponMod(0, 'bleed')).toBe(false);
    st.weaponLevel[0] = 3;
    expect(st.upgradeWeaponMod(0, 'bleed')).toBe(true);
    expect(st.getWeaponMod(0)).toBe('bleed');
    expect(st.upgradeWeaponMod(0, 'range')).toBe(false); // 已选
  });

  it('weaponMods 持久化 serialize/restore', () => {
    st.points = 10;
    st.weaponLevel[0] = 3;
    st.upgradeWeaponMod(0, 'pierce');
    const snap = st.serialize();
    const st2 = new SkillTree();
    st2.restore(snap);
    expect(st2.getWeaponMod(0)).toBe('pierce');
  });

  it('reset 退还 weaponMods 点数', () => {
    st.points = 10;
    st.weaponLevel[0] = 3;
    st.upgradeWeaponMod(0, 'bleed');
    st.reset();
    expect(st.getWeaponMod(0)).toBeNull();
  });

  it('Affixes.equip 支持护甲 1 槽（slot >= length 拒绝）', () => {
    const a = new Affixes();
    a.grant('锋锐', 1);
    const armor = { affixes: [null] };
    expect(a.equip(armor, 0, 0)).toBe(true);
    a.grant('吸血', 0);
    expect(a.equip(armor, 1, 1)).toBe(false);
    const weapon = { affixes: [null, null] };
    expect(a.equip(weapon, 1, 0)).toBe(true);
  });
});

describe('P2-C 相克续深：命中部位 + 动态克制', () => {
  const cs = Object.create(CombatSystem.prototype);
  cs._counterMatrix = COUNTER_MATRIX;

  it('_hitPartMul 高打低→头 ×1.5，低打高→腿 ×0.8，平→身 ×1.0', () => {
    expect(cs._hitPartMul({ position: { y: 2 } }, { position: { y: 0 } })).toBe(1.5);
    expect(cs._hitPartMul({ position: { y: 0 } }, { position: { y: 2 } })).toBe(0.8);
    expect(cs._hitPartMul({ position: { y: 0 } }, { position: { y: 0 } })).toBe(1.0);
  });

  it('_counterMulFull 动态克制：attacker._counterBonusTimer>0 时 ×1.5', () => {
    const r1 = cs._counterMulFull(makeW('HEAVY'), makeW('SHIELD'), {}, {});
    expect(r1.dynamicMul).toBe(1);
    expect(r1.damageMul).toBe(1.8);
    const r2 = cs._counterMulFull(makeW('HEAVY'), makeW('SHIELD'), { _counterBonusTimer: 1 }, {});
    expect(r2.dynamicMul).toBe(1.5);
    expect(r2.damageMul).toBe(2.5); // 1.8 × 1.5 = 2.7 → capped COUNTER_TOTAL_MAX
  });

  it('_counterMulFull 动态克制上限 2.5', () => {
    const r = cs._counterMulFull(makeW('HEAVY'), makeW('SHIELD'), { _counterBonusTimer: 1, _runCounterMul: 1.2 }, {});
    expect(r.damageMul).toBeLessThanOrEqual(2.5);
  });
});

describe('P2-C resolveMelee 命中部位集成', () => {
  function mockChar(team, x = 0, z = 0, opts = {}) {
    return {
      alive: true, team,
      position: { x, y: 0, z, distanceTo() { return 1; }, clone() { return { ...this, setY() { return this; } }; }, copy() { return this; } },
      forward: { x: 0, z: 1 },
      weapon: { weaponClass: 'SWORD', damage: 10, range: 5, arc: Math.PI, comboDamage: null, comboKnock: null, comboLaunch: null, affixes: [null, null], name: '剑' },
      health: { alive: true, hp: 100, maxHp: 100 },
      takeDamage: vi.fn(),
      _curVel: { addScaledVector() {} },
      vy: 0, _launchRot: 0, _hurt: 0,
      ...opts
    };
  }
  function mkCS() {
    return new CombatSystem({ add() {}, remove() {} }, { emit: vi.fn(), on: vi.fn() });
  }

  it('attacker 高于 victim 时伤害 ×1.5（头部位）', () => {
    const cs = mkCS();
    const attacker = mockChar(0, 0, 0, { position: { x: 0, y: 2, z: 0, distanceTo() { return 1; }, clone() { return { ...this, setY() { return this; } }; }, copy() { return this; } } });
    const victim = mockChar(1, 0, 2);
    victim.forward = { x: 0, z: -1 };
    cs.characters = [attacker, victim];
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    const dmg = victim.takeDamage.mock.calls[0][0];
    expect(dmg).toBeCloseTo(10 * 1.5);
  });

  it('attacker._counterBonusTimer>0 时动态克制 ×1.5（HEAVY vs SHIELD）', () => {
    const cs = mkCS();
    const attacker = mockChar(0, 0, 0, { _counterBonusTimer: 1, weapon: { weaponClass: 'HEAVY', damage: 10, range: 5, arc: Math.PI, comboDamage: null, comboKnock: null, comboLaunch: null, affixes: [null, null], name: '锤' } });
    const victim = mockChar(1, 0, 2, { weapon: { weaponClass: 'SHIELD', damage: 10, range: 5, arc: Math.PI, comboDamage: null, comboKnock: null, comboLaunch: null, affixes: [null, null], name: '盾' } });
    victim.forward = { x: 0, z: -1 };
    cs.characters = [attacker, victim];
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    const dmg = victim.takeDamage.mock.calls[0][0];
    // HEAVY vs SHIELD weaponMul=1.8 × dynamicMul 1.5 = 2.7 → capped 2.5
    expect(dmg).toBeCloseTo(10 * 2.5);
  });
});
