// 面板基类：居中弹窗 + toggleKey 开关；Escape 由 UIStack 统一关闭栈顶；子类覆写 render() 提供内容
import { UIStack } from './UIStack.js';

export class UIPanel {
  constructor({ id, toggleKey, width = '480px', position = 'center', style = {}, kb = null, action = null } = {}) {
    this.toggleKey = toggleKey;
    this.kb = kb;
    this.action = action;
    this.visible = false;
    this.el = document.createElement('div');
    this.el.id = id;
    const posStyle = position === 'center'
      ? { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
      : { ...position };
    Object.assign(this.el.style, {
      position: 'fixed', ...posStyle,
      width, maxHeight: '80vh', overflowY: 'auto', zIndex: 80,
      background: 'rgba(15,15,20,.95)', border: '2px solid #6a5a2a',
      borderRadius: '8px', padding: '16px', color: '#eee',
      fontFamily: 'Segoe UI, sans-serif', fontSize: '13px', display: 'none',
      ...style
    });
    document.body.appendChild(this.el);
    this._boundKey = (e) => this._onKey(e);
    document.addEventListener('keydown', this._boundKey);
  }

  _onKey(e) {
    const key = this.kb ? this.kb.get(this.action) : this.toggleKey;
    if (e.code === key) { e.preventDefault(); this.toggle(); }
  }

  toggle() { this.visible ? this.hide() : this.show(); }

  show() {
    this.visible = true;
    this.el.style.display = 'block';
    UIStack.push(this);
    this.render();
  }

  hide() {
    this.visible = false;
    this.el.style.display = 'none';
    UIStack.remove(this);
  }

  render() {}

  destroy() {
    document.removeEventListener('keydown', this._boundKey);
    if (this.visible) this.hide();
    this.el.remove();
  }
}
