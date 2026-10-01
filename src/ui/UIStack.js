// 全局 UI 面板栈：Escape 只关闭栈顶面板，避免多面板同时响应
// 面板 show 时 push、hide 时 remove；installUIStackEscape 用捕获阶段监听，先于其他 keydown 处理器执行
// 面板可设 closable=false（如主菜单标题屏），Escape 仍被吞掉但不关闭该面板
export const UIStack = {
  _stack: [],
  push(panel) {
    if (!this._stack.includes(panel)) this._stack.push(panel);
  },
  remove(panel) {
    const i = this._stack.indexOf(panel);
    if (i >= 0) this._stack.splice(i, 1);
  },
  get top() { return this._stack[this._stack.length - 1] || null; },
  get empty() { return this._stack.length === 0; },
};

let _installed = false;
export function installUIStackEscape() {
  if (_installed) return;
  _installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || UIStack.empty) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const top = UIStack.top;
    if (top.closable === false) return;
    UIStack.remove(top);
    top.hide();
  }, true);
}
