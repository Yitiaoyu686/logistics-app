import { chromium, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'http://localhost:4003';
const SCREENSHOT_DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/app-warehouse-cn';

async function screenshot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  [SCREENSHOT] ${name}.png`);
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function navigateToTab(page: Page, tabName: 'tasks' | 'search' | 'scan' | 'messages' | 'profile') {
  // For Expo web, the tab routes are /tasks, /search, /scan, /messages, /profile
  const currentUrl = page.url();
  const targetPath = `/${tabName}`;
  if (currentUrl.includes(targetPath)) {
    return; // Already there
  }

  // Try clicking the tab button first
  let clicked = false;

  if (tabName === 'tasks') {
    const btn = page.locator('text=任务').first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click({ force: true });
      clicked = true;
    }
  } else if (tabName === 'search') {
    const btn = page.locator('text=办理').first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click({ force: true });
      clicked = true;
    }
  } else if (tabName === 'messages') {
    const btn = page.locator('text=消息').first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click({ force: true });
      clicked = true;
    }
  } else if (tabName === 'profile') {
    const btn = page.locator('text=我的').first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click({ force: true });
      clicked = true;
    }
  } else if (tabName === 'scan') {
    // The scan button is a center floating button - click the scan icon
    // Try clicking via the tab bar - use force:true because of overlapping elements
    try {
      // Find the center rounded scan button (big circle with scan icon)
      const scanCircle = page.locator('div[class*="r-borderRadius"] >> div[class*="r-backgroundColor"]').first();
      // Click the center of the tab bar
      const tabBar = page.locator('nav').first();
      if (await tabBar.isVisible({ timeout: 1000 }).catch(() => false)) {
        const box = await tabBar.boundingBox();
        if (box) {
          // The scan button is at about 60% of the tab bar width (middle tab of 5)
          await page.mouse.click(box.x + box.width * 0.6, box.y - 20, { force: true });
          clicked = true;
        }
      }
    } catch {}
  }

  if (clicked) {
    await wait(800);
    // Verify we navigated
    const newUrl = page.url();
    if (newUrl.includes(targetPath) || newUrl.includes(tabName)) {
      console.log(`    Navigated to ${tabName} tab via click`);
      return;
    }
  }

  // Fallback: navigate via URL
  console.log(`    Navigating to ${tabName} via URL fallback`);
  await page.goto(`${BASE}/${tabName === 'search' ? 'search' : tabName}`, { waitUntil: 'networkidle', timeout: 10000 });
  await wait(500);
}

async function navigateTo(page: Page, route: string) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 10000 });
  await wait(800);
}

async function goBack(page: Page) {
  // Try clicking back arrow
  try {
    const backArrow = page.locator('[class*="r-back"]').first();
    if (await backArrow.isVisible({ timeout: 1000 }).catch(() => false)) {
      await backArrow.click();
      await wait(500);
      return;
    }
  } catch {}
  // Navigate back to the search tab (办理)
  await navigateToTab(page, 'search');
}

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  console.log('=== WAREHOUSE_CN E2E Test - App Web Preview ===\n');

  // ========================================================
  // STEP 1: LOGIN
  // ========================================================
  console.log('Step 1: Login as warehouse_cn1');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await wait(1500);

  // Click the "起运国仓管" quick-login card
  const loginCard = page.locator('text=起运国仓管').first();
  if (await loginCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginCard.click();
    console.log('  Clicked quick-login: 起运国仓管');
  } else {
    // Manual login
    console.log('  Using manual login');
    await page.locator('input[placeholder*="用户名"]').first().fill('warehouse_cn1');
    await page.locator('input[placeholder*="密码"]').first().fill('123456');
    await page.locator('text=登录').first().click();
  }

  await wait(3000);
  console.log(`  Current URL: ${page.url()}`);

  // ========================================================
  // STEP 2: TAB 1 - 任务 (Tasks)
  // ========================================================
  console.log('\nStep 2a: Tab - 任务 (Tasks)');
  await navigateToTab(page, 'tasks');
  await screenshot(page, '01-tab-tasks');

  // Check filter tabs
  const filterTabs = ['全部', '入库', '装箱', '调拨', '无单'];
  const visibleTabs: string[] = [];
  console.log('  Filter tabs:');
  for (const tab of filterTabs) {
    const el = page.locator(`text="${tab}"`).first();
    const v = await el.isVisible({ timeout: 1500 }).catch(() => false);
    if (v) visibleTabs.push(tab);
    console.log(`    - ${tab}: ${v ? 'VISIBLE' : 'NOT FOUND'}`);
  }

  // Take screenshot of each filter tab state
  for (const tab of visibleTabs.slice(1)) { // skip 全部
    await page.locator(`text="${tab}"`).first().click({ force: true });
    await wait(600);
    await screenshot(page, `01b-tasks-filter-${tab}`);
  }

  // ========================================================
  // STEP 2b: TAB 2 - 办理 (Operations / Module Grid)
  // ========================================================
  console.log('\nStep 2b: Tab - 办理 (Operations)');
  await navigateToTab(page, 'search');
  await screenshot(page, '02-tab-operations');

  // Check all 7 modules
  const modules = [
    { label: '入库管理', route: '/task/inbound-list' },
    { label: '库存管理', route: '/task/stock' },
    { label: '装箱发货', route: '/task/job-list' },
    { label: '无单快递', route: '/task/no-order-express' },
    { label: '调拨管理', route: '/task/transfer' },
    { label: '退运处理', route: '/task/return-process' },
    { label: '订单查询', route: '/task/order' },
  ];
  console.log('  Module grid (7 entries):');
  for (const m of modules) {
    const el = page.locator(`text=${m.label}`).first();
    const v = await el.isVisible({ timeout: 1500 }).catch(() => false);
    console.log(`    - ${m.label}: ${v ? 'VISIBLE' : 'NOT FOUND'}`);
  }

  // ========================================================
  // STEP 2c: TAB 3 - 扫码 (Scan)
  // ========================================================
  console.log('\nStep 2c: Tab - 扫码 (Scan)');
  await navigateToTab(page, 'scan');
  await screenshot(page, '03-tab-scan');

  // ========================================================
  // STEP 2d: TAB 4 - 消息 (Messages)
  // ========================================================
  console.log('\nStep 2d: Tab - 消息 (Messages)');
  await navigateToTab(page, 'messages');
  await screenshot(page, '04-tab-messages');

  // ========================================================
  // STEP 2e: TAB 5 - 我的 (Profile)
  // ========================================================
  console.log('\nStep 2e: Tab - 我的 (Profile)');
  await navigateToTab(page, 'profile');
  await screenshot(page, '05-tab-profile');

  // ========================================================
  // STEP 3: NAVIGATE EACH MODULE
  // ========================================================
  console.log('\nStep 3: Navigate through each module');

  // --- 3a: 入库管理 → /task/inbound-list ---
  console.log('  3a: 入库管理 (inbound-list)');
  await navigateTo(page, '/task/inbound-list');
  await screenshot(page, '06-module-inbound-list');

  // Test 3 subtabs
  const subTabs = ['快递入库', '调拨入库', '退回入库'];
  for (const st of subTabs) {
    const stEl = page.locator(`text=${st}`).first();
    if (await stEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stEl.click({ force: true });
      await wait(600);
      await screenshot(page, `07-inbound-subtab-${st}`);
      console.log(`    Subtask ${st}: loaded`);
    } else {
      console.log(`    Subtask ${st}: NOT FOUND`);
    }
  }

  // --- 3b: 库存管理 → /task/stock ---
  console.log('  3b: 库存管理 (stock)');
  await navigateTo(page, '/task/stock');
  await screenshot(page, '08-module-stock');

  // Try tapping a stock item for detail modal
  await tryTapCard(page, '09-stock-detail-modal', 'Stock item');
  // Go back to stock page
  await navigateTo(page, '/task/stock');

  // --- 3c: 装箱发货 → /task/job-list ---
  console.log('  3c: 装箱发货 (job-list/packing)');
  await navigateTo(page, '/task/job-list');
  await screenshot(page, '10-module-packing');

  await tryTapCard(page, '11-packing-detail', 'Job item');

  // --- 3d: 无单快递 → /task/no-order-express ---
  console.log('  3d: 无单快递 (no-order-express)');
  await navigateTo(page, '/task/no-order-express');
  await screenshot(page, '12-module-no-order-express');

  // --- 3e: 调拨管理 → /task/transfer ---
  console.log('  3e: 调拨管理 (transfer)');
  await navigateTo(page, '/task/transfer');
  await screenshot(page, '13-module-transfer');

  await tryTapCard(page, '14-transfer-detail', 'Transfer item');

  // --- 3f: 退运处理 → /task/return-process ---
  console.log('  3f: 退运处理 (return-process)');
  await navigateTo(page, '/task/return-process');
  await screenshot(page, '15-module-return-process');

  // Tap "新建" button
  const createBtn = page.locator('text=新建').first();
  if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await createBtn.click({ force: true });
    await wait(800);
    await screenshot(page, '16-return-create-form');
    console.log('    "新建" button clicked - create form loaded');
  } else {
    console.log('    "新建" button NOT FOUND');
    await screenshot(page, '16-return-no-create');
  }

  // --- 3g: 订单查询 → /task/order ---
  console.log('  3g: 订单查询 (order)');
  await navigateTo(page, '/task/order');
  await screenshot(page, '17-module-order');

  // ========================================================
  // STEP 4: BACK TO OPERATIONS TAB
  // ========================================================
  console.log('\nStep 4: Final operations tab view');
  await navigateToTab(page, 'search');
  await screenshot(page, '18-final-operations');

  // ========================================================
  // REPORT
  // ========================================================
  console.log('\n=== TEST COMPLETE ===');
  const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
  console.log(`Total screenshots: ${files.length}`);
  for (const f of files.sort()) {
    console.log(`  ${f}`);
  }

  await browser.close();
}

async function tryTapCard(page: Page, screenshotName: string, label: string) {
  // Try to find clickable cards/items and click the first one
  const selectors = [
    'div[role="button"]',
    'div[tabindex="0"]',
    'div[class*="r-cursor-1loqt21"]',
  ];

  for (const sel of selectors) {
    const items = page.locator(sel);
    const count = await items.count().catch(() => 0);
    if (count > 0) {
      // Skip items that are likely navigation/tabs (small elements)
      for (let i = 0; i < Math.min(count, 20); i++) {
        const item = items.nth(i);
        const box = await item.boundingBox().catch(() => null);
        if (box && box.width > 100 && box.height > 40) {
          await item.click({ force: true });
          await wait(600);
          console.log(`    ${label}: clicked (width=${Math.round(box.width)}, height=${Math.round(box.height)})`);

          // Check if URL changed (navigated) or a modal appeared
          await screenshot(page, screenshotName);
          // Navigate back
          await page.goBack().catch(() => {});
          await wait(400);
          return;
        }
      }
    }
  }

  console.log(`    ${label}: no suitable clickable item found`);
  await screenshot(page, screenshotName);
}

run().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
