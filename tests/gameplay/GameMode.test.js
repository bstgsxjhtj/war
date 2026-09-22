import { describe, it, expect } from 'vitest';
import { GameMode, Deathmatch, Domination, SiegeMode } from '../../src/gameplay/GameMode.js';

describe('GameMode', () => {
  it('基类契约：spawnLayout 返回空蓝红，checkWin 返回 null', () => {
    const g = new GameMode(null);
    expect(g.spawnLayout()).toEqual({ blue: [], red: [] });
    expect(g.checkWin({})).toBeNull();
  });

  it('Deathmatch 全灭判定：红全灭蓝胜，蓝全灭红胜', () => {
    const d = new Deathmatch(null);
    expect(d.checkWin(1, 0)).toBe('blue');
    expect(d.checkWin(0, 1)).toBe('red');
    expect(d.checkWin(1, 1)).toBeNull();
  });

  it('Domination 积分达标判定胜负', () => {
    const d = new Domination(null);
    d.scoreB = 100;
    expect(d.checkWin()).toBe('blue');
    d.scoreB = 0; d.scoreR = 100;
    expect(d.checkWin()).toBe('red');
  });

  it('SiegeMode spawnLayout 蓝 1 红 4', () => {
    const s = new SiegeMode(null);
    const l = s.spawnLayout();
    expect(l.blue).toHaveLength(1);
    expect(l.red).toHaveLength(4);
  });
});
