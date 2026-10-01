import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Environment } from '../../src/world/Environment.js';

function mkEnv() {
  const terrain = { heightAt: () => 0 };
  return new Environment(terrain, null);
}

describe('Environment InstancedMesh（P0-2）', () => {
  it('树用 InstancedMesh 而非 Group+Mesh 组合（4 drawcall 替代 ~136）', () => {
    const env = mkEnv();
    expect(env._treeMeshes).toBeDefined();
    expect(env._treeMeshes.length).toBe(4);
    for (const m of env._treeMeshes) expect(m).toBeInstanceOf(THREE.InstancedMesh);
    const trunk = env._treeMeshes[0];
    expect(trunk.count).toBe(34);
    expect(trunk.castShadow).toBe(true);
    for (let j = 1; j <= 3; j++) {
      const leaf = env._treeMeshes[j];
      expect(leaf.count).toBe(34);
      expect(leaf.castShadow).toBe(true);
      expect(leaf.instanceColor).not.toBeNull();
    }
  });

  it('树碰撞体数量与实例数一致', () => {
    const env = mkEnv();
    const treeCols = env.collisionBoxes;
    expect(treeCols.length).toBeGreaterThanOrEqual(34);
  });

  it('石用单个 InstancedMesh（1 drawcall 替代 24）', () => {
    const env = mkEnv();
    expect(env._rockMesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(env._rockMesh.count).toBe(24);
    expect(env._rockMesh.castShadow).toBe(true);
    expect(env._rockMesh.receiveShadow).toBe(true);
  });

  it('残骸用至多 2 个 InstancedMesh（盾 + 矛）', () => {
    const env = mkEnv();
    expect(env._wreckMeshes).toBeDefined();
    expect(env._wreckMeshes.length).toBeLessThanOrEqual(2);
    for (const m of env._wreckMeshes) expect(m).toBeInstanceOf(THREE.InstancedMesh);
    const total = env._wreckMeshes.reduce((s, m) => s + m.count, 0);
    expect(total).toBe(16);
  });

  it('layout 模式同样产出 InstancedMesh', () => {
    const terrain = { heightAt: () => 0 };
    const env = new Environment(terrain, { trees: 10, rocks: 8 });
    expect(env._treeMeshes[0].count).toBe(10);
    expect(env._rockMesh.count).toBe(8);
    expect(env._wreckMeshes.reduce((s, m) => s + m.count, 0)).toBe(10);
  });

  it('dispose 不抛异常（InstancedMesh 几何/材质可释放）', () => {
    const env = mkEnv();
    expect(() => env.dispose()).not.toThrow();
  });
});
