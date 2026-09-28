// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { deepDispose } from '../../src/render/disposeUtils.js';

describe('deepDispose (P1-5)', () => {
  it('递归 dispose 子树所有 mesh 的 geometry 与 material', () => {
    const root = new THREE.Group();
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const child = new THREE.Group();
    const m2 = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshStandardMaterial());
    child.add(m2); root.add(m1); root.add(child);
    const g1 = vi.spyOn(m1.geometry, 'dispose');
    const mt1 = vi.spyOn(m1.material, 'dispose');
    const g2 = vi.spyOn(m2.geometry, 'dispose');
    const mt2 = vi.spyOn(m2.material, 'dispose');
    deepDispose(root);
    expect(g1).toHaveBeenCalled();
    expect(mt1).toHaveBeenCalled();
    expect(g2).toHaveBeenCalled();
    expect(mt2).toHaveBeenCalled();
  });

  it('数组材质的每个材质都被 dispose', () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]);
    const spies = m.material.map(mt => vi.spyOn(mt, 'dispose'));
    deepDispose(m);
    for (const s of spies) expect(s).toHaveBeenCalled();
  });

  it('材质上的纹理 map 一并 dispose', () => {
    const tex = new THREE.Texture();
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: tex }));
    const ts = vi.spyOn(tex, 'dispose');
    deepDispose(m);
    expect(ts).toHaveBeenCalled();
  });

  it('Points/Sprite 同样被清理', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial());
    const gs = vi.spyOn(g, 'dispose');
    const ms = vi.spyOn(pts.material, 'dispose');
    deepDispose(pts);
    expect(gs).toHaveBeenCalled();
    expect(ms).toHaveBeenCalled();
  });

  it('对 null/undefined 安全无操作', () => {
    expect(() => deepDispose(null)).not.toThrow();
    expect(() => deepDispose(undefined)).not.toThrow();
  });
});
