// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { MatchController } from '../../src/app/MatchController.js';
import { EventBus } from '../../src/core/EventBus.js';
import { GameState } from '../../src/core/GameState.js';
import { EV } from '../../src/core/constants/events.js';

function mkDeps(bus, state, affixes) {
  return {
    state,
    hud: { setScore() {}, setRound() {}, clearHint() {}, flash: vi.fn(), flashEnd() {} },
    campaign: { name: '战役', checkWin: () => null, stage: 0, currentStage: {}, spawnLayout: () => ({}) },
    siege: { gate: { broken: false } },
    progression: { recordWin() {}, recordLoss() {} },
    progressUI: { refresh() {} },
    daily: { track() {}, claim: () => 0, challenges: [] },
    bus,
    resultScreen: { hide() {}, show() {} },
    camera: { setKillCam() {} },
    saveNow() {},
    getMode: () => ({ name: '死斗', checkWin: () => null }),
    getPlayer: () => ({ alive: true }),
    getAis: () => [],
    spawnAll() {},
    loadMap() {},
    weather: { setMode() {} },
    mapName: () => '',
    currentMapKey: () => 'field',
    skills: { addPoint() {} },
    affixes,
  };
}

describe('MatchController 词缀掉落', () => {
  it('Boss 击杀必掉词缀', () => {
    const bus = new EventBus();
    const state = new GameState();
    const affixes = { grant: vi.fn(() => true), drop: vi.fn(), affixBonus: vi.fn(() => 0), inventory: [] };
    const mc = new MatchController(mkDeps(bus, state, affixes));
    const killer = { isLocal: true, weapon: {} };
    const victim = { _isBoss: true, team: 1 };
    bus.emit(EV.COMBAT_KILL, { team: 1, killer, victim });
    expect(affixes.grant).toHaveBeenCalledTimes(1);
    expect(affixes.drop).not.toHaveBeenCalled();
  });

  it('普通击杀触发随机掉落（调 drop）', () => {
    const bus = new EventBus();
    const state = new GameState();
    const affixes = { grant: vi.fn(), drop: vi.fn(() => false), affixBonus: vi.fn(() => 0), inventory: [] };
    const mc = new MatchController(mkDeps(bus, state, affixes));
    const killer = { isLocal: true, weapon: {} };
    const victim = { team: 1 };
    bus.emit(EV.COMBAT_KILL, { team: 1, killer, victim });
    expect(affixes.drop).toHaveBeenCalledTimes(1);
    expect(affixes.grant).not.toHaveBeenCalled();
  });

  it('掉落时发 AFFIX_DROP 事件', () => {
    const bus = new EventBus();
    const state = new GameState();
    const affixes = { grant: vi.fn(() => true), drop: vi.fn(), affixBonus: vi.fn(() => 0), inventory: [] };
    const mc = new MatchController(mkDeps(bus, state, affixes));
    let dropEvent = null;
    bus.on(EV.AFFIX_DROP, (p) => { dropEvent = p; });
    bus.emit(EV.COMBAT_KILL, { team: 1, killer: { isLocal: true, weapon: {} }, victim: { _isBoss: true, team: 1 } });
    expect(dropEvent).not.toBeNull();
    expect(dropEvent.boss).toBe(true);
  });
});
