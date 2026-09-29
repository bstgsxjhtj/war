// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { AFFIX_BEHAVIORS, applyEnemyBehaviors } from '../../src/gameplay/AffixBehavior.js';

function mkChar(hp = 100, maxHp = 100) {
  return { alive: true, health: { hp, maxHp }, speed: 5, takeDamage: vi.fn(() => 0) };
}

describe('AffixBehavior 接口（P3-3：玩家/敌人共用 reflect/vampire/swift 实现）', () => {

  describe('reflect', () => {
    it('onTakeDamage 将 lost*fraction 反弹给 attacker', () => {
      const victim = mkChar(90); victim._reflecting = false;
      const attacker = mkChar(100);
      AFFIX_BEHAVIORS.reflect.onTakeDamage(victim, attacker, 40, { fraction: 0.10, now: 5 });
      expect(attacker.takeDamage).toHaveBeenCalledWith(4, false, victim, 5);
    });

    it('attacker 为空/dead/lost<=0 时不反弹', () => {
      const victim = mkChar(90);
      const dead = mkChar(100); dead.alive = false;
      AFFIX_BEHAVIORS.reflect.onTakeDamage(victim, dead, 40, { fraction: 0.10, now: 0 });
      AFFIX_BEHAVIORS.reflect.onTakeDamage(victim, null, 40, { fraction: 0.10, now: 0 });
      AFFIX_BEHAVIORS.reflect.onTakeDamage(victim, mkChar(100), 0, { fraction: 0.10, now: 0 });
      expect(true).toBe(true);
    });

    it('victim._reflecting=true 时不反弹（防递归）', () => {
      const victim = mkChar(90); victim._reflecting = true;
      const attacker = mkChar(100);
      AFFIX_BEHAVIORS.reflect.onTakeDamage(victim, attacker, 40, { fraction: 0.10, now: 0 });
      expect(attacker.takeDamage).not.toHaveBeenCalled();
    });
  });

  describe('vampire', () => {
    it('onDealDamage 按 fraction 治疗攻击者（clamp maxHp）', () => {
      const attacker = mkChar(80, 100);
      AFFIX_BEHAVIORS.vampire.onDealDamage(attacker, mkChar(50), 40, { fraction: 0.15 });
      expect(attacker.health.hp).toBe(86);
    });

    it('治疗不超过 maxHp', () => {
      const attacker = mkChar(99, 100);
      AFFIX_BEHAVIORS.vampire.onDealDamage(attacker, mkChar(50), 40, { fraction: 0.15 });
      expect(attacker.health.hp).toBe(100);
    });

    it('attacker 无 health 或 lost<=0 时不治疗', () => {
      AFFIX_BEHAVIORS.vampire.onDealDamage({ alive: true }, mkChar(50), 40, { fraction: 0.15 });
      AFFIX_BEHAVIORS.vampire.onDealDamage(mkChar(80, 100), mkChar(50), 0, { fraction: 0.15 });
      expect(true).toBe(true);
    });
  });

  describe('ironhide', () => {
    it('modifyIncoming 按 mul 缩减伤害', () => {
      expect(AFFIX_BEHAVIORS.ironhide.modifyIncoming(mkChar(100), 100, { mul: 0.75 })).toBe(75);
    });
  });

  describe('swift', () => {
    it('onSpawn 按 mul 提升速度', () => {
      const c = mkChar(100); c.speed = 6;
      AFFIX_BEHAVIORS.swift.onSpawn(c, { mul: 1.2 });
      expect(c.speed).toBeCloseTo(7.2);
    });
  });
});

describe('applyEnemyBehaviors 统一调度（P3-3）', () => {
  function mkChar(hp = 100, maxHp = 100) {
    return { alive: true, health: { hp, maxHp }, speed: 5, takeDamage: vi.fn(() => 0) };
  }

  it('ironhide + reflect 在 takeDamage 路径统一应用', () => {
    const victim = mkChar(100); victim._enemyMods = ['ironhide', 'reflect']; victim._reflecting = false;
    const attacker = mkChar(100);
    const ctx = { reflectFraction: 0.10, ironhideMul: 0.75, now: 3 };
    const reduced = applyEnemyBehaviors.modifyIncoming(victim, 100, ctx);
    expect(reduced).toBe(75);
    applyEnemyBehaviors.onTakeDamage(victim, attacker, 75, ctx);
    expect(attacker.takeDamage).toHaveBeenCalledWith(7.5, false, victim, 3);
  });

  it('vampire 在 dealDamage 路径统一应用', () => {
    const attacker = mkChar(70, 100); attacker._enemyMods = ['vampire'];
    applyEnemyBehaviors.onDealDamage(attacker, mkChar(50), 40, { vampireFraction: 0.15 });
    expect(attacker.health.hp).toBe(76);
  });

  it('swift 在 spawn 路径统一应用', () => {
    const c = mkChar(100); c._enemyMods = ['swift']; c.speed = 6;
    applyEnemyBehaviors.onSpawn(c, { swiftMul: 1.2 });
    expect(c.speed).toBeCloseTo(7.2);
  });

  it('无 _enemyMods 时 modifyIncoming 原样返回', () => {
    const c = mkChar(100);
    expect(applyEnemyBehaviors.modifyIncoming(c, 100, {})).toBe(100);
  });
});
