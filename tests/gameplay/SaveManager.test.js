import { SaveManager } from '../../src/gameplay/SaveManager.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SaveManager', () => {
  beforeEach(() => { localStorage.clear(); });

  it('save 字段完整（version/savedAt/mode/stage/score/kills/bestGrade/affixSlots/skillPoints/playTime）', () => {
    const sm = new SaveManager();
    const d = sm.save({ mode: '战役', stage: 3, score: 1200, kills: 45, bestGrade: 'A', affixSlots: { SWORD: [{ type: '锋锐', tier: 2 }] }, skillPoints: 5, playTime: 3600 });
    expect(d.version).toBe(1);
    expect(typeof d.savedAt).toBe('number');
    expect(d.mode).toBe('战役');
    expect(d.stage).toBe(3);
    expect(d.score).toBe(1200);
    expect(d.kills).toBe(45);
    expect(d.bestGrade).toBe('A');
    expect(d.affixSlots.SWORD).toEqual([{ type: '锋锐', tier: 2 }]);
    expect(d.skillPoints).toBe(5);
    expect(d.playTime).toBe(3600);
    expect(JSON.parse(localStorage.getItem('savegame_v1'))).toEqual(d);
  });

  it('load：无存档 → null', () => {
    expect(new SaveManager().load()).toBeNull();
  });

  it('save 后可 load 恢复', () => {
    const sm = new SaveManager();
    sm.save({ mode: '战役', stage: 2, score: 800 });
    expect(new SaveManager().load().stage).toBe(2);
  });

  it('版本迁移：旧键（campaign_cleared/progression_v1/skilltree_v1）合并到 savegame_v1', () => {
    localStorage.setItem('campaign_cleared', '4');
    localStorage.setItem('progression_v1', JSON.stringify({ score: 900, kills: 30, bestGrade: 'B' }));
    localStorage.setItem('skilltree_v1', JSON.stringify({ points: 3 }));
    const sm = new SaveManager();
    const d = sm.load();
    expect(d.stage).toBe(4);
    expect(d.score).toBe(900);
    expect(d.kills).toBe(30);
    expect(d.bestGrade).toBe('B');
    expect(d.skillPoints).toBe(3);
  });

  it('reset 清空键 + 返回默认 null', () => {
    const sm = new SaveManager();
    sm.save({ mode: '战役', stage: 1 });
    sm.reset();
    expect(localStorage.getItem('savegame_v1')).toBeNull();
    expect(sm.load()).toBeNull();
  });
});
