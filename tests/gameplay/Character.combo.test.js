// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: { noise: () => ({ isTexture: true }), rough: () => ({ isTexture: true }) }
}));
vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(class { constructor() {} spawnBurst() {} spawn() {} update() {} }, { blood: () => ({ isTexture: true }) })
}));

import { Character } from '../../src/gameplay/Character.js';

function mkWeapon(cooldown, type = 'melee') {
  return { ready: true, type, cooldown };
}

describe('Character 连击窗口动态适配 (P1-3)', () => {
  let c;
  beforeEach(() => {
    c = new Character({ team: 0 });
  });

  it('慢武器(cooldown=1.2) 连击窗口扩展到 1.5', () => {
    c.weapons = [mkWeapon(1.2)];
    c.weaponIdx = 0;
    c.tryAttack({ characters: [] }, 1);
    expect(c.comboWindow).toBeCloseTo(1.5, 5);
    expect(c.comboTimer).toBeCloseTo(1.5, 5);
  });

  it('快武器(cooldown=0.27) 连击窗口保持最低 0.6', () => {
    c.weapons = [mkWeapon(0.27)];
    c.weaponIdx = 0;
    c.tryAttack({ characters: [] }, 1);
    expect(c.comboWindow).toBe(0.6);
  });

  it('Bow(projectile) 不修改连击窗口', () => {
    c.weapons = [mkWeapon(0.95, 'projectile')];
    c.weaponIdx = 0;
    const w0 = c.comboWindow;
    c.tryAttack({ characters: [] }, 1);
    expect(c.comboWindow).toBe(w0);
  });

  it('慢武器 comboTimer 在 0.7s 后仍 > 0（旧 0.6s 会过期）', () => {
    c.weapons = [mkWeapon(1.2)];
    c.weaponIdx = 0;
    c.tryAttack({ characters: [] }, 1);
    expect(c.comboCount).toBe(1);
    c.tickCombo(0.7);
    expect(c.comboCount).toBe(1);
    expect(c.comboTimer).toBeCloseTo(0.8, 5);
  });

  it('快武器 comboTimer 在 0.7s 后过期', () => {
    c.weapons = [mkWeapon(0.27)];
    c.weaponIdx = 0;
    c.tryAttack({ characters: [] }, 1);
    expect(c.comboCount).toBe(1);
    c.tickCombo(0.7);
    expect(c.comboCount).toBe(0);
  });
});
