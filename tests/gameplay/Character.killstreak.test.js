// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: { noise: () => ({ isTexture: true }), rough: () => ({ isTexture: true }) }
}));
vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(class { constructor() {} spawnBurst() {} spawn() {} update() {} }, { blood: () => ({ isTexture: true }) })
}));

import { Character } from '../../src/gameplay/Character.js';

describe('Character 连杀奖励', () => {
  let c;
  beforeEach(() => {
    c = new Character({ team: 0 });
  });

  it('0 连杀无加成', () => {
    const b = c.killstreakBuffs();
    expect(b.dmgMul).toBe(1);
    expect(b.cdMul).toBe(1);
    expect(b.lifesteal).toBe(0);
  });

  it('3 连杀 +10% 伤害', () => {
    c._killstreak = 3;
    const b = c.killstreakBuffs();
    expect(b.dmgMul).toBeCloseTo(1.1);
    expect(b.cdMul).toBe(1);
    expect(b.lifesteal).toBe(0);
  });

  it('5 连杀 +20% 伤害 + -20% 冷却', () => {
    c._killstreak = 5;
    const b = c.killstreakBuffs();
    expect(b.dmgMul).toBeCloseTo(1.2);
    expect(b.cdMul).toBeCloseTo(0.8);
    expect(b.lifesteal).toBe(0);
  });

  it('7 连杀 +30% 伤害 + -20% 冷却 + 5% 吸血', () => {
    c._killstreak = 7;
    const b = c.killstreakBuffs();
    expect(b.dmgMul).toBeCloseTo(1.3);
    expect(b.cdMul).toBeCloseTo(0.8);
    expect(b.lifesteal).toBeCloseTo(0.05);
  });

  it('10 连杀封顶于 7 杀档', () => {
    c._killstreak = 10;
    const b = c.killstreakBuffs();
    expect(b.dmgMul).toBeCloseTo(1.3);
    expect(b.lifesteal).toBeCloseTo(0.05);
  });
});
