// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameMenu } from '../../src/ui/GameMenu.js';
import { UIStack } from '../../src/ui/UIStack.js';
import { MODE_ORDER } from '../../src/gameplay/gameModes.js';

describe('GameMenu 统一游戏菜单', () => {
  let menu;
  const opts = () => ({
    getModeName: () => '死斗',
    onSelectMode: vi.fn(),
    onSelectClass: vi.fn(),
    onOpenSettings: vi.fn(),
    onRestart: vi.fn(),
    onResume: vi.fn(),
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    UIStack._stack.length = 0;
    menu = new GameMenu(opts());
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

  it('hide 后移除 UIStack 且标记未打开', () => {
    menu.show();
    menu.hide();
    expect(menu.el.style.display).toBe('none');
    expect(menu.open).toBe(false);
    expect(UIStack.empty).toBe(true);
  });

  it('列出全部玩法模式按钮', () => {
    const btns = menu.el.querySelectorAll('[data-mode]');
    expect(btns.length).toBe(MODE_ORDER.length);
    for (const name of MODE_ORDER) expect(menu.el.querySelector(`[data-mode="${name}"]`)).toBeTruthy();
  });

  it('点击模式按钮回调对应模式名', () => {
    const o = opts();
    const m = new GameMenu(o);
    m.el.querySelector('[data-mode="战场"]').click();
    expect(o.onSelectMode).toHaveBeenCalledWith('战场');
    m.dispose();
  });

  it('refresh 高亮当前模式', () => {
    const o = opts();
    o.getModeName = () => '据点';
    const m = new GameMenu(o);
    m.show();
    const cur = m.el.querySelector('[data-mode="据点"]');
    const other = m.el.querySelector('[data-mode="死斗"]');
    expect(cur.style.borderColor).toBeTruthy();
    expect(cur.style.borderColor).not.toBe(other.style.borderColor);
    m.dispose();
  });

  it('四个操作按钮分别回调职业/设置/重开/返回', () => {
    const o = opts();
    const m = new GameMenu(o);
    m.el.querySelector('[data-action="class"]').click();
    m.el.querySelector('[data-action="settings"]').click();
    m.el.querySelector('[data-action="restart"]').click();
    m.el.querySelector('[data-action="resume"]').click();
    expect(o.onSelectClass).toHaveBeenCalled();
    expect(o.onOpenSettings).toHaveBeenCalled();
    expect(o.onRestart).toHaveBeenCalled();
    expect(o.onResume).toHaveBeenCalled();
    m.dispose();
  });

  it('点击遮罩空白处返回游戏', () => {
    const o = opts();
    const m = new GameMenu(o);
    m.show();
    m.el.click();
    expect(o.onResume).toHaveBeenCalled();
    m.dispose();
  });

  it('toggle 在显示/隐藏间切换', () => {
    menu.toggle();
    expect(menu.open).toBe(true);
    menu.toggle();
    expect(menu.open).toBe(false);
  });
});