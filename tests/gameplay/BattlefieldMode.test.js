import { describe, it, expect } from 'vitest';
import { BattlefieldMode } from '../../src/gameplay/BattlefieldMode.js';

describe('BattlefieldMode 波次→攻城串联', () => {
  it('初始为波次阶段，目标 4 波', () => {
    const m = new BattlefieldMode({});
    expect(m.name).toBe('战场');
    expect(m.phase).toBe('wave');
    expect(m.isSiege).toBe(false);
    expect(m.targetWave).toBe(4);
    expect(m.endless).toBe(false);
  });

  it('波次阶段沿用 WaveMode 布阵并递增波数', () => {
    const m = new BattlefieldMode({});
    const lay = m.spawnLayout();
    expect(m.wave).toBe(1);
    expect(lay.red.length).toBe(3);
    expect(lay.siege).toBeFalsy();
  });

  it('advanceToSiege 切到攻城阶段并返回城门守军布阵', () => {
    const m = new BattlefieldMode({});
    m.wave = 4;
    const lay = m.advanceToSiege();
    expect(m.phase).toBe('siege');
    expect(m.isSiege).toBe(true);
    expect(m.wave).toBe(5);
    expect(lay.siege).toBe(true);
    expect(lay.isBoss).toBe(true);
    expect(lay.red.length).toBeGreaterThanOrEqual(4);
    expect(lay.red[0].isBoss).toBe(true);
    // 守军列阵在城门（z≈31~34）一侧
    for (const r of lay.red) expect(r.z).toBeGreaterThan(25);
  });

  it('攻城阶段 spawnLayout 不再递增波数', () => {
    const m = new BattlefieldMode({});
    m.advanceToSiege();
    const before = m.wave;
    m.spawnLayout();
    expect(m.wave).toBe(before);
  });

  it('波次阶段不判胜负（红全灭也不胜）', () => {
    const m = new BattlefieldMode({});
    m.spawnLayout();
    expect(m.checkWin(true, false)).toBe(null);
    expect(m.checkWin(true, false, true)).toBe(null);
  });

  it('攻城阶段破城门取胜', () => {
    const m = new BattlefieldMode({});
    m.advanceToSiege();
    expect(m.checkWin(true, true, true)).toBe('blue');
    expect(m.checkWin(true, true, false)).toBe(null);
  });

  it('攻城阶段全歼守军取胜', () => {
    const m = new BattlefieldMode({});
    m.advanceToSiege();
    expect(m.checkWin(true, false, false)).toBe('blue');
  });

  it('蓝方阵亡任何阶段都判负', () => {
    const m = new BattlefieldMode({});
    expect(m.checkWin(false, true)).toBe('red');
    m.advanceToSiege();
    expect(m.checkWin(false, true, false)).toBe('red');
  });

  it('onKill 只在波次阶段扣减存活数', () => {
    const m = new BattlefieldMode({});
    m.spawnLayout();
    const n = m.alive;
    m.onKill();
    expect(m.alive).toBe(n - 1);
    m.advanceToSiege();
    m.alive = 5;
    m.onKill();
    expect(m.alive).toBe(5);
  });

  it('reset 回到波次阶段并清空进度', () => {
    const m = new BattlefieldMode({});
    m.advanceToSiege();
    m.modifier = { key: 'frenzy' };
    m.reset();
    expect(m.phase).toBe('wave');
    expect(m.wave).toBe(0);
    expect(m.alive).toBe(0);
    expect(m.modifier).toBe(null);
  });

  it('waveInfo 暴露阶段信息', () => {
    const m = new BattlefieldMode({});
    m.advanceToSiege();
    expect(m.waveInfo.isSiege).toBe(true);
    expect(m.waveInfo.target).toBe(4);
  });
});