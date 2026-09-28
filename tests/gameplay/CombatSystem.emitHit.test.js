// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { CombatSystem } from '../../src/gameplay/CombatSystem.js';
import { COMBAT } from '../../src/core/constants/balance.js';

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => new (class { setAttribute() {} })() }
  )
}));

function mockChar(team, x = 0, z = 0) {
  return {
    alive: true, team,
    position: { x, z, clone() { return { ...this }; }, sub() { return this; }, setY() { return this; }, normalize() { return this; }, length() { return 1; }, distanceTo(o) { return Math.hypot(this.x - o.x, this.z - o.z); } },
    forward: { x: 0, z: 1 },
    weapon: { weaponClass: 'SWORD', damage: 10, range: 5, arc: Math.PI, comboDamage: null, comboKnock: null, comboLaunch: null },
    health: { alive: true, hp: 100, ratio: 1 },
    takeDamage: vi.fn((d) => { this.health.hp -= d; return d; }),
    addRage: vi.fn(),
    _curVel: { addScaledVector() {} },
    vy: 0, _launchRot: 0, _hurt: 0,
  };
}

describe('P2-10 CombatSystem._emitHit 主路径（使用 COMBAT 常量）', () => {
  let cs, bus;
  beforeEach(() => {
    bus = { emit: vi.fn() };
    const scene = { add() {}, remove() {} };
    cs = new CombatSystem(scene, bus);
    cs.spawnHitFX = vi.fn();
    cs.createDamageNumber = vi.fn();
  });

  it('普通命中 emit FX_SHAKE 用 COMBAT.SHAKE_MAP[0] 且不超过 SHAKE_MAX', () => {
    const atk = mockChar(0, 0, 0), vic = mockChar(1, 0, 1);
    cs._emitHit(atk, vic, 10, '刀', 0xff0000, 0, false, 0, false, false);
    const shake = bus.emit.mock.calls.find(c => c[0] === 'fx.shake')[1].amount;
    expect(shake).toBeCloseTo(COMBAT.SHAKE_MAP[0], 5);
    expect(shake).toBeLessThanOrEqual(COMBAT.SHAKE_MAX);
  });

  it('combo=2 + heavy 命中叠加 HEAVY_SHAKE_BONUS 并 cap', () => {
    const atk = mockChar(0, 0, 0), vic = mockChar(1, 0, 1);
    cs._emitHit(atk, vic, 10, '刀', 0xff0000, 2, true, 0, false, false);
    const shake = bus.emit.mock.calls.find(c => c[0] === 'fx.shake')[1].amount;
    expect(shake).toBeCloseTo(Math.min(COMBAT.SHAKE_MAX, COMBAT.SHAKE_MAP[2] + COMBAT.HEAVY_SHAKE_BONUS), 5);
  });

  it('hitstop 按 COMBAT.HITSTOP_MAP 累加且上限 HITSTOP_MAX', () => {
    const atk = mockChar(0, 0, 0), vic = mockChar(1, 0, 1);
    cs.hitstop = 0;
    cs._emitHit(atk, vic, 10, '刀', 0xff0000, 0, true, 0, false, false);
    expect(cs.hitstop).toBeCloseTo(Math.min(COMBAT.HITSTOP_MAX, COMBAT.HITSTOP_MAP[0] + COMBAT.HEAVY_HITSTOP_BONUS), 5);
    cs._emitHit(atk, vic, 10, '刀', 0xff0000, 0, true, 0, false, false);
    expect(cs.hitstop).toBeLessThanOrEqual(COMBAT.HITSTOP_MAX);
  });

  it('counterMul > COUNTER_THRESHOLD 时 emit combat.counter', () => {
    const atk = mockChar(0, 0, 0), vic = mockChar(1, 0, 1);
    cs._counterMul = () => 1.5;
    cs._emitHit(atk, vic, 10, '刀', 0xff0000, 0, false, 0, false, false);
    expect(bus.emit).toHaveBeenCalledWith('combat.counter', expect.objectContaining({ mul: 1.5 }));
  });

  it('counterMul < COUNTER_THRESHOLD 时不 emit combat.counter', () => {
    const atk = mockChar(0, 0, 0), vic = mockChar(1, 0, 1);
    cs._counterMul = () => 1.0;
    cs._emitHit(atk, vic, 10, '刀', 0xff0000, 0, false, 0, false, false);
    expect(bus.emit.mock.calls.find(c => c[0] === 'combat.counter')).toBeUndefined();
  });
});