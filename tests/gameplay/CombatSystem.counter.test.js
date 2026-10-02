// @vitest-environment jsdom
import { CombatSystem, COUNTER_MATRIX } from '../../src/gameplay/CombatSystem.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeW(cls) { return { weaponClass: cls }; }

describe('CombatSystem._counterMul', () => {
  let cs;
  beforeEach(() => {
    cs = Object.create(CombatSystem.prototype);
    cs._counterMatrix = COUNTER_MATRIX;
  });

  it('HEAVY vs SHIELD = 1.8', () => {
    expect(cs._counterMul(makeW('HEAVY'), makeW('SHIELD'))).toBe(1.8);
  });
  it('SPEAR vs SHIELD = 1.5', () => {
    expect(cs._counterMul(makeW('SPEAR'), makeW('SHIELD'))).toBe(1.5);
  });
  it('SHIELD vs HEAVY = 1.3', () => {
    expect(cs._counterMul(makeW('SHIELD'), makeW('HEAVY'))).toBe(1.3);
  });
  it('SWORD vs HEAVY = 1.2', () => {
    expect(cs._counterMul(makeW('SWORD'), makeW('HEAVY'))).toBe(1.2);
  });
  it('无克制组合返回 1', () => {
    expect(cs._counterMul(makeW('SWORD'), makeW('SWORD'))).toBe(1);
  });
  it('缺 weaponClass 返回 1', () => {
    expect(cs._counterMul(null, makeW('SHIELD'))).toBe(1);
    expect(cs._counterMul(makeW('HEAVY'), null)).toBe(1);
    expect(cs._counterMul({}, {})).toBe(1);
  });
});

describe('CombatSystem.createDamageNumber 克制变色', () => {
  let cs;
  beforeEach(() => {
    const ctx = { clearRect: vi.fn(), fillText: vi.fn(), strokeText: vi.fn() };
    cs = Object.create(CombatSystem.prototype);
    cs._numSprites = [{ spr: { visible: false, position: { copy: vi.fn() }, scale: { set: vi.fn() } }, life: 0, vy: 0, ctx, tex: { needsUpdate: false } }];
  });

  it('非克制命中使用默认色', () => {
    cs.createDamageNumber({ x: 0, y: 1, z: 0 }, 20, false);
    expect(cs._numSprites[0].ctx.fillStyle).toBe('#ffe070');
  });

  it('克制命中使用青色', () => {
    cs.createDamageNumber({ x: 0, y: 1, z: 0 }, 20, true);
    expect(cs._numSprites[0].ctx.fillStyle).toBe('#66ddff');
  });

  it('高伤非克制使用红色', () => {
    cs.createDamageNumber({ x: 0, y: 1, z: 0 }, 50, false);
    expect(cs._numSprites[0].ctx.fillStyle).toBe('#ff5533');
  });
});
