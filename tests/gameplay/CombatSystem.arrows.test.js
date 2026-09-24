// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatSystem } from '../../src/gameplay/CombatSystem.js';

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => new (class { setAttribute() {} })() }
  )
}));

describe('CombatSystem 箭矢释放 _releaseArrow (P0-2)', () => {
  let cs, scene, bus;
  beforeEach(() => {
    bus = { emit: vi.fn() };
    scene = { add: vi.fn(), remove: vi.fn() };
    cs = new CombatSystem(scene, bus);
  });

  it('_releaseArrow 方法定义存在', () => {
    expect(typeof cs._releaseArrow).toBe('function');
  });

  it('_releaseArrow 从场景移除箭 mesh，不抛 TypeError', () => {
    const arrow = { mesh: { name: 'arrow' } };
    expect(() => cs._releaseArrow(arrow)).not.toThrow();
    expect(scene.remove).toHaveBeenCalledWith(arrow.mesh);
  });

  it('update 箭命中目标后调用 _releaseArrow 不抛异常', () => {
    cs.spawnHitFX = vi.fn();
    cs._emitHit = vi.fn();
    cs._affixApply = vi.fn(() => 10);
    cs._affixLeech = vi.fn();
    const victim = {
      alive: true, team: 1,
      position: { x: 0, y: 0, z: 0, distanceTo: () => 0.1, clone() { return this; } },
      capsule: { center: { x: 0, y: 0, z: 0 }, radius: 1, halfHeight: 1 },
      takeDamage: vi.fn(() => 10),
      health: { alive: true }
    };
    const attacker = { team: 0, weapon: { weaponClass: 'BOW' } };
    cs.characters = [victim];
    cs.arrows = [{ pos: { x: 0, y: 0, z: 0, addScaledVector() {}, copy() {}, distanceTo: () => 0.1 }, vel: { x: 0, y: 0, z: 0 }, life: 1, mesh: { position: { copy() {} }, lookAt() {} }, team: 0, attacker, damage: 10, charge: 0 }];
    const terrain = { heightAt: () => 0 };
    expect(() => cs.update(0.016, terrain, 1000)).not.toThrow();
  });
});
