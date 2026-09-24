// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CombatSystem } from '../../src/gameplay/CombatSystem.js';
import { EV } from '../../src/core/constants/events.js';

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => new (class { setAttribute() {} })() }
  )
}));

function mockChar(team, x = 0, z = 0, opts = {}) {
  return {
    alive: true, team,
    position: { x, y: 0, z, distanceTo() { return 1; }, clone() { return { ...this, setY() { return this; } }; }, copy() { return this; } },
    forward: { x: 0, z: 1 },
    weapon: { weaponClass: 'SWORD', damage: 10, range: 5, arc: Math.PI, comboDamage: null, comboKnock: null, comboLaunch: null, affixes: [null, null], name: '剑' },
    health: { alive: true, hp: 100, maxHp: 100 },
    takeDamage: vi.fn(() => 10),
    _curVel: { addScaledVector() {} },
    vy: 0, _launchRot: 0, _hurt: 0,
    ...opts
  };
}
function mockAffixes(bonuses = {}) {
  return { affixBonus: vi.fn((weapon, type) => bonuses[type] || 0), synergyBonus: vi.fn(() => 0) };
}

describe('CombatSystem 暴击反馈', () => {
  let cs, bus;
  beforeEach(() => {
    bus = { emit: vi.fn() };
    cs = new CombatSystem({ add() {}, remove() {} }, bus);
    cs.spawnHitFX = vi.fn();
  });

  it('_affixApply 暴击时设置 _lastAffixCrit=true', () => {
    const a = mockChar(0);
    cs.setAffixes(mockAffixes({ 暴怒: 1.0 }));
    vi.spyOn(Math, 'random').mockReturnValue(0);
    cs._affixApply(a, a.weapon, 10);
    expect(cs._lastAffixCrit).toBe(true);
    Math.random.mockRestore();
  });

  it('_affixApply 非暴击时 _lastAffixCrit=false', () => {
    const a = mockChar(0);
    cs.setAffixes(mockAffixes({ 暴怒: 0 }));
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    cs._affixApply(a, a.weapon, 10);
    expect(cs._lastAffixCrit).toBe(false);
    Math.random.mockRestore();
  });

  it('createDamageNumber crit=true 使用更大缩放', () => {
    const pos = new THREE.Vector3(0, 1, 0);
    cs.createDamageNumber(pos, 50, false, true);
    const slot = cs._numSprites.find(n => n.spr.visible);
    expect(slot).toBeTruthy();
    expect(slot.spr.scale.x).toBe(1.8);
  });

  it('createDamageNumber 非暴击使用常规缩放', () => {
    const pos = new THREE.Vector3(0, 1, 0);
    cs.createDamageNumber(pos, 10, false, false);
    const slot = cs._numSprites.find(n => n.spr.visible);
    expect(slot).toBeTruthy();
    expect(slot.spr.scale.x).toBe(1.2);
  });

  it('_emitHit 在 COMBAT_HIT payload 携带 crit', () => {
    const attacker = mockChar(0);
    const victim = mockChar(1, 0, 2);
    cs.createDamageNumber = vi.fn();
    cs._emitHit(attacker, victim, 50, '剑', 0xff3322, 0, false, 0, false, true);
    const hit = bus.emit.mock.calls.find(c => c[0] === EV.COMBAT_HIT);
    expect(hit).toBeTruthy();
    expect(hit[1].crit).toBe(true);
  });

  it('resolveMelee 分支暴击 → COMBAT_HIT payload crit=true', () => {
    const attacker = mockChar(0, 0, 0, { _skill: { branchCritChance: 1, totalMul: () => 1, branchDamageMul: 1 } });
    const victim = mockChar(1, 0, 2, { forward: { x: 0, z: -1 } });
    cs.characters = [attacker, victim];
    cs.createDamageNumber = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    Math.random.mockRestore();
    const hit = bus.emit.mock.calls.find(c => c[0] === EV.COMBAT_HIT);
    expect(hit).toBeTruthy();
    expect(hit[1].crit).toBe(true);
  });
});
