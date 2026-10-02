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
    fillText() {}, font: '', textAlign: '', textBaseline: '',
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
    mm.update(0.07); // 战役一#5：dt 需超过 1/15≈0.067 节流间隔才触发重绘
    expect(ops.some(o => o.op === 'fill' && o.style === '#ff4444')).toBe(true);
  });

  it('可处决敌人额外绘制处决菱形标记', () => {
    const mm = new MiniMap(mkBus());
    mm.setRefs(mkPlayer(), [mkAI({ canBeExecuted: true })], cam);
    mm.update(0.07);
    expect(ops.some(o => o.op === 'stroke' && o.style === '#ffea00')).toBe(true);
  });

  it('非濒死敌人不绘制处决标记', () => {
    const mm = new MiniMap(mkBus());
    mm.setRefs(mkPlayer(), [mkAI()], cam);
    mm.update(0.07);
    expect(ops.some(o => o.op === 'stroke' && o.style === '#ffea00')).toBe(false);
  });
});

describe('MiniMap 色弱模式形状区分', () => {
  it('开启后敌人改用方形绘制', () => {
    const mm = new MiniMap(mkBus());
    mm.setColorblind(true);
    mm.setRefs(mkPlayer(), [mkAI()], cam);
    mm.update(0.07);
    expect(ops.some(o => o.op === 'rect')).toBe(true);
  });

  it('开启后友军仍用圆形绘制', () => {
    const mm = new MiniMap(mkBus());
    mm.setColorblind(true);
    mm.setRefs(mkPlayer(), [mkAI({ team: 0 })], cam);
    mm.update(0.07);
    expect(ops.some(o => o.op === 'arc')).toBe(true);
    expect(ops.some(o => o.op === 'rect')).toBe(false);
  });

  it('关闭时敌人仍用圆形绘制', () => {
    const mm = new MiniMap(mkBus());
    mm.setRefs(mkPlayer(), [mkAI()], cam);
    mm.update(0.07);
    expect(ops.some(o => o.op === 'rect')).toBe(false);
    expect(ops.some(o => o.op === 'arc')).toBe(true);
  });
});

describe('MiniMap 15Hz 节流 (C1-5)', () => {
  it('单帧 dt < 间隔（0.016 < 0.067）不触发重绘', () => {
    const mm = new MiniMap(mkBus());
    mm.setRefs(mkPlayer(), [mkAI()], cam);
    ops.length = 0; // 清空构造时 mkCtx 的副作用
    mm.update(0.016);
    expect(ops.length).toBe(0);
  });

  it('累积 dt 达间隔后触发重绘', () => {
    const mm = new MiniMap(mkBus());
    mm.setRefs(mkPlayer(), [mkAI()], cam);
    ops.length = 0;
    mm.update(0.04); // 累积 0.04 < 0.067，不触发
    expect(ops.length).toBe(0);
    mm.update(0.04); // 累积 0.08 >= 0.067，触发
    expect(ops.some(o => o.op === 'fill' && o.style === '#ff4444')).toBe(true);
  });
});