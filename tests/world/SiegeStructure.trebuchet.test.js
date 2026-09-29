import * as THREE from 'three';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { SiegeStructure } from '../../src/world/SiegeStructure.js';
vi.mock('../../src/render/TextureFactory.js', () => ({ TextureFactory: { brick: () => ({ isTexture: true }), noise: () => ({ isTexture: true }), rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }) } }));

describe('SiegeStructure trebuchet', () => {
  let siege, scene, combat;

  beforeAll(() => {
    scene = { add: vi.fn() };
    const bus = { on: vi.fn(() => () => {}), emit: vi.fn() };
    siege = new SiegeStructure(scene, bus);
  });

  beforeEach(() => {
    combat = { arrows: [] };
    siege.trebuchet.occupied = false;
    siege.trebuchet.team = -1;
    siege.trebuchet.timer = 0;
  });

  it('update not occupied does nothing', () => {
    siege.update(0.1, combat);
    expect(combat.arrows.length).toBe(0);
  });

  it('update occupied without enemies fires at gate', () => {
    siege.trebuchet.occupied = true;
    siege.trebuchet.team = 0;
    siege.update(0.1, combat);
    expect(combat.arrows.length).toBe(1);
    const vel = combat.arrows[0].vel;
    expect(vel.x).toBeCloseTo(10);
  });

  it('update with enemies targets nearest alive enemy', () => {
    siege.trebuchet.occupied = true;
    siege.trebuchet.team = 0;
    const enemies = [
      { alive: true, team: 1, position: new THREE.Vector3(10, 0, -10) },
      { alive: true, team: 1, position: new THREE.Vector3(30, 0, -10) },
      { alive: false, team: 1, position: new THREE.Vector3(5, 0, -10) },
    ];
    siege.update(0.1, combat, enemies);
    expect(combat.arrows.length).toBe(1);
    const vel = combat.arrows[0].vel;
    expect(vel.x).toBeCloseTo(15);
  });

  it('update skips same-team enemies', () => {
    siege.trebuchet.occupied = true;
    siege.trebuchet.team = 0;
    const enemies = [
      { alive: true, team: 0, position: new THREE.Vector3(5, 0, -10) },
      { alive: true, team: 1, position: new THREE.Vector3(30, 0, -10) },
    ];
    siege.update(0.1, combat, enemies);
    const vel = combat.arrows[0].vel;
    expect(vel.x).toBeCloseTo(25);
  });

  it('tryOccupy allows recapture by different team', () => {
    siege.trebuchet.occupied = true;
    siege.trebuchet.team = 1;
    const char = { alive: true, team: 0, position: siege.trebuchet.position.clone() };
    expect(siege.tryOccupy(char)).toBe(true);
    expect(siege.trebuchet.team).toBe(0);
  });

  it('tryOccupy ignores same team when occupied', () => {
    siege.trebuchet.occupied = true;
    siege.trebuchet.team = 1;
    const char = { alive: true, team: 1, position: siege.trebuchet.position.clone() };
    expect(siege.tryOccupy(char)).toBe(false);
  });

  it('tryOccupy captures when unoccupied', () => {
    siege.trebuchet.occupied = false;
    const char = { alive: true, team: 0, position: siege.trebuchet.position.clone() };
    expect(siege.tryOccupy(char)).toBe(true);
    expect(siege.trebuchet.occupied).toBe(true);
    expect(siege.trebuchet.team).toBe(0);
  });

  it('tryOccupy ignores dead characters', () => {
    siege.trebuchet.occupied = false;
    const char = { alive: false, team: 0, position: siege.trebuchet.position.clone() };
    expect(siege.tryOccupy(char)).toBe(false);
    expect(siege.trebuchet.occupied).toBe(false);
  });
});
