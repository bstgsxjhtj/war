// 死亡即时反馈：阵亡 overlay + 凶手方向箭 + 0.8s 冻结闸门
import { COUNTER_MATRIX } from '../gameplay/CombatSystem.js';

const PAUSE = 1.5;
const ARROW_HOLD = 1.6;

export function killerLabel(k) {
  if (!k) return '环境伤害';
  if (k._isBoss) return k.displayName || ('【Boss】' + (k._name || ''));
  if (k._isElite) return k.displayName || '【精英】精兵';
  if (k._isCavalry) return '骑兵';
  if (k.isLocal) return '玩家';
  return k.weapon?.name || '环境伤害';
}

export class DeathFeedback {
  constructor() {
    this.paused = false;
    this._pauseT = 0;
    this._arrowT = 0;

    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0', display: 'none', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', zIndex: 40, pointerEvents: 'none', fontFamily: 'Segoe UI, sans-serif',
      background: 'rgba(80,0,0,.35)', opacity: '0', transition: 'none',
    });
    this._title = document.createElement('div');
    Object.assign(this._title.style, { color: '#ff5050', fontSize: '30px', fontWeight: 'bold', textShadow: '0 2px 6px #000' });
    this._cause = document.createElement('div');
    Object.assign(this._cause.style, { color: '#fff', fontSize: '18px', marginTop: '6px', textShadow: '0 1px 3px #000' });
    this._hint = document.createElement('div');
    Object.assign(this._hint.style, { color: '#ffd070', fontSize: '14px', marginTop: '16px', textShadow: '0 1px 3px #000', opacity: '0.8' });
    this._hint.textContent = '按 R 重开 · Esc 回菜单';
    this.el.appendChild(this._title);
    this.el.appendChild(this._cause);
    this.el.appendChild(this._hint);
    document.body.appendChild(this.el);

    this._arrow = document.createElement('div');
    Object.assign(this._arrow.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: '120px', height: '120px', pointerEvents: 'none', zIndex: 41, display: 'none',
    });
    this._ind = document.createElement('div');
    Object.assign(this._ind.style, {
      position: 'absolute', top: '0', left: '50%', transform: 'translateX(-50%)',
      width: '0', height: '0', borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
      borderBottom: '16px solid rgba(255,40,40,.9)', filter: 'drop-shadow(0 0 4px rgba(255,0,0,.6))',
      transformOrigin: '50% 60px',
    });
    this._arrow.appendChild(this._ind);
    document.body.appendChild(this._arrow);
  }

  show({ label, countered, angle, camYaw }) {
    this._title.textContent = '阵亡';
    this._cause.textContent = '死于 ' + label + (countered ? ' · 被克制' : '');
    this.el.style.display = 'flex';
    this.el.style.opacity = '1';

    if (typeof angle === 'number') {
      const rel = angle - (camYaw || 0);
      const deg = ((rel * 180 / Math.PI) + 360) % 360;
      this._arrow.style.display = 'block';
      this._ind.style.transform = `translateX(-50%) rotate(${deg}deg)`;
      this._arrowT = ARROW_HOLD;
    }

    this.paused = true;
    this._pauseT = PAUSE;
  }

  update(dt) {
    if (this._pauseT > 0) {
      this._pauseT -= dt;
      if (this._pauseT <= 0) { this._pauseT = 0; this.paused = false; }
    }
    if (this._arrowT > 0) {
      this._arrowT -= dt;
      if (this._arrowT <= 0) {
        this._arrowT = 0;
        this._arrow.style.display = 'none';
        this.el.style.opacity = '0';
      }
    }
  }

  hide() {
    this.paused = false;
    this._pauseT = 0;
    this._arrowT = 0;
    this._arrow.style.display = 'none';
    this.el.style.display = 'none';
    this.el.style.opacity = '0';
  }

  destroy() {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    if (this._arrow.parentNode) this._arrow.parentNode.removeChild(this._arrow);
  }
}
