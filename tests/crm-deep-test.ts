import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/crm-deep';
const BASE_URL = 'http://localhost:5173';

function ssPath(name: string): string {
  return path.join(SCREENSHOT_DIR, name);
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function login(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[id="login_username"]', { timeout: 10000 }).catch(() => {});
  // Try multiple selectors for login form
  const usernameInput = page.locator('input').first();
  await usernameInput.waitFor({ state: 'visible', timeout: 10000 });

  // Fill in credentials
  const inputs = page.locator('input');
  const count = await inputs.count();
  if (count >= 2) {
    await inputs.nth(0).fill('sales1');
    await inputs.nth(1).fill('123456');
  }

  // Click login button
  const loginBtn = page.locator('button').filter({ hasText: /登录|登 录/ }).first();
  await loginBtn.click();
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');
}

async function main() {
  // Ensure screenshot dir exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page: Page = await context.newPage();

  try {
    // ============================================================
    // STEP 0: Login
    // ============================================================
    console.log('=== Step 0: Login ===');
    await login(page);
    await page.screenshot({ path: ssPath('00-login-success.png'), fullPage: false });
    console.log('  Login successful, screenshot saved.');

    // ============================================================
    // STEP 1: Navigate to CRM > 我的客户
    // ============================================================
    console.log('=== Step 1: Navigate to CRM > 我的客户 ===');

    // Click "客户中心" in sidebar
    const crmMenuItem = page.locator('.ant-menu-item').filter({ hasText: /客户中心/ });
    if (await crmMenuItem.count() > 0) {
      await crmMenuItem.first().click();
      await page.waitForTimeout(1000);
    }

    // Click "我的客户" tab
    const myCustomerTab = page.locator('.ant-tabs-tab').filter({ hasText: /我的客户/ });
    if (await myCustomerTab.count() > 0) {
      await myCustomerTab.first().click();
      await page.waitForTimeout(1500);
    }

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: ssPath('01-my-customers-list.png'), fullPage: true });
    console.log('  My Customers list screenshot saved.');

    // ============================================================
    // STEP 1b: Document columns & controls
    // ============================================================
    console.log('\n--- 我的客户 Page Analysis ---');
    const columnHeaders = await page.locator('.ant-table-thead th').allTextContents();
    console.log('  Columns:', columnHeaders.filter(t => t.trim()));

    const searchInput = page.locator('input[placeholder*="搜索"]').first();
    const searchPlaceholder = await searchInput.getAttribute('placeholder');
    console.log('  Search placeholder:', searchPlaceholder);

    const filterSelects = await page.locator('.ant-select').allTextContents();
    console.log('  Filter/Select controls present:', filterSelects.length > 0);

    // Action buttons in toolbar
    const toolbarButtons = await page.locator('.ant-btn').allTextContents();
    console.log('  Toolbar buttons:', toolbarButtons.filter(t => t.trim() && !t.includes('行')));

    // Action buttons per row
    const actionButtons = await page.locator('.ant-table-tbody .ant-btn').allTextContents();
    console.log('  Per-row action buttons (unique):', [...new Set(actionButtons.filter(t => t.trim()))]);

    // ============================================================
    // STEP 2: Click "新增客户" → screenshot the create form
    // ============================================================
    console.log('\n=== Step 2: 新增客户 Form ===');
    const addBtn = page.locator('button').filter({ hasText: /新增客户/ }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(1500);
    }

    // Wait for drawer to open
    await page.waitForSelector('.ant-drawer', { timeout: 5000 });
    await page.screenshot({ path: ssPath('02-create-customer-form.png'), fullPage: true });
    console.log('  Create form (initial state) screenshot saved.');

    // Expand "物流下单信息" collapse
    const logisticsCollapse = page.locator('.ant-collapse-header').filter({ hasText: /物流下单/ });
    if (await logisticsCollapse.count() > 0) {
      await logisticsCollapse.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: ssPath('02b-create-form-logistics-expanded.png'), fullPage: true });
      console.log('  Create form (logistics expanded) screenshot saved.');
    }

    // Fill in enterprise type to show enterprise fields
    const enterpriseTypeSelect = page.locator('.ant-drawer .ant-select').filter({ hasText: /选择类型/ }).first();
    if (await enterpriseTypeSelect.count() > 0) {
      await enterpriseTypeSelect.click();
      await page.waitForTimeout(500);
      // Select "中国企业"
      const cnOption = page.locator('.ant-select-dropdown .ant-select-item').filter({ hasText: /中国企业/ });
      if (await cnOption.count() > 0) {
        await cnOption.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: ssPath('02c-create-form-enterprise-CN.png'), fullPage: true });
        console.log('  Create form (CN enterprise) screenshot saved.');
      }
    }

    // Close the drawer by clicking the mask
    const drawerMask = page.locator('.ant-drawer-mask').first();
    if (await drawerMask.isVisible()) {
      await drawerMask.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(1500);
    }
    // Also try closing via cancel button if mask click didn't work
    let drawerStillOpen = await page.locator('.ant-drawer-open').count();
    if (drawerStillOpen > 0) {
      const cancelBtn = page.locator('.ant-drawer button').filter({ hasText: /取消/ }).first();
      if (await cancelBtn.isVisible()) { await cancelBtn.click(); await page.waitForTimeout(1500); }
    }
    // Final fallback: dismiss any remaining modal/mask
    await page.waitForSelector('.ant-drawer-open', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    // Re-activate the tab to ensure table is rendered
    const myTabAgain = page.locator('.ant-tabs-tab').filter({ hasText: /我的客户/ });
    if (await myTabAgain.count() > 0) {
      await myTabAgain.first().click();
      await page.waitForTimeout(1000);
    }
    await page.waitForLoadState('networkidle');

    // ============================================================
    // STEP 3: Click a customer row → Detail Drawer
    // ============================================================
    console.log('\n=== Step 3: Customer Detail Drawer ===');

    // Scroll the table into view and wait for data
    const tableEl = page.locator('.ant-table');
    await tableEl.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    // Log what we see in the table
    const tableBody = page.locator('.ant-table-tbody');
    const rowCount = await tableBody.locator('tr.ant-table-row').count();
    console.log(`  Visible data rows in table: ${rowCount}`);

    if (rowCount > 0) {
      // Click customer code link in first row, first column
      const firstRow = tableBody.locator('tr.ant-table-row').first();
      const codeCell = firstRow.locator('td').first();
      const link = codeCell.locator('a');
      if (await link.count() > 0) {
        await link.click();
      } else {
        await codeCell.click();
      }
      await page.waitForTimeout(2000);
    } else {
      // Last resort: use JS to click
      console.log('  No visible rows, trying JS click...');
      await page.evaluate(() => {
        const links = document.querySelectorAll('.ant-table-tbody td a');
        if (links.length > 0) (links[0] as HTMLElement).click();
      });
      await page.waitForTimeout(2000);
    }

    await page.waitForSelector('.ant-drawer', { timeout: 5000 });
    await page.screenshot({ path: ssPath('03-detail-drawer-basic-info.png'), fullPage: true });
    console.log('  Detail drawer (基础资料 tab) screenshot saved.');

    // List all tab names
    const tabNames = await page.locator('.ant-drawer .ant-tabs-tab').allTextContents();
    console.log('  Tab names:', tabNames);

    // ============================================================
    // STEP 3b: Screenshot each tab
    // ============================================================
    for (let i = 0; i < tabNames.length; i++) {
      const tabName = tabNames[i].trim();
      const tabEl = page.locator('.ant-drawer .ant-tabs-tab').nth(i);
      if (await tabEl.isVisible()) {
        await tabEl.click();
        await page.waitForTimeout(1000);

        let fileName = '';
        if (tabName.includes('基础资料')) fileName = '03a-tab-basic-info.png';
        else if (tabName.includes('订单列表')) fileName = '03b-tab-order-list.png';
        else if (tabName.includes('交易数据')) fileName = '03c-tab-trade-data.png';
        else if (tabName.includes('跟进记录')) fileName = '03d-tab-follow-up.png';
        else if (tabName.includes('入仓号')) fileName = '03e-tab-warehouse-entry.png';
        else fileName = `03-tab-${i}-${tabName}.png`;

        await page.screenshot({ path: ssPath(fileName), fullPage: true });
        console.log(`  Tab "${tabName}" screenshot saved.`);
      }
    }

    // ============================================================
    // STEP 3c: Analyze 入仓号 tab
    // ============================================================
    console.log('\n--- 入仓号 Tab Analysis ---');
    const entryTab = page.locator('.ant-drawer .ant-tabs-tab').filter({ hasText: /入仓号/ });
    if (await entryTab.isVisible()) {
      await entryTab.click();
      await page.waitForTimeout(1500);
    }

    // Get entry table columns
    const entryTableHeaders = await page.locator('.ant-drawer .ant-table-thead th').allTextContents();
    console.log('  入仓号 table columns:', entryTableHeaders.filter(t => t.trim()));

    // Get entry action buttons
    const entryButtons = await page.locator('.ant-drawer .ant-table-tbody .ant-btn').allTextContents();
    console.log('  入仓号 action buttons:', [...new Set(entryButtons.filter(t => t.trim()))]);

    // ============================================================
    // STEP 4: Test 入仓号 flow - Generate
    // ============================================================
    console.log('\n=== Step 4: 入仓号 Flow Tests ===');

    // Click "生成入仓号" button
    const generateEntryBtn = page.locator('.ant-drawer button').filter({ hasText: /生成入仓号/ }).first();
    if (await generateEntryBtn.isVisible()) {
      await generateEntryBtn.click();
      await page.waitForTimeout(1500);

      // Check for success message
      const successMsg = page.locator('.ant-message-success, .ant-message-notice');
      if (await successMsg.count() > 0) {
        const msgText = await successMsg.first().textContent();
        console.log('  生成入仓号 success message:', msgText);
      }

      await page.screenshot({ path: ssPath('04a-generate-entry-success.png'), fullPage: true });
      console.log('  Generate entry screenshot saved.');
    }

    // Find a "待使用" entry and click "作废"
    const invalidateBtns = page.locator('.ant-drawer .ant-btn').filter({ hasText: /作废/ });
    const invalCount = await invalidateBtns.count();
    console.log(`  Found ${invalCount} "作废" buttons`);

    if (invalCount > 0) {
      await invalidateBtns.first().click();
      await page.waitForTimeout(500);

      // Confirm popconfirm
      const confirmBtn = page.locator('.ant-popconfirm .ant-btn-primary').first();
      if (await confirmBtn.isVisible()) {
        await page.screenshot({ path: ssPath('04b-invalidate-confirm-dialog.png'), fullPage: true });
        console.log('  Invalidate confirm dialog screenshot saved.');
        await confirmBtn.click();
        await page.waitForTimeout(1000);

        const invalMsg = page.locator('.ant-message-success, .ant-message-notice');
        if (await invalMsg.count() > 0) {
          const msgText = await invalMsg.first().textContent();
          console.log('  作废 success message:', msgText);
        }
      }
    }

    // Check for copyable entry numbers
    const copyIcons = page.locator('.ant-drawer .anticon-copy, [class*="copy"]');
    const copyCount = await copyIcons.count();
    console.log(`  Copyable entry number icons: ${copyCount}`);

    // Close the detail drawer robustly
    await page.evaluate(() => {
      const drawer = document.querySelector('.ant-drawer-open');
      if (drawer) {
        const closeBtn = drawer.querySelector('.ant-drawer-close') as HTMLElement;
        if (closeBtn) closeBtn.click();
      }
    });
    await page.waitForSelector('.ant-drawer-open', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);

    // ============================================================
    // STEP 5: Public Pool (公海池)
    // ============================================================
    console.log('\n=== Step 5: Public Pool (公海池) ===');

    // Ensure no drawers are open before clicking tabs
    await page.evaluate(() => {
      document.querySelectorAll('.ant-drawer-open').forEach(drawer => {
        const closeBtn = drawer.querySelector('.ant-drawer-close') as HTMLElement;
        if (closeBtn) closeBtn.click();
      });
    });
    await page.waitForTimeout(800);

    const publicTab = page.locator('.ant-tabs-tab').filter({ hasText: /公海池/ });
    if (await publicTab.isVisible()) {
      await publicTab.click({ force: true });
      await page.waitForTimeout(2000);
    }

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: ssPath('05a-public-pool-list.png'), fullPage: true });
    console.log('  Public pool list screenshot saved.');

    // Document differences from My Customers
    console.log('\n--- 公海池 vs 我的客户 Differences ---');
    const publicColumns = await page.locator('.ant-table-thead th').allTextContents();
    console.log('  Columns:', publicColumns.filter(t => t.trim()));

    // Per-row actions
    const publicRowActions = await page.locator('.ant-table-tbody .ant-btn').allTextContents();
    console.log('  Row actions:', [...new Set(publicRowActions.filter(t => t.trim()))]);

    // Check for 认领公示 card
    const claimCard = page.locator('.ant-card').filter({ hasText: /认领/ });
    const hasClaimCard = await claimCard.count() > 0;
    console.log('  Has 认领公示 card:', hasClaimCard);

    // Toolbar buttons
    const publicToolbarBtns = await page.locator('.ant-btn').allTextContents();
    console.log('  Toolbar buttons:', [...new Set(publicToolbarBtns.filter(t => t.trim() && !t.includes('行') && !t.includes('页')))]);

    // ============================================================
    // STEP 5b: Test "申请认领" button
    // ============================================================
    console.log('\n=== Step 5b: Test 申请认领 ===');
    const claimBtns = page.locator('button').filter({ hasText: /申请认领/ });
    const claimBtnsCount = await claimBtns.count();
    console.log(`  Found ${claimBtnsCount} "申请认领" buttons`);

    if (claimBtnsCount > 0) {
      await claimBtns.first().click();
      await page.waitForTimeout(1000);

      const claimMsg = page.locator('.ant-message-success, .ant-message-notice');
      if (await claimMsg.count() > 0) {
        const msgText = await claimMsg.first().textContent();
        console.log('  Claim success message:', msgText);
      }

      await page.screenshot({ path: ssPath('05b-claim-request-result.png'), fullPage: true });
      console.log('  Claim request result screenshot saved.');

      // Check the 认领公示 card for the new entry
      await page.screenshot({ path: ssPath('05c-claim-public-notice.png'), fullPage: true });
      console.log('  Claim public notice card screenshot saved.');
    }

    // ============================================================
    // STEP 5c: Test "录入线索" button → screenshot form
    // ============================================================
    console.log('\n=== Step 5c: 录入线索 ===');
    const addLeadBtn = page.locator('button').filter({ hasText: /录入线索/ }).first();
    if (await addLeadBtn.isVisible()) {
      await addLeadBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: ssPath('05d-create-lead-form.png'), fullPage: true });
      console.log('  录入线索 form screenshot saved.');

      // Close the form via mask click
      const mask = page.locator('.ant-drawer-mask').first();
      if (await mask.isVisible()) {
        await mask.click({ position: { x: 10, y: 10 } });
      }
      await page.waitForSelector('.ant-drawer-open', { state: 'detached', timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    }

    // ============================================================
    // STEP 6: Test detail drawer from public pool
    // ============================================================
    console.log('\n=== Step 6: Public Pool Detail ===');
    const publicDetailBtns = page.locator('button').filter({ hasText: '详情' });
    const publicDetailCount = await publicDetailBtns.count();
    console.log(`  Found ${publicDetailCount} "详情" buttons in public pool`);

    if (publicDetailCount > 0) {
      // Use force click to bypass any lingering masks
      await publicDetailBtns.first().click({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: ssPath('06-public-pool-detail.png'), fullPage: true });
      console.log('  Public pool detail drawer screenshot saved.');

      // Close the drawer via evaluate
      await page.evaluate(() => {
        const drawer = document.querySelector('.ant-drawer-open');
        if (drawer) {
          const closeBtn = drawer.querySelector('.ant-drawer-close') as HTMLElement;
          if (closeBtn) closeBtn.click();
        }
      });
      await page.waitForSelector('.ant-drawer-open', { state: 'detached', timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    }

    console.log('\n=== ALL DONE ===');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({ path: ssPath('ERROR-state.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
