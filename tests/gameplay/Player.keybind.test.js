// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true })
  }
}));

import { Player } from '../../src/gameplay/Player.js';
import { KeyBindings } from '../../src/core/input/KeyBindings.js';

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

describe('Player 键位重绑', () => {
  let bus;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    bus = { on: vi.fn(), emit: vi.fn() };
  });

  it('无 keyBindings 参数时使用默认绑定，默认键码仍生效', () => {
    const p = new Player(makeCamera(), bus);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(p._keys.has('KeyW')).toBe(true);
  });

  it('重绑 dodge 为 KeyR 后，KeyR 触发闪避请求', () => {
    const kb = new KeyBindings();
    kb.set('dodge', 'KeyR');
    const p = new Player(makeCamera(), bus, kb);
    const spy = vi.spyOn(p, 'requestDodge');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('重绑 dodge 为 KeyR 后，原 KeyQ 不再触发闪避', () => {
    const kb = new KeyBindings();
    kb.set('dodge', 'KeyR');
    const p = new Player(makeCamera(), bus, kb);
    const spy = vi.spyOn(p, 'requestDodge');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('重绑 forward 为 ArrowUp 后，update 读取 ArrowUp 控制前进', () => {
    const kb = new KeyBindings();
    kb.set('forward', 'ArrowUp');
    const p = new Player(makeCamera(), bus, kb);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
    p.update(0.016, terrain, combat, 0);
    expect(p._moveF).toBe(1);
  });

  it('重绑 weapon1 为 Digit5 后，Digit5 触发切换武器', () => {
    const kb = new KeyBindings();
    kb.set('weapon1', 'Digit5');
    const p = new Player(makeCamera(), bus, kb);
    p.weapons = [{ type: 'melee' }];
    const spy = vi.spyOn(p, 'switchWeapon').mockImplementation(() => {});
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit5' }));
    expect(spy).toHaveBeenCalledWith(0);
  });

  it('重绑 lock 为 KeyL 后，KeyL 触发锁定切换', () => {
    const kb = new KeyBindings();
    kb.set('lock', 'KeyL');
    const p = new Player(makeCamera(), bus, kb);
    const spy = vi.spyOn(p, '_toggleLock');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('重绑 jump 为 KeyC 后，update 读取 KeyC 触发跳跃', () => {
    const kb = new KeyBindings();
    kb.set('jump', 'KeyC');
    const p = new Player(makeCamera(), bus, kb);
    const spy = vi.spyOn(p, 'jump');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }));
    p.update(0.016, terrain, combat, 0);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
