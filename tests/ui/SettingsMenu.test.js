// @vitest-environment jsdom
import { SettingsMenu } from '../../src/ui/SettingsMenu.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SettingsMenu', () => {
  let bus, audio, menu;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    bus = { on: vi.fn(), emit: vi.fn() };
    audio = { setVolume: vi.fn(), resume: vi.fn() };
    menu = new SettingsMenu(bus, audio);
  });

  it('音量 4 slider input → audio.setVolume(type,v) + _save 持久化', () => {
    menu._volEl.value = '50';
    menu._volEl.dispatchEvent(new Event('input'));
    expect(audio.setVolume).toHaveBeenCalledWith('master', 0.5);

    menu._sfxEl.value = '60';
    menu._sfxEl.dispatchEvent(new Event('input'));
    expect(audio.setVolume).toHaveBeenCalledWith('sfx', 0.6);

    menu._bgmEl.value = '40';
    menu._bgmEl.dispatchEvent(new Event('input'));
    expect(audio.setVolume).toHaveBeenCalledWith('bgm', 0.4);

    menu._envEl.value = '30';
    menu._envEl.dispatchEvent(new Event('input'));
    expect(audio.setVolume).toHaveBeenCalledWith('env', 0.3);

    const raw = localStorage.getItem('settings');
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw);
    expect(saved.volume).toEqual({ master: 0.5, sfx: 0.6, bgm: 0.4, env: 0.3 });
  });

  it('画质 change → bus.emit settings.quality + _save', () => {
    menu._qual.value = 'mid';
    menu._qual.dispatchEvent(new Event('change'));
    expect(bus.emit).toHaveBeenCalledWith('settings.quality', { quality: 'mid' });
    const saved = JSON.parse(localStorage.getItem('settings'));
    expect(saved.quality).toBe('mid');
  });

  it('难度 change → bus.emit settings.difficulty + _save', () => {
    menu._diff.value = 'hard';
    menu._diff.dispatchEvent(new Event('change'));
    expect(bus.emit).toHaveBeenCalledWith('settings.difficulty', { difficulty: 'hard' });
    const saved = JSON.parse(localStorage.getItem('settings'));
    expect(saved.difficulty).toBe('hard');
  });

  it('灵敏度 input → bus.emit settings.sensitivity + _save', () => {
    menu._sens.value = '150';
    menu._sens.dispatchEvent(new Event('input'));
    expect(bus.emit).toHaveBeenCalledWith('settings.sensitivity', { sensitivity: 1.5 });
    const saved = JSON.parse(localStorage.getItem('settings'));
    expect(saved.sensitivity).toBe(1.5);
  });

  it('_load 启动加载 localStorage → UI 控件值正确', () => {
    localStorage.setItem('settings', JSON.stringify({ quality: 'mid', volume: { master: 0.5, sfx: 0.6, bgm: 0.4, env: 0.3 }, sensitivity: 1.5, difficulty: 'hard' }));
    document.body.innerHTML = '';
    const m = new SettingsMenu(bus, audio);
    expect(m._qual.value).toBe('mid');
    expect(m._diff.value).toBe('hard');
    expect(m._sens.value).toBe('150');
    expect(m._volEl.value).toBe('50');
  });
});
