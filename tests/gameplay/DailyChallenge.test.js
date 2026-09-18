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
});
