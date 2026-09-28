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

describe('ResultScreen 评级纳入承伤与表现', () => {
  it('承伤按 0.05/点扣分', () => {
    const base = ResultScreen._scoreOf(5, 150, 80);
    const taken = ResultScreen._scoreOf(5, 150, 80, { taken: 400 });
    expect(taken).toBeCloseTo(base - 20, 5);
  });

  it('表现维度（完美格挡/闪避/处决/暴击/连击）加分', () => {
    const score = ResultScreen._scoreOf(0, 0, 200, { perfectBlocks: 3, perfectDodges: 2, executes: 4, crits: 10, maxCombo: 8 });
    expect(score).toBeGreaterThan(0);
  });

  it('不传 stats 时评分与旧行为一致', () => {
    expect(ResultScreen._scoreOf(5, 150, 80)).toBe(65);
  });
});

describe('ResultScreen.show 战斗复盘', () => {
  let rs, bus;
  beforeEach(() => {
    bus = { emit: vi.fn(), on: vi.fn() };
    rs = new ResultScreen(bus);
  });

  it('渲染最大连击/完美格挡/闪避/处决/暴击/命中率', () => {
    rs.show({ kills: 5, damage: 150, time: 80, win: true, stats: { taken: 0, maxCombo: 12, perfectBlocks: 3, perfectDodges: 2, executes: 1, crits: 4, hits: 30, misses: 10 } });
    const h = rs.el.innerHTML;
    expect(h).toContain('战斗复盘');
    expect(h).toContain('最大连击');
    expect(h).toContain('12');
    expect(h).toContain('完美格挡');
    expect(h).toContain('完美闪避');
    expect(h).toContain('处决');
    expect(h).toContain('暴击');
    expect(h).toContain('命中率');
    expect(h).toContain('75%');
  });

  it('无 stats 时不渲染战斗复盘区', () => {
    rs.show({ kills: 5, damage: 150, time: 50, win: true });
    expect(rs.el.innerHTML).not.toContain('战斗复盘');
  });

  it('用时为 0（战役）时隐藏 0:00 用时并显示承伤', () => {
    rs.show({ kills: 5, damage: 150, time: 0, win: true, stats: { taken: 120, maxCombo: 3, perfectBlocks: 0, perfectDodges: 0, executes: 0, crits: 0, hits: 10, misses: 0 } });
    const h = rs.el.innerHTML;
    expect(h).not.toContain('0:00');
    expect(h).not.toContain('用时');
    expect(h).toContain('承伤');
    expect(h).toContain('120');
  });

  it('有 stats 时用时与承伤同时展示', () => {
    rs.show({ kills: 5, damage: 150, time: 80, win: true, stats: { taken: 40, maxCombo: 3, perfectBlocks: 0, perfectDodges: 0, executes: 0, crits: 0, hits: 10, misses: 0 } });
    const h = rs.el.innerHTML;
    expect(h).toContain('用时');
    expect(h).toContain('承伤');
    expect(h).toContain('40');
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
