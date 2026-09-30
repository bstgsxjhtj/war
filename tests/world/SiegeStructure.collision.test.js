import { describe, it, expect, vi, beforeAll } from 'vitest';
import { SiegeStructure } from '../../src/world/SiegeStructure.js';
vi.mock('../../src/render/TextureFactory.js', () => ({ TextureFactory: { brick: () => ({ isTexture: true }), noise: () => ({ isTexture: true }), rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }) } }));

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

describe('SiegeStructure reset', () => {
  it('复原城门与投石机（供每回合开局调用）', () => {
    const scene = { add: vi.fn() };
    const bus = { on: vi.fn(() => () => {}), emit: vi.fn() };
    const siege = new SiegeStructure(scene, bus);
    siege.damageGate(500, null);
    expect(siege.gate.broken).toBe(true);
    siege.tryOccupy({ alive: true, team: 0, position: siege.trebuchet.position.clone() });
    expect(siege.trebuchet.occupied).toBe(true);
    siege.reset();
    expect(siege.gate.broken).toBe(false);
    expect(siege.gate.hp).toBe(siege.gate.maxHp);
    expect(siege.gate.group.visible).toBe(true);
    expect(siege.trebuchet.occupied).toBe(false);
    expect(siege.trebuchet.team).toBe(-1);
  });
});
