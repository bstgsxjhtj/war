import { Achievements, ACHIEVEMENTS } from '../../src/gameplay/Achievements.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Achievements', () => {
  let a;
  beforeEach(() => { a = new Achievements(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('daily_10/daily_30 由 daily.completed 事件驱动（而非 daily.update）', () => {
    const d10 = ACHIEVEMENTS.find(x => x.id === 'daily_10');
    const d30 = ACHIEVEMENTS.find(x => x.id === 'daily_30');
    expect(d10.event).toBe('daily.completed');
    expect(d30.event).toBe('daily.completed');
    a.check('daily.update', {});
    expect(a.progress('daily_10')).toBe(0);
    a.check('daily.completed', {});
    expect(a.progress('daily_10')).toBe(1);
  });

  it('check 进度更新：check 一次 progress(kill_1)=1', () => {
    a.check('combat.kill', {});
    expect(a.progress('kill_1')).toBe(1);
  });

  it('达标解锁：kill_1 target=1 check 后 isUnlocked=true', () => {
    a.check('combat.kill', {});
    expect(a.isUnlocked('kill_1')).toBe(true);
  });

  it('奖励触发：解锁 kill_100 emit achievement.unlock 含 name+reward', () => {
    const emit = vi.fn();
    a.setBus({ emit });
    for (let i = 0; i < 100; i++) a.check('combat.kill', {});
    const call = emit.mock.calls.find(c => c[1] && c[1].id === 'kill_100');
    expect(call).toBeTruthy();
    expect(call[0]).toBe('achievement.unlock');
    expect(call[1].name).toBe('百人斩');
    expect(call[1].reward).toEqual({ skillPoint: 2, affix: ['锋锐', 2] });
  });

  it('isUnlocked 未达标 false', () => {
    a.check('combat.kill', {});
    expect(a.isUnlocked('kill_50')).toBe(false);
  });

  it('不重复解锁：已解锁成就再 check 不重复 emit', () => {
    const emit = vi.fn();
    a.setBus({ emit });
    a.check('combat.kill', {});
    emit.mockClear();
    a.check('combat.kill', {});
    const calls = emit.mock.calls.filter(c => c[1] && c[1].id === 'kill_1');
    expect(calls.length).toBe(0);
  });

  it('progress 超目标仍只解锁一次', () => {
    const emit = vi.fn();
    a.setBus({ emit });
    for (let i = 0; i < 5; i++) a.check('combat.kill', {});
    const calls = emit.mock.calls.filter(c => c[1] && c[1].id === 'kill_1');
    expect(calls.length).toBe(1);
  });

  it('持久化：_save 后新实例 _load 还原', () => {
    a.check('combat.kill', {});
    a.check('combo.tier', {});
    a._save();
    const a2 = new Achievements();
    expect(a2.progress('kill_1')).toBe(1);
    expect(a2.isUnlocked('kill_1')).toBe(true);
    expect(a2.progress('combo_10')).toBe(1);
    expect(a2.isUnlocked('combo_10')).toBe(true);
  });
});
