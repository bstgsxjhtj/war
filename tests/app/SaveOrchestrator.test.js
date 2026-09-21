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
  const deps = {
    bus, state,
    hud: { flash: vi.fn() },
    saveManager: { save: vi.fn(), load: vi.fn(() => null), reset: vi.fn() },
    progression: { score: 10, kills: 3, getStats: () => ({ bestGrade: 'S' }), restore: vi.fn(), reset: vi.fn() },
    campaign: { stage: 2, cleared: 1, maxStages: 10, reset: vi.fn(), _saveCleared: vi.fn() },
    skills: { points: 5, serialize: () => ({ nodes: { a: 1 } }), restore: vi.fn(), reset: vi.fn(), _save: vi.fn() },
    affixes: { inventory: [{ type: 'x', tier: 1 }], _save: vi.fn() },
    daily: { _data: { date: '2026-09-21' }, _save: vi.fn() },
    skins: { _data: { unlocked: { default: true } }, _save: vi.fn() },
    achievements: { _data: { kill10: true }, _save: vi.fn() },
    getPlayer: () => player,
    getMode: () => ({ name: '死斗' }),
    ...overrides
  };
  return { deps, state, setPlayer: (p) => { player = p; } };
}

describe('SaveOrchestrator', () => {
  it('capture 生成完整快照（模式/关卡/进度/词条槽/技能/时长）', () => {
    const { deps } = makeDeps();
    const so = new SaveOrchestrator(deps);
    so.playTimeSec = 42;
    const snap = so.capture();
    expect(snap).toEqual({
      mode: '死斗',
      stage: 2,
      campaignCompleted: false,
      score: 10,
      kills: 3,
      bestGrade: 'S',
      affixSlots: { SWORD: [{ type: 'vamp', tier: 2 }, null], BOW: [null, null] },
      skillPoints: 5,
      skillTree: { nodes: { a: 1 } },
      playTime: 42
    });
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

  it('reset 清空各模块/旧键/武器词条并重置时长', () => {
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
    expect(deps.affixes.inventory).toEqual([]);
    expect(deps.achievements._data).toEqual({});
    for (const k of LEGACY_KEYS) expect(localStorage.getItem(k)).toBeNull();
    expect(deps.getPlayer().weapons[0].affixes).toEqual([null, null]);
    expect(so.playTimeSec).toBe(0);
    expect(deps.hud.flash).toHaveBeenCalledWith('进度已重置');
  });

  it('applyOnBoot 恢复战役关卡/进度/技能树/时长', () => {
    const { deps } = makeDeps();
    deps.saveManager.load = vi.fn(() => ({ mode: '战役', stage: 99, skillTree: { nodes: { b: 2 } }, playTime: 7, progression: {} }));
    const so = new SaveOrchestrator(deps);
    so.applyOnBoot();
    expect(deps.campaign.stage).toBe(9); // min(99, maxStages-1)
    expect(deps.progression.restore).toHaveBeenCalled();
    expect(deps.skills.restore).toHaveBeenCalledWith({ nodes: { b: 2 } });
    expect(so.playTimeSec).toBe(7);
  });

  it('applyOnBoot 无技能树时回退 skillPoints', () => {
    const { deps } = makeDeps();
    deps.saveManager.load = vi.fn(() => ({ skillPoints: 12, playTime: 0 }));
    const so = new SaveOrchestrator(deps);
    so.applyOnBoot();
    expect(deps.skills.points).toBe(12);
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
