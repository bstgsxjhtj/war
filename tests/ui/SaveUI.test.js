// @vitest-environment jsdom
import { SaveUI } from '../../src/ui/SaveUI.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SaveUI', () => {
  let bus, saveManager, captureFn, resetFn, ui;
  beforeEach(() => {
    document.body.innerHTML = '';
    bus = { on: vi.fn(), emit: vi.fn() };
    saveManager = { load: vi.fn(() => ({ savedAt: 1700000000000, mode: '战役', stage: 3, score: 1200, skillPoints: 5, playTime: 3600 })), save: vi.fn((c) => ({ ...c, savedAt: Date.now() })), reset: vi.fn() };
    captureFn = vi.fn(() => ({ mode: '战役', stage: 3 }));
    resetFn = vi.fn();
    ui = new SaveUI(bus, saveManager, captureFn, resetFn);
  });

  it('构造创建 #save-panel 且默认隐藏', () => {
    const panel = document.getElementById('save-panel');
    expect(panel).toBeTruthy();
    expect(panel.style.display).toBe('none');
  });

  it('H 键 toggle 显示面板并渲染概览（含 #save-now/#save-reset/#save-info）', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', bubbles: true }));
    expect(document.getElementById('save-panel').style.display).toBe('block');
    expect(document.getElementById('save-now')).toBeTruthy();
    expect(document.getElementById('save-reset')).toBeTruthy();
    expect(document.getElementById('save-info').textContent).toContain('积分');
  });

  it('[立即保存] 调用 saveManager.save(captureFn())', () => {
    ui.toggle();
    document.getElementById('save-now').click();
    expect(captureFn).toHaveBeenCalled();
    expect(saveManager.save).toHaveBeenCalled();
  });

  it('[重置进度] confirm 为 true 时调用 resetFn', () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    ui.toggle();
    document.getElementById('save-reset').click();
    expect(resetFn).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
