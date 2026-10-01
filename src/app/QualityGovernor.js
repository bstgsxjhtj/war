// 画质档位：low < mid < high。自适应降帧时逐级下调，持续高帧率时逐级回升到用户设定上限。
export const QUALITY_STEPS = ['low', 'mid', 'high'];

// 低端机自适应：连续 slowFrames 帧低于 slowFps 时降一级；连续 recoverFrames 帧高于 recoverFps 时回升一级
// （回升上限为用户/初始设定的 ceiling，绝不越级，避免与用户显式选择冲突）。
export class QualityGovernor {
  constructor({
    quality = 'high',
    slowFps = 30,
    slowFrames = 90,
    recoverFps = 55,
    recoverFrames = 240,
    cooldownFrames = 300,
  } = {}) {
    this.quality = QUALITY_STEPS.includes(quality) ? quality : 'high';
    this._ceiling = this.quality;
    this._slowFps = slowFps;
    this._slowFrames = slowFrames;
    this._recoverFps = recoverFps;
    this._recoverFrames = recoverFrames;
    this._cooldownFrames = cooldownFrames;
    this._slow = 0;
    this._fast = 0;
    this._cooldownLeft = 0;
    this._enabled = true;
    this._direction = null;
  }

  get index() { return QUALITY_STEPS.indexOf(this.quality); }
  get ceilingIndex() { return QUALITY_STEPS.indexOf(this._ceiling); }
  // 最近一次 tick 触发的方向：'down' 降级 / 'up' 回升 / null 未变更
  get direction() { return this._direction; }

  setEnabled(v) { this._enabled = !!v; }

  // 外部（用户设置 / 启动初始化）设定档位：同时抬升 ceiling，作为自动回升上限
  setQuality(q) {
    if (!QUALITY_STEPS.includes(q)) return;
    this.quality = q;
    this._ceiling = q;
    this._slow = 0;
    this._fast = 0;
    this._cooldownLeft = 0;
    this._direction = null;
  }

  // 返回本次建议的新档位；无需变更时返回 null。方向见 direction。
  tick(dt) {
    this._direction = null;
    if (!this._enabled) return null;
    if (this._cooldownLeft > 0) { this._cooldownLeft--; return null; }
    const fps = dt > 0 ? 1 / dt : Infinity;
    const idx = this.index;

    // 降级：持续低帧率
    if (fps < this._slowFps) this._slow++;
    else this._slow = 0;
    if (this._slow >= this._slowFrames && idx > 0) {
      this._slow = 0;
      this._fast = 0;
      this._cooldownLeft = this._cooldownFrames;
      this.quality = QUALITY_STEPS[idx - 1];
      this._direction = 'down';
      return this.quality;
    }

    // 回升：持续高帧率，且不超过用户设定上限
    if (fps >= this._recoverFps && idx < this.ceilingIndex) this._fast++;
    else this._fast = 0;
    if (this._fast >= this._recoverFrames) {
      this._fast = 0;
      this._slow = 0;
      this._cooldownLeft = this._cooldownFrames;
      this.quality = QUALITY_STEPS[idx + 1];
      this._direction = 'up';
      return this.quality;
    }

    return null;
  }
}
