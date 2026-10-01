// 击杀信息流 / 战斗事件日志：独立于 gameplay，仅通过 EventBus 通信。
// 固定右下角、小地图区域之上，紧凑展示最近 N 条战斗事件；F5 切换全量历史滚动面板（暂停淡出）。
import { EV } from '../core/constants/events.js';

const COLOR = {
  player: '#ffd54a',
  enemy: '#ff5252',
  achievement: '#4ade80',
  boss: '#ff9d3a'
};

const FMT = {
  [EV.COMBAT_KILL]: () => '🔵 击杀 🔴',
  [EV.COMBAT_BACKSTAB]: () => '🗡️ 背刺击杀',
  [EV.COMBAT_PERFECTBLOCK]: () => '🛡️ 完美格挡',
  [EV.COMBAT_DODGE]: () => '💨 完美闪避',
  [EV.COMBAT_EXECUTE]: () => '☠️ 处决',
  [EV.COMBAT_CAVALRYKILL]: () => '🐎 骑兵击杀',
  [EV.ACHIEVEMENT_UNLOCK]: (p) => '🏆 成就解锁: ' + ((p && p.name) ? p.name : '未知'),
  [EV.BOSS_SUMMON]: () => '⚠️ Boss 出现'
};

const FADE_MS = 600;

export class KillFeed {
  constructor(bus, opts = {}) {
    this.bus = bus;
    this.maxEntries = opts.maxEntries ?? 8;
    this.entryTTL = opts.entryTTL ?? 8000;
    this.compact = opts.compact ?? true;
    this.maxHistory = 100;
    this._entries = [];
    this._history = [];
    this._fullPanel = false;
    this._panel = null;
    this._panelList = null;

    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', right: '12px', bottom: '12px', maxWidth: '320px',
      padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '2px',
      fontFamily: 'Consolas, monospace', fontSize: '12px', color: '#e8eef7',
      background: 'rgba(10,14,20,.55)', border: '1px solid rgba(180,160,80,.35)',
      borderRadius: '6px', pointerEvents: 'none', zIndex: 18,
      ...(this.compact ? { width: 'auto', maxHeight: (this.maxEntries * 18 + 12) + 'px', overflow: 'hidden' } : {})
    });
    document.body.appendChild(this.el);

    this._subs = [];
    this._bind(EV.COMBAT_KILL);
    this._bind(EV.COMBAT_BACKSTAB);
    this._bind(EV.COMBAT_PERFECTBLOCK);
    this._bind(EV.COMBAT_DODGE);
    this._bind(EV.COMBAT_EXECUTE);
    this._bind(EV.COMBAT_CAVALRYKILL);
    this._bind(EV.ACHIEVEMENT_UNLOCK);
    this._bind(EV.BOSS_SUMMON);

    this._onKey = (e) => {
      if (e.key === 'F5') { e.preventDefault(); this.toggleFullPanel(); }
    };
    window.addEventListener('keydown', this._onKey);
  }

  _bind(event) {
    const h = (payload) => this._onEvent(event, payload);
    this.bus.on(event, h);
    this._subs.push({ event, handler: h });
  }

  _onEvent(event, payload) {
    const fmt = FMT[event];
    if (!fmt) return;
    this._pushEntry(fmt(payload), this._colorFor(event, payload));
  }

  _colorFor(event, payload) {
    if (event === EV.ACHIEVEMENT_UNLOCK) return COLOR.achievement;
    if (event === EV.BOSS_SUMMON) return COLOR.boss;
    if (event === EV.COMBAT_KILL) {
      // payload.team 为牺牲者阵营：0=玩家方(蓝)，1=敌方(红)
      // 牺牲者敌方(1)→玩家击杀→金色；牺牲者玩家方(0)→敌方击杀→红色
      const t = payload && payload.team != null ? payload.team : (payload && payload.victim ? payload.victim.team : 1);
      return t === 0 ? COLOR.enemy : COLOR.player;
    }
    return COLOR.player;
  }

  _pushEntry(text, color) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      opacity: '1', transition: 'opacity .2s linear', textShadow: '0 1px 2px #000'
    });
    row.textContent = text;
    this.el.appendChild(row);
    this._entries.push({ el: row, ttl: this.entryTTL, color, text });
    this._history.push({ text, color, ts: performance.now() });
    if (this._history.length > this.maxHistory) this._history.shift();
    while (this._entries.length > this.maxEntries) {
      const old = this._entries.shift();
      if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
    }
  }

  update(dt) {
    if (this._fullPanel) return;
    const dms = dt * 1000;
    for (let i = this._entries.length - 1; i >= 0; i--) {
      const e = this._entries[i];
      e.ttl -= dms;
      if (e.ttl <= FADE_MS) {
        e.el.style.opacity = Math.max(0, e.ttl / FADE_MS).toFixed(2);
      }
      if (e.ttl <= 0) {
        if (e.el.parentNode) e.el.parentNode.removeChild(e.el);
        this._entries.splice(i, 1);
      }
    }
  }

  toggleFullPanel() {
    this._fullPanel = !this._fullPanel;
    if (this._fullPanel) this._showFullPanel();
    else this._hideFullPanel();
  }

  _showFullPanel() {
    this.el.style.display = 'none';
    if (!this._panel) {
      this._panel = document.createElement('div');
      Object.assign(this._panel.style, {
        position: 'fixed', right: '12px', bottom: '12px', width: '380px',
        maxHeight: '60vh', overflowY: 'auto', padding: '8px 10px',
        fontFamily: 'Consolas, monospace', fontSize: '12px', color: '#e8eef7',
        background: 'rgba(10,14,20,.85)', border: '1px solid rgba(180,160,80,.5)',
        borderRadius: '6px', zIndex: 30, pointerEvents: 'auto'
      });
      this._panelList = document.createElement('div');
      Object.assign(this._panelList.style, { display: 'flex', flexDirection: 'column', gap: '2px' });
      this._panel.appendChild(this._panelList);
      document.body.appendChild(this._panel);
    }
    this._panelList.innerHTML = '';
    for (const h of this._history) {
      const row = document.createElement('div');
      Object.assign(row.style, { color: h.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 1px 2px #000' });
      row.textContent = h.text;
      this._panelList.appendChild(row);
    }
    this._panel.style.display = 'block';
  }

  _hideFullPanel() {
    if (this._panel) this._panel.style.display = 'none';
    this.el.style.display = 'flex';
  }

  destroy() {
    window.removeEventListener('keydown', this._onKey);
    for (const { event, handler } of this._subs) this.bus.off(event, handler);
    this._subs.length = 0;
    for (const e of this._entries) { if (e.el.parentNode) e.el.parentNode.removeChild(e.el); }
    this._entries.length = 0;
    if (this._panel && this._panel.parentNode) this._panel.parentNode.removeChild(this._panel);
    this._panel = null;
    this._panelList = null;
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
