import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WeaponTrail, HitDirection, HitStop } from '../../src/render/WeaponTrail.js';

describe('WeaponTrail', () => {
  function setup(parentPosition) {
    const scene = new THREE.Scene();
    const wt = new WeaponTrail(scene);
    const weapon = new THREE.Object3D();
    scene.add(weapon);
    const trail = wt.attach(weapon, 0xfff0a0);
    return { scene, wt, weapon, trail };
  }

  it('attach 创建 24 槽环形缓冲且幂等', () => {
    const { wt, weapon } = setup();
    const t1 = wt.attach(weapon);
    const t2 = wt.attach(weapon);
    expect(t1).toBe(t2);
    expect(t1.history.length).toBe(24);
    expect(wt._trails.length).toBe(1);
  });

  it('activate/deactivate 正确切换 active 标志并重置 head/count', () => {
    const { wt, weapon, trail } = setup();
    expect(trail.active).toBe(false);
    wt.activate(weapon);
    expect(trail.active).toBe(true);
    expect(trail.head).toBe(0);
    expect(trail.count).toBe(0);
    wt.deactivate(weapon);
    expect(trail.active).toBe(false);
  });

  it('active update 后 history 槽位写入正确的世界坐标（恒等场景）', () => {
    const { wt, weapon } = setup();
    wt.activate(weapon);
    wt.update(0.016, 0);
    const slot = weapon.userData._trail.history[weapon.userData._trail.head];
    expect(slot.tail.x).toBeCloseTo(0, 5);
    expect(slot.tail.z).toBeCloseTo(-0.6, 5);
    expect(slot.tip.z).toBeCloseTo(0.8, 5);
  });

  it('active update 后 history 槽位写入正确的世界坐标（平移场景）', () => {
    const { scene, wt, weapon } = setup();
    scene.position.set(10, 5, 2);
    scene.updateMatrixWorld(true);
    wt.activate(weapon);
    wt.update(0.016, 0);
    const trail = weapon.userData._trail;
    const slot = trail.history[trail.head];
    expect(slot.tail.x).toBeCloseTo(10, 5);
    expect(slot.tail.z).toBeCloseTo(2 - 0.6, 5);
    expect(slot.tip.z).toBeCloseTo(2 + 0.8, 5);
  });

  it('inactive update 逐步排空 history 并最终 setDrawRange(0,0)', () => {
    const { wt, weapon, trail } = setup();
    wt.activate(weapon);
    wt.update(0.016, 0);
    wt.update(0.016, 1);
    expect(trail.count).toBeGreaterThanOrEqual(1);
    wt.deactivate(weapon);
    const startCount = trail.count;
    for (let i = 0; i < startCount + 1; i++) wt.update(0.016, 2 + i);
    expect(trail.count).toBe(0);
  });

  it('_tmpT/_tmpP 实例字段跨帧复用（不每帧 new Vector3）', () => {
    const { wt, weapon } = setup();
    wt.activate(weapon);
    wt.update(0.016, 0);
    const t0 = wt._tmpT, p0 = wt._tmpP;
    wt.update(0.016, 1);
    expect(wt._tmpT).toBe(t0);
    expect(wt._tmpP).toBe(p0);
  });

  it('多条 trail 互不干扰', () => {
    const scene = new THREE.Scene();
    const wt = new WeaponTrail(scene);
    const w1 = new THREE.Object3D(); scene.add(w1);
    const w2 = new THREE.Object3D(); scene.add(w2);
    wt.attach(w1, 0xff0000);
    wt.attach(w2, 0x00ff00);
    expect(wt._trails.length).toBe(2);
    wt.activate(w1);
    wt.activate(w2);
    wt.update(0.016, 0);
    expect(w1.userData._trail.count).toBe(1);
    expect(w2.userData._trail.count).toBe(1);
    wt.deactivate(w1);
    wt.update(0.016, 1);
    expect(w1.userData._trail.count).toBe(0);
    expect(w2.userData._trail.count).toBe(2);
  });

  // P1 修复：spawnAll 切换回合时清理所有 trail，防止 LineSegments 泄漏
  it('clear 移除所有 line、dispose 资源并解除 weaponMesh 引用', () => {
    const scene = new THREE.Scene();
    const wt = new WeaponTrail(scene);
    const w1 = new THREE.Object3D(); scene.add(w1);
    const w2 = new THREE.Object3D(); scene.add(w2);
    const t1 = wt.attach(w1);
    const t2 = wt.attach(w2);
    const line1 = t1.line, line2 = t2.line;
    expect(scene.children).toContain(line1);
    expect(scene.children).toContain(line2);
    wt.clear();
    expect(wt._trails.length).toBe(0);
    expect(scene.children).not.toContain(line1);
    expect(scene.children).not.toContain(line2);
    expect(w1.userData._trail).toBeUndefined();
    expect(w2.userData._trail).toBeUndefined();
  });

  it('clear 后可重新 attach（幂等）', () => {
    const scene = new THREE.Scene();
    const wt = new WeaponTrail(scene);
    const w = new THREE.Object3D(); scene.add(w);
    wt.attach(w);
    wt.clear();
    const t = wt.attach(w);
    expect(t).toBeTruthy();
    expect(wt._trails.length).toBe(1);
  });

  // E4 修复：按 mesh detach 单条 trail，波次尸体清理时避免误清玩家 trail
  it('detach 移除指定 trail 但保留其他', () => {
    const scene = new THREE.Scene();
    const wt = new WeaponTrail(scene);
    const w1 = new THREE.Object3D(); scene.add(w1);
    const w2 = new THREE.Object3D(); scene.add(w2);
    const t1 = wt.attach(w1);
    const t2 = wt.attach(w2);
    expect(wt._trails.length).toBe(2);
    wt.detach(w1);
    expect(wt._trails.length).toBe(1);
    expect(wt._trails[0]).toBe(t2);
    expect(scene.children).not.toContain(t1.line);
    expect(scene.children).toContain(t2.line);
    expect(w1.userData._trail).toBeUndefined();
    expect(w2.userData._trail).toBe(t2);
  });

  it('detach 后该 mesh 可重新 attach', () => {
    const scene = new THREE.Scene();
    const wt = new WeaponTrail(scene);
    const w = new THREE.Object3D(); scene.add(w);
    wt.attach(w);
    wt.detach(w);
    const t = wt.attach(w);
    expect(t).toBeTruthy();
    expect(wt._trails.length).toBe(1);
  });

  it('detach 未知 mesh 不抛错', () => {
    const scene = new THREE.Scene();
    const wt = new WeaponTrail(scene);
    expect(() => wt.detach(new THREE.Object3D())).not.toThrow();
    expect(() => wt.detach(null)).not.toThrow();
  });
});

describe('HitStop', () => {
  it('trigger/update 控制 active 和 timeScale', () => {
    const hs = new HitStop();
    expect(hs.active).toBe(false);
    expect(hs.timeScale).toBe(1);
    hs.trigger(0.08, 0.05);
    expect(hs.active).toBe(true);
    expect(hs.timeScale).toBe(0.05);
    hs.update(0.1);
    expect(hs.active).toBe(false);
    expect(hs.timeScale).toBe(1);
  });

  it('完美格挡慢动作：trigger(0.15, 0.3) 给出 0.3x 慢放并按时恢复', () => {
    const hs = new HitStop();
    hs.trigger(0.15, 0.3);
    expect(hs.active).toBe(true);
    expect(hs.timeScale).toBe(0.3);
    hs.update(0.14);
    expect(hs.active).toBe(true);
    expect(hs.timeScale).toBe(0.3);
    hs.update(0.02);
    expect(hs.active).toBe(false);
    expect(hs.timeScale).toBe(1);
  });
});
