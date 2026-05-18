import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/web-warehouse-cn';
const BASE_URL = 'http://localhost:5173';

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const REPORT = [];
function log(msg) {
  const line = `[${new Date().toISOString().substr(11, 8)}] ${msg}`;
  console.log(line);
  REPORT.push(line);
}

function summarize(label, text) {
  log(`  >>> ${label}: ${text}`);
}

async function screenshot(page, name) {
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  log(`  📸 Screenshot: ${path}`);
  return path;
}

async function findButtons(page) {
  const buttons = await page.$$eval('button, a.ant-btn, [role="button"]', els =>
    els.map(el => ({
      text: (el.textContent || '').trim().replace(/\s+/g, ' '),
      tag: el.tagName,
      disabled: el.hasAttribute('disabled') || el.classList.contains('ant-btn-disabled'),
      className: el.className?.toString() || '',
    }))
  );
  // Deduplicate and filter
  const seen = new Set();
  const unique = buttons.filter(b => {
    if (!b.text || b.text.length === 0 || b.text.length > 60) return false;
    const key = `${b.text}|${b.disabled}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique;
}

async function findActionButtons(page) {
  // Look for buttons in action bars, toolbars, table row actions
  const allButtons = await findButtons(page);
  // Filter to actionable buttons (排除纯导航类)
  const actionKeywords = ['新建', '添加', '编辑', '删除', '查看', '详情', '打印', '导出',
    '入库', '出库', '调拨', '退运', '装箱', '发车', '确认', '取消', '保存', '提交',
    '审核', '审批', '通过', '驳回', '扫描', '签收', '派送', '关闭', '刷新', '查询',
    '搜索', '重置', '批量', '生成', '下载', '上传', '导入', '登记', '新增'];
  return allButtons.filter(b =>
    actionKeywords.some(kw => b.text.includes(kw)) || b.text.length <= 4
  );
}

async function findEmptyState(page) {
  try {
    const empty = await page.$('.ant-empty, .ant-result, [class*="empty"]');
    return empty ? await empty.textContent() : null;
  } catch { return null; }
}

async function findTableRows(page) {
  return await page.$$eval('.ant-table-tbody tr.ant-table-row', rows =>
    rows.length
  );
}

// ---- Page-specific test functions ----

async function testPage(page, menuLabel, tabLabel, pageName, options = {}) {
  const { skipMenuClick = false, waitAfter = 1500, extraActions } = options;

  log(`\n=== Testing: ${pageName} ===`);
  if (menuLabel && !skipMenuClick) {
    // For sub-menus under a parent, we click the parent first then sub-item
    // Actually, the App.tsx handlesMenuClick by key, so clicking a menu item triggers navigation
    // Let me use a different approach - look at how the menu actually renders
  }

  await page.waitForTimeout(waitAfter);

  // Check empty state
  const emptyState = await findEmptyState(page);
  if (emptyState) summarize('Empty State', emptyState.trim());

  // Count table rows
  const rowCount = await findTableRows(page);
  summarize('Table Rows', `${rowCount} rows`);

  // List visible action buttons
  const actions = await findActionButtons(page);
  const disabledActions = actions.filter(a => a.disabled);
  const enabledActions = actions.filter(a => !a.disabled);

  if (enabledActions.length > 0) {
    summarize('Enabled Buttons', enabledActions.map(a => a.text).join(' | '));
  }
  if (disabledActions.length > 0) {
    summarize('DISABLED Buttons', disabledActions.map(a => a.text).join(' | '));
  }

  await screenshot(page, `web-warehouse-cn--${pageName.replace(/[/\\ ]/g, '-')}`);

  if (extraActions) {
    await extraActions(page);
  }

  return { emptyState, rowCount, enabledActions, disabledActions };
}

// ---- Main test flow ----

(async () => {
  log('🚀 Starting WAREHOUSE_CN E2E Test');
  log(`Screenshots: ${SCREENSHOT_DIR}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  try {
    // ====== STEP 1: LOGIN ======
    log('\n========== STEP 1: LOGIN ==========');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Fill login form
    await page.fill('input[id="username"], input[placeholder="用户名"]', 'warehouse_cn1');
    await page.fill('input[id="password"], input[placeholder="密码"]', '123456');
    await page.waitForTimeout(300);

    // Click login button
    await page.click('button[type="submit"], button:has-text("登 录")');
    await page.waitForTimeout(2000);

    // Verify we're logged in
    const userNameInHeader = await page.$eval('header', el => el.textContent || '').catch(() => '');
    log(`Header after login: ${userNameInHeader.includes('李仓管') ? 'OK - 李仓管' : userNameInHeader.trim()}`);

    // WAREHOUSE_CN defaults to SEA domain
    log('Default domain: should be 海运业务');

    // ====== STEP 2: DASHBOARD ======
    log('\n========== STEP 2: DASHBOARD (工作台) ==========');
    await page.waitForTimeout(2000);
    await screenshot(page, 'web-warehouse-cn--01-dashboard');

    // Find all visible sidebar menu items
    const menuItems = await page.$$eval('.ant-menu-item', items =>
      items.map(i => ({
        text: (i.textContent || '').trim(),
        classList: [...i.classList].join(' '),
      }))
    );
    log('Sidebar menu items:');
    menuItems.forEach(m => log(`  - ${m.text}`));

    // Find submenu items
    const subMenuItems = await page.$$eval('.ant-menu-submenu', items =>
      items.map(i => ({
        text: (i.textContent || '').trim(),
        classList: [...i.classList].join(' '),
      }))
    );
    log('Sidebar submenus:');
    subMenuItems.forEach(m => log(`  - ${m.text}`));

    // ====== STEP 3: CLICK THROUGH EACH MENU ======

    // Get sidebar structure
    // Menu structure for WAREHOUSE_CN:
    // 1. 工作台 (dashboard) - already on it
    // 2. 订单中心 (oms) -> 订单列表
    // 3. 起运国仓储 (wms_origin) -> 9 sub-pages

    // Helper: click sidebar menu item by text
    async function clickMenu(text) {
      log(`  Clicking menu: "${text}"`);
      const menuItem = page.locator(`.ant-menu-item:has-text("${text}"), .ant-menu-submenu-title:has-text("${text}")`);
      await menuItem.click();
      await page.waitForTimeout(1500);
    }

    // Helper: click submenu (when it pops up after clicking parent)
    async function clickSubMenu(parentText, childText) {
      log(`  Opening submenu: "${parentText}" -> "${childText}"`);
      // First open the submenu
      const submenu = page.locator(`.ant-menu-submenu-title:has-text("${parentText}")`);
      await submenu.click();
      await page.waitForTimeout(800);

      // Then click the child item
      const child = page.locator(`.ant-menu-item:has-text("${childText}")`);
      await child.click();
      await page.waitForTimeout(1500);
    }

    // --- 3a. 订单中心 > 订单列表 ---
    log('\n========== STEP 3a: 订单中心 > 订单列表 ==========');
    await clickMenu('订单中心');
    await page.waitForTimeout(500); // Wait for sub-tabs
    await testPage(page, '订单中心', '订单列表', '02-订单列表');

    // --- 3b. 起运国仓储 pages ---
    // Open the submenu first
    log('\n========== STEP 3b: 起运国仓储 Submenu ==========');
    await clickMenu('起运国仓储');
    await page.waitForTimeout(1000);

    // the submenu should show all tabs for wms_origin
    // But the tab names are: 快递入库, 调拨入库, 退回入库, 库存列表, 无订单快递, 任务执行(SEA), 任务执行(AIR), 调拨管理, 退运处理

    // Wait, in the sidebar, wms_origin is a single menu item with sub-tabs shown as tab bar at top
    // Let me click the submenu then find the child items

    // The app structure: when wms_origin is the activeMenuKey, the Tabs component shows at top
    // But in sidebar, we need to click individual submenu items

    // Actually looking at the code more carefully:
    // MENU_CONFIG has wms_origin with tabs array (no children)
    // So the sidebar renders as a single menu item "起运国仓储"
    // Clicking it sets activeMenuKey='wms_origin'
    // Then the Tabs component shows the sub-tabs at the top of content area

    // So I should click "起运国仓储" in sidebar, then use the tab bar to navigate between sub-pages

    await clickMenu('起运国仓储');
    await page.waitForTimeout(1500);

    // Now we should see the tabs at top of content area
    const tabs = await page.$$eval('.ant-tabs-tab', tabs =>
      tabs.map(t => t.textContent?.trim() || '')
    );
    log(`Tabs visible: ${tabs.join(' | ')}`);

    // Click through each tab
    async function clickTab(tabLabel) {
      log(`  Switching to tab: "${tabLabel}"`);
      const tab = page.locator(`.ant-tabs-tab:has-text("${tabLabel}")`);
      await tab.click();
      await page.waitForTimeout(1500);
    }

    // 快递入库
    log('\n--- 快递入库 ---');
    await clickTab('快递入库');
    await testPage(page, null, '快递入库', '03a-快递入库', {
      extraActions: async () => {
        // Try clicking a row to see if there's a detail drawer
        const firstRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
        if (await firstRow.count() > 0) {
          await firstRow.click();
          await page.waitForTimeout(1000);
          // Check for drawer
          const drawer = await page.$('.ant-drawer, .ant-modal');
          if (drawer) {
            log('  ✅ Detail drawer/modal opened');
            await screenshot(page, 'web-warehouse-cn--03a-快递入库-detail');
            // Close it
            const closeBtn = page.locator('.ant-drawer-close, .ant-modal-close, button:has-text("关闭"), button:has-text("取消")').first();
            if (await closeBtn.count() > 0) await closeBtn.click();
            await page.waitForTimeout(500);
          } else {
            log('  ℹ️ No detail drawer on row click');
          }
        } else {
          log('  ℹ️ No rows to click');
        }
      }
    });

    // 调拨入库
    log('\n--- 调拨入库 ---');
    await clickTab('调拨入库');
    await testPage(page, null, '调拨入库', '03b-调拨入库', {
      extraActions: async () => {
        const firstRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
        if (await firstRow.count() > 0) {
          await firstRow.click();
          await page.waitForTimeout(1000);
          const drawer = await page.$('.ant-drawer, .ant-modal');
          if (drawer) {
            log('  ✅ Detail drawer/modal opened');
            await screenshot(page, 'web-warehouse-cn--03b-调拨入库-detail');
            const closeBtn = page.locator('.ant-drawer-close, .ant-modal-close, button:has-text("关闭"), button:has-text("取消")').first();
            if (await closeBtn.count() > 0) await closeBtn.click();
            await page.waitForTimeout(500);
          }
        }
      }
    });

    // 退回入库
    log('\n--- 退回入库 ---');
    await clickTab('退回入库');
    await testPage(page, null, '退回入库', '03c-退回入库', {
      extraActions: async () => {
        const firstRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
        if (await firstRow.count() > 0) {
          await firstRow.click();
          await page.waitForTimeout(1000);
          const drawer = await page.$('.ant-drawer, .ant-modal');
          if (drawer) {
            log('  ✅ Detail drawer/modal opened');
            await screenshot(page, 'web-warehouse-cn--03c-退回入库-detail');
            const closeBtn = page.locator('.ant-drawer-close, .ant-modal-close, button:has-text("关闭"), button:has-text("取消")').first();
            if (await closeBtn.count() > 0) await closeBtn.click();
            await page.waitForTimeout(500);
          }
        }
      }
    });

    // 库存列表
    log('\n--- 库存列表 ---');
    await clickTab('库存列表');
    await testPage(page, null, '库存列表', '03d-库存列表', {
      extraActions: async () => {
        // Click a row to open detail drawer
        const firstRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
        if (await firstRow.count() > 0) {
          await firstRow.click();
          await page.waitForTimeout(1500);
          const drawer = await page.$('.ant-drawer');
          if (drawer) {
            log('  ✅ Stock detail drawer opened');
            await screenshot(page, 'web-warehouse-cn--03d-库存列表-detail');
            const closeBtn = page.locator('.ant-drawer-close, button:has-text("关闭")').first();
            if (await closeBtn.count() > 0) await closeBtn.click();
            await page.waitForTimeout(500);
          }
        }
      }
    });

    // 无订单快递
    log('\n--- 无订单快递 ---');
    await clickTab('无订单快递');
    await testPage(page, null, '无订单快递', '03e-无订单快递');

    // 任务执行(海运) - currently on SEA domain
    log('\n--- 任务执行(海运) ---');
    // Need to make sure we're on SEA domain
    // First, check what tabs are available. There may be TWO "任务执行" tabs (SEA vs AIR)
    // But domain filtering means only one shows at a time
    await clickTab('任务执行');
    await testPage(page, null, '任务执行', '03f-任务执行-海运', {
      extraActions: async (pg) => {
        // Check what actions are available on the container table
        // Look for action columns in table rows
        const actionCells = await pg.$$eval('.ant-table-tbody tr.ant-table-row td:last-child', cells =>
          cells.map(c => c.textContent?.trim() || '')
        );
        log(`  Action column content examples: ${actionCells.slice(0, 5).join(' | ')}`);

        // List all buttons visible
        const allBtns = await findButtons(pg);
        log(`  All visible buttons: ${allBtns.map(b => b.text + (b.disabled ? '(disabled)' : '')).join(' | ')}`);

        // Click first row to see detail drawer
        const firstRow = pg.locator('.ant-table-tbody tr.ant-table-row').first();
        if (await firstRow.count() > 0) {
          await firstRow.click();
          await pg.waitForTimeout(1000);
          const drawer = await pg.$('.ant-drawer, .ant-modal');
          if (drawer) {
            log('  ✅ Container detail opened');
            await screenshot(pg, 'web-warehouse-cn--03f-任务执行-海运-detail');
            const closeBtn = pg.locator('.ant-drawer-close, .ant-modal-close').first();
            if (await closeBtn.count() > 0) await closeBtn.click();
            await pg.waitForTimeout(500);
          }
        }
      }
    });

    // Switch to AIR domain for 任务执行(空运)
    log('\n--- Switching to AIR domain ---');
    const airDomainTab = page.locator('.ant-menu-horizontal .ant-menu-item:has-text("空运")');
    if (await airDomainTab.count() > 0) {
      await airDomainTab.click();
      await page.waitForTimeout(1500);
      log('  Switched to 空运业务 domain');
    }

    // Need to re-click 起运国仓储 after domain switch
    await clickMenu('起运国仓储');
    await page.waitForTimeout(1500);

    // 任务执行(空运)
    log('\n--- 任务执行(空运) ---');
    await clickTab('任务执行');
    await testPage(page, null, '任务执行', '03g-任务执行-空运', {
      extraActions: async (pg) => {
        const allBtns = await findButtons(pg);
        log(`  All visible buttons: ${allBtns.map(b => b.text + (b.disabled ? '(disabled)' : '')).join(' | ')}`);

        const firstRow = pg.locator('.ant-table-tbody tr.ant-table-row').first();
        if (await firstRow.count() > 0) {
          await firstRow.click();
          await pg.waitForTimeout(1000);
          const drawer = await pg.$('.ant-drawer, .ant-modal');
          if (drawer) {
            log('  ✅ Air cargo detail opened');
            await screenshot(pg, 'web-warehouse-cn--03g-任务执行-空运-detail');
            const closeBtn = pg.locator('.ant-drawer-close, .ant-modal-close').first();
            if (await closeBtn.count() > 0) await closeBtn.click();
            await pg.waitForTimeout(500);
          }
        }
      }
    });

    // Switch back to SEA domain
    log('\n--- Switching back to SEA domain ---');
    const seaDomainTab = page.locator('.ant-menu-horizontal .ant-menu-item:has-text("海运")');
    if (await seaDomainTab.count() > 0) {
      await seaDomainTab.click();
      await page.waitForTimeout(1500);
    }

    // Re-click 起运国仓储 after domain switch
    await clickMenu('起运国仓储');
    await page.waitForTimeout(1500);

    // 调拨管理
    log('\n--- 调拨管理 ---');
    await clickTab('调拨管理');
    await testPage(page, null, '调拨管理', '03h-调拨管理', {
      extraActions: async (pg) => {
        // Click a row to see detail
        const firstRow = pg.locator('.ant-table-tbody tr.ant-table-row').first();
        if (await firstRow.count() > 0) {
          await firstRow.click();
          await pg.waitForTimeout(1500);
          const drawer = await pg.$('.ant-drawer, .ant-modal');
          if (drawer) {
            log('  ✅ Transfer detail opened');
            await screenshot(pg, 'web-warehouse-cn--03h-调拨管理-detail');
            const closeBtn = pg.locator('.ant-drawer-close, .ant-modal-close').first();
            if (await closeBtn.count() > 0) await closeBtn.click();
            await pg.waitForTimeout(500);
          }
        }
      }
    });

    // 退运处理
    log('\n--- 退运处理 ---');
    await clickTab('退运处理');
    await testPage(page, null, '退运处理', '03i-退运处理', {
      extraActions: async (pg) => {
        // Click 新建 button
        const newBtn = pg.locator('button:has-text("新建"), button:has-text("新增")').first();
        if (await newBtn.count() > 0) {
          await newBtn.click();
          await pg.waitForTimeout(1500);
          const drawer = await pg.$('.ant-drawer, .ant-modal');
          if (drawer) {
            log('  ✅ New return form opened');
            await screenshot(pg, 'web-warehouse-cn--03i-退运处理-新建表单');

            // List form fields
            const formItems = await pg.$$eval('.ant-form-item', items =>
              items.map(i => ({
                label: i.querySelector('.ant-form-item-label')?.textContent?.trim() || '',
                hasInput: !!i.querySelector('input, textarea, .ant-select'),
              }))
            );
            log(`  Form fields: ${formItems.map(f => f.label).join(' | ')}`);

            // Close
            const closeBtn = pg.locator('.ant-drawer-close, .ant-modal-close, button:has-text("取消")').first();
            if (await closeBtn.count() > 0) await closeBtn.click();
            await pg.waitForTimeout(500);
          }
        } else {
          log('  ℹ️ No 新建 button found');
        }
      }
    });

    // ====== STEP 4: FINAL REPORT ======
    log('\n\n' + '='.repeat(60));
    log('FINAL REPORT');
    log('='.repeat(60));
    for (const line of REPORT) {
      console.log(line);
    }

  } catch (err) {
    log(`❌ ERROR: ${err.message}`);
    console.error(err);
    await screenshot(page, 'web-warehouse-cn--ERROR-state');
  } finally {
    await browser.close();
    log('\n🏁 Test complete. Browser closed.');
    // Write report to file
    writeFileSync(
      join(SCREENSHOT_DIR, 'report.txt'),
      REPORT.join('\n'),
      'utf-8'
    );
  }
})();
