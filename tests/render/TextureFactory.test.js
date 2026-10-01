// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { TextureFactory } from '../../src/render/TextureFactory.js';

// jsdom 无 canvas 2d 实现：mock getContext 返回 Proxy 兜底（TextureFactory 构造贴图用）
HTMLCanvasElement.prototype.getContext = function () {
  const self = this;
  return new Proxy({}, {
    get(_, k) {
      if (k === 'canvas') return self;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w || 1, height: h || 1 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: () => {} });
      return () => {};
    }
  });
};

describe('TextureFactory 纹理缓存（C1-8）', () => {
  it('noise 同参数返回同一 CanvasTexture 实例', () => {
    const a = TextureFactory.noise(256, 256, '#4a4a4a', 18, 4);
    const b = TextureFactory.noise(256, 256, '#4a4a4a', 18, 4);
    expect(a).toBe(b);
  });

  it('normal 同参数返回同一实例', () => {
    const a = TextureFactory.normal(256, 256, 0.4);
    const b = TextureFactory.normal(256, 256, 0.4);
    expect(a).toBe(b);
  });

  it('rough 同参数返回同一实例', () => {
    const a = TextureFactory.rough(256, 256, 0.5, 0.3);
    const b = TextureFactory.rough(256, 256, 0.5, 0.3);
    expect(a).toBe(b);
  });

  it('brick 同参数返回同一实例', () => {
    const a = TextureFactory.brick(256, 256);
    const b = TextureFactory.brick(256, 256);
    expect(a).toBe(b);
  });

  it('noise 不同 repeat 返回不同实例', () => {
    const a = TextureFactory.noise(256, 256, '#4a4a4a', 18, 4);
    const b = TextureFactory.noise(256, 256, '#4a4a4a', 18, 1);
    expect(a).not.toBe(b);
  });

  it('noise 不同 base 返回不同实例', () => {
    const a = TextureFactory.noise(256, 256, '#4a4a4a', 18, 4);
    const b = TextureFactory.noise(256, 256, '#3a3a3a', 18, 4);
    expect(a).not.toBe(b);
  });

  it('共享纹理标记 _shared=true', () => {
    const t = TextureFactory.noise(256, 256, '#4a4a4a', 18, 4);
    expect(t._shared).toBe(true);
  });

  it('共享纹理 repeat 正确设置', () => {
    const t = TextureFactory.noise(256, 256, '#4a4a4a', 18, 4);
    expect(t.repeat.x).toBe(4);
    expect(t.repeat.y).toBe(4);
  });

  it('CanvasTexture 包装了 canvas 元素', () => {
    const t = TextureFactory.noise(64, 64, '#aaaaaa', 10, 1);
    expect(t.image).toBeTruthy();
    expect(t.image.width).toBe(64);
    expect(t.image.height).toBe(64);
  });
});
