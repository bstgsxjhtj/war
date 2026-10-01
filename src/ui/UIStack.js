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
  // 战役一#6：栈中任意面板 pausesGame=true 时返回 true，供主循环冻结 gameplay
  get pausing() { return this._stack.some(p => p.pausesGame); },
};

// 将 UIStack 引用挂到 window 上，监听器通过 window._uiStack 动态读取当前实例。
// vitest singleFork 模式下模块会在测试文件之间重新求值（产生新 UIStack 对象），
// 但 window 不重建——旧监听器仍留在 window 上且闭包捕获了旧 UIStack。
// 若旧监听器先触发并 stopImmediatePropagation，新监听器永远不执行 → 测试失败。
// 解法：只安装一次监听器（幂等），监听器内部通过 window._uiStack 读取最新引用，
// 每次 installUIStackEscape 调用时更新 window._uiStack 指向当前模块的 UIStack。
export function installUIStackEscape() {
  window._uiStack = UIStack;
  if (window._uiStackEscapeInstalled) return;
  window._uiStackEscapeInstalled = true;
  window.addEventListener('keydown', (e) => {
    const stack = window._uiStack;
    if (!stack || e.code !== 'Escape' || stack.empty) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const top = stack.top;
    if (top.closable === false) return;
    stack.remove(top);
    top.hide();
  }, true);
}
