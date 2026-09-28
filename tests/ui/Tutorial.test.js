// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tutorial } from '../../src/ui/Tutorial.js';
import { EV } from '../../src/core/constants/events.js';
import { LS } from '../../src/core/constants/storage-keys.js';
import { DEFAULT_BINDINGS, KeyBindings } from '../../src/core/input/KeyBindings.js';

function mkBus() {
  const handlers = {};
  return {
    on: vi.fn((name, fn) => { (handlers[name] ||= []).push(fn); return () => {}; }),
    emit: vi.fn((name, payload) => { (handlers[name] || []).forEach((f) => f(payload)); }),
    _handlers: handlers,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});

function keydown(code) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}
function mousedown(button) {
  window.dispatchEvent(new MouseEvent('mousedown', { button }));
}

describe('Tutorial - 构造与初始状态', () => {
  it('12 步 toast，初始 step=0 active=true，渲染第一步', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    expect(t.steps.length).toBe(12);
    expect(t.step).toBe(0);
    expect(t.active).toBe(true);
    expect(t.el.parentNode).toBe(document.body);
    expect(t.el.textContent).toContain('移动');
    expect(t.el.textContent).toContain('WASD');
  });

  it('订阅 COMBAT_COUNTER / COMBAT_ULTIMATE / COMBO_FINISHER 事件', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    expect(bus.on).toHaveBeenCalledWith(EV.COMBAT_COUNTER, expect.any(Function));
    expect(bus.on).toHaveBeenCalledWith(EV.COMBAT_ULTIMATE, expect.any(Function));
    expect(bus.on).toHaveBeenCalledWith(EV.COMBO_FINISHER, expect.any(Function));
  });

  it('bus 可选：不传时不抛错', () => {
    const t = new Tutorial();
    expect(t.active).toBe(true);
    expect(t.el.textContent).toContain('移动');
  });
});

describe('Tutorial - update 透明度与超时推进', () => {
  it('fade-in：FADE 秒后 opacity=1 进入 hold', () => {
    const t = new Tutorial(mkBus());
    expect(parseFloat(t.el.style.opacity)).toBeLessThanOrEqual(0.001);
    t.update(0.3);
    expect(parseFloat(t.el.style.opacity)).toBe(1);
    expect(t.phase).toBe('hold');
  });

  it('hold 超时后自动推进到下一步（STEP_TIMEOUT 10s）', () => {
    const t = new Tutorial(mkBus());
    t.update(0.3);
    expect(t.step).toBe(0);
    t.update(9.9);
    expect(t.step).toBe(0);
    t.update(0.2);
    expect(t.step).toBe(1);
    expect(t.el.textContent).toContain('攻击');
  });

  it('fade-in 期间也可被动作推进', () => {
    const t = new Tutorial(mkBus());
    t.update(0.1);
    keydown('KeyW');
    expect(t.step).toBe(1);
    expect(t.el.textContent).toContain('攻击');
  });
});

describe('Tutorial - 动作匹配推进', () => {
  it('① 移动：KeyW/KeyA/KeyS/KeyD 推进', () => {
    const t = new Tutorial(mkBus());
    keydown('KeyA');
    expect(t.step).toBe(1);
  });

  it('② 攻击：鼠标左键(button 0)推进', () => {
    const t = new Tutorial(mkBus());
    keydown('KeyW');
    mousedown(0);
    expect(t.step).toBe(2);
    expect(t.el.textContent).toContain('格挡');
  });

  it('③ 格挡：鼠标右键(button 2)推进到闪避步', () => {
    const t = new Tutorial(mkBus());
    t.step = 2; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    mousedown(2);
    expect(t.step).toBe(3);
    expect(t.el.textContent).toContain('闪避');
  });

  it('④ 闪避：KeyQ 推进到切换武器步', () => {
    const t = new Tutorial(mkBus());
    t.step = 3; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    keydown('KeyQ');
    expect(t.step).toBe(4);
    expect(t.el.textContent).toContain('武器');
  });

  it('⑤ 切换武器：Digit1/Digit2/Digit3/Digit4 推进到大招步', () => {
    const t = new Tutorial(mkBus());
    t.step = 4; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    keydown('Digit2');
    expect(t.step).toBe(5);
    expect(t.el.textContent).toContain('大招');
  });

  it('⑥ 大招：KeyT 推进（修复 KeyE bug：按 KeyE 不推进）', () => {
    const t = new Tutorial(mkBus());
    t.step = 5; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    keydown('KeyE');
    expect(t.step).toBe(5);
    keydown('KeyT');
    expect(t.step).toBe(6);
    expect(t.el.textContent).toContain('处决');
  });

  it('⑥ 大招：COMBAT_ULTIMATE 事件也推进', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    t.step = 5; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    bus.emit(EV.COMBAT_ULTIMATE);
    expect(t.step).toBe(6);
  });

  it('⑦ 处决：KeyE 推进到克制步', () => {
    const t = new Tutorial(mkBus());
    t.step = 6; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    keydown('KeyE');
    expect(t.step).toBe(7);
    expect(t.el.textContent).toContain('克制');
  });

  it('⑧ 克制：COMBAT_COUNTER 事件推进到锁定步', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    t.step = 7; t.phase = 'hold'; t.phaseT = 6;
    t._render();
    bus.emit(EV.COMBAT_COUNTER);
    expect(t.step).toBe(8);
    expect(t.el.textContent).toContain('锁定');
  });

  it('非当前步对应的动作不推进', () => {
    const t = new Tutorial(mkBus());
    keydown('KeyT');
    expect(t.step).toBe(0);
    mousedown(2);
    expect(t.step).toBe(0);
  });

  it('完成后不再响应任何动作', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    t._finish();
    keydown('KeyW');
    mousedown(0);
    bus.emit(EV.COMBAT_COUNTER);
    expect(t.active).toBe(false);
  });
});

describe('Tutorial - 进阶步骤（可选引导）', () => {
  it('⑨ 锁定：Tab 推进到连击终结步', () => {
    const t = new Tutorial(mkBus());
    t.step = 8; t.phase = 'hold'; t.phaseT = 10; t._render();
    keydown('Tab');
    expect(t.step).toBe(9);
    expect(t.el.textContent).toContain('连击');
  });

  it('⑩ 连击终结：COMBO_FINISHER 事件推进到技能树步', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    t.step = 9; t.phase = 'hold'; t.phaseT = 10; t._render();
    bus.emit(EV.COMBO_FINISHER);
    expect(t.step).toBe(10);
    expect(t.el.textContent).toContain('技能树');
  });

  it('⑪ 技能树：KeyK 推进到词条步', () => {
    const t = new Tutorial(mkBus());
    t.step = 10; t.phase = 'hold'; t.phaseT = 10; t._render();
    keydown('KeyK');
    expect(t.step).toBe(11);
    expect(t.el.textContent).toContain('词条');
  });

  it('⑫ 词条：KeyI 推进到完成', () => {
    const t = new Tutorial(mkBus());
    t.step = 11; t.phase = 'hold'; t.phaseT = 10; t._render();
    keydown('KeyI');
    expect(t.active).toBe(false);
    expect(localStorage.getItem(LS.TUTORIAL_DONE)).toBe('1');
  });
});

describe('Tutorial - 完成与收尾', () => {
  it('全部步进后写 tutorial_done 并显示完成语', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    keydown('KeyW');   // ① 移动
    mousedown(0);       // ② 攻击
    mousedown(2);       // ③ 格挡
    keydown('KeyQ');    // ④ 闪避
    keydown('Digit1');  // ⑤ 切换武器
    keydown('KeyT');    // ⑥ 大招
    keydown('KeyE');    // ⑦ 处决
    bus.emit(EV.COMBAT_COUNTER); // ⑧ 克制
    keydown('Tab');     // ⑨ 锁定
    bus.emit(EV.COMBO_FINISHER); // ⑩ 连击终结
    keydown('KeyK');    // ⑪ 技能树
    keydown('KeyI');    // ⑫ 词条
    expect(t.active).toBe(false);
    expect(localStorage.getItem(LS.TUTORIAL_DONE)).toBe('1');
    expect(t.el.textContent).toContain('引导完成');
  });

  it('完成语 hold FINAL_HOLD 秒后隐藏元素', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    keydown('KeyW'); mousedown(0); mousedown(2);
    keydown('KeyQ'); keydown('Digit1'); keydown('KeyT'); keydown('KeyE');
    bus.emit(EV.COMBAT_COUNTER);
    keydown('Tab'); bus.emit(EV.COMBO_FINISHER); keydown('KeyK'); keydown('KeyI');
    expect(t.el.style.display).not.toBe('none');
    t.update(2);
    expect(t.el.style.display).toBe('none');
  });

  it('完成语提示后续可探索的按键', () => {
    const bus = mkBus();
    const t = new Tutorial(bus);
    t._finish();
    expect(t.el.textContent).toContain('Tab');
    expect(t.el.textContent).toContain('K');
    expect(t.el.textContent).toContain('E');
  });
});

describe('Tutorial - 完成条键位动态化（P1-3）', () => {
  it('默认绑定时完成条含 Tab/Q/E 三键（回归守卫）', () => {
    const t = new Tutorial(mkBus(), new KeyBindings());
    t._finish();
    expect(t.el.textContent).toContain('Tab');
    expect(t.el.textContent).toContain('Q');
    expect(t.el.textContent).toContain('E');
  });

  it('重绑 dodge→KeyR 后完成条显示 R 闪避（不再出现 Q 闪避）', () => {
    const kb = new KeyBindings();
    kb.set('dodge', 'KeyR');
    const t = new Tutorial(mkBus(), kb);
    t._finish();
    expect(t.el.textContent).toContain('R 闪避');
    expect(t.el.textContent).not.toContain('Q 闪避');
  });

  it('重绑 execute→Digit5 后完成条显示 5 处决', () => {
    const kb = new KeyBindings();
    kb.set('execute', 'Digit5');
    const t = new Tutorial(mkBus(), kb);
    t._finish();
    expect(t.el.textContent).toContain('5 处决');
    expect(t.el.textContent).not.toContain('E 处决');
  });

  it('重绑 lock→KeyG 后完成条显示 G 锁定', () => {
    const kb = new KeyBindings();
    kb.set('lock', 'KeyG');
    const t = new Tutorial(mkBus(), kb);
    t._finish();
    expect(t.el.textContent).toContain('G 锁定');
    expect(t.el.textContent).not.toContain('Tab 锁定');
  });
});

describe('Tutorial - destroy', () => {
  it('移除 window 监听并移除元素', () => {
    const t = new Tutorial(mkBus());
    t.destroy();
    expect(t.el.parentNode).toBe(null);
    keydown('KeyW');
    expect(t.step).toBe(0);
  });
});

describe('Tutorial - KeyBindings 接入 (P0-3)', () => {
  function mkKb(overrides = {}) {
    const bindings = { ...DEFAULT_BINDINGS, ...overrides };
    return { get: (action) => bindings[action] };
  }

  it('闪避重绑到 KeyR：按 KeyR 推进，按 KeyQ 不再推进（防卡死）', () => {
    const t = new Tutorial(mkBus(), mkKb({ dodge: 'KeyR' }));
    t.step = 3; t.phase = 'hold'; t.phaseT = 6; t._render();
    keydown('KeyQ');
    expect(t.step).toBe(3);
    keydown('KeyR');
    expect(t.step).toBe(4);
  });

  it('闪避步文案显示当前键 R 而非 Q', () => {
    const t = new Tutorial(mkBus(), mkKb({ dodge: 'KeyR' }));
    t.step = 3; t._render();
    expect(t.el.textContent).toContain('R 键');
    expect(t.el.textContent).not.toContain('Q 键');
  });

  it('处决重绑到 KeyF：按 KeyF 推进', () => {
    const t = new Tutorial(mkBus(), mkKb({ execute: 'KeyF' }));
    t.step = 6; t.phase = 'hold'; t.phaseT = 6; t._render();
    keydown('KeyE');
    expect(t.step).toBe(6);
    keydown('KeyF');
    expect(t.step).toBe(7);
  });

  it('大招重绑到 KeyG：按 KeyG 推进', () => {
    const t = new Tutorial(mkBus(), mkKb({ ultimate: 'KeyG' }));
    t.step = 5; t.phase = 'hold'; t.phaseT = 6; t._render();
    keydown('KeyT');
    expect(t.step).toBe(5);
    keydown('KeyG');
    expect(t.step).toBe(6);
  });

  it('锁定重绑到 KeyL：按 KeyL 推进', () => {
    const t = new Tutorial(mkBus(), mkKb({ lock: 'KeyL' }));
    t.step = 8; t.phase = 'hold'; t.phaseT = 10; t._render();
    keydown('Tab');
    expect(t.step).toBe(8);
    keydown('KeyL');
    expect(t.step).toBe(9);
  });

  it('武器1 重绑到 Digit5：按 Digit5 推进', () => {
    const t = new Tutorial(mkBus(), mkKb({ weapon1: 'Digit5' }));
    t.step = 4; t.phase = 'hold'; t.phaseT = 6; t._render();
    keydown('Digit1');
    expect(t.step).toBe(4);
    keydown('Digit5');
    expect(t.step).toBe(5);
  });

  it('kb=null 时回退默认绑定（不卡死）', () => {
    const t = new Tutorial(mkBus());
    t.step = 3; t.phase = 'hold'; t.phaseT = 6; t._render();
    keydown('KeyQ');
    expect(t.step).toBe(4);
  });

  it('keyLabel 转换：KeyR→R / Digit5→5 / ShiftLeft→Shift / Space→Space', () => {
    const t = new Tutorial(mkBus());
    expect(t.keyLabel('KeyR')).toBe('R');
    expect(t.keyLabel('Digit5')).toBe('5');
    expect(t.keyLabel('ShiftLeft')).toBe('Shift');
    expect(t.keyLabel('Space')).toBe('Space');
  });

  it('移动步文案随重绑变化（forward=KeyP → 文案含 P）', () => {
    const t = new Tutorial(mkBus(), mkKb({ forward: 'KeyP' }));
    t._render();
    expect(t.el.textContent).toContain('P');
  });

  it('默认绑定下移动步文案仍为 WASD', () => {
    const t = new Tutorial(mkBus());
    t._render();
    expect(t.el.textContent).toContain('WASD');
  });
});
