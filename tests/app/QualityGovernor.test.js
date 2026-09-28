import { describe, it, expect } from 'vitest';
import { QualityGovernor, QUALITY_STEPS } from '../../src/app/QualityGovernor.js';

describe('QualityGovernor (P2-5)', () => {
  it('导出质量档位顺序 low<mid<high', () => {
    expect(QUALITY_STEPS).toEqual(['low', 'mid', 'high']);
  });

  it('默认 high，且高速帧不降级', () => {
    const g = new QualityGovernor();
    expect(g.quality).toBe('high');
    for (let i = 0; i < 500; i++) expect(g.tick(1 / 60)).toBeNull();
    expect(g.quality).toBe('high');
  });

  it('连续慢帧达到阈值后返回降级档位', () => {
    const g = new QualityGovernor({ quality: 'high', slowFrames: 90 });
    let out = null;
    for (let i = 0; i < 90; i++) out = g.tick(0.05); // 20fps
    expect(out).toBe('mid');
    expect(g.quality).toBe('mid');
  });

  it('未达阈值不降级', () => {
    const g = new QualityGovernor({ quality: 'high', slowFrames: 90 });
    for (let i = 0; i < 89; i++) g.tick(0.05);
    expect(g.quality).toBe('high');
  });

  it('中途恢复快帧会重置慢帧计数', () => {
    const g = new QualityGovernor({ quality: 'high', slowFrames: 90 });
    for (let i = 0; i < 80; i++) g.tick(0.05);
    g.tick(1 / 60);
    for (let i = 0; i < 80; i++) g.tick(0.05);
    expect(g.quality).toBe('high');
  });

  it('冷却期内不连续降级', () => {
    const g = new QualityGovernor({ quality: 'high', slowFrames: 10, cooldownFrames: 50 });
    for (let i = 0; i < 10; i++) g.tick(0.05);
    expect(g.quality).toBe('mid');
    for (let i = 0; i < 40; i++) expect(g.tick(0.05)).toBeNull();
    expect(g.quality).toBe('mid');
  });

  it('冷却结束后可再次降级至 low', () => {
    const g = new QualityGovernor({ quality: 'high', slowFrames: 10, cooldownFrames: 5 });
    for (let i = 0; i < 10; i++) g.tick(0.05);
    expect(g.quality).toBe('mid');
    for (let i = 0; i < 5; i++) g.tick(0.05);
    let out = null;
    for (let i = 0; i < 10; i++) out = g.tick(0.05);
    expect(out).toBe('low');
  });

  it('已是最低档不再降级', () => {
    const g = new QualityGovernor({ quality: 'low', slowFrames: 10, cooldownFrames: 0 });
    for (let i = 0; i < 100; i++) expect(g.tick(0.05)).toBeNull();
    expect(g.quality).toBe('low');
  });

  it('setQuality 手动设置并重置计数', () => {
    const g = new QualityGovernor({ quality: 'high', slowFrames: 10 });
    for (let i = 0; i < 9; i++) g.tick(0.05);
    g.setQuality('mid');
    expect(g.quality).toBe('mid');
    for (let i = 0; i < 9; i++) g.tick(0.05);
    expect(g.quality).toBe('mid');
  });

  it('setQuality 忽略非法档位', () => {
    const g = new QualityGovernor();
    g.setQuality('ultra');
    expect(g.quality).toBe('high');
  });

  it('setEnabled(false) 时不再降级', () => {
    const g = new QualityGovernor({ quality: 'high', slowFrames: 10 });
    g.setEnabled(false);
    for (let i = 0; i < 100; i++) expect(g.tick(0.05)).toBeNull();
    expect(g.quality).toBe('high');
  });
});