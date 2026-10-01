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

  it('C2-16: 浪花反向旋转抵消水面 -90° 父级旋转（局部 y/z 对世界轴一致）', () => {
    const water = new Water(220, 20);
    // 水面网格本身绕 x 旋转 -90°；浪花若同向则水平散布被映射到世界竖直方向 → 粒子悬空
    expect(water.mesh.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
    expect(water._splash.rotation.x).toBeCloseTo(Math.PI / 2, 5);
    expect(water.mesh.children).toContain(water._splash);
  });
});
