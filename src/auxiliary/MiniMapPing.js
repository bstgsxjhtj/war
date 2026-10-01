// 小地图 Ping/标记覆盖层：在 minimap canvas 之上叠加一块透明 canvas，绘制可过期的扩散圆环标记。
// 仅通过 EventBus 的 EV.MAP_PING 事件驱动，不依赖任何 gameplay 模块，可独立挂载/销毁。
import { EV } from '../core/constants/events.js';

const PING_COLORS = {
  normal: '#ffdd00',
  danger: '#ff3333',
  assist: '#33aaff',
  objective: '#33ff66'
};
const EXPAND_MS = 1000;
const DOT_RADIUS = 3;

export class MiniMapPing {
  constructor(bus, opts = {}) {
    this._bus = bus;
    this.canvas = opts.canvas;
    this.pingTTL = opts.pingTTL ?? 4000;
    this.pingRadius = opts.pingRadius ?? 20;
    this.worldSize = opts.worldSize ?? 220;
    this._pings = [];
    this._player = null;
    this._createOverlay();
    this._pingHandler = (p) => this.addPing(p.x, p.z, p.type);
    this._bus.on(EV.MAP_PING, this._pingHandler);
  }

  _createOverlay() {
    const base = this.canvas;
    this.overlay = document.createElement('canvas');
    this.overlay.width = base.width;
    this.overlay.height = base.height;
    const cs = base.style;
    this.overlay.style.position = cs.position || 'absolute';
    if (cs.left) this.overlay.style.left = cs.left;
    if (cs.right) this.overlay.style.right = cs.right;
    if (cs.top) this.overlay.style.top = cs.top;
    if (cs.bottom) this.overlay.style.bottom = cs.bottom;
    this.overlay.style.width = cs.width || (base.width + 'px');
    this.overlay.style.height = cs.height || (base.height + 'px');
    this.overlay.style.pointerEvents = 'none';
    const zi = parseInt(cs.zIndex, 10);
    this.overlay.style.zIndex = String(Number.isNaN(zi) ? 16 : zi + 1);
    if (base.parentNode) {
      base.parentNode.insertBefore(this.overlay, base.nextSibling);
    } else {
      document.body.appendChild(this.overlay);
    }
    this.ctx = this.overlay.getContext('2d');
  }

  setPlayerPos(x, z, angle) {
    this._player = { x, z, angle: angle || 0 };
  }

  _worldToMinimap(worldX, worldZ) {
    const W = this.overlay.width, H = this.overlay.height;
    if (!this._player) {
      return {
        mx: (worldX / this.worldSize + 0.5) * W,
        my: (worldZ / this.worldSize + 0.5) * H
      };
    }
    const dx = worldX - this._player.x;
    const dz = worldZ - this._player.z;
    const a = this._player.angle || 0;
    const cos = Math.cos(a), sin = Math.sin(a);
    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;
    return {
      mx: (rx / this.worldSize + 0.5) * W,
      my: (rz / this.worldSize + 0.5) * H
    };
  }

  addPing(worldX, worldZ, type = 'normal') {
    const color = PING_COLORS[type] || PING_COLORS.normal;
    this._pings.push({ worldX, worldZ, type, color, t: 0 });
  }

  update(dt) {
    const ms = dt * 1000;
    const ttl = EXPAND_MS + this.pingTTL;
    for (const p of this._pings) p.t += ms;
    this._pings = this._pings.filter((p) => p.t < ttl);
    this._draw();
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.overlay.width, H = this.overlay.height;
    ctx.clearRect(0, 0, W, H);
    for (const p of this._pings) {
      const { mx, my } = this._worldToMinimap(p.worldX, p.worldZ);
      const progress = Math.min(p.t / EXPAND_MS, 1);
      const r = Math.max(progress * this.pingRadius, 0.1);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(mx, my, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  clear() {
    this._pings = [];
    this._draw();
  }

  destroy() {
    this._bus.off(EV.MAP_PING, this._pingHandler);
    this._pingHandler = null;
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this._pings = [];
  }
}
