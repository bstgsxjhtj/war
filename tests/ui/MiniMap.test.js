// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MiniMap } from '../../src/ui/MiniMap.js';

let ops;
function mkCtx() {
  ops = [];
  const ctx = {
    clearRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clip() {},
    beginPath() {}, arc() { ops.push({ op: 'arc' }); },
    fill() { ops.push({ op: 'fill', style: ctx.fillStyle }); },
    stroke() { ops.push({ op: 'stroke', style: ctx.strokeStyle }); },
    moveTo() {}, lineTo() {}, closePath() {}, fillRect() { ops.push({ op: 'fillRect' }); },
    rect() { ops.push({ op: 'rect' }); },
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
  };
  return ctx;
}

beforeEach(() => {
  document.body.innerHTML = '';
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mkCtx());
});

function mkBus() { return { on: vi.fn(() => () => {}), emit: vi.fn() }; }
const cam = { yaw: 0 };
function mkPlayer() { return { root: { position: { x: 0, z: 0 }, rotation: { y: 0 } }, yaw: 0 }; }
function mkAI(over = {}) {
  return { team: 1, root: { position: { x: 4, z: 4 }, rotation: { y: 0 }, visible: true }, ...over };
}

describe('MiniMap 濒死敌人标记', () => {
  it('绘制敌方圆点', () => {
    const mm = new MiniMap(mkBus());
    mm.setRefs(mkPlayer(), [mkAI()], cam);
    mm.update(0.016);
    expect(ops.some(o => o.op === 'fill' && o.style === '#ff4444')).toBe(true);
  });

  it('可处决敌人额外绘制处决菱形标记', () => {
    const mm = new MiniMap(mkBus());
    mm.setRefs(mkPlayer(), [mkAI({ canBeExecuted: true })], cam);
    mm.update(0.016);
    expect(ops.some(o => o.op === 'stroke' && o.style === '#ffea00')).toBe(true);
  });

  it('非濒死敌人不绘制处决标记', () => {
    const mm = new MiniMap(mkBus());
    mm.setRefs(mkPlayer(), [mkAI()], cam);
    mm.update(0.016);
    expect(ops.some(o => o.op === 'stroke' && o.style === '#ffea00')).toBe(false);
  });
});

describe('MiniMap 色弱模式形状区分', () => {
  it('开启后敌人改用方形绘制', () => {
    const mm = new MiniMap(mkBus());
    mm.setColorblind(true);
    mm.setRefs(mkPlayer(), [mkAI()], cam);
    mm.update(0.016);
    expect(ops.some(o => o.op === 'rect')).toBe(true);
  });

  it('开启后友军仍用圆形绘制', () => {
    const mm = new MiniMap(mkBus());
    mm.setColorblind(true);
    mm.setRefs(mkPlayer(), [mkAI({ team: 0 })], cam);
    mm.update(0.016);
    expect(ops.some(o => o.op === 'arc')).toBe(true);
    expect(ops.some(o => o.op === 'rect')).toBe(false);
  });

  it('关闭时敌人仍用圆形绘制', () => {
    const mm = new MiniMap(mkBus());
    mm.setRefs(mkPlayer(), [mkAI()], cam);
    mm.update(0.016);
    expect(ops.some(o => o.op === 'rect')).toBe(false);
    expect(ops.some(o => o.op === 'arc')).toBe(true);
  });
});