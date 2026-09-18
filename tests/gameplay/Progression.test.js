import { Progression } from '../../src/gameplay/Progression.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('Progression', () => {
  let p;
  beforeEach(() => { p = new Progression(); });

  it('初始 score=0 段位新兵', () => {
    expect(p.score).toBe(0);
    expect(p.rank.name).toBe('新兵');
    expect(p.nextRank.name).toBe('步兵');
  });

  it('recordKill +25 分', () => {
    p.recordKill();
    expect(p.score).toBe(25);
    expect(p.kills).toBe(1);
  });

  it('recordWin +100 分并记 bestGrade/bestTime', () => {
    p.recordWin('A', 60);
    expect(p.score).toBe(100);
    expect(p.wins).toBe(1);
    expect(p.getStats().bestGrade).toBe('A');
    expect(p.getStats().bestTime).toBe(60);
  });

  it('recordWin 仅在更高评级时更新 bestGrade', () => {
    p.recordWin('B', 60);
    p.recordWin('A', 80);
    expect(p.getStats().bestGrade).toBe('A');
    p.recordWin('C', 50);
    expect(p.getStats().bestGrade).toBe('A');
  });

  it('addScore 累加', () => {
    p.addScore(50);
    p.addScore(25);
    expect(p.score).toBe(75);
  });

  it('_checkUnlocks 阈值：300 解锁 elite，1000 解锁 boss', () => {
    p.addScore(300);
    expect(p.unlocks.elite).toBe(true);
    expect(p.unlocks.boss).toBe(false);
    p.addScore(700);
    expect(p.unlocks.boss).toBe(true);
  });

  it('段位随分数递进', () => {
    p.addScore(100);
    expect(p.rank.name).toBe('步兵');
    p.addScore(200);
    expect(p.rank.name).toBe('老兵');
  });

  it('reset 清空', () => {
    p.addScore(500);
    p.reset();
    expect(p.score).toBe(0);
    expect(p.unlocks.elite).toBe(false);
  });
});
