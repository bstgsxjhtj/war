// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DodgeGhosts } from '../../src/render/DodgeGhosts.js';

describe('DodgeGhosts', () => {
  it('spawnGhost 生成半透明残影 mesh 并挂到 parent', () => {
    const parent = new THREE.Group();
    const g = new DodgeGhosts(parent);
    g.spawnGhost(new THREE.Vector3(1, 0, 2));
    expect(parent.children.length).toBe(1);
    const mesh = parent.children[0];
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.position.x).toBe(1);
    expect(mesh.position.z).toBe(2);
    expect(mesh.material.opacity).toBeGreaterThan(0);
    expect(mesh.material.transparent).toBe(true);
  });

  it('update 使残影透明度衰减，寿命尽后自动移除', () => {
    const parent = new THREE.Group();
    const g = new DodgeGhosts(parent);
    g.spawnGhost(new THREE.Vector3(0, 0, 0));
    const o0 = parent.children[0].material.opacity;
    g.update(0.1);
    expect(parent.children[0].material.opacity).toBeLessThan(o0);
    g.update(0.4);
    expect(parent.children.length).toBe(0);
  });

  it('begin 后跟随角色每 0.08s 采样一个残影，闪避窗口结束停止', () => {
    const parent = new THREE.Group();
    const g = new DodgeGhosts(parent);
    const char = { position: new THREE.Vector3(0, 0, 0) };
    g.begin(char);
    g.update(0.08);
    char.position.x = 3;
    g.update(0.08);
    expect(parent.children.length).toBe(2);
    expect(parent.children[0].position.x).toBe(0); // 快照而非引用
    expect(parent.children[1].position.x).toBe(3);
    // 0.32s 闪避窗口过后不再生成新位置残影
    g.update(0.3);
    char.position.x = 9;
    g.update(0.2);
    const xs = parent.children.map((m) => m.position.x);
    expect(xs).not.toContain(9);
  });

  it('dispose 清空所有残影', () => {
    const parent = new THREE.Group();
    const g = new DodgeGhosts(parent);
    g.spawnGhost(new THREE.Vector3(0, 0, 0));
    g.spawnGhost(new THREE.Vector3(1, 0, 0));
    g.dispose();
    expect(parent.children.length).toBe(0);
  });
});
