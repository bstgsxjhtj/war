// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }), brick: () => ({ isTexture: true })
  }
}));

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => new (class { setAttribute() {} })() }
  )
}));

import * as THREE from 'three';
import { RunBuffs } from '../../src/gameplay/RunBuffs.js';
import { Character } from '../../src/gameplay/Character.js';
import { CombatSystem, COUNTER_MATRIX } from '../../src/gameplay/CombatSystem.js';

const terrain = { heightAt: () => 0, slopeAt: () => 0, isWater: () => false };
const mkWeapon = () => ({ type: 'melee', range: 2.9, ready: true, createMesh: () => null, tick() {}, comboDamage: [10, 12, 15], comboKnock: [1, 1, 2], arc: 1.5, damage: 10, cooldown: 1.0, _perform: vi.fn() });
function mkChar(team = 1, hp = 100) {
  const c = new Character({ team, isLocal: false, maxHp: hp });
  c.setWeapons([mkWeapon()]);
  c.position.set(0, 0, 0);
  c.root = { position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: new THREE.Vector3(1,1,1), visible: true, add: vi.fn(), remove: vi.fn(), traverse: vi.fn() };
  c.weaponPivot = { rotation: { set: vi.fn(), x: 0, y: 0, z: 0 } };
  c.cape = { material: { uniforms: { uTime: { value: 0 }, uMove: { value: 0 } } } };
  return c;
}
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
function makeW(cls) { return { weaponClass: cls }; }

describe('RunBuffs', () => {
  let rb, player;
  beforeEach(() => {
    rb = new RunBuffs();
    player = {
      speed: 6,
      health: { maxHp: 100, hp: 60 },
      stamina: { max: 100, cur: 50 },
    };
  });

  it('UPGRADES 含 6 个以上升级', () => {
    expect(RunBuffs.UPGRADES.length).toBeGreaterThanOrEqual(6);
  });

  it('roll3 返回 3 个不重复升级', () => {
    const picks = rb.roll3();
    expect(picks.length).toBe(3);
    const ids = picks.map(p => p.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('apply maxhp 增加最大生命 50 并回血', () => {
    rb.apply(player, 'maxhp');
    expect(player.health.maxHp).toBe(150);
    expect(player.health.hp).toBe(110);
  });

  it('apply speed 增加移速 20%', () => {
    rb.apply(player, 'speed');
    expect(player.speed).toBeCloseTo(7.2);
  });

  it('apply stamina 增加最大耐力 30', () => {
    rb.apply(player, 'stamina');
    expect(player.stamina.max).toBe(130);
    expect(player.stamina.cur).toBe(80);
  });

  it('apply heal 回复满血', () => {
    rb.apply(player, 'heal');
    expect(player.health.hp).toBe(100);
  });

  it('apply damage 设置 _runDmgMul', () => {
    rb.apply(player, 'damage');
    expect(player._runDmgMul).toBeCloseTo(1.10);
  });

  it('apply lifesteal 设置 _runLifesteal', () => {
    rb.apply(player, 'lifesteal');
    expect(player._runLifesteal).toBeCloseTo(0.10);
  });

  it('apply 记录已选升级', () => {
    rb.apply(player, 'maxhp');
    rb.apply(player, 'speed');
    expect(rb.picked).toEqual(['maxhp', 'speed']);
  });

  it('apply 同一升级可叠加', () => {
    rb.apply(player, 'maxhp');
    rb.apply(player, 'maxhp');
    expect(player.health.maxHp).toBe(200);
  });

  it('apply 未知 id 不报错', () => {
    expect(() => rb.apply(player, 'nonexistent')).not.toThrow();
  });

  it('F2: apply regen 设置 _runRegen', () => {
    rb.apply(player, 'regen');
    expect(player._runRegen).toBe(3);
  });

  it('F2: apply atkspd 设置 _runAtkSpdMul', () => {
    rb.apply(player, 'atkspd');
    expect(player._runAtkSpdMul).toBeCloseTo(0.88);
  });

  it('F2: apply dodgecd 设置 _runDodgeCdMul', () => {
    rb.apply(player, 'dodgecd');
    expect(player._runDodgeCdMul).toBeCloseTo(0.75);
  });

  it('F2: apply armor 设置 _runArmorMul', () => {
    rb.apply(player, 'armor');
    expect(player._runArmorMul).toBeCloseTo(0.88);
  });

  it('F2: apply crit 设置 _runCritChance', () => {
    rb.apply(player, 'crit');
    expect(player._runCritChance).toBeCloseTo(0.12);
  });

  it('F2: apply execdmg 设置 _runExecBonus', () => {
    rb.apply(player, 'execdmg');
    expect(player._runExecBonus).toBeCloseTo(0.08);
  });

  it('F2: apply counterdmg 设置 _runCounterMul', () => {
    rb.apply(player, 'counterdmg');
    expect(player._runCounterMul).toBeCloseTo(1.20);
  });

  it('H2: reapply 将已选升级重新应用到新 player 实例', () => {
    rb.apply(player, 'regen');
    rb.apply(player, 'armor');
    const newPlayer = {};
    rb.reapply(newPlayer);
    expect(newPlayer._runRegen).toBe(3);
    expect(newPlayer._runArmorMul).toBeCloseTo(0.88);
  });

  it('H2: reapply 无已选升级时不报错', () => {
    const empty = new RunBuffs();
    const p = {};
    expect(() => empty.reapply(p)).not.toThrow();
  });
});

describe('G8: 升级消费端集成验证（字段不再只验设值，验实际生效）', () => {
  let rb;
  beforeEach(() => { rb = new RunBuffs(); });

  it('regen 升级使 Character.update() 每秒回血 _runRegen 点', () => {
    const c = mkChar(1, 100);
    c.health.hp = 50;
    vi.spyOn(c, '_tickPhysics').mockImplementation(() => {});
    vi.spyOn(c, '_tickAnimState').mockImplementation(() => {});
    vi.spyOn(c, '_updateHpBar').mockImplementation(() => {});
    rb.apply(c, 'regen');
    c.update(1.0, terrain, { characters: [c] }, 1000);
    expect(c.health.hp).toBe(53);
  });

  it('未选 regen 时 update() 不回血（对照）', () => {
    const c = mkChar(1, 100);
    c.health.hp = 50;
    vi.spyOn(c, '_tickPhysics').mockImplementation(() => {});
    vi.spyOn(c, '_tickAnimState').mockImplementation(() => {});
    vi.spyOn(c, '_updateHpBar').mockImplementation(() => {});
    c.update(1.0, terrain, { characters: [c] }, 1000);
    expect(c.health.hp).toBe(50);
  });

  it('armor 升级使 Character.takeDamage() 受伤量 ×_runArmorMul', () => {
    const c = mkChar(1, 100);
    rb.apply(c, 'armor');
    const lost = c.takeDamage(100, false, null, 1);
    expect(lost).toBeCloseTo(88);
    expect(c.health.hp).toBeCloseTo(100 - 88);
  });

  it('dodgecd 升级使 Character.tryDodge() _dodgeTimer ×_runDodgeCdMul', () => {
    const c = mkChar(1, 100);
    rb.apply(c, 'dodgecd');
    c.tryDodge({ x: 1, y: 0, z: 0 });
    expect(c._dodgeTimer).toBeCloseTo(0.24);
  });

  it('atkspd 升级使 _tickAttackPose 攻击间隔 weapon._timer ×_runAtkSpdMul', () => {
    const c = mkChar(1, 100);
    rb.apply(c, 'atkspd');
    c._attacking = true;
    c._anim = 0; c._hitResolved = false; c._animCombo = 0;
    c._pendingCombat = null; c._pendingCombo = 0; c._pendingCharge = 1;
    c._tickAttackPose(0.01, 1000);
    expect(c.weapon._timer).toBeCloseTo(0.88);
  });

  it('execdmg 升级使 canBeExecuted 阈值 +_runExecBonus（ratio 0.25 在 0.2~0.28 间可处决）', () => {
    const v = mkChar(1, 100);
    v.health.hp = 25;
    expect(v.canBeExecuted).toBe(false);
    rb.apply(v, 'execdmg');
    expect(v.canBeExecuted).toBe(true);
  });

  it('crit 升级使 CombatSystem._affixApply 暴击率 +_runCritChance（random<0.12 必暴击）', () => {
    const cs = new CombatSystem({ add() {}, remove() {} }, { emit: vi.fn(), on: vi.fn() });
    cs.setAffixes(mockAffixes({}));
    const a = mockChar(0);
    rb.apply(a, 'crit');
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const out = cs._affixApply(a, a.weapon, 10);
    expect(cs._lastAffixCrit).toBe(true);
    expect(out).toBe(20);
    spy.mockRestore();
  });

  it('counterdmg 升级使 CombatSystem._counterMul 克制倍率 ×_runCounterMul', () => {
    const cs = Object.create(CombatSystem.prototype);
    cs._counterMatrix = COUNTER_MATRIX;
    const attacker = {};
    rb.apply(attacker, 'counterdmg');
    const base = cs._counterMul(makeW('HEAVY'), makeW('SHIELD'));
    const boosted = cs._counterMul(makeW('HEAVY'), makeW('SHIELD'), attacker);
    expect(base).toBe(1.8);
    expect(boosted).toBeCloseTo(1.8 * 1.20);
  });

  it('damage 升级使 CombatSystem.resolveMelee baseDmg ×_runDmgMul', () => {
    const cs = new CombatSystem({ add() {}, remove() {} }, { emit: vi.fn(), on: vi.fn() });
    const attacker = mockChar(0, 0, 0);
    rb.apply(attacker, 'damage');
    const victim = mockChar(1, 0, 2);
    victim.forward = { x: 0, z: -1 };
    victim.takeDamage = vi.fn();
    cs.characters = [attacker, victim];
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(victim.takeDamage).toHaveBeenCalled();
    const dmg = victim.takeDamage.mock.calls[0][0];
    expect(dmg).toBeCloseTo(10 * 1.10);
  });

  it('lifesteal 升级使 CombatSystem._affixLeech 回血 lost×_runLifesteal', () => {
    const cs = new CombatSystem({ add() {}, remove() {} }, { emit: vi.fn(), on: vi.fn() });
    const a = mockChar(0);
    a.health.hp = 50; a.health.maxHp = 100;
    rb.apply(a, 'lifesteal');
    cs._affixLeech(a, 30);
    expect(a.health.hp).toBeCloseTo(53);
  });
});
