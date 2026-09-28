// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';
import { GameState, States } from '../../src/core/GameState.js';
import { InputRouter } from '../../src/app/InputRouter.js';
import { KeyBindings } from '../../src/core/input/KeyBindings.js';
import { UIStack } from '../../src/ui/UIStack.js';
import { Domination } from '../../src/gameplay/GameMode.js';

function makeDeps(overrides = {}) {
  const bus = new EventBus();
  const state = new GameState(bus);
  const mode = { name: '死斗' };
  const deps = {
    bus, state,
    hud: { flash: vi.fn(), clearHint: vi.fn(), setMode: vi.fn() },
    campaign: { stage: 0, currentStage: { name: '破晓' }, spawnLayout: () => ({ mapKey: 'plain', red: [] }) },
    daily: { challenges: [{ done: true }, { done: false }] },
    weather: { mode: 'clear', toggle: vi.fn(), setMode: vi.fn() },
    settings: { show: vi.fn(), hide: vi.fn() },
    audio: { resume: vi.fn() },
    match: { restart: vi.fn(), startRound: vi.fn(), roundEndTimer: 5 },
    getMode: () => mode,
    setMode: (m) => { deps._modeSet = m; },
    loadMap: vi.fn(),
    mapName: () => '平原',
    currentMapKey: () => 'plain',
    getPlayer: () => ({ alive: true }),
    ...overrides
  };
  return { deps, state, mode };
}

function key(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}

describe('InputRouter', () => {
  let deps, state, router;
  beforeEach(() => {
    ({ deps, state } = makeDeps());
    router = new InputRouter(deps);
    router.install();
  });

  it('KeyC 闪现当前战役关卡', () => {
    key('KeyC');
    expect(deps.hud.flash).toHaveBeenCalledWith('战役：第1关 破晓');
  });

  it('KeyD 闪现每日挑战进度', () => {
    key('KeyD');
    expect(deps.hud.flash).toHaveBeenCalledWith('每日挑战：1/2 完成');
  });

  it('KeyN 切换天气并闪现中文名', () => {
    deps.weather.toggle = vi.fn(() => { deps.weather.mode = 'rain'; });
    key('KeyN');
    expect(deps.weather.toggle).toHaveBeenCalled();
    expect(deps.hud.flash).toHaveBeenCalledWith('天气：雨');
  });

  it('Escape 在面板栈空时打开设置', () => {
    UIStack._stack.length = 0;
    key('Escape');
    expect(deps.settings.show).toHaveBeenCalled();
  });

  it('Escape 在面板栈非空时不打开设置（由 UIStack 关栈顶）', () => {
    UIStack._stack.length = 0;
    UIStack.push({ hide: vi.fn() });
    key('Escape');
    expect(deps.settings.show).not.toHaveBeenCalled();
    UIStack._stack.length = 0;
  });

  it('KeyR 在 ENDED 时重开对局', () => {
    state.transit(States.PLAYING); state.transit(States.ENDED);
    key('KeyR');
    expect(deps.match.restart).toHaveBeenCalled();
  });

  it('KeyR 在 ROUND_END 时清倒计时并立即开下一局', () => {
    state.transit(States.PLAYING); state.transit(States.ROUND_END);
    key('KeyR');
    expect(deps.match.roundEndTimer).toBe(0);
    expect(deps.match.startRound).toHaveBeenCalled();
  });

  it('KeyM 在 ENDED 时轮换模式（死斗→据点）、加载地图并重开', () => {
    state.transit(States.PLAYING); state.transit(States.ENDED);
    key('KeyM');
    expect(deps._modeSet).toBeInstanceOf(Domination);
    expect(deps.loadMap).toHaveBeenCalled();
    expect(deps.hud.setMode).toHaveBeenCalled();
    expect(deps.match.restart).toHaveBeenCalled();
  });

  it('KeyM 在 PLAYING 且玩家存活时忽略', () => {
    state.transit(States.PLAYING);
    key('KeyM');
    expect(deps._modeSet).toBeUndefined();
    expect(deps.match.restart).not.toHaveBeenCalled();
  });

  it('Comma 在 ENDED 时切换地图并重开', () => {
    state.transit(States.PLAYING); state.transit(States.ENDED);
    key('Comma');
    expect(deps.loadMap).toHaveBeenCalled();
    expect(deps.hud.flash).toHaveBeenCalledWith('地图：平原');
    expect(deps.match.restart).toHaveBeenCalled();
  });

  it('首次按键恢复音频上下文', () => {
    key('KeyC');
    expect(deps.audio.resume).toHaveBeenCalled();
    key('KeyD');
    expect(deps.audio.resume).toHaveBeenCalledTimes(1); // 只恢复一次
  });
});

describe('InputRouter - 快捷键随 KeyBindings 重绑（P2-2）', () => {
  let deps, state, router, kb;
  beforeEach(() => {
    kb = new KeyBindings();
    ({ deps, state } = makeDeps({ kb }));
    router = new InputRouter(deps);
    router.install();
  });

  it('重绑 weather→KeyP 后按 KeyP 切天气，KeyN 不再切', () => {
    kb.set('weather', 'KeyP');
    state.transit(States.PLAYING);
    key('KeyN');
    expect(deps.weather.toggle).not.toHaveBeenCalled();
    key('KeyP');
    expect(deps.weather.toggle).toHaveBeenCalled();
  });

  it('重绑 mode→KeyZ 后按 KeyZ 轮换模式，KeyM 不再轮换', () => {
    kb.set('mode', 'KeyZ');
    state.transit(States.PLAYING); state.transit(States.ENDED);
    key('KeyM');
    expect(deps._modeSet).toBeUndefined();
    key('KeyZ');
    expect(deps._modeSet).toBeInstanceOf(Domination);
  });

  it('不传 kb 时回退默认键码（向后兼容）', () => {
    const { deps: d2, state: s2 } = makeDeps();
    const r2 = new InputRouter(d2);
    r2.install();
    s2.transit(States.PLAYING);
    key('KeyN');
    expect(d2.weather.toggle).toHaveBeenCalled();
  });
});
