// Deep inspection script - captures text content and visible elements from each page
const { chromium } = require('playwright');

const APP_URL = 'http://localhost:4003';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function inspectPage(page, label) {
  // Get all visible text
  const bodyText = await page.textContent('body').catch(() => '');

  // Get all buttons/clickable elements text
  const buttons = await page.$$eval('button, [role="button"], a', els =>
    els.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).map(el => el.textContent?.trim()).filter(Boolean)
  );

  // Get all input placeholders
  const placeholders = await page.$$eval('input', els =>
    els.map(el => el.getAttribute('placeholder')).filter(Boolean)
  );

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PAGE: ${label}`);
  console.log(`URL: ${page.url()}`);
  console.log(`${'='.repeat(60)}`);
  console.log('VISIBLE BUTTONS/LINKS:');
  for (const b of buttons.slice(0, 30)) {
    console.log(`  [${b.substring(0, 80)}]`);
  }
  if (buttons.length > 30) console.log(`  ... and ${buttons.length - 30} more`);

  console.log('\nFIRST 2000 CHARS OF TEXT:');
  console.log(bodyText.substring(0, 2000));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  // 1. Login
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  const quickLoginBtn = page.locator('text=起运国仓管');
  if (await quickLoginBtn.count() > 0) {
    await quickLoginBtn.first().click();
    await sleep(3000);
  }
  console.log(`Logged in. URL: ${page.url()}`);

  // 2. Tasks Tab
  await page.goto(`${APP_URL}/(tabs)/tasks`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await inspectPage(page, 'TASKS TAB (任务)');

  // 3. Operations Tab (办理)
  await page.goto(`${APP_URL}/(tabs)/search`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  await inspectPage(page, 'OPERATIONS TAB (办理)');

  // 4a. 入库管理
  await page.goto(`${APP_URL}/task/inbound-list`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'INBOUND LIST (入库管理)');

  // 4b. 库存管理
  await page.goto(`${APP_URL}/task/stock`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'STOCK (库存管理)');

  // 4c. 装箱发货
  await page.goto(`${APP_URL}/task/job-list`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'JOB LIST (装箱发货)');

  // 4d. 无单快递
  await page.goto(`${APP_URL}/task/no-order-express`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'NO ORDER EXPRESS (无单快递)');

  // 4e. 调拨管理
  await page.goto(`${APP_URL}/task/transfer`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'TRANSFER (调拨管理)');

  // 4f. 退运处理
  await page.goto(`${APP_URL}/task/return-process`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'RETURN PROCESS (退运处理)');

  // 4g. 订单查询
  await page.goto(`${APP_URL}/task/order`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'ORDER (订单查询)');

  // 5. Scan Tab
  await page.goto(`${APP_URL}/(tabs)/scan`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'SCAN TAB (扫码)');

  // 6. Messages Tab
  await page.goto(`${APP_URL}/(tabs)/messages`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'MESSAGES TAB (消息)');

  // 7. Profile Tab
  await page.goto(`${APP_URL}/(tabs)/profile`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'PROFILE TAB (我的)');

  // 8. Check a few more detail pages
  // Transfer create
  await page.goto(`${APP_URL}/task/transfer-create`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'TRANSFER CREATE (新建调拨)');

  // Return create
  await page.goto(`${APP_URL}/task/return-create`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(1500);
  await inspectPage(page, 'RETURN CREATE (新建退运)');

  await browser.close();
  console.log('\n=== INSPECTION COMPLETE ===');
})().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
