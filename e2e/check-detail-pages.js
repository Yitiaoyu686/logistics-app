// Check detail pages: stock item modal, transfer actions, packing detail, inbound detail
const { chromium } = require('playwright');

const APP_URL = 'http://localhost:4003';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  // Login
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  const quickLoginBtn = page.locator('text=起运国仓管');
  await quickLoginBtn.first().click();
  await sleep(3000);

  console.log('\n========== STOCK: Click first item ==========');
  await page.goto(`${APP_URL}/task/stock`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);

  // Click on first stock item (S-2026042400014-01)
  const firstItem = page.locator('text=S-2026042400014-01').first();
  if (await firstItem.isVisible()) {
    console.log('Clicking first stock item...');
    await firstItem.click();
    await sleep(1500);
    console.log(`URL after click: ${page.url()}`);
    const body = await page.textContent('body').catch(() => '');
    console.log('BODY after click:', body.substring(0, 1000));
  } else {
    console.log('First stock item not found');
  }

  console.log('\n========== JOB-LIST: Click first job ==========');
  await page.goto(`${APP_URL}/task/job-list`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);

  // Click on first job
  const firstJob = page.locator('text=S-JOB260503007').first();
  if (await firstJob.isVisible()) {
    console.log('Clicking first job...');
    await firstJob.click();
    await sleep(2000);
    console.log(`URL after click: ${page.url()}`);
    const body = await page.textContent('body').catch(() => '');
    console.log('BODY after click:', body.substring(0, 1500));
  }

  console.log('\n========== TRANSFER: Click first item to see actions ==========');
  await page.goto(`${APP_URL}/task/transfer`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);

  // Look for action buttons
  const actionButtons = ['执行发车', '确认到达', '扫码入库', '绑运单', '编辑', '取消', '查看详情'];
  console.log('\nTransfer list actions:');
  for (const action of actionButtons) {
    const count = await page.locator(`text=${action}`).count();
    console.log(`  "${action}": ${count} visible`);
  }

  // Click on first transfer item to see detail
  const firstTransfer = page.locator('text=S-T-20260514-1113').first();
  if (await firstTransfer.isVisible()) {
    console.log('\nClicking first transfer...');
    await firstTransfer.click();
    await sleep(2000);
    console.log(`URL after click: ${page.url()}`);
    const body = await page.textContent('body').catch(() => '');
    console.log('BODY after click:', body.substring(0, 1500));

    // Check for available actions again
    for (const action of actionButtons) {
      const count = await page.locator(`text=${action}`).count();
      console.log(`  "${action}": ${count} visible`);
    }
  }

  console.log('\n========== CHECK INBOUND LIST SUB-TABS ==========');
  await page.goto(`${APP_URL}/task/inbound-list`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);

  // Check sub-tab contents
  console.log('\nInbound list - 快递入库 tab:');
  let body = await page.textContent('body').catch(() => '');
  console.log(body.substring(0, 500));

  // Click 调拨入库 sub-tab
  const transferInboundTab = page.locator('text=调拨入库').first();
  if (await transferInboundTab.isVisible()) {
    console.log('\nClicking 调拨入库 sub-tab...');
    await transferInboundTab.click();
    await sleep(1500);
    body = await page.textContent('body').catch(() => '');
    console.log('BODY:', body.substring(0, 500));
  }

  // Click 退回入库 sub-tab
  const returnInboundTab = page.locator('text=退回入库').first();
  if (await returnInboundTab.isVisible()) {
    console.log('\nClicking 退回入库 sub-tab...');
    await returnInboundTab.click();
    await sleep(1500);
    body = await page.textContent('body').catch(() => '');
    console.log('BODY:', body.substring(0, 500));
  }

  console.log('\n========== CHECK SHIPPING UNITS PAGE CONTENT ==========');
  await page.goto(`${APP_URL}/task/shipping-units`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  body = await page.textContent('body').catch(() => '');
  console.log('BODY:', body.substring(0, 1500));

  console.log('\n========== CHECK PACKING PAGE (from job list) ==========');
  // Click a loading job to navigate to packing page
  await page.goto(`${APP_URL}/task/job-list`, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  const loadingJob = page.locator('text=LOADING').first();
  if (await loadingJob.isVisible()) {
    console.log('Clicking a LOADING job to see packing detail...');
    await loadingJob.click();
    await sleep(2000);
    console.log(`URL: ${page.url()}`);
    body = await page.textContent('body').catch(() => '');
    console.log('BODY:', body.substring(0, 1500));
  }

  await browser.close();
  console.log('\n=== DETAIL INSPECTION COMPLETE ===');
})().catch(err => {
  console.error('Detail inspection failed:', err);
  process.exit(1);
});
