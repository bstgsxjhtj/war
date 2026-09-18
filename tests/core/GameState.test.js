import { GameState, States } from '../../src/core/GameState.js';
import { EventBus } from '../../src/core/EventBus.js';
import { describe, it, expect } from 'vitest';

describe('GameState', () => {
  it('初始状态为 READY', () => {
    const gs = new GameState(new EventBus());
    expect(gs.current).toBe(States.READY);
  });

  it('合法迁移 READY->PLAYING 返回 true 并 emit', () => {
    const bus = new EventBus();
    const gs = new GameState(bus);
    const events = [];
    bus.on('state.change', (p) => events.push(p));
    const ok = gs.transit(States.PLAYING);
    expect(ok).toBe(true);
    expect(gs.current).toBe(States.PLAYING);
    expect(events[0]).toEqual({ from: States.READY, to: States.PLAYING, payload: undefined });
  });

  it('非法迁移 PLAYING->READY 返回 false', () => {
    const gs = new GameState(new EventBus());
    gs.transit(States.PLAYING);
    expect(gs.transit(States.READY)).toBe(false);
    expect(gs.current).toBe(States.PLAYING);
  });

  it('canTransit 反映迁移表', () => {
    const gs = new GameState(new EventBus());
    expect(gs.canTransit(States.PLAYING)).toBe(true);
    expect(gs.canTransit(States.ENDED)).toBe(false);
  });

  it('ENDED->READY 可重开', () => {
    const gs = new GameState(new EventBus());
    gs.transit(States.PLAYING);
    gs.transit(States.ENDED);
    expect(gs.transit(States.READY)).toBe(true);
  });
});
