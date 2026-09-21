import { WeaponSkins, SKINS } from '../../src/gameplay/WeaponSkins.js';
import { describe, it, expect, beforeEach } from 'vitest';

function fakeProg(score) { return { score }; }

describe('WeaponSkins', () => {
  let s;
  beforeEach(() => { s = new WeaponSkins(fakeProg(0)); });

  it('初始仅 default 解锁', () => {
    expect(s.isUnlocked('default')).toBe(true);
    expect(s.isUnlocked('bronze')).toBe(false);
  });

  it('初始4把武器均装备 default', () => {
    expect(s.getEquippedSkin(0)).toBe(SKINS.default);
    expect(s.getEquippedSkin(3)).toBe(SKINS.default);
  });

  it('unlock 分数不足返 false', () => {
    expect(s.unlock('bronze')).toBe(false);
    expect(s.isUnlocked('bronze')).toBe(false);
  });

  it('unlock 分数足够解锁', () => {
    const rich = new WeaponSkins(fakeProg(500));
    expect(rich.unlock('bronze')).toBe(true);
    expect(rich.isUnlocked('bronze')).toBe(true);
  });

  it('unlock 已解锁返 false（幂等）', () => {
    const rich = new WeaponSkins(fakeProg(500));
    rich.unlock('bronze');
    expect(rich.unlock('bronze')).toBe(false);
  });

  it('equip 未解锁返 false', () => {
    expect(s.equip(0, 'bronze')).toBe(false);
    expect(s.getEquippedSkin(0)).toBe(SKINS.default);
  });

  it('equip 已解锁生效；经 serialize→restore 还原（收敛到 savegame_v1，不再自写 weapon_skins）', () => {
    const rich = new WeaponSkins(fakeProg(500));
    rich.unlock('bronze');
    expect(rich.equip(1, 'bronze')).toBe(true);
    expect(rich.getEquippedSkin(1)).toBe(SKINS.bronze);
    expect(localStorage.getItem('weapon_skins')).toBeNull();
    const rich2 = new WeaponSkins(fakeProg(500));
    rich2.restore(rich.serialize());
    expect(rich2.getEquippedSkin(1)).toBe(SKINS.bronze);
  });

  it('getEquippedSkin 未知槽位 fallback default', () => {
    expect(s.getEquippedSkin(99)).toBe(SKINS.default);
  });
});
