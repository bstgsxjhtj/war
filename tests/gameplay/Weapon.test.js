import { Weapon, AttackType } from '../../src/gameplay/Weapon.js';
import { Sword } from '../../src/gameplay/weapons/Sword.js';
import { SwordShield } from '../../src/gameplay/weapons/SwordShield.js';
import { Spear } from '../../src/gameplay/weapons/Spear.js';
import { Warhammer } from '../../src/gameplay/weapons/Warhammer.js';
import { Bow } from '../../src/gameplay/weapons/Bow.js';
import { Dagger } from '../../src/gameplay/weapons/Dagger.js';
import { HuntDagger } from '../../src/gameplay/weapons/HuntDagger.js';
import { MageDagger } from '../../src/gameplay/weapons/MageDagger.js';
import { Staff } from '../../src/gameplay/weapons/Staff.js';
import * as THREE from 'three';
import { describe, it, expect } from 'vitest';

describe('Weapon', () => {
  it('构造存储字段并设默认 weaponClass', () => {
    const w = new Weapon({ name: '刀', damage: 20, range: 2, cooldown: 0.4, type: AttackType.MELEE });
    expect(w.name).toBe('刀');
    expect(w.damage).toBe(20);
    expect(w.range).toBe(2);
    expect(w.cooldown).toBe(0.4);
    expect(w.type).toBe(AttackType.MELEE);
    expect(w.weaponClass).toBe('SWORD');
    expect(w.armorPierce).toBe(false);
    expect(w.shieldBlock).toBe(false);
  });

  it('ready 在 tick 前为 true，tick 后随 cooldown 转 false 再回 true', () => {
    const w = new Weapon({ name: 'x', damage: 1, range: 1, cooldown: 0.5, type: 'melee' });
    expect(w.ready).toBe(true);
    w._timer = 0.5;
    expect(w.ready).toBe(false);
    w.tick(0.5);
    expect(w.ready).toBe(true);
  });

  it('_perform 抛未实现错误', () => {
    const w = new Weapon({ name: 'x', damage: 1, range: 1, cooldown: 1, type: 'melee' });
    expect(() => w._perform({}, {}, {})).toThrow();
  });
});

// MageDagger 曾把 PointLight 当几何传给 THREE.Mesh，导致 Mesh 构造期
// Object.keys(undefined) 抛 TypeError，法师武器建模失败
const ALL_WEAPONS = [Sword, SwordShield, Spear, Warhammer, Bow, Dagger, HuntDagger, MageDagger, Staff];

describe('武器 createMesh 建模健壮性', () => {
  for (const W of ALL_WEAPONS) {
    it(`${W.name} createMesh 返回 Object3D 且不抛错`, () => {
      const mesh = new W().createMesh();
      expect(mesh).toBeInstanceOf(THREE.Object3D);
      expect(mesh.isMesh || mesh.isGroup).toBeTruthy();
    });
  }

  it('MageDagger 的剑柄光源是 PointLight 而非 Mesh', () => {
    const g = new MageDagger().createMesh();
    const lights = [];
    g.traverse((o) => { if (o.isLight) lights.push(o); });
    expect(lights.length).toBe(1);
    expect(lights[0].isPointLight).toBe(true);
  });
});
