import { AudioEngine } from '../../src/audio/AudioEngine.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function makeCtx() {
  const mkChain = () => {
    const node = {};
    node.connect = vi.fn(() => node);
    return node;
  };
  return {
    currentTime: 0,
    state: 'suspended',
    resume: vi.fn(),
    destination: {},
    sampleRate: 44100,
    createOscillator: vi.fn(() => {
      const o = {
        type: '',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        start: vi.fn(),
        stop: vi.fn(),
      };
      o.connect = vi.fn(() => o);
      return o;
    }),
    createGain: vi.fn(() => {
      const g = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
      g.connect = vi.fn(() => g);
      return g;
    }),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(100) })),
    createBufferSource: vi.fn(() => {
      const s = { buffer: null, loop: false, start: vi.fn(), stop: vi.fn() };
      s.connect = vi.fn(() => s);
      return s;
    }),
    createBiquadFilter: vi.fn(() => {
      const f = { type: '', frequency: { value: 0 } };
      f.connect = vi.fn(() => f);
      return f;
    }),
  };
}

describe('AudioEngine', () => {
  let _origWindow;
  beforeEach(() => {
    _origWindow = global.window;
    global.window = { AudioContext: vi.fn(() => makeCtx()) };
  });
  afterEach(() => {
    global.window = _origWindow;
  });

  it('playSound 各 type 调用对应方法', () => {
    const a = new AudioEngine();
    const spies = {
      swing: vi.spyOn(a, 'swing'),
      hit: vi.spyOn(a, 'hit'),
      block: vi.spyOn(a, 'block'),
      dodge: vi.spyOn(a, 'dodge'),
      ultimate: vi.spyOn(a, 'ultimate'),
      click: vi.spyOn(a, 'click'),
      achievement: vi.spyOn(a, 'achievement'),
    };
    a.playSound('swing'); expect(spies.swing).toHaveBeenCalled();
    a.playSound('hit', { heavy: true, combo: 3 }); expect(spies.hit).toHaveBeenCalledWith(true, 3);
    a.playSound('block'); expect(spies.block).toHaveBeenCalled();
    a.playSound('dodge'); expect(spies.dodge).toHaveBeenCalled();
    a.playSound('ultimate'); expect(spies.ultimate).toHaveBeenCalledTimes(1);
    a.playSound('click'); expect(spies.click).toHaveBeenCalled();
    a.playSound('achievement'); expect(spies.achievement).toHaveBeenCalled();
    a.playSound('kill'); expect(spies.ultimate).toHaveBeenCalledTimes(2);
  });

  it('setVolume 分类型设置 + 持久化', () => {
    const a = new AudioEngine();
    a.setVolume('master', 0.5); expect(a._vol).toBe(0.5);
    a.setVolume('sfx', 0.3); expect(a._sfxVol).toBe(0.3);
    a.setVolume('bgm', 0.6); expect(a._bgmVol).toBe(0.6);
    a.setVolume('env', 0.2); expect(a._envVol).toBe(0.2);
    const stored = JSON.parse(localStorage.getItem('audio_volume'));
    expect(stored.master).toBe(0.5);
    expect(stored.sfx).toBe(0.3);
    expect(stored.bgm).toBe(0.6);
    expect(stored.env).toBe(0.2);
  });

  it('resume 在 suspended 时调用 ctx.resume', () => {
    const a = new AudioEngine();
    expect(a.ctx.state).toBe('suspended');
    a.resume();
    expect(a.ctx.resume).toHaveBeenCalled();
  });

  it('environment rain 创建 _envSource / clear 停止并置 null', () => {
    const a = new AudioEngine();
    a.environment('rain');
    expect(a._envSource).not.toBeNull();
    const src = a._envSource;
    expect(src.start).toHaveBeenCalled();
    a.environment('clear');
    expect(src.stop).toHaveBeenCalled();
    expect(a._envSource).toBeNull();
  });

  it('achievement 3 音上扬 523/659/784', () => {
    const a = new AudioEngine();
    const spy = vi.spyOn(a, '_toneAt');
    a.achievement();
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls[0][0]).toBe(523);
    expect(spy.mock.calls[1][0]).toBe(659);
    expect(spy.mock.calls[2][0]).toBe(784);
  });

  it('_volOf 分类型 master*sfx', () => {
    const a = new AudioEngine();
    a._vol = 0.5; a._sfxVol = 0.8; a._bgmVol = 0.5; a._envVol = 0.4;
    expect(a._volOf('master')).toBe(0.5);
    expect(a._volOf('sfx')).toBe(0.4);
    expect(a._volOf('bgm')).toBe(0.25);
    expect(a._volOf('env')).toBe(0.2);
  });
});
