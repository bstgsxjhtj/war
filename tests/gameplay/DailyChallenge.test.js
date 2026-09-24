import { DailyChallenge } from '../../src/gameplay/DailyChallenge.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

function fakeProg(score = 0) { return { score }; }

describe('DailyChallenge', () => {
  let d;
  beforeEach(() => {
    Math.random = vi.fn(() => 0);
    d = new DailyChallenge(fakeProg(0));
  });

  it('构造时生成3个挑战', () => {
    expect(d.challenges.length).toBe(3);
  });

  it('track 使挑战从未完成翻转到完成时 emit daily.completed（只发一次）', () => {
    const bus = { emit: vi.fn() };
    const dd = new DailyChallenge(fakeProg(0), bus);
    dd._data.challenges = [{ id: 'x1', desc: '测试', type: 'kills', target: 2, reward: 10 }];
    dd._data.progress = {};
    dd.track('kills');
    expect(bus.emit).not.toHaveBeenCalled();
    dd.track('kills');
    const calls = bus.emit.mock.calls.filter(c => c[0] === 'daily.completed');
    expect(calls.length).toBe(1);
    expect(calls[0][1]).toMatchObject({ id: 'x1', type: 'kills' });
    dd.track('kills');
    expect(bus.emit.mock.calls.filter(c => c[0] === 'daily.completed').length).toBe(1);
  });

  it('track 计数并返 changed', () => {
    const first = d.challenges[0];
    expect(d.track(first.type)).toBe(true);
    expect(d.challenges[0].progress).toBe(1);
  });

  it('track 满 target 后不再累加', () => {
    const first = d.challenges[0];
    for (let i = 0; i < first.target + 2; i++) d.track(first.type);
    expect(d.challenges[0].progress).toBe(first.target);
    expect(d.challenges[0].done).toBe(true);
  });

  it('allDone 在全部完成前为 false', () => {
    expect(d.allDone).toBe(false);
  });

  it('claim 未全完成返 0', () => {
    expect(d.claim()).toBe(0);
  });

  it('claim 全完成返总奖励并置 claimed', () => {
    for (const c of d.challenges) {
      for (let i = 0; i < c.target; i++) d.track(c.type);
    }
    expect(d.allDone).toBe(true);
    const total = d.challenges.reduce((s, c) => s + c.reward, 0);
    expect(d.claim()).toBe(total);
    expect(d.claim()).toBe(0);
  });

  it('resetSession 清空进度', () => {
    const first = d.challenges[0];
    d.track(first.type);
    d.resetSession();
    expect(d.challenges[0].progress).toBe(0);
  });

  it('POOL 含无尽和噩梦挑战类型', () => {
    const types = DailyChallenge.POOL.map(c => c.type);
    expect(types).toContain('endlessWave');
    expect(types).toContain('nightmareWin');
    expect(types).toContain('nightmareKills');
  });

  it('_regenerate 至少包含1个模式专属挑战', () => {
    const modeSpecific = d.challenges.filter(c => c.modeSpecific);
    expect(modeSpecific.length).toBeGreaterThanOrEqual(1);
  });

  it('track endlessWave 增量进度', () => {
    d._data.challenges = [{ id: 'ew10', desc: 'test', type: 'endlessWave', target: 10, reward: 100 }];
    d._data.progress = {};
    d.track('endlessWave');
    expect(d.challenges[0].progress).toBe(1);
  });

  it('track nightmareWin 完成时 done 为 true', () => {
    d._data.challenges = [{ id: 'nw', desc: 'test', type: 'nightmareWin', target: 1, reward: 200 }];
    d._data.progress = {};
    d.track('nightmareWin');
    expect(d.challenges[0].progress).toBe(1);
    expect(d.challenges[0].done).toBe(true);
  });

  it('track nightmareKills 增量进度', () => {
    d._data.challenges = [{ id: 'nk5', desc: 'test', type: 'nightmareKills', target: 5, reward: 150 }];
    d._data.progress = {};
    d.track('nightmareKills');
    d.track('nightmareKills');
    expect(d.challenges[0].progress).toBe(2);
  });
});
