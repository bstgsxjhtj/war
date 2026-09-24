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

describe('WaveMode 无尽修饰词', () => {
  it('MODIFIERS 定义至少 5 种修饰词', () => {
    expect(WaveMode.MODIFIERS.length).toBeGreaterThanOrEqual(5);
    for (const m of WaveMode.MODIFIERS) {
      expect(m.key).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.desc).toBeTruthy();
    }
  });

  it('endless 构造时预选 nextModifier（预告）', () => {
    const w = new WaveMode({}, true);
    expect(w.nextModifier).not.toBeNull();
    expect(w.modifier).toBeNull();
  });

  it('非 endless 模式无修饰词', () => {
    const w = new WaveMode({});
    expect(w.nextModifier).toBeNull();
    w.spawnLayout();
    expect(w.modifier).toBeNull();
  });

  it('endless 第3波激活修饰词', () => {
    const w = new WaveMode({}, true);
    for (let i = 0; i < 3; i++) w.spawnLayout();
    expect(w.wave).toBe(3);
    expect(w.modifier).not.toBeNull();
  });

  it('endless 前2波无修饰词', () => {
    const w = new WaveMode({}, true);
    w.spawnLayout();
    expect(w.modifier).toBeNull();
    w.spawnLayout();
    expect(w.modifier).toBeNull();
  });

  it('endless 修饰词在波次间持续（第4波仍为第3波的修饰词）', () => {
    const w = new WaveMode({}, true);
    for (let i = 0; i < 3; i++) w.spawnLayout();
    const mod3 = w.modifier;
    w.spawnLayout();
    expect(w.modifier).toBe(mod3);
  });

  it('endless 第6波切换为新修饰词（与第3波不同）', () => {
    const w = new WaveMode({}, true);
    for (let i = 0; i < 3; i++) w.spawnLayout();
    const mod3Key = w.modifier.key;
    for (let i = 0; i < 3; i++) w.spawnLayout();
    expect(w.modifier.key).not.toBe(mod3Key);
  });

  it('spawnLayout 返回 modifier 与 nextModifier', () => {
    const w = new WaveMode({}, true);
    for (let i = 0; i < 3; i++) w.spawnLayout();
    const lay = w.spawnLayout();
    expect(lay).toHaveProperty('modifier');
    expect(lay).toHaveProperty('nextModifier');
  });

  it('countMul 修饰词增加敌人数量', () => {
    const w = new WaveMode({}, true);
    const swarm = WaveMode.MODIFIERS.find(m => m.countMul);
    expect(swarm).toBeTruthy();
    w.modifier = swarm;
    w.wave = 0;
    const lay = w.spawnLayout();
    const baseCount = Math.min(12, 2 + Math.floor(1 * 1.5));
    expect(lay.red.length).toBe(Math.min(12, Math.round(baseCount * swarm.countMul)));
  });
});

describe('WaveMode 无尽里程碑奖励', () => {
  beforeEach(() => { localStorage.clear(); });

  it('非 endless 模式 checkMilestone 返回 null', () => {
    const w = new WaveMode({});
    w.wave = 5;
    expect(w.checkMilestone()).toBeNull();
  });

  it('endless 非5倍数波 checkMilestone 返回 null', () => {
    const w = new WaveMode({}, true);
    w.wave = 3;
    expect(w.checkMilestone()).toBeNull();
  });

  it('endless 第5波 返回里程碑奖励（基础分）', () => {
    const w = new WaveMode({}, true);
    w.wave = 5;
    const m = w.checkMilestone();
    expect(m).not.toBeNull();
    expect(m.wave).toBe(5);
    expect(m.baseReward).toBe(50);
    expect(m.total).toBeGreaterThanOrEqual(50);
  });

  it('endless 破纪录时额外奖励 + isRecord=true', () => {
    WaveMode.saveBest(3);
    const w = new WaveMode({}, true);
    w.wave = 5;
    const m = w.checkMilestone();
    expect(m.isRecord).toBe(true);
    expect(m.recordBonus).toBeGreaterThan(0);
    expect(m.total).toBe(m.baseReward + m.recordBonus);
  });

  it('endless 破纪录时保存新最佳波数', () => {
    WaveMode.saveBest(3);
    const w = new WaveMode({}, true);
    w.wave = 5;
    w.checkMilestone();
    expect(WaveMode.loadBest()).toBe(5);
  });

  it('endless 未破纪录时 isRecord=false 无额外奖励', () => {
    WaveMode.saveBest(10);
    const w = new WaveMode({}, true);
    w.wave = 5;
    const m = w.checkMilestone();
    expect(m.isRecord).toBe(false);
    expect(m.recordBonus).toBe(0);
    expect(m.total).toBe(m.baseReward);
  });

  it('endless 第10波 奖励高于第5波', () => {
    const w5 = new WaveMode({}, true); w5.wave = 5;
    const m5 = w5.checkMilestone();
    localStorage.clear();
    const w10 = new WaveMode({}, true); w10.wave = 10;
    const m10 = w10.checkMilestone();
    expect(m10.baseReward).toBeGreaterThan(m5.baseReward);
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
