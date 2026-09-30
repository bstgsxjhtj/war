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

describe('Player 锁定解除朝向缓动 (D9 修复)', () => {
  let bus;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    bus = { on: vi.fn(), emit: vi.fn() };
  });

  it('锁定时朝向目标，_targetYaw 跟随目标方位', () => {
    const cam = makeCamera();
    cam.yaw = Math.PI / 2;
    const p = new Player(cam, bus);
    const target = { alive: true, position: new THREE.Vector3(0, 0, 10), setLockMark: vi.fn() };
    p.lockTarget = target; cam.lockTarget = target;
    p.update(0.016, terrain, combat, 0);
    expect(p._targetYaw).toBeCloseTo(0, 5);
    expect(p._wasLocked).toBe(true);
  });

  it('解除锁定瞬间 _targetYaw 不跳变到 camera.yaw', () => {
    const cam = makeCamera();
    cam.yaw = Math.PI / 2;
    const p = new Player(cam, bus);
    const target = { alive: true, position: new THREE.Vector3(0, 0, 10), setLockMark: vi.fn() };
    p.lockTarget = target; cam.lockTarget = target;
    p.update(0.016, terrain, combat, 0);
    p.lockTarget = null; cam.lockTarget = null;
    p.update(0.016, terrain, combat, 0);
    expect(p._targetYaw).not.toBeCloseTo(Math.PI / 2, 0);
    expect(p._targetYaw).toBeCloseTo(0, 5);
    expect(p._lockReleaseT).toBeGreaterThan(0);
  });

  it('解除锁定后多帧缓动收敛到 camera.yaw', () => {
    const cam = makeCamera();
    cam.yaw = Math.PI / 2;
    const p = new Player(cam, bus);
    const target = { alive: true, position: new THREE.Vector3(0, 0, 10), setLockMark: vi.fn() };
    p.lockTarget = target; cam.lockTarget = target;
    p.update(0.016, terrain, combat, 0);
    p.lockTarget = null; cam.lockTarget = null;
    for (let i = 0; i < 20; i++) p.update(0.016, terrain, combat, 0);
    expect(p._lockReleaseT).toBeLessThanOrEqual(0);
    expect(p._targetYaw).toBeCloseTo(Math.PI / 2, 1);
  });
});
