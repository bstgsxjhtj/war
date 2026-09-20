import { CampaignMode } from '../../src/gameplay/CampaignMode.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('CampaignMode', () => {
  let c;
  beforeEach(() => { c = new CampaignMode({}); });

  it('初始 stage=0, name=战役, maxStages=10', () => {
    expect(c.stage).toBe(0);
    expect(c.name).toBe('战役');
    expect(c.maxStages).toBe(10);
  });

  it('currentStage 返回第1关', () => {
    expect(c.currentStage.name).toBe('渡桥遭遇');
    expect(c.currentStage.mapKey).toBe('bridge');
    expect(c.currentStage.objective).toBe('全灭');
    expect(c.currentStage.layout).toBe('环形');
    expect(c.currentStage.difficulty).toBe(1.0);
  });

  it('stageInfo 含 index/total/cleared', () => {
    const info = c.stageInfo;
    expect(info.index).toBe(0);
    expect(info.total).toBe(10);
  });

  it('checkWin 蓝死返 red', () => {
    expect(c.checkWin(false, true)).toBe('red');
  });

  it('checkWin 全灭红方返 blue（非攻城门关）', () => {
    expect(c.checkWin(true, false)).toBe('blue');
  });

  it('checkWin 攻城门关需 siegeGate.broken', () => {
    c.skipTo(2);
    expect(c.currentStage.objective).toBe('攻破城门');
    expect(c.checkWin(true, true, { broken: false })).toBe(null);
    expect(c.checkWin(true, true, { broken: true })).toBe('blue');
  });

  it('checkWin 护送目标到 goal 返 blue', () => {
    c.skipTo(6);
    expect(c.currentStage.objective).toBe('护送');
    const goal = { distanceTo: () => 3 };
    expect(c.checkWin(true, true, null, { escortTarget: { alive: true, pos: { distanceTo: () => 3 }, goal } })).toBe('blue');
    expect(c.checkWin(true, true, null, { escortTarget: { alive: true, pos: { distanceTo: () => 50 }, goal } })).toBe(null);
    expect(c.checkWin(true, true, null, { escortTarget: { alive: false } })).toBe('red');
  });

  it('checkWin 防御计时到 0 返 blue', () => {
    c.skipTo(8);
    expect(c.currentStage.objective).toBe('防御');
    expect(c.checkWin(true, true, null, { defenseTimer: 0 })).toBe('blue');
    expect(c.checkWin(true, true, null, { defenseTimer: 10 })).toBe(null);
  });

  it('checkWin 生存波次完成返 blue', () => {
    c.skipTo(7);
    expect(c.currentStage.objective).toBe('生存');
    expect(c.checkWin(true, true, null, { surviveWavesDone: true })).toBe('blue');
    expect(c.checkWin(true, true, null, { surviveWavesDone: false })).toBe(null);
  });

  it('checkWin Boss限时 超时返 red', () => {
    c.skipTo(9);
    expect(c.currentStage.objective).toBe('Boss限时');
    expect(c.checkWin(true, true, null, { boss: { alive: false } })).toBe('blue');
    expect(c.checkWin(true, true, null, { timeLimit: 0 })).toBe('red');
    expect(c.checkWin(true, true, null, { timeLimit: 30, boss: { alive: true } })).toBe(null);
  });

  it('spawnLayout 环形（第1关）red 敌数正确', () => {
    const l = c.spawnLayout();
    expect(l.mapKey).toBe('bridge');
    expect(l.weather).toBe('clear');
    expect(l.red.length).toBe(3);
    expect(l.difficulty).toBe(1.0);
  });

  it('spawnLayout 线阵（第4关）red 排成线', () => {
    c.skipTo(3);
    expect(c.currentStage.layout).toBe('线阵');
    const l = c.spawnLayout();
    expect(l.red.length).toBe(6);
    expect(l.red[0].x).toBe(160);
  });

  it('spawnLayout 方阵（第3关）red 方阵', () => {
    c.skipTo(2);
    expect(c.currentStage.layout).toBe('方阵');
    const l = c.spawnLayout();
    expect(l.red.length).toBe(5);
  });

  it('spawnLayout 伏击（第2关）red 随机散布', () => {
    c.skipTo(1);
    expect(c.currentStage.layout).toBe('伏击');
    const l = c.spawnLayout();
    expect(l.red.length).toBe(4);
  });

  it('onStageClear 递进并持久化 cleared', () => {
    expect(c.onStageClear()).toBe('next_stage');
    expect(c.stage).toBe(1);
    expect(c.cleared).toBe(1);
    const c2 = new CampaignMode({});
    expect(c2.cleared).toBe(1);
  });

  it('onStageClear 末关返 campaign_complete 并回 0', () => {
    c.skipTo(9);
    expect(c.onStageClear()).toBe('campaign_complete');
    expect(c.stage).toBe(0);
    expect(c.cleared).toBe(10);
  });

  it('onTick 增援触发 spawnReinforce', () => {
    c.skipTo(3);
    let reinforced = 0;
    c.onTick(0.1, { redAlive: 3, spawnReinforce: (n) => { reinforced = n; } });
    expect(reinforced).toBeGreaterThan(0);
    expect(c._reinforced).toBe(true);
  });

  it('onTick Boss 阶段触发 enterPhase', () => {
    c.skipTo(4);
    let phased = 0;
    c.onTick(0.1, { boss: { alive: true, health: { hp: 30, maxHp: 100 }, enterPhase: (p) => { phased = p; } } });
    expect(phased).toBe(2);
  });

  it('reset 与 skipTo', () => {
    c.skipTo(3);
    expect(c.stage).toBe(3);
    c.reset();
    expect(c.stage).toBe(0);
    c.skipTo(99);
    expect(c.stage).toBe(c.maxStages - 1);
  });
});
