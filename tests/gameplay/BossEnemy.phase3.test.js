// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { BossEnemy } from '../../src/gameplay/BossEnemy.js';

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

function mkTgt(x = 3) {
  return { alive: true, team: 0, position: new THREE.Vector3(x, 0, 0), health: { alive: true }, takeDamage: vi.fn(), _curVel: { addScaledVector() {} }, vy: 0, forward: { x: 0, z: 1 } };
}

describe('P3-1 Boss 阶段 3 专属机制', () => {
  it('behemoth 阶段 3 触发地震波（多段 AOE）', () => {
    const b = new BossEnemy({ type: 'behemoth' });
    b._phase = 3;
    b._quakeCd = 0;
    const spawnAoE = vi.fn();
    const combat = { spawnAoE, characters: [] };
    b.update(0.1, { heightAt: () => 0 }, combat, [mkTgt()], 0);
    expect(spawnAoE.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(b._quakeCd).toBeGreaterThan(0);
  });

  it('mage 阶段 3 触发陨石（远程 AOE 落点）', () => {
    const b = new BossEnemy({ type: 'mage' });
    b._phase = 3;
    b._meteorCd = 0;
    const spawnAoE = vi.fn();
    const spawnPierceArrow = vi.fn();
    const combat = { spawnAoE, spawnPierceArrow, characters: [] };
    b.update(0.1, { heightAt: () => 0 }, combat, [mkTgt()], 0);
    expect(spawnAoE).toHaveBeenCalled();
    expect(b._meteorCd).toBeGreaterThan(0);
  });

  it('ranger 阶段 3 触发分身（emit boss.summon count=2）', () => {
    const b = new BossEnemy({ type: 'ranger' });
    b._phase = 3;
    b._cloneCd = 0;
    const emits = [];
    b._bus = { emit: (ev, p) => emits.push({ ev, p }) };
    b.update(0.1, { heightAt: () => 0 }, { spawnAoE: vi.fn(), characters: [] }, [mkTgt()], 0);
    const summon = emits.find(e => e.ev === 'boss.summon');
    expect(summon).toBeTruthy();
    expect(summon.p.count).toBe(2);
    expect(b._cloneCd).toBeGreaterThan(0);
  });

  it('阶段 2 不触发阶段 3 专属机制', () => {
    const b = new BossEnemy({ type: 'behemoth' });
    b._phase = 2;
    b._quakeCd = 0;
    const spawnAoE = vi.fn();
    b.update(0.1, { heightAt: () => 0 }, { spawnAoE, characters: [] }, [mkTgt()], 0);
    expect(b._quakeCd).toBeLessThanOrEqual(0);
  });

  it('warlord 无阶段 3 专属机制（保持 summon）', () => {
    const b = new BossEnemy({ type: 'warlord' });
    expect(b._phase3Skill).toBeFalsy();
  });
});

describe('P1-1 Boss AOE telegraph 延迟结算', () => {
  it('quake 三段均带 delay（可闪避窗口，无裸 setTimeout）', () => {
    const b = new BossEnemy({ type: 'behemoth' });
    b._phase = 3;
    const spawnAoE = vi.fn();
    b._skillQuake({ spawnAoE, characters: [] }, 0);
    expect(spawnAoE).toHaveBeenCalledTimes(3);
    for (const call of spawnAoE.mock.calls) {
      expect(call[5]).toBeGreaterThan(0);
    }
    const delays = spawnAoE.mock.calls.map(c => c[5]);
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(0.4);
    expect(Math.max(...delays)).toBeGreaterThanOrEqual(1.0);
  });

  it('meteor 落点带 delay（可闪避）', () => {
    const b = new BossEnemy({ type: 'mage' });
    const spawnAoE = vi.fn();
    const target = { position: new THREE.Vector3(3, 0, 0) };
    b._skillMeteor(target, { spawnAoE, characters: [] }, 0);
    expect(spawnAoE).toHaveBeenCalledTimes(1);
    expect(spawnAoE.mock.calls[0][5]).toBeGreaterThan(0);
  });

  it('slam/aoe 阶段技能也带 delay', () => {
    const b = new BossEnemy({ type: 'warlord' });
    const slamAoE = vi.fn();
    b._skillSlam({ spawnAoE: slamAoE, characters: [] }, 0);
    expect(slamAoE.mock.calls[0][5]).toBeGreaterThan(0);
    const aoeMock = vi.fn();
    b._skillAoe({ spawnAoE: aoeMock, characters: [] }, 0);
    expect(aoeMock.mock.calls[0][5]).toBeGreaterThan(0);
  });
});