// @vitest-environment jsdom
import { SettingsMenu } from '../../src/ui/SettingsMenu.js';
import { KeyBindings, BINDING_ORDER } from '../../src/core/input/KeyBindings.js';
import { UIStack } from '../../src/ui/UIStack.js';
import { EV } from '../../src/core/constants/events.js';
import { LS } from '../../src/core/constants/storage-keys.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SettingsMenu 键位重绑', () => {
  let bus, audio, kb, menu;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    UIStack._stack.length = 0;
    bus = { on: vi.fn(), emit: vi.fn() };
    audio = { setVolume: vi.fn(), resume: vi.fn(), getVolume: vi.fn(() => 0.7) };
    kb = new KeyBindings();
    menu = new SettingsMenu(bus, audio, kb);
  });

  it('渲染键位区域，包含全部 21 个可重绑动作按钮', () => {
    const buttons = menu.el.querySelectorAll('[data-bind]');
    expect(buttons.length).toBe(BINDING_ORDER.length);
    expect(BINDING_ORDER.length).toBe(21);
  });

  it('每个按钮显示当前绑定的键码（友好标签）', () => {
    const btn = menu.el.querySelector('[data-bind="dodge"]');
    expect(btn.textContent).toContain('Q');
  });

  it('点击按钮进入监听模式，按钮文案变为"按下任意键"', () => {
    const btn = menu.el.querySelector('[data-bind="dodge"]');
    btn.click();
    expect(btn.textContent).toContain('按下任意键');
    expect(menu._listeningAction).toBe('dodge');
  });

  it('监听模式下 keydown 设置绑定并退出监听模式', () => {
    const btn = menu.el.querySelector('[data-bind="dodge"]');
    btn.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    expect(kb.get('dodge')).toBe('KeyR');
    expect(menu._listeningAction).toBeNull();
    expect(btn.textContent).toContain('R');
  });

  it('重绑后 emit settings.keybind 事件通知 Player', () => {
    const btn = menu.el.querySelector('[data-bind="jump"]');
    btn.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }));
    expect(bus.emit).toHaveBeenCalledWith(EV.SETTINGS_KEYBIND, expect.anything());
  });

  it('重绑后持久化到 localStorage keybindings 键', () => {
    const btn = menu.el.querySelector('[data-bind="dodge"]');
    btn.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    const saved = JSON.parse(localStorage.getItem(LS.KEYBINDINGS));
    expect(saved.dodge).toBe('KeyR');
  });

  it('重置按钮恢复全部默认绑定', () => {
    kb.set('dodge', 'KeyR');
    kb.set('jump', 'KeyC');
    menu.el.querySelector('#set-reset-keys').click();
    expect(kb.get('dodge')).toBe('KeyQ');
    expect(kb.get('jump')).toBe('Space');
  });

  it('监听模式下 Escape 取消重绑不修改绑定', () => {
    const btn = menu.el.querySelector('[data-bind="dodge"]');
    btn.click();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
    expect(menu._listeningAction).toBeNull();
    expect(kb.get('dodge')).toBe('KeyQ');
  });

  it('无 kb 参数时不渲染键位区域（向后兼容）', () => {
    document.body.innerHTML = '';
    const m = new SettingsMenu(bus, audio);
    expect(m.el.querySelectorAll('[data-bind]').length).toBe(0);
  });
});
