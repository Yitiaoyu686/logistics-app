/**
 * One final pass: capture create form in a tall viewport, detail sections, shipping label, edit/cancel modals
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:5173';
const DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/oms-deep';
fs.mkdirSync(DIR, { recursive: true });

let n = 100;
async function s(p, name) {
  n++;
  await p.screenshot({
    path: path.join(DIR, `${String(n).padStart(2, '0')}-${name.replace(/[/\s:]/g, '-')}.png`),
    fullPage: false
  });
  console.log(`  [${n}] ${name}`);
}

(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  p.setDefaultTimeout(15000);

  try {
    // Login
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2000);

    if (await p.locator('input[placeholder="用户名"]').count() > 0) {
      await p.locator('input[placeholder="用户名"]').fill('sales1');
      await p.locator('input[placeholder="密码"]').fill('123456');
      await p.locator('button[type="submit"]').click();
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(2500);
    }

    // Nav to OMS
    await p.locator('.ant-menu-item').filter({ hasText: '订单中心' }).first().click({ force: true });
    await p.waitForTimeout(2500);
    await p.waitForSelector('.ant-table', { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(1000);

    // ============================================================
    // 1. ORDER LIST - high quality full page
    // ============================================================
    await s(p, '01-order-list');

    // ============================================================
    // 2. CREATE ORDER - make viewport taller
    // ============================================================
    console.log('=== CREATE ORDER ===');
    await p.setViewportSize({ width: 1440, height: 2000 });
    await p.waitForTimeout(300);

    await p.locator('button:has-text("新建订单")').first().click({ force: true, timeout: 8000 });
    await p.waitForSelector('.ant-modal-body', { timeout: 8000 });
    await p.waitForTimeout(2000);

    // Screenshot with tall viewport to capture everything
    await s(p, '02-create-form-full');

    // Reset viewport
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.waitForTimeout(300);

    // Close modal
    await p.locator('.ant-modal-close').first().click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1500);

    // ============================================================
    // 3. ORDER DETAIL - section by section via anchor
    // ============================================================
    console.log('=== ORDER DETAIL ===');
    await p.locator('button:has-text("详情")').first().click({ force: true, timeout: 8000 });
    await p.waitForSelector('.ant-drawer-body', { timeout: 8000 });
    await p.waitForTimeout(2000);

    // Use taller viewport for drawer
    await p.setViewportSize({ width: 1440, height: 1200 });
    await p.waitForTimeout(300);

    const anchors = p.locator('.ant-anchor-link-title');
    const ac = await anchors.count();
    for (let i = 0; i < Math.min(ac, 9); i++) {
      const text = await anchors.nth(i).textContent().catch(() => `sec-${i}`);
      await anchors.nth(i).click({ force: true });
      await p.waitForTimeout(700);
      await s(p, `05-detail-${i}-${text}`);
    }

    await p.setViewportSize({ width: 1440, height: 900 });
    await p.waitForTimeout(300);

    // Print label
    await p.locator('button:has-text("打印面单")').first().click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1500);
    await s(p, '06-shipping-label');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);

    // Freight rates
    await p.locator('button:has-text("运价列表")').first().click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1500);
    await s(p, '07-freight-rates');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(500);

    // Close drawer
    await p.locator('.ant-drawer-close').first().click({ force: true, timeout: 5000 });
    await p.waitForTimeout(1500);

    // ============================================================
    // 4. CANCEL ORDER MODAL
    // ============================================================
    console.log('=== CANCEL ORDER ===');
    const cancelBtn = p.locator('button:has-text("取消订单")').first();
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click({ force: true, timeout: 5000 });
      await p.waitForTimeout(1500);
      await s(p, '08-cancel-order');
      await p.keyboard.press('Escape');
      await p.waitForTimeout(500);
    }

    // ============================================================
    // 5. EDIT MODAL
    // ============================================================
    console.log('=== EDIT ORDER ===');
    const editBtn = p.locator('button:has-text("编辑")').first();
    if (await editBtn.count() > 0) {
      await editBtn.click({ force: true, timeout: 5000 });
      await p.waitForTimeout(2000);
      await s(p, '09-edit-modal');
      await p.keyboard.press('Escape');
      await p.waitForTimeout(500);
    }

    // Final
    await s(p, '10-final');

    console.log(`\n=== DONE: ${n - 99} screenshots ===`);
    console.log(`Saved to: ${DIR}`);
  } catch (e) {
    console.error('FATAL:', e.message);
    await s(p, 'FATAL-ERROR');
  } finally {
    await b.close();
  }
})();
