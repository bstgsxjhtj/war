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
      const g = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } };
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
    a.playSound('swing'); expect(spies.swing).toHaveBeenCalledWith(undefined);
    a.playSound('hit', { heavy: true, combo: 3 }); expect(spies.hit).toHaveBeenCalledWith(true, 3, undefined);
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

  it('playSound perfectblock 调用 perfectBlock', () => {
    const a = new AudioEngine();
    const spy = vi.spyOn(a, 'perfectBlock');
    a.playSound('perfectblock');
    expect(spy).toHaveBeenCalled();
  });

  it('perfectBlock 播放低频 80Hz 正弦 + 短噪声', () => {
    const a = new AudioEngine();
    const toneSpy = vi.spyOn(a, '_tone');
    const noiseSpy = vi.spyOn(a, '_noise');
    a.perfectBlock();
    expect(toneSpy).toHaveBeenCalledWith(80, expect.any(Number), 'sine', expect.any(Number), 40);
    expect(noiseSpy).toHaveBeenCalled();
  });

  it('playSound crit 调用 crit 方法', () => {
    const a = new AudioEngine();
    const spy = vi.spyOn(a, 'crit');
    a.playSound('crit');
    expect(spy).toHaveBeenCalled();
  });

  it('crit 播放高频锯齿 + 短噪声', () => {
    const a = new AudioEngine();
    const toneSpy = vi.spyOn(a, '_tone');
    const noiseSpy = vi.spyOn(a, '_noise');
    a.crit();
    expect(toneSpy).toHaveBeenCalledWith(1200, expect.any(Number), 'sawtooth', expect.any(Number), 600);
    expect(noiseSpy).toHaveBeenCalled();
  });

  it('playSound comboTier 调用 comboTier', () => {
    const a = new AudioEngine();
    const spy = vi.spyOn(a, 'comboTier');
    a.playSound('comboTier', { tier: 2 });
    expect(spy).toHaveBeenCalledWith(2);
  });

  it('comboTier 双音上扬且音高随 tier 上升', () => {
    const a = new AudioEngine();
    const spy = vi.spyOn(a, '_toneAt');
    a.comboTier(0);
    expect(spy).toHaveBeenCalledTimes(2);
    const f0a = spy.mock.calls[0][0], f0b = spy.mock.calls[1][0];
    expect(f0b).toBeGreaterThan(f0a);
    spy.mockRestore();
    const a2 = new AudioEngine();
    const spy2 = vi.spyOn(a2, '_toneAt');
    a2.comboTier(2);
    expect(spy2.mock.calls[0][0]).toBeGreaterThan(f0a);
  });

  it('playSound bossRoar 调用 bossRoar', () => {
    const a = new AudioEngine();
    const spy = vi.spyOn(a, 'bossRoar');
    a.playSound('bossRoar');
    expect(spy).toHaveBeenCalled();
  });

  it('bossRoar 播放低频锯齿 + 噪声', () => {
    const a = new AudioEngine();
    const toneSpy = vi.spyOn(a, '_tone');
    const noiseSpy = vi.spyOn(a, '_noise');
    a.bossRoar();
    expect(toneSpy).toHaveBeenCalledWith(90, expect.any(Number), 'sawtooth', expect.any(Number), 50);
    expect(noiseSpy).toHaveBeenCalled();
  });

  it('playSound execute 调用 execute', () => {
    const a = new AudioEngine();
    const spy = vi.spyOn(a, 'execute');
    a.playSound('execute');
    expect(spy).toHaveBeenCalled();
  });

  it('execute 播放低频重击 + 高频金属音', () => {
    const a = new AudioEngine();
    const toneSpy = vi.spyOn(a, '_tone');
    const noiseSpy = vi.spyOn(a, '_noise');
    a.execute();
    expect(toneSpy).toHaveBeenCalledWith(60, expect.any(Number), 'sawtooth', expect.any(Number), 30);
    expect(toneSpy).toHaveBeenCalledWith(1568, expect.any(Number), 'triangle', expect.any(Number), 0);
    expect(noiseSpy).toHaveBeenCalled();
  });

  describe('BGM 系统', () => {
    it('startMusic 创建 _bgmNodes 含 2 个振荡器', () => {
      const a = new AudioEngine();
      a.startMusic(0);
      expect(a._bgmNodes).toBeDefined();
      expect(a._bgmNodes.length).toBe(2);
      expect(a._bgmNodes[0].osc.start).toHaveBeenCalled();
      expect(a._bgmNodes[1].osc.start).toHaveBeenCalled();
    });

    it('stopMusic 清除节点并停止振荡器', () => {
      const a = new AudioEngine();
      a.startMusic(0);
      const oscs = a._bgmNodes.map(n => n.osc);
      a.stopMusic();
      expect(a._bgmNodes).toBeNull();
      for (const o of oscs) expect(o.stop).toHaveBeenCalled();
    });

    it('stopMusic 清除节拍定时器', () => {
      const a = new AudioEngine();
      a.startMusic(1);
      expect(a._bgmBeatTimer).not.toBeNull();
      a.stopMusic();
      expect(a._bgmBeatTimer).toBeNull();
    });

    it('stopMusic 无 BGM 时幂等不报错', () => {
      const a = new AudioEngine();
      expect(() => a.stopMusic()).not.toThrow();
    });

    it('setMusicIntensity 调整 pad 增益', () => {
      const a = new AudioEngine();
      a.startMusic(0);
      a.setMusicIntensity(1);
      expect(a._bgmNodes[1].gain.gain.linearRampToValueAtTime).toHaveBeenCalled();
    });

    it('stinger victory 播放 4 个上行音符', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, '_toneAt');
      a.stinger('victory');
      expect(spy).toHaveBeenCalledTimes(4);
      expect(spy.mock.calls[0][0]).toBe(523);
      expect(spy.mock.calls[3][0]).toBe(1047);
    });

    it('stinger defeat 播放 3 个下行音符', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, '_toneAt');
      a.stinger('defeat');
      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy.mock.calls[0][0]).toBe(330);
      expect(spy.mock.calls[2][0]).toBe(220);
    });

    it('playSound bgmStart 调用 startMusic', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, 'startMusic');
      a.playSound('bgmStart', { intensity: 1 });
      expect(spy).toHaveBeenCalledWith(1);
    });

    it('playSound bgmStop 调用 stopMusic', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, 'stopMusic');
      a.playSound('bgmStop');
      expect(spy).toHaveBeenCalled();
    });

    it('playSound stinger 调用 stinger 方法', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, 'stinger');
      a.playSound('stinger', { stinger: 'victory' });
      expect(spy).toHaveBeenCalledWith('victory');
    });
  });

  describe('正反馈音效（P2-3）', () => {
    it('playSound pickup 调用 pickup', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, 'pickup');
      a.playSound('pickup');
      expect(spy).toHaveBeenCalled();
    });

    it('pickup 播放 2 个上行 triangle 音（880→1320）', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, '_toneAt');
      a.pickup();
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[0][0]).toBe(880);
      expect(spy.mock.calls[1][0]).toBe(1320);
      expect(spy.mock.calls[0][2]).toBe('triangle');
    });

    it('playSound levelup 调用 levelup', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, 'levelup');
      a.playSound('levelup');
      expect(spy).toHaveBeenCalled();
    });

    it('levelup 播放 4 音上行琶音（523/659/784/1047）', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, '_toneAt');
      a.levelup();
      expect(spy).toHaveBeenCalledTimes(4);
      expect(spy.mock.calls[0][0]).toBe(523);
      expect(spy.mock.calls[1][0]).toBe(659);
      expect(spy.mock.calls[2][0]).toBe(784);
      expect(spy.mock.calls[3][0]).toBe(1047);
    });

    it('playSound buffSelect 调用 buffSelect', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, 'buffSelect');
      a.playSound('buffSelect');
      expect(spy).toHaveBeenCalled();
    });

    it('buffSelect 播放 sine 660Hz 确认音', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, '_tone');
      a.buffSelect();
      expect(spy).toHaveBeenCalledWith(660, expect.any(Number), 'sine', expect.any(Number), expect.any(Number));
    });

    it('playSound stageStart 调用 stageStart', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, 'stageStart');
      a.playSound('stageStart');
      expect(spy).toHaveBeenCalled();
    });

    it('stageStart 播放 3 音上行 sawtooth（330/440/660）', () => {
      const a = new AudioEngine();
      const spy = vi.spyOn(a, '_toneAt');
      a.stageStart();
      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy.mock.calls[0][0]).toBe(330);
      expect(spy.mock.calls[1][0]).toBe(440);
      expect(spy.mock.calls[2][0]).toBe(660);
      expect(spy.mock.calls[0][2]).toBe('sawtooth');
    });
  });
});
