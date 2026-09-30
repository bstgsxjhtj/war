import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DifficultyAssist } from '../../src/gameplay/DifficultyAssist.js';
import { AIManager } from '../../src/gameplay/AIManager.js';

function mkManager(level) {
  return {
    _level: level,
    setDifficulty(d) { this._level = d; },
    difficulty() { return { easy: 1, normal: 2, hard: 3 }[this._level]; }
  };
}

describe('DifficultyAssist', () => {
  let mgr, assist, flash;

  beforeEach(() => {
    mgr = mkManager('hard');
    flash = vi.fn();
    assist = new DifficultyAssist(mgr, flash);
  });

  it('初始不干预难度', () => {
    expect(mgr._level).toBe('hard');
    expect(flash).not.toHaveBeenCalled();
  });

  it('单次死亡不降档', () => {
    assist.onPlayerDeath();
    expect(mgr._level).toBe('hard');
  });

  it('连续两次死亡降一档并提示', () => {
    assist.onPlayerDeath();
    assist.onPlayerDeath();
    expect(mgr._level).toBe('normal');
    expect(flash).toHaveBeenCalledWith(expect.stringContaining('辅助'));
  });

  it('非连续死亡不降档', () => {
    assist.onPlayerDeath();
    assist.onPlayerWin();
    assist.onPlayerDeath();
    expect(mgr._level).toBe('hard');
  });

  it('easy 是下限不再降', () => {
    mgr = mkManager('easy');
    assist = new DifficultyAssist(mgr, flash);
    assist.onPlayerDeath();
    assist.onPlayerDeath();
    expect(mgr._level).toBe('easy');
  });

  it('获胜后逐步恢复原难度', () => {
    assist.onPlayerDeath();
    assist.onPlayerDeath();
    expect(mgr._level).toBe('normal');
    assist.onPlayerWin();
    expect(mgr._level).toBe('hard');
  });

  it('恢复到原难度后不再升', () => {
    assist.onPlayerDeath();
    assist.onPlayerDeath();
    assist.onPlayerWin();
    assist.onPlayerWin();
    expect(mgr._level).toBe('hard');
  });

  it('setBaseLevel 重设基准', () => {
    assist.setBaseLevel('easy');
    assist.onPlayerDeath();
    assist.onPlayerDeath();
    expect(mgr._level).toBe('easy');
  });

  it('与真实 AIManager 集成：连续死亡降档并提示（回归 _level 缺失）', () => {
    const real = new AIManager(null);
    real.setDifficulty('hard');
    const notify = vi.fn();
    const a = new DifficultyAssist(real, notify);
    a.onPlayerDeath();
    a.onPlayerDeath();
    expect(real.currentLevel()).toBe('normal');
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('辅助'));
    a.onPlayerWin();
    expect(real.currentLevel()).toBe('hard');
  });
});
