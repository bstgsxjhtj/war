// 分层通知/toast 系统：以优先级队列替代旧的单优先级 HUD.flash()，
// 通过 EventBus 解耦通信。HIGH 顶部居中大字、NORMAL 底部居中常规、LOW 底部居中小字；
// 同优先级超出 maxVisible 时淘汰最旧条目，淡入/保持/淡出三阶段计时由 update(dt) 驱动。
// 不依赖任何 gameplay 模块或外部库，仅消费 EV 事件常量。
import { EV } from '../core/constants/events.js';

const FADE_IN_MS = 150;
const FADE_OUT_MS = 300;
const DEFAULT_DURATION_MS = 3000;

const PRIORITY_KEYS = ['HIGH', 'NORMAL', 'LOW'];

const PRIORITY_STYLES = {
  HIGH: {
    fontSize: '18px',
    color: '#ffd070',
    border: '1px solid #ffd070',
    background: 'rgba(12,12,18,.72)',
    maxWidth: '400px',
  },
  NORMAL: {
    fontSize: '14px',
    color: '#ffffff',
    border: '1px solid #333',
    background: 'rgba(12,12,18,.62)',
    maxWidth: '300px',
  },
  LOW: {
    fontSize: '12px',
    color: '#9aa0a6',
    border: '1px solid #222',
    background: 'rgba(12,12,18,.5)',
    maxWidth: '250px',
  },
};

export class NotificationSystem {
  static PRIORITY = { HIGH: 0, NORMAL: 1, LOW: 2 };

  constructor(bus, opts = {}) {
    this._bus = bus;
    this._maxVisible = opts.maxVisible ?? 5;
    this._position = opts.position ?? 'bottom-center';
    this._interceptFlash = opts.interceptFlash ?? false;
    this._items = [];
    this._handlers = [];
    this._containers = {};
    this._buildContainers();
    this._subscribe(EV.UI_NOTIFY, (p = {}) => {
      this.notify(p.text, p.priority, p.duration);
    });
    if (this._interceptFlash) {
      this._subscribe(EV.HUD_FLASH, (p = {}) => {
        if (p.text) this.notify(p.text, NotificationSystem.PRIORITY.LOW);
      });
    }
  }

  _buildContainers() {
    const make = (key, pos) => {
      const el = document.createElement('div');
      el.className = 'notif-container';
      el.dataset.priority = key;
      Object.assign(el.style, {
        position: 'fixed',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        zIndex: '20',
        pointerEvents: 'none',
        fontFamily: "'Segoe UI', sans-serif",
        ...pos,
      });
      document.body.appendChild(el);
      this._containers[key] = el;
    };
    make('HIGH', { top: '0', left: '50%', transform: 'translateX(-50%)' });
    make('NORMAL', { bottom: '80px', left: '50%', transform: 'translateX(-50%)' });
    make('LOW', { bottom: '20px', left: '50%', transform: 'translateX(-50%)' });
  }

  _subscribe(event, handler) {
    this._bus.on(event, handler);
    this._handlers.push({ event, handler });
  }

  _containerFor(priority) {
    const key = PRIORITY_KEYS[priority] ?? 'NORMAL';
    return this._containers[key] || this._containers.NORMAL;
  }

  _activeOf(priority) {
    return this._items.filter(i => i.priority === priority && (i.phase === 'in' || i.phase === 'hold'));
  }

  _setOpacity(item, value) {
    const v = Math.max(0, Math.min(1, value));
    if (item.opacity !== v) {
      item.opacity = v;
      item.el.style.opacity = v.toFixed(3);
    }
  }

  _removeItem(item) {
    const idx = this._items.indexOf(item);
    if (idx !== -1) this._items.splice(idx, 1);
    if (item.el && item.el.parentNode) item.el.parentNode.removeChild(item.el);
  }

  notify(text, priority, duration) {
    if (text == null) return null;
    const P = NotificationSystem.PRIORITY;
    const pr = priority == null ? P.NORMAL : priority;
    const dur = duration == null || duration <= 0 ? DEFAULT_DURATION_MS : duration;
    while (this._activeOf(pr).length >= this._maxVisible) {
      const oldest = this._activeOf(pr)[0];
      if (!oldest) break;
      this._removeItem(oldest);
    }
    const key = PRIORITY_KEYS[pr] || 'NORMAL';
    const style = PRIORITY_STYLES[key] || PRIORITY_STYLES.NORMAL;
    const el = document.createElement('div');
    el.className = 'notif notif-' + key.toLowerCase();
    Object.assign(el.style, {
      padding: '8px 14px',
      borderRadius: '6px',
      textAlign: 'center',
      textShadow: '0 1px 2px #000',
      opacity: '0',
      ...style,
    });
    el.textContent = String(text);
    this._containerFor(pr).appendChild(el);
    this._items.push({
      el,
      priority: pr,
      duration: dur,
      phase: 'in',
      t: FADE_IN_MS,
      opacity: 0,
    });
    return el;
  }

  update(dt) {
    if (!this._items.length) return;
    const dms = (dt || 0) * 1000;
    for (let i = this._items.length - 1; i >= 0; i--) {
      const item = this._items[i];
      if (!item) continue;
      item.t -= dms;
      if (item.phase === 'in') {
        if (item.t <= 0) {
          item.phase = 'hold';
          item.t = item.duration;
          this._setOpacity(item, 1);
        } else {
          this._setOpacity(item, (FADE_IN_MS - item.t) / FADE_IN_MS);
        }
      } else if (item.phase === 'hold') {
        if (item.t <= 0) {
          item.phase = 'out';
          item.t = FADE_OUT_MS;
        } else {
          this._setOpacity(item, 1);
        }
      } else if (item.phase === 'out') {
        if (item.t <= 0) {
          this._removeItem(item);
        } else {
          this._setOpacity(item, item.t / FADE_OUT_MS);
        }
      }
    }
  }

  destroy() {
    for (const { event, handler } of this._handlers) {
      this._bus.off(event, handler);
    }
    this._handlers = [];
    for (const key in this._containers) {
      const c = this._containers[key];
      if (c && c.parentNode) c.parentNode.removeChild(c);
    }
    this._containers = {};
    this._items = [];
  }
}
