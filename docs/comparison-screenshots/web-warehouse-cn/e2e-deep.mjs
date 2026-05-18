import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = '/Users/mac/Documents/code/111/docs/comparison-screenshots/web-warehouse-cn';
const BASE_URL = 'http://localhost:5173';

mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshot(page, name) {
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  📸 ${path}`);
}

async function closeAnyOverlay(page) {
  // Try multiple methods to close any open drawer/modal
  try {
    // 1. Close button
    const closeBtn = page.locator('.ant-drawer-close, .ant-modal-close').first();
    if (await closeBtn.count() > 0 && await closeBtn.isVisible({ timeout: 300 })) {
      await closeBtn.click({ timeout: 1000 });
      await page.waitForTimeout(600);
      return true;
    }
  } catch {}
  try {
    // 2. Mask click
    const mask = page.locator('.ant-drawer-mask, .ant-modal-mask').first();
    if (await mask.count() > 0 && await mask.isVisible({ timeout: 300 })) {
      await mask.click({ position: { x: 5, y: 5 }, timeout: 1000 });
      await page.waitForTimeout(600);
      return true;
    }
  } catch {}
  try {
    // 3. Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  } catch {}
  return false;
}

(async () => {
  console.log('Starting WAREHOUSE_CN Deep Interaction Pass (v2)');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();

  try {
    // ====== LOGIN ======
    console.log('\n--- LOGIN ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.fill('input[id="username"], input[placeholder="用户名"]', 'warehouse_cn1');
    await page.fill('input[id="password"], input[placeholder="密码"]', '123456');
    await page.click('button[type="submit"], button:has-text("登 录")');
    await page.waitForTimeout(2000);
    console.log('Logged in as 李仓管 (WAREHOUSE_CN)');

    async function gotoOriginWarehouse() {
      const btn = page.locator('.ant-menu-item:has-text("起运国仓储")');
      await btn.click();
      await page.waitForTimeout(1500);
    }

    async function clickTab(label) {
      console.log(`  Switching to tab: "${label}"`);
      const tab = page.locator(`.ant-tabs-tab:has-text("${label}")`);
      await tab.click();
      await page.waitForTimeout(1500);
    }

    // Ensure domain is SEA
    const seaDomainTab = page.locator('.ant-menu-horizontal .ant-menu-item:has-text("海运")');
    if (await seaDomainTab.count() > 0) { await seaDomainTab.click(); await page.waitForTimeout(1000); }

    // ====== 1. 库存列表 - 详情 Drawer ======
    console.log('\n=== 1. 库存列表 - Open Detail Drawer ===');
    await gotoOriginWarehouse();
    await closeAnyOverlay(page);
    await clickTab('库存列表');

    const stockFirstRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
    if (await stockFirstRow.count() > 0) {
      // Click 详情 link button
      const detailLink = stockFirstRow.locator('a, button').filter({ hasText: '详情' }).first();
      if (await detailLink.count() > 0) {
        await detailLink.click({ force: true });
        await page.waitForTimeout(1500);
        const drawer = page.locator('.ant-drawer');
        if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  ✅ Stock detail Drawer opened');
          await screenshot(page, 'web-warehouse-cn--03d-库存列表-detail-drawer');

          const drawerText = await drawer.locator('.ant-descriptions').textContent().catch(() => '');
          console.log(`  Drawer content excerpt: ${drawerText?.substring(0, 300)}`);

          // Close
          await closeAnyOverlay(page);
        } else {
          console.log('  ⚠️ Detail drawer did not open');
        }
      }
    }

    // ====== 2. 库存列表 - 编辑 Modal ======
    console.log('\n=== 2. 库存列表 - Edit Modal ===');
    await closeAnyOverlay(page);
    const secondRow = page.locator('.ant-table-tbody tr.ant-table-row').nth(1);
    if (await secondRow.count() > 0) {
      const editBtn = secondRow.locator('a, button').filter({ hasText: '编辑' }).first();
      if (await editBtn.count() > 0) {
        await editBtn.click({ force: true });
        await page.waitForTimeout(1500);
        const modal = page.locator('.ant-modal');
        if (await modal.count() > 0 && await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  ✅ Stock edit Modal opened');
          await screenshot(page, 'web-warehouse-cn--03d-库存列表-edit-modal');

          const formLabels = await modal.locator('.ant-form-item-label').all();
          const labels = [];
          for (const f of formLabels) {
            labels.push((await f.textContent())?.trim() || '');
          }
          console.log(`  Form fields: ${labels.join(' | ')}`);
          await closeAnyOverlay(page);
        } else {
          console.log('  ⚠️ Edit modal did not open');
        }
      }
    }

    // ====== 3. 库存列表 - 退运 Modal ======
    console.log('\n=== 3. 库存列表 - Return Modal ===');
    await closeAnyOverlay(page);
    const thirdRow = page.locator('.ant-table-tbody tr.ant-table-row').nth(2);
    if (await thirdRow.count() > 0) {
      const returnBtn = thirdRow.locator('a, button').filter({ hasText: '退运' }).first();
      if (await returnBtn.count() === 0) {
        // Try first row again
        const altReturnBtn = page.locator('.ant-table-tbody tr.ant-table-row').first().locator('a, button').filter({ hasText: '退运' }).first();
        if (await altReturnBtn.count() > 0) {
          await altReturnBtn.click({ force: true });
          await page.waitForTimeout(1500);
          const modal = page.locator('.ant-modal');
          if (await modal.count() > 0 && await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log('  ✅ Stock return Modal opened');
            await screenshot(page, 'web-warehouse-cn--03d-库存列表-return-modal');
            await closeAnyOverlay(page);
          }
        }
      } else {
        await returnBtn.click({ force: true });
        await page.waitForTimeout(1500);
        const modal = page.locator('.ant-modal');
        if (await modal.count() > 0 && await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  ✅ Stock return Modal opened');
          await screenshot(page, 'web-warehouse-cn--03d-库存列表-return-modal');
          await closeAnyOverlay(page);
        }
      }
    }

    // ====== 4. 快递入库 - Detail (补充) ======
    console.log('\n=== 4. 快递入库 - Supplement/Drawer ===');
    await gotoOriginWarehouse();
    await closeAnyOverlay(page);
    await clickTab('快递入库');

    // Look for buttons in first row: 补充, 打印面单, 详情
    const expressFirstRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
    if (await expressFirstRow.count() > 0) {
      // Try 补充 button
      const supplementBtn = expressFirstRow.locator('a, button').filter({ hasText: '补充' }).first();
      if (await supplementBtn.count() > 0) {
        await supplementBtn.click({ force: true });
        await page.waitForTimeout(1500);
        const drawer = page.locator('.ant-drawer');
        if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  ✅ Express supplement Drawer opened');
          await screenshot(page, 'web-warehouse-cn--03a-快递入库-supplement-drawer');
          await closeAnyOverlay(page);
        }
      }
    }

    // 添加三方快递 modal
    console.log('\n--- 4b. 添加三方快递 ---');
    await closeAnyOverlay(page);
    const addWaybillBtn = page.locator('button:has-text("添加三方快递")').first();
    if (await addWaybillBtn.count() > 0) {
      await addWaybillBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const modal = page.locator('.ant-modal');
      if (await modal.count() > 0 && await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  ✅ Add waybill Modal opened');
        await screenshot(page, 'web-warehouse-cn--03a-快递入库-add-waybill-modal');
        await closeAnyOverlay(page);
      }
    }

    // ====== 5. 调拨入库 - 清单 ======
    console.log('\n=== 5. 调拨入库 - 清单 Drawer ===');
    await closeAnyOverlay(page);
    await clickTab('调拨入库');
    const transferInRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
    if (await transferInRow.count() > 0) {
      const billBtn = transferInRow.locator('a, button').filter({ hasText: '清单' }).first();
      if (await billBtn.count() > 0) {
        await billBtn.click({ force: true });
        await page.waitForTimeout(1500);
        const drawer = page.locator('.ant-drawer');
        if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  ✅ Transfer-in bill Drawer opened');
          await screenshot(page, 'web-warehouse-cn--03b-调拨入库-bill-drawer');
          await closeAnyOverlay(page);
        }
      }
    }

    // ====== 6. 退回入库 - 清单 ======
    console.log('\n=== 6. 退回入库 - 清单 Drawer ===');
    await closeAnyOverlay(page);
    await clickTab('退回入库');
    const returnInRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
    if (await returnInRow.count() > 0) {
      const billBtn = returnInRow.locator('a, button').filter({ hasText: '清单' }).first();
      if (await billBtn.count() > 0) {
        await billBtn.click({ force: true });
        await page.waitForTimeout(1500);
        const drawer = page.locator('.ant-drawer');
        if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  ✅ Return-in bill Drawer opened');
          await screenshot(page, 'web-warehouse-cn--03c-退回入库-bill-drawer');
          await closeAnyOverlay(page);
        }
      }
    }

    // ====== 7. 任务执行(海运) - 详情, 集装号, 创建线路 ======
    console.log('\n=== 7. 任务执行(海运) Deep Dive ===');
    // Ensure SEA domain
    const seaDomain = page.locator('.ant-menu-horizontal .ant-menu-item:has-text("海运")');
    if (await seaDomain.count() > 0) { await seaDomain.click(); await page.waitForTimeout(1000); }
    await gotoOriginWarehouse();
    await closeAnyOverlay(page);
    await clickTab('任务执行');

    const seaTaskFirstRow = page.locator('.ant-table-tbody tr.ant-table-row').first();
    if (await seaTaskFirstRow.count() > 0) {
      // 7a. 创建线路
      console.log('  7a. Create Route');
      const createRouteBtn = page.locator('button:has-text("创建线路")').first();
      if (await createRouteBtn.count() > 0) {
        await createRouteBtn.click({ force: true });
        await page.waitForTimeout(1500);
        const modal = page.locator('.ant-modal');
        if (await modal.count() > 0 && await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  ✅ Create route Modal');
          await screenshot(page, 'web-warehouse-cn--03f-任务执行-海运-create-route-modal');
          // List form fields
          const formItems = await modal.locator('.ant-form-item-label').all();
          const labels = [];
          for (const f of formItems) labels.push((await f.textContent())?.trim() || '');
          console.log(`  Form fields: ${labels.join(' | ')}`);
          await closeAnyOverlay(page);
        }
      }

      // 7b. 详情
      console.log('  7b. Detail');
      await closeAnyOverlay(page);
      const seaDetailBtn = seaTaskFirstRow.locator('a, button').filter({ hasText: '详情' }).first();
      if (await seaDetailBtn.count() > 0) {
        await seaDetailBtn.click({ force: true });
        await page.waitForTimeout(1500);
        const drawer = page.locator('.ant-drawer');
        if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  ✅ Sea task detail Drawer');
          await screenshot(page, 'web-warehouse-cn--03f-任务执行-海运-detail-drawer');
          await closeAnyOverlay(page);
        }
      }

      // 7c. 集装箱 (since this is SEA mode, button should say "集装箱")
      console.log('  7c. Container Management');
      await closeAnyOverlay(page);
      const containerBtn = seaTaskFirstRow.locator('a, button').filter({ hasText: /集装/ }).first();
      if (await containerBtn.count() > 0) {
        const btnText = await containerBtn.textContent();
        console.log(`  Button text: "${btnText?.trim()}"`);
        await containerBtn.click({ force: true });
        await page.waitForTimeout(1500);
        const drawer = page.locator('.ant-drawer');
        if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  ✅ Unit/Container Drawer opened');
          await screenshot(page, 'web-warehouse-cn--03f-任务执行-海运-unit-drawer');
          // Check drawer buttons
          const drawerBtns = await drawer.locator('button').all();
          const btnTexts = [];
          for (const b of drawerBtns) {
            const t = await b.textContent();
            if (t?.trim()) btnTexts.push(t.trim());
          }
          console.log(`  Drawer buttons: ${btnTexts.slice(0, 15).join(' | ')}`);
          await closeAnyOverlay(page);
        }
      }

      // 7d. 执行出库
      console.log('  7d. Execute Task');
      await closeAnyOverlay(page);
      const execBtn = page.locator('button:has-text("执行出库")').first();
      if (await execBtn.count() > 0) {
        await execBtn.click({ force: true });
        await page.waitForTimeout(1500);
        const modal = page.locator('.ant-modal');
        if (await modal.count() > 0 && await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('  ✅ Execute modal opened');
          await screenshot(page, 'web-warehouse-cn--03f-任务执行-海运-execute-modal');
          await closeAnyOverlay(page);
        }
      }
    }

    // ====== 8. 调拨管理 - Detail & Create ======
    console.log('\n=== 8. 调拨管理 Deep Dive ===');
    await closeAnyOverlay(page);
    await clickTab('调拨管理');

    // 8a. 创建调拨单
    console.log('  8a. Create Transfer');
    const createTransferBtn = page.locator('button:has-text("创建调拨单")').first();
    if (await createTransferBtn.count() > 0) {
      await createTransferBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const modal = page.locator('.ant-modal');
      if (await modal.count() > 0 && await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  ✅ Create transfer Modal');
        await screenshot(page, 'web-warehouse-cn--03h-调拨管理-create-modal');
        const formItems = await modal.locator('.ant-form-item-label').all();
        const labels = [];
        for (const f of formItems) labels.push((await f.textContent())?.trim() || '');
        console.log(`  Form fields: ${labels.join(' | ')}`);
        await closeAnyOverlay(page);
      }
    }

    // 8b. 详情
    console.log('  8b. Detail');
    await closeAnyOverlay(page);
    const transferDetailBtn = page.locator('.ant-table-tbody tr.ant-table-row').first().locator('a, button').filter({ hasText: '详情' }).first();
    if (await transferDetailBtn.count() > 0) {
      await transferDetailBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const drawer = page.locator('.ant-drawer');
      if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  ✅ Transfer detail Drawer');
        await screenshot(page, 'web-warehouse-cn--03h-调拨管理-detail-drawer');
        await closeAnyOverlay(page);
      }
    }

    // 8c. 绑定运单
    console.log('  8c. Bind Orders');
    await closeAnyOverlay(page);
    const bindBtn = page.locator('.ant-table-tbody tr.ant-table-row').first().locator('a, button').filter({ hasText: '绑定运单' }).first();
    if (await bindBtn.count() > 0) {
      await bindBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const drawer = page.locator('.ant-drawer');
      if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  ✅ Bind orders Drawer');
        await screenshot(page, 'web-warehouse-cn--03h-调拨管理-bind-drawer');
        await closeAnyOverlay(page);
      }
    }

    // ====== 9. 任务执行(空运) - 集装号 ======
    console.log('\n=== 9. 任务执行(空运) Deep Dive ===');
    const airDomain = page.locator('.ant-menu-horizontal .ant-menu-item:has-text("空运")');
    if (await airDomain.count() > 0) { await airDomain.click(); await page.waitForTimeout(1000); }
    await gotoOriginWarehouse();
    await closeAnyOverlay(page);
    await page.waitForTimeout(1000);

    const airTaskTab = page.locator('.ant-tabs-tab').filter({ hasText: '任务执行' }).first();
    if (await airTaskTab.count() > 0) {
      await airTaskTab.click();
      await page.waitForTimeout(1500);
    }

    // 9a. 详情
    console.log('  9a. Detail');
    await closeAnyOverlay(page);
    const airDetailBtn = page.locator('.ant-table-tbody tr.ant-table-row').first().locator('a, button').filter({ hasText: '详情' }).first();
    if (await airDetailBtn.count() > 0) {
      await airDetailBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const drawer = page.locator('.ant-drawer');
      if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  ✅ Air detail Drawer');
        await screenshot(page, 'web-warehouse-cn--03g-任务执行-空运-detail-drawer');
        await closeAnyOverlay(page);
      }
    }

    // 9b. 集装号
    console.log('  9b. Air Unit Management');
    await closeAnyOverlay(page);
    const airUnitBtn = page.locator('.ant-table-tbody tr.ant-table-row').first().locator('a, button').filter({ hasText: '集装号' }).first();
    if (await airUnitBtn.count() > 0) {
      await airUnitBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const drawer = page.locator('.ant-drawer');
      if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  ✅ Air unit Drawer');
        await screenshot(page, 'web-warehouse-cn--03g-任务执行-空运-unit-drawer');
        const drawerBtns = await drawer.locator('button').all();
        const btnTexts = [];
        for (const b of drawerBtns) {
          const t = await b.textContent();
          if (t?.trim()) btnTexts.push(t.trim());
        }
        console.log(`  Drawer buttons: ${btnTexts.slice(0, 15).join(' | ')}`);
        await closeAnyOverlay(page);
      }
    }

    // ====== 10. 退运处理 - Detail & Settle ======
    console.log('\n=== 10. 退运处理 Deep Dive ===');
    // Switch back to SEA
    const seaDom = page.locator('.ant-menu-horizontal .ant-menu-item:has-text("海运")');
    if (await seaDom.count() > 0) { await seaDom.click(); await page.waitForTimeout(1000); }
    await gotoOriginWarehouse();
    await closeAnyOverlay(page);
    await clickTab('退运处理');

    // 10a. 详情
    console.log('  10a. Detail');
    const returnDetailBtn = page.locator('.ant-table-tbody tr.ant-table-row').first().locator('a, button').filter({ hasText: '详情' }).first();
    if (await returnDetailBtn.count() > 0) {
      await returnDetailBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const drawer = page.locator('.ant-drawer');
      if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  ✅ Return detail Drawer');
        await screenshot(page, 'web-warehouse-cn--03i-退运处理-detail-drawer');
        await closeAnyOverlay(page);
      }
    }

    // 10b. 费用结算
    console.log('  10b. Fee Settlement');
    await closeAnyOverlay(page);
    const settleBtn = page.locator('.ant-table-tbody tr.ant-table-row').locator('a, button').filter({ hasText: '费用结算' }).first();
    if (await settleBtn.count() > 0) {
      await settleBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const drawer = page.locator('.ant-drawer');
      if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  ✅ Settle Drawer');
        await screenshot(page, 'web-warehouse-cn--03i-退运处理-settle-drawer');
        await closeAnyOverlay(page);
      }
    } else {
      console.log('  ℹ️ No 费用结算 on visible rows (may require APPROVED status)');
    }

    // ====== 11. 无订单快递 - Detail & Create ======
    console.log('\n=== 11. 无订单快递 Deep Dive ===');
    await closeAnyOverlay(page);
    await clickTab('无订单快递');

    const createNoOrderBtn = page.locator('button:has-text("新增无订单快递")').first();
    if (await createNoOrderBtn.count() > 0) {
      await createNoOrderBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const modal = page.locator('.ant-modal, .ant-drawer');
      if (await modal.count() > 0 && await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  ✅ Create no-order express form');
        await screenshot(page, 'web-warehouse-cn--03e-无订单快递-create-modal');
        const formItems = await modal.locator('.ant-form-item-label').all();
        const labels = [];
        for (const f of formItems) labels.push((await f.textContent())?.trim() || '');
        console.log(`  Form fields: ${labels.join(' | ')}`);
        await closeAnyOverlay(page);
      }
    }

    await closeAnyOverlay(page);
    const noOrderDetailBtn = page.locator('.ant-table-tbody tr.ant-table-row').first().locator('a, button').filter({ hasText: '详情' }).first();
    if (await noOrderDetailBtn.count() > 0) {
      await noOrderDetailBtn.click({ force: true });
      await page.waitForTimeout(1500);
      const drawer = page.locator('.ant-drawer');
      if (await drawer.count() > 0 && await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('  ✅ No-order detail Drawer');
        await screenshot(page, 'web-warehouse-cn--03e-无订单快递-detail-drawer');
        await closeAnyOverlay(page);
      }
    }

    // ====== 12. Final Dashboard ======
    console.log('\n=== 12. Final Dashboard ===');
    await closeAnyOverlay(page);
    const dashBtn = page.locator('.ant-menu-item:has-text("工作台")').first();
    await dashBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'web-warehouse-cn--01-dashboard-final');

    // ====== 13. 订单列表 - 新建订单 form ======
    console.log('\n=== 13. 订单列表 - New Order Form ===');
    await closeAnyOverlay(page);
    const orderMenu = page.locator('.ant-menu-item:has-text("订单中心")').first();
    await orderMenu.click();
    await page.waitForTimeout(1500);

    const newOrderBtn = page.locator('button:has-text("新建订单")').first();
    if (await newOrderBtn.count() > 0) {
      await newOrderBtn.click({ force: true });
      await page.waitForTimeout(2000);
      await screenshot(page, 'web-warehouse-cn--02-订单列表-new-order');
      await closeAnyOverlay(page);
    }

    console.log('\n✅ Deep interaction v2 complete!');

  } catch (err) {
    console.error(`❌ ERROR: ${err.message}`);
    console.error(err);
    await screenshot(page, 'web-warehouse-cn--ERROR-deep-v2');
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
