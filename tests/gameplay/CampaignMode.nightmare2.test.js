import { describe, it, expect } from 'vitest';
import { CampaignMode, STAGES } from '../../src/gameplay/CampaignMode.js';

describe('P3-2 噩梦新周目新机制', () => {
  it('nightmare 敌人附加词条（reflect/vampire/lucky）', () => {
    const c = new CampaignMode({}, true);
    const mods = c.currentStage.enemyMods;
    expect(Array.isArray(mods)).toBe(true);
    expect(mods.length).toBeGreaterThan(0);
  });

  it('nightmare 环境陷阱增强（hazardBoost > 1）', () => {
    const c = new CampaignMode({}, true);
    expect(c.currentStage.hazardBoost).toBeGreaterThan(1);
  });

  it('nightmare Boss 关 boss 强制进入阶段 3 可达', () => {
    const c = new CampaignMode({}, true);
    c.skipTo(4);
    const s = c.currentStage;
    expect(s.bossType).toBeTruthy();
    expect(s.bossPhase3).toBe(true);
  });

  it('普通战役无 enemyMods/hazardBoost/bossPhase3', () => {
    const c = new CampaignMode({}, false);
    expect(c.currentStage.enemyMods).toBeFalsy();
    expect(c.currentStage.hazardBoost).toBeFalsy();
    expect(c.currentStage.bossPhase3).toBeFalsy();
  });

  it('nightmare spawnLayout 返回 difficulty 包含原 1.35 系数', () => {
    const c = new CampaignMode({}, true);
    const lay = c.spawnLayout();
    expect(lay.difficulty).toBeCloseTo(STAGES[0].difficulty * 1.35, 5);
  });

  it('nightmare 所有关卡均有 enemyMods', () => {
    const c = new CampaignMode({}, true);
    for (let i = 0; i < STAGES.length; i++) {
      expect(c.currentStage.enemyMods.length).toBeGreaterThan(0);
      c.onStageClear();
      if (c.stage === 0) break;
    }
  });
});