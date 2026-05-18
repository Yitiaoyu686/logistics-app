// WAREHOUSE_US (到达国仓管) E2E Test Script v2
// Direct navigation approach for remaining modules
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/app-warehouse-us';
const APP_URL = 'http://localhost:4003';
const VIEWPORT = { width: 390, height: 844 };
const LOG_TIMEOUT = 15_000;

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let step = 0;
function sshot(name) {
  step++;
  const filename = `${String(step).padStart(2, '0')}-${name}.png`;
  return path.join(SCREENSHOT_DIR, filename);
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function navigateToTab(page, tab) {
  // Direct navigation to tab
  const tabRoutes = {
    tasks: '/tasks',
    operations: '/search',
    scan: '/scan',
    messages: '/messages',
    profile: '/profile',
  };
  const route = tabRoutes[tab];
  if (!route) return;

  log(`  Navigating to ${tab} tab via ${APP_URL}/(tabs)${route}`);
  await page.goto(`${APP_URL}/(tabs)${route}`, { waitUntil: 'networkidle', timeout: LOG_TIMEOUT });
  await page.waitForTimeout(2000);
}

async function navigateToModule(page, moduleName) {
  // Try clicking the module card
  log(`  Looking for module: ${moduleName}`);

  // Scroll to make sure the module is visible
  await page.evaluate((name) => {
    const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent?.trim() === name);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, moduleName);

  await page.waitForTimeout(500);

  const moduleBtn = page.getByText(moduleName, { exact: true }).first();
  if (await moduleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await moduleBtn.click();
    await page.waitForTimeout(3000);
    return true;
  }
  return false;
}

async function capturePageInfo(page) {
  return await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const lines = bodyText.split('\n').filter(l => l.trim().length > 0).slice(0, 40);
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], a[href]'))
      .map(el => el.textContent?.trim())
      .filter(t => t && t.length > 0 && t.length < 60);
    return { lines, buttons };
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const allResults = [];

  try {
    // ========================================================================
    // STEP 1: Login
    // ========================================================================
    log('=== LOGIN ===');
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: LOG_TIMEOUT });
    await page.waitForSelector('input[placeholder="用户名"]', { timeout: LOG_TIMEOUT });
    await page.fill('input[placeholder="用户名"]', 'warehouse_us1');
    await page.fill('input[placeholder="密码"]', '123456');
    await page.screenshot({ path: sshot('login-form') });
    await page.click('text=登 录');
    await page.waitForTimeout(3000);
    log('Login complete');

    // ========================================================================
    // STEP 2: Main tabs overview
    // ========================================================================
    log('=== MAIN TABS ===');
    await page.screenshot({ path: sshot('main-tabs') });
    allResults.push({ step: 'TABS', desc: 'Bottom tabs: 任务, 办理, 扫码, 消息, 我的' });

    // ========================================================================
    // STEP 3: Tasks tab (任务)
    // ========================================================================
    log('=== TASKS TAB ===');
    await navigateToTab(page, 'tasks');
    await page.screenshot({ path: sshot('tasks-tab') });
    const tasksInfo = await capturePageInfo(page);
    log(`Tasks filter tabs: ${tasksInfo.lines.filter(l => l.match(/^(全部|入库|DPN|配送|自提)\b/)).join(', ')}`);
    log(`Tasks: ${tasksInfo.lines.filter(l => l.startsWith('S-') || l.startsWith('DPN-') || l.startsWith('DT-')).join(', ')}`);
    allResults.push({ step: 'TASKS', desc: 'Tasks tab with filter tabs and task items', data: tasksInfo });

    // ========================================================================
    // STEP 4: Operations tab (办理)
    // ========================================================================
    log('=== OPERATIONS TAB ===');
    await navigateToTab(page, 'operations');
    await page.screenshot({ path: sshot('operations-tab') });
    const opsInfo = await capturePageInfo(page);
    const modules = opsInfo.lines.filter(l => ['到仓入库', 'DPN 管理', '库存查询', '配送管理', '自提管理', '订单查询'].includes(l));
    log(`Operations modules: ${modules.join(', ')}`);
    allResults.push({ step: 'OPERATIONS', desc: 'Operations tab with module grid', data: opsInfo });

    // ========================================================================
    // STEP 4.1: 到仓入库 → dest-inbound-list
    // ========================================================================
    log('=== 到仓入库 (dest-inbound-list) ===');
    await navigateToTab(page, 'operations');
    const clicked1 = await navigateToModule(page, '到仓入库');
    if (clicked1) {
      await page.screenshot({ path: sshot('dest-inbound-list') });

      // Check JOB/DPN sub-tabs
      const subTabs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[role="tab"], button, [class*="tab"]'))
          .map(el => el.textContent?.trim())
          .filter(t => t && t.match(/^JOB|^DPN/));
      });
      log(`到仓入库 sub-tabs: ${subTabs.join(', ')}`);

      // Tap JOB row
      try {
        const jobCard = page.locator('text=S-JOB').first();
        if (await jobCard.isVisible({ timeout: 3000 }).catch(() => false)) {
          await jobCard.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: sshot('dest-inbound-job-detail') });
          const jobDetail = await capturePageInfo(page);
          log(`JOB detail: ${jobDetail.lines.slice(0, 10).join(' | ')}`);
          allResults.push({ step: 'DEST-INBOUND-JOB', desc: 'JOB row detail/scan screen', data: jobDetail });
          await page.goBack({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        log(`JOB row click failed: ${e.message}`);
      }

      // Tap DPN sub-tab
      try {
        const dpnTab = page.locator('text=DPN 入库').first();
        if (await dpnTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await dpnTab.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: sshot('dest-inbound-dpn') });
          const dpnInfo = await capturePageInfo(page);
          log(`DPN inbound: ${dpnInfo.lines.slice(0, 10).join(' | ')}`);
        }
      } catch (e) {
        log(`DPN tab click failed: ${e.message}`);
      }

      allResults.push({ step: 'DEST-INBOUND', desc: '到仓入库 - JOB/DPN sub-tabs' });
    }

    // ========================================================================
    // STEP 4.2: DPN 管理 → dpn-list
    // ========================================================================
    log('=== DPN 管理 (dpn-list) ===');
    await navigateToTab(page, 'operations');
    const clicked2 = await navigateToModule(page, 'DPN 管理');
    if (clicked2) {
      await page.screenshot({ path: sshot('dpn-list') });
      const dpnList = await capturePageInfo(page);
      log(`DPN list: ${dpnList.lines.join(', ')}`);

      // Tap 新建
      try {
        const newBtn = page.getByText(/新建|添加|创建/).first();
        if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await newBtn.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: sshot('dpn-create-form') });
          const createInfo = await capturePageInfo(page);
          log(`DPN create form: ${createInfo.lines.join(', ')}`);
          allResults.push({ step: 'DPN-CREATE', desc: 'DPN create form', data: createInfo });
          await page.goBack({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        log(`DPN create not found: ${e.message}`);
      }

      // Tap a DPN row for detail
      try {
        const dpnRow = page.locator('text=DPN-').first();
        if (await dpnRow.isVisible({ timeout: 3000 }).catch(() => false)) {
          await dpnRow.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: sshot('dpn-detail') });
          const detailInfo = await capturePageInfo(page);
          log(`DPN detail actions: ${detailInfo.buttons.join(', ')}`);
          allResults.push({ step: 'DPN-DETAIL', desc: 'DPN detail with lifecycle actions', data: detailInfo });
          await page.goBack({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        log(`DPN row click failed: ${e.message}`);
      }
      allResults.push({ step: 'DPN-LIST', desc: 'DPN management list', data: dpnList });
    }

    // ========================================================================
    // STEP 4.3: 库存查询 → stock with destination=1
    // ========================================================================
    log('=== 库存查询 (stock) ===');
    await navigateToTab(page, 'operations');
    const clicked3 = await navigateToModule(page, '库存查询');
    if (clicked3) {
      await page.screenshot({ path: sshot('stock-query') });
      const stockInfo = await capturePageInfo(page);
      log(`Stock filters: ${stockInfo.lines.join(', ')}`);
      // Check for cascading filters (country/city/site)
      const hasCascade = stockInfo.lines.some(l => l.includes('国家') || l.includes('城市') || l.includes('站点') || l.includes('仓库'));
      log(`Has cascading filters (country/city/site): ${hasCascade ? 'YES' : 'Check manually'}`);
      allResults.push({ step: 'STOCK', desc: '库存查询 with cascading filters', data: stockInfo });
      await page.goBack({ timeout: 5000 }).catch(() => {});
    }

    // ========================================================================
    // STEP 4.4: 配送管理 → delivery-list
    // ========================================================================
    log('=== 配送管理 (delivery-list) ===');
    await navigateToTab(page, 'operations');
    const clicked4 = await navigateToModule(page, '配送管理');
    if (clicked4) {
      await page.screenshot({ path: sshot('delivery-list') });
      const deliveryInfo = await capturePageInfo(page);
      log(`Delivery list: ${deliveryInfo.lines.join(', ')}`);

      // Tap 新建
      try {
        const newBtn = page.getByText(/新建|添加|创建/).first();
        if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await newBtn.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: sshot('delivery-create') });
          const createInfo = await capturePageInfo(page);
          allResults.push({ step: 'DELIVERY-CREATE', desc: 'Delivery create form', data: createInfo });
          await page.goBack({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        log(`Delivery create not found: ${e.message}`);
      }

      // Tap a delivery row for detail (check sign/fail modes)
      try {
        const deliveryRow = page.locator('text=DT-').first();
        if (await deliveryRow.isVisible({ timeout: 3000 }).catch(() => false)) {
          await deliveryRow.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: sshot('delivery-detail') });
          const deliveryDetail = await capturePageInfo(page);
          log(`Delivery detail actions: ${deliveryDetail.buttons.join(', ')}`);
          allResults.push({ step: 'DELIVERY-DETAIL', desc: 'Delivery task detail (sign/fail modes)', data: deliveryDetail });
          await page.goBack({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(2000);
        } else {
          // Try any card/item
          const anyRow = page.locator('[class*="card"], [class*="item"], [class*="row"]').first();
          if (await anyRow.isVisible({ timeout: 3000 }).catch(() => false)) {
            await anyRow.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: sshot('delivery-detail') });
            const deliveryDetail = await capturePageInfo(page);
            log(`Delivery detail (generic): ${deliveryDetail.lines.join(', ')}`);
            allResults.push({ step: 'DELIVERY-DETAIL', desc: 'Delivery task detail', data: deliveryDetail });
            await page.goBack({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(2000);
          }
        }
      } catch (e) {
        log(`Delivery row click failed: ${e.message}`);
      }
    }

    // ========================================================================
    // STEP 4.5: 自提管理 → pickup-list
    // ========================================================================
    log('=== 自提管理 (pickup-list) ===');
    await navigateToTab(page, 'operations');
    const clicked5 = await navigateToModule(page, '自提管理');
    if (clicked5) {
      await page.screenshot({ path: sshot('pickup-list') });
      const pickupInfo = await capturePageInfo(page);
      log(`Pickup list: ${pickupInfo.lines.join(', ')}`);

      // Tap a pickup item for detail (notify/verify)
      try {
        const anyRow = page.locator('[class*="card"], [class*="item"], [class*="row"]').first();
        if (await anyRow.isVisible({ timeout: 3000 }).catch(() => false)) {
          await anyRow.click();
          await page.waitForTimeout(2000);
          await page.screenshot({ path: sshot('pickup-detail') });
          const pickupDetail = await capturePageInfo(page);
          log(`Pickup detail actions: ${pickupDetail.buttons.join(', ')}`);
          allResults.push({ step: 'PICKUP-DETAIL', desc: 'Pickup detail (notify/verify)', data: pickupDetail });
          await page.goBack({ timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        log(`Pickup row click failed: ${e.message}`);
      }
    }

    // ========================================================================
    // STEP 4.6: 订单查询 → order
    // ========================================================================
    log('=== 订单查询 (order) ===');
    await navigateToTab(page, 'operations');
    const clicked6 = await navigateToModule(page, '订单查询');
    if (clicked6) {
      await page.screenshot({ path: sshot('order-query') });
      const orderInfo = await capturePageInfo(page);
      log(`Order query: ${orderInfo.lines.join(', ')}`);
      allResults.push({ step: 'ORDER', desc: 'Order query page', data: orderInfo });
    }

    // ========================================================================
    // STEP 5: Scan tab (扫码)
    // ========================================================================
    log('=== SCAN TAB ===');
    await navigateToTab(page, 'scan');
    await page.screenshot({ path: sshot('scan-tab') });
    const scanInfo = await capturePageInfo(page);
    log(`Scan: ${scanInfo.lines.join(', ')}`);
    allResults.push({ step: 'SCAN', desc: 'Scan tab (扫码)', data: scanInfo });

    // ========================================================================
    // STEP 6: Messages tab (消息)
    // ========================================================================
    log('=== MESSAGES TAB ===');
    await navigateToTab(page, 'messages');
    await page.screenshot({ path: sshot('messages-tab') });
    const msgInfo = await capturePageInfo(page);
    log(`Messages: ${msgInfo.lines.join(', ')}`);
    allResults.push({ step: 'MESSAGES', desc: 'Messages tab (消息)', data: msgInfo });

    // ========================================================================
    // STEP 7: Profile tab (我的)
    // ========================================================================
    log('=== PROFILE TAB ===');
    await navigateToTab(page, 'profile');
    await page.screenshot({ path: sshot('profile-tab') });
    const profileInfo = await capturePageInfo(page);
    log(`Profile: ${profileInfo.lines.join(', ')}`);
    allResults.push({ step: 'PROFILE', desc: 'Profile tab (我的)', data: profileInfo });

    // ========================================================================
    // STEP 8: Placeholder check
    // ========================================================================
    log('=== PLACEHOLDER CHECK ===');
    const placeholders = await page.evaluate(() => {
      const matches = document.body.innerText.match(/功能开发中|建设中|development|coming soon/i);
      return matches || 'NONE';
    });
    log(`Placeholders: ${placeholders}`);
    allResults.push({ step: 'PLACEHOLDER', data: placeholders });

    // ========================================================================
    // STEP 9: 调拨 check at destination
    // ========================================================================
    log('=== 调拨 CHECK ===');
    await navigateToTab(page, 'operations');
    const hasTransfer = await page.evaluate(() => document.body.innerText.includes('调拨'));
    log(`Has 调拨 in WAREHOUSE_US: ${hasTransfer}`);
    allResults.push({ step: 'TRANSFER-CHECK', data: { hasTransfer } });

    // ========================================================================
    // Save final report
    // ========================================================================
    const finalReport = {
      testTime: new Date().toISOString(),
      role: 'WAREHOUSE_US',
      viewport: VIEWPORT,
      results: allResults,
    };
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'test-report-v2.json'), JSON.stringify(finalReport, null, 2));
    log(`=== DONE === Total screenshots: ${step}`);

  } catch (error) {
    log(`FATAL ERROR: ${error.message}`);
    console.error(error);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
