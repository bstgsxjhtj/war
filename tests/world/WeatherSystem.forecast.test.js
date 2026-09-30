import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeatherSystem } from '../../src/world/WeatherSystem.js';

describe('WeatherSystem forecast', () => {
  let scene, weather;
  beforeEach(() => {
    scene = { add: vi.fn(), fog: null };
    weather = new WeatherSystem(scene, null, null, null);
  });

  it('scheduleNext 设置预报', () => {
    weather.scheduleNext('rain', 10);
    expect(weather.forecast).toEqual({ mode: 'rain', timer: 10 });
  });

  it('scheduleNext 忽略无效模式', () => {
    weather.scheduleNext('foggy', 10);
    expect(weather.forecast).toBeNull();
  });

  it('clearForecast 清除预报', () => {
    weather.scheduleNext('rain', 10);
    weather.clearForecast();
    expect(weather.forecast).toBeNull();
  });

  it('update 倒计时减少但未到零时不切换', () => {
    weather.scheduleNext('night', 5);
    weather.update(2);
    expect(weather.forecast.timer).toBeCloseTo(3);
    expect(weather.mode).toBe('clear');
  });

  it('update 倒计时归零自动切换模式', () => {
    weather.scheduleNext('night', 3);
    weather.update(3.5);
    expect(weather.forecast).toBeNull();
    expect(weather.mode).toBe('night');
  });

  it('enableAutoSchedule 开启后切换模式后自动安排下一次', () => {
    weather.enableAutoSchedule(true);
    weather.scheduleNext('night', 2);
    weather.update(2.5);
    expect(weather.forecast).not.toBeNull();
    expect(weather.forecast.timer).toBeGreaterThan(0);
    expect(weather.mode).toBe('night');
  });

  it('enableAutoSchedule 关闭时切换模式后不自动安排', () => {
    weather.enableAutoSchedule(false);
    weather.scheduleNext('night', 2);
    weather.update(2.5);
    expect(weather.forecast).toBeNull();
    expect(weather.mode).toBe('night');
  });

  it('forecast 初始为 null', () => {
    expect(weather.forecast).toBeNull();
  });

  it('onLightning callback fires with strike position in storm mode', () => {
    let strikePos = null;
    weather.onLightning((pos) => { strikePos = pos; });
    weather.setMode('storm');
    weather.update(0.1);
    expect(strikePos).not.toBeNull();
    expect(strikePos.x).toBeGreaterThanOrEqual(-40);
    expect(strikePos.x).toBeLessThanOrEqual(40);
    expect(strikePos.z).toBeGreaterThanOrEqual(-40);
    expect(strikePos.z).toBeLessThanOrEqual(40);
  });

  it('onLightning does not fire in non-storm mode', () => {
    let called = false;
    weather.onLightning(() => { called = true; });
    weather.setMode('night');
    weather.update(0.1);
    expect(called).toBe(false);
  });

  it('E7: 闪光序列由 dt 状态机驱动（不使用 setTimeout），经历 亮→灭→二次闪→灭 四阶段', () => {
    weather.setMode('storm');
    weather.update(0.01);
    expect(weather._lightning.intensity).toBe(8);
    expect(weather._flashPhase).toBe(0);
    weather.update(0.08);
    expect(weather._flashPhase).toBe(1);
    expect(weather._lightning.intensity).toBe(0);
    weather.update(0.08);
    expect(weather._flashPhase).toBe(2);
    expect(weather._lightning.intensity).toBe(5);
    weather.update(0.08);
    expect(weather._flashPhase).toBe(3);
    expect(weather._lightning.intensity).toBe(0);
    expect(weather._flashTimer).toBe(0);
  });

  it('E7: 天气切换（apply）终止进行中的闪光序列', () => {
    weather.setMode('storm');
    weather.update(0.1);
    expect(weather._flashTimer).toBeGreaterThan(0);
    weather.setMode('clear');
    expect(weather._flashPhase).toBe(0);
    expect(weather._flashTimer).toBe(0);
    expect(weather._lightning.intensity).toBe(0);
  });

  it('E7: 闪光序列中闪电强度通过 update 递减，不残留回调', () => {
    weather.setMode('storm');
    weather.update(0.01);
    expect(weather._lightning.intensity).toBe(8);
    weather.update(0.04);
    expect(weather._lightning.intensity).toBe(8);
    weather.update(0.05);
    expect(weather._lightning.intensity).toBe(0);
  });
});
