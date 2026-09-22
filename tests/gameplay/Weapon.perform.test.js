import { describe, it, expect, vi } from 'vitest';
import { Weapon, AttackType } from '../../src/gameplay/Weapon.js';

describe('Weapon 基类 _perform 模板方法', () => {
  it('默认近战实现：调 combat.resolveMelee 并返回 MELEE', () => {
    const w = new Weapon({ name: '测试刀', damage: 10, range: 2, cooldown: 0.3, type: AttackType.MELEE });
    const combat = { resolveMelee: vi.fn() };
    const attacker = {};
    const opts = { combo: 1, now: 2.5 };
    const ret = w._perform(attacker, combat, opts);
    expect(combat.resolveMelee).toHaveBeenCalledWith(attacker, w, 1, 2.5);
    expect(ret).toEqual({ type: AttackType.MELEE });
  });

  it('opts.combo 缺省按 0 处理，opts.now 缺省按 0 处理', () => {
    const w = new Weapon({ name: '测试刀', damage: 10, range: 2, cooldown: 0.3, type: AttackType.MELEE });
    const combat = { resolveMelee: vi.fn() };
    w._perform({}, combat, {});
    expect(combat.resolveMelee).toHaveBeenCalledWith({}, w, 0, 0);
  });

  it('投射物子类覆写 _perform 不受影响（Bow 语义）', () => {
    class TestBow extends Weapon {
      constructor() { super({ name: '弓', damage: 5, range: 10, cooldown: 0.5, type: AttackType.PROJECTILE }); }
      _perform(attacker, combat, opts) {
        combat.spawnArrow(attacker, this, opts.charge ?? 1);
        return { type: AttackType.PROJECTILE };
      }
    }
    const w = new TestBow();
    const combat = { spawnArrow: vi.fn() };
    const ret = w._perform({}, combat, { charge: 0.5 });
    expect(combat.spawnArrow).toHaveBeenCalledWith({}, w, 0.5);
    expect(ret).toEqual({ type: AttackType.PROJECTILE });
  });
});
