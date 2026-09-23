import { describe, it, expect } from 'vitest';
import { CampaignMode, STAGES } from '../../src/gameplay/CampaignMode.js';

describe('CampaignMode nightmare', () => {
  it('nightmare 标记与显示名', () => {
    const c = new CampaignMode({}, true);
    expect(c.nightmare).toBe(true);
    expect(c.displayName).toBe('噩梦战役');
    expect(c.name).toBe('战役');
  });

  it('普通战役显示名', () => {
    const c = new CampaignMode({});
    expect(c.nightmare).toBe(false);
    expect(c.displayName).toBe('战役');
  });

  it('nightmare 难度提升 35%', () => {
    const c = new CampaignMode({}, true);
    const base = STAGES[0];
    expect(c.currentStage.difficulty).toBeCloseTo(base.difficulty * 1.35);
  });

  it('nightmare 敌人数量 +2', () => {
    const c = new CampaignMode({}, true);
    const base = STAGES[0];
    expect(c.currentStage.enemyCount).toBe(base.enemyCount + 2);
  });

  it('nightmare 关卡名与目标保持一致', () => {
    const c = new CampaignMode({}, true);
    for (let i = 0; i < STAGES.length; i++) {
      expect(c.currentStage.name).toBe(STAGES[i].name);
      expect(c.currentStage.objective).toBe(STAGES[i].objective);
      expect(c.currentStage.mapKey).toBe(STAGES[i].mapKey);
      c.onStageClear();
      if (c.stage === 0) break;
    }
  });

  it('nightmare 通关所有关卡后 campaign_complete', () => {
    const c = new CampaignMode({}, true);
    let result = 'next_stage';
    let guard = 0;
    while (result !== 'campaign_complete' && guard++ < 30) result = c.onStageClear();
    expect(result).toBe('campaign_complete');
  });

  it('serialize/restore 不受 nightmare 影响', () => {
    const c = new CampaignMode({}, true);
    c.cleared = 3;
    const data = c.serialize();
    const c2 = new CampaignMode({}, true);
    c2.restore(data);
    expect(c2.cleared).toBe(3);
  });
});
