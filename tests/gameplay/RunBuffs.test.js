import { RunBuffs } from '../../src/gameplay/RunBuffs.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('RunBuffs', () => {
  let rb, player;
  beforeEach(() => {
    rb = new RunBuffs();
    player = {
      speed: 6,
      health: { maxHp: 100, hp: 60 },
      stamina: { max: 100, cur: 50 },
    };
  });

  it('UPGRADES 含 6 个以上升级', () => {
    expect(RunBuffs.UPGRADES.length).toBeGreaterThanOrEqual(6);
  });

  it('roll3 返回 3 个不重复升级', () => {
    const picks = rb.roll3();
    expect(picks.length).toBe(3);
    const ids = picks.map(p => p.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('apply maxhp 增加最大生命 50 并回血', () => {
    rb.apply(player, 'maxhp');
    expect(player.health.maxHp).toBe(150);
    expect(player.health.hp).toBe(110);
  });

  it('apply speed 增加移速 20%', () => {
    rb.apply(player, 'speed');
    expect(player.speed).toBeCloseTo(7.2);
  });

  it('apply stamina 增加最大耐力 30', () => {
    rb.apply(player, 'stamina');
    expect(player.stamina.max).toBe(130);
    expect(player.stamina.cur).toBe(80);
  });

  it('apply heal 回复满血', () => {
    rb.apply(player, 'heal');
    expect(player.health.hp).toBe(100);
  });

  it('apply damage 设置 _runDmgMul', () => {
    rb.apply(player, 'damage');
    expect(player._runDmgMul).toBeCloseTo(1.10);
  });

  it('apply lifesteal 设置 _runLifesteal', () => {
    rb.apply(player, 'lifesteal');
    expect(player._runLifesteal).toBeCloseTo(0.10);
  });

  it('apply 记录已选升级', () => {
    rb.apply(player, 'maxhp');
    rb.apply(player, 'speed');
    expect(rb.picked).toEqual(['maxhp', 'speed']);
  });

  it('apply 同一升级可叠加', () => {
    rb.apply(player, 'maxhp');
    rb.apply(player, 'maxhp');
    expect(player.health.maxHp).toBe(200);
  });

  it('apply 未知 id 不报错', () => {
    expect(() => rb.apply(player, 'nonexistent')).not.toThrow();
  });

  it('F2: apply regen 设置 _runRegen', () => {
    rb.apply(player, 'regen');
    expect(player._runRegen).toBe(3);
  });

  it('F2: apply atkspd 设置 _runAtkSpdMul', () => {
    rb.apply(player, 'atkspd');
    expect(player._runAtkSpdMul).toBeCloseTo(0.88);
  });

  it('F2: apply dodgecd 设置 _runDodgeCdMul', () => {
    rb.apply(player, 'dodgecd');
    expect(player._runDodgeCdMul).toBeCloseTo(0.75);
  });

  it('F2: apply armor 设置 _runArmorMul', () => {
    rb.apply(player, 'armor');
    expect(player._runArmorMul).toBeCloseTo(0.88);
  });

  it('F2: apply crit 设置 _runCritChance', () => {
    rb.apply(player, 'crit');
    expect(player._runCritChance).toBeCloseTo(0.12);
  });

  it('F2: apply execdmg 设置 _runExecBonus', () => {
    rb.apply(player, 'execdmg');
    expect(player._runExecBonus).toBeCloseTo(0.08);
  });

  it('F2: apply counterdmg 设置 _runCounterMul', () => {
    rb.apply(player, 'counterdmg');
    expect(player._runCounterMul).toBeCloseTo(1.20);
  });
});
