// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CombatSystem } from '../../src/gameplay/CombatSystem.js';
import { COMBAT } from '../../src/core/constants/balance.js';

vi.mock('../../src/render/ParticleFX.js', () => ({
  ParticleFX: Object.assign(
    class { constructor() {} spawnBurst() {} spawn() {} update() {} },
    { blood: () => new (class { setAttribute() {} })() }
  )
}));

describe('CombatSystem 箭矢释放 _releaseArrow (P0-2)', () => {
  let cs, scene, bus;
  beforeEach(() => {
    bus = { emit: vi.fn() };
    scene = { add: vi.fn(), remove: vi.fn() };
    cs = new CombatSystem(scene, bus);
  });

  it('_releaseArrow 方法定义存在', () => {
    expect(typeof cs._releaseArrow).toBe('function');
  });

  it('_releaseArrow 从场景移除箭 mesh，不抛 TypeError', () => {
    const arrow = { mesh: { name: 'arrow' } };
    expect(() => cs._releaseArrow(arrow)).not.toThrow();
    expect(scene.remove).toHaveBeenCalledWith(arrow.mesh);
  });

  it('update 箭命中目标后调用 _releaseArrow 不抛异常', () => {
    cs.spawnHitFX = vi.fn();
    cs._emitHit = vi.fn();
    cs._affixApply = vi.fn(() => 10);
    cs._affixLeech = vi.fn();
    const victim = {
      alive: true, team: 1,
      position: { x: 0, y: 0, z: 0, distanceTo: () => 0.1, clone() { return this; } },
      capsule: { center: { x: 0, y: 0, z: 0 }, radius: 1, halfHeight: 1 },
      takeDamage: vi.fn(() => 10),
      health: { alive: true }
    };
    const attacker = { team: 0, weapon: { weaponClass: 'BOW' } };
    cs.characters = [victim];
    cs.arrows = [{ pos: new THREE.Vector3(0, 0, 0), vel: new THREE.Vector3(0, 0, 0), life: 1, mesh: { position: { copy() {} }, lookAt() {} }, team: 0, attacker, damage: 10, charge: 0 }];
    const terrain = { heightAt: () => 0 };
    expect(() => cs.update(0.016, terrain, 1000)).not.toThrow();
  });
});

describe('CombatSystem 箭矢对象池复用 (P2-6)', () => {
  let cs, scene, bus, attacker;
  beforeEach(() => {
    bus = { emit: vi.fn() };
    scene = { add: vi.fn(), remove: vi.fn() };
    cs = new CombatSystem(scene, bus);
    attacker = {
      team: 0,
      position: new THREE.Vector3(0, 0, 0),
      forward: new THREE.Vector3(0, 0, 1),
      weapon: { speedFor: () => 30, damageFor: () => 10 }
    };
  });

  it('_acquireArrow / _releaseArrow 复用同一 mesh 对象', () => {
    const a1 = cs._acquireArrow();
    cs._releaseArrow(a1);
    const a2 = cs._acquireArrow();
    expect(a2.mesh).toBe(a1.mesh);
  });

  it('spawnArrow 释放后再发射复用同一 mesh（避免重复分配）', () => {
    scene.add.mockClear();
    cs.spawnArrow(attacker, attacker.weapon, 0);
    const first = cs.arrows[0];
    cs._releaseArrow(first);
    cs.arrows.length = 0;
    cs.spawnArrow(attacker, attacker.weapon, 0);
    expect(cs.arrows[0].mesh).toBe(first.mesh);
    expect(scene.add).toHaveBeenCalledTimes(2);
  });

  it('池内箭矢被复用时重置 pierce/hitSet 状态', () => {
    cs.spawnPierceArrow(attacker, attacker.weapon, 0);
    const pa = cs.arrows[0];
    expect(pa.pierce).toBe(COMBAT.PIERCE_ARROW_PIERCE);
    expect(pa.hitSet).toBeInstanceOf(Set);
    cs._releaseArrow(pa);
    cs.arrows.length = 0;
    cs.spawnArrow(attacker, attacker.weapon, 0);
    expect(cs.arrows[0].pierce).toBeFalsy();
    expect(cs.arrows[0].hitSet).toBeNull();
  });

  it('spawnArrow 写入独立的 pos/vel 向量（池复用后仍各自独立）', () => {
    cs.spawnArrow(attacker, attacker.weapon, 0);
    const a1 = cs.arrows[0];
    cs.spawnArrow(attacker, attacker.weapon, 0);
    const a2 = cs.arrows[1];
    expect(a1.pos).not.toBe(a2.pos);
    expect(a1.vel).not.toBe(a2.vel);
    expect(a1.pos).not.toBe(cs._tmpOrigin);
  });
});

describe('CombatSystem 穿透箭命中链 (P1 修复)', () => {
  let cs, scene, bus, attacker;
  function makeVictim(id) {
    return {
      _id: id, alive: true, team: 1,
      position: new THREE.Vector3(0, 0, 0),
      capsule: { center: new THREE.Vector3(0, 0, 0), radius: 1, halfHeight: 1 },
      takeDamage: vi.fn(() => 10),
      health: { alive: true }
    };
  }
  beforeEach(() => {
    bus = { emit: vi.fn() };
    scene = { add: vi.fn(), remove: vi.fn() };
    cs = new CombatSystem(scene, bus);
    cs.spawnHitFX = vi.fn();
    cs._emitHit = vi.fn();
    cs._affixApply = vi.fn(() => 10);
    cs._affixLeech = vi.fn();
    attacker = {
      team: 0,
      position: new THREE.Vector3(0, 0, 0),
      forward: new THREE.Vector3(0, 0, 1),
      weapon: { speedFor: () => 30, damageFor: () => 10 }
    };
  });

  it('穿透箭命中首个目标后仍存活并继续飞行', () => {
    const v1 = makeVictim(1);
    cs.characters = [v1];
    cs.spawnPierceArrow(attacker, attacker.weapon, 0);
    const arrow = cs.arrows[0];
    arrow.pos.set(0, 0.5, 0); arrow.vel.set(0, 0, 0);
    const terrain = { heightAt: () => -10 };
    cs.update(0.001, terrain, 0);
    expect(v1.takeDamage).toHaveBeenCalled();
    expect(arrow.pierce).toBe(COMBAT.PIERCE_ARROW_PIERCE - 1);
    expect(arrow.hitSet.has(v1)).toBe(true);
    expect(cs.arrows.length).toBe(1); // 未释放
  });

  it('穿透箭跳过已命中的目标（hitSet 防重复伤害）', () => {
    const v1 = makeVictim(1);
    cs.characters = [v1];
    cs.spawnPierceArrow(attacker, attacker.weapon, 0);
    const arrow = cs.arrows[0];
    arrow.pos.set(0, 0.5, 0); arrow.vel.set(0, 0, 0);
    const terrain = { heightAt: () => -10 };
    cs.update(0.001, terrain, 0);
    cs.update(0.001, terrain, 0);
    expect(v1.takeDamage).toHaveBeenCalledTimes(1);
  });

  it('穿透次数耗尽后命中即释放', () => {
    const victims = [makeVictim(1), makeVictim(2), makeVictim(3), makeVictim(4)];
    cs.characters = victims;
    cs.spawnPierceArrow(attacker, attacker.weapon, 0);
    const arrow = cs.arrows[0];
    arrow.pos.set(0, 0.5, 0); arrow.vel.set(0, 0, 0);
    const terrain = { heightAt: () => -10 };
    cs.update(0.001, terrain, 0);
    // 同一帧命中所有目标：前 PIERCE-1 个穿透，最后一个使 pierce 归 0 后 hit=true
    expect(cs.arrows.length).toBe(0);
    expect(victims[0].takeDamage).toHaveBeenCalled();
  });

  it('普通箭（pierce=0）命中即释放，不影响现有行为', () => {
    const v1 = makeVictim(1);
    cs.characters = [v1];
    cs.spawnArrow(attacker, attacker.weapon, 0);
    const arrow = cs.arrows[0];
    arrow.pos.set(0, 0.5, 0); arrow.vel.set(0, 0, 0);
    const terrain = { heightAt: () => -10 };
    cs.update(0.001, terrain, 0);
    expect(cs.arrows.length).toBe(0);
    expect(v1.takeDamage).toHaveBeenCalled();
  });
});

describe('CombatSystem 高速箭矢扫掠命中 (D8 修复: 线段-点最近距离)', () => {
  let cs, scene, bus, attacker;
  function makeVictim(x) {
    return {
      _id: x, alive: true, team: 1,
      position: new THREE.Vector3(x, 0, 0),
      capsule: { center: new THREE.Vector3(x, 0, 0), radius: 1, halfHeight: 1 },
      takeDamage: vi.fn(() => 10),
      health: { alive: true }
    };
  }
  function makeArrow(px, vx, opts = {}) {
    return {
      pos: new THREE.Vector3(px, 0, 0),
      vel: new THREE.Vector3(vx, 0, 0),
      life: 2, mesh: { position: { copy() {} }, lookAt() {} },
      team: 0, attacker, damage: 10, charge: 0,
      pierce: opts.pierce ?? 0,
      hitSet: opts.hitSet ?? null
    };
  }
  beforeEach(() => {
    bus = { emit: vi.fn() };
    scene = { add: vi.fn(), remove: vi.fn() };
    cs = new CombatSystem(scene, bus);
    cs.spawnHitFX = vi.fn();
    cs._emitHit = vi.fn();
    cs._affixApply = vi.fn(() => 10);
    cs._affixLeech = vi.fn();
    attacker = { team: 0, weapon: { weaponClass: 'BOW' } };
  });

  it('高速箭矢单帧跨过目标时仍命中（扫掠防穿隧）', () => {
    const v = makeVictim(0);
    cs.characters = [v];
    cs.arrows = [makeArrow(-10, 100)];
    const terrain = { heightAt: () => -10 };
    cs.update(0.2, terrain, 0);
    expect(v.takeDamage).toHaveBeenCalled();
    expect(cs.arrows.length).toBe(0);
  });

  it('箭矢路径远离目标时不误命中', () => {
    const v = makeVictim(50);
    cs.characters = [v];
    cs.arrows = [makeArrow(-10, 100)];
    const terrain = { heightAt: () => -10 };
    cs.update(0.2, terrain, 0);
    expect(v.takeDamage).not.toHaveBeenCalled();
  });

  it('低速箭矢仍按端点距离命中（回归兼容）', () => {
    const v = makeVictim(0);
    cs.characters = [v];
    cs.arrows = [makeArrow(-0.3, 1)];
    const terrain = { heightAt: () => -10 };
    cs.update(0.2, terrain, 0);
    expect(v.takeDamage).toHaveBeenCalled();
  });
});

describe('CombatSystem 终极箭穿透链 (D8 相关: pierce=99 + hitSet 修复)', () => {
  let cs, scene, bus, attacker;
  function makeVictim(id, x) {
    return {
      _id: id, alive: true, team: 1,
      position: new THREE.Vector3(x, 0, 0),
      capsule: { center: new THREE.Vector3(x, 0, 0), radius: 1, halfHeight: 1 },
      takeDamage: vi.fn(() => 10),
      health: { alive: true }
    };
  }
  beforeEach(() => {
    bus = { emit: vi.fn() };
    scene = { add: vi.fn(), remove: vi.fn() };
    cs = new CombatSystem(scene, bus);
    cs.spawnHitFX = vi.fn();
    cs._emitHit = vi.fn();
    cs._affixApply = vi.fn(() => 50);
    cs._affixLeech = vi.fn();
    attacker = { team: 0, weapon: { weaponClass: 'BOW' } };
  });

  it('终极箭穿透多个目标不崩溃且仍存活', () => {
    const v1 = makeVictim(1, 0);
    const v2 = makeVictim(2, 5);
    const v3 = makeVictim(3, 10);
    cs.characters = [v1, v2, v3];
    cs.arrows = [{
      pos: new THREE.Vector3(-5, 0, 0),
      vel: new THREE.Vector3(100, 0, 0),
      life: 2, mesh: { position: { copy() {} }, lookAt() {} },
      team: 0, attacker, damage: 50, charge: 1,
      pierce: 99, hitSet: new Set()
    }];
    const terrain = { heightAt: () => -10 };
    cs.update(0.2, terrain, 0);
    expect(v1.takeDamage).toHaveBeenCalled();
    expect(v2.takeDamage).toHaveBeenCalled();
    expect(v3.takeDamage).toHaveBeenCalled();
    expect(cs.arrows.length).toBe(1);
    expect(cs.arrows[0].pierce).toBe(96);
  });
});

describe('CombatSystem 投石/无 attacker 抛射物 (E2/E3 修复)', () => {
  let cs, scene, bus;
  beforeEach(() => {
    bus = { emit: vi.fn() };
    scene = { add: vi.fn(), remove: vi.fn() };
    cs = new CombatSystem(scene, bus);
    cs.spawnHitFX = vi.fn();
    cs._emitHit = vi.fn();
    cs._affixApply = vi.fn();
    cs._affixLeech = vi.fn();
  });

  it('E2: 投石命中角色不抛 TypeError（attacker 为 null）', () => {
    const victim = {
      alive: true, team: 0,
      position: new THREE.Vector3(0, 0, 0),
      capsule: { center: new THREE.Vector3(0, 0, 0), radius: 1, halfHeight: 1 },
      takeDamage: vi.fn(() => 50),
      health: { alive: true }
    };
    cs.characters = [victim];
    cs.arrows = [{
      pos: new THREE.Vector3(0, 1, 0),
      vel: new THREE.Vector3(0, -1, 0),
      life: 2, mesh: { position: { copy() {} }, lookAt() {} },
      team: 1, attacker: null, damage: 80, charge: 1, isSiege: true
    }];
    const terrain = { heightAt: () => -10 };
    expect(() => cs.update(0.016, terrain, 0)).not.toThrow();
    expect(victim.takeDamage).toHaveBeenCalledWith(80, true, null, 0);
  });

  it('E3: 投石落地触发 siege.onSiegeHit', () => {
    const onSiegeHit = vi.fn();
    cs.siege = { gate: { broken: false, position: new THREE.Vector3(0, 0, 0) }, onSiegeHit };
    cs.arrows = [{
      pos: new THREE.Vector3(0, -1, 0),
      vel: new THREE.Vector3(0, -1, 0),
      life: 2, mesh: { position: { copy() {} }, lookAt() {} },
      team: 1, attacker: null, damage: 80, charge: 1, isSiege: true
    }];
    const terrain = { heightAt: () => 0 };
    cs.update(0.1, terrain, 0);
    expect(onSiegeHit).toHaveBeenCalled();
  });

  it('E3: 近战攻击可伤害城门', () => {
    const damageGate = vi.fn();
    cs.siege = { gate: { broken: false, position: new THREE.Vector3(0, 0, 3) }, damageGate };
    const attacker = {
      alive: true, team: 0, position: new THREE.Vector3(0, 0, 0),
      forward: new THREE.Vector3(0, 0, 1), weapon: { range: 2, arc: 1.5, name: '剑', damage: 30 },
      addRage: vi.fn(), killstreakBuffs: null
    };
    cs.characters = [];
    cs._comboSys = null;
    cs.resolveMelee(attacker, attacker.weapon, 0, 0);
    expect(damageGate).toHaveBeenCalled();
  });

  it('F3: isSiege=true 的箭矢不被池化，自定义几何体/材质被 dispose', () => {
    const geoDispose = vi.fn();
    const matDispose = vi.fn();
    const mesh = { geometry: { dispose: geoDispose }, material: { dispose: matDispose } };
    const siegeArrow = { mesh, isSiege: true };
    cs._releaseArrow(siegeArrow);
    expect(geoDispose).toHaveBeenCalledOnce();
    expect(matDispose).toHaveBeenCalledOnce();
    expect(cs._arrowPool.length).toBe(0);
    expect(scene.remove).toHaveBeenCalledWith(mesh);
  });

  it('F3: spawnArrow 重置 isSiege=false（池化箭矢不被投石标记污染）', () => {
    const a = cs._acquireArrow();
    a.isSiege = true;
    cs._arrowPool.length = 0;
    cs._arrowPool.push(a);
    cs.arrows.length = 0;
    const attacker = {
      position: new THREE.Vector3(0, 0, 0),
      forward: new THREE.Vector3(0, 0, 1),
      team: 0,
      weapon: { speedFor: () => 30, damageFor: () => 20 }
    };
    cs.spawnArrow(attacker, attacker.weapon, 0.5);
    expect(cs.arrows[0].isSiege).toBe(false);
  });

  it('F3: spawnPierceArrow 重置 isSiege=false', () => {
    const a = cs._acquireArrow();
    a.isSiege = true;
    cs._arrowPool.length = 0;
    cs._arrowPool.push(a);
    cs.arrows.length = 0;
    const attacker = {
      position: new THREE.Vector3(0, 0, 0),
      forward: new THREE.Vector3(0, 0, 1),
      team: 0,
      weapon: { speedFor: () => 30, damageFor: () => 20 }
    };
    cs.spawnPierceArrow(attacker, attacker.weapon, 1, { origin: new THREE.Vector3(0, 1, 0), dir: new THREE.Vector3(0, 0, 1), damage: 30 });
    expect(cs.arrows[0].isSiege).toBe(false);
  });
});
