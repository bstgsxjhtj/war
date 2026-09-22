// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CombatSystem } from '../../src/gameplay/CombatSystem.js';

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => new (class { setAttribute() {} })() }
  )
}));

function mkChar(team, x, z, opts = {}) {
  return {
    alive: true, team,
    position: new THREE.Vector3(x, 0, z),
    forward: new THREE.Vector3(0, 0, 1),
    weapon: { weaponClass: 'SWORD', damage: 10, affixes: [null, null], damageFor: () => 10, speedFor: () => 40 },
    health: { alive: true, hp: 100, maxHp: 100 },
    takeDamage: vi.fn(() => 10),
    _curVel: { addScaledVector() {} },
    capsule: { center: new THREE.Vector3(x, 1.3, z), radius: 0.5, halfHeight: 0.8 },
    vy: 0, _launchRot: 0, _hurt: 0,
    ...opts
  };
}

describe('CombatSystem 大招与 Boss 投射物', () => {
  let cs, bus, scene;
  beforeEach(() => {
    bus = { emit: vi.fn() };
    scene = { add: vi.fn(), remove: vi.fn() };
    cs = new CombatSystem(scene, bus);
    cs._emitHit = vi.fn();
    cs.spawnHitFX = vi.fn();
    cs.createDamageNumber = vi.fn();
  });

  it('ultimateMelee 命中范围内所有敌人（360°）', () => {
    const attacker = mkChar(0, 0, 0);
    const front = mkChar(1, 0, 3);
    const back = mkChar(1, 0, -3);
    const far = mkChar(1, 0, 20);
    cs.characters = [attacker, front, back, far];
    cs.ultimateMelee(attacker, Math.PI * 2, 5, 6);
    expect(front.takeDamage).toHaveBeenCalled();
    expect(back.takeDamage).toHaveBeenCalled();
    expect(far.takeDamage).not.toHaveBeenCalled();
  });

  it('ultimateMelee 击杀发 combat.kill', () => {
    const attacker = mkChar(0, 0, 0);
    const victim = mkChar(1, 2, 0, {
      takeDamage: vi.fn(function () { victim.health.alive = false; return 999; })
    });
    cs.characters = [attacker, victim];
    cs.ultimateMelee(attacker, Math.PI * 2, 5, 6);
    expect(bus.emit).toHaveBeenCalledWith('combat.kill', expect.objectContaining({ victim }));
  });

  it('ultimateLine 命中直线路径上的敌人', () => {
    const attacker = mkChar(0, 0, 0);
    const onLine = mkChar(1, 0.5, 4);
    const offLine = mkChar(1, 5, 4);
    cs.characters = [attacker, onLine, offLine];
    const dir = new THREE.Vector3(0, 0, 1);
    cs.ultimateLine(attacker.position, dir, 8, 50, attacker);
    expect(onLine.takeDamage).toHaveBeenCalled();
    expect(offLine.takeDamage).not.toHaveBeenCalled();
  });

  it('spawnPierceArrow 支持 opts 覆写 origin/dir/damage（Boss 技能）', () => {
    const boss = mkChar(1, 10, 10);
    const dir = new THREE.Vector3(1, 0, 0);
    cs.spawnPierceArrow(boss, null, 1, { origin: boss.position, dir, damage: 50 });
    expect(cs.arrows.length).toBe(1);
    const a = cs.arrows[0];
    expect(a.damage).toBe(50);
    expect(a.team).toBe(1);
    expect(a.vel.x).toBeGreaterThan(0);
    expect(a.vel.z).toBeCloseTo(0, 1);
  });

  it('spawnPierceArrow 默认走 attacker.forward 与 weapon 数值', () => {
    const a = mkChar(0, 0, 0);
    cs.spawnPierceArrow(a, a.weapon, 1);
    expect(cs.arrows.length).toBe(1);
    expect(cs.arrows[0].vel.z).toBeGreaterThan(0);
  });
});
