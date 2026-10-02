// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/render/TextureFactory.js', () => ({
  TextureFactory: { noise: () => ({ isTexture: true }), rough: () => ({ isTexture: true }), normal: () => ({ isTexture: true }), brick: () => ({ isTexture: true }) }
}));
vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(class { constructor() {} spawnBurst() {} spawn() {} update() {} }, { blood: () => ({ isTexture: true }) })
}));

import { Character } from '../../src/gameplay/Character.js';
import { CombatSystem } from '../../src/gameplay/CombatSystem.js';

describe('Character.dispose (P1-5)', () => {
  it('dispose 方法存在且释放 root 子树的 geometry/material', () => {
    const c = new Character({ team: 0 });
    expect(typeof c.dispose).toBe('function');
    let meshCount = 0;
    c.root.traverse(o => { if (o.isMesh || o.isSprite) meshCount++; });
    expect(meshCount).toBeGreaterThan(0);
    const spies = [];
    c.root.traverse(o => {
      if (o.geometry) spies.push(vi.spyOn(o.geometry, 'dispose'));
    });
    c.dispose();
    for (const s of spies) expect(s).toHaveBeenCalled();
  });
});

describe('CombatSystem.dispose (P1-5)', () => {
  let cs, scene, bus;
  beforeEach(() => {
    bus = { emit: vi.fn() };
    scene = { add: vi.fn(), remove: vi.fn() };
    cs = new CombatSystem(scene, bus);
  });

  it('dispose 方法存在且不抛异常', () => {
    expect(typeof cs.dispose).toBe('function');
    expect(() => cs.dispose()).not.toThrow();
  });

  it('dispose 释放共享箭矢几何体与材质', () => {
    const gs = vi.spyOn(cs._arrowGeo, 'dispose');
    const ms = vi.spyOn(cs._arrowMat, 'dispose');
    cs.dispose();
    expect(gs).toHaveBeenCalled();
    expect(ms).toHaveBeenCalled();
  });

  it('dispose 释放粒子 Points 与数字 Sprite 资源', () => {
    const gs = vi.spyOn(cs._partGeo, 'dispose');
    const ms = vi.spyOn(cs._partMat, 'dispose');
    const texs = vi.spyOn(cs._numSprites[0].tex, 'dispose');
    cs.dispose();
    expect(gs).toHaveBeenCalled();
    expect(ms).toHaveBeenCalled();
    expect(texs).toHaveBeenCalled();
  });
});
