// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }), brick: () => ({ isTexture: true })
  }
}));

import { Player } from '../../src/gameplay/Player.js';
import { Staff } from '../../src/gameplay/weapons/Staff.js';
import { MageDagger } from '../../src/gameplay/weapons/MageDagger.js';
import { CAMERA } from '../../src/core/constants/balance.js';

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
    expect(sens).toBeCloseTo(CAMERA.SENSITIVITY_DEFAULT, 10);
  });
});

describe('Player 指针锁状态构造期同步（死亡复活后无法转视角根因）', () => {
  let bus;
  let _ple;
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    bus = { on: vi.fn(), emit: vi.fn() };
    _ple = Object.getOwnPropertyDescriptor(document, 'pointerLockElement');
  });
  afterEach(() => {
    if (_ple) Object.defineProperty(document, 'pointerLockElement', _ple);
  });

  function setPointerLock(value) {
    Object.defineProperty(document, 'pointerLockElement', { value, configurable: true });
  }

  it('指针锁已持有时构造 Player，_locked 立即为 true', () => {
    setPointerLock(document.querySelector('#app'));
    const p = new Player(makeCamera(), bus);
    expect(p._locked).toBe(true);
  });

  it('指针锁未持有时构造 Player，_locked 为 false', () => {
    setPointerLock(null);
    const p = new Player(makeCamera(), bus);
    expect(p._locked).toBe(false);
  });

  it('指针锁已持有时构造（重开新建实例），mousemove 仍能转视角', () => {
    setPointerLock(document.querySelector('#app'));
    const cam = makeCamera();
    const p = new Player(cam, bus); // 模拟复活时的 new Player
    const ev = new MouseEvent('mousemove');
    Object.defineProperty(ev, 'movementX', { value: 7 });
    Object.defineProperty(ev, 'movementY', { value: 3 });
    document.dispatchEvent(ev);
    expect(cam.look).toHaveBeenCalledTimes(1);
  });
});

describe('法师（投射物职业）施法链路', () => {
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

  function mage() {
    const p = new Player(makeCamera(), bus);
    p.setWeapons([new Staff(), new MageDagger()]);
    p.spawn(new THREE.Vector3(0, 0, 0));
    return p;
  }

  it('法师主武器法杖为投射物类型', () => {
    expect(mage().weapon.type).toBe('projectile');
  });

  it('锁定鼠标时左键点击会排入攻击队列（死亡复活后仍可施法）', () => {
    Object.defineProperty(document, 'pointerLockElement', { value: document.querySelector('#app'), configurable: true });
    const p = mage();
    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    expect(p._attackQueued).toBe(true);
  });

  it('tryAttack 对法杖成功（法师可释放法术）', () => {
    const combat = { characters: [], spawnArrow: vi.fn(), resolveMelee: vi.fn() };
    expect(mage().tryAttack(combat, 1)).toBe(true);
  });

  it('法杖 _perform 生成投射物（spawnArrow）', () => {
    const combat = { spawnArrow: vi.fn() };
    new Staff()._perform({}, combat, { charge: 1 });
    expect(combat.spawnArrow).toHaveBeenCalled();
  });

  it('法杖技能火球术生成前方范围爆炸（spawnAoE）', () => {
    const combat = { spawnAoE: vi.fn() };
    const a = { position: new THREE.Vector3(0, 0, 0), forward: new THREE.Vector3(0, 0, 1) };
    expect(new Staff().skill(a, combat, 0)).toBe(true);
    expect(combat.spawnAoE).toHaveBeenCalled();
  });
});
