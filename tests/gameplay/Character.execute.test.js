// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true })
  }
}));

import * as THREE from 'three';
import { Character } from '../../src/gameplay/Character.js';
import { Health } from '../../src/gameplay/Health.js';
import { EV } from '../../src/core/constants/events.js';

const terrain = { heightAt: () => 0, slopeAt: () => 0, isWater: () => false };
const NOW = 1000;
const mkWeapon = () => ({ type: 'melee', range: 2.9, ready: true, createMesh: () => null, tick() {}, comboDamage: [10, 12, 15], comboKnock: [1, 1, 2], arc: 1.5, damage: 10 });

function mkChar(team = 1, hp = 100) {
  const c = new Character({ team, isLocal: false, maxHp: hp });
  c.setWeapons([mkWeapon()]);
  c.position.set(0, 0, 0);
  c.root = { position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: new THREE.Vector3(1,1,1), visible: true, add: vi.fn(), remove: vi.fn(), traverse: vi.fn() };
  return c;
}

function mkVictim(hpRatio) {
  const v = mkChar(1, 100);
  v.health.hp = Math.round(100 * hpRatio);
  v.forward = new THREE.Vector3(0, 0, 1);
  v._executing = 0;
  v._executingTarget = null;
  v.takeDamage = vi.fn();
  return v;
}

describe('Character execution', () => {
  it('canBeExecuted true when health.ratio < 0.2 and alive', () => {
    const v = mkVictim(0.15);
    expect(v.canBeExecuted).toBe(true);
  });

  it('canBeExecuted false when health.ratio >= 0.2', () => {
    const v = mkVictim(0.5);
    expect(v.canBeExecuted).toBe(false);
  });

  it('canBeExecuted false when dead', () => {
    const v = mkVictim(0.01);
    v.alive = false;
    expect(v.canBeExecuted).toBe(false);
  });

  it('canBeExecuted false at full HP', () => {
    const v = mkVictim(1.0);
    expect(v.canBeExecuted).toBe(false);
  });

  it('startExecute succeeds when target canBeExecuted', () => {
    const exec = mkChar(0);
    const victim = mkVictim(0.15);
    const result = exec.startExecute(victim);
    expect(result).toBe(true);
    expect(exec._executing).toBeGreaterThan(0);
    expect(exec._executingTarget).toBe(victim);
  });

  it('startExecute fails when target cannot be executed', () => {
    const exec = mkChar(0);
    const victim = mkVictim(0.5);
    const result = exec.startExecute(victim);
    expect(result).toBe(false);
    expect(exec._executing).toBe(0);
  });

  it('startExecute fails when already executing', () => {
    const exec = mkChar(0);
    exec._executing = 1.0;
    const victim = mkVictim(0.1);
    const result = exec.startExecute(victim);
    expect(result).toBe(false);
  });

  it('startExecute sets executing state on both attacker and victim', () => {
    const exec = mkChar(0);
    const victim = mkVictim(0.1);
    exec.startExecute(victim);
    expect(victim._executing).toBeGreaterThan(0);
    expect(victim._executingTarget).toBe(exec);
  });

  it('startExecute 成功时发射 COMBAT_EXECUTE 事件', () => {
    const exec = mkChar(0);
    const bus = { emit: vi.fn() };
    exec.setBus(bus);
    const victim = mkVictim(0.15);
    exec.startExecute(victim);
    expect(bus.emit).toHaveBeenCalledWith(EV.COMBAT_EXECUTE, expect.objectContaining({ char: exec, target: victim }));
  });

  it('_tickExecuting decrements timer', () => {
    const exec = mkChar(0);
    const victim = mkVictim(0.1);
    exec.startExecute(victim);
    const initTimer = exec._executing;
    exec.forward = new THREE.Vector3(0, 0, 1);
    exec.weaponPivot = { rotation: { z: 0 } };
    exec._tickExecuting(0.1, NOW);
    expect(exec._executing).toBeCloseTo(initTimer - 0.1, 2);
  });

  it('_tickExecuting deals 9999 damage when timer expires', () => {
    const exec = mkChar(0);
    const victim = mkVictim(0.1);
    exec.startExecute(victim);
    exec._executing = 0.05;
    exec.forward = new THREE.Vector3(0, 0, 1);
    exec.weaponPivot = { rotation: { z: 0 } };
    exec._tickExecuting(0.1, NOW);
    expect(victim.takeDamage).toHaveBeenCalledWith(9999, true, exec, NOW);
  });

  it('_tickExecuting does not damage already-dead victim', () => {
    const exec = mkChar(0);
    const victim = mkVictim(0.1);
    victim.alive = false;
    exec.startExecute(victim);
    exec._executing = 0.05;
    exec.forward = new THREE.Vector3(0, 0, 1);
    exec.weaponPivot = { rotation: { z: 0 } };
    exec._tickExecuting(0.1, NOW);
    expect(victim.takeDamage).not.toHaveBeenCalled();
  });
});
