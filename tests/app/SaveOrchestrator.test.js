// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';
import { GameState, States } from '../../src/core/GameState.js';
import { SaveOrchestrator } from '../../src/app/SaveOrchestrator.js';

const LEGACY_KEYS = ['campaign_cleared', 'progression_v1', 'skilltree_v1', 'achievements', 'affixes', 'daily_challenge', 'weapon_skins', 'tutorial_done', 'settings', 'audio_volume'];

function makeDeps(overrides = {}) {
  const bus = new EventBus();
  const state = new GameState(bus);
  let player = {
    weapons: [
      { weaponClass: 'SWORD', affixes: [{ type: 'vamp', tier: 2 }, null] },
      { weaponClass: 'BOW', affixes: [null, null] }
    ]
  };
  const progression = {
    score: 10, kills: 3, getStats: () => ({ bestGrade: 'S' }),
    serialize: () => ({ score: 10, kills: 3, deaths: 0, wins: 0, losses: 0, unlocks: { boss: false, elite: false }, bestGrade: 'S', bestTime: null }),
    restore: vi.fn(), reset: vi.fn()
  };
  const campaign = { stage: 2, cleared: 1, maxStages: 10, reset: vi.fn() };
  const skills = { points: 5, serialize: () => ({ nodes: { a: 1 } }), restore: vi.fn(), reset: vi.fn(), _save: vi.fn() };
  const affixes = { inventory: [{ type: 'x', tier: 1 }], serialize: () => [{ type: 'x', tier: 1 }], restore: vi.fn(), _save: vi.fn() };
  const daily = { _data: { date: '2026-09-21' }, serialize: () => ({ date: '2026-09-21' }), restore: vi.fn(), _save: vi.fn() };
  const skins = { _data: { unlocked: { default: true } }, serialize: () => ({ unlocked: { default: true } }), restore: vi.fn(), _save: vi.fn() };
  const achievements = { _data: { kill10: true }, serialize: () => ({ kill10: true }), restore: vi.fn(), _save: vi.fn() };
  const deps = {
    bus, state,
    hud: { flash: vi.fn() },
    saveManager: { save: vi.fn(), load: vi.fn(() => null), reset: vi.fn() },
    progression, campaign, skills, affixes, daily, skins, achievements,
    getPlayer: () => player,
    getMode: () => ({ name: '死斗' }),
    ...overrides
  };
  return { deps, state, setPlayer: (p) => { player = p; } };
}

describe('SaveOrchestrator', () => {
  it('capture 生成完整快照（含 progressionFull/affixInventory/achievements/daily/skins/campaignCleared）', () => {
    const { deps } = makeDeps();
    const so = new SaveOrchestrator(deps);
    so.playTimeSec = 42;
    const snap = so.capture();
    expect(snap.mode).toBe('死斗');
    expect(snap.stage).toBe(2);
    expect(snap.campaignCompleted).toBe(false);
    expect(snap.campaignCleared).toBe(1);
    expect(snap.progressionFull).toEqual({ score: 10, kills: 3, deaths: 0, wins: 0, losses: 0, unlocks: { boss: false, elite: false }, bestGrade: 'S', bestTime: null });
    expect(snap.score).toBe(10);
    expect(snap.kills).toBe(3);
    expect(snap.bestGrade).toBe('S');
    expect(snap.affixSlots).toEqual({ SWORD: [{ type: 'vamp', tier: 2 }, null], BOW: [null, null] });
    expect(snap.affixInventory).toEqual([{ type: 'x', tier: 1 }]);
    expect(snap.skillPoints).toBe(5);
    expect(snap.skillTree).toEqual({ nodes: { a: 1 } });
    expect(snap.achievements).toEqual({ kill10: true });
    expect(snap.daily).toEqual({ date: '2026-09-21' });
    expect(snap.skins).toEqual({ unlocked: { default: true } });
    expect(snap.playTime).toBe(42);
  });

  it('capture 的 campaignCompleted 随通关状态翻转', () => {
    const { deps } = makeDeps();
    deps.campaign.cleared = 10;
    const so = new SaveOrchestrator(deps);
    expect(so.capture().campaignCompleted).toBe(true);
  });

  it('saveNow 调用 saveManager.save(capture())', () => {
    const { deps } = makeDeps();
    const so = new SaveOrchestrator(deps);
    so.saveNow();
    expect(deps.saveManager.save).toHaveBeenCalledWith(so.capture());
  });

  it('reset 清空各模块（restore 调用）/旧键/武器词条并重置时长', () => {
    const { deps } = makeDeps();
    for (const k of LEGACY_KEYS) localStorage.setItem(k, 'x');
    const so = new SaveOrchestrator(deps);
    so.playTimeSec = 99;
    so.reset();
    expect(deps.saveManager.reset).toHaveBeenCalled();
    expect(deps.progression.reset).toHaveBeenCalled();
    expect(deps.campaign.reset).toHaveBeenCalled();
    expect(deps.campaign.cleared).toBe(0);
    expect(deps.skills.points).toBe(0);
    expect(deps.affixes.restore).toHaveBeenCalledWith([]);
    expect(deps.achievements.restore).toHaveBeenCalledWith({});
    expect(deps.daily.restore).toHaveBeenCalled();
    expect(deps.skins.restore).toHaveBeenCalled();
    for (const k of LEGACY_KEYS) expect(localStorage.getItem(k)).toBeNull();
    expect(deps.getPlayer().weapons[0].affixes).toEqual([null, null]);
    expect(so.playTimeSec).toBe(0);
    expect(deps.hud.flash).toHaveBeenCalledWith('进度已重置');
  });

  it('applyOnBoot 恢复战役关卡/cleared/进度全量/技能树/各模块/时长', () => {
    const { deps } = makeDeps();
    deps.saveManager.load = vi.fn(() => ({
      mode: '战役', stage: 99, campaignCleared: 7,
      progressionFull: { score: 200, kills: 5, deaths: 1, wins: 1, losses: 0, unlocks: { boss: false, elite: true }, bestGrade: 'A', bestTime: 60 },
      skillTree: { nodes: { b: 2 } },
      affixInventory: [{ type: '锋锐', tier: 2 }],
      achievements: { kill_1: { progress: 1, unlocked: true } },
      daily: { date: '2026-09-21', challenges: [] },
      skins: { unlocked: { bronze: true } },
      playTime: 7
    }));
    const so = new SaveOrchestrator(deps);
    so.applyOnBoot();
    expect(deps.campaign.stage).toBe(9);
    expect(deps.campaign.cleared).toBe(7);
    expect(deps.progression.restore).toHaveBeenCalledWith({ score: 200, kills: 5, deaths: 1, wins: 1, losses: 0, unlocks: { boss: false, elite: true }, bestGrade: 'A', bestTime: 60 });
    expect(deps.skills.restore).toHaveBeenCalledWith({ nodes: { b: 2 } });
    expect(deps.affixes.restore).toHaveBeenCalledWith([{ type: '锋锐', tier: 2 }]);
    expect(deps.achievements.restore).toHaveBeenCalledWith({ kill_1: { progress: 1, unlocked: true } });
    expect(deps.daily.restore).toHaveBeenCalledWith({ date: '2026-09-21', challenges: [] });
    expect(deps.skins.restore).toHaveBeenCalledWith({ unlocked: { bronze: true } });
    expect(so.playTimeSec).toBe(7);
  });

  it('applyOnBoot 无 progressionFull 时回退旧式 restore(_saved)', () => {
    const { deps } = makeDeps();
    deps.saveManager.load = vi.fn(() => ({ score: 50, skillPoints: 12, playTime: 0 }));
    const so = new SaveOrchestrator(deps);
    so.applyOnBoot();
    expect(deps.progression.restore).toHaveBeenCalledWith({ score: 50, skillPoints: 12, playTime: 0 });
    expect(deps.skills.points).toBe(12);
  });

  it('applyOnBoot campaignCompleted 布尔回退（无 campaignCleared 时通关置满）', () => {
    const { deps } = makeDeps();
    deps.saveManager.load = vi.fn(() => ({ campaignCompleted: true, playTime: 0 }));
    const so = new SaveOrchestrator(deps);
    so.applyOnBoot();
    expect(deps.campaign.cleared).toBe(10);
  });

  it('tickPlayTime 仅在 PLAYING 递增', () => {
    const { deps, state } = makeDeps();
    const so = new SaveOrchestrator(deps);
    so.tickPlayTime();
    expect(so.playTimeSec).toBe(0);
    state.transit(States.PLAYING);
    so.tickPlayTime();
    expect(so.playTimeSec).toBe(1);
  });

  describe('startTimers', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('60 秒自动存档；页面卸载前存档', () => {
      const { deps, state } = makeDeps();
      const so = new SaveOrchestrator(deps);
      so.startTimers();
      state.transit(States.PLAYING);
      vi.advanceTimersByTime(60000);
      expect(deps.saveManager.save).toHaveBeenCalledTimes(1);
      window.dispatchEvent(new Event('beforeunload'));
      expect(deps.saveManager.save).toHaveBeenCalledTimes(2);
    });

    it('每秒累计游玩时长（仅 PLAYING）', () => {
      const { deps, state } = makeDeps();
      const so = new SaveOrchestrator(deps);
      so.startTimers();
      vi.advanceTimersByTime(3000);
      expect(so.playTimeSec).toBe(0);
      state.transit(States.PLAYING);
      vi.advanceTimersByTime(2000);
      expect(so.playTimeSec).toBe(2);
    });
  });
});
