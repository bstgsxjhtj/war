// 时间与帧循环：固定逻辑步长 + 渲染插值，切后台保护
import { EV } from './constants/events.js';

export class Time {
  constructor(fixedStep = 1 / 60, bus = null) {
    this.fixedStep = fixedStep;
    this._bus = bus;
    this._last = performance.now();
    this._acc = 0;
    this.elapsed = 0;
    this.frame = 0;
    this.now = 0;
    this._maxSteps = 4;
    this._maxDelta = 0.1;
    document.addEventListener('visibilitychange', this._onVisibility = () => {
      if (!document.hidden) {
        this._last = performance.now();
        this._acc = 0;
      }
    });
  }

  dispose() {
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  tick(onFixed, onRender) {
    const now = performance.now();
    this.now = now;
    let delta = (now - this._last) / 1000;
    this._last = now;
    if (delta > this._maxDelta) delta = this._maxDelta;
    this._acc += delta;
    this.elapsed += delta;
    let steps = 0;
    while (this._acc >= this.fixedStep) {
      try {
        onFixed(this.fixedStep);
      } catch (err) {
        console.error('[Time.tick] frame error', err);
        if (this._bus) this._bus.emit(EV.ENGINE_ERROR, { err, ts: now, frame: this.frame });
      }
      this._acc -= this.fixedStep;
      this.frame++;
      if (++steps > this._maxSteps) { this._acc = 0; break; }
    }
    onRender(this._acc / this.fixedStep);
  }
}
