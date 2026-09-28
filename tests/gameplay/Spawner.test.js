// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/gameplay/AIController.js', () => ({
  AIController: class {
    constructor(o) { this.opts = o; this.team = o.team; this.root = {}; this.alive = true; this.weapons = []; this.speed = 6.2; this._enemyMods = null; }
    spawn() {} setWeapons(w) { this.weapons = w; } setCameraRef() {} setAIManager() {} setIsElite(v) { this._isElite = v; } setAudio() {} setBus() {}
    setEnemyMods(m) { this._enemyMods = m ? [...m] : null; }
    hasMod(n) { return !!this._enemyMods && this._enemyMods.includes(n); }
  }
}));
vi.mock('../../src/gameplay/BossEnemy.js', () => ({
  BossEnemy: class {
    constructor(o) { this.opts = o; this.team = o.team; this.root = {}; this.alive = true; this.weapons = []; this._isBoss = true; this.health = { maxHp: 500, cur: 500 }; }
    spawn() {} setWeapons(w) { this.weapons = w; } setCameraRef() {} setAIManager() {} setAudio() {}
  },
  EliteEnemy: class {
    constructor(o) { this.opts = o; this.team = o.team; this.root = {}; this.alive = true; this.weapons = []; this._isElite = true; this.health = { maxHp: 300, cur: 300 }; }
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

describe('Spawner 修饰词应用', () => {
  let deps, spawner, ais;
  beforeEach(() => {
    deps = mkDeps();
    spawner = new Spawner(deps);
    ais = [];
  });

  it('modifier hpMul 应用到普通兵 maxHp', () => {
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '死斗', modifier: { hpMul: 1.6 } });
    expect(ais[0].opts.maxHp).toBe(Math.round(90 * 1.5 * 1.6));
  });

  it('modifier speedMul 应用到 ai.speed', () => {
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '死斗', modifier: { speedMul: 1.3 } });
    expect(ais[0].speed).toBeCloseTo(6.2 * 1.3, 5);
  });

  it('modifier 为 null 时无效果（默认行为）', () => {
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '死斗', modifier: null });
    expect(ais[0].opts.maxHp).toBe(Math.round(90 * 1.5));
    expect(ais[0].speed).toBe(6.2);
  });

  it('modifier 同时应用 hpMul 与 speedMul', () => {
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '死斗', modifier: { hpMul: 1.5, speedMul: 1.2 } });
    expect(ais[0].opts.maxHp).toBe(Math.round(90 * 1.5 * 1.5));
    expect(ais[0].speed).toBeCloseTo(6.2 * 1.2, 5);
  });
});

describe('Spawner 关卡难度系数 (P1-2)', () => {
  let deps, spawner, ais;
  beforeEach(() => {
    deps = mkDeps();
    spawner = new Spawner(deps);
    ais = [];
  });

  it('stageDifficulty 应用到普通兵 maxHp', () => {
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '死斗', stageDifficulty: 1.3 });
    expect(ais[0].opts.maxHp).toBe(Math.round(90 * 1.5 * 1.3));
  });

  it('stageDifficulty 与 modifier hpMul 叠加', () => {
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '死斗', modifier: { hpMul: 1.6 }, stageDifficulty: 1.3 });
    expect(ais[0].opts.maxHp).toBe(Math.round(90 * 1.5 * 1.6 * 1.3));
  });

  it('stageDifficulty 默认 1 不改变原行为', () => {
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '死斗' });
    expect(ais[0].opts.maxHp).toBe(Math.round(90 * 1.5));
  });

  it('stageDifficulty 应用到 Boss health.maxHp', () => {
    deps.campaign.currentStage.bossType = 'warlord';
    spawner.spawnRed(LAYOUT, ais, { modeName: '战役', stageDifficulty: 1.6 });
    expect(ais[0].health.maxHp).toBe(Math.round(500 * 1.6));
    expect(ais[0].health.cur).toBe(Math.round(500 * 1.6));
  });

  it('stageDifficulty 与 hpMul 同时应用到 Boss', () => {
    deps.campaign.currentStage.bossType = 'warlord';
    spawner.spawnRed(LAYOUT, ais, { modeName: '战役', modifier: { hpMul: 1.2 }, stageDifficulty: 1.6 });
    expect(ais[0].health.maxHp).toBe(Math.round(500 * 1.2 * 1.6));
  });

  it('stageDifficulty=1 时不触发 Boss health 缩放', () => {
    deps.campaign.currentStage.bossType = 'warlord';
    spawner.spawnRed(LAYOUT, ais, { modeName: '战役', stageDifficulty: 1 });
    expect(ais[0].health.maxHp).toBe(500);
  });
});

describe('Spawner 噩梦词条 (P0-1)', () => {
  let deps, spawner, ais;
  beforeEach(() => {
    deps = mkDeps();
    spawner = new Spawner(deps);
    ais = [];
  });

  it('currentStage.enemyMods 注入到普通兵', () => {
    deps.campaign.currentStage.enemyMods = ['swift', 'ironhide'];
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '战役' });
    expect(ais[0]._enemyMods).toEqual(['swift', 'ironhide']);
  });

  it('swift 词条速度 ×1.2', () => {
    deps.campaign.currentStage.enemyMods = ['swift'];
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '战役' });
    expect(ais[0].speed).toBeCloseTo(6.2 * 1.2, 5);
  });

  it('Boss 不注入 enemyMods（阶段机制独立）', () => {
    deps.campaign.currentStage.bossType = 'warlord';
    deps.campaign.currentStage.enemyMods = ['swift'];
    spawner.spawnRed(LAYOUT, ais, { modeName: '战役' });
    expect(ais[0]._isBoss).toBe(true);
    expect(ais[0]._enemyMods).toBeFalsy();
  });

  it('无 enemyMods 时不影响 speed 与词条', () => {
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '死斗' });
    expect(ais[0]._enemyMods).toBeNull();
    expect(ais[0].speed).toBe(6.2);
  });

  it('spawnReinforce 也注入 enemyMods', () => {
    deps.campaign.currentStage.enemyMods = ['vampire'];
    spawner.spawnReinforce(2, ais);
    expect(ais[0]._enemyMods).toEqual(['vampire']);
    expect(ais[1]._enemyMods).toEqual(['vampire']);
  });

  it('普通兵 + 速度修饰词与 swift 叠加', () => {
    deps.campaign.currentStage.enemyMods = ['swift'];
    spawner.spawnRed([{ x: 0, z: 0 }], ais, { modeName: '战役', modifier: { speedMul: 1.3 } });
    expect(ais[0].speed).toBeCloseTo(6.2 * 1.2 * 1.3, 5);
  });
});
