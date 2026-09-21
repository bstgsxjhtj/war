import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';
import { GameState, States } from '../../src/core/GameState.js';
import { MatchController } from '../../src/app/MatchController.js';

function makeDeps(overrides = {}) {
  const bus = new EventBus();
  const state = new GameState(bus);
  const mode = { name: '死斗', checkWin: vi.fn(() => 'blue') };
  let player = { alive: true };
  let ais = [{ alive: true }];
  const deps = {
    bus, state,
    hud: { setScore: vi.fn(), setRound: vi.fn(), clearHint: vi.fn(), flash: vi.fn(), flashEnd: vi.fn() },
    resultScreen: { show: vi.fn(), hide: vi.fn() },
    camera: { setKillCam: vi.fn() },
    progression: { recordWin: vi.fn(), recordLoss: vi.fn(), addScore: vi.fn(), score: 0, kills: 0, getStats: () => ({ bestGrade: null }) },
    progressUI: { refresh: vi.fn() },
    daily: { track: vi.fn(), claim: vi.fn(() => 0), challenges: [] },
    skills: { addPoint: vi.fn() },
    campaign: { stage: 0, cleared: 0, maxStages: 10, currentStage: {} },
    siege: { gate: { broken: false } },
    weather: { setMode: vi.fn() },
    audio: { playSound: vi.fn() },
    saveManager: { save: vi.fn() },
    spawnAll: vi.fn(),
    saveNow: vi.fn(),
    loadMap: vi.fn(),
    mapName: () => '测试地图',
    getPlayer: () => player,
    getAis: () => ais,
    getMode: () => mode,
    ...overrides
  };
  return { deps, bus, state, mode, setPlayer: (p) => { player = p; }, setAis: (a) => { ais = a; } };
}

function toPlaying(state) {
  if (state.current !== States.READY) state.transit(States.READY);
  state.transit(States.PLAYING);
}

describe('MatchController', () => {
  it('startRound 重置比分/统计并转 PLAYING', () => {
    const { deps, state } = makeDeps();
    const mc = new MatchController(deps);
    mc.scoreB = 5; mc.scoreR = 3; mc.playerKills = 2;
    mc.startRound();
    expect(deps.spawnAll).toHaveBeenCalled();
    expect(deps.hud.setScore).toHaveBeenCalledWith(0, 0);
    expect(mc.scoreB).toBe(0); expect(mc.scoreR).toBe(0); expect(mc.playerKills).toBe(0);
    expect(state.current).toBe(States.PLAYING);
  });

  it('combat.kill 按队伍计分并刷新 HUD', () => {
    const { deps, bus } = makeDeps();
    const mc = new MatchController(deps);
    bus.emit('combat.kill', { team: 1, victim: {} });
    expect(mc.scoreB).toBe(1);
    expect(deps.hud.setScore).toHaveBeenLastCalledWith(1, 0);
    bus.emit('combat.kill', { team: 2, victim: {} });
    expect(mc.scoreR).toBe(1);
    expect(deps.hud.setScore).toHaveBeenLastCalledWith(1, 1);
  });

  it('本地击杀 +1 技能点并闪现提示；Boss 击杀触发存档；音效交由 main_entry 进度处理器单一播放（不重复）', () => {
    const { deps, bus } = makeDeps();
    const mc = new MatchController(deps);
    bus.emit('combat.kill', { team: 1, killer: { isLocal: true }, victim: { _isBoss: true } });
    expect(deps.skills.addPoint).toHaveBeenCalledWith(1);
    expect(deps.hud.flash).toHaveBeenCalledWith('+1 技能点 (按 K 分配)');
    expect(mc.playerKills).toBe(1);
    expect(deps.saveNow).toHaveBeenCalled();
    expect(deps.audio.playSound).not.toHaveBeenCalled();
  });

  it('死斗：先赢一局进 ROUND_END（3 秒倒计时），连胜两局进 ENDED 并 recordWin', () => {
    const { deps, state } = makeDeps();
    const mc = new MatchController(deps);
    toPlaying(state);
    mc.checkWin();
    expect(mc.roundB).toBe(1);
    expect(state.current).toBe(States.ROUND_END);
    expect(mc.roundEndTimer).toBe(3);
    toPlaying(state);
    mc.checkWin();
    expect(mc.roundB).toBe(2);
    expect(state.current).toBe(States.ENDED);
    expect(deps.progression.recordWin).toHaveBeenCalled();
    expect(deps.resultScreen.show).toHaveBeenCalledWith(expect.objectContaining({ win: true }));
  });

  it('死斗：连败两局进 ENDED 并 recordLoss', () => {
    const { deps, state, mode } = makeDeps();
    mode.checkWin = vi.fn(() => 'red');
    const mc = new MatchController(deps);
    toPlaying(state); mc.checkWin();
    toPlaying(state); mc.checkWin();
    expect(state.current).toBe(States.ENDED);
    expect(deps.progression.recordLoss).toHaveBeenCalled();
    expect(deps.resultScreen.show).toHaveBeenCalledWith(expect.objectContaining({ win: false }));
  });

  it('restart 隐藏结算并清零回合', () => {
    const { deps, state } = makeDeps();
    const mc = new MatchController(deps);
    mc.roundB = 1; mc.roundR = 2;
    mc.restart();
    expect(deps.resultScreen.hide).toHaveBeenCalled();
    expect(deps.hud.setRound).toHaveBeenCalledWith(0, 0, mc.targetWins);
    expect(mc.roundB).toBe(0); expect(mc.roundR).toBe(0);
    expect(state.current).toBe(States.PLAYING);
  });

  it('round.restart 事件在 ENDED 时触发重开', () => {
    const { deps, bus, state } = makeDeps();
    const mc = new MatchController(deps);
    state.transit(States.PLAYING); state.transit(States.ENDED);
    const spy = vi.spyOn(mc, 'restart');
    bus.emit('round.restart', {});
    expect(spy).toHaveBeenCalled();
  });

  it('checkWin 非对局状态直接返回', () => {
    const { deps, state } = makeDeps();
    const mc = new MatchController(deps);
    state.transit(States.PLAYING); state.transit(States.ENDED);
    expect(mc.checkWin()).toBeUndefined();
    expect(deps.resultScreen.show).not.toHaveBeenCalled();
  });
});
