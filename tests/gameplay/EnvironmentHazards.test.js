import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentHazards } from '../../src/gameplay/EnvironmentHazards.js';

describe('EnvironmentHazards', () => {
  let env, terrain, char;

  beforeEach(() => {
    terrain = {
      isWater: vi.fn((x, z) => z >= -10 && z <= 10 && Math.abs(x) >= 4)
    };
    env = new EnvironmentHazards(null);
    env.setTerrain(terrain);
    char = {
      alive: true,
      position: { x: 0, z: 0 },
      takeDamage: vi.fn()
    };
  });

  it('deep water deals continuous DPS', () => {
    char.position = { x: 10, z: 0 };
    env.update(0.5, [char]);
    expect(char.takeDamage).toHaveBeenCalledWith(20, false, null, expect.any(Number));
  });

  it('dry ground deals no damage', () => {
    char.position = { x: 0, z: 50 };
    env.update(0.5, [char]);
    expect(char.takeDamage).not.toHaveBeenCalled();
  });

  it('dead characters are skipped', () => {
    char.alive = false;
    char.position = { x: 10, z: 0 };
    env.update(0.5, [char]);
    expect(char.takeDamage).not.toHaveBeenCalled();
  });

  it('lightning strike damages nearby characters', () => {
    char.position = { x: 20, z: 30 };
    env.onLightningStrike({ x: 20, z: 30 });
    env.update(0.1, [char]);
    expect(char.takeDamage).toHaveBeenCalledWith(50, true, null, expect.any(Number));
  });

  it('lightning outside radius deals no damage', () => {
    char.position = { x: 20, z: 20 };
    env.onLightningStrike({ x: 0, z: 0 });
    env.update(0.1, [char]);
    expect(char.takeDamage).not.toHaveBeenCalled();
  });

  it('lightning strike fires only once', () => {
    char.position = { x: 20, z: 30 };
    env.onLightningStrike({ x: 20, z: 30 });
    env.update(0.1, [char]);
    env.update(0.1, [char]);
    expect(char.takeDamage).toHaveBeenCalledTimes(1);
  });

  it('wall collision deals continuous damage', () => {
    env.addWallBox({ minX: -7, maxX: -3, minZ: 39, maxZ: 41 });
    char.position = { x: -5, z: 40 };
    env.update(1, [char]);
    expect(char.takeDamage).toHaveBeenCalledWith(15, false, null, expect.any(Number));
  });

  it('outside wall box deals no damage', () => {
    env.addWallBox({ minX: -7, maxX: -3, minZ: 39, maxZ: 41 });
    char.position = { x: 0, z: 0 };
    env.update(1, [char]);
    expect(char.takeDamage).not.toHaveBeenCalled();
  });

  it('no terrain set means no water damage', () => {
    const env2 = new EnvironmentHazards(null);
    char.position = { x: 10, z: 0 };
    env2.update(0.5, [char]);
    expect(char.takeDamage).not.toHaveBeenCalled();
  });

  it('multiple characters each checked independently', () => {
    const char2 = { alive: true, position: { x: 0, z: 50 }, takeDamage: vi.fn() };
    char.position = { x: 10, z: 0 };
    env.update(0.5, [char, char2]);
    expect(char.takeDamage).toHaveBeenCalled();
    expect(char2.takeDamage).not.toHaveBeenCalled();
  });
});
