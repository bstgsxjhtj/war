// 画质档位：low < mid < high。自适应降帧时逐级下调，不自动回升（由用户设置覆盖）。
export const QUALITY_STEPS = ['low', 'mid', 'high'];

// 低端机自适应降帧：连续 slowFrames 帧低于 slowFps 时降一级，冷却期内不连续降级。
export class QualityGovernor {
  constructor({ quality = 'high', slowFps = 30, slowFrames = 90, cooldownFrames = 300 } = {}) {
    this.quality = QUALITY_STEPS.includes(quality) ? quality : 'high';
    this._slowFps = slowFps;
    this._slowFrames = slowFrames;
    this._cooldownFrames = cooldownFrames;
    this._slow = 0;
    this._cooldownLeft = 0;
    this._enabled = true;
  }

  get index() { return QUALITY_STEPS.indexOf(this.quality); }

  setEnabled(v) { this._enabled = !!v; }

  setQuality(q) {
    if (!QUALITY_STEPS.includes(q)) return;
    this.quality = q;
    this._slow = 0;
    this._cooldownLeft = 0;
  }

  // 返回本次建议的新档位；无需变更时返回 null
  tick(dt) {
    if (!this._enabled) return null;
    if (this._cooldownLeft > 0) { this._cooldownLeft--; return null; }
    const fps = dt > 0 ? 1 / dt : Infinity;
    if (fps < this._slowFps) this._slow++; else this._slow = 0;
    if (this._slow >= this._slowFrames && this.index > 0) {
      this._slow = 0;
      this._cooldownLeft = this._cooldownFrames;
      this.quality = QUALITY_STEPS[this.index - 1];
      return this.quality;
    }
    return null;
  }
}