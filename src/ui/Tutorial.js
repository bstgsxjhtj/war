// 新手引导：7 步操作教程，按对应键推进
import { LS } from '../core/constants/storage-keys.js';
export class Tutorial {
  constructor() {
    this.steps = [
      { msg: '① 移动：WASD 键', code: 'KeyW' },
      { msg: '② 攻击：鼠标左键（三段连击）', code: 'LMB' },
      { msg: '③ 格挡：鼠标右键（持刀减伤，精格挡弹刀）', code: 'RMB' },
      { msg: '④ 闪避：Q 键或双击方向（完美闪避+攻击加成）', code: 'KeyQ' },
      { msg: '⑤ 锁定：Tab 键（镜头跟随目标）', code: 'Tab' },
      { msg: '⑥ 大招：E 键（满怒气释放，武器专属）', code: 'KeyE' },
      { msg: '⑦ 技能树：K 键（击杀获点，分配加成）', code: 'KeyK' },
    ];
    this.step = 0;
    this.active = true;
    this.el = document.createElement('div');
    Object.assign(this.el.style, { position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(30,30,46,.95)', border: '1px solid #6b5', borderRadius: '10px', padding: '12px 20px', color: '#eee', fontSize: '14px', zIndex: 50, fontFamily: 'Segoe UI, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,.5)', textAlign: 'center', maxWidth: '600px' });
    document.body.appendChild(this.el);
    this._bind();
    this._show();
  }

  _bind() {
    this._onKey = (e) => this._check(e.code);
    this._onMouse = (e) => this._check(e.button === 0 ? 'LMB' : (e.button === 2 ? 'RMB' : null));
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('mousedown', this._onMouse);
  }

  _check(code) {
    if (!this.active || !code) return;
    const step = this.steps[this.step];
    if (step.code === code) {
      this.step++;
      if (this.step >= this.steps.length) this._finish();
      else this._show();
    }
  }

  _show() {
    const step = this.steps[this.step];
    const progress = `（${this.step + 1}/${this.steps.length}）`;
    this.el.innerHTML = `<div style="color:#ffd070;font-weight:600;margin-bottom:4px;">新手引导 ${progress}</div><div>${step.msg}</div>`;
    this.el.style.display = 'block';
  }

  _finish() {
    this.active = false;
    this.el.innerHTML = '<div style="color:#4ade80;font-weight:600;">引导完成！按 M 切换模式，N 天气，Esc 设置</div>';
    setTimeout(() => { this.el.style.display = 'none'; }, 3000);
    try { localStorage.setItem(LS.TUTORIAL_DONE, '1'); } catch (e) {}
  }

  destroy() {
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('mousedown', this._onMouse);
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }
}
