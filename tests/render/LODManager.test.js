// @vitest-environment jsdom
import * as THREE from 'three';
import { LODManager } from '../../src/render/LODManager.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeChar(team = 1, x = 0, z = 50) {
  const root = new THREE.Group();
  const mk = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial()); root.add(m); return m; };
  return {
    team, alive: true,
    position: new THREE.Vector3(x, 0, z),
    root,
    cape: mk(), emblem: mk(), factionFlag: mk(), rKneeguard: mk(), lKneeguard: mk(),
    rPauldron: mk(), lPauldron: mk(), visor: mk(), belt: mk(), chestplate: mk(),
    rLeg: mk(), torso: mk(), head: mk(),
    _lodLevel: 0
  };
}

describe('LODManager', () => {
  let camera, scene, lod;
  beforeEach(() => {
    camera = { position: new THREE.Vector3(0, 0, 0) };
    scene = { add: vi.fn() };
    lod = new LODManager({ camera, scene, thresholds: { mid: 25, far: 55, hidden: 110 } });
  });

  it('register 添加角色，unregister 移除并恢复全部可见', () => {
    const c = makeChar(1, 0, 5);
    lod.register(c);
    expect(lod.chars.length).toBe(1);
    lod.unregister(c);
    expect(lod.chars.length).toBe(0);
    expect(c.root.visible).toBe(true);
    expect(c.cape.visible).toBe(true);
  });

  it('近距离角色 level=0 全部部件可见', () => {
    const c = makeChar(1, 0, 10);
    lod.register(c);
    lod.tick();
    expect(c._lodLevel).toBe(0);
    expect(c.cape.visible).toBe(true);
    expect(c.rPauldron.visible).toBe(true);
    expect(c.chestplate.visible).toBe(true);
  });

  it('中距离 level=1 隐藏装饰部件（披风/徽章/旗帜/护膝）但保留主要部件', () => {
    const c = makeChar(1, 0, 30);
    lod.register(c);
    lod.tick();
    expect(c._lodLevel).toBe(1);
    expect(c.cape.visible).toBe(false);
    expect(c.factionFlag.visible).toBe(false);
    expect(c.rKneeguard.visible).toBe(false);
    expect(c.rPauldron.visible).toBe(true);
    expect(c.chestplate.visible).toBe(true);
  });

  it('远距离 level=2 隐藏 root 使用代理 InstancedMesh', () => {
    const c = makeChar(1, 0, 60);
    lod.register(c);
    lod.tick();
    expect(c._lodLevel).toBe(2);
    expect(c.root.visible).toBe(false);
  });

  it('极远距离 level=3 隐藏 root', () => {
    const c = makeChar(1, 0, 120);
    lod.register(c);
    lod.tick();
    expect(c._lodLevel).toBe(3);
    expect(c.root.visible).toBe(false);
  });

  it('远距离角色更新 proxy InstancedMesh count', () => {
    const c1 = makeChar(1, 0, 60);
    const c2 = makeChar(0, 0, 70);
    lod.register(c1);
    lod.register(c2);
    lod.tick();
    expect(lod.proxyCount).toBe(2);
  });

  it('近+中距离角色不增加 proxy count', () => {
    const near = makeChar(1, 0, 10);
    const mid = makeChar(1, 0, 30);
    lod.register(near);
    lod.register(mid);
    lod.tick();
    expect(lod.proxyCount).toBe(0);
  });

  it('角色从远移近时恢复 root 可见并减少 proxy count', () => {
    const c = makeChar(1, 0, 60);
    lod.register(c);
    lod.tick();
    expect(c.root.visible).toBe(false);
    expect(lod.proxyCount).toBe(1);
    c.position.set(0, 0, 10);
    lod.tick();
    expect(c.root.visible).toBe(true);
    expect(lod.proxyCount).toBe(0);
  });

  it('死亡角色不参与 LOD 更新', () => {
    const c = makeChar(1, 0, 60);
    c.alive = false;
    lod.register(c);
    lod.tick();
    expect(lod.proxyCount).toBe(0);
  });

  it('setEnabled(false) 时不执行任何 LOD 逻辑', () => {
    const c = makeChar(1, 0, 60);
    lod.register(c);
    lod.setEnabled(false);
    lod.tick();
    expect(c._lodLevel).toBe(0);
    expect(c.root.visible).toBe(true);
    expect(lod.proxyCount).toBe(0);
  });

  it('setQuality(low) 缩减阈值使更近距离就降级', () => {
    const c = makeChar(1, 0, 30);
    lod.register(c);
    lod.setQuality('low');
    lod.tick();
    expect(c._lodLevel).toBeGreaterThanOrEqual(1);
  });

  it('clear 清空角色列表并恢复全部可见', () => {
    const c = makeChar(1, 0, 60);
    lod.register(c);
    lod.tick();
    expect(c.root.visible).toBe(false);
    lod.clear();
    expect(lod.chars.length).toBe(0);
    expect(c.root.visible).toBe(true);
  });

  it('dispose 清理资源', () => {
    const c = makeChar(1, 0, 60);
    lod.register(c);
    lod.dispose();
    expect(lod.chars.length).toBe(0);
  });
});
