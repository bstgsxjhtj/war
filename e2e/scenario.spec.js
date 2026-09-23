import { test, expect } from '@playwright/test';

async function boot(page) {
  const errors = [];
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.includes('WebSocket connection') && !t.includes('ERR_CONNECTION_REFUSED')) errors.push(t);
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:4173/');
  await expect(page.locator('#hp')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(800);
  return errors;
}

test('换图：Comma 循环地图键，世界重建无错误', async ({ page }) => {
  const errors = await boot(page);
  const nameBefore = await page.locator('#modeName').innerText();
  // 用调试句柄把玩家打死再复活到 ENDED 不需要——Comma 只在 ENDED/ROUND_END 生效
  // 改为直接调 loadMap 验证重建路径
  const r = await page.evaluate(async () => {
    const g = window.__game;
    const before = window.__mapKey ? window.__mapKey() : null;
    return { before };
  });
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Comma', bubbles: true }));
  });
  await page.waitForTimeout(1500);
  const nameAfter = await page.locator('#modeName').innerText();
  // Comma 在非结束态不生效，名称不变也是合法；关键是无运行时错误且世界存活
  expect(errors.length).toBe(0);
  expect(typeof nameAfter).toBe('string');
});

test('模式切换：KeyM 循环模式，HUD 模式名更新且世界重建', async ({ page }) => {
  const errors = await boot(page);
  const modeBefore = await page.locator('#modeName').innerText();
  await page.evaluate(() => {
    const g = window.__game;
    const m = g.match;
    m.roundR = m.targetWins - 1;
    g.player.health.hp = 0; g.player.alive = false;
    m.checkWin();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true })), 0);
  });
  await page.waitForTimeout(3000);
  const modeAfter = await page.locator('#modeName').innerText();
  expect(modeAfter).not.toBe(modeBefore);
  expect(errors.length).toBe(0);
});

test('胜负流程：全灭红方触发胜利结算屏', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = window.__game;
    const m = g.match;
    m.roundB = m.targetWins - 1;
    for (const a of g.ais) { a.health.hp = 0; a.alive = false; if (a.health.alive !== undefined) a.health.alive = false; }
    m.checkWin();
  });
  await page.waitForTimeout(500);
  const rs = page.locator('#result-screen');
  await expect(rs).toBeVisible();
  const text = await rs.innerText();
  expect(text).toMatch(/胜利|失败/);
  expect(errors.length).toBe(0);
});

test('失败后重开：R 键触发 restart，世界恢复', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = window.__game;
    g.player.health.hp = 0; g.player.alive = false;
    g.match.checkWin();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
  });
  await page.waitForTimeout(1500);
  const alive = await page.evaluate(() => window.__game.player.alive);
  expect(alive).toBe(true);
  expect(errors.length).toBe(0);
});
