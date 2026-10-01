// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: { noise: () => ({ isTexture: true }), rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }), brick: () => ({ isTexture: true }) }
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

describe('Character 攻击缓冲/连招取消 (C1-2)', () => {
  let c;
  beforeEach(() => {
    c = new Character({ team: 0 });
  });

  it('挥击前段（t < hitFrame）不可取消——tryAttack 返回 false', () => {
    c.weapons = [{ ready: true, type: 'melee', cooldown: 0.27, hitFrame: 0.35 }];
    c.weaponIdx = 0;
    c._attacking = true;
    c._anim = c._animDur; // t = 0
    expect(c.tryAttack({ characters: [] }, 1)).toBe(false);
  });

  it('命中帧后（t >= hitFrame）且武器就绪——tryAttack 成功取消后摇', () => {
    c.weapons = [{ ready: true, type: 'melee', cooldown: 0.27, hitFrame: 0.35 }];
    c.weaponIdx = 0;
    c._attacking = true;
    c._anim = c._animDur * 0.3; // t = 0.7 >= 0.35
    expect(c.tryAttack({ characters: [] }, 1)).toBe(true);
    expect(c._anim).toBe(c._animDur); // 新攻击重置 anim
  });

  it('命中帧后但武器未就绪（冷却中）——tryAttack 返回 false', () => {
    c.weapons = [{ ready: false, type: 'melee', cooldown: 1.2, hitFrame: 0.35 }];
    c.weaponIdx = 0;
    c._attacking = true;
    c._anim = c._animDur * 0.3; // t = 0.7 >= 0.35
    expect(c.tryAttack({ characters: [] }, 1)).toBe(false);
  });

  it('弓在攻击中不可取消后摇', () => {
    c.weapons = [{ ready: true, type: 'projectile', cooldown: 0.95, hitFrame: 0.35 }];
    c.weaponIdx = 0;
    c._attacking = true;
    c._anim = c._animDur * 0.3; // t = 0.7
    expect(c.tryAttack({ characters: [] }, 1)).toBe(false);
  });

  it('非攻击态且武器未就绪——tryAttack 返回 false', () => {
    c.weapons = [{ ready: false, type: 'melee', cooldown: 1.2 }];
    c.weaponIdx = 0;
    c._attacking = false;
    expect(c.tryAttack({ characters: [] }, 1)).toBe(false);
  });

  it('非攻击态且武器就绪——tryAttack 成功（基线）', () => {
    c.weapons = [{ ready: true, type: 'melee', cooldown: 0.27 }];
    c.weaponIdx = 0;
    c._attacking = false;
    expect(c.tryAttack({ characters: [] }, 1)).toBe(true);
  });
});
