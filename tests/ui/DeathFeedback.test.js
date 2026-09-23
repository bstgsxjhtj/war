// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { DeathFeedback, killerLabel } from '../../src/ui/DeathFeedback.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('killerLabel', () => {
  it('Boss 用 displayName', () => {
    expect(killerLabel({ _isBoss: true, displayName: '【Boss】战将' })).toBe('【Boss】战将');
  });
  it('精英用 displayName', () => {
    expect(killerLabel({ _isElite: true, displayName: '【精英】精兵' })).toBe('【精英】精兵');
  });
  it('骑兵', () => {
    expect(killerLabel({ _isCavalry: true })).toBe('骑兵');
  });
  it('普通兵种回退武器名', () => {
    expect(killerLabel({ weapon: { name: '枪' } })).toBe('枪');
  });
  it('null/无武器回退未知', () => {
    expect(killerLabel(null)).toBe('未知');
    expect(killerLabel({})).toBe('未知');
  });
});

describe('DeathFeedback - 构造', () => {
  it('创建 overlay 与 arrow 元素并挂载 body，初始 paused=false', () => {
    const df = new DeathFeedback();
    expect(df.paused).toBe(false);
    expect(df.el.parentNode).toBe(document.body);
    expect(df._arrow.parentNode).toBe(document.body);
    expect(df.el.style.display).toBe('none');
  });
});

describe('DeathFeedback - show 文案', () => {
  it('countered=true 显示被克制', () => {
    const df = new DeathFeedback();
    df.show({ label: '重锤', countered: true, angle: 0, camYaw: 0 });
    expect(df._cause.textContent).toContain('重锤');
    expect(df._cause.textContent).toContain('被克制');
  });

  it('countered=false 不显示被克制', () => {
    const df = new DeathFeedback();
    df.show({ label: '弓', countered: false, angle: 0, camYaw: 0 });
    expect(df._cause.textContent).toContain('弓');
    expect(df._cause.textContent).not.toContain('被克制');
  });

  it('标题为"阵亡"，文案含"死于"', () => {
    const df = new DeathFeedback();
    df.show({ label: '刀', countered: false, angle: 0, camYaw: 0 });
    expect(df._title.textContent).toBe('阵亡');
    expect(df._cause.textContent).toContain('死于');
  });
});

describe('DeathFeedback - paused 冻结时序', () => {
  it('show 后 paused=true，0.8s 后 paused=false', () => {
    const df = new DeathFeedback();
    df.show({ label: '刀', countered: false, angle: 0, camYaw: 0 });
    expect(df.paused).toBe(true);
    df.update(0.4);
    expect(df.paused).toBe(true);
    df.update(0.4);
    expect(df.paused).toBe(false);
  });

  it('paused 期间继续 update 不重复触发', () => {
    const df = new DeathFeedback();
    df.show({ label: '刀', countered: false, angle: 0, camYaw: 0 });
    df.update(2);
    expect(df.paused).toBe(false);
    df.update(1);
    expect(df.paused).toBe(false);
  });
});

describe('DeathFeedback - 方向指示', () => {
  it('angle=PI/2 camYaw=0 → rotate(90deg)', () => {
    const df = new DeathFeedback();
    df.show({ label: '刀', countered: false, angle: Math.PI / 2, camYaw: 0 });
    expect(df._ind.style.transform).toContain('90');
  });

  it('arrow 在 ARROW_HOLD 后隐藏', () => {
    const df = new DeathFeedback();
    df.show({ label: '刀', countered: false, angle: 0, camYaw: 0 });
    expect(df._arrow.style.display).toBe('block');
    df.update(1.7);
    expect(df._arrow.style.display).toBe('none');
  });
});

describe('DeathFeedback - hide / destroy', () => {
  it('hide 重置 paused 并隐藏元素', () => {
    const df = new DeathFeedback();
    df.show({ label: '刀', countered: false, angle: 0, camYaw: 0 });
    df.hide();
    expect(df.paused).toBe(false);
    expect(df.el.style.display).toBe('none');
    expect(df._arrow.style.display).toBe('none');
  });

  it('destroy 移除元素', () => {
    const df = new DeathFeedback();
    df.destroy();
    expect(df.el.parentNode).toBe(null);
    expect(df._arrow.parentNode).toBe(null);
  });
});
