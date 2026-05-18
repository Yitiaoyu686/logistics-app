// WAREHOUSE_US (到达国仓管) E2E Test Script
// Run: node e2e/app-warehouse-us-test.mjs

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/app-warehouse-us';
const APP_URL = 'http://localhost:4003';
const VIEWPORT = { width: 390, height: 844 };
const LOG_TIMEOUT = 30_000;

// Ensure screenshot directory exists
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let step = 0;
function sshot(name) {
  step++;
  const filename = `${String(step).padStart(2, '0')}-${name}.png`;
  return { filename, fullPath: path.join(SCREENSHOT_DIR, filename) };
}

async function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const results = [];

  try {
    // ========================================================================
    // STEP 1: Login as warehouse_us1
    // ========================================================================
    log('=== STEP 1: Login as warehouse_us1 ===');
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: LOG_TIMEOUT });
    await page.waitForSelector('input[placeholder="用户名"]', { timeout: LOG_TIMEOUT });

    // Fill login form
    await page.fill('input[placeholder="用户名"]', 'warehouse_us1');
    await page.fill('input[placeholder="密码"]', '123456');

    // Take screenshot before login
    const s1 = sshot('login-form');
    await page.screenshot({ path: s1.fullPath, fullPage: false });
    results.push({ step: 1, description: 'Login form filled', screenshot: s1.filename });

    // Click login button
    await page.click('text=登 录');

    // Wait for navigation to tab page
    await page.waitForTimeout(3000);

    // ========================================================================
    // STEP 2: Screenshot the main page with tabs visible
    // ========================================================================
    log('=== STEP 2: Main page with tabs ===');
    const s2 = sshot('main-tabs-overview');
    await page.screenshot({ path: s2.fullPath, fullPage: false });
    results.push({ step: 2, description: 'Main page with all tabs visible', screenshot: s2.filename });

    // ========================================================================
    // STEP 3: List all visible bottom tabs
    // ========================================================================
    log('=== STEP 3: List all bottom tabs ===');
    // The tabs are rendered as tab bar items. Try to find them.
    const tabTexts = await page.evaluate(() => {
      const tabs = [];
      // Expo Router uses a custom tab bar - look for text elements near bottom
      const allTextElements = document.querySelectorAll('div[role="tablist"] a, nav[role="navigation"] a, [data-tab]');
      allTextElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text) tabs.push(text);
      });
      if (tabs.length === 0) {
        // Fallback: look for text nodes in the tab bar area
        const body = document.body.innerText;
        return body.split('\n').filter(l => l.match(/^(任务|办理|消息|我的|扫码|客户|工具)$/));
      }
      return tabs;
    });
    log(`Tab texts found: ${JSON.stringify(tabTexts)}`);
    results.push({ step: 3, description: 'Bottom tabs', data: tabTexts });

    // Also try to find tabs by common identifiers
    const tabLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        const text = a.textContent?.trim();
        if (href && text && text.length < 10) {
          links.push({ href, text });
        }
      });
      return links;
    });
    log(`Tab links: ${JSON.stringify(tabLinks)}`);

    // ========================================================================
    // STEP 4a: 任务 (Tasks) tab
    // ========================================================================
    log('=== STEP 4a: 任务 (Tasks) tab ===');
    // Click on 任务 tab
    const tasksTab = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '任务' }).first();
    if (await tasksTab.isVisible()) {
      await tasksTab.click();
    }
    await page.waitForTimeout(2000);

    const s3 = sshot('tasks-tab');
    await page.screenshot({ path: s3.fullPath, fullPage: false });
    results.push({ step: '4a', description: 'Tasks tab', screenshot: s3.filename });

    // Get filter tabs and task items
    const tasksPageInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      // Get first 80 lines
      const lines = bodyText.split('\n').slice(0, 80);
      // Find task-related elements
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], div[role="tab"], a'))
        .map(el => el.textContent?.trim())
        .filter(t => t && t.length > 0 && t.length < 30);
      return { lines, buttons };
    });
    log(`Tasks page buttons: ${JSON.stringify(tasksPageInfo.buttons)}`);
    log(`Tasks page first lines: ${JSON.stringify(tasksPageInfo.lines.slice(0, 40))}`);
    results.push({ step: '4a-data', description: 'Tasks page content', data: tasksPageInfo.lines.slice(0, 40), buttons: tasksPageInfo.buttons });

    // ========================================================================
    // STEP 4b: 办理 (Operations) tab
    // ========================================================================
    log('=== STEP 4b: 办理 (Operations) tab ===');
    const opsTab = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '办理' }).first();
    if (await opsTab.isVisible()) {
      await opsTab.click();
    }
    await page.waitForTimeout(3000);

    const s4 = sshot('operations-tab');
    await page.screenshot({ path: s4.fullPath, fullPage: false });
    results.push({ step: '4b', description: 'Operations tab (办理)', screenshot: s4.filename });

    // Get module grid entries
    const opsPageInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
      return lines.slice(0, 60);
    });
    log(`Operations page: ${JSON.stringify(opsPageInfo)}`);
    results.push({ step: '4b-data', description: 'Operations page content', data: opsPageInfo });

    // ========================================================================
    // STEP 4b-1: 到仓入库 → dest-inbound-list
    // ========================================================================
    log('=== STEP 4b-1: 到仓入库 → dest-inbound-list ===');
    try {
      const destInboundBtn = await page.locator('text=到仓入库').first();
      if (await destInboundBtn.isVisible({ timeout: 3000 })) {
        await destInboundBtn.click();
        await page.waitForTimeout(3000);

        const s5 = sshot('dest-inbound-list');
        await page.screenshot({ path: s5.fullPath, fullPage: false });
        results.push({ step: '4b-1', description: '到仓入库 list', screenshot: s5.filename });

        // Check JOB/DPN sub-tabs
        const inboundInfo = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
          const tabs = lines.filter(l => l.match(/^(JOB|DPN|全部|待处理|处理中|已完成)/));
          return { tabs, pageLines: lines.slice(0, 30) };
        });
        log(`到仓入库 tabs: ${JSON.stringify(inboundInfo.tabs)}`);
        results.push({ step: '4b-1-data', description: '到仓入库 sub-tabs', data: inboundInfo });

        // Tap a JOB row if available
        try {
          const jobRow = await page.locator('[data-testid="job-row"], .job-item, .list-item, [class*="card"]').first();
          if (await jobRow.isVisible({ timeout: 2000 })) {
            await jobRow.click();
            await page.waitForTimeout(2000);
            const s6 = sshot('dest-inbound-job-detail');
            await page.screenshot({ path: s6.fullPath, fullPage: false });
            results.push({ step: '4b-1-detail', description: '到仓入库 JOB detail/scan screen', screenshot: s6.filename });

            const detailInfo = await page.evaluate(() => {
              const bodyText = document.body.innerText;
              return bodyText.split('\n').filter(l => l.trim().length > 0).slice(0, 30);
            });
            results.push({ step: '4b-1-detail-data', description: 'JOB detail content', data: detailInfo });

            // Go back
            await page.goBack({ timeout: 5000 }).catch(() => page.goto(APP_URL + '/(tabs)/search'));
            await page.waitForTimeout(2000);
          }
        } catch (e) {
          log(`No JOB row found: ${e.message}`);
        }
      }
    } catch (e) {
      log(`到仓入库 not found/clickable: ${e.message}`);
    }

    // Navigate back to 办理 tab if we navigated away
    const opsTab2 = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '办理' }).first();
    if (await opsTab2.isVisible().catch(() => false)) {
      await opsTab2.click();
      await page.waitForTimeout(2000);
    }

    // ========================================================================
    // STEP 4b-2: DPN 管理 → dpn-list
    // ========================================================================
    log('=== STEP 4b-2: DPN 管理 ===');
    try {
      // First navigate to 办理 tab
      const opsTab3 = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '办理' }).first();
      await opsTab3.click();
      await page.waitForTimeout(2000);

      const dpnBtn = await page.locator('text=DPN 管理').first();
      if (await dpnBtn.isVisible({ timeout: 3000 })) {
        await dpnBtn.click();
        await page.waitForTimeout(3000);

        const s7 = sshot('dpn-list');
        await page.screenshot({ path: s7.fullPath, fullPage: false });
        results.push({ step: '4b-2', description: 'DPN list', screenshot: s7.filename });

        const dpnInfo = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
          return lines.slice(0, 30);
        });
        results.push({ step: '4b-2-data', description: 'DPN list content', data: dpnInfo });

        // Tap 新建 (Create button)
        try {
          const newBtn = await page.locator('text=新建, button:has-text("新建"), button:has-text("创建"), text=添加').first();
          if (await newBtn.isVisible({ timeout: 2000 })) {
            await newBtn.click();
            await page.waitForTimeout(2000);
            const s8 = sshot('dpn-create-form');
            await page.screenshot({ path: s8.fullPath, fullPage: false });
            results.push({ step: '4b-2-create', description: 'DPN create form', screenshot: s8.filename });

            // Go back
            await page.goBack({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(2000);
          }
        } catch (e) {
          log(`No DPN create button: ${e.message}`);
        }

        // Tap a DPN row for detail
        try {
          const dpnRow = await page.locator('.list-item, [class*="card"], [class*="row"]').first();
          if (await dpnRow.isVisible({ timeout: 2000 })) {
            await dpnRow.click();
            await page.waitForTimeout(2000);
            const s9 = sshot('dpn-detail');
            await page.screenshot({ path: s9.fullPath, fullPage: false });
            results.push({ step: '4b-2-detail', description: 'DPN detail', screenshot: s9.filename });

            // Check lifecycle modes (bind/dispatch/arrive/receive)
            const dpnDetailInfo = await page.evaluate(() => {
              const bodyText = document.body.innerText;
              const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
              const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'))
                .map(el => el.textContent?.trim())
                .filter(t => t && t.length > 0 && t.length < 30);
              return { lines: lines.slice(0, 30), buttons };
            });
            results.push({ step: '4b-2-detail-data', description: 'DPN detail content and actions', data: dpnDetailInfo });

            // Go back
            await page.goBack({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(2000);
          }
        } catch (e) {
          log(`No DPN row found: ${e.message}`);
        }
      }
    } catch (e) {
      log(`DPN管理 not found/clickable: ${e.message}`);
    }

    // ========================================================================
    // STEP 4b-3: 库存查询 → stock with destination=1
    // ========================================================================
    log('=== STEP 4b-3: 库存查询 ===');
    try {
      // Navigate back to 办理 tab
      const opsTab4 = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '办理' }).first();
      await opsTab4.click();
      await page.waitForTimeout(2000);

      const stockBtn = await page.locator('text=库存查询').first();
      if (await stockBtn.isVisible({ timeout: 3000 })) {
        await stockBtn.click();
        await page.waitForTimeout(3000);

        const s10 = sshot('stock-query');
        await page.screenshot({ path: s10.fullPath, fullPage: false });
        results.push({ step: '4b-3', description: '库存查询', screenshot: s10.filename });

        // Check for cascading filters (country/city/site)
        const stockInfo = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
          const inputs = Array.from(document.querySelectorAll('input, select, [class*="picker"], [class*="select"], [class*="dropdown"]'))
            .map(el => ({
              placeholder: el.getAttribute('placeholder'),
              text: el.textContent?.trim().slice(0, 30),
              tag: el.tagName,
            }));
          return { lines: lines.slice(0, 30), inputs };
        });
        results.push({ step: '4b-3-data', description: '库存查询 filters', data: stockInfo });
      }
    } catch (e) {
      log(`库存查询 not found/clickable: ${e.message}`);
    }

    // ========================================================================
    // STEP 4b-4: 配送管理 → delivery-list
    // ========================================================================
    log('=== STEP 4b-4: 配送管理 ===');
    try {
      // Navigate back to 办理 tab
      const opsTab5 = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '办理' }).first();
      await opsTab5.click();
      await page.waitForTimeout(2000);

      const deliveryBtn = await page.locator('text=配送管理').first();
      if (await deliveryBtn.isVisible({ timeout: 3000 })) {
        await deliveryBtn.click();
        await page.waitForTimeout(3000);

        const s11 = sshot('delivery-list');
        await page.screenshot({ path: s11.fullPath, fullPage: false });
        results.push({ step: '4b-4', description: '配送管理 list', screenshot: s11.filename });

        const deliveryInfo = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
          const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'))
            .map(el => el.textContent?.trim())
            .filter(t => t && t.length > 0 && t.length < 30);
          return { lines: lines.slice(0, 30), buttons };
        });
        results.push({ step: '4b-4-data', description: '配送管理 content', data: deliveryInfo });

        // Tap 新建 if available
        try {
          const newBtn = await page.locator('text=新建, button:has-text("新建"), button:has-text("创建")').first();
          if (await newBtn.isVisible({ timeout: 2000 })) {
            await newBtn.click();
            await page.waitForTimeout(2000);
            const s12 = sshot('delivery-create');
            await page.screenshot({ path: s12.fullPath, fullPage: false });
            results.push({ step: '4b-4-create', description: '配送管理 create form', screenshot: s12.filename });
            await page.goBack({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(2000);
          }
        } catch (e) {
          log(`No delivery create button: ${e.message}`);
        }

        // Tap a delivery row for detail (check sign/fail modes)
        try {
          const deliveryRow = await page.locator('.list-item, [class*="card"], [class*="row"]').first();
          if (await deliveryRow.isVisible({ timeout: 2000 })) {
            await deliveryRow.click();
            await page.waitForTimeout(2000);
            const s13 = sshot('delivery-detail');
            await page.screenshot({ path: s13.fullPath, fullPage: false });
            results.push({ step: '4b-4-detail', description: '配送任务 detail (check sign/fail)', screenshot: s13.filename });

            const deliveryDetail = await page.evaluate(() => {
              const bodyText = document.body.innerText;
              const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
              const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'))
                .map(el => el.textContent?.trim())
                .filter(t => t && t.length > 0 && t.length < 30);
              return { lines: lines.slice(0, 30), buttons };
            });
            results.push({ step: '4b-4-detail-data', description: '配送 detail actions (sign/fail)', data: deliveryDetail });
          }
        } catch (e) {
          log(`No delivery row found: ${e.message}`);
        }
      }
    } catch (e) {
      log(`配送管理 not found/clickable: ${e.message}`);
    }

    // ========================================================================
    // STEP 4b-5: 自提管理 → pickup-list
    // ========================================================================
    log('=== STEP 4b-5: 自提管理 ===');
    try {
      // Navigate back to 办理 tab
      const opsTab6 = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '办理' }).first();
      await opsTab6.click();
      await page.waitForTimeout(2000);

      const pickupBtn = await page.locator('text=自提管理').first();
      if (await pickupBtn.isVisible({ timeout: 3000 })) {
        await pickupBtn.click();
        await page.waitForTimeout(3000);

        const s14 = sshot('pickup-list');
        await page.screenshot({ path: s14.fullPath, fullPage: false });
        results.push({ step: '4b-5', description: '自提管理 list', screenshot: s14.filename });

        const pickupInfo = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
          return lines.slice(0, 30);
        });
        results.push({ step: '4b-5-data', description: '自提管理 content', data: pickupInfo });

        // Tap a pickup item for notify/verify actions
        try {
          const pickupRow = await page.locator('.list-item, [class*="card"], [class*="row"]').first();
          if (await pickupRow.isVisible({ timeout: 2000 })) {
            await pickupRow.click();
            await page.waitForTimeout(2000);
            const s15 = sshot('pickup-detail');
            await page.screenshot({ path: s15.fullPath, fullPage: false });
            results.push({ step: '4b-5-detail', description: '自提 detail (notify/verify)', screenshot: s15.filename });

            const pickupDetail = await page.evaluate(() => {
              const bodyText = document.body.innerText;
              const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
              const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'))
                .map(el => el.textContent?.trim())
                .filter(t => t && t.length > 0 && t.length < 30);
              return { lines: lines.slice(0, 30), buttons };
            });
            results.push({ step: '4b-5-detail-data', description: '自提 detail actions (notify/verify)', data: pickupDetail });
          }
        } catch (e) {
          log(`No pickup row found: ${e.message}`);
        }
      }
    } catch (e) {
      log(`自提管理 not found/clickable: ${e.message}`);
    }

    // ========================================================================
    // STEP 4b-6: 订单查询 → order
    // ========================================================================
    log('=== STEP 4b-6: 订单查询 ===');
    try {
      const opsTab7 = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '办理' }).first();
      await opsTab7.click();
      await page.waitForTimeout(2000);

      const orderBtn = await page.locator('text=订单查询').first();
      if (await orderBtn.isVisible({ timeout: 3000 })) {
        await orderBtn.click();
        await page.waitForTimeout(3000);

        const s16 = sshot('order-query');
        await page.screenshot({ path: s16.fullPath, fullPage: false });
        results.push({ step: '4b-6', description: '订单查询', screenshot: s16.filename });

        const orderInfo = await page.evaluate(() => {
          const bodyText = document.body.innerText;
          const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
          return lines.slice(0, 20);
        });
        results.push({ step: '4b-6-data', description: '订单查询 content', data: orderInfo });
      }
    } catch (e) {
      log(`订单查询 not found/clickable: ${e.message}`);
    }

    // ========================================================================
    // STEP 4c: 扫码 (Scan) tab
    // ========================================================================
    log('=== STEP 4c: 扫码 (Scan) tab ===');
    const scanTab = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '' }).first();
    // Scan tab is the center button - try clicking it via its position or the tab bar
    const scanClicked = await page.evaluate(() => {
      // Find the center large scan button in the tab bar
      const scanBtns = document.querySelectorAll('[class*="scan"], [class*="Scan"]');
      const allBtns = document.querySelectorAll('a, button');
      for (const btn of allBtns) {
        const text = btn.textContent?.trim();
        const href = btn.getAttribute('href');
        if (href && href.includes('scan')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (!scanClicked) {
      // Try navigating directly
      await page.goto(APP_URL + '/(tabs)/scan', { waitUntil: 'networkidle', timeout: LOG_TIMEOUT }).catch(() => {});
    }
    await page.waitForTimeout(2000);

    const s17 = sshot('scan-tab');
    await page.screenshot({ path: s17.fullPath, fullPage: false });
    results.push({ step: '4c', description: 'Scan tab (扫码)', screenshot: s17.filename });

    const scanInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'))
        .map(el => el.textContent?.trim())
        .filter(t => t && t.length > 0 && t.length < 40);
      return { lines: lines.slice(0, 30), buttons };
    });
    results.push({ step: '4c-data', description: 'Scan page content', data: scanInfo });

    // ========================================================================
    // STEP 4d: 消息 (Messages) tab
    // ========================================================================
    log('=== STEP 4d: 消息 (Messages) tab ===');
    const msgTab = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '消息' }).first();
    if (await msgTab.isVisible()) {
      await msgTab.click();
    }
    await page.waitForTimeout(2000);

    const s18 = sshot('messages-tab');
    await page.screenshot({ path: s18.fullPath, fullPage: false });
    results.push({ step: '4d', description: 'Messages tab (消息)', screenshot: s18.filename });

    const msgInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
      return lines.slice(0, 20);
    });
    results.push({ step: '4d-data', description: 'Messages content', data: msgInfo });

    // ========================================================================
    // STEP 4e: 我的 (Profile) tab
    // ========================================================================
    log('=== STEP 4e: 我的 (Profile) tab ===');
    const profileTab = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '我的' }).first();
    if (await profileTab.isVisible()) {
      await profileTab.click();
    }
    await page.waitForTimeout(2000);

    const s19 = sshot('profile-tab');
    await page.screenshot({ path: s19.fullPath, fullPage: false });
    results.push({ step: '4e', description: 'Profile tab (我的)', screenshot: s19.filename });

    const profileInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'))
        .map(el => el.textContent?.trim())
        .filter(t => t && t.length > 0 && t.length < 40);
      return { lines: lines.slice(0, 30), buttons };
    });
    results.push({ step: '4e-data', description: 'Profile content', data: profileInfo });

    // ========================================================================
    // STEP 9: Check for "功能开发中" placeholders
    // ========================================================================
    log('=== STEP 9: Check for placeholders ===');
    const placeholders = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const matches = bodyText.match(/功能开发中|建设中|development/i);
      return matches || 'NONE';
    });
    log(`Placeholders found: ${placeholders}`);
    results.push({ step: 9, description: 'Placeholder check', data: placeholders });

    // ========================================================================
    // STEP 10: Check for 调拨 management at destination side
    // ========================================================================
    log('=== STEP 10: Check for 调拨 at destination side ===');
    // Navigate to 办理 tab
    const opsTab8 = await page.locator('a, button, div[role="tab"], [data-tab]').filter({ hasText: '办理' }).first();
    if (await opsTab8.isVisible()) {
      await opsTab8.click();
      await page.waitForTimeout(2000);
    }

    const hasTransferModule = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes('调拨');
    });
    log(`Has 调拨 module in WAREHOUSE_US: ${hasTransferModule}`);
    results.push({ step: 10, description: '调拨 at destination', data: { hasTransferModule } });

    // ========================================================================
    // Final: Dump full page text for complete analysis
    // ========================================================================
    const fullPageText = await page.evaluate(() => document.body.innerText);

    // Save results
    const reportPath = path.join(SCREENSHOT_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      testTime: new Date().toISOString(),
      viewport: VIEWPORT,
      role: 'WAREHOUSE_US',
      results,
      fullPageText: fullPageText.slice(0, 5000), // Truncated
    }, null, 2));

    log(`Report saved to ${reportPath}`);
    log(`Screenshots saved to ${SCREENSHOT_DIR}`);
    log(`Total screenshots: ${step}`);

  } catch (error) {
    log(`ERROR: ${error.message}`);
    console.error(error);
  } finally {
    await browser.close();
  }

  return results;
}

run().catch(console.error);
