// @vitest-environment jsdom
import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { EscortTarget } from '../../src/gameplay/EscortTarget.js';

describe('F4: EscortTarget 战斗参与', () => {
  it('构造后具有 combat 所需的 position/team/forward/weapon/_curVel/vy 字段', () => {
    const e = new EscortTarget({ x: -10, z: 0 }, { x: 10, z: 0 }, 80);
    expect(e.position).toBeDefined();
    expect(e.position.x).toBe(-10);
    expect(e.team).toBe(0);
    expect(e.forward).toBeInstanceOf(THREE.Vector3);
    expect(e.weapon).toBeNull();
    expect(e._curVel).toBeInstanceOf(THREE.Vector3);
    expect(e.vy).toBe(0);
  });

  it('takeDamage 扣减血量', () => {
    const e = new EscortTarget({ x: 0, z: 0 }, { x: 10, z: 0 }, 80);
    const lost = e.takeDamage(30);
    expect(lost).toBe(30);
    expect(e.health.hp).toBe(50);
    expect(e.alive).toBe(true);
  });

  it('takeDamage 致死时 alive=false 且 root 隐藏', () => {
    const e = new EscortTarget({ x: 0, z: 0 }, { x: 10, z: 0 }, 80);
    e.takeDamage(80);
    expect(e.health.hp).toBe(0);
    expect(e.alive).toBe(false);
    expect(e.root.visible).toBe(false);
  });

  it('死后 takeDamage 返回 0', () => {
    const e = new EscortTarget({ x: 0, z: 0 }, { x: 10, z: 0 }, 80);
    e.takeDamage(80);
    expect(e.takeDamage(30)).toBe(0);
  });

  it('update 在玩家接近时向目标移动', () => {
    const e = new EscortTarget({ x: 0, z: 0 }, { x: 100, z: 0 }, 80);
    const player = { root: { position: new THREE.Vector3(5, 0, 0) } };
    const before = e.pos.x;
    e.update(0.1, player);
    expect(e.pos.x).not.toBe(before);
  });

  it('update 无 player 时不移动', () => {
    const e = new EscortTarget({ x: 0, z: 0 }, { x: 100, z: 0 }, 80);
    const before = e.pos.x;
    e.update(0.1, null);
    expect(e.pos.x).toBe(before);
  });
});
