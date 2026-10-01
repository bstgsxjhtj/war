import { SaveManager, slotKey, slotBackupKey } from '../../src/gameplay/SaveManager.js';
import { LS } from '../../src/core/constants/storage-keys.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SaveManager 版本迁移框架', () => {
  beforeEach(() => { localStorage.clear(); });

  it('CURRENT_VERSION 为 3（v1→v2→v3 迁移链）', () => {
    const sm = new SaveManager();
    const d = sm.save({ mode: '战役', stage: 1 });
    expect(d.version).toBe(3);
  });

  it('v1 存档加载时自动迁移到 v3，补充 campaignCleared 字段', () => {
    const v1Data = {
      version: 1, savedAt: 1000, mode: '战役', stage: 3,
      campaignCompleted: false, score: 500, kills: 20,
      skillTree: null, affixSlots: {}, affixInventory: [],
      skillPoints: 0, achievements: {}, daily: null, skins: null, playTime: 120
    };
    localStorage.setItem(LS.SAVEGAME, JSON.stringify(v1Data));
    const sm = new SaveManager();
    const d = sm.load();
    expect(d.version).toBe(3);
    expect(d.stage).toBe(3);
    expect(d.score).toBe(500);
    expect(d.campaignCleared).toBeDefined();
  });

  it('v2 遗留单槽（savegame_v1）迁移进槽 0 并落盘为 v3', () => {
    localStorage.setItem(LS.SAVEGAME, JSON.stringify({ version: 2, mode: '战役', stage: 4, score: 700 }));
    const sm = new SaveManager();
    const d = sm.load();
    expect(d.version).toBe(3);
    expect(d.slot).toBe(0);
    expect(d.stage).toBe(4);
    expect(JSON.parse(localStorage.getItem(slotKey(0))).stage).toBe(4);
  });

  it('v1 存档 campaignCompleted=true 时迁移 campaignCleared=10', () => {
    const v1Data = { version: 1, campaignCompleted: true, stage: 9, score: 1000 };
    localStorage.setItem(LS.SAVEGAME, JSON.stringify(v1Data));
    const sm = new SaveManager();
    const d = sm.load();
    expect(d.version).toBe(3);
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

  it('存档 JSON 损坏时尝试从遗留备份恢复', () => {
    const goodData = { version: 2, stage: 5, score: 2000, kills: 80, campaignCompleted: false };
    localStorage.setItem(LS.SAVEGAME_BACKUP, JSON.stringify(goodData));
    localStorage.setItem(LS.SAVEGAME, '{corrupt json!!!');
    const sm = new SaveManager();
    const d = sm.load();
    expect(d).not.toBeNull();
    expect(d.version).toBe(3);
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
    const firstRaw = localStorage.getItem(slotKey(0));
    expect(firstRaw).toBeTruthy();
    const sm2 = new SaveManager();
    sm2.save({ mode: '战役', stage: 3, score: 1200 });
    const backup = localStorage.getItem(slotBackupKey(0));
    expect(backup).toBeTruthy();
    expect(JSON.parse(backup).stage).toBe(2);
  });

  it('save 不会备份损坏的旧数据', () => {
    localStorage.setItem(slotKey(0), '{corrupt!!!');
    const sm = new SaveManager();
    sm.save({ mode: '战役', stage: 1, score: 100 });
    expect(localStorage.getItem(slotBackupKey(0))).toBeNull();
  });

  it('备份损坏时回退到 null（不连锁崩溃）', () => {
    localStorage.setItem(LS.SAVEGAME, '{corrupt!!!');
    localStorage.setItem(LS.SAVEGAME_BACKUP, '{also corrupt!!!');
    const sm = new SaveManager();
    expect(sm.load()).toBeNull();
  });

  it('reset 同时清除主存档和备份', () => {
    localStorage.setItem(slotKey(0), JSON.stringify({ version: 3, stage: 1 }));
    localStorage.setItem(slotBackupKey(0), JSON.stringify({ version: 3, stage: 0 }));
    const sm = new SaveManager();
    sm.reset();
    expect(localStorage.getItem(slotKey(0))).toBeNull();
    expect(localStorage.getItem(slotBackupKey(0))).toBeNull();
  });
});

describe('存档损坏恢复 e2e（P2-7：部分字段缺失合并默认 + 旧键逐项容错）', () => {
  beforeEach(() => { localStorage.clear(); });

  it('主存档 JSON 合法但缺字段时，合并默认补齐所有字段', () => {
    localStorage.setItem(LS.SAVEGAME, JSON.stringify({ version: 2, stage: 3, score: 500 }));
    const sm = new SaveManager();
    const d = sm.load();
    expect(d).not.toBeNull();
    expect(d.stage).toBe(3);
    expect(d.score).toBe(500);
    expect(d.kills).toBe(0);
    expect(d.affixSlots).toEqual({});
    expect(d.achievements).toEqual({});
    expect(d.skillPoints).toBe(0);
    expect(d.playTime).toBe(0);
    expect(d.version).toBe(3);
  });

  it('旧键中某一项损坏 JSON 时，其他旧键仍正常迁移（逐项 try/catch 容错）', () => {
    localStorage.setItem(LS.OLD_CAMPAIGN_CLEARED, JSON.stringify(5));
    localStorage.setItem(LS.OLD_PROGRESSION, '{bad progression json');
    localStorage.setItem(LS.OLD_SKILLTREE, JSON.stringify({ points: 7 }));
    const sm = new SaveManager();
    const d = sm.load();
    expect(d).not.toBeNull();
    expect(d.campaignCleared).toBe(5);
    expect(d.skillPoints).toBe(7);
    expect(d.progressionFull).toBeNull();
    expect(d.score).toBe(0);
  });
});