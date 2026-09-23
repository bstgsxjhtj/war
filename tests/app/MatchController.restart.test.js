// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { MatchController } from '../../src/app/MatchController.js';
import { EventBus } from '../../src/core/EventBus.js';
import { GameState, States } from '../../src/core/GameState.js';
import { EV } from '../../src/core/constants/events.js';

function mkDeps(bus, state) {
  return {
    state,
    hud: { setScore() {}, setRound() {}, clearHint() {}, flash() {}, flashEnd() {} },
    campaign: { name: '战役', checkWin: () => null, stage: 0, currentStage: {}, spawnLayout: () => ({}) },
    siege: { gate: { broken: false } },
    progression: { recordWin() {}, recordLoss() {} },
    progressUI: { refresh() {} },
    daily: { track() {}, claim: () => 0, challenges: [] },
    bus,
    resultScreen: { hide() { bus.emit(EV.ROUND_RESTART); }, show() {} },
    camera: { setKillCam() {} },
    saveNow() {},
    getMode: () => ({ name: '死斗', checkWin: () => 'red' }),
    getPlayer: () => ({ alive: true }),
    getAis: () => [],
    spawnAll() {},
    loadMap() {},
    weather: { setMode() {} },
    mapName: () => '',
    currentMapKey: () => 'field',
    skills: { addPoint() {} },
  };
}

describe('MatchController.restart', () => {
  it('ROUND_RESTART 重入不递归爆栈', () => {
    const bus = new EventBus();
    const state = new GameState(bus);
    const deps = mkDeps(bus, state);
    const mc = new MatchController(deps);
    state.transit(States.READY);
    state.transit(States.PLAYING);
    state.transit(States.ENDED);
    expect(() => mc.restart()).not.toThrow();
    expect(state.current).toBe(States.PLAYING);
    expect(mc.roundB).toBe(0);
    expect(mc.roundR).toBe(0);
  });

  it('非 ENDED 状态收到 ROUND_RESTART 不触发 restart', () => {
    const bus = new EventBus();
    const state = new GameState(bus);
    const mc = new MatchController(mkDeps(bus, state));
    let restartCount = 0;
    const orig = mc.restart.bind(mc);
    mc.restart = () => { restartCount++; orig(); };
    state.transit(States.READY);
    bus.emit(EV.ROUND_RESTART);
    expect(restartCount).toBe(0);
  });
});
