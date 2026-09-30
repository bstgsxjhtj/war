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

  describe('poison zones', () => {
    it('poison zone damages character within radius (default dps)', () => {
      env.setHazardZones([{ type: 'poison', x: 0, z: 0, radius: 10 }]);
      char.position = { x: 5, z: 0 };
      env.update(0.5, [char]);
      expect(char.takeDamage).toHaveBeenCalledWith(12.5, false, null, expect.any(Number));
    });

    it('poison zone respects custom dps', () => {
      env.setHazardZones([{ type: 'poison', x: 0, z: 0, radius: 10, dps: 50 }]);
      char.position = { x: 5, z: 0 };
      env.update(0.5, [char]);
      expect(char.takeDamage).toHaveBeenCalledWith(25, false, null, expect.any(Number));
    });

    it('poison zone does not damage character outside radius', () => {
      env.setHazardZones([{ type: 'poison', x: 0, z: 0, radius: 10 }]);
      char.position = { x: 0, z: 50 };
      env.update(0.5, [char]);
      expect(char.takeDamage).not.toHaveBeenCalled();
    });

    it('poison stacks with water damage', () => {
      env.setHazardZones([{ type: 'poison', x: 10, z: 0, radius: 5 }]);
      char.position = { x: 10, z: 0 };
      env.update(1, [char]);
      expect(char.takeDamage).toHaveBeenCalledTimes(2);
    });
  });

  describe('oil zones', () => {
    it('oil ignites when lightning overlaps and damages chars in oil radius', () => {
      env.setHazardZones([{ type: 'oil', x: 40, z: 0, radius: 10 }]);
      char.position = { x: 45, z: 0 };
      env.onLightningStrike({ x: 35, z: 0 });
      env.update(0.1, [char]);
      expect(char.takeDamage).toHaveBeenCalledWith(80, true, null, expect.any(Number));
    });

    it('char outside oil radius takes no oil damage on ignition', () => {
      env.setHazardZones([{ type: 'oil', x: 0, z: 0, radius: 10 }]);
      char.position = { x: 0, z: 50 };
      env.onLightningStrike({ x: 0, z: 0 });
      env.update(0.1, [char]);
      expect(char.takeDamage).not.toHaveBeenCalled();
    });

    it('oil zone consumed after ignition', () => {
      env.setHazardZones([{ type: 'oil', x: 40, z: 0, radius: 10 }]);
      char.position = { x: 45, z: 0 };
      env.onLightningStrike({ x: 35, z: 0 });
      env.update(0.1, [char]);
      char.takeDamage.mockClear();
      env.onLightningStrike({ x: 35, z: 0 });
      env.update(0.1, [char]);
      expect(char.takeDamage).not.toHaveBeenCalledWith(80, true, null, expect.any(Number));
    });

    it('distant lightning does not ignite oil', () => {
      env.setHazardZones([{ type: 'oil', x: 0, z: 0, radius: 10 }]);
      char.position = { x: 0, z: 50 };
      env.onLightningStrike({ x: 50, z: 0 });
      env.update(0.1, [char]);
      expect(char.takeDamage).not.toHaveBeenCalled();
    });
  });

  describe('setHazardZones', () => {
    it('replaces existing zones on re-set', () => {
      env.setHazardZones([{ type: 'poison', x: 0, z: 0, radius: 10 }]);
      char.position = { x: 2, z: 0 };
      env.update(0.5, [char]);
      expect(char.takeDamage).toHaveBeenCalledTimes(1);
      char.takeDamage.mockClear();
      env.setHazardZones(null);
      env.update(0.5, [char]);
      expect(char.takeDamage).not.toHaveBeenCalled();
    });

    it('handles undefined gracefully', () => {
      env.setHazardZones(undefined);
      char.position = { x: 2, z: 0 };
      env.update(0.5, [char]);
      expect(char.takeDamage).not.toHaveBeenCalled();
    });
  });

  describe('setHazardBoost (P0-1)', () => {
    let env, terrain, char;
    beforeEach(() => {
      terrain = { isWater: vi.fn(() => true) };
      env = new EnvironmentHazards(null);
      env.setTerrain(terrain);
      char = { alive: true, position: { x: 10, z: 0 }, takeDamage: vi.fn() };
    });

    it('默认 boost=1 水伤害不变', () => {
      env.update(0.5, [char]);
      expect(char.takeDamage).toHaveBeenCalledWith(20, false, null, expect.any(Number));
    });

    it('boost=1.5 水伤害 ×1.5', () => {
      env.setHazardBoost(1.5);
      env.update(0.5, [char]);
      expect(char.takeDamage).toHaveBeenCalledWith(30, false, null, expect.any(Number));
    });

    it('boost 放大闪电伤害', () => {
      env.setHazardBoost(2);
      char.position = { x: 20, z: 30 };
      env.onLightningStrike({ x: 20, z: 30 });
      env.update(0.1, [char]);
      expect(char.takeDamage).toHaveBeenCalledWith(100, true, null, expect.any(Number));
    });

    it('boost 放大毒区伤害', () => {
      env.setHazardBoost(1.6);
      env.setHazardZones([{ type: 'poison', x: 0, z: 0, radius: 10 }]);
      char.position = { x: 5, z: 0 };
      env.update(0.5, [char]);
      expect(char.takeDamage).toHaveBeenCalledWith(20, false, null, expect.any(Number));
    });

    it('boost 放大墙壁伤害', () => {
      env.setHazardBoost(2);
      env.addWallBox({ minX: -7, maxX: -3, minZ: 39, maxZ: 41 });
      char.position = { x: -5, z: 40 };
      env.update(1, [char]);
      expect(char.takeDamage).toHaveBeenCalledWith(30, false, null, expect.any(Number));
    });

    it('boost=0 回退为 1（安全）', () => {
      env.setHazardBoost(0);
      env.update(0.5, [char]);
      expect(char.takeDamage).toHaveBeenCalledWith(20, false, null, expect.any(Number));
    });

    it('boost 放大油料点燃伤害', () => {
      env.setHazardBoost(2);
      env.setHazardZones([{ type: 'oil', x: 40, z: 0, radius: 10 }]);
      char.position = { x: 45, z: 0 };
      env.onLightningStrike({ x: 35, z: 0 });
      env.update(0.1, [char]);
      expect(char.takeDamage).toHaveBeenCalledWith(160, true, null, expect.any(Number));
    });
  });

  it('F5: 使用 performance.now() 而非 Date.now()（now 值为秒级小数，非 epoch 时间）', () => {
    char.position = { x: 10, z: 0 };
    env.update(0.5, [char]);
    const nowArg = char.takeDamage.mock.calls[0][3];
    expect(nowArg).toBeLessThan(10000);
  });
});
