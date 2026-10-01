import { SaveManager, slotKey, SAVE_SLOT_COUNT } from '../../src/gameplay/SaveManager.js';
import { LS } from '../../src/core/constants/storage-keys.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SaveManager 多档槽位', () => {
  beforeEach(() => { localStorage.clear(); });

  it('不同槽位互不干扰：各自写入/读取独立数据', () => {
    const s0 = new SaveManager(0);
    s0.save({ mode: '战役', stage: 3, score: 1000 });
    const s1 = new SaveManager(1);
    s1.save({ mode: '死斗', stage: 0, score: 2000 });
    expect(new SaveManager(0).load().score).toBe(1000);
    expect(new SaveManager(1).load().score).toBe(2000);
    expect(new SaveManager(2).load()).toBeNull();
  });

  it('存档数据记录所属槽位 slot 字段', () => {
    const s2 = new SaveManager(2);
    const d = s2.save({ mode: '战役', stage: 1 });
    expect(d.slot).toBe(2);
    expect(JSON.parse(localStorage.getItem(slotKey(2))).slot).toBe(2);
  });

  it('setSlot 切换键并重新加载目标槽', () => {
    new SaveManager(0).save({ mode: '战役', stage: 2, score: 100 });
    const sm = new SaveManager(0);
    expect(sm.load().score).toBe(100);
    sm.setSlot(1);
    expect(sm.slot).toBe(1);
    expect(sm.load()).toBeNull();
    sm.save({ mode: '死斗', score: 999 });
    expect(new SaveManager(1).load().score).toBe(999);
  });

  it('listSlots 返回全部槽位元数据（空槽 data 为 null）', () => {
    new SaveManager(2).save({ mode: '战役', stage: 4, score: 500 });
    const slots = SaveManager.listSlots();
    expect(slots.length).toBe(SAVE_SLOT_COUNT);
    expect(slots[0].data).toBeNull();
    expect(slots[2].data.stage).toBe(4);
    expect(slots[2].slot).toBe(2);
  });

  it('getActiveSlot 默认 0；setActiveSlot 往返并可越界回退', () => {
    expect(SaveManager.getActiveSlot()).toBe(0);
    SaveManager.setActiveSlot(2);
    expect(SaveManager.getActiveSlot()).toBe(2);
    SaveManager.setActiveSlot(99);
    expect(SaveManager.getActiveSlot()).toBe(0);
  });

  it('reset 仅清当前槽，其他槽保留', () => {
    new SaveManager(0).save({ mode: '战役', stage: 1 });
    new SaveManager(1).save({ mode: '战役', stage: 2 });
    const s0 = new SaveManager(0);
    s0.reset();
    expect(new SaveManager(0).load()).toBeNull();
    expect(new SaveManager(1).load().stage).toBe(2);
  });

  it('遗留 savegame_v1 仅迁入槽 0，不影响其他槽', () => {
    localStorage.setItem(LS.SAVEGAME, JSON.stringify({ version: 2, mode: '战役', stage: 6, score: 3000 }));
    expect(new SaveManager(0).load().stage).toBe(6);
    expect(new SaveManager(1).load()).toBeNull();
  });
});