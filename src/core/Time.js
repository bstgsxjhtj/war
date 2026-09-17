// 时间与帧循环：固定逻辑步长 + 渲染插值，切后台保护
export class Time {
  constructor(fixedStep = 1 / 60) {
    this.fixedStep = fixedStep;
    this._last = performance.now();
    this._acc = 0;
    this.elapsed = 0;
    this.frame = 0;
    this.now = 0;
    this._maxSteps = 4;
    this._maxDelta = 0.1;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this._last = performance.now();
        this._acc = 0;
      }
    });
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
      onFixed(this.fixedStep);
      this._acc -= this.fixedStep;
      this.frame++;
      if (++steps > this._maxSteps) { this._acc = 0; break; }
    }
    onRender(this._acc / this.fixedStep);
  }
}
