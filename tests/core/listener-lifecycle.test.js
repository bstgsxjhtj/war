import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EventBus } from '../../src/core/EventBus.js';

const MAIN_ENTRY_SRC = readFileSync(resolve(process.cwd(), 'src/main_entry.js'), 'utf8');

// 提取 main_entry.js 中某函数体（大括号匹配），用于架构守卫
function extractFunctionBody(src, fnName) {
  const startIdx = src.indexOf('function ' + fnName + '(');
  if (startIdx < 0) return null;
  const braceStart = src.indexOf('{', startIdx);
  let depth = 0, end = -1;
  for (let i = braceStart; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  return end > 0 ? src.slice(braceStart, end + 1) : null;
}

describe('监听器生命周期（架构债 #5 回归守卫）', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  it('EventBus.on 返回的 off 能移除该处理器（不再被触发）', () => {
    const calls = [];
    const off = bus.on('test.evt', (p) => calls.push(p));
    bus.emit('test.evt', 1);
    expect(calls).toEqual([1]);
    off();
    bus.emit('test.evt', 2);
    expect(calls).toEqual([1]);
  });

  it('同一事件多处理器：off 只移除目标，其余仍触发', () => {
    const a = [], b = [];
    const offA = bus.on('e', (p) => a.push(p));
    bus.on('e', (p) => b.push(p));
    bus.emit('e', 'x');
    expect(a).toEqual(['x']); expect(b).toEqual(['x']);
    offA();
    bus.emit('e', 'y');
    expect(a).toEqual(['x']); expect(b).toEqual(['x', 'y']);
  });

  it('spawnAll 函数体内不得注册 bus 监听（架构债 #5：spawnAll 内禁止注册常驻监听）', () => {
    const body = extractFunctionBody(MAIN_ENTRY_SRC, 'spawnAll');
    expect(body, 'spawnAll 函数体应存在').not.toBeNull();
    expect(body).not.toMatch(/bus\.on\s*\(/);
  });

  it('spawnRed 函数体内不得注册 bus 监听', () => {
    const body = extractFunctionBody(MAIN_ENTRY_SRC, 'spawnRed');
    expect(body, 'spawnRed 函数体应存在').not.toBeNull();
    expect(body).not.toMatch(/bus\.on\s*\(/);
  });
});
