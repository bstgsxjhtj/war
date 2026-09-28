// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: {
    noise: () => ({ isTexture: true }),
    rough: () => ({ isTexture: true })
  }
}));

import { Character } from '../../src/gameplay/Character.js';

describe('Character 色弱模式形状标记', () => {
  it('友军使用圆环标记，敌军使用方块标记', () => {
    const ally = new Character({ team: 0, isLocal: false });
    const enemy = new Character({ team: 1, isLocal: false });
    expect(ally._teamMark.geometry.type).toBe('TorusGeometry');
    expect(enemy._teamMark.geometry.type).toBe('BoxGeometry');
  });

  it('默认隐藏，setColorblind 控制非本地标记可见性', () => {
    const enemy = new Character({ team: 1, isLocal: false });
    expect(enemy._teamMark.visible).toBe(false);
    enemy.setColorblind(true);
    expect(enemy._teamMark.visible).toBe(true);
    enemy.setColorblind(false);
    expect(enemy._teamMark.visible).toBe(false);
  });

  it('本地角色不显示形状标记', () => {
    const me = new Character({ team: 0, isLocal: true });
    me.setColorblind(true);
    expect(me._teamMark.visible).toBe(false);
  });
});