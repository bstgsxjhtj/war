// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/gameplay/AIController.js', () => ({
  AIController: class {
    constructor(o) { this.opts = o; this.team = o.team; this.root = {}; this.alive = true; this.weapons = []; }
    spawn() {} setWeapons(w) { this.weapons = w; } setCameraRef() {} setAIManager() {} setIsElite(v) { this._isElite = v; } setAudio() {} setBus() {}
  }
}));
vi.mock('../../src/gameplay/BossEnemy.js', () => ({
  BossEnemy: class {
    constructor(o) { this.opts = o; this.team = o.team; this.root = {}; this.alive = true; this.weapons = []; this._isBoss = true; }
    spawn() {} setWeapons(w) { this.weapons = w; } setCameraRef() {} setAIManager() {} setAudio() {}
  },
  EliteEnemy: class {
    constructor(o) { this.opts = o; this.team = o.team; this.root = {}; this.alive = true; this.weapons = []; this._isElite = true; }
    spawn() {} setWeapons(w) { this.weapons = w; } setCameraRef() {} setAIManager() {} setAudio() {}
  }
}));
vi.mock('../../src/gameplay/Cavalry.js', () => ({
  CavalryEnemy: class {
    constructor(o) { this.opts = o; this.team = o.team; this.root = {}; this.alive = true; this.weapons = []; this.mounted = null; }
    mount(h) { this.mounted = h; }
    spawn() {} setWeapons(w) { this.weapons = w; } setCameraRef() {} setAIManager() {} setIsElite() {} setAudio() {}
  }
}));
vi.mock('../../src/gameplay/weapons/Spear.js', () => ({ Spear: class { constructor() { this.weaponClass = 'SPEAR'; } } }));
vi.mock('../../src/gameplay/weapons/SwordShield.js', () => ({ SwordShield: class { constructor() { this.weaponClass = 'SHIELD'; } } }));
vi.mock('../../src/gameplay/weapons/Warhammer.js', () => ({ Warhammer: class { constructor() { this.weaponClass = 'HAMMER'; } } }));
vi.mock('../../src/gameplay/weapons/Bow.js', () => ({ Bow: class { constructor() { this.weaponClass = 'BOW'; } } }));

import { Spawner } from '../../src/gameplay/Spawner.js';

function mkDeps(overrides = {}) {
  return {
    scene: { add: vi.fn() },
    camera: {},
    terrain: { heightAt: vi.fn(() => 0) },
    combat: { register: vi.fn() },
    aiManager: { assignSquad: vi.fn(), difficulty: vi.fn(() => ({ maxHpMul: 1.5 })) },
    formations: { createShieldWall: vi.fn(), createArcherLine: vi.fn() },
    weaponTrail: { attach: vi.fn() },
    horses: { create: vi.fn(() => ({ horse: true })) },
    audio: {},
    bus: {},
    progression: { unlocks: {}, score: 0 },
    campaign: { currentStage: {} },
    ...overrides
  };
}

const LAYOUT = [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 10, z: 0 }, { x: 15, z: 0 }];

describe('Spawner', () => {
  let deps, spawner, ais;
  beforeEach(() => {
    deps = mkDeps();
    spawner = new Spawner(deps);
    ais = [];
  });

  it('普通兵 maxHp 走难度系数', () => {
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '死斗' });
    expect(ais[0].opts.maxHp).toBe(Math.round(90 * 1.5));
    expect(deps.combat.register).toHaveBeenCalledWith(ais[0]);
  });

  it('bossWave 时首刷 BossEnemy 且 warlord 非 mini', () => {
    spawner.spawnRed(LAYOUT, ais, { bossWave: true, modeName: '波次' });
    expect(ais[0]._isBoss).toBe(true);
    expect(ais[0].opts.type).toBe('warlord');
    expect(ais[0].opts.mini).toBe(false);
  });

  it('训练场全是被动假人 maxHp=500 不出 Boss/精英/骑兵', () => {
    deps.progression.unlocks.elite = true;
    deps.progression.score = 9999;
    deps.campaign.currentStage.bossType = 'warlord';
    spawner.spawnRed(LAYOUT, ais, { modeName: '训练场' });
    for (const a of ais) {
      expect(a._isBoss).toBeFalsy();
      expect(a.mounted).toBeFalsy();
      expect(a.opts.maxHp).toBe(500);
      expect(a.opts.passive).toBe(true);
    }
  });

  it('解锁精英后 i=1 刷 EliteEnemy', () => {
    deps.progression.unlocks.elite = true;
    spawner.spawnRed(LAYOUT, ais, { modeName: '死斗' });
    expect(ais[1]._isElite).toBe(true);
  });

  it('score>=500 时 i=2 刷骑兵并上马', () => {
    deps.progression.score = 500;
    spawner.spawnRed(LAYOUT, ais, { modeName: '死斗' });
    expect(ais[2].mounted).toEqual({ horse: true });
  });

  it('盾兵≥2 触发盾墙阵型', () => {
    const six = [...LAYOUT, { x: 20, z: 0 }, { x: 25, z: 0 }];
    spawner.spawnRed(six, ais, { modeName: '死斗' });
    expect(deps.formations.createShieldWall).toHaveBeenCalled();
  });

  it('spawnReinforce 增援 n 个并注册进战斗', () => {
    spawner.spawnReinforce(3, ais);
    expect(ais.length).toBe(3);
    expect(deps.combat.register).toHaveBeenCalledTimes(3);
    for (const a of ais) {
      expect(a.weapons[0].weaponClass).toBe('SPEAR');
    }
  });
});
