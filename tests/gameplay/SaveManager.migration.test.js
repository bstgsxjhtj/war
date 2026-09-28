import { SaveManager } from '../../src/gameplay/SaveManager.js';
import { LS } from '../../src/core/constants/storage-keys.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SaveManager 版本迁移框架', () => {
  beforeEach(() => { localStorage.clear(); });

  it('CURRENT_VERSION 为 2（v1→v2 演示迁移）', () => {
    const sm = new SaveManager();
    const d = sm.save({ mode: '战役', stage: 1 });
    expect(d.version).toBe(2);
  });

  it('v1 存档加载时自动迁移到 v2，补充 campaignCleared 字段', () => {
    const v1Data = {
      version: 1, savedAt: 1000, mode: '战役', stage: 3,
      campaignCompleted: false, score: 500, kills: 20,
      skillTree: null, affixSlots: {}, affixInventory: [],
      skillPoints: 0, achievements: {}, daily: null, skins: null, playTime: 120
    };
    localStorage.setItem(LS.SAVEGAME, JSON.stringify(v1Data));
    const sm = new SaveManager();
    const d = sm.load();
    expect(d.version).toBe(2);
    expect(d.stage).toBe(3);
    expect(d.score).toBe(500);
    expect(d.campaignCleared).toBeDefined();
  });

  it('v1 存档 campaignCompleted=true 时迁移 campaignCleared=10', () => {
    const v1Data = { version: 1, campaignCompleted: true, stage: 9, score: 1000 };
    localStorage.setItem(LS.SAVEGAME, JSON.stringify(v1Data));
    const sm = new SaveManager();
    const d = sm.load();
    expect(d.version).toBe(2);
    expect(d.campaignCleared).toBe(10);
  });

  it('v1 存档 campaignCompleted=false 时迁移 campaignCleared=0', () => {
    const v1Data = { version: 1, campaignCompleted: false, stage: 3, score: 500 };
    localStorage.setItem(LS.SAVEGAME, JSON.stringify(v1Data));
    const sm = new SaveManager();
    const d = sm.load();
    expect(d.campaignCleared).toBe(0);
  });

  it('serialize 输出包含 campaignCleared 字段', () => {
    const sm = new SaveManager();
    const d = sm.save({ campaignCleared: 5, campaignCompleted: false });
    expect(d.campaignCleared).toBe(5);
  });

  it('serialize 缺少 campaignCleared 时从 campaignCompleted 推导', () => {
    const sm = new SaveManager();
    const d = sm.serialize({ campaignCompleted: true });
    expect(d.campaignCleared).toBe(10);
  });
});

describe('SaveManager 损坏备份恢复', () => {
  beforeEach(() => { localStorage.clear(); });

  it('存档 JSON 损坏时尝试从备份恢复', () => {
    const goodData = { version: 1, stage: 5, score: 2000, kills: 80, campaignCompleted: false };
    localStorage.setItem(LS.SAVEGAME_BACKUP, JSON.stringify(goodData));
    localStorage.setItem(LS.SAVEGAME, '{corrupt json!!!');
    const sm = new SaveManager();
    const d = sm.load();
    expect(d).not.toBeNull();
    expect(d.version).toBe(2);
    expect(d.stage).toBe(5);
    expect(d.score).toBe(2000);
  });

  it('存档损坏且无备份时返回 null', () => {
    localStorage.setItem(LS.SAVEGAME, '{corrupt json!!!');
    const sm = new SaveManager();
    expect(sm.load()).toBeNull();
  });

  it('save 时自动备份上一次的有效存档', () => {
    const sm1 = new SaveManager();
    sm1.save({ mode: '战役', stage: 2, score: 800 });
    const firstRaw = localStorage.getItem(LS.SAVEGAME);
    expect(firstRaw).toBeTruthy();
    const sm2 = new SaveManager();
    sm2.save({ mode: '战役', stage: 3, score: 1200 });
    const backup = localStorage.getItem(LS.SAVEGAME_BACKUP);
    expect(backup).toBeTruthy();
    expect(JSON.parse(backup).stage).toBe(2);
  });

  it('save 不会备份损坏的旧数据', () => {
    localStorage.setItem(LS.SAVEGAME, '{corrupt!!!');
    const sm = new SaveManager();
    sm.save({ mode: '战役', stage: 1, score: 100 });
    expect(localStorage.getItem(LS.SAVEGAME_BACKUP)).toBeNull();
  });

  it('备份损坏时回退到 null（不连锁崩溃）', () => {
    localStorage.setItem(LS.SAVEGAME, '{corrupt!!!');
    localStorage.setItem(LS.SAVEGAME_BACKUP, '{also corrupt!!!');
    const sm = new SaveManager();
    expect(sm.load()).toBeNull();
  });

  it('reset 同时清除主存档和备份', () => {
    localStorage.setItem(LS.SAVEGAME, JSON.stringify({ version: 1, stage: 1 }));
    localStorage.setItem(LS.SAVEGAME_BACKUP, JSON.stringify({ version: 1, stage: 0 }));
    const sm = new SaveManager();
    sm.reset();
    expect(localStorage.getItem(LS.SAVEGAME)).toBeNull();
    expect(localStorage.getItem(LS.SAVEGAME_BACKUP)).toBeNull();
  });
});
