// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { AIManager, DIFFICULTY } from '../../src/gameplay/AIManager.js';
import { EventBus } from '../../src/core/EventBus.js';
import { EV } from '../../src/core/constants/events.js';

function mkAI(x, z, team = 1, weaponType = 'melee') {
  return {
    alive: true, team,
    position: new THREE.Vector3(x, 0, z),
    weapon: { type: weaponType },
  };
}

describe('AIManager', () => {
  it('难度表切换与回退', () => {
    const m = new AIManager(null);
    expect(m.difficulty()).toBe(DIFFICULTY.normal);
    m.setDifficulty('hard');
    expect(m.difficulty()).toBe(DIFFICULTY.hard);
    m.setDifficulty('不存在');
    expect(m.difficulty()).toBe(DIFFICULTY.normal);
  });

  it('setDifficulty 记录 level key 并提供 currentLevel()', () => {
    const m = new AIManager(null);
    expect(m.currentLevel()).toBe('normal');
    expect(m._level).toBe('normal');
    m.setDifficulty('hard');
    expect(m.currentLevel()).toBe('hard');
    expect(m._level).toBe('hard');
    m.setDifficulty('不存在');
    expect(m.currentLevel()).toBe('normal');
  });

  it('assignSquad 每 3 人一组，角色轮转', () => {
    const m = new AIManager(null);
    const ais = Array.from({ length: 7 }, (_, i) => mkAI(i * 10, 0));
    m.assignSquad(ais);
    expect(ais[0]._squadId).toBe(0);
    expect(ais[3]._squadId).toBe(1);
    expect(ais[6]._squadId).toBe(2);
    expect(ais[0]._squadRole).toBe('assault');
    expect(ais[1]._squadRole).toBe('flank');
  });

  it('投射武器强制 ranged 角色', () => {
    const m = new AIManager(null);
    const bow = mkAI(0, 0, 1, 'projectile');
    m.assignSquad([bow]);
    expect(bow._squadRole).toBe('ranged');
  });

  it('增援呼叫：30m 内同队 AI 获得 _reinforceTarget', () => {
    const bus = new EventBus();
    const m = new AIManager(bus);
    const near = mkAI(10, 0);
    const far = mkAI(100, 0);
    const dead = mkAI(5, 0);
    dead.alive = false;
    const otherTeam = mkAI(10, 0, 0);
    m.assignSquad([near, far, dead, otherTeam]);
    bus.emit(EV.AI_CALLREINFORCE, { pos: new THREE.Vector3(0, 0, 0), team: 1, id: null });
    expect(near._reinforceTarget).toBeDefined();
    expect(far._reinforceTarget).toBeUndefined();
    expect(dead._reinforceTarget).toBeUndefined();
    expect(otherTeam._reinforceTarget).toBeUndefined();
  });

  it('发现玩家：25m 内同队 AI 聚焦目标', () => {
    const bus = new EventBus();
    const m = new AIManager(bus);
    const near = mkAI(10, 0);
    const far = mkAI(100, 0);
    m.assignSquad([near, far]);
    const player = { position: new THREE.Vector3(0, 0, 0) };
    bus.emit(EV.AI_SPOTPLAYER, { target: player, team: 1, id: null });
    expect(near._focusTarget).toBe(player);
    expect(far._focusTarget).toBeUndefined();
  });
});
