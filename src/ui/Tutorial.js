// 新手引导：5 步 toast 教程，动作/事件推进，仅首局出现
import { EV } from '../core/constants/events.js';
import { LS } from '../core/constants/storage-keys.js';

const FADE = 0.3;
const STEP_TIMEOUT = 6;
const FINAL_HOLD = 2;

export class Tutorial {
  constructor(bus = null) {
    this.bus = bus;
    this.steps = [
      { msg: '① 移动：WASD 键', keys: ['KeyW', 'KeyA', 'KeyS', 'KeyD'] },
      { msg: '② 攻击：鼠标左键（三段连击）', mouse: [0] },
      { msg: '③ 格挡：鼠标右键（减伤，完美格挡弹刀）', mouse: [2] },
      { msg: '④ 闪避：Q 键（无敌帧，躲技能）', keys: ['KeyQ'] },
      { msg: '⑤ 切换武器：1-4 数字键（不同手感）', keys: ['Digit1', 'Digit2', 'Digit3', 'Digit4'] },
      { msg: '⑥ 大招：T 键（怒气满时释放，武器专属）', keys: ['KeyT'], event: EV.COMBAT_ULTIMATE },
      { msg: '⑦ 处决：E 键（敌人残血时按 E 处决）', keys: ['KeyE'] },
      { msg: '⑧ 克制：青色伤害数字 = 你克制敌人', event: EV.COMBAT_COUNTER },
    ];
    this.step = 0;
    this.active = true;
    this.final = false;
    this.phase = 'in';
    this.phaseT = FADE;
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(30,30,46,.95)', border: '1px solid #6b5', borderLeft: '4px solid #ffd070',
      borderRadius: '10px', padding: '10px 18px', color: '#eee', fontSize: '14px', zIndex: 50,
      fontFamily: 'Segoe UI, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)', textAlign: 'center',
      maxWidth: '560px', opacity: '0', transition: 'none', pointerEvents: 'none',
    });
    document.body.appendChild(this.el);
    this._bind();
    this._render();
  }

  _bind() {
    this._onKey = (e) => this._match({ k: 'key', code: e.code });
    this._onMouse = (e) => this._match({ k: 'mouse', btn: e.button });
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('mousedown', this._onMouse);
    if (this.bus) {
      this._offUlt = this.bus.on(EV.COMBAT_ULTIMATE, () => this._match({ k: 'event', name: EV.COMBAT_ULTIMATE }));
      this._offCnt = this.bus.on(EV.COMBAT_COUNTER, () => this._match({ k: 'event', name: EV.COMBAT_COUNTER }));
    }
  }

  _match(a) {
    if (!this.active) return;
    const s = this.steps[this.step];
    let hit = false;
    if (a.k === 'key' && s.keys && s.keys.includes(a.code)) hit = true;
    if (a.k === 'mouse' && s.mouse && s.mouse.includes(a.btn)) hit = true;
    if (a.k === 'event' && s.event === a.name) hit = true;
    if (hit) this._advance();
  }

  _advance() {
    this.step++;
    if (this.step >= this.steps.length) { this._finish(); return; }
    this.phase = 'in';
    this.phaseT = FADE;
    this._render();
  }

  _finish() {
    this.active = false;
    this.final = true;
    this.phase = 'hold';
    this.phaseT = FINAL_HOLD;
    this.el.style.opacity = '1';
    try { localStorage.setItem(LS.TUTORIAL_DONE, '1'); } catch (e) {}
    this._renderFinal();
  }

  _render() {
    const step = this.steps[this.step];
    const progress = `${this.step + 1}/${this.steps.length}`;
    this.el.innerHTML = `<div style="color:#ffd070;font-weight:600;margin-bottom:3px;">新手引导（${progress}）</div><div>${step.msg}</div>`;
  }

  _renderFinal() {
    this.el.innerHTML = '<div style="color:#4ade80;font-weight:600;">✓ 引导完成！Tab 锁定 · Q 闪避 · E 处决 · K 技能树 · M 模式 · N 天气 · Esc 设置</div>';
  }

  update(dt) {
    if (!this.active && !this.final) return;
    this.phaseT -= dt;
    if (this.phase === 'in') {
      const op = Math.max(0, Math.min(1, 1 - this.phaseT / FADE));
      this.el.style.opacity = String(op);
      if (this.phaseT <= 0) { this.phase = 'hold'; this.phaseT = this.final ? FINAL_HOLD : STEP_TIMEOUT; this.el.style.opacity = '1'; }
    } else if (this.phase === 'hold') {
      this.el.style.opacity = '1';
      if (this.phaseT <= 0) {
        if (this.final) { this.el.style.display = 'none'; }
        else this._advance();
      }
    }
  }

  destroy() {
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('mousedown', this._onMouse);
    if (this._offUlt) this._offUlt();
    if (this._offCnt) this._offCnt();
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
