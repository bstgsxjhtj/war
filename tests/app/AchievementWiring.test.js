// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { wireAchievements } from '../../src/app/AchievementWiring.js';
import { EV } from '../../src/core/constants/events.js';
import { EventBus } from '../../src/core/EventBus.js';

function mkDeps() {
  return {
    achievements: { check: vi.fn() },
    getSkills: () => ({ addPoint: vi.fn() }),
    getAffixes: () => ({ grant: vi.fn() }),
    getSkins: () => ({ unlock: vi.fn() }),
    hud: { flash: vi.fn() },
    audio: { playSound: vi.fn() }
  };
}

describe('AchievementWiring', () => {
  it('击杀仅本地玩家触发成就', () => {
    const bus = new EventBus();
    const deps = mkDeps();
    wireAchievements(bus, deps);
    bus.emit(EV.COMBAT_KILL, { killer: { isLocal: false } });
    expect(deps.achievements.check).not.toHaveBeenCalled();
    bus.emit(EV.COMBAT_KILL, { killer: { isLocal: true } });
    expect(deps.achievements.check).toHaveBeenCalledWith(EV.COMBAT_KILL, expect.anything());
  });

  it('十个触发源全部接到 check', () => {
    const bus = new EventBus();
    const deps = mkDeps();
    wireAchievements(bus, deps);
    const sources = [EV.COMBO_TIER, EV.CAMPAIGN_CLEAR, EV.CAMPAIGN_PERFECT, EV.COMBAT_BACKSTAB, EV.COMBAT_PERFECTBLOCK, EV.COMBAT_DODGE, EV.COMBAT_CAVALRYKILL, EV.DAILY_COMPLETED];
    for (const ev of sources) {
      deps.achievements.check.mockClear();
      bus.emit(ev, {});
      expect(deps.achievements.check).toHaveBeenCalledWith(ev, {});
    }
  });

  it('技能释放附带音效', () => {
    const bus = new EventBus();
    const deps = mkDeps();
    wireAchievements(bus, deps);
    bus.emit(EV.SKILL_CAST, {});
    expect(deps.audio.playSound).toHaveBeenCalledWith('ultimate');
  });

  it('成就解锁分发技能点/词条/皮肤奖励并提示', () => {
    const bus = new EventBus();
    const skills = { addPoint: vi.fn() }, affixes = { grant: vi.fn() }, skins = { unlock: vi.fn() };
    const deps = { ...mkDeps(), getSkills: () => skills, getAffixes: () => affixes, getSkins: () => skins };
    wireAchievements(bus, deps);
    bus.emit(EV.ACHIEVEMENT_UNLOCK, { name: '百人斩', reward: { skillPoint: 1, affix: ['SWORD', '锋锐'], skin: 'gold' } });
    expect(skills.addPoint).toHaveBeenCalledWith(1);
    expect(affixes.grant).toHaveBeenCalledWith('SWORD', '锋锐');
    expect(skins.unlock).toHaveBeenCalledWith('gold');
    expect(deps.hud.flash).toHaveBeenCalledWith(expect.stringContaining('百人斩'));
    expect(deps.audio.playSound).toHaveBeenCalledWith('achievement');
  });

  it('词条掉落提示', () => {
    const bus = new EventBus();
    const deps = mkDeps();
    wireAchievements(bus, deps);
    bus.emit(EV.AFFIX_DROP, { type: '暴怒', tier: 2 });
    expect(deps.hud.flash).toHaveBeenCalledWith(expect.stringContaining('暴怒'));
  });

  it('CAMPAIGN_NIGHTMARE_CLEAR 接到 check', () => {
    const bus = new EventBus();
    const deps = mkDeps();
    wireAchievements(bus, deps);
    bus.emit(EV.CAMPAIGN_NIGHTMARE_CLEAR, {});
    expect(deps.achievements.check).toHaveBeenCalledWith(EV.CAMPAIGN_NIGHTMARE_CLEAR, {});
  });

  it('forceSkin 奖励调用 forceUnlock', () => {
    const bus = new EventBus();
    const skins = { unlock: vi.fn(), forceUnlock: vi.fn() };
    const deps = { ...mkDeps(), getSkins: () => skins };
    wireAchievements(bus, deps);
    bus.emit(EV.ACHIEVEMENT_UNLOCK, { name: '噩梦征服者', reward: { forceSkin: 'legend' } });
    expect(skins.forceUnlock).toHaveBeenCalledWith('legend');
  });
});
