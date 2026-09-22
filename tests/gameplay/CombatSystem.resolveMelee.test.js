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
    position: { x, z, clone() { return { ...this }; }, sub() { return this; }, setY() { return this; }, normalize() { return this; }, length() { return 1; } },
    forward: { x: 0, z: 1 },
    weapon: { weaponClass: 'SWORD', damage: 10, range: 5, arc: Math.PI, comboDamage: null, comboKnock: null, comboLaunch: null },
    health: { alive: true, hp: 100 },
    takeDamage: vi.fn((d) => { this.health.hp -= d; return d; }),
    _curVel: { addScaledVector() {} },
    vy: 0, _launchRot: 0, _hurt: 0,
    ...opts
  };
}

describe('CombatSystem.resolveMelee 主路径', () => {
  let cs, bus;
  beforeEach(() => {
    bus = { emit: vi.fn() };
    const scene = { add() {}, remove() {} };
    cs = new CombatSystem(scene, bus);
    cs._emitHit = vi.fn();
    cs.spawnHitFX = vi.fn();
    cs.createDamageNumber = vi.fn();
    cs.spawnAoE = vi.fn();
  });

  it('命中范围内敌人：调 takeDamage + _emitHit', () => {
    const attacker = mockChar(0, 0, 0);
    const victim = mockChar(1, 0, 2);
    cs.characters = [attacker, victim];
    victim.takeDamage = vi.fn(() => 10);
    victim.health = { alive: true };
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(victim.takeDamage).toHaveBeenCalled();
    expect(cs._emitHit).toHaveBeenCalled();
  });

  it('超范围敌人不命中', () => {
    const attacker = mockChar(0, 0, 0);
    const victim = mockChar(1, 0, 100);
    cs.characters = [attacker, victim];
    victim.takeDamage = vi.fn();
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(victim.takeDamage).not.toHaveBeenCalled();
  });

  it('同队不命中', () => {
    const attacker = mockChar(0, 0, 0);
    const victim = mockChar(0, 0, 2);
    cs.characters = [attacker, victim];
    victim.takeDamage = vi.fn();
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(victim.takeDamage).not.toHaveBeenCalled();
  });

  it('击杀发 combat.kill 事件', () => {
    const attacker = mockChar(0, 0, 0);
    const victim = mockChar(1, 0, 2);
    cs.characters = [attacker, victim];
    victim.takeDamage = vi.fn(() => { victim.health.alive = false; return 999; });
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(bus.emit).toHaveBeenCalledWith('combat.kill', expect.objectContaining({ victim }));
  });
});
