import { describe, it, expect, beforeEach } from 'vitest';
import { KeyBindings, DEFAULT_BINDINGS } from '../../src/app/KeyBindings.js';

describe('KeyBindings', () => {
  beforeEach(() => { localStorage.clear(); });

  it('默认绑定包含 14 项动作（移动/冲刺/跳跃/闪避/技能/大招/处决/锁定/武器1-4）', () => {
    const kb = new KeyBindings();
    expect(kb.get('forward')).toBe('KeyW');
    expect(kb.get('back')).toBe('KeyS');
    expect(kb.get('left')).toBe('KeyA');
    expect(kb.get('right')).toBe('KeyD');
    expect(kb.get('sprint')).toBe('ShiftLeft');
    expect(kb.get('jump')).toBe('Space');
    expect(kb.get('dodge')).toBe('KeyQ');
    expect(kb.get('skill')).toBe('KeyF');
    expect(kb.get('ultimate')).toBe('KeyT');
    expect(kb.get('execute')).toBe('KeyE');
    expect(kb.get('lock')).toBe('Tab');
    expect(kb.get('weapon1')).toBe('Digit1');
    expect(kb.get('weapon2')).toBe('Digit2');
    expect(kb.get('weapon3')).toBe('Digit3');
    expect(kb.get('weapon4')).toBe('Digit4');
  });

  it('set 重绑单个动作后 get 返回新键码', () => {
    const kb = new KeyBindings();
    kb.set('dodge', 'KeyR');
    expect(kb.get('dodge')).toBe('KeyR');
  });

  it('set 冲突时自动归还旧动作到默认键码', () => {
    const kb = new KeyBindings();
    kb.set('dodge', 'KeyF');
    expect(kb.get('dodge')).toBe('KeyF');
    expect(kb.get('skill')).toBe(DEFAULT_BINDINGS.skill);
  });

  it('set 同一动作自身键码不变不冲突', () => {
    const kb = new KeyBindings();
    kb.set('dodge', 'KeyQ');
    expect(kb.get('dodge')).toBe('KeyQ');
  });

  it('set 后持久化到 localStorage', () => {
    const kb = new KeyBindings();
    kb.set('jump', 'KeyC');
    const saved = JSON.parse(localStorage.getItem('keybindings'));
    expect(saved.jump).toBe('KeyC');
  });

  it('构造时从 localStorage 恢复已保存的绑定', () => {
    localStorage.setItem('keybindings', JSON.stringify({ dodge: 'KeyR', jump: 'KeyC' }));
    const kb = new KeyBindings();
    expect(kb.get('dodge')).toBe('KeyR');
    expect(kb.get('jump')).toBe('KeyC');
    expect(kb.get('forward')).toBe('KeyW');
  });

  it('构造时忽略 localStorage 中未知的动作键', () => {
    localStorage.setItem('keybindings', JSON.stringify({ unknownAction: 'KeyX', dodge: 'KeyR' }));
    const kb = new KeyBindings();
    expect(kb.get('dodge')).toBe('KeyR');
  });

  it('reset 恢复全部默认绑定', () => {
    const kb = new KeyBindings();
    kb.set('dodge', 'KeyR');
    kb.set('jump', 'KeyC');
    kb.reset();
    expect(kb.get('dodge')).toBe('KeyQ');
    expect(kb.get('jump')).toBe('Space');
  });

  it('getAll 返回完整绑定快照（深拷贝，不影响内部状态）', () => {
    const kb = new KeyBindings();
    const all = kb.getAll();
    expect(all.dodge).toBe('KeyQ');
    all.dodge = 'KeyZ';
    expect(kb.get('dodge')).toBe('KeyQ');
  });
});
