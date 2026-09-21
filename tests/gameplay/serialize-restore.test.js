import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Progression } from '../../src/gameplay/Progression.js';
import { Achievements } from '../../src/gameplay/Achievements.js';
import { Affixes } from '../../src/gameplay/Affixes.js';
import { DailyChallenge } from '../../src/gameplay/DailyChallenge.js';
import { WeaponSkins, SKINS } from '../../src/gameplay/WeaponSkins.js';
import { CampaignMode } from '../../src/gameplay/CampaignMode.js';

function fakeProg(score = 0) { return { score }; }

describe('serialize/restore round-trip（持久化收敛契约）', () => {
  beforeEach(() => { localStorage.clear(); });

  it('Progression serialize→restore 还原全量状态', () => {
    const p = new Progression();
    p.addScore(500); p.recordKill(); p.recordWin('A', 60); p.recordDeath(); p.recordLoss();
    const snap = p.serialize();
    const p2 = new Progression();
    p2.restore(snap);
    expect(p2.serialize()).toEqual(snap);
    expect(p2.score).toBe(625);
    expect(p2.kills).toBe(1);
    expect(p2.deaths).toBe(1);
    expect(p2.wins).toBe(1);
    expect(p2.losses).toBe(1);
    expect(p2.getStats().bestGrade).toBe('A');
    expect(p2.getStats().bestTime).toBe(60);
    expect(p2.unlocks.elite).toBe(true);
  });

  it('Achievements serialize→restore 还原进度与解锁', () => {
    const a = new Achievements();
    a.check('combat.kill', {});
    a.check('combo.tier', {});
    const snap = a.serialize();
    const a2 = new Achievements();
    a2.restore(snap);
    expect(a2.serialize()).toEqual(snap);
    expect(a2.isUnlocked('kill_1')).toBe(true);
    expect(a2.isUnlocked('combo_10')).toBe(true);
  });

  it('Affixes serialize→restore 还原背包', () => {
    const a = new Affixes();
    a.grant('锋锐', 2); a.grant('吸血', 0);
    const snap = a.serialize();
    const a2 = new Affixes();
    a2.restore(snap);
    expect(a2.serialize()).toEqual(snap);
    expect(a2.inventory.length).toBe(2);
    expect(a2.inventory[0]).toEqual({ type: '锋锐', tier: 2 });
  });

  it('DailyChallenge serialize→restore 同日不重生', () => {
    Math.random = vi.fn(() => 0);
    const d = new DailyChallenge(fakeProg(0));
    d.track(d.challenges[0].type);
    const snap = d.serialize();
    const d2 = new DailyChallenge(fakeProg(0));
    d2.restore(snap);
    expect(d2.serialize()).toEqual(snap);
    expect(d2.challenges[0].progress).toBe(1);
  });

  it('DailyChallenge restore 过期数据触发重生', () => {
    Math.random = vi.fn(() => 0);
    const d = new DailyChallenge(fakeProg(0));
    const d2 = new DailyChallenge(fakeProg(0));
    d2.restore({ date: '2020-1-1', challenges: [], progress: {} });
    expect(d2.challenges.length).toBe(3);
    expect(d2._data.date).toBe(d._todayKey());
  });

  it('WeaponSkins serialize→restore 还原解锁与装备', () => {
    const s = new WeaponSkins(fakeProg(500));
    s.unlock('bronze'); s.equip(1, 'bronze');
    const snap = s.serialize();
    const s2 = new WeaponSkins(fakeProg(0));
    s2.restore(snap);
    expect(s2.serialize()).toEqual(snap);
    expect(s2.isUnlocked('bronze')).toBe(true);
    expect(s2.getEquippedSkin(1)).toBe(SKINS.bronze);
  });

  it('CampaignMode serialize→restore 还原 cleared', () => {
    const c = new CampaignMode({});
    c.cleared = 7;
    const snap = c.serialize();
    const c2 = new CampaignMode({});
    c2.restore(snap);
    expect(c2.serialize()).toEqual(snap);
    expect(c2.cleared).toBe(7);
  });
});
