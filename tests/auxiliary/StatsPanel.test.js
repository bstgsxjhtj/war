// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatsPanel } from '../../src/auxiliary/StatsPanel.js';
import { UIStack } from '../../src/ui/UIStack.js';

beforeEach(() => {
  document.body.innerHTML = '';
  UIStack._stack.length = 0;
});

describe('StatsPanel 生涯统计面板', () => {
  it('构造创建面板并默认隐藏（display none, z-index 150, 480px）', () => {
    const bus = { on: vi.fn(), off: vi.fn() };
    const p = new StatsPanel(bus);
    expect(p.el).toBeDefined();
    expect(p.el.parentElement).toBe(document.body);
    expect(p.el.style.display).toBe('none');
    expect(p.el.style.position).toBe('fixed');
    expect(p.el.style.zIndex).toBe('150');
    expect(p.el.style.width).toBe('480px');
    expect(p.el.style.maxHeight).toBe('80vh');
    expect(p.visible).toBe(false);
    expect(p.toggleKey).toBe('KeyP');
  });

  it('show/hide 切换 display 并同步 UIStack', () => {
    const bus = { on: vi.fn(), off: vi.fn() };
    const p = new StatsPanel(bus);
    p.show();
    expect(p.visible).toBe(true);
    expect(p.el.style.display).toBe('flex');
    expect(UIStack.top).toBe(p);
    p.hide();
    expect(p.visible).toBe(false);
    expect(p.el.style.display).toBe('none');
    expect(UIStack.empty).toBe(true);
  });

  it('setData + render 展示各项统计数值与中文标签', () => {
    const bus = { on: vi.fn(), off: vi.fn() };
    const p = new StatsPanel(bus);
    p.setData({
      totalKills: 152, totalDeaths: 37, totalMatches: 40, wins: 12,
      bestWave: 25, bestCombo: 64, bestKillStreak: 9,
      playTimeSec: 7325, achievementCount: 8, totalAchievements: 30
    });
    p.show();
    const text = p.el.textContent;
    expect(text).toContain('生涯统计');
    expect(text).toContain('总击杀');
    expect(text).toContain('152');
    expect(text).toContain('总阵亡');
    expect(text).toContain('37');
    expect(text).toContain('总场次');
    expect(text).toContain('40');
    expect(text).toContain('胜率');
    expect(text).toContain('30%');
    expect(text).toContain('最高波数');
    expect(text).toContain('25');
    expect(text).toContain('最高连击');
    expect(text).toContain('64');
    expect(text).toContain('最高连杀');
    expect(text).toContain('9');
    expect(text).toContain('游玩时长');
    expect(text).toContain('2h 2m');
    expect(text).toContain('成就进度');
    expect(text).toContain('8/30');
  });

  it('pausesGame=true，入栈时触发 UIStack.pausing（C1-6 暂停门）', () => {
    const bus = { on: vi.fn(), off: vi.fn() };
    const p = new StatsPanel(bus);
    expect(p.pausesGame).toBe(true);
    p.show();
    expect(UIStack.pausing).toBe(true);
    p.hide();
    expect(UIStack.pausing).toBe(false);
  });

  it('destroy 移除 DOM 并清理栈与按键监听', () => {
    const bus = { on: vi.fn(), off: vi.fn() };
    const p = new StatsPanel(bus);
    p.show();
    p.destroy();
    expect(p.el.parentElement).toBe(null);
    expect(document.body.contains(p.el)).toBe(false);
    expect(UIStack.empty).toBe(true);
  });
});
