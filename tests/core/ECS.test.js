import { ECS } from '../../src/core/ECS.js';
import { describe, it, expect } from 'vitest';

describe('ECS', () => {
  it('createEntity 返回递增 id', () => {
    const e = new ECS();
    const a = e.createEntity();
    const b = e.createEntity();
    expect(b).toBeGreaterThan(a);
  });

  it('addComponent/getComponent/hasComponent', () => {
    const e = new ECS();
    const id = e.createEntity();
    e.addComponent(id, 'pos', { x: 1 });
    expect(e.hasComponent(id, 'pos')).toBe(true);
    expect(e.getComponent(id, 'pos').x).toBe(1);
  });

  it('updateComponent 合并 patch', () => {
    const e = new ECS();
    const id = e.createEntity();
    e.addComponent(id, 'pos', { x: 1, y: 0 });
    e.updateComponent(id, 'pos', { y: 5 });
    expect(e.getComponent(id, 'pos')).toEqual({ x: 1, y: 5 });
  });

  it('removeEntity 清理组件', () => {
    const e = new ECS();
    const id = e.createEntity();
    e.addComponent(id, 'pos', { x: 1 });
    e.removeEntity(id);
    expect(e.getComponent(id, 'pos')).toBeNull();
    expect(e.query([])).not.toContain(id);
  });

  it('query 按必需组件过滤', () => {
    const e = new ECS();
    const a = e.createEntity(); e.addComponent(a, 'pos', {});
    const b = e.createEntity(); e.addComponent(b, 'pos', {}); e.addComponent(b, 'vel', {});
    expect(e.query(['pos']).sort()).toEqual([a, b].sort());
    expect(e.query(['vel'])).toEqual([b]);
  });

  it('registerSystem/runSystems 调用 fn', () => {
    const e = new ECS();
    const id = e.createEntity(); e.addComponent(id, 'pos', {});
    let called = [];
    e.registerSystem(['pos'], (world, ids) => { called = ids; });
    e.runSystems({});
    expect(called).toContain(id);
  });
});
