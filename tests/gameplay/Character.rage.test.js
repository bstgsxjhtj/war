// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true })
  }
}));

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => ({ isTexture: true }) }
  )
}));

import { Character } from '../../src/gameplay/Character.js';
import { CombatSystem } from '../../src/gameplay/CombatSystem.js';
import { EV } from '../../src/core/constants/events.js';

function makeAttacker(x = 0, z = 2, armorPierce = false) {
  return { position: { x, z }, weapon: { armorPierce }, _hurt: 0 };
}

describe('Character 怒气系统', () => {
  let c, bus;
  beforeEach(() => {
    bus = { emit: vi.fn(), on: vi.fn() };
    c = new Character({ team: 0 });
    c.setBus(bus);
  });

  it('addRage 增加怒气并钳制到 maxRage', () => {
    c.addRage(30);
    expect(c.rage).toBe(30);
    c.addRage(80);
    expect(c.rage).toBe(100);
  });

  it('受击实际掉血时获得 +5 怒气', () => {
    c.takeDamage(30, false, null, 1);
    expect(c.rage).toBe(5);
  });

  it('完美闪避获得 +15 怒气', () => {
    c._dodgeIFrame = 0.25; c._dodgeTimer = 0.3;
    c.takeDamage(30, false, null, 1);
    expect(c.rage).toBe(15);
  });

  it('完美格挡获得 +15 怒气', () => {
    const atk = makeAttacker(0, 2);
    c.forward.set(0, 0, 1);
    c._blocking = true; c._perfectWindow = 0.1;
    c.takeDamage(100, false, atk, 1);
    expect(c.rage).toBe(15);
  });

  it('iFrame 免疫但不触发完美闪避时不获得怒气', () => {
    c._iFrame = 0.1;
    c.takeDamage(30, false, null, 1);
    expect(c.rage).toBe(0);
  });

  it('tryUltimate 怒气不足时返回 false', () => {
    expect(c.tryUltimate({})).toBe(false);
    expect(c.rage).toBe(0);
  });

  it('tryUltimate 怒气满时消耗并返回 true', () => {
    c.addRage(100);
    expect(c.tryUltimate({ hitstop: 0, _arrowGeo: {}, _arrowMat: {}, scene: { add: vi.fn() }, arrows: [], ultimateMelee: vi.fn(), ultimateLine: vi.fn(), spawnAoE: vi.fn() })).toBe(true);
    expect(c.rage).toBe(0);
  });

  it('tryUltimate 释放时广播 COMBAT_ULTIMATE 事件', () => {
    c.addRage(100);
    c.tryUltimate({ hitstop: 0, _arrowGeo: {}, _arrowMat: {}, scene: { add: vi.fn() }, arrows: [], ultimateMelee: vi.fn(), ultimateLine: vi.fn(), spawnAoE: vi.fn() });
    expect(bus.emit).toHaveBeenCalledWith(EV.COMBAT_ULTIMATE, expect.objectContaining({ char: c }));
  });
});

describe('CombatSystem 命中给攻击者加怒气', () => {
  let bus, combat, attacker, victim;
  beforeEach(() => {
    bus = { emit: vi.fn(), on: vi.fn() };
    const scene = { add: vi.fn(), remove: vi.fn() };
    combat = new CombatSystem(scene, bus);
    combat.spawnHitFX = vi.fn();
    combat.createDamageNumber = vi.fn();
    attacker = new Character({ team: 0 });
    attacker.setBus(bus);
    attacker.forward.set(0, 0, 1);
    victim = new Character({ team: 1 });
    victim.forward.set(0, 0, -1);
    combat.register(attacker);
    combat.register(victim);
  });

  it('近战命中给攻击者 +3 怒气', () => {
    victim.position.set(0, 0, 2);
    const weapon = { comboDamage: [10], comboKnock: [1], comboLaunch: [null], damage: 10, range: 5, arc: Math.PI, name: '刀' };
    combat.resolveMelee(attacker, weapon, 0, 1);
    expect(attacker.rage).toBeGreaterThanOrEqual(3);
  });
});
