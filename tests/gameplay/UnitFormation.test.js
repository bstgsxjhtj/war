// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { UnitFormation, FormationController, FORMATIONS } from '../../src/gameplay/UnitFormation.js';

function mkLeader(x = 0, z = 0, yaw = 0) {
  return { alive: true, root: { position: new THREE.Vector3(x, 0, z), rotation: { y: yaw } } };
}
function mkMember(x = 0, z = 0) {
  return { alive: true, root: { position: new THREE.Vector3(x, 0, z), rotation: { y: 0 } } };
}

describe('UnitFormation', () => {
  it('盾墙：3 列横排 + 多行纵深', () => {
    const f = new UnitFormation(FORMATIONS.SHIELD_WALL, mkLeader(), [mkMember(), mkMember(), mkMember(), mkMember()]);
    expect(f._offsets[0].x).toBe(-1.5);
    expect(f._offsets[1].x).toBe(0);
    expect(f._offsets[2].x).toBe(1.5);
    expect(f._offsets[3].z).toBe(1.5);
  });

  it('弓箭线：一字横排', () => {
    const f = new UnitFormation(FORMATIONS.ARCHER_LINE, mkLeader(), [mkMember(), mkMember()]);
    expect(f._offsets[0].z).toBe(0);
    expect(f._offsets[1].z).toBe(0);
    expect(f._offsets[1].x - f._offsets[0].x).toBeCloseTo(1.8);
  });

  it('楔形：左右交替纵深', () => {
    const f = new UnitFormation(FORMATIONS.WEDGE, mkLeader(), [mkMember(), mkMember()]);
    expect(f._offsets[0].x).toBeCloseTo(0.8);
    expect(f._offsets[1].x).toBeCloseTo(-0.8);
  });

  it('getTargetPos 随领队 yaw 旋转', () => {
    const f = new UnitFormation(FORMATIONS.ARCHER_LINE, mkLeader(), [mkMember(), mkMember()]);
    const leader = { x: 0, y: 0, z: 0 };
    const p0 = f.getTargetPos(0, leader, 0);
    const p90 = f.getTargetPos(0, leader, Math.PI / 2);
    expect(p0.x).toBeCloseTo(-1.8);
    expect(p90.x).toBeCloseTo(0, 5);
  });

  it('update 为偏离队形的成员设置 _formationTarget', () => {
    const leader = mkLeader(0, 0, 0);
    const near = mkMember(0.1, 0.1);
    const far = mkMember(50, 50);
    const f = new UnitFormation(FORMATIONS.ARCHER_LINE, leader, [near, far]);
    f.update(f.members, 0.016);
    expect(far._formationTarget).toBeDefined();
    expect(far._formationYaw).toBeDefined();
  });

  it('死亡成员跳过', () => {
    const leader = mkLeader();
    const dead = mkMember(50, 50);
    dead.alive = false;
    const f = new UnitFormation(FORMATIONS.ARCHER_LINE, leader, [dead]);
    f.update(f.members, 0.016);
    expect(dead._formationTarget).toBeUndefined();
  });

  it('FormationController 管理生命周期', () => {
    const fc = new FormationController();
    fc.createShieldWall(mkLeader(), [mkMember()]);
    fc.createArcherLine(mkLeader(), [mkMember()]);
    expect(fc._formations.length).toBe(2);
    fc.update(0.016);
    fc.clear();
    expect(fc._formations.length).toBe(0);
  });
});
