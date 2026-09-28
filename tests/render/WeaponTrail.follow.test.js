import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WeaponTrail } from '../../src/render/WeaponTrail.js';

describe('P2-9 WeaponTrail 跟随武器', () => {
  function setup() {
    const scene = new THREE.Scene();
    const wt = new WeaponTrail(scene);
    const weapon = new THREE.Object3D();
    scene.add(weapon);
    const trail = wt.attach(weapon, 0xfff0a0);
    return { scene, wt, weapon, trail };
  }

  it('attach 缓存 weaponMesh 引用（trail.weaponMesh 指向传入对象）', () => {
    const { weapon, trail } = setup();
    expect(trail.weaponMesh).toBe(weapon);
  });

  it('武器自身位移后轨迹写入武器世界坐标（非场景根恒等）', () => {
    const { scene, wt, weapon } = setup();
    scene.position.set(0, 0, 0);
    scene.updateMatrixWorld(true);
    wt.activate(weapon);
    wt.update(0.016, 0);
    weapon.position.set(5, 0, 4);
    weapon.updateMatrixWorld(true);
    wt.update(0.016, 1);
    const trail = weapon.userData._trail;
    const slot = trail.history[trail.head];
    expect(slot.tail.x).toBeCloseTo(5, 5);
    expect(slot.tail.z).toBeCloseTo(4 - 0.6, 5);
    expect(slot.tip.z).toBeCloseTo(4 + 0.8, 5);
  });

  it('武器旋转后局部 (0,0,-0.6) 经武器 matrixWorld 变换（非场景）', () => {
    const { scene, wt, weapon } = setup();
    scene.updateMatrixWorld(true);
    weapon.rotation.y = Math.PI / 2;
    weapon.updateMatrixWorld(true);
    wt.activate(weapon);
    wt.update(0.016, 0);
    const trail = weapon.userData._trail;
    const slot = trail.history[trail.head];
    // 旋转 90°：局部 (0,0,-0.6) -> 世界 (-0.6, 0, 0) 附近；局部 (0,0,0.8) -> (0.8,0,0)
    expect(slot.tail.x).toBeCloseTo(-0.6, 5);
    expect(slot.tip.x).toBeCloseTo(0.8, 5);
  });

  it('line 仍挂在场景根（可见性不受武器父节点隐藏影响）', () => {
    const { wt, weapon } = setup();
    expect(weapon.userData._trail.line.parent).toBeTruthy();
    expect(weapon.userData._trail.line.parent.type).toBe('Scene');
  });
});