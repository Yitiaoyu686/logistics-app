import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/crm-deep';
const BASE_URL = 'http://localhost:5173';

function ssPath(name: string): string {
  return path.join(SCREENSHOT_DIR, name);
}

async function login(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const inputs = page.locator('input');
  const count = await inputs.count();
  if (count >= 2) {
    await inputs.nth(0).fill('sales1');
    await inputs.nth(1).fill('123456');
  }
  const loginBtn = page.locator('button').filter({ hasText: /登录|登 录/ }).first();
  await loginBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');
}

async function closeAllDrawers(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll('.ant-drawer-open').forEach(drawer => {
      const closeBtn = drawer.querySelector('.ant-drawer-close') as HTMLElement;
      if (closeBtn) closeBtn.click();
    });
  });
  await page.waitForSelector('.ant-drawer-open', { state: 'detached', timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page: Page = await context.newPage();

  try {
    // Login
    console.log('Logging in...');
    await login(page);

    // Navigate to CRM > 我的客户
    const crmMenuItem = page.locator('.ant-menu-item').filter({ hasText: /客户中心/ });
    if (await crmMenuItem.count() > 0) {
      await crmMenuItem.first().click();
      await page.waitForTimeout(1000);
    }
    const myCustomerTab = page.locator('.ant-tabs-tab').filter({ hasText: /我的客户/ });
    if (await myCustomerTab.count() > 0) {
      await myCustomerTab.first().click();
      await page.waitForTimeout(1500);
    }
    await page.waitForLoadState('networkidle');

    // ============================================================
    // 1. New customer form - fill in Overseas enterprise type
    // ============================================================
    const addBtn = page.locator('button').filter({ hasText: /新增客户/ }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(1500);
    }

    // Fill some basic fields to make screenshot more useful
    const nameInput = page.locator('.ant-drawer input').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('测试海外客户');
    }

    // Select Overseas enterprise type
    const enterpriseSelect = page.locator('.ant-drawer .ant-select').filter({ hasText: /选择类型/ }).first();
    if (await enterpriseSelect.isVisible()) {
      await enterpriseSelect.click();
      await page.waitForTimeout(500);
      const overseasOption = page.locator('.ant-select-dropdown .ant-select-item').filter({ hasText: /海外企业/ });
      if (await overseasOption.count() > 0) {
        await overseasOption.first().click();
        await page.waitForTimeout(500);
      }
    }

    // Expand logistics section and take screenshot
    const logisticsCollapse = page.locator('.ant-collapse-header').filter({ hasText: /物流下单/ });
    if (await logisticsCollapse.count() > 0) {
      await logisticsCollapse.first().click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: ssPath('07-create-form-overseas-logistics.png'), fullPage: true });
    console.log('Overseas enterprise form screenshot saved.');

    await closeAllDrawers(page);

    // ============================================================
    // 2. Individual type enterprise form
    // ============================================================
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(1500);
    }
    const nameInput2 = page.locator('.ant-drawer input').first();
    if (await nameInput2.isVisible()) {
      await nameInput2.fill('测试个人客户');
    }
    const enterpriseSelect2 = page.locator('.ant-drawer .ant-select').filter({ hasText: /选择类型/ }).first();
    if (await enterpriseSelect2.isVisible()) {
      await enterpriseSelect2.click();
      await page.waitForTimeout(500);
      const individualOption = page.locator('.ant-select-dropdown .ant-select-item').filter({ hasText: '个人' });
      if (await individualOption.count() > 0) {
        await individualOption.first().click();
        await page.waitForTimeout(500);
      }
    }
    await page.screenshot({ path: ssPath('08-create-form-individual.png'), fullPage: true });
    console.log('Individual form screenshot saved.');

    await closeAllDrawers(page);

    // ============================================================
    // 3. Customer detail - edit mode (click 编辑 on basic info)
    // ============================================================
    await page.waitForSelector('tr.ant-table-row', { state: 'visible', timeout: 10000 }).catch(() => {});
    const firstRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
    const link = firstRow.locator('td').first().locator('a');
    if (await link.count() > 0) {
      await link.click();
      await page.waitForTimeout(2000);
    }

    // Click "编辑" on basic info section
    const editBtns = page.locator('.ant-drawer button').filter({ hasText: /编辑/ });
    const editCount = await editBtns.count();
    console.log(`Edit buttons found in drawer: ${editCount}`);
    if (editCount > 0) {
      await editBtns.first().click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: ssPath('09-detail-edit-basic-info.png'), fullPage: true });
      console.log('Detail edit mode screenshot saved.');

      // Cancel edit mode
      const cancelEdit = page.locator('.ant-drawer button').filter({ hasText: /取消/ }).first();
      if (await cancelEdit.isVisible()) {
        await cancelEdit.click();
        await page.waitForTimeout(500);
      }
    }

    // Navigate to 入仓号 tab
    const entryTab = page.locator('.ant-drawer .ant-tabs-tab').filter({ hasText: /入仓号/ });
    if (await entryTab.isVisible()) {
      await entryTab.click();
      await page.waitForTimeout(1500);
    }
    // Take a clean screenshot of just the entry tab area
    await page.screenshot({ path: ssPath('10-detail-warehouse-entry-tab.png'), fullPage: true });
    console.log('Clean warehouse entry tab screenshot saved.');

    // Click "生成入仓号" and capture the success toast
    const genBtn = page.locator('.ant-drawer button').filter({ hasText: /生成入仓号/ }).first();
    if (await genBtn.isVisible()) {
      await genBtn.click();
      await page.waitForTimeout(1000);
      // Capture toast message if visible
      await page.screenshot({ path: ssPath('11-entry-generate-toast.png'), fullPage: false });
      console.log('Entry generate toast screenshot saved.');
    }

    // Click "生成" button on the "我的客户" list page directly (the quick generate flow)
    await closeAllDrawers(page);
    await page.waitForSelector('tr.ant-table-row', { state: 'visible', timeout: 10000 }).catch(() => {});

    const quickGenBtns = page.locator('.ant-table-tbody button').filter({ hasText: /生成/ });
    const qgCount = await quickGenBtns.count();
    console.log(`Quick generate buttons in list: ${qgCount}`);
    if (qgCount > 0) {
      // Scroll to the button
      await quickGenBtns.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await quickGenBtns.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: ssPath('12-quick-generate-entry-toast.png'), fullPage: false });
      console.log('Quick generate entry toast screenshot saved.');
    }

    // ============================================================
    // 4. Transfer ownership modal
    // ============================================================
    const transferBtns = page.locator('.ant-table-tbody button').filter({ hasText: /转移跟进/ });
    if (await transferBtns.count() > 0) {
      await transferBtns.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await transferBtns.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: ssPath('13-transfer-ownership-modal.png'), fullPage: true });
      console.log('Transfer ownership modal screenshot saved.');

      // Close the modal
      const modalCancel = page.locator('.ant-modal button').filter({ hasText: /取消|取 消/ }).first();
      if (await modalCancel.isVisible()) {
        await modalCancel.click();
        await page.waitForTimeout(800);
      }
    }

    // ============================================================
    // 5. Public pool - check filter options
    // ============================================================
    const publicTab = page.locator('.ant-tabs-tab').filter({ hasText: /公海池/ });
    if (await publicTab.isVisible()) {
      await publicTab.click({ force: true });
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: ssPath('14-public-pool-cards.png'), fullPage: true });
    console.log('Public pool with cards screenshot saved.');

    console.log('\n=== ALL DONE - supplementary run ===');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({ path: ssPath('ERROR-state.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
