// 面板基类：居中弹窗 + toggleKey 开关 + Escape 关闭；子类覆写 render() 提供内容
export class UIPanel {
  constructor({ id, toggleKey, width = '480px', position = 'center', style = {} } = {}) {
    this.toggleKey = toggleKey;
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
    document.addEventListener('keydown', (e) => this._onKey(e));
  }

  _onKey(e) {
    if (e.code === this.toggleKey) { e.preventDefault(); this.toggle(); }
    else if (e.code === 'Escape' && this.visible) this.hide();
  }

  toggle() { this.visible ? this.hide() : this.show(); }

  show() {
    this.visible = true;
    this.el.style.display = 'block';
    this.render();
  }

  hide() {
    this.visible = false;
    this.el.style.display = 'none';
  }

  render() {}
}
