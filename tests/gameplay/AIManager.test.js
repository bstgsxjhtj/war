import { describe, it, expect, vi } from 'vitest';
import { AIManager, DIFFICULTY } from '../../src/gameplay/AIManager.js';

describe('AIManager', () => {
  const mockBus = () => ({ on: vi.fn(), emit: vi.fn() });

  it('setDifficulty 设置 easy/normal/hard 对应参数', () => {
    const mgr = new AIManager(mockBus());
    mgr.setDifficulty('easy');
    expect(mgr.difficulty()).toBe(DIFFICULTY.easy);
    expect(mgr.difficulty().reactTime).toBe(0.5);
    expect(mgr.difficulty().dodgeChance).toBe(0.10);
    expect(mgr.difficulty().maxHpMul).toBe(0.8);
    mgr.setDifficulty('normal');
    expect(mgr.difficulty()).toBe(DIFFICULTY.normal);
    expect(mgr.difficulty().reactTime).toBe(0.3);
    mgr.setDifficulty('hard');
    expect(mgr.difficulty()).toBe(DIFFICULTY.hard);
    expect(mgr.difficulty().reactTime).toBe(0.15);
    expect(mgr.difficulty().dodgeChance).toBe(0.35);
    expect(mgr.difficulty().maxHpMul).toBe(1.2);
  });

  it('setDifficulty 未知难度回退 normal', () => {
    const mgr = new AIManager(mockBus());
    mgr.setDifficulty('nightmare');
    expect(mgr.difficulty()).toBe(DIFFICULTY.normal);
  });

  it('difficulty() 默认 normal', () => {
    const mgr = new AIManager(mockBus());
    expect(mgr.difficulty()).toBe(DIFFICULTY.normal);
  });

  it('assignSquad 6 AI 分 2 组，每组 3 role（assault/flank/ranged）', () => {
    const mgr = new AIManager(mockBus());
    const ais = Array.from({ length: 6 }, () => ({ weapon: { type: 'sword' } }));
    mgr.assignSquad(ais);
    expect(ais[0]._squadId).toBe(0);
    expect(ais[0]._squadRole).toBe('assault');
    expect(ais[1]._squadId).toBe(0);
    expect(ais[1]._squadRole).toBe('flank');
    expect(ais[2]._squadId).toBe(0);
    expect(ais[2]._squadRole).toBe('ranged');
    expect(ais[3]._squadId).toBe(1);
    expect(ais[3]._squadRole).toBe('assault');
    expect(ais[4]._squadId).toBe(1);
    expect(ais[4]._squadRole).toBe('flank');
    expect(ais[5]._squadId).toBe(1);
    expect(ais[5]._squadRole).toBe('ranged');
  });

  it('assignSquad 弩兵（weapon.type=projectile）强制 ranged', () => {
    const mgr = new AIManager(mockBus());
    const ais = [
      { weapon: { type: 'projectile' } },
      { weapon: { type: 'sword' } },
      { weapon: { type: 'sword' } },
    ];
    mgr.assignSquad(ais);
    expect(ais[0]._squadRole).toBe('ranged');
  });

  it('callReinforce 广播：附近 AI 设 _reinforceTarget', () => {
    const handlers = {};
    const bus = {
      on: vi.fn((ev, fn) => { handlers[ev] = fn; }),
      emit: vi.fn(),
    };
    const ai = {
      position: {
        clone: () => ({
          distanceTo: () => 20,
          sub: () => ({ length: () => 20 }),
        }),
      },
      team: 1,
      alive: true,
      _reinforceTarget: null,
      weapon: { type: 'sword' },
    };
    const mgr = new AIManager(bus);
    mgr.assignSquad([ai]);
    const pos = { clone: () => ({ x: 1, y: 0, z: 1 }) };
    handlers['ai.callReinforce']({ pos, team: 1, id: {} });
    expect(ai._reinforceTarget).not.toBeNull();
  });
});
