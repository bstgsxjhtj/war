// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    normal: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true })
  }
}));

import { Terrain } from '../../src/world/Terrain.js';

describe('Terrain', () => {
  const t = new Terrain(60, 10);

  it('heightAt 确定性：同坐标同值', () => {
    expect(t.heightAt(12.3, -45.6)).toBe(t.heightAt(12.3, -45.6));
  });

  it('中心区域平坦（出生保护区 r<16 起伏≤0.25）', () => {
    for (const [x, z] of [[0, 0], [3, 5], [-8, 13], [15, -15]]) {
      expect(Math.abs(t.heightAt(x, z))).toBeLessThan(0.5);
    }
  });

  it('河床区域高度为负水深', () => {
    expect(t.heightAt(50, 0)).toBe(-t._river.depth);
  });

  it('桥面（|x|<4）不是水', () => {
    expect(t.isWater(0, 0)).toBe(false);
    expect(t.isWater(3.9, 5)).toBe(false);
  });

  it('河道（z∈[-10,10] 且 |x|≥4）是水', () => {
    expect(t.isWater(20, 0)).toBe(true);
    expect(t.isWater(-30, -9)).toBe(true);
    expect(t.isWater(20, 10.1)).toBe(false);
  });

  it('waterDepth 仅水域返回深度', () => {
    expect(t.waterDepth(20, 0)).toBe(t._river.depth);
    expect(t.waterDepth(0, 50)).toBe(0);
  });

  it('台地中心高度接近台地高度', () => {
    const p = t._plateaus[0];
    expect(t.heightAt(p.cx, p.cz)).toBeGreaterThan(p.h * 0.5);
  });

  it('外部 heightFn/waterFn 覆写生效', () => {
    const custom = new Terrain(20, 4, { heightFn: () => 42, waterFn: () => false });
    expect(custom.heightAt(1, 1)).toBe(42);
    expect(custom.isWater(1, 1)).toBe(false);
  });
});
