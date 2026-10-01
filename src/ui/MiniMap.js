import { EV } from '../core/constants/events.js';
import * as THREE from 'three';

export class MiniMap {
  constructor(bus, worldSize = 220) {
    this.worldSize = worldSize;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 160;
    this.canvas.height = 160;
    Object.assign(this.canvas.style, {
      position: 'fixed', right: '12px', top: '12px', width: '140px', height: '140px',
      borderRadius: '50%', border: '2px solid rgba(180,160,80,.7)',
      boxShadow: '0 0 12px rgba(0,0,0,.6)', pointerEvents: 'none', zIndex: 15,
      background: 'radial-gradient(circle, rgba(30,40,30,.9), rgba(10,20,10,.95))'
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this._player = null; this._ais = []; this._camera = null;
    this._supply = [];
    this._colorblind = false;
    // 战役一#5：小地图降频至 15Hz——每帧全量 canvas 重绘（clear+clip+rotate+逐实体 draw）
    // 在低端机是主线程热点，15fps 足够战术感知，60fps 纯浪费
    this._mmAccum = 0;
    this._mmInterval = 1 / 15;
    bus.on(EV.MINIMAP_SUPPLY, (pts) => { this._supply = pts || []; });
  }

  setRefs(player, ais, camera) {
    this._player = player; this._ais = ais; this._camera = camera;
  }

  update(dt) {
    // 战役一#5：15Hz 节流——累积 dt 达间隔才重绘，跳帧时小地图冻结上一帧（可接受）
    this._mmAccum += dt;
    if (this._mmAccum < this._mmInterval) return;
    this._mmAccum -= this._mmInterval;
    if (!this._player) return;
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, cx = W / 2, cy = H / 2, R = W / 2 - 4;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const scale = (R * 2) / this.worldSize;
    const px = this._player.root.position.x, pz = this._player.root.position.z;
    const pa = this._player.root.rotation.y || this._player.yaw || 0;
    ctx.translate(cx, cy);
    ctx.rotate(-pa + Math.PI);
    ctx.scale(1, -1);
    ctx.fillStyle = 'rgba(40,60,40,.5)';
    ctx.fillRect(-R, -R, R * 2, R * 2);
    for (const s of this._supply) {
      const sx = (s.x - px) * scale, sz = (s.z - pz) * scale;
      if (Math.abs(sx) > R || Math.abs(sz) > R) continue;
      ctx.fillStyle = '#ffaa44';
      ctx.beginPath(); ctx.arc(sx, sz, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const ai of this._ais) {
      if (!ai.root || !ai.root.visible) continue;
      const dx = (ai.root.position.x - px) * scale, dz = (ai.root.position.z - pz) * scale;
      if (Math.abs(dx) > R || Math.abs(dz) > R) continue;
      ctx.fillStyle = ai.team === 0 ? '#4488ff' : '#ff4444';
      const r = ai._isBoss ? 5 : 3;
      if (this._colorblind && ai.team !== 0) {
        // 色弱模式：敌人用方形，与友军圆点形成形状区分（不依赖颜色）
        ctx.beginPath(); ctx.rect(dx - r, dz - r, r * 2, r * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(dx, dz, r, 0, Math.PI * 2); ctx.fill();
      }
      if (ai._isElite) {
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(dx, dz, r + 2, 0, Math.PI * 2); ctx.stroke();
      }
      // 濒死敌人：金色菱形标记提示可处决
      if (ai.canBeExecuted) {
        const s = r + 3;
        ctx.strokeStyle = '#ffea00'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dx, dz - s); ctx.lineTo(dx + s, dz); ctx.lineTo(dx, dz + s); ctx.lineTo(dx - s, dz);
        ctx.closePath(); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(-4, 4); ctx.lineTo(4, 4); ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,180,100,.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  }

  setWorldSize(s) { if (this.worldSize !== s) this.worldSize = s; }
  setColorblind(v) { this._colorblind = !!v; }
}
