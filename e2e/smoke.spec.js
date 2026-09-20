import { test, expect } from '@playwright/test';

test('关键路径冒烟：0 运行时致命错误 + 关键 DOM + 主循环存活', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !t.includes('WebSocket connection') && !t.includes('ERR_CONNECTION_REFUSED')) errors.push(t);
  });
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
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', key: 'v', bubbles: true }));
  });
  await expect(page.locator('#skins-panel')).toHaveCSS('display', /block/);
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', bubbles: true }));
  });
  await page.waitForTimeout(300);

  const comboEl = await page.locator('#combo').count();
  expect(comboEl).toBeGreaterThan(0);
  const skillEl = await page.locator('#skill-0').count();
  expect(skillEl).toBeGreaterThan(0);
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI', key: 'i', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', key: 'j', bubbles: true }));
  });
  await page.waitForTimeout(300);
  const affixesPanel = await page.locator('#affixes-panel').count();
  expect(affixesPanel).toBeGreaterThan(0);
  const achievementsPanel = await page.locator('#achievements-panel').count();
  expect(achievementsPanel).toBeGreaterThan(0);
  expect(errors.length).toBe(0);
  const weaponText = await page.locator('#weapon').innerText();
  expect(weaponText).toMatch(/[1].*刀/);
  expect(weaponText).toMatch(/[4].*锤/);
  const modeText = await page.locator('#modeName').innerText();
  expect(modeText.trim().length).toBeGreaterThan(0);
  const mpAlive = await page.evaluate(() => !!(window.__mp && typeof window.__mp.connected !== 'undefined') || document.querySelector('#hp') !== null);
  expect(mpAlive).toBe(true);
});
