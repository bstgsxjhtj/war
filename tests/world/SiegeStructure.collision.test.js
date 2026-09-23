import { describe, it, expect, vi, beforeAll } from 'vitest';
import { SiegeStructure } from '../../src/world/SiegeStructure.js';

describe('SiegeStructure collisionBoxes', () => {
  let siege;
  beforeAll(() => {
    const scene = { add: vi.fn() };
    const bus = { on: vi.fn(() => () => {}), emit: vi.fn() };
    siege = new SiegeStructure(scene, bus);
  });

  it('returns 9 boxes (2 gate walls + 1 gate + 6 extended walls)', () => {
    expect(siege.collisionBoxes.length).toBe(9);
  });

  it('left gate wall covers x[-7,-3] z[39,41]', () => {
    const left = siege.collisionBoxes.find(b => b.minX === -7 && b.maxX === -3);
    expect(left).toBeDefined();
    expect(left.minZ).toBe(39);
    expect(left.maxZ).toBe(41);
  });

  it('gate is narrow in z depth', () => {
    const gate = siege.collisionBoxes.find(b => b.minX === -2 && b.maxX === 2);
    expect(gate).toBeDefined();
    expect(gate.maxZ - gate.minZ).toBeLessThan(1);
  });

  it('extended walls at x=9,13,17 and x=-9,-13,-17', () => {
    const boxes = siege.collisionBoxes;
    for (const cx of [9, 13, 17, -9, -13, -17]) {
      const box = boxes.find(b => b.minX === cx - 2 && b.maxX === cx + 2);
      expect(box).toBeDefined();
      expect(box.minZ).toBe(39);
      expect(box.maxZ).toBe(41);
    }
  });
});
