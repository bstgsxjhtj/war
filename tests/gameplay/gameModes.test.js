import { describe, it, expect } from 'vitest';
import { MODE_ORDER, MODE_DESC, createMode, nextModeName } from '../../src/gameplay/gameModes.js';
import { Deathmatch, Domination, SiegeMode } from '../../src/gameplay/GameMode.js';
import { WaveMode } from '../../src/gameplay/WaveMode.js';
import { BattlefieldMode } from '../../src/gameplay/BattlefieldMode.js';

const bus = { on: () => {}, emit: () => {} };
const campaign = { name: '战役' };

describe('gameModes 玩法模式注册表', () => {
  it('MODE_ORDER 覆盖全部 7 种玩法且顺序固定', () => {
    expect(MODE_ORDER).toEqual(['死斗', '据点', '攻城', '波次', '战场', '无尽', '战役']);
  });

  it('每种玩法都有说明文案', () => {
    for (const name of MODE_ORDER) expect(MODE_DESC[name]).toBeTruthy();
  });

  it('createMode 按名构建对应模式实例', () => {
    expect(createMode('死斗', { bus, campaign })).toBeInstanceOf(Deathmatch);
    expect(createMode('据点', { bus, campaign })).toBeInstanceOf(Domination);
    expect(createMode('攻城', { bus, campaign })).toBeInstanceOf(SiegeMode);
    expect(createMode('战场', { bus, campaign })).toBeInstanceOf(BattlefieldMode);
    expect(createMode('波次', { bus, campaign })).toBeInstanceOf(WaveMode);
    expect(createMode('无尽', { bus, campaign })).toBeInstanceOf(WaveMode);
    expect(createMode('战役', { bus, campaign })).toBe(campaign);
  });

  it('无尽标记 endless，波次不标记', () => {
    expect(createMode('无尽', { bus, campaign }).endless).toBe(true);
    expect(createMode('波次', { bus, campaign }).endless).toBe(false);
  });

  it('nextModeName 按环顺序前进，战役后回到死斗', () => {
    expect(nextModeName('死斗')).toBe('据点');
    expect(nextModeName('战场')).toBe('无尽');
    expect(nextModeName('无尽')).toBe('战役');
    expect(nextModeName('战役')).toBe('死斗');
  });

  it('nextModeName 对未知模式回退到首个模式', () => {
    expect(nextModeName('不存在')).toBe('死斗');
  });
});