import { describe, it, expect } from 'vitest';
import { WEAPON_STATS, COMBAT, CAMERA, EXECUTE } from '../../src/core/constants/balance.js';

describe('P2-8 balance.js 魔法数字收敛', () => {
  it('COMBAT 包含 shake/hitstop/backstab 等阈值', () => {
    expect(COMBAT.SHAKE_MAP).toBeDefined();
    expect(COMBAT.SHAKE_MAP.length).toBeGreaterThanOrEqual(3);
    expect(COMBAT.HITSTOP_MAP).toBeDefined();
    expect(COMBAT.HITSTOP_MAX).toBeGreaterThan(0);
    expect(COMBAT.SHAKE_MAX).toBeGreaterThan(0);
    expect(COMBAT.HEAVY_SHAKE_BONUS).toBeGreaterThan(0);
    expect(COMBAT.HEAVY_HITSTOP_BONUS).toBeGreaterThan(0);
    expect(COMBAT.BACKSTAB_ANGLE).toBeGreaterThan(0);
    expect(COMBAT.CRIT_MUL).toBeGreaterThan(1);
    expect(COMBAT.EXECUTE_HP_RATIO).toBeGreaterThan(0);
    expect(COMBAT.EXECUTE_DAMAGE).toBeGreaterThan(1000);
    expect(COMBAT.EXECUTE_RANGE).toBeGreaterThan(0);
  });

  it('CAMERA 包含 FOV 与震动相关常量', () => {
    expect(CAMERA.FOV_DEFAULT).toBeGreaterThan(40);
    expect(CAMERA.FOV_AIM).toBeLessThan(CAMERA.FOV_DEFAULT);
    expect(CAMERA.FOV_PERFECT_DODGE).toBeLessThan(CAMERA.FOV_DEFAULT);
    expect(CAMERA.FOV_PERFECT_BLOCK).toBeLessThan(CAMERA.FOV_DEFAULT);
    expect(CAMERA.SHAKE_MAX).toBeGreaterThan(0);
    expect(CAMERA.SHAKE_DECAY).toBeLessThan(1);
    expect(CAMERA.SHAKE_LERP).toBeGreaterThan(0);
    expect(CAMERA.DIST_AIM).toBeGreaterThan(0);
    expect(CAMERA.HGT_AIM).toBeGreaterThan(0);
  });

  it('EXECUTE 常量与 COMBAT 一致', () => {
    expect(EXECUTE.HP_RATIO).toBe(COMBAT.EXECUTE_HP_RATIO);
    expect(EXECUTE.DAMAGE).toBe(COMBAT.EXECUTE_DAMAGE);
    expect(EXECUTE.RANGE).toBe(COMBAT.EXECUTE_RANGE);
    expect(EXECUTE.DURATION).toBeGreaterThan(0);
  });

  it('WEAPON_STATS 保持既有五武器', () => {
    expect(Object.keys(WEAPON_STATS).length).toBe(5);
  });
});