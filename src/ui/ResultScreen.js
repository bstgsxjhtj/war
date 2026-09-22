import { EV } from '../core/constants/events.js';
import * as THREE from 'three';

// 结算页：每局结束击杀/伤害/用时/评分
export class ResultScreen {
  static gradeOf(kills, damage, time) {
    let score = kills * 10 + damage * 0.1;
    if (time > 0 && time < 60) score += 20;
    else if (time > 180) score -= 10;
    if (score >= 70) return 'S';
    if (score >= 45) return 'A';
    if (score >= 20) return 'B';
    return 'C';
  }

  constructor(bus) {
    this.bus = bus;
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', width: '100vw', height: '100vh',
      background: 'radial-gradient(circle at 50% 40%, rgba(20,20,40,.92), rgba(0,0,0,.96))',
      display: 'none', alignItems: 'center', justifyContent: 'center', zIndex: 90,
      fontFamily: 'Segoe UI, sans-serif', backdropFilter: 'blur(4px)', overflow: 'auto'
    });
    document.body.appendChild(this.el);
  }

  show(data) {
    const win = data.win;
    const title = win ? '\u80dc\u5229' : '\u5931\u8d25';
    const titleClr = win ? '#4ade80' : '#f87171';
    const grade = ResultScreen.gradeOf(data.kills || 0, data.damage || 0, data.time || 0);
    const gradeClr = grade === 'S' ? '#ffd070' : (grade === 'A' ? '#aef' : '#bcd');
    this.el.innerHTML = [
      '<div style="background:linear-gradient(145deg,#1a1a2e,#0f0f1a);border:1px solid #4a3a6a;border-radius:16px;padding:36px 48px;text-align:center;color:#eee;box-shadow:0 12px 48px rgba(0,0,0,.6);min-width:380px;">',
      '<div style="font-size:42px;font-weight:800;color:' + titleClr + ';margin-bottom:4px;">' + title + '</div>',
      '<div style="font-size:14px;color:#888;margin-bottom:24px;">\u672c\u5c40\u7ed3\u7b97</div>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">',
      '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:12px;"><div style="font-size:11px;color:#888;">\u51fb\u6740</div><div style="font-size:24px;font-weight:700;color:#ffd070;">' + (data.kills || 0) + '</div></div>',
      '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:12px;"><div style="font-size:11px;color:#888;">\u9020\u6210\u4f24\u5bb3</div><div style="font-size:24px;font-weight:700;color:#fa8;">' + (data.damage || 0) + '</div></div>',
      '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:12px;"><div style="font-size:11px;color:#888;">\u7528\u65f6</div><div style="font-size:20px;font-weight:700;color:#aef;">' + this._fmtTime(data.time || 0) + '</div></div>',
      '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:12px;"><div style="font-size:11px;color:#888;">\u8bc4\u5206</div><div style="font-size:32px;font-weight:800;color:' + gradeClr + ';">' + grade + '</div></div>',
      '</div>',
      '<button id="rs-continue" style="padding:12px 32px;background:linear-gradient(90deg,#3a5a4a,#2a4a3a);border:1px solid #4a8;border-radius:8px;color:#fff;cursor:pointer;font-size:15px;font-family:inherit;font-weight:600;width:100%;">\u7ee7\u7eed (R)</button>',
      '</div>'
    ].join('');
    this.el.style.display = 'flex';
    this.el.querySelector('#rs-continue').addEventListener('click', () => this.hide());
    this._keyHandler = (e) => { if (e.code === 'KeyR' || e.code === 'Escape') this.hide(); };
    window.addEventListener('keydown', this._keyHandler);
  }

  _fmtTime(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  hide() {
    this.el.style.display = 'none';
    window.removeEventListener('keydown', this._keyHandler);
    this.bus.emit(EV.ROUND_RESTART);
  }
}
