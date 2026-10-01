// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MainMenuUI } from '../../src/ui/MainMenuUI.js';
import { UIStack, installUIStackEscape } from '../../src/ui/UIStack.js';

function esc() { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true })); }

describe('MainMenuUI 主菜单标题屏', () => {
  let menu;
  const baseOpts = () => ({
    hasSave: () => true,
    getCampaignStage: () => 3,
    getCampaignCleared: () => 4,
    onNewGame: vi.fn(),
    onContinue: vi.fn(),
    onStageSelect: vi.fn(),
    onOpenSettings: vi.fn(),
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    UIStack._stack.length = 0;
    installUIStackEscape();
    menu = new MainMenuUI(baseOpts());
  });
  afterEach(() => {
    menu.dispose();
    UIStack._stack.length = 0;
  });

  it('默认隐藏，show 后显示并压入 UIStack', () => {
    expect(menu.el.style.display).toBe('none');
    menu.show();
    expect(menu.el.style.display).toBe('flex');
    expect(UIStack.top).toBe(menu);
  });

  it('hide 后移除 UIStack', () => {
    menu.show();
    menu.hide();
    expect(menu.el.style.display).toBe('none');
    expect(UIStack.empty).toBe(true);
  });

  it('closable=false：Escape 不关闭面板但仍吞掉事件', () => {
    expect(menu.closable).toBe(false);
    menu.show();
    const spy = vi.fn();
    window.addEventListener('keydown', spy);
    esc();
    expect(menu.el.style.display).toBe('flex');
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener('keydown', spy);
  });

  it('点击"开始新游戏"触发 onNewGame 并隐藏', () => {
    const o = baseOpts();
    const m = new MainMenuUI(o);
    m.show();
    m.el.querySelector('[data-action="new"]').click();
    expect(o.onNewGame).toHaveBeenCalledTimes(1);
    expect(m.el.style.display).toBe('none');
    m.dispose();
  });

  it('点击"选关/地图"触发 onStageSelect', () => {
    const o = baseOpts();
    const m = new MainMenuUI(o);
    m.show();
    m.el.querySelector('[data-action="stageselect"]').click();
    expect(o.onStageSelect).toHaveBeenCalledTimes(1);
    m.dispose();
  });

  it('点击"设置"触发 onOpenSettings 但不隐藏标题屏', () => {
    const o = baseOpts();
    const m = new MainMenuUI(o);
    m.show();
    m.el.querySelector('[data-action="settings"]').click();
    expect(o.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(m.el.style.display).toBe('flex');
    m.dispose();
  });

  it('有存档时"继续战役"可用且显示关卡信息', () => {
    const o = baseOpts();
    o.getCampaignStage = () => 3;
    const m = new MainMenuUI(o);
    m.show();
    const btn = m.el.querySelector('[data-action="continue"]');
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toContain('第4关');
    m.dispose();
  });

  it('无存档时"继续战役"禁用且显示（无存档）', () => {
    const o = baseOpts();
    o.hasSave = () => false;
    const m = new MainMenuUI(o);
    m.show();
    const btn = m.el.querySelector('[data-action="continue"]');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('无存档');
    m.dispose();
  });

  it('禁用状态的"继续战役"点击不触发回调', () => {
    const o = baseOpts();
    o.hasSave = () => false;
    const m = new MainMenuUI(o);
    m.show();
    m.el.querySelector('[data-action="continue"]').click();
    expect(o.onContinue).not.toHaveBeenCalled();
    m.dispose();
  });

  it('已通关全部关卡时显示通关数', () => {
    const o = baseOpts();
    o.getCampaignStage = () => 0;
    o.getCampaignCleared = () => 10;
    const m = new MainMenuUI(o);
    m.show();
    const btn = m.el.querySelector('[data-action="continue"]');
    expect(btn.textContent).toContain('已通关10关');
    m.dispose();
  });

  it('dispose 后元素移除', () => {
    const m = new MainMenuUI(baseOpts());
    m.show();
    m.dispose();
    expect(m.el).toBeNull();
  });
});
