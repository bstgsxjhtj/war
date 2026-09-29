// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }), brick: () => ({ isTexture: true })
  }
}));

import * as THREE from 'three';
import { AIController } from '../../src/gameplay/AIController.js';
import { Character } from '../../src/gameplay/Character.js';
import { EV } from '../../src/core/constants/events.js';

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

  it('近战范围内进入 attack 并进入前摇（不立即出手）', () => {
    ai.setMove = vi.fn();
    const enemy = mkEnemy(0, 2, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._state).toBe('attack');
    expect(ai._windupTimer).toBeGreaterThan(0);
    expect(ai._telegraph.active).toBe(true);
    expect(ai.tryAttack).not.toHaveBeenCalled();
  });

  it('前摇结束后才出手并隐藏 telegraph', () => {
    ai.setMove = vi.fn();
    const enemy = mkEnemy(0, 2, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    ai.update(ai._windupDur, terrain, combat, [enemy], NOW);
    expect(ai.tryAttack).toHaveBeenCalledWith(combat, 1);
    expect(ai._windupTimer).toBe(0);
    expect(ai._telegraph.active).toBe(false);
  });

  it('前摇期间保持静止不重复触发', () => {
    ai.setMove = vi.fn();
    const enemy = mkEnemy(0, 2, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    const timerAfterStart = ai._windupTimer;
    ai.update(0.05, terrain, combat, [enemy], NOW);
    expect(ai.setMove).toHaveBeenCalledWith(0, 0);
    expect(ai._windupTimer).toBeCloseTo(timerAfterStart - 0.05, 4);
    expect(ai.tryAttack).not.toHaveBeenCalled();
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

describe('AIController 精英技能', () => {
  let ai, superUpdate, superTakeDamage, randSpy;
  beforeEach(() => {
    superUpdate = vi.spyOn(Character.prototype, 'update').mockImplementation(() => {});
    superTakeDamage = vi.spyOn(Character.prototype, 'takeDamage').mockImplementation(function(amount) { return amount; });
    ai = new AIController({ team: 1 });
    ai.setWeapons([mkWeapon()]);
    ai.tryAttack = vi.fn();
  });
  afterEach(() => { superUpdate.mockRestore(); superTakeDamage.mockRestore(); if (randSpy) randSpy.mockRestore(); });

  it('blockCounter 精英格挡后必定反击', () => {
    ai._isElite = true; ai._eliteSkill = 'blockCounter';
    ai._blockTimer = 0.4;
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    ai.takeDamage(10, false, null, 0);
    expect(ai._counterTimer).toBe(0.3);
  });

  it('非精英格挡后 random >= 0.5 不反击', () => {
    ai._blockTimer = 0.4;
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.6);
    ai.takeDamage(10, false, null, 0);
    expect(ai._counterTimer).toBe(0);
  });

  it('dodgeStrike 精英闪避后获得反击窗口', () => {
    ai._isElite = true; ai._eliteSkill = 'dodgeStrike';
    ai._aiManager = { difficulty: () => ({ dodgeChance: 1, blockChance: 0, reactTime: 0, maxHpMul: 1, reinforceCd: 1 }) };
    ai._focusTimer = 0;
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    ai.setMove = vi.fn(); ai.setSprint = vi.fn(); ai.setLook = vi.fn();
    const enemy = mkEnemy(0, 2, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._counterTimer).toBe(0.3);
  });

  it('非精英闪避后不获得反击窗口', () => {
    ai._aiManager = { difficulty: () => ({ dodgeChance: 1, blockChance: 0, reactTime: 0, maxHpMul: 1, reinforceCd: 1 }) };
    ai._focusTimer = 0;
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    ai.setMove = vi.fn(); ai.setSprint = vi.fn(); ai.setLook = vi.fn();
    const enemy = mkEnemy(0, 2, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._counterTimer).toBe(0);
  });
});

describe('AIController 格挡触发 (P0-3)', () => {
  let ai, superUpdate, randSpy;
  beforeEach(() => {
    superUpdate = vi.spyOn(Character.prototype, 'update').mockImplementation(() => {});
    ai = new AIController({ team: 1 });
    ai.tryAttack = vi.fn();
    ai.setMove = vi.fn(); ai.setSprint = vi.fn(); ai.setLook = vi.fn();
  });
  afterEach(() => { superUpdate.mockRestore(); if (randSpy) randSpy.mockRestore(); });

  it('SHIELD 武器 AI 攻击范围内举盾(_blockTimer>0)', () => {
    ai.setWeapons([{ type: 'melee', weaponClass: 'SHIELD', range: 2.9, ready: true, createMesh: () => null }]);
    ai._aiManager = { difficulty: () => ({ blockChance: 1, dodgeChance: 0, reactTime: 0, maxHpMul: 1, reinforceCd: 1 }) };
    ai._focusTimer = 0; ai._blockCd = 0;
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = mkEnemy(0, 2, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._blockTimer).toBeGreaterThan(0);
  });

  it('非 SHIELD 武器 AI 不举盾', () => {
    ai.setWeapons([{ type: 'melee', weaponClass: 'SWORD', range: 2.9, ready: true, createMesh: () => null }]);
    ai._aiManager = { difficulty: () => ({ blockChance: 1, dodgeChance: 0, reactTime: 0, maxHpMul: 1, reinforceCd: 1 }) };
    ai._focusTimer = 0; ai._blockCd = 0;
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const enemy = mkEnemy(0, 2, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._blockTimer).toBe(0);
  });
});

describe('AIController 噩梦词条 (P0-1)', () => {
  let ai, superUpdate, superTakeDamage;
  beforeEach(() => {
    superUpdate = vi.spyOn(Character.prototype, 'update').mockImplementation(() => {});
    superTakeDamage = vi.spyOn(Character.prototype, 'takeDamage').mockImplementation(function (amount) { return amount; });
    ai = new AIController({ team: 1 });
  });
  afterEach(() => { superUpdate.mockRestore(); superTakeDamage.mockRestore(); });

  it('setEnemyMods 存储并 hasMod 查询', () => {
    ai.setEnemyMods(['swift', 'ironhide']);
    expect(ai.hasMod('swift')).toBe(true);
    expect(ai.hasMod('ironhide')).toBe(true);
    expect(ai.hasMod('reflect')).toBe(false);
  });

  it('setEnemyMods(null) 清除词条', () => {
    ai.setEnemyMods(['swift']);
    ai.setEnemyMods(null);
    expect(ai.hasMod('swift')).toBe(false);
    expect(ai._enemyMods).toBeNull();
  });

  it('ironhide 受伤 ×0.75', () => {
    ai.setEnemyMods(['ironhide']);
    const attacker = mkEnemy(0, 1, 0);
    ai.takeDamage(100, false, attacker, 0);
    expect(superTakeDamage).toHaveBeenCalledWith(75, false, attacker, 0);
  });

  it('reflect 反弹 10% 给攻击者', () => {
    ai.setEnemyMods(['reflect']);
    const attacker = { alive: true, team: 0, position: new THREE.Vector3(1, 0, 0), takeDamage: vi.fn(() => 0) };
    ai.takeDamage(100, false, attacker, 0);
    expect(attacker.takeDamage).toHaveBeenCalledWith(10, false, ai, 0);
  });

  it('reflect lost=0 时不反弹', () => {
    ai.setEnemyMods(['reflect']);
    superTakeDamage.mockReturnValue(0);
    const attacker = { alive: true, team: 0, position: new THREE.Vector3(1, 0, 0), takeDamage: vi.fn(() => 0) };
    ai.takeDamage(100, false, attacker, 0);
    expect(attacker.takeDamage).not.toHaveBeenCalled();
  });

  it('reflect 攻击者死亡不反弹', () => {
    ai.setEnemyMods(['reflect']);
    const attacker = { alive: false, team: 0, position: new THREE.Vector3(1, 0, 0), takeDamage: vi.fn(() => 0) };
    ai.takeDamage(100, false, attacker, 0);
    expect(attacker.takeDamage).not.toHaveBeenCalled();
  });

  it('ironhide + reflect 叠加：先减伤再按减伤后量反弹', () => {
    ai.setEnemyMods(['ironhide', 'reflect']);
    const attacker = { alive: true, team: 0, position: new THREE.Vector3(1, 0, 0), takeDamage: vi.fn(() => 0) };
    ai.takeDamage(100, false, attacker, 0);
    expect(superTakeDamage).toHaveBeenCalledWith(75, false, attacker, 0);
    expect(attacker.takeDamage).toHaveBeenCalledWith(7.5, false, ai, 0);
  });

  it('无词条时行为不变', () => {
    const attacker = { alive: true, team: 0, position: new THREE.Vector3(1, 0, 0), takeDamage: vi.fn(() => 0) };
    ai.takeDamage(100, false, attacker, 0);
    expect(superTakeDamage).toHaveBeenCalledWith(100, false, attacker, 0);
    expect(attacker.takeDamage).not.toHaveBeenCalled();
  });

  it('reflect 双方均持有时不递归', () => {
    ai.setEnemyMods(['reflect']);
    const attacker = new AIController({ team: 0 });
    attacker.setEnemyMods(['reflect']);
    const attackerSpy = vi.spyOn(attacker, 'takeDamage');
    ai.takeDamage(100, false, attacker, 0);
    expect(attackerSpy).toHaveBeenCalledTimes(1);
    expect(attackerSpy.mock.calls[0][0]).toBe(10);
    attackerSpy.mockRestore();
  });
});

describe('AIController 闪避 i 帧 (P0-2)', () => {
  let ai, superUpdate, superTakeDamage;
  beforeEach(() => {
    superUpdate = vi.spyOn(Character.prototype, 'update').mockImplementation(() => {});
    superTakeDamage = vi.spyOn(Character.prototype, 'takeDamage').mockImplementation(function (amount) { return amount; });
    ai = new AIController({ team: 1 });
  });
  afterEach(() => { superUpdate.mockRestore(); superTakeDamage.mockRestore(); });

  it('闪避中(_dodgeTimer>0)受伤为 0 且不调 super', () => {
    ai._dodgeTimer = 0.3;
    const attacker = mkEnemy(0, 1, 0);
    const lost = ai.takeDamage(100, false, attacker, 0);
    expect(lost).toBe(0);
    expect(superTakeDamage).not.toHaveBeenCalled();
  });

  it('闪避结束(_dodgeTimer=0)正常受伤', () => {
    ai._dodgeTimer = 0;
    const attacker = mkEnemy(0, 1, 0);
    const lost = ai.takeDamage(100, false, attacker, 0);
    expect(lost).toBe(100);
    expect(superTakeDamage).toHaveBeenCalledWith(100, false, attacker, 0);
  });

  it('闪避 i 帧跳过格挡减伤与反击', () => {
    ai._dodgeTimer = 0.3;
    ai._blockTimer = 0.4;
    ai._isElite = true; ai._eliteSkill = 'blockCounter';
    const attacker = mkEnemy(0, 1, 0);
    const lost = ai.takeDamage(100, false, attacker, 0);
    expect(lost).toBe(0);
    expect(ai._counterTimer).toBe(0);
  });

  it('闪避中不触发 reflect（无伤害可反弹）', () => {
    ai.setEnemyMods(['reflect']);
    ai._dodgeTimer = 0.3;
    const attacker = { alive: true, team: 0, position: new THREE.Vector3(1, 0, 0), takeDamage: vi.fn(() => 0) };
    ai.takeDamage(100, false, attacker, 0);
    expect(attacker.takeDamage).not.toHaveBeenCalled();
  });

  it('闪避中不触发 ironhide 减伤链', () => {
    ai.setEnemyMods(['ironhide']);
    ai._dodgeTimer = 0.3;
    const attacker = mkEnemy(0, 1, 0);
    const lost = ai.takeDamage(100, false, attacker, 0);
    expect(lost).toBe(0);
    expect(superTakeDamage).not.toHaveBeenCalled();
  });
});

describe('AIController 涌现行为（P3-2：连续被完美格挡后变招）', () => {
  let ai, superUpdate, bus;
  beforeEach(() => {
    superUpdate = vi.spyOn(Character.prototype, 'update').mockImplementation(() => {});
    ai = new AIController({ team: 1 });
    ai.setWeapons([mkWeapon()]);
    ai.tryAttack = vi.fn();
    bus = { emit: vi.fn() };
    ai._bus = bus;
  });
  afterEach(() => superUpdate.mockRestore());

  it('_wasPerfectBlocked 标记被消费时计数 +1', () => {
    ai._wasPerfectBlocked = true;
    ai.setMove = vi.fn(); ai.setSprint = vi.fn();
    ai.update(0.016, terrain, combat, [mkEnemy(0, 3, 0)], NOW);
    expect(ai._perfectBlockCount).toBe(1);
    expect(ai._wasPerfectBlocked).toBe(false);
  });

  it('连续 2 次被完美格挡后触发变招：进入适应撤退 + 立即叫援军', () => {
    ai.setMove = vi.fn(); ai.setSprint = vi.fn(); ai.setLook = vi.fn();
    ai._wasPerfectBlocked = true;
    ai.update(0.016, terrain, combat, [mkEnemy(0, 3, 0)], NOW);
    ai._wasPerfectBlocked = true;
    ai.update(0.016, terrain, combat, [mkEnemy(0, 3, 0)], NOW);
    expect(ai._adaptRetreat).toBeGreaterThan(0);
    expect(bus.emit).toHaveBeenCalledWith(EV.AI_CALLREINFORCE, expect.objectContaining({ team: 1 }));
    expect(ai._perfectBlockCount).toBe(0);
  });

  it('适应撤退期间 AI 远离目标而非攻击（state=retreat，setMove 朝远离方向）', () => {
    ai._adaptRetreat = 1.0;
    ai.setMove = vi.fn(); ai.setSprint = vi.fn(); ai.setLook = vi.fn();
    const enemy = mkEnemy(0, 2, 0);
    ai.update(0.016, terrain, combat, [enemy], NOW);
    expect(ai._state).toBe('retreat');
    expect(ai._adaptRetreat).toBeCloseTo(1.0 - 0.016, 4);
    expect(ai.tryAttack).not.toHaveBeenCalled();
  });

  it('完美格挡计数 4 秒无新增则衰减归零', () => {
    ai._perfectBlockCount = 1;
    ai._perfectBlockDecay = 4;
    ai.setMove = vi.fn(); ai.setSprint = vi.fn();
    ai.update(4.01, terrain, combat, [mkEnemy(0, 3, 0)], NOW);
    expect(ai._perfectBlockCount).toBe(0);
  });

  it('低血量逃窜优先于适应撤退（HP retreat 分支先于 adapt retreat 执行）', () => {
    ai._adaptRetreat = 2.0;
    ai.health.hp = ai.health.maxHp * 0.2;
    ai.setMove = vi.fn(); ai.setSprint = vi.fn(); ai.setLook = vi.fn();
    ai.update(0.016, terrain, combat, [mkEnemy(0, 3, 0)], NOW);
    expect(ai._state).toBe('retreat');
  });
});
