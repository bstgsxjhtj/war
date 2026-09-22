// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatSystem } from '../../src/gameplay/CombatSystem.js';

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => new (class { setAttribute() {} })() }
  )
}));

function mockChar(team, x = 0, z = 0, opts = {}) {
  return {
    alive: true, team,
    position: { x, z, distanceTo() { return 1; }, clone() { return { ...this, setY() { return this; } }; } },
    forward: { x: 0, z: 1 },
    weapon: { weaponClass: 'SWORD', damage: 10, range: 5, arc: Math.PI, comboDamage: null, comboKnock: null, comboLaunch: null, affixes: [null, null] },
    health: { alive: true, hp: 100, maxHp: 100 },
    takeDamage: vi.fn(() => 10),
    _curVel: { addScaledVector() {} },
    vy: 0, _launchRot: 0, _hurt: 0,
    ...opts
  };
}

function mockAffixes(bonuses = {}) {
  return { affixBonus: vi.fn((weapon, type) => bonuses[type] || 0) };
}

describe('CombatSystem 词条 helpers', () => {
  let cs, bus;
  beforeEach(() => {
    bus = { emit: vi.fn() };
    cs = new CombatSystem({ add() {}, remove() {} }, bus);
    cs._emitHit = vi.fn();
    cs.spawnHitFX = vi.fn();
    cs.createDamageNumber = vi.fn();
  });

  it('_affixApply 无词条原样返回', () => {
    const a = mockChar(0);
    cs.setAffixes(mockAffixes());
    expect(cs._affixApply(a, a.weapon, 10)).toBe(10);
  });

  it('_affixApply 锋锐加伤', () => {
    const a = mockChar(0);
    cs.setAffixes(mockAffixes({ 锋锐: 0.2 }));
    expect(cs._affixApply(a, a.weapon, 10)).toBeCloseTo(12);
  });

  it('_affixApply 暴怒必暴击时翻倍', () => {
    const a = mockChar(0);
    cs.setAffixes(mockAffixes({ 暴怒: 1.0 }));
    expect(cs._affixApply(a, a.weapon, 10)).toBe(20);
  });

  it('_affixLeech 吸血回血且不超上限', () => {
    const a = mockChar(0);
    a.health.hp = 50;
    cs.setAffixes(mockAffixes({ 吸血: 0.1 }));
    cs._affixLeech(a, 30);
    expect(a.health.hp).toBeCloseTo(53);
    cs._affixLeech(a, 1000);
    expect(a.health.hp).toBe(100);
  });

  it('未注入 affixes 时不抛错', () => {
    const a = mockChar(0);
    expect(cs._affixApply(a, a.weapon, 10)).toBe(10);
    expect(() => cs._affixLeech(a, 10)).not.toThrow();
  });

  it('近战命中走词条加伤与吸血', () => {
    const attacker = mockChar(0, 0, 0);
    const victim = mockChar(1, 0, 2, { forward: { x: 0, z: -1 } });
    cs.characters = [attacker, victim];
    cs.setAffixes(mockAffixes({ 锋锐: 1.0, 吸血: 0.5 }));
    attacker.health.hp = 40;
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    const dmg = victim.takeDamage.mock.calls[0][0];
    expect(dmg).toBeCloseTo(20);
    expect(attacker.health.hp).toBeCloseTo(45);
  });

  it('spawnAoE 命中不抛错且吸血', () => {
    const attacker = mockChar(0, 0, 0);
    const victim = mockChar(1, 0, 2);
    cs.characters = [attacker, victim];
    cs.setAffixes(mockAffixes({ 吸血: 0.5 }));
    attacker.health.hp = 40;
    expect(() => cs.spawnAoE(attacker.position, 5, 10, attacker, 0)).not.toThrow();
    expect(victim.takeDamage).toHaveBeenCalled();
    expect(attacker.health.hp).toBeCloseTo(45);
  });
});
