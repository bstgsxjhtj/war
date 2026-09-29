// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }), brick: () => ({ isTexture: true })
  }
}));

import * as THREE from 'three';
import { CavalryEnemy } from '../../src/gameplay/Cavalry.js';
import { Character } from '../../src/gameplay/Character.js';

const terrain = { heightAt: () => 0, slopeAt: () => 0, isWater: () => false };
const NOW = 0;
const mkWeapon = (type = 'melee', range = 2.9) => ({ type, range, ready: true, createMesh: () => null, tick() {} });

function mkEnemy(team, x, z, hpRatio = 1) {
  return {
    alive: true, team,
    position: new THREE.Vector3(x, 0, z),
    health: { ratio: hpRatio, hp: 100, maxHp: 100, alive: true, damage: vi.fn(() => 10) },
    takeDamage: vi.fn(),
    root: { position: new THREE.Vector3(x, 0, z) },
  };
}

describe('CavalryEnemy charge', () => {
  let cav, superUpdate;

  beforeEach(() => {
    superUpdate = vi.spyOn(Character.prototype, 'update').mockImplementation(() => {});
    cav = new CavalryEnemy({ team: 1 });
    cav.setWeapons([mkWeapon()]);
    cav.tryAttack = vi.fn();
    cav.setMove = vi.fn();
    cav.setSprint = vi.fn();
    cav.setLook = vi.fn();
  });
  afterEach(() => superUpdate.mockRestore());

  it('has charge state idle and cooldown 0 on init', () => {
    expect(cav._chargeState).toBe('idle');
    expect(cav._chargeCd).toBe(0);
    expect(cav._chargeTimer).toBe(0);
  });

  it('startCharge sets windup state, timer, and cooldown', () => {
    cav._startCharge();
    expect(cav._chargeState).toBe('windup');
    expect(cav._chargeTimer).toBe(0.5);
    expect(cav._chargeCd).toBeGreaterThan(0);
  });

  it('windup transitions to charging after timer expires', () => {
    cav._startCharge();
    cav._tickCharge(0.6, terrain, {}, [], NOW);
    expect(cav._chargeState).toBe('charging');
    expect(cav._chargeTimer).toBeCloseTo(1.0, 1);
  });

  it('charging moves forward at sprint', () => {
    cav._startCharge();
    cav._tickCharge(0.6, terrain, {}, [], NOW);
    cav._tickCharge(0.01, terrain, {}, [], NOW);
    expect(cav.setMove).toHaveBeenCalledWith(1, 0);
    expect(cav.setSprint).toHaveBeenCalledWith(true);
  });

  it('charging tramples nearby enemies for heavy damage', () => {
    const enemy = mkEnemy(0, 1, 0);
    cav._startCharge();
    cav._tickCharge(0.6, terrain, {}, [], NOW);
    cav._tickCharge(0.01, terrain, {}, [enemy], NOW);
    expect(enemy.takeDamage).toHaveBeenCalledWith(40, true, cav, NOW);
  });

  it('charging does not trample same enemy twice', () => {
    const enemy = mkEnemy(0, 1, 0);
    cav._startCharge();
    cav._tickCharge(0.6, terrain, {}, [], NOW);
    cav._tickCharge(0.01, terrain, {}, [enemy], NOW);
    cav._tickCharge(0.01, terrain, {}, [enemy], NOW);
    expect(enemy.takeDamage).toHaveBeenCalledTimes(1);
  });

  it('charging transitions to recovery after duration', () => {
    cav._startCharge();
    cav._tickCharge(0.6, terrain, {}, [], NOW);
    cav._tickCharge(1.1, terrain, {}, [], NOW);
    expect(cav._chargeState).toBe('recovery');
    expect(cav._chargeTimer).toBeCloseTo(0.5, 1);
  });

  it('recovery transitions to idle after timer', () => {
    cav._startCharge();
    cav._tickCharge(0.6, terrain, {}, [], NOW);
    cav._tickCharge(1.1, terrain, {}, [], NOW);
    cav._tickCharge(0.6, terrain, {}, [], NOW);
    expect(cav._chargeState).toBe('idle');
  });

  it('cooldown prevents immediate re-trigger', () => {
    cav._startCharge();
    cav._tickCharge(0.6, terrain, {}, [], NOW);
    cav._tickCharge(1.1, terrain, {}, [], NOW);
    cav._tickCharge(0.6, terrain, {}, [], NOW);
    expect(cav._chargeState).toBe('idle');
    expect(cav._chargeCd).toBeGreaterThan(0);
    const target = mkEnemy(0, 15, 0);
    cav._maybeStartCharge([target]);
    expect(cav._chargeState).toBe('idle');
  });

  it('maybeStartCharge triggers when target in range and cooldown ready', () => {
    const target = mkEnemy(0, 15, 0);
    cav._maybeStartCharge([target]);
    expect(cav._chargeState).toBe('windup');
  });

  it('maybeStartCharge does not trigger when target too far', () => {
    const target = mkEnemy(0, 100, 0);
    cav._maybeStartCharge([target]);
    expect(cav._chargeState).toBe('idle');
  });

  it('maybeStartCharge does not trigger when no target', () => {
    cav._maybeStartCharge([]);
    expect(cav._chargeState).toBe('idle');
  });

  it('update with charge state active calls Character.update not AIController.update', () => {
    cav._startCharge();
    cav.update(0.01, terrain, { characters: [] }, [], NOW);
    expect(superUpdate).toHaveBeenCalled();
  });

  it('update with charge active does trample on nearby enemy', () => {
    const enemy = mkEnemy(0, 1, 0);
    cav._startCharge();
    cav._tickCharge(0.6, terrain, {}, [], NOW);
    cav.update(0.01, terrain, { characters: [cav, enemy] }, [enemy], NOW);
    expect(enemy.takeDamage).toHaveBeenCalledWith(40, true, cav, NOW);
  });
});
