// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TelegraphIndicator } from '../../src/render/TelegraphIndicator.js';

describe('TelegraphIndicator', () => {
  it('构造：创建地圈 mesh 挂到 parent，初始不可见', () => {
    const parent = new THREE.Group();
    const t = new TelegraphIndicator(parent);
    expect(t.mesh).toBeInstanceOf(THREE.Mesh);
    expect(parent.children).toContain(t.mesh);
    expect(t.active).toBe(false);
    expect(t.mesh.visible).toBe(false);
    expect(t.mesh.material.opacity).toBe(0);
  });

  it('show() 激活并可见', () => {
    const t = new TelegraphIndicator(new THREE.Group());
    t.show(0.45);
    expect(t.active).toBe(true);
    expect(t.mesh.visible).toBe(true);
  });

  it('hide() 取消并隐藏，透明度归零', () => {
    const t = new TelegraphIndicator(new THREE.Group());
    t.show(0.45);
    t.hide();
    expect(t.active).toBe(false);
    expect(t.mesh.visible).toBe(false);
    expect(t.mesh.material.opacity).toBe(0);
  });

  it('update 活跃时缩放随进度增长且不透明度脉动为正', () => {
    const t = new TelegraphIndicator(new THREE.Group());
    t.show(0.45);
    const s0 = t.mesh.scale.x;
    t.update(0.225);
    expect(t.mesh.scale.x).toBeGreaterThan(s0);
    expect(t.mesh.material.opacity).toBeGreaterThan(0);
  });

  it('update 非活跃时无变化', () => {
    const t = new TelegraphIndicator(new THREE.Group());
    const s0 = t.mesh.scale.x;
    t.update(0.1);
    expect(t.mesh.scale.x).toBe(s0);
    expect(t.active).toBe(false);
  });

  it('dispose 从 parent 移除 mesh', () => {
    const parent = new THREE.Group();
    const t = new TelegraphIndicator(parent);
    expect(parent.children.length).toBe(1);
    t.dispose();
    expect(parent.children.length).toBe(0);
  });
});
