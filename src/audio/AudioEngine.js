// 程序化音效引擎：WebAudio 合成挥砍/命中/脚步/格挡/大招音
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this._vol = 0.7;
    this._init();
  }

  _init() {
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setVolume(v) { this._vol = Math.max(0, Math.min(1, v)); }

  swing() { this._tone(200, 0.09, 'sine', 0.18, 80); }
  hit(heavy = false) { this._noise(heavy ? 0.28 : 0.14, heavy ? 500 : 250, heavy ? 0.4 : 0.3); }
  footstep() { this._noise(0.05, 90, 0.12); }
  block() { this._tone(700, 0.12, 'square', 0.22, 400); }
  ultimate() { this._tone(120, 0.5, 'sawtooth', 0.35, 60); this._noise(0.4, 800, 0.3); }
  dodge() { this._tone(400, 0.1, 'triangle', 0.15, 200); }

  _tone(freq, dur, type, vol, endFreq) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(vol * this._vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  _noise(dur, filterFreq, vol) {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(vol * this._vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }
}
