import { SaveManager } from '../../src/gameplay/SaveManager.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SaveManager', () => {
  beforeEach(() => { localStorage.clear(); });

  it('save 字段完整（含 campaignCompleted/skillTree）', () => {
    const sm = new SaveManager();
    const d = sm.save({ mode: '战役', stage: 3, score: 1200, kills: 45, bestGrade: 'A', campaignCompleted: true, skillTree: { points: 5, skills: { power: 2 } }, affixSlots: { SWORD: [{ type: '锋锐', tier: 2 }] }, skillPoints: 5, playTime: 3600 });
    expect(d.version).toBe(2);
    expect(typeof d.savedAt).toBe('number');
    expect(d.mode).toBe('战役');
    expect(d.stage).toBe(3);
    expect(d.campaignCompleted).toBe(true);
    expect(d.skillTree).toEqual({ points: 5, skills: { power: 2 } });
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

  it('save 含收敛字段（progressionFull/achievements/affixInventory/daily/skins）', () => {
    const sm = new SaveManager();
    const d = sm.save({
      mode: '战役', stage: 1,
      progressionFull: { score: 200, kills: 5, deaths: 1, wins: 1, losses: 0, unlocks: { boss: false, elite: true }, bestGrade: 'A', bestTime: 60 },
      achievements: { kill_1: { progress: 1, unlocked: true } },
      affixInventory: [{ type: '锋锐', tier: 1 }],
      daily: { date: '2026-9-21', challenges: [], progress: {}, claimed: false },
      skins: { unlocked: { default: true, bronze: true }, equipped: { 0: 'bronze' } }
    });
    expect(d.progressionFull.score).toBe(200);
    expect(d.progressionFull.unlocks.elite).toBe(true);
    expect(d.achievements.kill_1.unlocked).toBe(true);
    expect(d.affixInventory[0]).toEqual({ type: '锋锐', tier: 1 });
    expect(d.daily.date).toBe('2026-9-21');
    expect(d.skins.unlocked.bronze).toBe(true);
  });

  it('迁移：旧键（achievements/affixes/daily_challenge/weapon_skins）合并到 savegame_v1 对应字段', () => {
    localStorage.setItem('achievements', JSON.stringify({ kill_1: { progress: 1, unlocked: true } }));
    localStorage.setItem('affixes', JSON.stringify([{ type: '锋锐', tier: 2 }]));
    localStorage.setItem('daily_challenge', JSON.stringify({ date: '2026-9-21', challenges: [], progress: {}, claimed: true }));
    localStorage.setItem('weapon_skins', JSON.stringify({ unlocked: { default: true, dragon: true }, equipped: { 0: 'dragon' } }));
    const sm = new SaveManager();
    const d = sm.load();
    expect(d.achievements.kill_1.unlocked).toBe(true);
    expect(d.affixInventory[0]).toEqual({ type: '锋锐', tier: 2 });
    expect(d.daily.claimed).toBe(true);
    expect(d.skins.unlocked.dragon).toBe(true);
  });

  it('迁移后旧键被删除（只读迁移一次）', () => {
    localStorage.setItem('campaign_cleared', '4');
    localStorage.setItem('progression_v1', JSON.stringify({ score: 900 }));
    localStorage.setItem('skilltree_v1', JSON.stringify({ points: 3 }));
    localStorage.setItem('achievements', JSON.stringify({ kill_1: { progress: 1, unlocked: true } }));
    localStorage.setItem('affixes', JSON.stringify([{ type: '锋锐', tier: 1 }]));
    localStorage.setItem('daily_challenge', JSON.stringify({ date: '2026-9-21', challenges: [] }));
    localStorage.setItem('weapon_skins', JSON.stringify({ unlocked: { bronze: true } }));
    new SaveManager();
    for (const k of ['campaign_cleared', 'progression_v1', 'skilltree_v1', 'achievements', 'affixes', 'daily_challenge', 'weapon_skins']) {
      expect(localStorage.getItem(k)).toBeNull();
    }
  });

  it('reset 清空键 + 返回默认 null', () => {
    const sm = new SaveManager();
    sm.save({ mode: '战役', stage: 1 });
    sm.reset();
    expect(localStorage.getItem('savegame_v1')).toBeNull();
    expect(sm.load()).toBeNull();
  });
});
