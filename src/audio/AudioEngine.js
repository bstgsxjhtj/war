import { LS } from '../core/constants/storage-keys.js';
export class AudioEngine {
  constructor() { this.ctx = null; this._vol = 0.7; this._sfxVol = 0.8; this._bgmVol = 0.5; this._envVol = 0.4; this._envSource = null; this._bgmNodes = null; this._bgmBeatTimer = null; this._bgmIntensity = 0; this._init(); this._loadVolume(); }
  _init() { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(type, v) { v = Math.max(0, Math.min(1, v)); if (type === 'master') this._vol = v; else if (type === 'sfx') this._sfxVol = v; else if (type === 'bgm') this._bgmVol = v; else if (type === 'env') this._envVol = v; this._saveVolume(); }
  getVolume(type) { if (type === 'master') return this._vol; if (type === 'sfx') return this._sfxVol; if (type === 'bgm') return this._bgmVol; if (type === 'env') return this._envVol; return this._vol; }
  _volOf(type) { const m = this._vol; if (type === 'sfx') return m * this._sfxVol; if (type === 'bgm') return m * this._bgmVol; if (type === 'env') return m * this._envVol; return m; }
  playSound(type, opts = {}) {
    if (type === 'swing') this.swing();
    else if (type === 'hit') this.hit(opts.heavy, opts.combo);
    else if (type === 'block') this.block();
    else if (type === 'perfectblock') this.perfectBlock();
    else if (type === 'dodge') this.dodge();
    else if (type === 'ultimate' || type === 'kill') this.ultimate();
    else if (type === 'click') this.click();
    else if (type === 'achievement') this.achievement();
    else if (type === 'counter') this.counter();
    else if (type === 'environment') this.environment(opts.mode);
    else if (type === 'bgmStart') this.startMusic(opts.intensity || 0);
    else if (type === 'bgmStop') this.stopMusic();
    else if (type === 'bgmIntensity') this.setMusicIntensity(opts.intensity || 0);
    else if (type === 'stinger') this.stinger(opts.stinger);
  }
  swing() { this._tone(200, 0.09, 'sine', this._volOf('sfx') * 0.18, 80); }
  hit(heavy = false, combo = 0) { const f = Math.min(800, 250 + combo * 50); this._noise(heavy ? 0.28 : 0.14, heavy ? 500 : f, this._volOf('sfx') * (heavy ? 0.4 : 0.3)); }
  footstep() { this._noise(0.05, 90, this._volOf('sfx') * 0.12); }
  block() { this._tone(700, 0.12, 'square', this._volOf('sfx') * 0.22, 400); }
  perfectBlock() { this._tone(80, 0.25, 'sine', this._volOf('sfx') * 0.35, 40); this._noise(0.15, 200, this._volOf('sfx') * 0.2); }
  ultimate() { this._tone(120, 0.5, 'sawtooth', this._volOf('sfx') * 0.35, 60); this._noise(0.4, 800, this._volOf('sfx') * 0.3); }
  dodge() { this._tone(400, 0.1, 'triangle', this._volOf('sfx') * 0.15, 200); }
  counter() { this._tone(880, 0.15, 'triangle', this._volOf('sfx') * 0.25, 1320); }
  click() { this._tone(600, 0.05, 'square', this._volOf('sfx') * 0.15, 400); }
  achievement() { const t = this.ctx ? this.ctx.currentTime : 0; [523, 659, 784].forEach((f, i) => { this._toneAt(f, 0.15, 'triangle', this._volOf('sfx') * 0.2, t + i * 0.12); }); }
  environment(mode) { if (this._envSource) { try { this._envSource.stop(); } catch (e) {} this._envSource = null; } if (!this.ctx || mode === 'clear' || mode === 'night') return; const freq = mode === 'rain' ? 800 : (mode === 'snow' ? 400 : 1200); const len = this.ctx.sampleRate * 2; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = this.ctx.createGain(); g.gain.value = this._volOf('env') * 0.15; src.connect(f).connect(g).connect(this.ctx.destination); src.start(); this._envSource = src; }
  startMusic(intensity = 0) {
    this.stopMusic();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const vol = this._volOf('bgm');
    this._bgmNodes = [];
    const drone = this.ctx.createOscillator();
    const droneGain = this.ctx.createGain();
    drone.type = 'sine';
    drone.frequency.setValueAtTime(55, t);
    droneGain.gain.setValueAtTime(0, t);
    droneGain.gain.linearRampToValueAtTime(vol * 0.15, t + 2);
    drone.connect(droneGain).connect(this.ctx.destination);
    drone.start(t);
    this._bgmNodes.push({ osc: drone, gain: droneGain });
    const pad = this.ctx.createOscillator();
    const padGain = this.ctx.createGain();
    pad.type = 'triangle';
    pad.frequency.setValueAtTime(110, t);
    padGain.gain.setValueAtTime(0, t);
    padGain.gain.linearRampToValueAtTime(vol * 0.08, t + 3);
    pad.connect(padGain).connect(this.ctx.destination);
    pad.start(t);
    this._bgmNodes.push({ osc: pad, gain: padGain });
    this._bgmIntensity = intensity;
    this._scheduleBeat();
  }
  _scheduleBeat() {
    if (!this._bgmNodes || this._bgmNodes.length === 0) return;
    const interval = this._bgmIntensity === 0 ? 1.5 : (this._bgmIntensity === 1 ? 0.6 : 0.35);
    this._bgmBeatTimer = setTimeout(() => { this._playBeat(); this._scheduleBeat(); }, interval * 1000);
  }
  _playBeat() {
    if (!this.ctx) return;
    const vol = this._volOf('bgm');
    const freq = this._bgmIntensity === 0 ? 80 : 120;
    this._tone(freq, 0.1, 'sine', vol * 0.1, freq * 0.5);
  }
  setMusicIntensity(level) {
    this._bgmIntensity = level;
    if (this._bgmNodes && this._bgmNodes[1] && this.ctx) {
      const t = this.ctx.currentTime;
      const vol = this._volOf('bgm');
      this._bgmNodes[1].gain.gain.linearRampToValueAtTime(vol * (level === 0 ? 0.08 : 0.15), t + 0.5);
    }
  }
  stopMusic() {
    if (this._bgmBeatTimer) { clearTimeout(this._bgmBeatTimer); this._bgmBeatTimer = null; }
    if (this._bgmNodes) {
      const t = this.ctx ? this.ctx.currentTime : 0;
      for (const n of this._bgmNodes) {
        try {
          n.gain.gain.linearRampToValueAtTime(0, t + 0.5);
          n.osc.stop(t + 0.6);
        } catch (e) {}
      }
      this._bgmNodes = null;
    }
  }
  stinger(type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const vol = this._volOf('bgm');
    if (type === 'victory') {
      [523, 659, 784, 1047].forEach((f, i) => this._toneAt(f, 0.3, 'triangle', vol * 0.2, t + i * 0.15));
    } else if (type === 'defeat') {
      [330, 277, 220].forEach((f, i) => this._toneAt(f, 0.4, 'sine', vol * 0.2, t + i * 0.2));
    }
  }
  _tone(freq, dur, type, vol, endFreq) { this._toneAt(freq, dur, type, vol, this.ctx ? this.ctx.currentTime : 0, endFreq); }
  _toneAt(freq, dur, type, vol, t, endFreq) { if (!this.ctx) return; const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur); }
  _noise(dur, filterFreq, vol) { if (!this.ctx) return; const len = this.ctx.sampleRate * dur; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; const src = this.ctx.createBufferSource(); src.buffer = buf; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq; const g = this.ctx.createGain(); const t = this.ctx.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); src.connect(f).connect(g).connect(this.ctx.destination); src.start(t); }
  _saveVolume() { try { localStorage.setItem(LS.AUDIO_VOLUME, JSON.stringify({ master: this._vol, sfx: this._sfxVol, bgm: this._bgmVol, env: this._envVol })); } catch (e) {} }
  _loadVolume() { try { const d = localStorage.getItem(LS.AUDIO_VOLUME); if (d) { const v = JSON.parse(d); this._vol = v.master ?? 0.7; this._sfxVol = v.sfx ?? 0.8; this._bgmVol = v.bgm ?? 0.5; this._envVol = v.env ?? 0.4; } } catch (e) {} }
}
