// 独立、解耦的 Tooltip 提示系统：仅依赖 document（DOM），不引入任何 gameplay 代码。
// 提供 register/unregister 绑定元素、show/hide 手动控制，支持 follow/top/bottom 定位与视口裁剪，
// 按内容是否含 HTML 标签自动选择 textContent / innerHTML 渲染。导出类与默认单例实例。

const DEFAULTS = { delay: 300, maxWidth: 280, zIndex: 10000 };
const HTML_TAG_RE = /<[a-z][\s\S]*>/i;

export class Tooltip {
  constructor(opts = {}) {
    this.delay = opts.delay ?? DEFAULTS.delay;
    this.maxWidth = opts.maxWidth ?? DEFAULTS.maxWidth;
    this.zIndex = opts.zIndex ?? DEFAULTS.zIndex;
    this._entries = new Map();
    this._timer = null;
    this._currentEl = null;
    this._lastPos = { x: 0, y: 0 };
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', display: 'none', top: '0px', left: '0px',
      background: '#1a1a2e', color: '#fff', fontSize: '12px', padding: '8px',
      borderRadius: '6px', maxWidth: this.maxWidth + 'px', lineHeight: '1.4',
      boxShadow: '0 4px 12px rgba(0,0,0,.5)', zIndex: String(this.zIndex),
      pointerEvents: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      fontFamily: 'Segoe UI, sans-serif',
    });
    document.body.appendChild(this.el);
  }

  register(el, getContent, opts = {}) {
    this.unregister(el);
    const entry = { getContent, position: opts.position || 'follow', el };
    entry.onEnter = (e) => this._onEnter(e, el, entry);
    entry.onMove = (e) => this._onMove(e, entry);
    entry.onLeave = () => this._onLeave(el);
    el.addEventListener('mouseenter', entry.onEnter);
    el.addEventListener('mousemove', entry.onMove);
    el.addEventListener('mouseleave', entry.onLeave);
    this._entries.set(el, entry);
  }

  unregister(el) {
    const entry = this._entries.get(el);
    if (!entry) return;
    el.removeEventListener('mouseenter', entry.onEnter);
    el.removeEventListener('mousemove', entry.onMove);
    el.removeEventListener('mouseleave', entry.onLeave);
    this._entries.delete(el);
    if (this._currentEl === el) {
      clearTimeout(this._timer);
      this._timer = null;
      this.hide();
      this._currentEl = null;
    }
  }

  show(content, x, y) {
    this._render(content);
    this.el.style.display = 'block';
    if (Number.isFinite(x) && Number.isFinite(y)) this._place({ position: 'follow' }, x, y);
  }

  hide() {
    clearTimeout(this._timer);
    this._timer = null;
    this.el.style.display = 'none';
  }

  _resolve(getContent) {
    const c = typeof getContent === 'function' ? getContent() : getContent;
    return c == null ? '' : String(c);
  }

  _render(content) {
    const text = content == null ? '' : String(content);
    if (HTML_TAG_RE.test(text)) this.el.innerHTML = text;
    else this.el.textContent = text;
  }

  _onEnter(e, el, entry) {
    this._currentEl = el;
    this._lastPos = { x: e.clientX, y: e.clientY };
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      if (this._currentEl !== el) return;
      this.show(this._resolve(entry.getContent), this._lastPos.x, this._lastPos.y);
    }, this.delay);
  }

  _onMove(e, entry) {
    this._lastPos = { x: e.clientX, y: e.clientY };
    if (this.el.style.display !== 'none') this._place(entry, e.clientX, e.clientY);
  }

  _onLeave(el) {
    clearTimeout(this._timer);
    this._timer = null;
    if (this._currentEl === el) {
      this.hide();
      this._currentEl = null;
    }
  }

  _place(entry, x, y) {
    const rect = this.el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    let left, top;
    if (entry.position === 'top' || entry.position === 'bottom') {
      const er = entry.el.getBoundingClientRect();
      left = er.left + (er.width - rect.width) / 2;
      top = entry.position === 'top' ? er.top - rect.height - 8 : er.bottom + 8;
    } else {
      left = x + 16;
      top = y + 16;
    }
    if (left + rect.width > vw - 4) left = vw - rect.width - 4;
    if (top + rect.height > vh - 4) top = vh - rect.height - 4;
    if (left < 4) left = 4;
    if (top < 4) top = 4;
    this.el.style.left = Math.round(left) + 'px';
    this.el.style.top = Math.round(top) + 'px';
  }
}

export const tooltip = new Tooltip();
