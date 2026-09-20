// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { BossEnemy } from '../../src/gameplay/BossEnemy.js';

// jsdom 无 canvas 2d 实现：mock getContext 返回 Proxy 兜底（TextureFactory 构造贴图用）
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getContext.toString().includes('Not implemented')) {
  HTMLCanvasElement.prototype.getContext = function () {
    const self = this;
    return new Proxy({}, {
      get(_, k) {
        if (k === 'canvas') return self;
        if (k === 'measureText') return () => ({ width: 10 });
        if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
        if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w || 1, height: h || 1 });
        if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: () => {} });
        return () => {};
      }
    });
  };
}

describe('BossEnemy 4 类型构造', () => {
  it('warlord 战将 300hp 5.5速度 charge/roar/summon', () => {
    const b = new BossEnemy({ type: 'warlord' });
    expect(b._maxHp).toBe(300);
    expect(b.maxHp).toBe(300);
    expect(b.hp).toBe(300);
    expect(b.speed).toBe(5.5);
    expect(b._name).toBe('战将');
    expect(b._skillSet).toEqual(['charge', 'roar', 'summon']);
    expect(b._isBoss).toBe(true);
  });

  it('ranger 游侠 220hp 6.0速度 rapidshot/dodge/trap', () => {
    const b = new BossEnemy({ type: 'ranger' });
    expect(b._maxHp).toBe(220);
    expect(b.speed).toBe(6.0);
    expect(b._name).toBe('游侠');
    expect(b._skillSet).toEqual(['rapidshot', 'dodge', 'trap']);
  });

  it('mage 法师 180hp 5.0速度 fireball/teleport/aoe', () => {
    const b = new BossEnemy({ type: 'mage' });
    expect(b._maxHp).toBe(180);
    expect(b.speed).toBe(5.0);
    expect(b._name).toBe('法师');
    expect(b._skillSet).toEqual(['fireball', 'teleport', 'aoe']);
  });

  it('behemoth 巨兽 400hp 4.5速度 slam/charge/regenerate', () => {
    const b = new BossEnemy({ type: 'behemoth' });
    expect(b._maxHp).toBe(400);
    expect(b.speed).toBe(4.5);
    expect(b._name).toBe('巨兽');
    expect(b._skillSet).toEqual(['slam', 'charge', 'regenerate']);
  });
});

describe('BossEnemy mini-boss', () => {
  it('mini 血量*0.7 + 技能减一 + scale 1.1', () => {
    const b = new BossEnemy({ type: 'warlord', mini: true });
    expect(b._maxHp).toBe(210); // 300*0.7
    expect(b._isMini).toBe(true);
    expect(b._skillSet).toEqual(['charge', 'roar']); // slice(0,2)
    expect(b.root.scale.x).toBeCloseTo(1.1, 5);
  });

  it('全 Boss scale 1.35', () => {
    const b = new BossEnemy({ type: 'behemoth' });
    expect(b.root.scale.x).toBeCloseTo(1.35, 5);
  });
});

describe('BossEnemy enterPhase', () => {
  it('全 Boss 升 3 阶段', () => {
    const b = new BossEnemy({ type: 'behemoth' });
    b.enterPhase(3);
    expect(b._phase).toBe(3);
  });

  it('mini 限 2 阶段', () => {
    const b = new BossEnemy({ type: 'mage', mini: true });
    b.enterPhase(3);
    expect(b._phase).toBe(2);
  });
});

describe('BossEnemy 技能方法', () => {
  it('ranger 技能方法存在', () => {
    const b = new BossEnemy({ type: 'ranger' });
    expect(typeof b._skillRapidshot).toBe('function');
    expect(typeof b._skillDodge).toBe('function');
    expect(typeof b._skillTrap).toBe('function');
  });

  it('mage 技能方法存在', () => {
    const b = new BossEnemy({ type: 'mage' });
    expect(typeof b._skillFireball).toBe('function');
    expect(typeof b._skillTeleport).toBe('function');
    expect(typeof b._skillAoe).toBe('function');
  });

  it('behemoth 技能方法存在', () => {
    const b = new BossEnemy({ type: 'behemoth' });
    expect(typeof b._skillSlam).toBe('function');
    expect(typeof b._skillRegenerate).toBe('function');
  });
});

describe('BossEnemy displayName', () => {
  it('【Boss】战将', () => {
    expect(new BossEnemy({ type: 'warlord' }).displayName).toBe('【Boss】战将');
  });
  it('【Boss】巨兽', () => {
    expect(new BossEnemy({ type: 'behemoth' }).displayName).toBe('【Boss】巨兽');
  });
});
