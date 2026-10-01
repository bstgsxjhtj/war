// 独立、解耦的无障碍选项管理器（src/auxiliary/ 解耦模块）：仅依赖 document（DOM）与 localStorage，
// 不引入任何 gameplay 代码与外部库。管理 UI 缩放（zoom）、字体大小、高对比度、按键长按切换、字幕开关
// 等无障碍设置，统一应用到 document.body；设置以 JSON 持久化到 localStorage['accessibility']，构造时加载。
// 可选接收 bus（EventBus）：当 highContrast 等视觉相关设置变更时，发射 'settings.colorblind' 等事件
// 供相机/渲染/输入等系统订阅。CSS 通过注入 <style> 提供 .high-contrast 规则，destroy() 可彻底回滚。

const STORAGE_KEY = 'accessibility';

const DEFAULTS = {
  uiScale: 1.0,
  fontSize: 'medium',
  highContrast: false,
  holdToToggle: false,
  subtitleEnabled: true
};

const FONT_SIZE_PX = { small: '13px', medium: '15px', large: '18px' };

const UI_SCALE_MIN = 0.8;
const UI_SCALE_MAX = 1.3;
const UI_SCALE_STEP = 0.1;

// 与 EV.SETTINGS_COLORBLIND 等事件名保持一致（自包含，不导入 events.js）
const SETTING_BUS_EVENTS = {
  highContrast: 'settings.colorblind'
};

const HIGH_CONTRAST_CSS = [
  'body.high-contrast { filter: contrast(1.35) saturate(1.1); background:#000 !important; color:#fff !important; }',
  'body.high-contrast, body.high-contrast * { border-color:#fff !important; outline-color:#ff0 !important; }',
  'body.high-contrast button, body.high-contrast .panel, body.high-contrast [role="button"] { border-width:2px !important; }',
  'body.high-contrast a, body.high-contrast .link { text-decoration:underline !important; }'
].join('\n');

export class Accessibility {
  constructor(opts = {}) {
    this.bus = opts.bus || null;
    this._styleEl = null;
    const loaded = this._load();
    this.settings = this._normalize({ ...DEFAULTS, ...(opts.settings || {}), ...loaded });
    this._injectStyle();
    this.apply();
  }

  apply(settings) {
    if (settings && typeof settings === 'object') {
      this.settings = this._normalize({ ...this.settings, ...settings });
      this._save();
    }
    this._applyDom();
  }

  set(key, value) {
    if (!(key in DEFAULTS)) return;
    this.settings[key] = value;
    this.settings = this._normalize(this.settings);
    this._save();
    this._applyDom();
    this._emit(key);
  }

  get(key) {
    return this.settings[key];
  }

  getAll() {
    return { ...this.settings };
  }

  reset() {
    this.settings = { ...DEFAULTS };
    this._save();
    this._applyDom();
  }

  destroy() {
    if (this._styleEl && this._styleEl.parentNode) {
      this._styleEl.parentNode.removeChild(this._styleEl);
    }
    this._styleEl = null;
    const body = document.body;
    if (body) {
      body.classList.remove('high-contrast');
      body.style.zoom = '';
      body.style.transformOrigin = '';
      body.style.fontSize = '';
    }
    this.bus = null;
  }

  _applyDom() {
    const body = document.body;
    if (!body) return;
    const s = this.settings;
    const scale = this._clampUiScale(s.uiScale);
    body.style.zoom = String(scale);
    body.style.transformOrigin = 'top left';
    body.style.fontSize = FONT_SIZE_PX[s.fontSize] || FONT_SIZE_PX[DEFAULTS.fontSize];
    body.classList.toggle('high-contrast', !!s.highContrast);
  }

  _clampUiScale(v) {
    let n = Number(v);
    if (!Number.isFinite(n)) n = DEFAULTS.uiScale;
    n = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, n));
    n = Math.round(n / UI_SCALE_STEP) * UI_SCALE_STEP;
    return Math.round(n * 10) / 10;
  }

  _normalize(s) {
    const out = { ...s };
    out.uiScale = this._clampUiScale(out.uiScale);
    if (!(out.fontSize in FONT_SIZE_PX)) out.fontSize = DEFAULTS.fontSize;
    out.highContrast = !!out.highContrast;
    out.holdToToggle = !!out.holdToToggle;
    out.subtitleEnabled = !!out.subtitleEnabled;
    return out;
  }

  _injectStyle() {
    const el = document.createElement('style');
    el.id = 'accessibility-style';
    el.textContent = HIGH_CONTRAST_CSS;
    (document.head || document.documentElement).appendChild(el);
    this._styleEl = el;
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === 'object') return d;
      }
    } catch (e) { /* ignore */ }
    return {};
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) { /* ignore */ }
  }

  _emit(key) {
    if (!this.bus) return;
    const ev = SETTING_BUS_EVENTS[key];
    if (!ev || typeof this.bus.emit !== 'function') return;
    this.bus.emit(ev, { value: this.settings[key], settings: this.getAll() });
  }
}

export default Accessibility;
