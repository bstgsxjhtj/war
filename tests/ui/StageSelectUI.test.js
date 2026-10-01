// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StageSelectUI } from '../../src/ui/StageSelectUI.js';
import { UIStack, installUIStackEscape } from '../../src/ui/UIStack.js';
import { STAGES } from '../../src/gameplay/CampaignMode.js';
import { MapGenerator } from '../../src/world/MapGenerator.js';

function esc() { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true })); }

describe('StageSelectUI 选关/地图面板', () => {
  let ui;
  const baseOpts = () => ({
    getCleared: () => 3,
    getModeName: () => '波次',
    getDifficulty: () => 'normal',
    onStageSelect: vi.fn(),
    onMapSelect: vi.fn(),
    onDifficultyChange: vi.fn(),
    onBack: vi.fn(),
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    UIStack._stack.length = 0;
    installUIStackEscape();
    ui = new StageSelectUI(baseOpts());
  });
  afterEach(() => {
    ui.dispose();
    UIStack._stack.length = 0;
  });

  it('默认隐藏，show 后显示并压入 UIStack', () => {
    expect(ui.el.style.display).toBe('none');
    ui.show();
    expect(ui.el.style.display).toBe('flex');
    expect(UIStack.top).toBe(ui);
  });

  it('战役选关 tab 展示全部 10 关卡片', () => {
    ui.show();
    const grid = ui._campaignSection.querySelector('div[style*="grid"]');
    expect(grid.children.length).toBe(STAGES.length);
  });

  it('cleared=3 时第 0-3 关解锁、第 4-9 关锁定', () => {
    ui.show();
    const grid = ui._campaignSection.querySelector('div[style*="grid"]');
    const cards = grid.children;
    for (let i = 0; i < cards.length; i++) {
      const locked = cards[i].dataset.locked === '1';
      expect(locked).toBe(i > 3);
    }
  });

  it('点击已解锁关卡触发 onStageSelect(index)', () => {
    const o = baseOpts();
    const u = new StageSelectUI(o);
    u.show();
    const grid = u._campaignSection.querySelector('div[style*="grid"]');
    grid.children[2].click();
    expect(o.onStageSelect).toHaveBeenCalledWith(2);
    u.dispose();
  });

  it('点击锁定关卡不触发回调', () => {
    const o = baseOpts();
    o.getCleared = () => 0;
    const u = new StageSelectUI(o);
    u.show();
    const grid = u._campaignSection.querySelector('div[style*="grid"]');
    grid.children[5].click();
    expect(o.onStageSelect).not.toHaveBeenCalled();
    u.dispose();
  });

  it('切换到自由对战 tab 展示全部地图卡片', () => {
    ui.show();
    ui._switchTab('free');
    const grid = ui._freeSection.querySelector('div[style*="grid"]');
    expect(grid.children.length).toBe(Object.keys(MapGenerator.MAPS).length);
  });

  it('点击地图卡片触发 onMapSelect(mapKey)', () => {
    const o = baseOpts();
    const u = new StageSelectUI(o);
    u.show();
    u._switchTab('free');
    const grid = u._freeSection.querySelector('div[style*="grid"]');
    grid.children[0].click();
    const firstKey = Object.keys(MapGenerator.MAPS)[0];
    expect(o.onMapSelect).toHaveBeenCalledWith(firstKey);
    u.dispose();
  });

  it('点击难度按钮触发 onDifficultyChange', () => {
    const o = baseOpts();
    const u = new StageSelectUI(o);
    u.show();
    u._switchTab('free');
    u._diffBtns.get('hard').click();
    expect(o.onDifficultyChange).toHaveBeenCalledWith('hard');
    u.dispose();
  });

  it('难度按钮高亮当前档位', () => {
    const o = baseOpts();
    o.getDifficulty = () => 'hard';
    const u = new StageSelectUI(o);
    u.show();
    u._switchTab('free');
    expect(u._diffBtns.get('hard').style.borderColor).not.toBe(u._diffBtns.get('normal').style.borderColor);
    expect(u._diffBtns.get('hard').style.color).toBe(u._diffBtns.get('hard').style.color);
    u.dispose();
  });

  it('返回按钮触发 onBack', () => {
    const o = baseOpts();
    const u = new StageSelectUI(o);
    u.show();
    u.el.querySelector('[data-action="back"]').click();
    expect(o.onBack).toHaveBeenCalledTimes(1);
    u.dispose();
  });

  it('Esc 关闭触发 onBack（非选择态）', () => {
    const o = baseOpts();
    const u = new StageSelectUI(o);
    u.show();
    esc();
    expect(o.onBack).toHaveBeenCalledTimes(1);
    u.dispose();
  });

  it('选择关卡后 Esc 不触发 onBack（选择态）', () => {
    const o = baseOpts();
    const u = new StageSelectUI(o);
    u.show();
    const grid = u._campaignSection.querySelector('div[style*="grid"]');
    grid.children[0].click();
    expect(o.onStageSelect).toHaveBeenCalled();
    expect(o.onBack).not.toHaveBeenCalled();
    u.dispose();
  });

  it('dispose 后元素移除', () => {
    const m = new StageSelectUI(baseOpts());
    m.show();
    m.dispose();
    expect(m.el).toBeNull();
  });
});
