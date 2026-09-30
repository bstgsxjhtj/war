// @vitest-environment jsdom
import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';
import { Water } from '../../src/world/Water.js';

describe('Water setSize 地图切换重建（E12）', () => {
  it('setSize 改变宽度并重建主几何体', () => {
    const water = new Water(220, 20);
    expect(water.width).toBe(220);
    const oldGeo = water.mesh.geometry;
    water.setSize(360);
    expect(water.width).toBe(360);
    expect(water.mesh.geometry).not.toBe(oldGeo);
  });

  it('setSize 相同宽度时为 no-op', () => {
    const water = new Water(220, 20);
    const oldGeo = water.mesh.geometry;
    water.setSize(220);
    expect(water.mesh.geometry).toBe(oldGeo);
  });

  it('setSize 旧几何体被 dispose', () => {
    const water = new Water(220, 20);
    const oldGeo = water.mesh.geometry;
    const spy = vi.spyOn(oldGeo, 'dispose');
    water.setSize(360);
    expect(spy).toHaveBeenCalledOnce();
  });
});
