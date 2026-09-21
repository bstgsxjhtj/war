// @vitest-environment jsdom
import { SettingsMenu } from '../../src/ui/SettingsMenu.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('SettingsMenu', () => {
  let bus, audio, menu;
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    bus = { on: vi.fn(), emit: vi.fn() };
    audio = { setVolume: vi.fn(), resume: vi.fn(), getVolume: vi.fn((t) => ({ master: 0.7, sfx: 0.8, bgm: 0.5, env: 0.4 }[t] ?? 0.7)) };
    menu = new SettingsMenu(bus, audio);
  });

  it('音量 4 slider input → audio.setVolume(type,v)，音量由 audio 管而非 settings 键', () => {
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

    const saved = JSON.parse(localStorage.getItem('settings') || '{}');
    expect(saved.volume).toBeUndefined();
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

  it('_load 启动加载 settings（quality/difficulty/sensitivity），音量从 audio 读取', () => {
    localStorage.setItem('settings', JSON.stringify({ quality: 'mid', sensitivity: 1.5, difficulty: 'hard' }));
    document.body.innerHTML = '';
    const m = new SettingsMenu(bus, audio);
    expect(m._qual.value).toBe('mid');
    expect(m._diff.value).toBe('hard');
    expect(m._sens.value).toBe('150');
    expect(m._volEl.value).toBe('70');
    expect(audio.getVolume).toHaveBeenCalled();
  });
});
