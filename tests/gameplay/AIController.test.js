// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true })
  }
}));

import * as THREE from 'three';
import { AIController } from '../../src/gameplay/AIController.js';
import { Character } from '../../src/gameplay/Character.js';

const terrain = { heightAt: () => 0, slopeAt: () => 0 };
const combat = {};
const NOW = 0;

function mkEnemy(team, x, z, hpRatio = 1) {
  return {
    alive: true, team,
    position: new THREE.Vector3(x, 0, z),
    health: { ratio: hpRatio },
  };
}

const mkWeapon = (type = 'melee', range = 2.9) => ({ type, range, ready: true, createMesh: () => null });

describe('AIController 决策', () => {
  let ai, superUpdate;
  beforeEach(() => {
    superUpdate = vi.spyOn(Character.prototype, 'update').mockImplementation(() => {});
    ai = new AIController({ team: 1 });
    ai.setWeapons([mkWeapon()]);
    ai.tryAttack = vi.fn();
  });
  afterEach(() => superUpdate.mockRestore());

  it('构造尊重 passive/maxHp 选项', () => {
    const dummy = new AIController({ team: 1, passive: true, maxHp: 500 });
    expect(dummy._passive).toBe(true);
    expect(dummy.health.maxHp).toBe(500);
  });

  it('passive 假人不移动不索敌', () => {
    const dummy = new AIController({ team: 1, passive: true });
    dummy.setMove = vi.fn(); dummy.setSprint = vi.fn();
    dummy.update(0.016, terrain, combat, [mkEnemy(0, 1, 1)], NOW);
    expect(dummy.setMove).toHaveBeenCalledWith(0, 0);
    expect(dummy.tryAttack).toBeUndefined;
  });

  it('无敌人时巡逻：朝巡逻点移动', () => {
    ai.setMove = vi.fn();
    ai._patrolTarget.set(10, 0, 0);
    ai._retargetTimer = 5;
    ai.update(0.016, terrain, combat, [], NOW);
    expect(ai._state).toBe('patrol');
    expect(ai.setMove).toHaveBeenCalledWith(1, 0);
  });

  it('远距离索敌进入 chase', () => {
    ai.setMove = vi.fn(); ai.setSprint = vi.fn();
    const enemy = mkEnemy(0, 50, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._state).toBe('chase');
    expect(ai.setMove).toHaveBeenCalledWith(1, 0);
    expect(ai.setSprint).toHaveBeenCalledWith(true);
  });

  it('近战范围内进入 attack 并出手', () => {
    ai.setMove = vi.fn();
    const enemy = mkEnemy(0, 2, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._state).toBe('attack');
    expect(ai.tryAttack).toHaveBeenCalledWith(combat, 1);
  });

  it('血量<30% 撤退：远离最近敌人', () => {
    ai.health.hp = ai.health.maxHp * 0.2;
    ai.setMove = vi.fn(); ai.setSprint = vi.fn(); ai.setLook = vi.fn();
    const enemy = mkEnemy(0, 3, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._state).toBe('retreat');
    expect(ai.setSprint).toHaveBeenCalledWith(true);
    // 撤退方向应远离敌人（敌人在 +x，应向 -x 看）
    expect(ai.setLook).toHaveBeenCalledWith(Math.atan2(-1, 0));
  });

  it('弓兵近距离后撤', () => {
    ai.setWeapons([mkWeapon('projectile', 40)]);
    ai.setMove = vi.fn(); ai.setSprint = vi.fn();
    const enemy = mkEnemy(0, 5, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._state).toBe('retreat');
    expect(ai.setSprint).toHaveBeenCalledWith(true);
  });

  it('焦点目标优先选残血敌人', () => {
    const full = mkEnemy(0, 3, 0, 1);
    const weak = mkEnemy(0, 8, 0, 0.2);
    ai.update(0.016, terrain, combat, [full, weak], NOW);
    expect(ai._focusTarget).toBe(weak);
  });

  it('死亡后不再决策', () => {
    ai.alive = false;
    ai.setMove = vi.fn();
    ai.update(0.016, terrain, combat, [mkEnemy(0, 1, 0)], NOW);
    expect(ai.setMove).not.toHaveBeenCalled();
    expect(superUpdate).toHaveBeenCalled();
  });
});

describe('AIController 投石机争夺', () => {
  let ai, superUpdate;
  beforeEach(() => {
    superUpdate = vi.spyOn(Character.prototype, 'update').mockImplementation(() => {});
    ai = new AIController({ team: 1 });
    ai.setWeapons([mkWeapon()]);
    ai.tryAttack = vi.fn();
  });
  afterEach(() => superUpdate.mockRestore());

  it('setSiegeTarget 设置目标克隆', () => {
    const pos = new THREE.Vector3(20, 0, 30);
    ai.setSiegeTarget(pos);
    expect(ai._siegeTarget).not.toBeNull();
    expect(ai._siegeTarget.x).toBe(20);
    pos.x = 999;
    expect(ai._siegeTarget.x).toBe(20);
  });

  it('setSiegeTarget(null) 清除目标', () => {
    ai.setSiegeTarget(new THREE.Vector3(20, 0, 30));
    ai.setSiegeTarget(null);
    expect(ai._siegeTarget).toBeNull();
  });

  it('有投石机目标时朝目标移动（无敌人）', () => {
    ai.setMove = vi.fn(); ai.setSprint = vi.fn(); ai.setLook = vi.fn();
    ai.setSiegeTarget(new THREE.Vector3(20, 0, 30));
    ai.update(0.016, terrain, combat, [], NOW);
    expect(ai._state).toBe('patrol');
    expect(ai.setMove).toHaveBeenCalledWith(1, 0);
    expect(ai.setSprint).toHaveBeenCalledWith(true);
  });

  it('到达投石机目标后清除目标', () => {
    ai.setMove = vi.fn();
    ai.setSiegeTarget(new THREE.Vector3(1, 0, 0));
    ai.update(0.016, terrain, combat, [], NOW);
    expect(ai._siegeTarget).toBeNull();
  });

  it('有投石机目标但有敌人时仍优先战斗', () => {
    ai.setMove = vi.fn(); ai.setSprint = vi.fn();
    ai.setSiegeTarget(new THREE.Vector3(20, 0, 30));
    const enemy = mkEnemy(0, 2, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._state).toBe('attack');
    expect(ai._siegeTarget).not.toBeNull();
  });
});
