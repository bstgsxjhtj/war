// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: { noise: () => ({ isTexture: true }), rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }), brick: () => ({ isTexture: true }) }
}));

import { Character } from '../../src/gameplay/Character.js';
import { POSTURE } from '../../src/core/constants/balance.js';

function makeChar(team = 0) {
  const c = new Character({ team });
  c.setBus({ emit: vi.fn(), on: vi.fn() });
  c.position.set(0, 0, 0);
  c.forward.set(0, 0, 1);
  c.health.hp = 100; c.health.maxHp = 100;
  return c;
}
const terrain = { heightAt: () => 0, isWater: () => false };

describe('架势条系统（Posture）', () => {
  let victim, attacker;
  beforeEach(() => {
    victim = makeChar(0);
    attacker = makeChar(1);
    attacker.position.set(0, 0, 2);
    attacker.forward.set(0, 0, -1);
  });

  it('初始架势为 0 且未崩防', () => {
    expect(victim._posture).toBe(0);
    expect(victim._postureBroken).toBe(0);
  });

  it('普通格挡：受击者 +BLOCK_TAKEN，攻击者 +BLOCK_DEALT', () => {
    victim.tryBlock();
    victim._perfectWindow = 0;
    victim.takeDamage(30, false, attacker, 1);
    expect(victim._posture).toBe(POSTURE.BLOCK_TAKEN);
    expect(attacker._posture).toBe(POSTURE.BLOCK_DEALT);
  });

  it('完美格挡：攻击者 +PARRY_DEALT，受击者不加', () => {
    victim.tryBlock();
    victim._perfectWindow = 0.1;
    victim.takeDamage(30, false, attacker, 1);
    expect(victim._posture).toBe(0);
    expect(attacker._posture).toBe(POSTURE.PARRY_DEALT);
  });

  it('未格挡受击：+HIT_TAKEN', () => {
    victim.takeDamage(30, false, attacker, 1);
    expect(victim._posture).toBe(POSTURE.HIT_TAKEN);
  });

  it('架势满则崩防，开启处决窗口', () => {
    victim._posture = POSTURE.MAX - 1;
    victim.takeDamage(30, false, null, 1);
    expect(victim._postureBroken).toBeGreaterThan(0);
    expect(victim.canBeExecuted).toBe(true);
  });

  it('tryAttack 增加自身架势', () => {
    victim._attacking = false;
    if (victim.weapon) victim.weapon._timer = 0;
    const ok = victim.tryAttack({ characters: [] }, 1);
    if (ok) expect(victim._posture).toBe(POSTURE.ATTACK_LIGHT);
  });

  it('不格挡/不攻击且延迟过后架势恢复', () => {
    victim._posture = 50;
    victim._postureRegenDelay = 0.6;
    victim.update(0.7, terrain, { characters: [] }, 0);
    expect(victim._posture).toBeLessThan(50);
  });

  it('崩防倒计时结束后清零', () => {
    victim._postureBroken = POSTURE.BROKEN_STUN;
    victim.update(POSTURE.BROKEN_STUN + 0.1, terrain, { characters: [] }, 0);
    expect(victim._postureBroken).toBe(0);
  });
});
