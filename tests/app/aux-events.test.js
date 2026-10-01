import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MAIN_ENTRY_SRC = readFileSync(resolve(process.cwd(), 'src/main_entry.js'), 'utf8');

// C2-17：辅助系统（MiniMapPing / FullMapPanel / NotificationSystem）此前监听了 map.ping / ui.notify
// 但全仓无任何生产者 → 三项能力均为死功能。此守卫确保组合根持续提供生产者，防止回归。
describe('辅助系统事件生产者（C2-17 回归守卫）', () => {
  it('main_entry 必须发射 EV.MAP_PING（否则小地图/全图标记为死功能）', () => {
    expect(MAIN_ENTRY_SRC).toMatch(/emit\(\s*EV\.MAP_PING/);
  });

  it('main_entry 必须发射 EV.UI_NOTIFY（否则分级通知为死功能）', () => {
    expect(MAIN_ENTRY_SRC).toMatch(/emit\(\s*EV\.UI_NOTIFY/);
  });

  it('pingMap 辅助函数向 MAP_PING 广播 x/z/type 载荷', () => {
    expect(MAIN_ENTRY_SRC).toMatch(/function\s+pingMap\s*\(/);
    expect(MAIN_ENTRY_SRC).toMatch(/bus\.emit\(\s*EV\.MAP_PING\s*,\s*\{\s*x:\s*pos\.x,\s*z:\s*pos\.z,\s*type\s*\}/);
  });

  it('Boss 生成/召唤路径调用 pingMap 打目标点', () => {
    const calls = MAIN_ENTRY_SRC.match(/pingMap\s*\(/g) || [];
    // 定义 1 次 + 至少 3 处调用（Boss 召唤、波次 Boss、投石机占领）
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  it('C2-18/C2-19：组合根向设置面板注入 tooltip/accessibility', () => {
    expect(MAIN_ENTRY_SRC).toMatch(/settings\.attachAux\(\s*\{\s*tooltip\s*,\s*accessibility\s*\}/);
  });
});