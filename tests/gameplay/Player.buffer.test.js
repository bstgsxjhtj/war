// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }), brick: () => ({ isTexture: true })
  }
}));

import { Player } from '../../src/gameplay/Player.js';

function makeCamera() {
  return {
    forward: () => new THREE.Vector3(0, 0, -1),
    right: () => new THREE.Vector3(1, 0, 0),
    look: vi.fn(),
    follow: vi.fn(),
    setKillCam: vi.fn(),
    yaw: 0, aimMode: false, lockTarget: null
  };
}

const terrain = { heightAt: () => 0, isWater: () => false };
const combat = { characters: [] };

describe('Player 输入缓冲（闪避/处决）', () => {
  let p;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    p = new Player(makeCamera(), { on: vi.fn(), emit: vi.fn() });
  });

  it('攻击前半段闪避被拒时进入缓冲，攻击结束后 update 自动补闪避', () => {
    p._attacking = true; p._anim = 0; p._animDur = 1; // 前半段拒绝
    expect(p.requestDodge(new THREE.Vector3(0, 0, -1))).toBe(false);
    expect(p._dodgeBuf).toBeTruthy();
    p._attacking = false;
    p.update(0.016, terrain, combat, 0);
    expect(p._dodgeTimer).toBeGreaterThan(0);
    expect(p._dodgeBuf).toBeNull();
  });

  it('闪避缓冲 0.25s 后过期失效', () => {
    p._attacking = true; p._anim = 0; p._animDur = 1;
    p.requestDodge(new THREE.Vector3(0, 0, -1));
    p._attacking = false;
    p.update(0.3, terrain, combat, 0);
    expect(p._dodgeBuf).toBeNull();
    expect(p._dodgeTimer).toBe(0);
  });

  it('处决失败进入缓冲，目标进入可处决状态时 update 自动补处决', () => {
    const enemy = {
      alive: true, team: 1, canBeExecuted: false,
      position: new THREE.Vector3(0, 0, 0.5), forward: new THREE.Vector3(0, 0, 1),
      setLockMark() {}
    };
    p.forward.set(0, 0, 1);
    combat.characters.push(enemy);
    p.requestExecute(combat); // 目标尚不可处决
    expect(p._execBuf).toBeGreaterThan(0);
    enemy.canBeExecuted = true;
    p.update(0.016, terrain, combat, 0);
    expect(p._executing).toBeGreaterThan(0);
    expect(p._execBuf).toBe(0);
    combat.characters.length = 0;
  });

  it('处决缓冲 0.25s 后过期失效', () => {
    p.requestExecute(combat); // 附近无目标
    expect(p._execBuf).toBeGreaterThan(0);
    p.update(0.3, terrain, combat, 0);
    expect(p._execBuf).toBe(0);
    expect(p._executing).toBe(0);
  });

  it('死亡时请求不进入缓冲', () => {
    p.alive = false;
    p.requestDodge(new THREE.Vector3(0, 0, -1));
    expect(p._dodgeBuf).toBeNull();
    p.requestExecute(combat);
    expect(p._execBuf).toBe(0);
  });
});
