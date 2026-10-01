// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Camera } from '../../src/engine/Camera.js';

describe('Camera 缓动 dt 化 (C1-4)', () => {
  it('60fps 单帧 yaw 缓动 = 原固定系数 LERP_LOOK', () => {
    const cam = new Camera(null);
    cam.yaw = 0; cam._targetYaw = 1.0;
    cam.follow({ x: 0, y: 0, z: 0 }, 1 / 60);
    // 1 - pow(1-0.5, 1) = 0.5
    expect(cam.yaw).toBeCloseTo(0.5, 5);
  });

  it('帧率无关：1 帧 30fps ≈ 2 帧 60fps（相同墙上时间）', () => {
    const a = new Camera(null);
    a.yaw = 0; a._targetYaw = 1.0;
    a.follow({ x: 0, y: 0, z: 0 }, 2 / 60); // 1 帧 30fps

    const b = new Camera(null);
    b.yaw = 0; b._targetYaw = 1.0;
    b.follow({ x: 0, y: 0, z: 0 }, 1 / 60);
    b.follow({ x: 0, y: 0, z: 0 }, 1 / 60); // 2 帧 60fps

    expect(a.yaw).toBeCloseTo(b.yaw, 4);
  });

  it('震屏衰减 dt 化：30fps 单帧衰减 = 60fps 两帧衰减', () => {
    const a = new Camera(null);
    a._shake = 0.8;
    a.follow({ x: 0, y: 0, z: 0 }, 2 / 60); // 1 帧 30fps

    const b = new Camera(null);
    b._shake = 0.8;
    b.follow({ x: 0, y: 0, z: 0 }, 1 / 60);
    b.follow({ x: 0, y: 0, z: 0 }, 1 / 60); // 2 帧 60fps

    expect(a._shake).toBeCloseTo(b._shake, 4);
  });

  it('低帧率（30fps）单帧缓动比 60fps 更慢（每帧比例更小）', () => {
    const a = new Camera(null);
    a.yaw = 0; a._targetYaw = 1.0;
    a.follow({ x: 0, y: 0, z: 0 }, 1 / 60);

    const b = new Camera(null);
    b.yaw = 0; b._targetYaw = 1.0;
    b.follow({ x: 0, y: 0, z: 0 }, 2 / 60); // 单帧 30fps

    // 30fps 单帧缓动应比 60fps 单帧更多（补偿低帧率，保持墙上时间一致）
    expect(b.yaw).toBeGreaterThan(a.yaw);
  });
});
