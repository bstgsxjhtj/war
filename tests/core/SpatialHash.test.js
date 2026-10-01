import { SpatialHash } from '../../src/core/SpatialHash.js';
import { describe, it, expect, beforeEach } from 'vitest';

const mk = (x, z, extra = {}) => ({ position: { x, y: extra.y ?? 0, z }, capsule: { radius: extra.r ?? 0.5 }, ...extra.tag ? { tag: extra.tag } : {} });

describe('SpatialHash', () => {
  let h;
  beforeEach(() => { h = new SpatialHash(10); });

  it('queryRadius 返回半径内（含 capsule 半径宽容）的对象', () => {
    const near = mk(1, 0);
    const edge = mk(5.4, 0);   // 5.4 <= radius(5)+cap(0.5)=5.5
    const far = mk(20, 0);
    h.insert(near); h.insert(edge); h.insert(far);
    const r = h.queryRadius({ x: 0, y: 0, z: 0 }, 5);
    expect(r).toContain(near);
    expect(r).toContain(edge);
    expect(r).not.toContain(far);
  });

  it('queryRadius 跨多个网格正确（cellSize=10，负坐标）', () => {
    const a = mk(-15, -15);
    const b = mk(-1, -1);
    h.insert(a); h.insert(b);
    const r = h.queryRadius({ x: -16, y: 0, z: -16 }, 3);
    expect(r).toContain(a);
    expect(r).not.toContain(b);
  });

  it('queryRadius 复用结果数组（返回同一引用）', () => {
    h.insert(mk(1, 1));
    const r1 = h.queryRadius({ x: 0, y: 0, z: 0 }, 5);
    const r2 = h.queryRadius({ x: 0, y: 0, z: 0 }, 5);
    expect(r1).toBe(r2);
  });

  it('queryNearest 返回最近对象', () => {
    const a = mk(8, 0);
    const b = mk(2, 0);
    const c = mk(20, 0);
    h.insert(a); h.insert(b); h.insert(c);
    expect(h.queryNearest({ x: 0, y: 0, z: 0 })).toBe(b);
  });

  it('queryNearest 支持 filterFn 过滤', () => {
    const dead = mk(1, 0, { tag: 'dead' });
    const alive = mk(4, 0, { tag: 'alive' });
    h.insert(dead); h.insert(alive);
    const found = h.queryNearest({ x: 0, y: 0, z: 0 }, (e) => e.tag === 'alive');
    expect(found).toBe(alive);
  });

  it('queryNearest 无匹配返回 null', () => {
    h.insert(mk(3, 3, { tag: 'x' }));
    expect(h.queryNearest({ x: 0, y: 0, z: 0 }, (e) => e.tag === 'nope')).toBeNull();
  });

  it('queryNearest 空网格返回 null', () => {
    expect(h.queryNearest({ x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('clear 清空所有对象', () => {
    h.insert(mk(1, 1));
    h.clear();
    expect(h.queryRadius({ x: 0, y: 0, z: 0 }, 50).length).toBe(0);
    expect(h.queryNearest({ x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('y 轴差异计入距离判定', () => {
    const sameXZ = mk(0, 0, { y: 10 });
    h.insert(sameXZ);
    expect(h.queryRadius({ x: 0, y: 0, z: 0 }, 5)).not.toContain(sameXZ);
    expect(h.queryRadius({ x: 0, y: 0, z: 0 }, 11)).toContain(sameXZ);
  });
});