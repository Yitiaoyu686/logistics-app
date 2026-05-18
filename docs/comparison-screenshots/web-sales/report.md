# Web SALES Role - E2E Navigation Report

Generated: 2026-05-18

## Test Summary

Logged in as `sales1` (role: SALES, "销售人员"), navigated all accessible menu items via Playwright and captured screenshots.

---

## Sidebar Menu Items (Visible to SALES)

| # | Menu Item | Tab | Status |
|---|-----------|-----|--------|
| 1 | 工作台 | 工作台 | Loaded correctly |
| 2 | 客户中心 | 我的客户 | Loaded correctly |
| 3 | 客户中心 | 公海池 | Loaded correctly |
| 4 | 订单中心 | 订单列表 | Loaded correctly |

**No other menu items are visible to SALES.** The following modules are correctly hidden due to role-based access control:
- 起运国仓储 (WMS Origin)
- 起运国办 (TMS Line) -- SALES is in the role list but all sub-tabs require OPS_CN/ADMIN
- 到达国办 (TMS Dest)
- 到达国仓储 (WMS Dest)
- 财务中心
- 经营分析
- All system administration (组织/用户/角色/基础设置/流程/薪资/消息)

---

## Domain Tabs

Two domain tabs are visible to SALES:
- 海运业务 (default)
- 空运业务

Both domains show the same 3 menu items (工作台, 客户中心, 订单中心).

---

## Screenshots

All saved to: `/Users/mac/Documents/code/111/docs/comparison-screenshots/web-sales/`

| File | Description |
|------|-------------|
| `01-login-page.png` | Login page with purple gradient background |
| `02-dashboard.png` | Dashboard / 工作台 after login |
| `03-crm-my-customers.png` | CRM 我的客户 list page |
| `04-crm-customer-detail.png` | Customer detail drawer (opened via 详情 button) |
| `05-crm-public-pool.png` | CRM 公海池 list page |
| `06-oms-order-list.png` | OMS 订单列表 page |
| `07-oms-order-detail.png` | Order detail drawer (opened via 详情 button) |
| `08-freight-calc-disabled.png` | Dashboard showing DISABLED 运费试算 button |
| `09-air-domain-dashboard.png` | Dashboard under 空运业务 domain |
| `10-full-layout.png` | Full page layout with expanded sidebar |

---

## Page-by-Page Analysis

### 1. 工作台 (Dashboard)
Screenshot: `02-dashboard.png`

- Breadcrumb: 首页 / 海运业务 / 工作台
- Quick-action buttons: `去处理`, `我的客户`, `订单列表`, `运费试算`
- **BUG: "运费试算" button is permanently DISABLED** (greyed out, cannot be clicked)
  - Root cause: The button links to tab key `crm_price`, but `crm_price` is commented out in `MENU_CONFIG` (line 161 of `App.tsx`)
  - `findTabLocation('crm_price')` returns `null`, so `canOpenWorkbenchTab` returns `false`, rendering the button as `disabled`
  - The `PriceCalculator` component exists but has no valid menu route
  - Fix: Either uncomment the `crm_price` tab in MENU_CONFIG or remove the button from WorkbenchOverview

### 2. 我的客户 (My Customers)
Screenshot: `03-crm-my-customers.png`

- Breadcrumb: 首页 / 海运业务 / 客户中心
- Tabs: 我的客户, 公海池
- Table columns (8): 客户编号, 客户名称, 国家, 联系人, 联系电话, 订单, 可用入仓号, 操作
- Table rows: 10 customers
- Visible buttons: `导出`, `新增客户`, `生成`, `详情`, `转移跟进`, `删除`

### Customer Detail Drawer
Screenshot: `04-crm-customer-detail.png`

- Opens via "详情" button click
- Customer: 2222222 (W1X8)
- Detail sub-tabs: 基础资料, 订单列表 (16), 交易数据, 跟进记录, 入仓号
- Shows comprehensive fields including basic info, contact, enterprise info (公司全称, 统一社会信用代码), tax info, bank info

### 3. 公海池 (Public Pool)
Screenshot: `05-crm-public-pool.png`

- Two stacked tables: 客户申请池 (3 rows) and 公海客户列表
- Visible buttons: `录入线索`, `详情`, `申请认领`
- Both tables are populated with mock data

### 4. 订单列表 (Order List)
Screenshot: `06-oms-order-list.png`

- Breadcrumb: 首页 / 海运业务 / 订单中心
- No tabs shown (single-tab menu doesn't render Ant Design tab bar)
- Table columns (14): 运单号, 客户, 目的地, 运输方式, 服务类型, 货物信息, 收件人, 业务员, 订单状态, 支付信息, 币种, 费用, 更新时间, 操作
- Table rows: 10 orders
- Filter bar with `查询`, `重置`, `高级筛选`
- Action buttons: `新建订单`, `详情`, `编辑`, `取消订单`, `暂停`

### Order Detail Drawer
Screenshot: `07-oms-order-detail.png`

- Opens via "详情" button click
- Drawer title: 订单详情
- 27 detail fields covering: order dates, payment, route, delivery, customer info, sender/recipient addresses
- Sub-tables: JOB/子运单信息, 货物信息, 装箱信息, 费用明细, 应收管理, 应付管理

---

## Console Analysis

No real JavaScript errors. All detected messages are Ant Design v6 deprecation warnings:
- `Drawer` `width` deprecated (use `size`)
- `Card` `bordered` deprecated (use `variant`)
- `Modal` `destroyOnClose` deprecated (use `destroyOnHidden`)
- `Space` `direction` deprecated (use `orientation`)

---

## Bugs Found

### BUG-1: "运费试算" button disabled on dashboard
- **Severity:** MEDIUM
- **Screenshot:** `08-freight-calc-disabled.png`
- **Description:** The 运费试算 shortcut button on the dashboard (工作台) is permanently disabled for all roles
- **Root cause:** Button links to `tabKey: 'crm_price'` but the `crm_price` tab is commented out in `MENU_CONFIG` -> `findTabLocation('crm_price')` returns null -> `canOpenWorkbenchTab` returns false -> button renders as disabled
- **Files involved:**
  - `client/src/pages/dashboard/WorkbenchOverview.tsx` line 1050 (button definition)
  - `client/src/App.tsx` line 161 (commented-out tab in MENU_CONFIG)
- **Fix:** Either uncomment `{ key: 'crm_price', label: '报价查询' }` in MENU_CONFIG CRM tabs, or remove the button from WorkbenchOverview

---

## Summary Table

| # | Feature | Loads? | Data Visible? | Detail View? | Issues |
|---|---------|--------|---------------|--------------|--------|
| 1 | 登录页 | OK | Form fields | N/A | None |
| 2 | 工作台 | OK | Quick actions | N/A | 运费试算 button disabled |
| 3 | 我的客户 | OK | 10 customers | OK (5 sub-tabs) | None |
| 4 | 公海池 | OK | 3 pool items, 2 tables | OK | None |
| 5 | 订单列表 | OK | 10 orders | OK (6 sub-tables) | None |
| 6 | 报价计算器 | NOT REACHABLE | N/A | N/A | Route commented out |

---

## Files

- Report: `/Users/mac/Documents/code/111/docs/comparison-screenshots/web-sales/report.md`
- Screenshots: `/Users/mac/Documents/code/111/docs/comparison-screenshots/web-sales/` (10 PNG files)
- Test scripts: `/Users/mac/Documents/code/111/scripts/e2e-web-sales.mjs`, `e2e-web-sales-detail.mjs`, `e2e-web-sales-final.mjs`
