const { test } = require('playwright/test');

test('check tms pages', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });

  const hasLogin = await page.locator('text=用户名').first().isVisible().catch(() => false);
  if (hasLogin) {
    await page.getByPlaceholder('用户名').fill('admin');
    await page.getByPlaceholder('密码').fill('admin123');
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.waitForLoadState('networkidle');
  }

  await page.waitForTimeout(1200);

  await page.getByText('起运国办', { exact: false }).first().click();
  await page.waitForTimeout(600);
  await page.getByText('任务管理', { exact: false }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/tms_origin_task.png', fullPage: true });

  const originHasEdit = await page.getByText('编辑', { exact: false }).first().isVisible().catch(() => false);
  const originHasDelete = await page.getByText('删除', { exact: false }).first().isVisible().catch(() => false);

  await page.getByText('到达国办', { exact: false }).first().click();
  await page.waitForTimeout(600);
  await page.getByText('任务管理', { exact: false }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/tms_dest_task.png', fullPage: true });

  const destHasView = await page.getByText('查看', { exact: false }).first().isVisible().catch(() => false);

  console.log('CHECK_RESULT', JSON.stringify({
    originHasEdit,
    originHasDelete,
    destHasView,
    originScreenshot: '/tmp/tms_origin_task.png',
    destScreenshot: '/tmp/tms_dest_task.png'
  }));
});
