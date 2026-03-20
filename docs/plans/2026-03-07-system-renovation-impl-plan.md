# 系统改造实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有跨境物流管理系统改造为 RuoYi-Vue 风格布局，实现空运/海运页面级切换，重构订单详情为锚点导航。

**Architecture:** 保持现有 `MENU_CONFIG` + `ContentRenderer` 状态驱动架构不变。在 App.tsx 中调整布局为 RuoYi-Vue 风格（面包屑 + Tab页签 + 左侧深色菜单）。新增 `BusinessModeProvider` 提供页面级空运/海运切换状态。每个需要区分业务类型的页面顶部添加 `Segmented` 切换器。

**Tech Stack:** React 19, TypeScript, Ant Design v6 (Segmented, Anchor, Breadcrumb, Tabs), Vite 7, Day.js

**No test framework configured** — 本项目为 PM Demo 原型，无需 TDD。每个 Task 完成后通过 `npm run build` 验证编译通过，通过浏览器验证 UI。

---

## Task 1: 创建业务模式切换 Hook

**Files:**
- Create: `client/src/hooks/useBusinessMode.ts`

**Step 1: 创建 useBusinessMode hook**

```typescript
// client/src/hooks/useBusinessMode.ts
import { useState, useCallback } from 'react';

export type BusinessMode = 'AIR' | 'SEA';
export type BusinessModeWithAll = 'ALL' | 'AIR' | 'SEA';

/** 用于订单/仓储/办公等页面的空运/海运切换 */
export function useBusinessMode(defaultMode: BusinessMode = 'AIR') {
  const [mode, setMode] = useState<BusinessMode>(defaultMode);
  const options = [
    { label: '空运', value: 'AIR' },
    { label: '海运', value: 'SEA' },
  ];
  return { mode, setMode, options } as const;
}

/** 用于财务/经营分析页面的全部/空运/海运切换 */
export function useBusinessModeWithAll(defaultMode: BusinessModeWithAll = 'ALL') {
  const [mode, setMode] = useState<BusinessModeWithAll>(defaultMode);
  const options = [
    { label: '全部', value: 'ALL' },
    { label: '空运', value: 'AIR' },
    { label: '海运', value: 'SEA' },
  ];
  return { mode, setMode, options } as const;
}
```

**Step 2: 验证编译**

Run: `cd /Users/mac/Documents/code/111/client && npx tsc --noEmit src/hooks/useBusinessMode.ts 2>&1 | head -20`
Expected: 无错误（或仅有 pre-existing 错误）

**Step 3: Commit**

```bash
git add client/src/hooks/useBusinessMode.ts
git commit -m "feat: add useBusinessMode hook for air/sea page-level switching"
```

---

## Task 2: 创建业务模式切换器组件

**Files:**
- Create: `client/src/components/BusinessModeSwitcher.tsx`

**Step 1: 创建组件**

```typescript
// client/src/components/BusinessModeSwitcher.tsx
import React from 'react';
import { Segmented } from 'antd';
import type { BusinessMode, BusinessModeWithAll } from '../hooks/useBusinessMode';

interface BusinessModeSwitcherProps {
  mode: BusinessMode | BusinessModeWithAll;
  options: { label: string; value: string }[];
  onChange: (value: BusinessMode | BusinessModeWithAll) => void;
}

/** 页面顶部的空运/海运切换器，RuoYi 风格放在筛选区上方 */
export const BusinessModeSwitcher: React.FC<BusinessModeSwitcherProps> = ({
  mode, options, onChange
}) => {
  return (
    <div style={{ marginBottom: 16 }}>
      <Segmented
        value={mode}
        options={options}
        onChange={(val) => onChange(val as BusinessMode | BusinessModeWithAll)}
        size="large"
      />
    </div>
  );
};
```

**Step 2: 验证编译**

Run: `cd /Users/mac/Documents/code/111/client && npm run build 2>&1 | tail -5`
Expected: build 成功

**Step 3: Commit**

```bash
git add client/src/components/BusinessModeSwitcher.tsx
git commit -m "feat: add BusinessModeSwitcher component with Segmented control"
```

---

## Task 3: 重构 App.tsx 布局为 RuoYi-Vue 风格

**Files:**
- Modify: `client/src/App.tsx:566-629` (Layout 渲染部分)

**说明:** 本 Task 仅修改布局结构，不改菜单配置。核心变更：
1. Header 添加面包屑导航（Breadcrumb）
2. Content 区域的 Tabs 改为页签风格（type="card"）
3. 保持左侧 Sider 深色主题

**Step 1: 在 App.tsx 添加 Breadcrumb import**

在 `App.tsx:2` 的 antd import 中添加 `Breadcrumb`。

**Step 2: 添加面包屑计算逻辑**

在 `App.tsx` 的 `App` 组件内（约 line 533 `currentSubMenu` useMemo 之后），添加面包屑 useMemo：

```typescript
const breadcrumbItems = useMemo(() => {
  const items: { title: string }[] = [{ title: '首页' }];
  for (const module of filteredMenuConfig) {
    if (module.key === activeMenuKey) {
      items.push({ title: module.label });
      break;
    }
    const found = module.children?.find(sub => sub.key === activeMenuKey);
    if (found) {
      items.push({ title: module.label });
      items.push({ title: found.label });
      break;
    }
  }
  return items;
}, [activeMenuKey, filteredMenuConfig]);
```

**Step 3: 修改 Header 布局**

替换 `App.tsx:581-608` 的 Header 内容：

```tsx
<Header style={{
  padding: '0 24px',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid #f0f0f0',
  height: 48,
  lineHeight: '48px'
}}>
  <Space>
    <Button
      type="text"
      icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      onClick={() => setCollapsed(!collapsed)}
    />
    <Breadcrumb items={breadcrumbItems} />
  </Space>
  <Space>
    <span style={{ color: '#666' }}>{currentUser?.realName || currentUser?.username}</span>
    {userWarehouses.length > 0 && (
      <Select
        value={currentWarehouseId || undefined}
        onChange={(val) => setCurrentWarehouseId(val || '')}
        style={{ width: 150 }}
        placeholder="全部仓库"
        allowClear
        size="small"
        options={userWarehouses.map((w: any) => ({ value: w.id, label: w.name }))}
      />
    )}
    <Tag color="blue">{ROLE_NAMES[currentRole] || currentRole}</Tag>
    <Dropdown
      menu={{
        items: [
          { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true }
        ],
        onClick: ({ key }) => { if (key === 'logout') handleLogout(); }
      }}
      placement="bottomRight"
    >
      <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer', backgroundColor: '#667eea' }} />
    </Dropdown>
  </Space>
</Header>
```

**Step 4: 修改 Tabs 为卡片样式**

在 Content 区域中（`App.tsx:612-624`），将 Tabs 组件添加 `type="card"`：

```tsx
<Tabs
  activeKey={activeTabKey}
  onChange={setActiveTabKey}
  type="card"
  items={currentSubMenu.tabs.map(tab => ({
    key: tab.key,
    label: tab.label,
    children: <ContentRenderer tabKey={tab.key} currentRole={currentRole} warehouseId={currentWarehouseId} />
  }))}
/>
```

**Step 5: 验证编译 + 浏览器检查**

Run: `cd /Users/mac/Documents/code/111/client && npm run build 2>&1 | tail -5`
Expected: build 成功

**Step 6: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: add breadcrumb navigation and card-style tabs (RuoYi layout)"
```

---

## Task 4: 更新 MENU_CONFIG 菜单结构

**Files:**
- Modify: `client/src/App.tsx:101-361` (MENU_CONFIG)

**说明:** 按照设计方案重组菜单结构。主要变更：
- 订单中心简化（移除 children 层级，直接用 tabs）
- 起运国办增加出口跟踪/成本录入/应收管理/订单费用 tabs
- 到达国办增加进口跟踪/通知客户/成本录入/DPN成本/应收管理 tabs
- 财务中心按设计方案重组
- 经营分析保持现有结构

**Step 1: 更新 MENU_CONFIG**

修改 `App.tsx` 中 `MENU_CONFIG` 数组。关键变更点：

1. **订单中心** — 去掉 `oms_order_mgt` children wrapper，直接用 tabs：
```typescript
{
  key: 'oms', label: '订单中心', icon: <FileTextOutlined />,
  roles: ['SALES', 'WAREHOUSE_CN', 'OPS_CN', 'OPS_US', 'WAREHOUSE_US', 'ADMIN'],
  tabs: [
    { key: 'oms_order_list', label: '订单列表' },
    { key: 'oms_order_create', label: '创建订单' }
  ]
},
```

2. **起运国办** — 增加更多 tabs：
```typescript
{
  key: 'tms_line', label: '起运国办', icon: <RocketOutlined />,
  roles: ['OPS_CN', 'ADMIN', 'SALES'],
  children: [
    {
      key: 'tms_job_mgt', label: '任务管理',
      tabs: [{ key: 'tms_job_list', label: '任务列表' }]
    },
    {
      key: 'tms_export', label: '出口跟踪',
      tabs: [{ key: 'tms_export_track', label: '出口跟踪' }]
    },
    {
      key: 'tms_cost_pol', label: 'JOB成本录入',
      tabs: [{ key: 'tms_cost_pol_list', label: '成本录入' }]
    },
    {
      key: 'tms_receivable_pol', label: '应收管理',
      tabs: [{ key: 'tms_receivable_pol_list', label: '应收管理' }]
    },
    {
      key: 'tms_order_fee', label: '订单费用',
      tabs: [{ key: 'tms_order_fee_list', label: '订单费用' }]
    }
  ]
},
```

3. **到达国办** — 增加更多 tabs：
```typescript
{
  key: 'tms_dest', label: '到达国办', icon: <RocketOutlined />,
  roles: ['OPS_US', 'ADMIN'],
  children: [
    {
      key: 'tms_dest_job_mgt', label: '任务管理',
      tabs: [{ key: 'tms_dest_job_list', label: '任务列表' }]
    },
    {
      key: 'tms_import', label: '进口跟踪',
      tabs: [{ key: 'tms_import_track', label: '进口跟踪' }]
    },
    {
      key: 'tms_notify', label: '通知客户',
      tabs: [{ key: 'tms_notify_list', label: '通知客户' }]
    },
    {
      key: 'tms_cost_pod', label: 'JOB成本录入',
      tabs: [{ key: 'tms_cost_pod_list', label: '成本录入' }]
    },
    {
      key: 'tms_dpn_cost', label: 'DPN成本',
      tabs: [{ key: 'tms_dpn_cost_list', label: 'DPN成本' }]
    },
    {
      key: 'tms_receivable_pod', label: '应收管理',
      tabs: [{ key: 'tms_receivable_pod_list', label: '应收管理' }]
    }
  ]
},
```

其余菜单（工作台、客户中心、起运国仓储、到达国仓储、财务中心、经营分析、系统设置）保持现有结构不变。

**Step 2: 为新增 tabs 添加 ContentRenderer cases**

在 `App.tsx` 的 `ContentRenderer` switch 中，为新增的 tab keys 添加 ComingSoon 占位：

```typescript
// 起运国办 - 新增
case 'tms_export_track': return <ComingSoon title="出口跟踪" />;
case 'tms_cost_pol_list': return <ComingSoon title="JOB成本录入(POL)" />;
case 'tms_receivable_pol_list': return <ComingSoon title="应收管理(POL)" />;
case 'tms_order_fee_list': return <ComingSoon title="订单费用" />;
// 到达国办 - 新增
case 'tms_import_track': return <ComingSoon title="进口跟踪" />;
case 'tms_notify_list': return <ComingSoon title="通知客户" />;
case 'tms_cost_pod_list': return <ComingSoon title="JOB成本录入(POD)" />;
case 'tms_dpn_cost_list': return <ComingSoon title="DPN成本" />;
case 'tms_receivable_pod_list': return <ComingSoon title="应收管理(POD)" />;
// 订单中心 - 创建订单独立 tab
case 'oms_order_create': return <ComingSoon title="创建订单" />;
```

**Step 3: 验证编译**

Run: `cd /Users/mac/Documents/code/111/client && npm run build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: restructure MENU_CONFIG with expanded TMS tabs and simplified OMS"
```

---

## Task 5: 为订单列表添加空运/海运切换器

**Files:**
- Modify: `client/src/pages/oms/OrderListV2.tsx`

**Step 1: 添加 import**

在 `OrderListV2.tsx` 顶部添加：
```typescript
import { BusinessModeSwitcher } from '../../components/BusinessModeSwitcher';
import { useBusinessMode } from '../../hooks/useBusinessMode';
```

**Step 2: 在组件内添加 hook 调用**

在 `OrderListV2` 函数开头（约 line 33 之后）添加：
```typescript
const { mode: businessMode, setMode: setBusinessMode, options: businessOptions } = useBusinessMode();
```

**Step 3: 在 JSX 中添加切换器**

在组件的 return JSX 最外层容器顶部（在筛选区域之前）添加：
```tsx
<BusinessModeSwitcher
  mode={businessMode}
  options={businessOptions}
  onChange={setBusinessMode}
/>
```

**Step 4: 验证编译**

Run: `cd /Users/mac/Documents/code/111/client && npm run build 2>&1 | tail -5`

**Step 5: Commit**

```bash
git add client/src/pages/oms/OrderListV2.tsx
git commit -m "feat: add air/sea mode switcher to order list page"
```

---

## Task 6: 为仓储页面添加空运/海运切换器

**Files:**
- Modify: `client/src/pages/wms/origin/InboundList.tsx`
- Modify: `client/src/pages/wms/origin/StockList.tsx`
- Modify: `client/src/pages/wms/origin/ContainerMgt.tsx`
- Modify: `client/src/pages/wms/origin/TransferList.tsx`
- Modify: `client/src/pages/wms/destination/DestInboundList.tsx`
- Modify: `client/src/pages/wms/destination/DeliveryList.tsx`
- Modify: `client/src/pages/wms/destination/DestStockList.tsx`
- Modify: `client/src/pages/wms/destination/DestTransferList.tsx`

**说明:** 对每个文件执行相同的修改模式：
1. Import `BusinessModeSwitcher` + `useBusinessMode`
2. 在组件函数开头调用 `useBusinessMode()`
3. 在 JSX return 的最外层容器顶部插入 `<BusinessModeSwitcher />`

**Step 1: 修改起运国仓储 4 个文件**

对 `InboundList.tsx`、`StockList.tsx`、`ContainerMgt.tsx`、`TransferList.tsx` 分别：

添加 import：
```typescript
import { BusinessModeSwitcher } from '../../../components/BusinessModeSwitcher';
import { useBusinessMode } from '../../../hooks/useBusinessMode';
```

添加 hook（在组件函数内、现有 state 声明之前）：
```typescript
const { mode: businessMode, setMode: setBusinessMode, options: businessOptions } = useBusinessMode();
```

在 JSX 顶部添加：
```tsx
<BusinessModeSwitcher mode={businessMode} options={businessOptions} onChange={setBusinessMode} />
```

**Step 2: 修改到达国仓储 4 个文件**

对 `DestInboundList.tsx`、`DeliveryList.tsx`、`DestStockList.tsx`、`DestTransferList.tsx` 执行相同操作。

**Step 3: 验证编译**

Run: `cd /Users/mac/Documents/code/111/client && npm run build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add client/src/pages/wms/
git commit -m "feat: add air/sea mode switcher to all warehouse pages"
```

---

## Task 7: 为任务管理页面添加空运/海运切换器

**Files:**
- Modify: `client/src/pages/tms/OriginJobList.tsx`
- Modify: `client/src/pages/tms/DestJobManager.tsx`

**Step 1: 修改两个文件**

同 Task 6 模式，但 import 路径为：
```typescript
import { BusinessModeSwitcher } from '../../components/BusinessModeSwitcher';
import { useBusinessMode } from '../../hooks/useBusinessMode';
```

**Step 2: 验证编译**

Run: `cd /Users/mac/Documents/code/111/client && npm run build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add client/src/pages/tms/
git commit -m "feat: add air/sea mode switcher to TMS job pages"
```

---

## Task 8: 为财务和经营分析页面添加三态切换器

**Files:**
- Modify: `client/src/pages/finance/JobProfitDashboard.tsx`
- Modify: `client/src/pages/finance/JobCostAudit.tsx`
- Modify: `client/src/pages/finance/PayableManagement.tsx`
- Modify: `client/src/pages/finance/ReceivableManagement.tsx`
- Modify: `client/src/pages/finance/CostReport.tsx`
- Modify: `client/src/pages/finance/OrderReport.tsx`
- Modify: `client/src/pages/analytics/ExecutiveDashboard.tsx`
- Modify: `client/src/pages/analytics/RouteProfitAnalysis.tsx`
- Modify: `client/src/pages/analytics/CostStructureAnalysis.tsx`

**说明:** 财务和经营分析页面使用 `useBusinessModeWithAll` (三态: 全部/空运/海运)。

**Step 1: 修改财务页面**

对每个财务文件添加：
```typescript
import { BusinessModeSwitcher } from '../../components/BusinessModeSwitcher';
import { useBusinessModeWithAll } from '../../hooks/useBusinessMode';
```

Hook：
```typescript
const { mode: businessMode, setMode: setBusinessMode, options: businessOptions } = useBusinessModeWithAll();
```

JSX 中在筛选区前插入 `<BusinessModeSwitcher mode={businessMode} options={businessOptions} onChange={setBusinessMode} />`

**Step 2: 修改经营分析页面**

同上模式。

**Step 3: 验证编译**

Run: `cd /Users/mac/Documents/code/111/client && npm run build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add client/src/pages/finance/ client/src/pages/analytics/
git commit -m "feat: add all/air/sea mode switcher to finance and analytics pages"
```

---

## Task 9: 重构订单详情页 — Anchor 锚点导航

**Files:**
- Modify: `client/src/pages/oms/OrderDetail.tsx`

**说明:** 这是最复杂的改造任务。将 OrderDetail 从 Tabs 布局改为左侧固定 Anchor + 右侧滚动内容的布局。

**Step 1: 添加 Anchor import**

在 `OrderDetail.tsx` 的 antd import 中添加 `Anchor`。

**Step 2: 定义锚点分区**

在 `OrderDetail` 组件内添加锚点配置：
```typescript
const anchorItems = [
  { key: 'basic', href: '#order-basic', title: '基本信息' },
  { key: 'route', href: '#order-route', title: '路线与收发货人' },
  { key: 'logistics', href: '#order-logistics', title: '物流状态' },
  { key: 'initial', href: '#order-initial', title: '订单初始信息' },
  { key: 'actual', href: '#order-actual', title: '订单实际信息' },
  { key: 'receivable', href: '#order-receivable', title: '应收明细' },
];
```

**Step 3: 重构 JSX 布局**

将现有的 Tabs 布局替换为 Anchor 布局：

```tsx
<div style={{ display: 'flex', gap: 16 }}>
  {/* 左侧锚点导航 */}
  <div style={{ width: 160, flexShrink: 0 }}>
    <Anchor
      offsetTop={80}
      items={anchorItems}
      getContainer={() => document.getElementById('order-detail-scroll') || window}
    />
  </div>
  {/* 右侧内容区 */}
  <div
    id="order-detail-scroll"
    style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 140px)' }}
  >
    <div id="order-basic">
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        {/* 基本信息内容：运单号、服务类型、业务员、日期/支付、用户/公司、发票 */}
      </Card>
    </div>
    <div id="order-route">
      <Card title="路线与收发货人" style={{ marginBottom: 16 }}>
        {/* 路线 + 发/收货人 */}
      </Card>
    </div>
    <div id="order-logistics">
      <Card title="物流状态" style={{ marginBottom: 16 }}>
        {/* 可展开/收起的物流时间线 */}
      </Card>
    </div>
    <div id="order-initial">
      <Card title="订单初始信息" style={{ marginBottom: 16 }}>
        {/* 用户下单填写的货物明细 Table */}
      </Card>
    </div>
    <div id="order-actual">
      <Card title="订单实际信息" style={{ marginBottom: 16 }}>
        {/* 仓库实际操作后的货物 Table */}
      </Card>
    </div>
    <div id="order-receivable">
      <Card title="应收明细" style={{ marginBottom: 16 }}>
        {/* 费用 Table + 汇总 */}
      </Card>
    </div>
  </div>
</div>
```

**Step 4: 迁移现有内容到各锚点区域**

将 OrderDetail 中原 Tabs 的各项内容分配到对应的 Card 中：
- `overview` tab 内容 → `#order-basic` + `#order-route`
- 物流状态展示 → `#order-logistics`
- 初始信息 → `#order-initial`
- 实际信息 → `#order-actual`
- 应收明细 → `#order-receivable`

**Step 5: 验证编译**

Run: `cd /Users/mac/Documents/code/111/client && npm run build 2>&1 | tail -5`

**Step 6: Commit**

```bash
git add client/src/pages/oms/OrderDetail.tsx
git commit -m "feat: refactor order detail from tabs to anchor navigation layout"
```

---

## Task 10: 订单实际信息表格区分空运/海运

**Files:**
- Modify: `client/src/pages/oms/OrderDetail.tsx` (`#order-actual` 区域)

**说明:** 根据主订单的 transportType（空运/海运），展示不同的 Table 列配置。

**Step 1: 定义两套列配置**

```typescript
// 空运实际信息列
const airActualColumns = [
  { title: '第三方运单', dataIndex: 'expressNo' },
  { title: '订单号', dataIndex: 'orderNo' },
  { title: '集装号', dataIndex: 'containerNo' },
  { title: '状态', dataIndex: 'status' },
  { title: '品名', dataIndex: 'itemName' },
  { title: '说明', dataIndex: 'cargoType' },
  { title: '尺寸cm', dataIndex: 'dimensions' },
  { title: '件数', dataIndex: 'quantity' },
  { title: '体积重Kg', dataIndex: 'volumeWeight', render: (v: number) => v?.toFixed(2) },
  { title: '毛重Kg', dataIndex: 'grossWeight', render: (v: number) => v?.toFixed(2) },
];

// 海运实际信息列
const seaActualColumns = [
  { title: '第三方运单', dataIndex: 'expressNo' },
  { title: '订单号', dataIndex: 'orderNo' },
  { title: '集装号', dataIndex: 'containerNo' },
  { title: '状态', dataIndex: 'status' },
  { title: '品名', dataIndex: 'itemName' },
  { title: '说明', dataIndex: 'cargoType' },
  { title: '尺寸cm', dataIndex: 'dimensions' },
  { title: '件数', dataIndex: 'quantity' },
  { title: '体积CBM', dataIndex: 'volumeCBM', render: (v: number) => v?.toFixed(4) },
  { title: '毛重Kg', dataIndex: 'grossWeight', render: (v: number) => v?.toFixed(2) },
];
```

**Step 2: 在 `#order-actual` Card 中根据 transportType 选择列**

```tsx
<Table
  columns={masterOrder?.transportType === 'SEA' ? seaActualColumns : airActualColumns}
  dataSource={/* 实际信息数据 */}
  size="small"
  pagination={false}
/>
```

**Step 3: 添加汇总行**

```tsx
{/* 空运汇总: 总件数 + 总体积重Kg + 总毛重Kg */}
{/* 海运汇总: 总件数 + 总体积CBM + 总毛重Kg */}
```

**Step 4: 验证编译 + Commit**

```bash
git add client/src/pages/oms/OrderDetail.tsx
git commit -m "feat: differentiate actual info table columns for air vs sea freight"
```

---

## Task 11: 订单创建页面区分空运/海运

**Files:**
- Modify: `client/src/pages/oms/OrderCreate.tsx`

**Step 1: 添加 businessMode prop 或内部 Segmented**

在 `OrderCreate` 组件内添加空运/海运切换，或者通过 prop 接收当前模式。

```typescript
import { useBusinessMode } from '../../hooks/useBusinessMode';
import { BusinessModeSwitcher } from '../../components/BusinessModeSwitcher';

// 在组件内
const { mode: businessMode, setMode: setBusinessMode, options: businessOptions } = useBusinessMode();
```

**Step 2: 根据 mode 条件渲染字段差异**

- 空运模式：显示「重量Kg」「货值USD」「服务类型（普快/特快）」
- 海运模式：显示「体积CBM」「重量Kg」「入仓号」「拼柜/整柜」

```tsx
{businessMode === 'AIR' && (
  <>
    <Form.Item label="服务类型" name="serviceType">
      <Select options={[{ label: '普快', value: 'STANDARD' }, { label: '特快', value: 'EXPRESS' }]} />
    </Form.Item>
  </>
)}
{businessMode === 'SEA' && (
  <>
    <Form.Item label="柜型" name="containerType">
      <Select options={[{ label: '拼柜', value: 'LCL' }, { label: '整柜', value: 'FCL' }]} />
    </Form.Item>
    <Form.Item label="入仓号" name="warehouseEntryNo">
      <Input placeholder="自动生成" disabled />
    </Form.Item>
  </>
)}
```

**Step 3: 验证编译 + Commit**

```bash
git add client/src/pages/oms/OrderCreate.tsx
git commit -m "feat: differentiate order creation form for air vs sea freight"
```

---

## Task 12: 将创建订单连接到 ContentRenderer

**Files:**
- Modify: `client/src/App.tsx` (ContentRenderer)

**Step 1: 更新 ContentRenderer 的 oms_order_create case**

```typescript
case 'oms_order_create': return <OrderCreate onCancel={() => {}} onSubmit={() => { message.success('订单创建成功'); }} />;
```

确保 `OrderCreate` 已在 App.tsx 顶部 import。

**Step 2: 验证编译 + Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: connect OrderCreate to oms_order_create tab in ContentRenderer"
```

---

## Task 13: 最终集成验证

**Files:** 无新文件

**Step 1: 完整构建验证**

Run: `cd /Users/mac/Documents/code/111/client && npm run build 2>&1 | tail -20`
Expected: build 成功（仅有 pre-existing 的 tsc 警告）

**Step 2: 启动开发服务器验证**

Run: `cd /Users/mac/Documents/code/111/client && npm run dev`

浏览器验证清单：
- [ ] 左侧菜单正常显示，深色主题
- [ ] 顶部面包屑随菜单切换更新
- [ ] Tabs 使用卡片样式
- [ ] 订单列表页顶部显示「空运 | 海运」Segmented 切换器
- [ ] 仓储页面显示切换器
- [ ] 财务页面显示「全部 | 空运 | 海运」切换器
- [ ] 订单详情页左侧显示 Anchor 锚点导航，可点击跳转
- [ ] 起运国办/到达国办的新菜单项显示 ComingSoon 占位
- [ ] 创建订单页面空运/海运切换后表单字段变化

**Step 3: 最终 Commit**

如有修复，提交最终修复。

```bash
git add -A
git commit -m "chore: final integration fixes for system renovation"
```

---

## 依赖关系

```
Task 1 (hook) ──┐
                 ├── Task 2 (component) ──┐
                 │                        ├── Task 5 (订单列表)
                 │                        ├── Task 6 (仓储)
                 │                        ├── Task 7 (TMS)
                 │                        ├── Task 8 (财务+分析)
                 │                        └── Task 11 (创建订单)
Task 3 (布局) ───┤
                 ├── Task 4 (菜单) ── Task 12 (连接创建订单)
                 │
Task 9 (锚点) ── Task 10 (实际信息表格)
                 │
All Tasks ────── Task 13 (集成验证)
```

**可并行执行的任务组：**
- Group A: Task 1 → Task 2 (基础设施)
- Group B: Task 3 + Task 4 (App.tsx 布局和菜单，需串行)
- Group C: Task 5 + Task 6 + Task 7 + Task 8 (依赖 Group A，四者可并行)
- Group D: Task 9 + Task 10 (订单详情改造，需串行)
- Group E: Task 11 + Task 12 (创建订单，依赖 Group A + B)
- Final: Task 13 (依赖所有)
