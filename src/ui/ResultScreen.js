import { EV } from '../core/constants/events.js';
import { UIStack } from './UIStack.js';
import * as THREE from 'three';

// 结算页：每局结束击杀/伤害/用时/评分
export class ResultScreen {
  static gradeOf(kills, damage, time) {
    const score = ResultScreen._scoreOf(kills, damage, time);
    if (score >= 70) return 'S';
    if (score >= 45) return 'A';
    if (score >= 20) return 'B';
    return 'C';
  }

  static _scoreOf(kills, damage, time) {
    let score = kills * 10 + damage * 0.1;
    if (time > 0 && time < 60) score += 20;
    else if (time > 180) score -= 10;
    return score;
  }

  static gradeGap(kills, damage, time) {
    const score = ResultScreen._scoreOf(kills, damage, time);
    const grade = ResultScreen.gradeOf(kills, damage, time);
    if (grade === 'S') return null;
    const thresholds = { C: 20, B: 45, A: 70 };
    const next = { C: 'B', B: 'A', A: 'S' };
    return { next: next[grade], gap: Math.ceil(thresholds[grade] - score) };
  }

  constructor(bus) {
    this.bus = bus;
    this.el = document.createElement('div');
    this.el.id = 'result-screen';
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
    const gap = ResultScreen.gradeGap(data.kills || 0, data.damage || 0, data.time || 0);
    const gapHtml = gap ? '<div style="font-size:13px;color:#9a8;margin-top:8px;">\u8ddd ' + gap.next + ' \u8bc4\u7ea7\uff1a\u8fd8\u5dee ' + gap.gap + ' \u5206</div>' : '';
    const deathHtml = (!win && data.deathCause) ? '<div style="font-size:13px;color:#a66;margin-top:4px;">\u6b7b\u56e0\uff1a' + data.deathCause + '</div>' : '';
    const waveHtml = (data.wave != null) ? '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:12px;margin-top:8px;"><div style="font-size:11px;color:#888;">\u6ce2\u6570</div><div style="font-size:24px;font-weight:700;color:#8df;">\u7b2c ' + data.wave + ' \u6ce2</div>' + (data.bestWave > 0 ? '<div style="font-size:12px;color:#ffd070;margin-top:4px;">\u5386\u53f2\u6700\u9ad8\uff1a\u7b2c ' + data.bestWave + ' \u6ce2</div>' : '') + '</div>' : '';
    this.el.innerHTML = [
      '<div style="background:linear-gradient(145deg,#1a1a2e,#0f0f1a);border:1px solid #4a3a6a;border-radius:16px;padding:36px 48px;text-align:center;color:#eee;box-shadow:0 12px 48px rgba(0,0,0,.6);min-width:380px;">',
      '<div style="font-size:42px;font-weight:800;color:' + titleClr + ';margin-bottom:4px;">' + title + '</div>',
      '<div style="font-size:14px;color:#888;margin-bottom:24px;">\u672c\u5c40\u7ed3\u7b97</div>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">',
      '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:12px;"><div style="font-size:11px;color:#888;">\u51fb\u6740</div><div style="font-size:24px;font-weight:700;color:#ffd070;">' + (data.kills || 0) + '</div></div>',
      '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:12px;"><div style="font-size:11px;color:#888;">\u9020\u6210\u4f24\u5bb3</div><div style="font-size:24px;font-weight:700;color:#fa8;">' + (data.damage || 0) + '</div></div>',
      '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:12px;"><div style="font-size:11px;color:#888;">\u7528\u65f6</div><div style="font-size:20px;font-weight:700;color:#aef;">' + this._fmtTime(data.time || 0) + '</div></div>',
      '<div style="background:rgba(255,255,255,.04);border-radius:8px;padding:12px;"><div style="font-size:11px;color:#888;">\u8bc4\u5206</div><div style="font-size:32px;font-weight:800;color:' + gradeClr + ';">' + grade + '</div>' + gapHtml + deathHtml + '</div>',
      '</div>',
      waveHtml,
      '<button id="rs-continue" style="padding:12px 32px;background:linear-gradient(90deg,#3a5a4a,#2a4a3a);border:1px solid #4a8;border-radius:8px;color:#fff;cursor:pointer;font-size:15px;font-family:inherit;font-weight:600;width:100%;">\u7ee7\u7eed (R)</button>',
      '</div>'
    ].join('');
    this.el.style.display = 'flex';
    UIStack.push(this);
    const btn = this.el.querySelector('#rs-continue');
    if (btn) btn.addEventListener('click', () => this.hide());
    this._keyHandler = (e) => { if (e.code === 'KeyR') this.hide(); };
    window.addEventListener('keydown', this._keyHandler);
  }

  _fmtTime(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  hide() {
    this.el.style.display = 'none';
    UIStack.remove(this);
    window.removeEventListener('keydown', this._keyHandler);
    this.bus.emit(EV.ROUND_RESTART);
  }
}
