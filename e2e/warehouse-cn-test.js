// Playwright E2E test for WAREHOUSE_CN role
// Run: npx playwright test --config=playwright.config.ts  or  node e2e/warehouse-cn-test.js
const { chromium } = require('playwright');
const path = require('path');

const SCREENSHOT_DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/app-warehouse-cn';
const APP_URL = 'http://localhost:4003';

function ss(name) {
  return path.join(SCREENSHOT_DIR, name + '.png');
}

async function log(message) {
  console.log(`[${new Date().toISOString().split('T')[1].split('.')[0]}] ${message}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro dimensions
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  // Enable console logging from the app
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`  [BROWSER ERROR] ${msg.text()}`);
    }
  });

  // ========================================
  // 1. LOGIN
  // ========================================
  log('Navigating to app...');
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);

  // Check if we're on the login page
  const loginUrl = page.url();
  log(`Current URL after navigation: ${loginUrl}`);

  // Take login page screenshot
  await page.screenshot({ path: ss('01-login-page'), fullPage: false });
  log('Screenshot: 01-login-page.png');

  // Click quick login for warehouse_cn1
  // Look for the "起运国仓管" quick login button text
  const quickLoginBtn = page.locator('text=起运国仓管');
  const quickLoginExists = await quickLoginBtn.count();
  log(`Quick login buttons found: ${quickLoginExists}`);

  if (quickLoginExists > 0) {
    await quickLoginBtn.first().click();
    log('Clicked quick login button for warehouse_cn1');
  } else {
    // Try typing credentials manually
    log('No quick login buttons, trying manual login...');
    const userField = page.locator('input[placeholder="用户名"]');
    const passField = page.locator('input[placeholder="密码"]');
    if (await userField.count() > 0) {
      await userField.fill('warehouse_cn1');
      await passField.fill('123456');
      // Find and click login button
      const loginBtn = page.locator('text=登 录');
      await loginBtn.click();
      log('Manual login submitted');
    }
  }

  // Wait for navigation to tabs
  await sleep(3000);
  const afterLoginUrl = page.url();
  log(`URL after login: ${afterLoginUrl}`);

  // Take screenshot after login (main tasks page)
  await page.screenshot({ path: ss('02-after-login'), fullPage: false });
  log('Screenshot: 02-after-login.png');

  // ========================================
  // 2. IDENTIFY ALL BOTTOM TABS
  // ========================================
  log('\n=== BOTTOM TABS ===');

  // Expo Router renders tabs as accessible elements
  // Look for tab-related text elements
  const tabTexts = ['任务', '办理', '扫码', '消息', '我的'];
  for (const tab of tabTexts) {
    const tabEl = page.locator(`text="${tab}"`).first();
    const visible = await tabEl.isVisible().catch(() => false);
    log(`  Tab "${tab}": visible=${visible}`);
  }

  // It's possible tabs aren't labeled with text, check for icon+label combos
  // Take a full page screenshot showing tabs
  const bodyContent = await page.textContent('body');
  log(`Body text length: ${bodyContent.length}`);

  // ========================================
  // 3. TASKS TAB (任务)
  // ========================================
  log('\n=== TAB 1: 任务 (Tasks) ===');

  // Navigate to tasks tab directly
  await page.goto(`${APP_URL}/(tabs)/tasks`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2500);
  await page.screenshot({ path: ss('03-tasks-tab'), fullPage: false });
  log('Screenshot: 03-tasks-tab.png');

  // Check for main tabs: 待办 / 已完成
  const mainTabTexts = ['待办', '已完成'];
  for (const t of mainTabTexts) {
    const el = page.locator(`text="${t}"`).first();
    const vis = await el.isVisible().catch(() => false);
    log(`  Main tab "${t}": visible=${vis}`);
  }

  // Check for sub filter tabs: 全部, 入库, 装箱, 调拨, 无单
  const subTabs = ['全部', '入库', '装箱', '调拨', '无单'];
  for (const t of subTabs) {
    const count = await page.locator(`text=${t}`).count();
    log(`  Sub filter "${t}": elements=${count}`);
  }

  // Check task items
  // Task types: inbound, packing, transfer, orphan (for WAREHOUSE_CN)
  const taskKeywords = ['待入库', '待添加订单', '调拨', '无单快递', '退回入库'];
  for (const kw of taskKeywords) {
    const count = await page.locator(`text=${kw}`).count();
    log(`  Task type "${kw}": ${count} items`);
  }

  // Scroll down to see all tasks
  await page.screenshot({ path: ss('03b-tasks-scrolled'), fullPage: true });
  log('Screenshot: 03b-tasks-scrolled.png');

  // Switch to 已完成 tab
  const completedTab = page.locator('text=已完成').first();
  if (await completedTab.isVisible()) {
    await completedTab.click();
    await sleep(1500);
    await page.screenshot({ path: ss('03c-tasks-completed'), fullPage: false });
    log('Screenshot: 03c-tasks-completed.png');
  }

  // ========================================
  // 4. OPERATIONS TAB (办理) - Main Module Grid
  // ========================================
  log('\n=== TAB 2: 办理 (Operations) ===');

  await page.goto(`${APP_URL}/(tabs)/search`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2500);
  await page.screenshot({ path: ss('04-operations-tab'), fullPage: true });
  log('Screenshot: 04-operations-tab.png (full page)');

  // Check for module grid entries
  const modules = [
    '入库管理', '库存管理', '装箱发货', '无单快递',
    '调拨管理', '退运处理', '订单查询'
  ];
  for (const m of modules) {
    const count = await page.locator(`text=${m}`).count();
    log(`  Module "${m}": ${count} occurrences`);
  }

  // Check for 发运计划 preview section
  const previewSection = await page.locator('text=发运计划').count();
  log(`  发运计划 preview: ${previewSection} occurrences`);

  // Check search bar
  const searchBar = await page.locator('input[placeholder*="运单号"]').count();
  log(`  Search bar: ${searchBar} input fields`);

  // ========================================
  // 4a. 入库管理 → inbound-list (SINGLE FORM PAGE)
  // ========================================
  log('\n--- 4a: 入库管理 (Inbound Management) ---');

  await page.goto(`${APP_URL}/(tabs)/search`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);

  // IMPORTANT: The user asked to tap the module on the 办理 page, NOT navigate directly.
  // But clicking modules on the web Expo app can be tricky due to routing.
  // Let's click the "入库管理" text/link
  const inboundModule = page.locator('text=入库管理').first();
  if (await inboundModule.isVisible()) {
    await inboundModule.click();
    await sleep(2500);
  } else {
    // Fallback: direct navigation
    await page.goto(`${APP_URL}/task/inbound-list`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);
  }

  log(`  Current URL: ${page.url()}`);
  await page.screenshot({ path: ss('05-inbound-list'), fullPage: true });
  log('  Screenshot: 05-inbound-list.png');

  // Check for sub-tabs: 快递入库/调拨入库/退回入库
  const inboundSubTabs = ['快递入库', '调拨入库', '退回入库'];
  for (const t of inboundSubTabs) {
    const count = await page.locator(`text=${t}`).count();
    log(`  Sub-tab "${t}": ${count} occurrences`);
  }

  // ========================================
  // 4b. 库存管理 → stock
  // ========================================
  log('\n--- 4b: 库存管理 (Stock Management) ---');

  await page.goto(`${APP_URL}/task/stock`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('06-stock-list'), fullPage: true });
  log('  Screenshot: 06-stock-list.png');

  // Click first item to see detail modal
  // Stock page should have a list of inventory items
  const stockItems = await page.locator('[role="button"], Pressable, TouchableOpacity').count();
  log(`  Interactive elements: ${stockItems}`);

  // Try to click on any item
  const firstStockItem = page.locator('text=库位').first();
  if (await firstStockItem.isVisible()) {
    log('  Found stock location items, clicking first one...');
    await firstStockItem.click();
    await sleep(1500);
    await page.screenshot({ path: ss('06b-stock-detail'), fullPage: false });
    log('  Screenshot: 06b-stock-detail.png');
  }

  // ========================================
  // 4c. 装箱发货 → job-list
  // ========================================
  log('\n--- 4c: 装箱发货 (Packing & Shipping) ---');

  await page.goto(`${APP_URL}/task/job-list`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('07-job-list'), fullPage: true });
  log('  Screenshot: 07-job-list.png');

  // Check for 集装器/shipping units
  const containerWords = ['集装器', '集装箱', '板装', 'container', 'unit', 'ULD'];
  for (const w of containerWords) {
    const count = await page.locator(`text=${w}`).count();
    if (count > 0) log(`  Found "${w}": ${count} occurrences`);
  }

  // Check for shipping units tab/button
  const shippingUnitsBtn = await page.locator('text=集装器管理').count();
  if (shippingUnitsBtn > 0) log(`  Shipping units management button: ${shippingUnitsBtn}`);

  // Click a job to see detail
  const firstJob = page.locator('text=JOB').first();
  if (await firstJob.isVisible()) {
    await firstJob.click();
    await sleep(1500);
    await page.screenshot({ path: ss('07b-job-detail'), fullPage: false });
    log('  Screenshot: 07b-job-detail.png');
  }

  // Navigate to shipping units page
  await page.goto(`${APP_URL}/task/shipping-units`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('07c-shipping-units'), fullPage: true });
  log('  Screenshot: 07c-shipping-units.png');

  // ========================================
  // 4d. 无单快递 → no-order-express
  // ========================================
  log('\n--- 4d: 无单快递 (Orphan Express) ---');

  await page.goto(`${APP_URL}/task/no-order-express`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('08-no-order-express'), fullPage: true });
  log('  Screenshot: 08-no-order-express.png');

  // Check for items
  const expressItems = await page.locator('text=快递').count();
  log(`  Items mentioning "快递": ${expressItems}`);

  // ========================================
  // 4e. 调拨管理 → transfer
  // ========================================
  log('\n--- 4e: 调拨管理 (Transfer Management) ---');

  await page.goto(`${APP_URL}/task/transfer`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('09-transfer-list'), fullPage: true });
  log('  Screenshot: 09-transfer-list.png');

  // Check for transfer items
  const transferItems = await page.locator('text=调拨').count();
  log(`  Transfer items: ${transferItems}`);

  // Click a transfer item
  const firstTransfer = page.locator('text=调拨').first();
  if (await firstTransfer.isVisible()) {
    await firstTransfer.click();
    await sleep(1500);
    await page.screenshot({ path: ss('09b-transfer-detail-actions'), fullPage: false });
    log('  Screenshot: 09b-transfer-detail-actions.png');
  }

  // Check for available actions (dispatch/arrive/receive)
  const transferActions = ['执行发车', '确认到达', '确认入库', 'dispatch', 'arrive', 'receive', '编辑', '取消'];
  for (const action of transferActions) {
    const count = await page.locator(`text=${action}`).count();
    if (count > 0) log(`  Transfer action "${action}": ${count} visible`);
  }

  // Check for 新建调拨 button
  const newTransferBtn = await page.locator('text=新建').count();
  log(`  "新建" buttons: ${newTransferBtn}`);

  // Navigate to transfer-create
  await page.goto(`${APP_URL}/task/transfer-create`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('09c-transfer-create'), fullPage: true });
  log('  Screenshot: 09c-transfer-create.png');

  // ========================================
  // 4f. 退运处理 → return-process
  // ========================================
  log('\n--- 4f: 退运处理 (Return Processing) ---');

  await page.goto(`${APP_URL}/task/return-process`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('10-return-process-list'), fullPage: true });
  log('  Screenshot: 10-return-process-list.png');

  // Click 新建 for return creation
  const newReturnBtn = page.locator('text=新建').first();
  if (await newReturnBtn.isVisible()) {
    await newReturnBtn.click();
    await sleep(1500);
    log(`  After clicking 新建 URL: ${page.url()}`);
  }

  // Navigate to return-create directly
  await page.goto(`${APP_URL}/task/return-create`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('10b-return-create-form'), fullPage: true });
  log('  Screenshot: 10b-return-create-form.png');

  // ========================================
  // 4g. 订单查询 → order
  // ========================================
  log('\n--- 4g: 订单查询 (Order Search) ---');

  await page.goto(`${APP_URL}/task/order`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('11-order-search'), fullPage: true });
  log('  Screenshot: 11-order-search.png');

  // Check for order list items
  const orderItems = await page.locator('text=运单').count();
  log(`  Items mentioning "运单": ${orderItems}`);

  // ========================================
  // 5. SCAN TAB (扫码)
  // ========================================
  log('\n=== TAB 3: 扫码 (Scan) ===');

  await page.goto(`${APP_URL}/(tabs)/scan`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('12-scan-tab'), fullPage: false });
  log('  Screenshot: 12-scan-tab.png');

  // Check if it shows barcode scanner or "Web 预览不支持相机" message
  const webHint = await page.locator('text=Web 预览不支持相机').count();
  if (webHint > 0) log('  Web preview: camera not supported message shown');

  const manualInputBtn = await page.locator('text=手动输入').count();
  log(`  "手动输入" button: ${manualInputBtn}`);

  const flashBtn = await page.locator('text=闪光灯').count();
  log(`  "闪光灯" button: ${flashBtn}`);

  const albumBtn = await page.locator('text=相册').count();
  log(`  "相册" button: ${albumBtn}`);

  const recentScans = await page.locator('text=最近扫描').count();
  log(`  "最近扫描" section: ${recentScans}`);

  // ========================================
  // 6. MESSAGES TAB (消息)
  // ========================================
  log('\n=== TAB 4: 消息 (Messages) ===');

  await page.goto(`${APP_URL}/(tabs)/messages`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('13-messages-tab'), fullPage: false });
  log('  Screenshot: 13-messages-tab.png');

  // Check filter tabs: 全部, 未读, 业务, 预警
  const msgFilterTabs = ['全部', '未读', '业务', '预警'];
  for (const t of msgFilterTabs) {
    const count = await page.locator(`text=${t}`).count();
    log(`  Filter tab "${t}": ${count}`);
  }

  // Check notification types
  const notificationTypes = ['ORDER_PENDING', 'JOB_ARRIVED', 'JOB_DEPARTING', 'DPN_UPDATE', 'UNMATCHED_PACKAGE'];
  const notificationLabels = ['待处理订单', '任务已到达', '任务发运中', 'DPN更新', '无单快递'];
  for (const label of notificationLabels) {
    const count = await page.locator(`text=${label}`).count();
    if (count > 0) log(`  Notification "${label}": ${count}`);
  }

  // Check for 全部已读 button
  const allReadBtn = await page.locator('text=全部已读').count();
  log(`  "全部已读" button: ${allReadBtn}`);

  // ========================================
  // 7. PROFILE TAB (我的)
  // ========================================
  log('\n=== TAB 5: 我的 (Profile) ===');

  await page.goto(`${APP_URL}/(tabs)/profile`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await page.screenshot({ path: ss('14-profile-tab'), fullPage: true });
  log('  Screenshot: 14-profile-tab.png');

  // Check profile elements
  const profileMenus = ['个人信息', '打印机设置', '切换仓库', '修改密码', '语言', '通知设置', '关于喵喵物流', '退出登录', '快速切换角色'];
  for (const m of profileMenus) {
    const count = await page.locator(`text=${m}`).count();
    log(`  Menu item "${m}": ${count}`);
  }

  const userNameDisplay = await page.locator('text=李仓管').count();
  log(`  User name "李仓管": ${userNameDisplay}`);

  // ========================================
  // 8. CHECK FOR "功能开发中" PLACEHOLDERS
  // ========================================
  log('\n=== CHECKING FOR "功能开发中" PLACEHOLDERS ===');

  // Navigate through all task pages and check for placeholders
  const allTaskRoutes = [
    'inbound-list', 'inbound', 'stock', 'job-list', 'packing',
    'no-order-express', 'transfer', 'transfer-create', 'transfer-dispatch',
    'transfer-arrive', 'transfer-inbound',
    'return-process', 'return-create', 'order', 'order-detail',
    'shipping-units',
  ];

  let foundPlaceholders = [];

  for (const route of allTaskRoutes) {
    try {
      await page.goto(`${APP_URL}/task/${route}`, { waitUntil: 'networkidle', timeout: 5000 });
      await sleep(800);
      const pageText = await page.textContent('body').catch(() => '');
      if (pageText.includes('功能开发中') || pageText.includes('开发中') || pageText.includes('建设中') || pageText.includes('即将推出')) {
        const match = pageText.match(/(功能开发中|开发中|建设中|即将推出)[^]{0,30}/);
        foundPlaceholders.push(`/task/${route}: ${match ? match[0] : 'placeholder found'}`);
        log(`  ⚠️  /task/${route}: PLACEHOLDER FOUND`);
      }
    } catch (e) {
      // Route might not exist
    }
  }

  if (foundPlaceholders.length === 0) {
    log('  ✅ No "功能开发中" placeholders found on any task page.');
  } else {
    log(`  ⚠️  Found ${foundPlaceholders.length} placeholders:`);
    for (const p of foundPlaceholders) {
      log(`    - ${p}`);
    }
  }

  // ========================================
  // FINAL REPORT
  // ========================================
  log('\n========================================');
  log('E2E TEST COMPLETE');
  log('========================================');
  log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  log(`Total screenshots: check directory listing`);

  // List all screenshots taken
  const fs = require('fs');
  const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
  log(`Files: ${files.length} screenshots`);
  for (const f of files.sort()) {
    log(`  ${f}`);
  }

  await browser.close();
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
