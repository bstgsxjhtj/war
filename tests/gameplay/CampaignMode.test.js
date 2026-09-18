import { CampaignMode } from '../../src/gameplay/CampaignMode.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('CampaignMode', () => {
  let c;
  beforeEach(() => { c = new CampaignMode({}); });

  it('初始 stage=0, name=战役, maxStages=5', () => {
    expect(c.stage).toBe(0);
    expect(c.name).toBe('战役');
    expect(c.maxStages).toBe(5);
  });

  it('currentStage 返回第1关', () => {
    expect(c.currentStage.name).toBe('渡桥遭遇');
    expect(c.currentStage.mapKey).toBe('bridge');
  });

  it('stageInfo 含 index/total/cleared', () => {
    const info = c.stageInfo;
    expect(info.index).toBe(0);
    expect(info.total).toBe(5);
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

  it('onStageClear 递进并持久化 cleared', () => {
    expect(c.onStageClear()).toBe('next_stage');
    expect(c.stage).toBe(1);
    expect(c.cleared).toBe(1);
    const c2 = new CampaignMode({});
    expect(c2.cleared).toBe(1);
  });

  it('onStageClear 末关返 campaign_complete 并回 0', () => {
    c.skipTo(4);
    expect(c.onStageClear()).toBe('campaign_complete');
    expect(c.stage).toBe(0);
    expect(c.cleared).toBe(5);
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
