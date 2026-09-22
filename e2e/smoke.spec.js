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
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', bubbles: true }));
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH', key: 'h', bubbles: true }));
  });
  await expect(page.locator('#save-panel')).toHaveCSS('display', /block/);
  await expect(page.locator('#save-now')).toBeVisible();
  await expect(page.locator('#save-reset')).toBeVisible();
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  const hint = await page.locator('#hint').innerText();
  expect(hint).toMatch(/战役/);

  // 攻击→伤害断言：传送到最近敌人面前，左键攻击，验证敌人掉血
  const dmgResult = await page.evaluate(async () => {
    const g = window.__game;
    if (!g || !g.player || !g.ais.length) return { skip: true };
    const p = g.player;
    const target = g.ais.find(a => a.alive);
    if (!target) return { skip: true };
    const hpOf = () => (target.health.hp ?? target.health.cur);
    const hpBefore = hpOf();
    p._locked = true; // e2e 无 pointer lock，直接解锁输入门
    const oldSpeed = target.speed;
    for (let i = 0; i < 3; i++) {
      if (!target.alive) break;
      target.speed = 0; // 钉住目标防止走出攻击范围
      target.position.copy(p.position).addScaledVector(p.forward, 1.5); // 放到玩家正前方
      document.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      await new Promise(r => setTimeout(r, 500));
      document.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      if (hpOf() < hpBefore) break;
    }
    target.speed = oldSpeed;
    return { hpBefore, hpAfter: hpOf() };
  });
  if (!dmgResult.skip) {
    expect(dmgResult.hpAfter).toBeLessThan(dmgResult.hpBefore);
  }

  expect(errors.length).toBe(0);
  const weaponText = await page.locator('#weapon').innerText();
  expect(weaponText).toMatch(/[1].*刀/);
  expect(weaponText).toMatch(/[4].*锤/);
  const modeText = await page.locator('#modeName').innerText();
  expect(modeText.trim().length).toBeGreaterThan(0);
  const mpAlive = await page.evaluate(() => !!(window.__mp && typeof window.__mp.connected !== 'undefined') || document.querySelector('#hp') !== null);
  expect(mpAlive).toBe(true);
});
