// @vitest-environment jsdom
import { CombatSystem, COUNTER_MATRIX } from '../../src/gameplay/CombatSystem.js';
import { describe, it, expect, beforeEach } from 'vitest';

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
