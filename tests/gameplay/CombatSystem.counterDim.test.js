// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { CombatSystem, COUNTER_MATRIX, DAMAGE_ARMOR_TABLE, WEAPON_DAMAGE_TYPE, CLASS_COUNTER, COUNTER_TOTAL_MAX } from '../../src/gameplay/CombatSystem.js';

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => new (class { setAttribute() {} })() }
  )
}));

function makeW(cls) { return { weaponClass: cls }; }

describe('P1-C 相克多维化：数据表', () => {
  it('DAMAGE_ARMOR_TABLE 钝>刺>切 对重甲', () => {
    expect(DAMAGE_ARMOR_TABLE.blunt.heavy).toBeGreaterThan(DAMAGE_ARMOR_TABLE.pierce.heavy);
    expect(DAMAGE_ARMOR_TABLE.pierce.heavy).toBeGreaterThan(DAMAGE_ARMOR_TABLE.cut.heavy);
    expect(DAMAGE_ARMOR_TABLE.cut.light).toBe(1.0);
    expect(DAMAGE_ARMOR_TABLE.blunt.heavy).toBe(1.0);
  });

  it('WEAPON_DAMAGE_TYPE 映射 4 武器类', () => {
    expect(WEAPON_DAMAGE_TYPE.SWORD).toBe('cut');
    expect(WEAPON_DAMAGE_TYPE.SPEAR).toBe('pierce');
    expect(WEAPON_DAMAGE_TYPE.HEAVY).toBe('blunt');
    expect(WEAPON_DAMAGE_TYPE.SHIELD).toBe('blunt');
  });

  it('CLASS_COUNTER 职业三角循环（刺客>法师>重装>刺客）', () => {
    expect(CLASS_COUNTER.assassin.mage).toBe(1.3);
    expect(CLASS_COUNTER.mage.warrior).toBe(1.3);
    expect(CLASS_COUNTER.warrior.assassin).toBe(1.3);
  });

  it('COUNTER_TOTAL_MAX = 2.5', () => {
    expect(COUNTER_TOTAL_MAX).toBe(2.5);
  });
});

describe('P1-C _damageTypeMul（伤害类型×护甲减伤）', () => {
  const cs = Object.create(CombatSystem.prototype);
  cs._counterMatrix = COUNTER_MATRIX;

  it('SWORD(cut) vs heavy=0.50, medium=0.75, light=1.0', () => {
    expect(cs._damageTypeMul(makeW('SWORD'), { armorType: 'heavy' })).toBe(0.50);
    expect(cs._damageTypeMul(makeW('SWORD'), { armorType: 'medium' })).toBe(0.75);
    expect(cs._damageTypeMul(makeW('SWORD'), { armorType: 'light' })).toBe(1.0);
  });

  it('SPEAR(pierce) vs heavy=0.70', () => {
    expect(cs._damageTypeMul(makeW('SPEAR'), { armorType: 'heavy' })).toBe(0.70);
  });

  it('HEAVY(blunt) vs heavy=1.0（钝器破重甲）', () => {
    expect(cs._damageTypeMul(makeW('HEAVY'), { armorType: 'heavy' })).toBe(1.0);
    expect(cs._damageTypeMul(makeW('HEAVY'), { armorType: 'light' })).toBe(0.85);
  });

  it('victim 无 armorType 返回 1（向后兼容）', () => {
    expect(cs._damageTypeMul(makeW('SWORD'), {})).toBe(1);
    expect(cs._damageTypeMul(makeW('SWORD'), null)).toBe(1);
  });
});

describe('P1-C _classCounterMul（职业相克第三维）', () => {
  const cs = Object.create(CombatSystem.prototype);

  it('刺客>法师>重装>刺客', () => {
    expect(cs._classCounterMul({ classType: 'assassin' }, { classType: 'mage' })).toBe(1.3);
    expect(cs._classCounterMul({ classType: 'mage' }, { classType: 'warrior' })).toBe(1.3);
    expect(cs._classCounterMul({ classType: 'warrior' }, { classType: 'assassin' })).toBe(1.3);
  });

  it('无 classType 返回 1', () => {
    expect(cs._classCounterMul({}, {})).toBe(1);
    expect(cs._classCounterMul({ classType: 'warrior' }, {})).toBe(1);
  });

  it('非克制职业返回 1', () => {
    expect(cs._classCounterMul({ classType: 'assassin' }, { classType: 'warrior' })).toBe(1);
  });
});

describe('P1-C _counterMulFull 多维合成', () => {
  const cs = Object.create(CombatSystem.prototype);
  cs._counterMatrix = COUNTER_MATRIX;

  it('weaponMul × dmgTypeMul × classMul 合成', () => {
    const r = cs._counterMulFull(makeW('HEAVY'), makeW('SHIELD'), { _runCounterMul: 1 }, { armorType: 'heavy' });
    expect(r.weaponMul).toBe(1.8);
    expect(r.dmgTypeMul).toBe(1.0);
    expect(r.damageMul).toBeCloseTo(1.8);
    expect(r.postureMul).toBe(1.8);
  });

  it('多维减伤：SWORD vs SWORD weaponMul=1, cut×heavy=0.50 → damageMul=0.50', () => {
    const r = cs._counterMulFull(makeW('SWORD'), makeW('SWORD'), {}, { armorType: 'heavy' });
    expect(r.damageMul).toBeCloseTo(0.50);
    expect(r.postureMul).toBe(1);
  });

  it('职业相克叠加：assassin(SWORD) vs mage(medium) → cut×medium 0.75 × classMul 1.3', () => {
    const r = cs._counterMulFull(makeW('SWORD'), makeW('SWORD'), { classType: 'assassin' }, { classType: 'mage', armorType: 'medium' });
    expect(r.damageMul).toBeCloseTo(0.75 * 1.3);
  });

  it('总倍率上限 2.5', () => {
    const r = cs._counterMulFull(makeW('HEAVY'), makeW('SHIELD'), { classType: 'warrior', _runCounterMul: 1.2 }, { armorType: 'heavy', classType: 'assassin' });
    expect(r.damageMul).toBeLessThanOrEqual(2.5);
  });

  it('向后兼容：无 armorType/classType 等价原 _counterMul', () => {
    const r = cs._counterMulFull(makeW('HEAVY'), makeW('SHIELD'), {}, {});
    expect(r.damageMul).toBe(1.8);
    expect(r.dmgTypeMul).toBe(1);
    expect(r.classMul).toBe(1);
  });
});

describe('P1-C resolveMelee 集成多维减伤', () => {
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

  it('victim 有 armorType=heavy 时 SWORD 伤害减半（cut×heavy=0.50）', () => {
    const cs = mkCS();
    const attacker = mockChar(0, 0, 0);
    const victim = mockChar(1, 0, 2, { armorType: 'heavy' });
    victim.forward = { x: 0, z: -1 };
    cs.characters = [attacker, victim];
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(victim.takeDamage).toHaveBeenCalled();
    const dmg = victim.takeDamage.mock.calls[0][0];
    expect(dmg).toBeCloseTo(10 * 0.50);
  });

  it('victim 无 armorType 时伤害不减（向后兼容）', () => {
    const cs = mkCS();
    const attacker = mockChar(0, 0, 0);
    const victim = mockChar(1, 0, 2);
    victim.forward = { x: 0, z: -1 };
    cs.characters = [attacker, victim];
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    const dmg = victim.takeDamage.mock.calls[0][0];
    expect(dmg).toBeCloseTo(10);
  });

  it('职业相克叠加伤害：assassin vs mage（classMul 1.3）', () => {
    const cs = mkCS();
    const attacker = mockChar(0, 0, 0, { classType: 'assassin' });
    const victim = mockChar(1, 0, 2, { classType: 'mage' });
    victim.forward = { x: 0, z: -1 };
    cs.characters = [attacker, victim];
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    const dmg = victim.takeDamage.mock.calls[0][0];
    expect(dmg).toBeCloseTo(10 * 1.3);
  });
});
