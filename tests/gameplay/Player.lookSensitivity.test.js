// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true })
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

describe('Player 鼠标灵敏度初始化（NaN 根因防护）', () => {
  let bus;
  let _ple;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    bus = { on: vi.fn(), emit: vi.fn() };
    _ple = Object.getOwnPropertyDescriptor(document, 'pointerLockElement');
    Object.defineProperty(document, 'pointerLockElement', { value: null, configurable: true });
  });
  afterEach(() => {
    if (_ple) Object.defineProperty(document, 'pointerLockElement', _ple);
  });

  function lockPointer() {
    Object.defineProperty(document, 'pointerLockElement', { value: document.querySelector('#app'), configurable: true });
    document.dispatchEvent(new Event('pointerlockchange'));
  }

  function moveMouse(mx, my) {
    const ev = new MouseEvent('mousemove');
    Object.defineProperty(ev, 'movementX', { value: mx });
    Object.defineProperty(ev, 'movementY', { value: my });
    document.dispatchEvent(ev);
  }

  it('构造后 lookSensitivity 是有效数值（非 undefined/NaN）', () => {
    const p = new Player(makeCamera(), bus);
    expect(typeof p.lookSensitivity).toBe('number');
    expect(Number.isNaN(p.lookSensitivity)).toBe(false);
    expect(p.lookSensitivity).toBeGreaterThan(0);
  });

  it('pointer lock 后鼠标移动，camera.look 第三参数为有效数值（非 NaN）', () => {
    const cam = makeCamera();
    const p = new Player(cam, bus);
    lockPointer();
    moveMouse(10, 5);
    expect(cam.look).toHaveBeenCalledTimes(1);
    const sens = cam.look.mock.calls[0][2];
    expect(Number.isNaN(sens)).toBe(false);
    expect(sens).toBeGreaterThan(0);
  });

  it('未经 SettingsMenu emit 时，默认灵敏度等价于 CAMERA.SENSITIVITY_DEFAULT', () => {
    const cam = makeCamera();
    const p = new Player(cam, bus);
    lockPointer();
    moveMouse(100, 0);
    const sens = cam.look.mock.calls[0][2];
    expect(sens).toBeCloseTo(0.0025, 10);
  });
});
