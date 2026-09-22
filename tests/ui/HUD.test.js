// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HUD } from '../../src/ui/HUD.js';

beforeEach(() => {
  // jsdom canvas getContext 返回 null，mock 一个最小 2D 上下文
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect() {}, beginPath() {}, arc() {}, fill() {}, moveTo() {}, lineTo() {}, closePath() {},
    set fillStyle(v) {}
  }));
  document.body.innerHTML = '';
});

function mkHud() {
  return new HUD({ on: vi.fn(() => () => {}), emit: vi.fn() });
}

describe('HUD', () => {
  it('setHealth 按比例写宽度', () => {
    const hud = mkHud();
    hud.setHealth({ health: { ratio: 0.5 } });
    expect(hud._hp.style.width).toBe('50%');
  });

  it('setHealth 负值夹紧为 0', () => {
    const hud = mkHud();
    hud.setHealth({ health: { ratio: -0.3 } });
    expect(hud._hp.style.width).toBe('0%');
  });

  it('setScore/setRound/setMode 写文案', () => {
    const hud = mkHud();
    hud.setScore(2, 3);
    expect(hud._score.textContent).toBe('蓝方 2  |  3 红方');
    hud.setRound(1, 0, 3);
    expect(hud._round.textContent).toContain('1 - 0');
    hud.setMode('死斗');
    expect(hud._modeName.textContent).toBe('模式：死斗');
    expect(hud._dom.style.display).toBe('none');
    hud.setMode('据点');
    expect(hud._dom.style.display).toBe('block');
  });

  it('setMode 带关卡信息', () => {
    const hud = mkHud();
    hud.setMode('战役', { name: '第一关', index: 0, total: 10 });
    expect(hud._modeName.textContent).toContain('第一关');
    expect(hud._modeName.textContent).toContain('1/10');
  });

  it('flash/clearHint/flashEnd 锁定语义', () => {
    const hud = mkHud();
    hud.flash('提示');
    expect(hud._hint.textContent).toBe('提示');
    hud.clearHint();
    expect(hud._hint.textContent).toBe('');
    hud.flashEnd('结局');
    hud.clearHint();
    expect(hud._hint.textContent).toBe('结局');
  });

  it('setSkillCooldowns 显示剩余秒数', () => {
    const hud = mkHud();
    const ws = { cdRemaining: (i) => (i === 0 ? 2.3 : 0) };
    hud.setSkillCooldowns(ws);
    expect(hud._skillEls[0].cd.style.display).toBe('flex');
    expect(hud._skillEls[0].cd.textContent).toBe('3');
    expect(hud._skillEls[1].cd.style.display).toBe('none');
  });

  it('setHealth 相同值不重复写 DOM（脏检查）', () => {
    const hud = mkHud();
    const c = { health: { ratio: 0.5 } };
    hud.setHealth(c);
    const base = hud._writeCount;
    hud.setHealth(c);
    hud.setHealth(c);
    expect(hud._writeCount).toBe(base);
    hud.setHealth({ health: { ratio: 0.6 } });
    expect(hud._writeCount).toBe(base + 1);
  });
});
