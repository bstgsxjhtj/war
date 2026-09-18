import { Weapon, AttackType } from '../../src/gameplay/Weapon.js';
import { describe, it, expect } from 'vitest';

describe('Weapon', () => {
  it('构造存储字段并设默认 weaponClass', () => {
    const w = new Weapon({ name: '刀', damage: 20, range: 2, cooldown: 0.4, type: AttackType.MELEE });
    expect(w.name).toBe('刀');
    expect(w.damage).toBe(20);
    expect(w.range).toBe(2);
    expect(w.cooldown).toBe(0.4);
    expect(w.type).toBe(AttackType.MELEE);
    expect(w.weaponClass).toBe('SWORD');
    expect(w.armorPierce).toBe(false);
    expect(w.shieldBlock).toBe(false);
  });

  it('windup 默认 0', () => {
    const w = new Weapon({ name: 'x', damage: 1, range: 1, cooldown: 1, type: 'melee' });
    expect(w.windup).toBe(0);
  });

  it('ready 在 tick 前为 true，tick 后随 cooldown 转 false 再回 true', () => {
    const w = new Weapon({ name: 'x', damage: 1, range: 1, cooldown: 0.5, type: 'melee' });
    expect(w.ready).toBe(true);
    w._timer = 0.5;
    expect(w.ready).toBe(false);
    w.tick(0.5);
    expect(w.ready).toBe(true);
  });

  it('_perform 抛未实现错误', () => {
    const w = new Weapon({ name: 'x', damage: 1, range: 1, cooldown: 1, type: 'melee' });
    expect(() => w._perform({}, {}, {})).toThrow();
  });
});
