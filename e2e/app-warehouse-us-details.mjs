// WAREHOUSE_US Details Test - Deep dive into each module
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/app-warehouse-us';
const APP_URL = 'http://localhost:4003';
const VIEWPORT = { width: 390, height: 844 };
const TIMEOUT = 15_000;

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

async function navTab(page, tab) {
  const map = { tasks: '/tasks', operations: '/search', scan: '/scan', messages: '/messages', profile: '/profile' };
  await page.goto(`${APP_URL}/(tabs)${map[tab]}`, { waitUntil: 'networkidle', timeout: TIMEOUT });
  await page.waitForTimeout(2000);
}

async function clickModule(page, name) {
  log(`  --- Clicking: ${name} ---`);
  await page.evaluate((n) => {
    const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent?.trim() === n);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, name);
  await page.waitForTimeout(300);
  const btn = page.getByText(name, { exact: true }).first();
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(3000);
    return true;
  }
  return false;
}

async function info(page) {
  return await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').filter(l => l.trim().length > 0).slice(0, 40);
    const btns = Array.from(document.querySelectorAll('button, [role="button"], a[href]'))
      .map(el => el.textContent?.trim()).filter(t => t && t.length > 0 && t.length < 60);
    return { lines, btns };
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  const report = [];

  try {
    // Login
    log('Login');
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await page.fill('input[placeholder="用户名"]', 'warehouse_us1');
    await page.fill('input[placeholder="密码"]', '123456');
    await page.click('text=登 录');
    await page.waitForTimeout(3000);

    // ========================================================================
    // 1. 到仓入库 - JOB row detail
    // ========================================================================
    log('=== 1. 到仓入库 - JOB detail ===');
    await navTab(page, 'operations');
    await clickModule(page, '到仓入库');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd01-dest-inbound-jobs.png') });

    // Snapshot of sub-tabs
    let pageInfo = await info(page);
    log(`Content: ${pageInfo.lines.join(' | ')}`);

    // Click the JOB row
    const jobRow = page.locator('text=S-JOB').first();
    if (await jobRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await jobRow.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd02-dest-inbound-job-scan.png') });
      pageInfo = await info(page);
      log(`JOB Detail: ${pageInfo.lines.join(' | ')}`);
      log(`JOB Actions: ${pageInfo.btns.join(' | ')}`);
      report.push({ step: 'JOB-DETAIL', data: pageInfo });

      // Go back
      await page.goBack({ timeout: 5000 }).catch(() => navTab(page, 'operations'));
      await page.waitForTimeout(2000);
    }

    // ========================================================================
    // 2. DPN 管理 - detail with lifecycle modes
    // ========================================================================
    log('=== 2. DPN 管理 - lifecycle modes ===');
    await navTab(page, 'operations');
    await clickModule(page, 'DPN 管理');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd03-dpn-list.png') });

    // Click the first DPN row with real data (DPN-20260415-0002 has SATELLITE_STATION)
    const dpnRow = page.locator('text=DPN-20260415-0002').first();
    if (await dpnRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dpnRow.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd04-dpn-detail.png') });
      pageInfo = await info(page);
      log(`DPN Detail: ${pageInfo.lines.join(' | ')}`);
      log(`DPN Actions: ${pageInfo.btns.join(' | ')}`);
      report.push({ step: 'DPN-DETAIL', data: pageInfo });

      await page.goBack({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // Also check DPN-20260415-0003 (DELIVERY type)
    const dpnRow2 = page.locator('text=DPN-20260415-0003').first();
    if (await dpnRow2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dpnRow2.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd05-dpn-delivery-detail.png') });
      pageInfo = await info(page);
      log(`DPN Delivery Detail: ${pageInfo.lines.join(' | ')}`);
      log(`DPN Delivery Actions: ${pageInfo.btns.join(' | ')}`);
      report.push({ step: 'DPN-DELIVERY-DETAIL', data: pageInfo });

      await page.goBack({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // ========================================================================
    // 3. 库存查询 - cascading filters interaction
    // ========================================================================
    log('=== 3. 库存查询 - cascading filters ===');
    await navTab(page, 'operations');
    await clickModule(page, '库存查询');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd06-stock-query.png') });
    pageInfo = await info(page);
    log(`Stock: ${pageInfo.lines.join(' | ')}`);
    report.push({ step: 'STOCK', data: pageInfo });

    // Click on a stock item
    const stockItem = page.locator('text=S-202604').first();
    if (await stockItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await stockItem.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd07-stock-item-detail.png') });
      pageInfo = await info(page);
      log(`Stock item detail: ${pageInfo.lines.join(' | ')}`);
      report.push({ step: 'STOCK-ITEM', data: pageInfo });
      await page.goBack({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // ========================================================================
    // 4. 配送管理 - detail with sign/fail
    // ========================================================================
    log('=== 4. 配送管理 - sign/fail modes ===');
    await navTab(page, 'operations');
    await clickModule(page, '配送管理');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd08-delivery-list.png') });

    // Click first delivery item
    const delItem = page.locator('text=DPN-202604').first();
    if (await delItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await delItem.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd09-delivery-detail.png') });
      pageInfo = await info(page);
      log(`Delivery Detail: ${pageInfo.lines.join(' | ')}`);
      log(`Delivery Actions: ${pageInfo.btns.join(' | ')}`);
      report.push({ step: 'DELIVERY-DETAIL', data: pageInfo });
      await page.goBack({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // ========================================================================
    // 5. 自提管理 - detail
    // ========================================================================
    log('=== 5. 自提管理 - notify/verify ===');
    await navTab(page, 'operations');
    await clickModule(page, '自提管理');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd10-pickup-list.png') });
    pageInfo = await info(page);
    log(`Pickup: ${pageInfo.lines.join(' | ')}`);
    report.push({ step: 'PICKUP', data: pageInfo });

    // ========================================================================
    // 6. 订单查询 - detail
    // ========================================================================
    log('=== 6. 订单查询 - order detail ===');
    await navTab(page, 'operations');
    await clickModule(page, '订单查询');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd11-order-query.png') });

    // Click an order
    const orderItem = page.locator('text=S-20260424').first();
    if (await orderItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await orderItem.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd12-order-detail.png') });
      pageInfo = await info(page);
      log(`Order Detail: ${pageInfo.lines.join(' | ')}`);
      log(`Order Actions: ${pageInfo.btns.join(' | ')}`);
      report.push({ step: 'ORDER-DETAIL', data: pageInfo });
    }

    // ========================================================================
    // 7. Tasks tab - click task items
    // ========================================================================
    log('=== 7. Tasks tab - task items ===');
    await navTab(page, 'tasks');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd13-tasks-detail.png') });

    // Click a JOB task
    const jobTask = page.locator('text=S-JOB').first();
    if (await jobTask.isVisible({ timeout: 3000 }).catch(() => false)) {
      await jobTask.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd14-task-job-detail.png') });
      pageInfo = await info(page);
      log(`Task JOB Detail: ${pageInfo.lines.join(' | ')}`);
      report.push({ step: 'TASK-JOB', data: pageInfo });
      await page.goBack({ timeout: 5000 }).catch(() => navTab(page, 'tasks'));
      await page.waitForTimeout(2000);
    }

    // Click a DPN task
    await navTab(page, 'tasks');
    const dpnTask = page.locator('text=DPN待绑定').first();
    if (await dpnTask.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dpnTask.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd15-task-dpn-detail.png') });
      pageInfo = await info(page);
      log(`Task DPN Detail: ${pageInfo.lines.join(' | ')}`);
      report.push({ step: 'TASK-DPN', data: pageInfo });
      await page.goBack({ timeout: 5000 }).catch(() => navTab(page, 'tasks'));
      await page.waitForTimeout(2000);
    }

    // Click a delivery task
    await navTab(page, 'tasks');
    const delTask = page.locator('text=待配送').first();
    if (await delTask.isVisible({ timeout: 3000 }).catch(() => false)) {
      await delTask.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'd16-task-delivery-detail.png') });
      pageInfo = await info(page);
      log(`Task Delivery Detail: ${pageInfo.lines.join(' | ')}`);
      report.push({ step: 'TASK-DELIVERY', data: pageInfo });
    }

    // ========================================================================
    // Save report
    // ========================================================================
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'details-report.json'),
      JSON.stringify({ testTime: new Date().toISOString(), report }, null, 2)
    );
    log('=== DETAILS COMPLETE ===');

  } catch (err) {
    log(`ERROR: ${err.message}`);
  } finally {
    await browser.close();
  }
}
run().catch(console.error);
