/**
 * E2E Test: WAREHOUSE_CN (起运国仓管) Menu Verification
 *
 * This script navigates to every sidebar menu item visible to WAREHOUSE_CN,
 * takes screenshots, and verifies page loading, action buttons, and data.
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/web-warehouse-cn';

// Helper: wait for the page content area to stabilize
async function waitForContent(page: Page) {
  // Wait for Ant Design spin to disappear
  await page.waitForTimeout(500);
  // Try to wait for any loading spinners to go away
  const spinner = page.locator('.ant-spin-spinning');
  if (await spinner.count() > 0) {
    await spinner.first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  }
  await page.waitForTimeout(300);
}

// Helper: screenshot with name
async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

// Helper: click sidebar menu item by text
async function clickMenu(page: Page, menuLabel: string) {
  // Ant Design Menu items
  const menuItem = page.locator('.ant-menu-item').filter({ hasText: menuLabel }).first();
  await menuItem.waitFor({ state: 'visible', timeout: 5000 });
  await menuItem.click();
  await waitForContent(page);
}

// Helper: click a tab inside the content area
async function clickTab(page: Page, tabLabel: string) {
  const tab = page.locator('.ant-tabs-tab').filter({ hasText: tabLabel }).first();
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await waitForContent(page);
  }
}

// Helper: log page findings
function logFindings(findings: string[]) {
  console.log('  ' + findings.join('\n  '));
}

test.describe('WAREHOUSE_CN Menu Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Set a reasonable viewport
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('01 - Login as warehouse_cn1', async ({ page }) => {
    console.log('\n=== TEST 01: Login ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Find login form
    const usernameInput = page.locator('input').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await usernameInput.fill('warehouse_cn1');
    await passwordInput.fill('123456');

    // Click login button
    const loginBtn = page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first();
    await loginBtn.click();

    // Wait for dashboard to load
    await page.waitForTimeout(2000);
    await waitForContent(page);

    await shot(page, '01-login-dashboard');

    // Verify we're logged in - check for sidebar
    const sidebar = page.locator('.ant-layout-sider, .ant-menu-root').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    console.log('  LOGIN: SUCCESS - Dashboard loaded');
  });

  test('02 - Dashboard (工作台)', async ({ page }) => {
    console.log('\n=== TEST 02: 工作台 > 工作台 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Login first
    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    // Click 工作台 in sidebar
    await clickMenu(page, '工作台');
    await clickTab(page, '工作台');
    await shot(page, '02-dashboard');

    // Check for content
    const hasCards = await page.locator('.ant-card').count();
    const hasTable = await page.locator('.ant-table').count();
    const hasEmpty = await page.locator('text=功能开发中').count();
    const hasNoData = await page.locator('text=暂无数据').count();

    console.log(`  Cards: ${hasCards}, Tables: ${hasTable}, 功能开发中: ${hasEmpty}, 暂无数据: ${hasNoData}`);

    if (hasEmpty > 0) {
      console.log('  WARNING: "功能开发中" placeholder found');
    }
    if (hasCards === 0 && hasTable === 0 && hasNoData > 0) {
      console.log('  INFO: Page shows empty state');
    }
  });

  test('03 - 订单中心 > 订单列表', async ({ page }) => {
    console.log('\n=== TEST 03: 订单中心 > 订单列表 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    await clickMenu(page, '订单中心');
    await clickTab(page, '订单列表');
    await shot(page, '03-oms-order-list');

    const hasTable = await page.locator('.ant-table').count();
    const rows = await page.locator('.ant-table-tbody tr').count();
    const hasEmpty = await page.locator('text=功能开发中').count();
    const actionBtns = await page.locator('.ant-btn').count();

    console.log(`  Tables: ${hasTable}, Rows: ${rows}, Buttons: ${actionBtns}, 功能开发中: ${hasEmpty}`);

    if (rows > 0) {
      console.log('  DATA: Table has data rows');
    } else {
      console.log('  DATA: Table is empty or no data');
    }
  });

  test('04 - 起运国仓储 > 快递入库', async ({ page }) => {
    console.log('\n=== TEST 04: 起运国仓储 > 快递入库 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    await clickMenu(page, '起运国仓储');
    await clickTab(page, '快递入库');
    await shot(page, '04-wms-in-express');

    const hasTable = await page.locator('.ant-table').count();
    const rows = await page.locator('.ant-table-tbody tr').count();
    const hasEmpty = await page.locator('text=功能开发中').count();
    const actionBtns = await page.locator('.ant-btn').count();

    // Log visible button texts
    const btnTexts = await page.locator('.ant-btn span').allTextContents();

    console.log(`  Tables: ${hasTable}, Rows: ${rows}, Buttons: ${actionBtns}, 功能开发中: ${hasEmpty}`);
    console.log(`  Visible buttons: ${btnTexts.filter(t => t.trim()).join(', ')}`);
  });

  test('05 - 起运国仓储 > 调拨入库', async ({ page }) => {
    console.log('\n=== TEST 05: 起运国仓储 > 调拨入库 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    await clickMenu(page, '起运国仓储');
    await clickTab(page, '调拨入库');
    await shot(page, '05-wms-in-transfer');

    const hasTable = await page.locator('.ant-table').count();
    const rows = await page.locator('.ant-table-tbody tr').count();
    const hasEmpty = await page.locator('text=功能开发中').count();
    const btnTexts = await page.locator('.ant-btn span').allTextContents();

    console.log(`  Tables: ${hasTable}, Rows: ${rows}, 功能开发中: ${hasEmpty}`);
    console.log(`  Visible buttons: ${btnTexts.filter(t => t.trim()).join(', ')}`);
  });

  test('06 - 起运国仓储 > 退回入库', async ({ page }) => {
    console.log('\n=== TEST 06: 起运国仓储 > 退回入库 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    await clickMenu(page, '起运国仓储');
    await clickTab(page, '退回入库');
    await shot(page, '06-wms-in-return');

    const hasTable = await page.locator('.ant-table').count();
    const rows = await page.locator('.ant-table-tbody tr').count();
    const hasEmpty = await page.locator('text=功能开发中').count();
    const btnTexts = await page.locator('.ant-btn span').allTextContents();

    console.log(`  Tables: ${hasTable}, Rows: ${rows}, 功能开发中: ${hasEmpty}`);
    console.log(`  Visible buttons: ${btnTexts.filter(t => t.trim()).join(', ')}`);
  });

  test('07 - 起运国仓储 > 库存列表 + Detail Drawer', async ({ page }) => {
    console.log('\n=== TEST 07: 起运国仓储 > 库存列表 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    await clickMenu(page, '起运国仓储');
    await clickTab(page, '库存列表');
    await shot(page, '07-wms-stock-list');

    const hasTable = await page.locator('.ant-table').count();
    const rows = await page.locator('.ant-table-tbody tr').count();
    const hasEmpty = await page.locator('text=功能开发中').count();
    const btnTexts = await page.locator('.ant-btn span').allTextContents();

    console.log(`  Tables: ${hasTable}, Rows: ${rows}, 功能开发中: ${hasEmpty}`);
    console.log(`  Visible buttons: ${btnTexts.filter(t => t.trim()).join(', ')}`);

    // Try clicking on first data row to open detail drawer
    if (rows > 0) {
      const firstRow = page.locator('.ant-table-tbody tr').first();
      await firstRow.click();
      await page.waitForTimeout(1000);

      // Check for drawer
      const drawer = page.locator('.ant-drawer');
      const drawerVisible = await drawer.isVisible().catch(() => false);
      console.log(`  Drawer opened: ${drawerVisible}`);

      await shot(page, '07-wms-stock-list-drawer');

      // Close drawer if open
      if (drawerVisible) {
        const closeBtn = page.locator('.ant-drawer-close').first();
        await closeBtn.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    } else {
      console.log('  SKIP: No rows to click for detail drawer');
    }
  });

  test('08 - 起运国仓储 > 无订单快递', async ({ page }) => {
    console.log('\n=== TEST 08: 起运国仓储 > 无订单快递 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    await clickMenu(page, '起运国仓储');
    await clickTab(page, '无订单快递');
    await shot(page, '08-wms-noorder-express');

    const hasTable = await page.locator('.ant-table').count();
    const rows = await page.locator('.ant-table-tbody tr').count();
    const hasEmpty = await page.locator('text=功能开发中').count();
    const btnTexts = await page.locator('.ant-btn span').allTextContents();

    console.log(`  Tables: ${hasTable}, Rows: ${rows}, 功能开发中: ${hasEmpty}`);
    console.log(`  Visible buttons: ${btnTexts.filter(t => t.trim()).join(', ')}`);
  });

  test('09 - 起运国仓储 > 任务执行(海运)', async ({ page }) => {
    console.log('\n=== TEST 09: 起运国仓储 > 任务执行 (海运/SEA domain) ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    // Switch to 海运业务 domain first
    const domainSwitcher = page.locator('.ant-select').filter({ hasText: /海运|空运|综合/ }).first();
    if (await domainSwitcher.isVisible().catch(() => false)) {
      await domainSwitcher.click();
      await page.waitForTimeout(300);
      const seaOption = page.locator('.ant-select-item-option').filter({ hasText: '海运业务' }).first();
      if (await seaOption.isVisible().catch(() => false)) {
        await seaOption.click();
        await page.waitForTimeout(1000);
        await waitForContent(page);
      }
    }

    await clickMenu(page, '起运国仓储');
    await clickTab(page, '任务执行');
    await shot(page, '09-wms-task-execution-sea');

    const hasTable = await page.locator('.ant-table').count();
    const rows = await page.locator('.ant-table-tbody tr').count();
    const hasEmpty = await page.locator('text=功能开发中').count();
    const btnTexts = await page.locator('.ant-btn span').allTextContents();

    console.log(`  Domain: SEA (海运业务)`);
    console.log(`  Tables: ${hasTable}, Rows: ${rows}, 功能开发中: ${hasEmpty}`);
    console.log(`  Visible buttons: ${btnTexts.filter(t => t.trim()).join(', ')}`);
  });

  test('10 - 起运国仓储 > 调拨管理 + Detail Drawer', async ({ page }) => {
    console.log('\n=== TEST 10: 起运国仓储 > 调拨管理 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    await clickMenu(page, '起运国仓储');
    await clickTab(page, '调拨管理');
    await shot(page, '10-wms-transfer-list');

    const hasTable = await page.locator('.ant-table').count();
    const rows = await page.locator('.ant-table-tbody tr').count();
    const hasEmpty = await page.locator('text=功能开发中').count();
    const btnTexts = await page.locator('.ant-btn span').allTextContents();

    console.log(`  Tables: ${hasTable}, Rows: ${rows}, 功能开发中: ${hasEmpty}`);
    console.log(`  Visible buttons: ${btnTexts.filter(t => t.trim()).join(', ')}`);

    // Try clicking first row for detail drawer
    if (rows > 0) {
      const firstRow = page.locator('.ant-table-tbody tr').first();
      await firstRow.click();
      await page.waitForTimeout(1000);

      const drawer = page.locator('.ant-drawer');
      const drawerVisible = await drawer.isVisible().catch(() => false);
      console.log(`  Drawer opened: ${drawerVisible}`);

      await shot(page, '10-wms-transfer-list-drawer');

      if (drawerVisible) {
        const closeBtn = page.locator('.ant-drawer-close').first();
        await closeBtn.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    } else {
      console.log('  SKIP: No rows to click for detail drawer');
    }
  });

  test('11 - 起运国仓储 > 退运处理 + 新建 Form', async ({ page }) => {
    console.log('\n=== TEST 11: 起运国仓储 > 退运处理 ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    await clickMenu(page, '起运国仓储');
    await clickTab(page, '退运处理');
    await shot(page, '11-wms-return-process');

    const hasTable = await page.locator('.ant-table').count();
    const rows = await page.locator('.ant-table-tbody tr').count();
    const hasEmpty = await page.locator('text=功能开发中').count();
    const btnTexts = await page.locator('.ant-btn span').allTextContents();

    console.log(`  Tables: ${hasTable}, Rows: ${rows}, 功能开发中: ${hasEmpty}`);
    console.log(`  Visible buttons: ${btnTexts.filter(t => t.trim()).join(', ')}`);

    // Try clicking "新建" button
    const createBtn = page.locator('button').filter({ hasText: /新建|创建|新增/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1500);

      // Check for modal or drawer
      const modal = page.locator('.ant-modal');
      const drawer = page.locator('.ant-drawer');
      const modalVisible = await modal.isVisible().catch(() => false);
      const drawerVisible = await drawer.isVisible().catch(() => false);

      console.log(`  Create modal visible: ${modalVisible}, drawer visible: ${drawerVisible}`);

      await shot(page, '11-wms-return-process-create-form');

      // Close
      if (modalVisible) {
        const cancelBtn = page.locator('.ant-modal .ant-btn').filter({ hasText: /取消|关闭/i }).first();
        await cancelBtn.click().catch(() => {});
      }
      if (drawerVisible) {
        const closeBtn = page.locator('.ant-drawer-close').first();
        await closeBtn.click().catch(() => {});
      }
      await page.waitForTimeout(500);
    } else {
      console.log('  NO "新建" button found on this page');
    }
  });

  test('12 - Verify hidden menus for WAREHOUSE_CN', async ({ page }) => {
    console.log('\n=== TEST 12: Verify menus NOT visible to WAREHOUSE_CN ===');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.locator('input').first().fill('warehouse_cn1');
    await page.locator('input[type="password"]').first().fill('123456');
    await page.locator('button').filter({ hasText: /登录|登 录|Login/i }).first().click();
    await page.waitForTimeout(2000);
    await waitForContent(page);

    // Get all visible sidebar menu items
    const menuItems = await page.locator('.ant-menu-item').allTextContents();
    const menuLabels = menuItems.map(t => t.replace(/\s+/g, ' ').trim()).filter(t => t.length > 0);

    console.log('  Visible sidebar menus:');
    menuLabels.forEach(label => console.log(`    - ${label}`));

    // Expected visible: 工作台, 订单中心, 起运国仓储
    // Expected hidden: 客户中心, 起运国办, 到达国仓储, 财务中心, 系统管理

    const shouldBeVisible = ['工作台', '订单中心', '起运国仓储'];
    const shouldBeHidden = ['客户中心', '起运国办', '到达国仓储', '财务中心', '系统管理'];

    for (const item of shouldBeVisible) {
      const found = menuLabels.some(l => l.startsWith(item));
      console.log(`  ${found ? 'PASS' : 'FAIL'}: "${item}" should be visible - ${found ? 'YES' : 'NO'}`);
    }
    for (const item of shouldBeHidden) {
      const found = menuLabels.some(l => l.startsWith(item));
      console.log(`  ${found ? 'FAIL' : 'PASS'}: "${item}" should be hidden - ${found ? 'FOUND!' : 'NOT found'}`);
    }

    await shot(page, '12-sidebar-menu-overview');
  });
});
