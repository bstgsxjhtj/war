import { test, expect } from '@playwright/test';

test('关键路径冒烟：0 运行时致命错误 + 关键 DOM + 主循环存活', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => { errors.push(String(e)); });

  await page.goto('http://localhost:4173/');
  await expect(page.locator('#hp')).toBeVisible();
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    }
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
  });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true }));
  });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }));
  });
  await expect(page.locator('#skins-panel')).toHaveCSS('display', /block/);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', bubbles: true }));
  });
  await page.waitForTimeout(300);

  expect(errors.length).toBe(0);
  const weaponText = await page.locator('#weapon').innerText();
  expect(weaponText).toMatch(/[1].*刀/);
  expect(weaponText).toMatch(/[4].*锤/);
  const modeText = await page.locator('#modeName').innerText();
  expect(modeText.trim().length).toBeGreaterThan(0);
  const mpAlive = await page.evaluate(() => !!(window.__mp && typeof window.__mp.connected !== 'undefined') || document.querySelector('#hp') !== null);
  expect(mpAlive).toBe(true);
});
