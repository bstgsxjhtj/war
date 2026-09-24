// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultScreen } from '../../src/ui/ResultScreen.js';

describe('ResultScreen.gradeGap 评级差距', () => {
  it('S 评级时返回 null（已到顶）', () => {
    expect(ResultScreen.gradeGap(8, 200, 50)).toBe(null);
  });

  it('A 评级时返回到 S 的差距', () => {
    const g = ResultScreen.gradeGap(5, 150, 80);
    expect(g.next).toBe('S');
    expect(g.gap).toBeGreaterThan(0);
  });

  it('B 评级时返回到 A 的差距', () => {
    const g = ResultScreen.gradeGap(3, 100, 80);
    expect(g.next).toBe('A');
    expect(g.gap).toBeGreaterThan(0);
  });

  it('C 评级时返回到 B 的差距', () => {
    const g = ResultScreen.gradeGap(0, 50, 100);
    expect(g.next).toBe('B');
    expect(g.gap).toBeGreaterThan(0);
  });
});

describe('ResultScreen.show 渲染差一点反馈', () => {
  let rs, bus;
  beforeEach(() => {
    bus = { emit: vi.fn(), on: vi.fn() };
    rs = new ResultScreen(bus);
  });

  it('非 S 评级时渲染评级差距提示', () => {
    rs.show({ kills: 3, damage: 100, time: 80, win: false });
    expect(rs.el.innerHTML).toContain('距');
    expect(rs.el.innerHTML).toContain('A');
  });

  it('S 评级时不渲染评级差距', () => {
    rs.show({ kills: 8, damage: 200, time: 50, win: true });
    expect(rs.el.innerHTML).not.toContain('距');
  });

  it('失败时渲染死因', () => {
    rs.show({ kills: 0, damage: 10, time: 30, win: false, deathCause: '刀' });
    expect(rs.el.innerHTML).toContain('刀');
  });

  it('胜利时不渲染死因', () => {
    rs.show({ kills: 5, damage: 150, time: 50, win: true, deathCause: null });
    expect(rs.el.innerHTML).not.toContain('死因');
  });
});

describe('ResultScreen.show 死因统计', () => {
  let rs, bus;
  beforeEach(() => {
    bus = { emit: vi.fn(), on: vi.fn() };
    rs = new ResultScreen(bus);
  });

  it('deathStats 渲染 top3 死因', () => {
    rs.show({ kills: 0, damage: 10, time: 30, win: false, deathStats: { causes: [{ name: '长矛', count: 2 }, { name: '战锤', count: 1 }], total: 3, countered: 1 } });
    expect(rs.el.innerHTML).toContain('长矛');
    expect(rs.el.innerHTML).toContain('2');
    expect(rs.el.innerHTML).toContain('战锤');
  });

  it('deathStats 渲染克制占比', () => {
    rs.show({ kills: 0, damage: 10, time: 30, win: false, deathStats: { causes: [{ name: '长矛', count: 2 }], total: 4, countered: 2 } });
    expect(rs.el.innerHTML).toContain('克制');
    expect(rs.el.innerHTML).toContain('50');
  });

  it('无 deathStats 时不渲染死因统计区', () => {
    rs.show({ kills: 5, damage: 150, time: 50, win: true });
    expect(rs.el.innerHTML).not.toContain('死因统计');
  });
});
