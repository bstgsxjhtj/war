// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { BossEnemy } from '../../src/gameplay/BossEnemy.js';
import { EV } from '../../src/core/constants/events.js';

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

  it('_skillRoar 发射 FX_BOSSROAR 音效事件', () => {
    const b = new BossEnemy({ type: 'warlord' });
    const bus = { emit: vi.fn() };
    b._bus = bus;
    b._skillRoar({ characters: [], spawnAoE: vi.fn() }, 0);
    expect(bus.emit).toHaveBeenCalledWith(EV.FX_BOSSROAR, expect.anything());
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

describe('BossEnemy 位移技能写入 this.position (P1-1)', () => {
  it('_skillCharge 冲锋位移生效', () => {
    const b = new BossEnemy({ type: 'warlord' });
    b.position.set(0, 0, 0);
    const target = { position: new THREE.Vector3(10, 0, 0) };
    b._skillCharge(target, { characters: [] }, 0);
    expect(b.position.x).toBeCloseTo(8, 1);
  });

  it('_skillDodge 闪避位移生效（远离目标）', () => {
    const b = new BossEnemy({ type: 'ranger' });
    b.position.set(0, 0, 0);
    const target = { position: new THREE.Vector3(10, 0, 0) };
    b._skillDodge(target, 0);
    expect(b.position.x).toBeCloseTo(-4, 1);
  });

  it('_skillTeleport 传送位移生效', () => {
    const b = new BossEnemy({ type: 'mage' });
    b.position.set(0, 0, 0);
    const target = { position: new THREE.Vector3(10, 0, 0) };
    b._skillTeleport(target, 0);
    expect(b.position.x).toBeCloseTo(5, 1);
  });
});

describe('BossEnemy 阶段技能门槛 (P1-7)', () => {
  it('slam/dodge 在阶段 1 即可用，其余技能默认阶段 2', () => {
    const b = new BossEnemy({ type: 'behemoth' });
    expect(b._phaseGate('slam')).toBe(1);
    expect(b._phaseGate('dodge')).toBe(1);
    expect(b._phaseGate('charge')).toBe(2);
    expect(b._phaseGate('roar')).toBe(2);
    expect(b._phaseGate('summon')).toBe(3);
  });

  it('阶段 1 巨兽可释放 slam（旧逻辑需阶段 2）', () => {
    const b = new BossEnemy({ type: 'behemoth' });
    const spawnAoE = vi.fn();
    const combat = { spawnAoE, characters: [] };
    const tgt = { alive: true, team: 0, position: new THREE.Vector3(3, 0, 0), health: { alive: true }, takeDamage: vi.fn(), _curVel: { addScaledVector() {} }, vy: 0, forward: { x: 0, z: 1 } };
    b.update(0.1, { heightAt: () => 0 }, combat, [tgt], 0);
    expect(spawnAoE).toHaveBeenCalled();
    expect(b._slamCd).toBeGreaterThan(0);
  });

  it('阶段 1 战将 charge 仍锁定', () => {
    const b = new BossEnemy({ type: 'warlord' });
    const combat = { spawnAoE: vi.fn(), characters: [] };
    const tgt = { alive: true, team: 0, position: new THREE.Vector3(3, 0, 0), health: { alive: true }, takeDamage: vi.fn(), _curVel: { addScaledVector() {} }, vy: 0, forward: { x: 0, z: 1 } };
    b.update(0.1, { heightAt: () => 0 }, combat, [tgt], 0);
    expect(b._chargeCd).toBeLessThanOrEqual(0);
  });

  it('阶段 3 冷却恢复加速 40%', () => {
    const b = new BossEnemy({ type: 'warlord' });
    b._phase = 3;
    b._chargeCd = 2;
    b.update(1, { heightAt: () => 0 }, { spawnAoE: vi.fn(), characters: [] }, [], 0);
    expect(b._chargeCd).toBeCloseTo(2 - 1.4, 5);
  });

  it('阶段 2 冷却常速', () => {
    const b = new BossEnemy({ type: 'warlord' });
    b._phase = 2;
    b._chargeCd = 2;
    b.update(1, { heightAt: () => 0 }, { spawnAoE: vi.fn(), characters: [] }, [], 0);
    expect(b._chargeCd).toBeCloseTo(1, 5);
  });
});

describe('BossEnemy 血量与 health 联动（E1 修复：消除实例字段双真相）', () => {
  it('构造后 boss.hp 与 boss.health.hp 同源', () => {
    const b = new BossEnemy({ type: 'warlord' });
    expect(b.hp).toBe(b.health.hp);
    expect(b.maxHp).toBe(b.health.maxHp);
  });

  it('takeDamage 扣减同时反映到 hp 访问器', () => {
    const b = new BossEnemy({ type: 'warlord' });
    b.takeDamage(100, false, null, 0);
    expect(b.hp).toBe(b.health.hp);
    expect(b.hp).toBeLessThan(b._maxHp);
  });

  it('hpPct 低于 0.6 触发阶段 2（验证阶段机制不再死代码）', () => {
    const b = new BossEnemy({ type: 'warlord' });
    const bus = { emit: vi.fn() };
    b.setBus(bus);
    b.takeDamage(200, false, null, 0); // 300 - 200 = 100, pct=0.33 < 0.6
    b.update(0.016, { heightAt: () => 0 }, { characters: [] }, [], 0);
    expect(b._phase).toBe(2);
    expect(bus.emit).toHaveBeenCalledWith(EV.HUD_BOSSPHASE, expect.objectContaining({ phase: 2 }));
  });

  it('EliteEnemy 血量同样与 health 联动', () => {
    const e = new (require('../../src/gameplay/BossEnemy.js').EliteEnemy)({ team: 1 });
    expect(e.hp).toBe(e.health.hp);
    expect(e.maxHp).toBe(e.health.maxHp);
    expect(e.maxHp).toBe(140);
  });
});

describe('F1: BossEnemy._skillRapidshot 调用签名修复', () => {
  it('rapidshot 使用正确的 spawnPierceArrow 参数（attacker, weapon, charge, opts）', () => {
    const b = new BossEnemy({ type: 'ranger' });
    const calls = [];
    const combat = { spawnPierceArrow: (...args) => calls.push(args) };
    const target = { position: new THREE.Vector3(10, 0, 5) };
    b._skillRapidshot(target, combat, 0);
    expect(calls.length).toBe(3);
    for (const args of calls) {
      expect(args[0]).toBe(b);
      expect(args[1]).toBe(b.weapon);
      expect(args[2]).toBe(1);
      expect(args[3].origin).toBeDefined();
      expect(args[3].dir).toBeDefined();
      expect(args[3].damage).toBe(30);
    }
  });
});
