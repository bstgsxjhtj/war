export class AudioEngine {
  constructor() { this.ctx = null; this._vol = 0.7; this._sfxVol = 0.8; this._bgmVol = 0.5; this._envVol = 0.4; this._envSource = null; this._init(); this._loadVolume(); }
  _init() { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(type, v) { v = Math.max(0, Math.min(1, v)); if (type === 'master') this._vol = v; else if (type === 'sfx') this._sfxVol = v; else if (type === 'bgm') this._bgmVol = v; else if (type === 'env') this._envVol = v; this._saveVolume(); }
  _volOf(type) { const m = this._vol; if (type === 'sfx') return m * this._sfxVol; if (type === 'bgm') return m * this._bgmVol; if (type === 'env') return m * this._envVol; return m; }
  playSound(type, opts = {}) {
    if (type === 'swing') this.swing();
    else if (type === 'hit') this.hit(opts.heavy, opts.combo);
    else if (type === 'block') this.block();
    else if (type === 'dodge') this.dodge();
    else if (type === 'ultimate' || type === 'kill') this.ultimate();
    else if (type === 'click') this.click();
    else if (type === 'achievement') this.achievement();
    else if (type === 'environment') this.environment(opts.mode);
  }
  swing() { this._tone(200, 0.09, 'sine', this._volOf('sfx') * 0.18, 80); }
  hit(heavy = false, combo = 0) { const f = Math.min(800, 250 + combo * 50); this._noise(heavy ? 0.28 : 0.14, heavy ? 500 : f, this._volOf('sfx') * (heavy ? 0.4 : 0.3)); }
  footstep() { this._noise(0.05, 90, this._volOf('sfx') * 0.12); }
  block() { this._tone(700, 0.12, 'square', this._volOf('sfx') * 0.22, 400); }
  ultimate() { this._tone(120, 0.5, 'sawtooth', this._volOf('sfx') * 0.35, 60); this._noise(0.4, 800, this._volOf('sfx') * 0.3); }
  dodge() { this._tone(400, 0.1, 'triangle', this._volOf('sfx') * 0.15, 200); }
  click() { this._tone(600, 0.05, 'square', this._volOf('sfx') * 0.15, 400); }
  achievement() { const t = this.ctx ? this.ctx.currentTime : 0; [523, 659, 784].forEach((f, i) => { this._toneAt(f, 0.15, 'triangle', this._volOf('sfx') * 0.2, t + i * 0.12); }); }
  environment(mode) { if (this._envSource) { try { this._envSource.stop(); } catch (e) {} this._envSource = null; } if (!this.ctx || mode === 'clear' || mode === 'night') return; const freq = mode === 'rain' ? 800 : (mode === 'snow' ? 400 : 1200); const len = this.ctx.sampleRate * 2; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = this.ctx.createGain(); g.gain.value = this._volOf('env') * 0.15; src.connect(f).connect(g).connect(this.ctx.destination); src.start(); this._envSource = src; }
  _tone(freq, dur, type, vol, endFreq) { this._toneAt(freq, dur, type, vol, this.ctx ? this.ctx.currentTime : 0, endFreq); }
  _toneAt(freq, dur, type, vol, t, endFreq) { if (!this.ctx) return; const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur); }
  _noise(dur, filterFreq, vol) { if (!this.ctx) return; const len = this.ctx.sampleRate * dur; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; const src = this.ctx.createBufferSource(); src.buffer = buf; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq; const g = this.ctx.createGain(); const t = this.ctx.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); src.connect(f).connect(g).connect(this.ctx.destination); src.start(t); }
  _saveVolume() { try { localStorage.setItem('audio_volume', JSON.stringify({ master: this._vol, sfx: this._sfxVol, bgm: this._bgmVol, env: this._envVol })); } catch (e) {} }
  _loadVolume() { try { const d = localStorage.getItem('audio_volume'); if (d) { const v = JSON.parse(d); this._vol = v.master ?? 0.7; this._sfxVol = v.sfx ?? 0.8; this._bgmVol = v.bgm ?? 0.5; this._envVol = v.env ?? 0.4; } } catch (e) {} }
}
