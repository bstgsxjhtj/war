// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/world/Terrain.js', () => ({
  Terrain: class {
    constructor(w, h, opts) {
      this.w = w; this.h = h; this.opts = opts;
    }
  },
}));

import { MapGenerator } from '../../src/world/MapGenerator.js';

describe('MapGenerator', () => {
  it('recommendMap 模式→地图键映射', () => {
    expect(MapGenerator.recommendMap('攻城')).toBe('fortress');
    expect(MapGenerator.recommendMap('死斗')).toBe('field');
    expect(MapGenerator.recommendMap('据点')).toBe('bridge');
    expect(MapGenerator.recommendMap('未知')).toBe('field');
  });

  it('cycleMap 环形切换', () => {
    const keys = Object.keys(MapGenerator.MAPS);
    expect(MapGenerator.cycleMap(keys[0])).toBe(keys[1]);
    expect(MapGenerator.cycleMap(keys[keys.length - 1])).toBe(keys[0]);
    expect(MapGenerator.cycleMap('不存在')).toBe(keys[0]);
  });

  it('generate 未知键回退 field 定义', () => {
    const r = MapGenerator.generate('不存在的地图');
    expect(r.name).toBe(MapGenerator.MAPS.field.name);
    expect(r.size).toEqual(MapGenerator.MAPS.field.size);
    expect(r.spawns).toEqual(MapGenerator.MAPS.field.spawns);
    expect(r.layout).toEqual(MapGenerator.MAPS.field.layout);
  });

  it('generate 已知键返回对应定义', () => {
    const r = MapGenerator.generate('fortress');
    expect(r.name).toBe('攻城');
    expect(r.terrain.w).toBe(320);
    expect(r.terrain.h).toBe(220);
  });

  it('field 地图含毒沼 hazard', () => {
    const h = MapGenerator.MAPS.field.hazards;
    expect(h).toBeDefined();
    expect(h.some(z => z.type === 'poison')).toBe(true);
  });

  it('forest 地图含毒沼 hazard', () => {
    const h = MapGenerator.MAPS.forest.hazards;
    expect(h).toBeDefined();
    expect(h.some(z => z.type === 'poison')).toBe(true);
  });

  it('bridge 地图含油渍 hazard', () => {
    const h = MapGenerator.MAPS.bridge.hazards;
    expect(h).toBeDefined();
    expect(h.some(z => z.type === 'oil')).toBe(true);
  });

  it('river 地图含油渍 hazard', () => {
    const h = MapGenerator.MAPS.river.hazards;
    expect(h).toBeDefined();
    expect(h.some(z => z.type === 'oil')).toBe(true);
  });

  it('generate 返回 hazards 字段', () => {
    const r = MapGenerator.generate('field');
    expect(r.hazards).toBeDefined();
    expect(r.hazards).toEqual(MapGenerator.MAPS.field.hazards);
  });

  it('无 hazard 的地图 generate 返回 undefined', () => {
    const r = MapGenerator.generate('pass');
    expect(r.hazards).toBeUndefined();
  });
});
