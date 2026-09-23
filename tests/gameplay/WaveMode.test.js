import { WaveMode } from '../../src/gameplay/WaveMode.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('WaveMode', () => {
  it('初始 wave=0', () => {
    const w = new WaveMode({});
    expect(w.wave).toBe(0);
    expect(w.targetWave).toBe(10);
  });

  it('spawnLayout 递增 wave 并返 layout', () => {
    const w = new WaveMode({});
    const lay = w.spawnLayout();
    expect(w.wave).toBe(1);
    expect(lay.wave).toBe(1);
    expect(lay.red.length).toBe(3);
    expect(lay.blue.length).toBe(1);
  });

  it('每5波出 Boss', () => {
    const w = new WaveMode({});
    for (let i = 0; i < 4; i++) w.spawnLayout();
    const lay = w.spawnLayout();
    expect(w.wave).toBe(5);
    expect(lay.isBoss).toBe(true);
  });

  it('checkWin 蓝死返 red', () => {
    const w = new WaveMode({});
    expect(w.checkWin(false, true)).toBe('red');
  });

  it('checkWin 红死但未达目标返 null', () => {
    const w = new WaveMode({});
    w.spawnLayout();
    expect(w.checkWin(true, false)).toBe(null);
  });

  it('checkWin 红死且达目标波返 blue', () => {
    const w = new WaveMode({});
    w.wave = 10;
    expect(w.checkWin(true, false)).toBe('blue');
  });

  it('onKill 递减 alive 不为负', () => {
    const w = new WaveMode({});
    w.alive = 2;
    w.onKill();
    expect(w.alive).toBe(1);
    w.onKill();
    w.onKill();
    expect(w.alive).toBe(0);
  });
});

describe('WaveMode endless', () => {
  it('endless 模式 name 无尽 targetWave Infinity', () => {
    const w = new WaveMode({}, true);
    expect(w.name).toBe('无尽');
    expect(w.endless).toBe(true);
    expect(w.targetWave).toBe(Infinity);
  });

  it('endless 模式 checkWin 永不返回 blue', () => {
    const w = new WaveMode({}, true);
    w.wave = 100;
    expect(w.checkWin(true, false)).toBe(null);
  });

  it('endless 模式蓝死仍返 red', () => {
    const w = new WaveMode({}, true);
    expect(w.checkWin(false, true)).toBe('red');
  });

  it('endless 模式敌人数量更多', () => {
    const w = new WaveMode({}, true);
    for (let i = 0; i < 5; i++) w.spawnLayout();
    expect(w.wave).toBe(5);
    const lay = w.spawnLayout();
    expect(lay.red.length).toBeGreaterThanOrEqual(7);
  });
});

describe('WaveMode best score', () => {
  beforeEach(() => { localStorage.clear(); });

  it('loadBest 初始为 0', () => {
    expect(WaveMode.loadBest()).toBe(0);
  });

  it('saveBest 保存最高波数', () => {
    WaveMode.saveBest(5);
    expect(WaveMode.loadBest()).toBe(5);
  });

  it('saveBest 仅保存更高值', () => {
    WaveMode.saveBest(10);
    WaveMode.saveBest(3);
    expect(WaveMode.loadBest()).toBe(10);
  });

  it('saveBest 0 不覆盖已有值', () => {
    WaveMode.saveBest(5);
    WaveMode.saveBest(0);
    expect(WaveMode.loadBest()).toBe(5);
  });
});
