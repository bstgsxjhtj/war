// 战场全图面板（src/auxiliary/ 解耦模块）：独立全屏地图覆盖层，仅通过 EventBus 与 UIStack 通信
// 不依赖 gameplay 类实例；setRefs 接收 plain data 对象 {position:{x,z}, team, alive, isBoss}
// toggleKey 默认 KeyG（go to map）；Escape 由 UIStack 统一关闭栈顶；pausesGame=true 时主循环冻结 gameplay（C1-6 暂停门）
import { UIStack } from '../ui/UIStack.js';
import { EV } from '../core/constants/events.js';

export class FullMapPanel {
  constructor(bus, opts = {}) {
    this.bus = bus;
    this.worldSize = opts.worldSize ?? 220;
    this.toggleKey = opts.toggleKey ?? 'KeyG';
    this.pausesGame = true;
    this.visible = false;

    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,.7)', zIndex: '200', display: 'none',
      alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      fontFamily: 'Segoe UI, sans-serif', color: '#eee', userSelect: 'none'
    });

    this._title = document.createElement('div');
    this._title.textContent = '战场全图';
    Object.assign(this._title.style, {
      fontSize: '22px', marginBottom: '12px', letterSpacing: '4px',
      color: '#d4c060', textShadow: '0 0 10px rgba(0,0,0,.9)'
    });
    this.el.appendChild(this._title);

    this._wrap = document.createElement('div');
    Object.assign(this._wrap.style, { position: 'relative' });
    this.el.appendChild(this._wrap);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 700;
    this.canvas.height = 700;
    Object.assign(this.canvas.style, {
      width: 'min(700px, 90vmin)', height: 'min(700px, 90vmin)',
      background: 'rgba(12,20,12,.96)', border: '2px solid #6a5a2a',
      borderRadius: '6px', boxShadow: '0 0 24px rgba(0,0,0,.7)'
    });
    this._wrap.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._closeBtn = document.createElement('button');
    this._closeBtn.textContent = '×';
    this._closeBtn.type = 'button';
    Object.assign(this._closeBtn.style, {
      position: 'absolute', right: '6px', top: '6px', width: '30px', height: '30px',
      padding: '0', lineHeight: '1', fontSize: '18px', cursor: 'pointer',
      borderRadius: '4px', border: '2px solid #6a5a2a',
      background: 'rgba(20,20,25,.95)', color: '#eee'
    });
    this._closeBtn.addEventListener('click', () => this.hide());
    this._wrap.appendChild(this._closeBtn);

    document.body.appendChild(this.el);

    this._player = null;
    this._enemies = [];
    this._camera = null;
    this._supply = [];
    this._pings = [];
    this._acc = 0;
    this._interval = 1 / 10;

    this._supplyHandler = (pts) => { this._supply = pts || []; };
    this._pingHandler = (p) => {
      if (!p) return;
      this._pings.push(p);
      if (this._pings.length > 32) this._pings.shift();
    };
    this.bus.on(EV.MINIMAP_SUPPLY, this._supplyHandler);
    this.bus.on(EV.MAP_PING, this._pingHandler);

    this._boundKey = (e) => this._onKey(e);
    document.addEventListener('keydown', this._boundKey);
  }

  _onKey(e) {
    if (e.code === this.toggleKey) { e.preventDefault(); this.toggle(); }
  }

  toggle() { this.visible ? this.hide() : this.show(); }

  show() {
    this.visible = true;
    this.el.style.display = 'flex';
    UIStack.push(this);
    this.render();
  }

  hide() {
    this.visible = false;
    this.el.style.display = 'none';
    UIStack.remove(this);
  }

  setRefs(player, enemies, camera) {
    this._player = player;
    this._enemies = enemies || [];
    this._camera = camera;
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const W = this.canvas.width, H = this.canvas.height;
    const scale = W / this.worldSize;
    const toX = (x) => W / 2 + x * scale;
    const toY = (z) => H / 2 - z * scale;

    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(120,140,120,.14)';
    ctx.lineWidth = 1;
    const grid = 20;
    for (let i = 0; i <= grid; i++) {
      const v = (i / grid) * W;
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(W, v); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(180,160,80,.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);

    for (const s of this._supply) {
      if (!s) continue;
      ctx.fillStyle = '#ffdd44';
      ctx.beginPath();
      ctx.arc(toX(s.x || 0), toY(s.z || 0), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of this._enemies) {
      if (!e || !e.position || e.alive === false) continue;
      const ex = toX(e.position.x), ey = toY(e.position.z);
      if (e.isBoss) {
        ctx.fillStyle = '#ff8c1a';
        ctx.beginPath(); ctx.arc(ex, ey, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ex, ey, 12, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = '#ff4444';
        ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (this._player && this._player.position) {
      const px = toX(this._player.position.x), py = toY(this._player.position.z);
      ctx.fillStyle = '#00ff88';
      ctx.beginPath();
      ctx.moveTo(px, py - 9);
      ctx.lineTo(px - 6, py + 6);
      ctx.lineTo(px + 6, py + 6);
      ctx.closePath();
      ctx.fill();
    }

    for (const p of this._pings) {
      if (!p) continue;
      const x = p.x != null ? toX(p.x) : (p.position ? toX(p.position.x) : W / 2);
      const y = p.z != null ? toY(p.z) : (p.position ? toY(p.position.z) : H / 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
    }
  }

  update(dt) {
    if (!this.visible) return;
    this._acc += dt;
    if (this._acc < this._interval) return;
    this._acc -= this._interval;
    this.render();
  }

  destroy() {
    document.removeEventListener('keydown', this._boundKey);
    if (this.visible) this.hide();
    if (this.bus && typeof this.bus.off === 'function') {
      this.bus.off(EV.MINIMAP_SUPPLY, this._supplyHandler);
      this.bus.off(EV.MAP_PING, this._pingHandler);
    }
    this.el.remove();
  }
}
