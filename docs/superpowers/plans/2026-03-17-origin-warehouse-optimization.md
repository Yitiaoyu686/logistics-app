# 起运国仓储优化 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对齐 Excel 原型，优化起运国仓储系统的入库、库存、装箱（空运+海运）、无订单快递 4 个模块。

**Architecture:** 共享组件优先策略 — 先构建 5 个跨模块复用组件（FeeEntryDrawer、PriceTablePanel、DimensionInput、ScanMatcherModal、CancelOrderModal），然后逐模块改造。所有组件遵循现有代码模式：inline styles、useState + useMemo、Ant Design v6、warehouseApi/v2WmsApi 数据层。

**Tech Stack:** React 19 + TypeScript + Ant Design v6 + Vite + dayjs + Axios

**Spec:** `docs/superpowers/specs/2026-03-17-origin-warehouse-optimization-design.md`

**验证方式:** 本项目无测试框架，每个任务完成后通过 `npm run build`（tsc + vite build）检查编译，浏览器端手动验证 UI。

---

## File Structure

### 新建文件

| 文件 | 职责 | 预估行数 |
|------|------|----------|
| `client/src/components/warehouse/DimensionInput.tsx` | 尺寸录入共享组件（动态行：长/宽/高/件数 + 自动计算） | ~120 |
| `client/src/components/warehouse/PriceTablePanel.tsx` | 运价表折叠面板（阶梯价格 + 附加规则） | ~180 |
| `client/src/components/warehouse/FeeEntryDrawer.tsx` | 费用录入抽屉（已有费用只读 + 新增费用可编辑 + 运价表） | ~350 |
| `client/src/components/warehouse/ScanMatcherModal.tsx` | 运单模糊匹配弹窗（相似度 ≥70% 匹配列表） | ~200 |
| `client/src/components/warehouse/CancelOrderModal.tsx` | 取消订单弹窗（分单列表 + 取消原因） | ~180 |
| `client/src/pages/wms/origin/InboundDetailDrawer.tsx` | 入库/编辑操作 Drawer（分单列表 + 尺寸 + 费用入口） | ~400 |

### 改造文件

| 文件 | 改动范围 |
|------|----------|
| `client/src/pages/wms/origin/InboundList.tsx` | 筛选栏增强 + 列字段补充 + 集成 InboundDetailDrawer |
| `client/src/pages/wms/origin/StockList.tsx` | 筛选栏 + 操作列对齐 + 集成共享组件 |
| `client/src/pages/wms/origin/AirCargoMgt.tsx` | 全面改造：总表 + 创建线路 + 集装号管理 + 添加订单 + 详情 |
| `client/src/pages/wms/origin/ContainerMgt.tsx` | 补充：添加订单 + 录入数据 + 详情页 + 智能提示 |
| `client/src/pages/wms/origin/NoOrderExpress.tsx` | 合并 UnknownExpress + 优化表单/匹配/时间线 |
| `client/src/App.tsx` | 移除 UnknownExpress 菜单和 ContentRenderer case |

### 删除文件

| 文件 | 原因 |
|------|------|
| `client/src/pages/wms/origin/UnknownExpress.tsx` | 功能合并至 NoOrderExpress |
| `client/src/pages/wms/origin/InboundSupplementDrawer.tsx` | 被 InboundDetailDrawer 替代 |

---

## Chunk 1: 共享组件

### Task 1: DimensionInput 尺寸录入组件

**Files:**
- Create: `client/src/components/warehouse/DimensionInput.tsx`

**Context:** 动态行列表组件，每行 = 长CM + 宽CM + 高CM + 件数，底部「+添加」按钮。自动计算体积CBM和体积重KGS。被入库对话框和装箱录入数据使用。

- [ ] **Step 1: 创建组件文件**

创建 `client/src/components/warehouse/DimensionInput.tsx`：

```typescript
import React from 'react';
import { InputNumber, Button, Space, Table } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

export interface DimensionRow {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  pieces: number;
}

export interface DimensionInputProps {
  value?: DimensionRow[];
  onChange?: (rows: DimensionRow[]) => void;
  mode: 'AIR' | 'SEA' | 'GENERIC';
  disabled?: boolean;
}

// 体积重系数：空运 ×167，海运 ×1000，GENERIC 不计算
const VOLUME_WEIGHT_FACTOR: Record<string, number> = {
  AIR: 167,
  SEA: 1000,
  GENERIC: 0,
};
```

实现内容：
- `calcVolumeCbm(row)` = 长×宽×高 / 1,000,000
- `calcVolumeWeightKgs(row, mode)` = volumeCbm × factor
- 可编辑 Table，每行 4 个 InputNumber + 自动计算列 + 删除按钮
- 底部汇总行（总体积CBM、总体积重KGS、总件数）
- 「+添加」按钮追加空行，默认值 `{ lengthCm: 0, widthCm: 0, heightCm: 0, pieces: 1 }`
- disabled 时隐藏添加/删除按钮

- [ ] **Step 2: 验证编译**

```bash
cd /Users/mac/Documents/code/111/client && npx tsc --noEmit 2>&1 | grep -i "DimensionInput" || echo "No errors"
```

---

### Task 2: PriceTablePanel 运价表面板

**Files:**
- Create: `client/src/components/warehouse/PriceTablePanel.tsx`

**Context:** 嵌入 FeeEntryDrawer 中的折叠面板，展示当前线路的运价表。对齐 Excel「录入费用-价格表」sheet：双币种列（预付CNY/到付USD），首重/续重按重量段分行，底部附加规则说明。

- [ ] **Step 1: 创建组件文件**

创建 `client/src/components/warehouse/PriceTablePanel.tsx`：

```typescript
import React, { useState } from 'react';
import { Collapse, Table, Typography, Tag, Divider } from 'antd';

export interface PriceTablePanelProps {
  routeCode: string;
  serviceType: 'EXPRESS' | 'STANDARD';
}
```

实现内容：
- Mock 运价数据：按线路和服务类型返回不同价格表
  - 价格表结构：`{ items: [{ project, weightRange, prepaidCNY, codUSD }], rules: string[] }`
  - 至少覆盖 CAN.CHN-LOS.NGN 线路的普快和特快价格
- 价格 Table：列 = 项目 | 重量值KG | 预付(CNY) | 到付(USD)
  - 行：首重 1KG、续重 ≥1KG、续重 ≥30KG
- 头部：线路名 + 服务类型 Tag + 时效说明 + 更新日期
- 底部：11 条附加规则说明（Typography.Text，列表形式），内容对齐 Excel（文件费、特殊货物加收、计费规则、禁运物品等）
- 「历史价格」按钮（仅展示，点击提示"功能开发中"）
- 使用 Collapse 折叠面板包裹，默认收起

- [ ] **Step 2: 验证编译**

```bash
cd /Users/mac/Documents/code/111/client && npx tsc --noEmit 2>&1 | grep -i "PriceTable" || echo "No errors"
```

---

### Task 3: FeeEntryDrawer 费用录入抽屉

**Files:**
- Create: `client/src/components/warehouse/FeeEntryDrawer.tsx`

**Context:** 核心共享组件，被入库和库存模块使用。上半区展示已有费用（只读），下半区录入新费用（可编辑），底部合计+汇率折算。可展开运价表。

- [ ] **Step 1: 定义类型和 Mock 数据**

```typescript
import React, { useState, useMemo } from 'react';
import {
  Drawer, Table, Button, InputNumber, Select, Space, Typography,
  Divider, Descriptions, message, Popconfirm
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { PriceTablePanel } from './PriceTablePanel';

export interface FeeItem {
  id?: string;
  project: string;
  unitPriceUSD: number;
  quantity: number;
  subtotalUSD: number;
  recordDate?: string;
}

export interface FeeEntryDrawerProps {
  visible: boolean;
  orderId: string;
  routeCode: string;
  serviceType: 'EXPRESS' | 'STANDARD';
  salesPerson?: string;
  customerName?: string;
  orderDate?: string;
  existingFees?: FeeItem[];
  onSubmit: (newFees: FeeItem[]) => void;
  onClose: () => void;
}

// 费用项目选项
const FEE_PROJECT_OPTIONS = [
  '首重', '续重', '药品附加运费', '进口报关费', '到门费用',
  '折扣', '包装费', '仓储费', '保险费', '其他',
];

// Mock 汇率
const EXCHANGE_RATES: Record<string, { currency: string; rate: number }> = {
  'CAN.CHN-LOS.NGN': { currency: 'NGN', rate: 480 },
  'CAN.CHN-ACC.GHA': { currency: 'GHS', rate: 12.5 },
};
```

- [ ] **Step 2: 实现 Drawer 组件**

实现内容：
- 顶部 Descriptions：订单号、线路、服务类型、业务员/用户/订单日期
- 上半区「费用明细」：只读 Table，列 = 序号/项目/单价USD/数量/小计USD/录入日期
  - 底部汇总行：合计USD
  - 汇率折算行：`汇率 USD1.00={currency}{rate} | 折合{currency} {总额*rate}`
- Divider 分隔
- 下半区「录入费用」：可编辑行列表
  - 每行：项目（Select 下拉）+ 单价USD（InputNumber，允许负数）+ 数量（InputNumber）+ 小计（自动计算）+ 删除按钮
  - 底部「+添加」按钮
  - 合计行
- 「展开运价列表」按钮 → 切换 PriceTablePanel 可见性
- 底部操作：「返回」「提交」

- [ ] **Step 3: 验证编译**

```bash
cd /Users/mac/Documents/code/111/client && npx tsc --noEmit 2>&1 | grep -i "FeeEntry" || echo "No errors"
```

---

### Task 4: ScanMatcherModal 扫描模糊匹配弹窗

**Files:**
- Create: `client/src/components/warehouse/ScanMatcherModal.tsx`

**Context:** 输入运单号后对比系统已有运单号，相似度≥70%时展示匹配列表。被入库列表和装箱添加订单使用。

- [ ] **Step 1: 创建组件文件**

```typescript
import React, { useState, useEffect } from 'react';
import { Modal, Table, Input, Button, Space, Tag, Alert, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

export interface MatchedOrder {
  id: string;
  trackingNo: string;
  logisticsStatus: string;
  logisticsStatusTime?: string;
  orderId: string;
  salesPerson: string;
  customerName: string;
  pieces: number;
  similarity: number;
}

export interface ScanMatcherModalProps {
  visible: boolean;
  trackingNo: string;
  mode: 'single' | 'multi';
  onMatch: (matched: MatchedOrder[]) => void;
  onCancel: () => void;
}
```

实现内容：
- 顶部「提示」Alert 说明匹配规则
- 搜索框（Input.Search）+ 匹配结果 Table
- 相似度计算：Levenshtein 距离实现，阈值 70%
  ```typescript
  function similarity(a: string, b: string): number {
    // Levenshtein distance → similarity percentage
  }
  ```
- Mock 数据：在组件内定义 MOCK_TRACKING_RECORDS 数组（至少 20 条已有运单号），前端计算相似度
- Table 列：第三方运单、物流状态、订单号、业务员、用户、件数、相似度（百分比 Tag）
- 按相似度降序排列
- mode='single' 时单选 Radio，mode='multi' 时多选 Checkbox
- 底部 Alert 提示文字（对齐 Excel）：「扫描运单入库时，对比系统记录的运单号，相同率达到70%可跳出对话框」
- 「返回 / 提交」按钮

- [ ] **Step 2: 验证编译**

```bash
cd /Users/mac/Documents/code/111/client && npx tsc --noEmit 2>&1 | grep -i "ScanMatcher" || echo "No errors"
```

---

### Task 5: CancelOrderModal 取消订单弹窗

**Files:**
- Create: `client/src/components/warehouse/CancelOrderModal.tsx`

**Context:** 库存列表「取消」操作弹窗。展示订单下所有分单，可勾选要取消的分单并选择取消原因。对齐 Excel「取消」sheet。

- [ ] **Step 1: 创建组件文件**

```typescript
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Table, Select, Checkbox, Descriptions, Space, Tag, message } from 'antd';

export interface SubOrderForCancel {
  id: string;
  subOrderNo: string;
  trackingNo: string;
  expressCompany?: string;
  status: string;
  statusTime?: string;
  updateDate?: string;
}

export interface CancelOrderModalProps {
  visible: boolean;
  orderId: string;
  orderNo?: string;
  routeCode?: string;
  serviceType?: string;
  salesPerson?: string;
  customerName?: string;
  subOrders?: SubOrderForCancel[];
  onSubmit: (cancelledSubOrders: string[], reasons: Record<string, string>) => void;
  onCancel: () => void;
}

// 取消原因选项
const CANCEL_REASONS = [
  '客户取消', '地址错误', '货物损坏', '重复下单', '无法联系客户',
  '海关扣留', '禁运物品', '其他',
];
```

实现内容：
- 顶部 Descriptions：订单号、线路、服务类型、业务员/用户
- 分单列表 Table：列 = 第三方运单、订单号（分单号）、状态、取消原因（Select 下拉）、选择（Checkbox）、更新日期
- 全选/取消全选功能
- 提交验证：至少选择一个分单，已选分单必须有取消原因
- 底部操作：「返回 / 提交」

- [ ] **Step 2: 验证编译**

```bash
cd /Users/mac/Documents/code/111/client && npx tsc --noEmit 2>&1 | grep -i "CancelOrder" || echo "No errors"
```

- [ ] **Step 3: 整体编译检查**

```bash
cd /Users/mac/Documents/code/111 && npm run build 2>&1 | tail -5
```

---

## Chunk 2: 入库模块

### Task 6: InboundDetailDrawer 入库/编辑操作 Drawer

**Files:**
- Create: `client/src/pages/wms/origin/InboundDetailDrawer.tsx`

**Context:** 替代现有 InboundSupplementDrawer，对齐 Excel「入库对话框」。支持 inbound 和 edit 两种模式。入库模式有状态标记（入库/遗失/损坏），编辑模式没有。

- [ ] **Step 1: 创建组件文件**

```typescript
import React, { useState, useEffect } from 'react';
import {
  Drawer, Descriptions, Table, Form, Input, Select, InputNumber,
  Button, Space, Checkbox, Tag, Divider, message
} from 'antd';
import dayjs from 'dayjs';
import { DimensionInput, type DimensionRow } from '../../components/warehouse/DimensionInput';
import { FeeEntryDrawer } from '../../components/warehouse/FeeEntryDrawer';

interface SubOrderDetail {
  id: string;
  subOrderNo: string;
  trackingNo: string;
  expressCompany?: string;
  signStatus?: string;
  signTime?: string;
  category?: string;       // 类别：日用百货/机械五金等
  goodsName?: string;      // 品名
  weightKg?: number;
  pieces?: number;
  remark?: string;
  inboundDate?: string;
  // 入库模式的状态标记
  inboundStatus?: 'INBOUND' | 'LOST' | 'DAMAGED';
}

export interface InboundDetailDrawerProps {
  visible: boolean;
  mode: 'inbound' | 'edit';
  orderId: string;
  orderNo?: string;
  routeCode?: string;
  serviceType?: string;
  salesPerson?: string;
  customerName?: string;
  orderDate?: string;
  subOrders?: SubOrderDetail[];
  onSubmit: (subOrders: SubOrderDetail[], dimensions: DimensionRow[]) => void;
  onClose: () => void;
}

// 货物类别选项
const GOODS_CATEGORIES = [
  '日用百货', '机械/五金/仪表', '食品', '化妆品', '保健品',
  '药品', '电子产品', '服装/纺织品', '文件', '其他',
];
```

- [ ] **Step 2: 实现 Drawer 主体**

实现内容：
- Drawer width={900}
- 顶部 Descriptions：订单号、线路（Tag）、服务类型（Tag）、业务员、用户、订单日期
- 分单可编辑列表（Table，pagination=false）：
  - 列：第三方运单（只读，含签收状态+时间）、类别（Select 下拉）、说明/品名（Input）、重量Kg（InputNumber）、件数（InputNumber）、备注（Input）、入库日期（只读）
  - mode='inbound' 时额外列：状态标记（Checkbox.Group: 入库/遗失/损坏）
  - 底部汇总行：总件数、总重量
- Divider
- 尺寸录入区：嵌入 `<DimensionInput mode="GENERIC" />`
- 费用录入 FeeEntryDrawer（弹层叠加）
- 底部 footer：
  - 「返回」Button
  - 「录入费用」Button → 打开 FeeEntryDrawer
  - 「提交」Button type="primary"

- [ ] **Step 3: 验证编译**

```bash
cd /Users/mac/Documents/code/111/client && npx tsc --noEmit 2>&1 | grep -i "InboundDetail" || echo "No errors"
```

---

### Task 7: 改造 InboundList 入库列表页

**Files:**
- Modify: `client/src/pages/wms/origin/InboundList.tsx`
- Delete: `client/src/pages/wms/origin/InboundSupplementDrawer.tsx`

**Context:** 增强筛选栏、补充列字段、集成新的 InboundDetailDrawer。

- [ ] **Step 1: 替换 InboundSupplementDrawer 引用**

在 InboundList.tsx 中：
- 移除 `import { InboundSupplementDrawer }`
- 添加 `import { InboundDetailDrawer } from './InboundDetailDrawer'`
- 将 `supplementDrawerVisible` / `setSupplementDrawerVisible` 状态重命名为 `inboundDrawerVisible` / `setInboundDrawerVisible`
- 替换 JSX 中的 `<InboundSupplementDrawer>` 为 `<InboundDetailDrawer mode="inbound">`

- [ ] **Step 2: 增加筛选栏**

在现有 filter 区域追加：
- 「站点」Select（options: 伊科贾站点/电脑村站点/维岛站点/贸易展会站点）
- 「支付方式」Select（options: 预付/到付/信用卡）
- 「支付状态」Select（options: 已付/未付/部分付）
- 「业务员」Select（options 从 mock 数据提取 distinct 值）

新增 state：
```typescript
const [filterStation, setFilterStation] = useState<string>('ALL');
const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('ALL');
const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('ALL');
const [filterSales, setFilterSales] = useState<string>('ALL');
```

在 `filteredRecords` useMemo 中加入新 filter 条件。

- [ ] **Step 3: 补充列表字段**

在 columns 定义中追加：
- `{ title: '站点/JOB', dataIndex: 'stationJob', width: 160 }` — 显示「站点名 + JOB号」
- `{ title: '集装号', dataIndex: 'containerNos', width: 180 }` — Tag 组展示
- `{ title: '支付方式/状态', key: 'payment', width: 120 }` — 渲染「到付 未付」格式

- [ ] **Step 4: 操作列对齐**

修改 action column render：
- `record.status === 'PENDING'` → 显示「入库」按钮（打开 InboundDetailDrawer mode='inbound'）
- `record.status === 'COMPLETED'` → 显示「详情」按钮（打开 InboundDetailDrawer mode='edit' 但 disabled）
- 保留「取消」按钮

- [ ] **Step 5: 验证编译后删除旧文件**

先验证新代码编译通过，再删除旧文件：
```bash
cd /Users/mac/Documents/code/111 && npm run build 2>&1 | tail -10
# 确认编译通过后再删除
rm /Users/mac/Documents/code/111/client/src/pages/wms/origin/InboundSupplementDrawer.tsx
cd /Users/mac/Documents/code/111 && npm run build 2>&1 | tail -10
```

---

## Chunk 3: 库存模块

### Task 8: 改造 StockList 库存列表页

**Files:**
- Modify: `client/src/pages/wms/origin/StockList.tsx`

**Context:** 筛选栏对齐、列字段对齐、操作列对齐 Excel，集成共享组件。

- [ ] **Step 1: 添加共享组件 import**

```typescript
import { InboundDetailDrawer } from './InboundDetailDrawer';
import { FeeEntryDrawer } from '../../components/warehouse/FeeEntryDrawer';
import { CancelOrderModal } from '../../components/warehouse/CancelOrderModal';
```

新增 state：
```typescript
const [editDrawerVisible, setEditDrawerVisible] = useState(false);
const [editRecord, setEditRecord] = useState<any>(null);
const [cancelModalVisible, setCancelModalVisible] = useState(false);
const [cancelRecord, setCancelRecord] = useState<any>(null);
const [filterStation, setFilterStation] = useState<string>('ALL');
```

- [ ] **Step 2: 筛选栏增强**

追加筛选控件：
- 「站点」Select（三级联动简化为单级 Select，options: 伊科贾站点/电脑村站点/维岛站点/贸易展会站点）
- 「业务员」Select
- 确保已有的 filterPaymentStatus、filterPaymentMethod、filterSales 生效

更新 `filteredItems` useMemo 加入 filterStation 条件。

- [ ] **Step 3: 列表字段对齐**

修改 columns：
- 运单号列增加标记：
  ```typescript
  render: (text: string, record: any) => (
    <Space>
      <span>{text}</span>
      {record.isRecycled && <Tag color="green">♻</Tag>}
      {record.isAbnormal && <Tag color="red">X</Tag>}
    </Space>
  )
  ```
- 补充「支付方式/状态」合并列：渲染为「到付 未付」格式

- [ ] **Step 4: 操作列对齐 Excel**

替换现有 action column：
```typescript
render: (_: unknown, record: any) => (
  <Space size={4} wrap>
    <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
    <Button type="link" size="small" onClick={() => handlePrint(record)}>打印</Button>
    <Button type="link" size="small" onClick={() => handleNotify(record)}>@</Button>
    <Button type="link" size="small" danger onClick={() => handleCancel(record)}>取消</Button>
  </Space>
)
```

Handler 实现：
- `handleEdit` → 设置 editRecord + 打开 InboundDetailDrawer mode='edit'
- `handlePrint` → `message.info('打印功能开发中')`
- `handleNotify` → `message.info('通知已发送')` (Mock)
- `handleCancel` → 设置 cancelRecord + 打开 CancelOrderModal

- [ ] **Step 5: 集成共享组件 JSX**

> **费用录入流程说明**：费用录入不直接从 StockList 触发，而是通过 InboundDetailDrawer（edit 模式）中的「录入费用」按钮间接打开 FeeEntryDrawer。流程：StockList 点「编辑」→ InboundDetailDrawer(mode=edit) → 点「录入费用」→ FeeEntryDrawer。

在 return JSX 尾部追加：
```tsx
<InboundDetailDrawer
  visible={editDrawerVisible}
  mode="edit"
  orderId={editRecord?.orderId || ''}
  orderNo={editRecord?.orderNo}
  routeCode={editRecord?.routeCode}
  serviceType={editRecord?.serviceType}
  // ... other props from editRecord
  onSubmit={handleEditSubmit}
  onClose={() => { setEditDrawerVisible(false); setEditRecord(null); }}
/>

<CancelOrderModal
  visible={cancelModalVisible}
  orderId={cancelRecord?.orderId || ''}
  orderNo={cancelRecord?.orderNo}
  routeCode={cancelRecord?.routeCode}
  // ... other props
  onSubmit={handleCancelSubmit}
  onCancel={() => { setCancelModalVisible(false); setCancelRecord(null); }}
/>
```

- [ ] **Step 6: 验证编译**

```bash
cd /Users/mac/Documents/code/111 && npm run build 2>&1 | tail -10
```

---

## Chunk 4: 空运装箱模块

### Task 9a: AirCargoMgt 类型/Mock数据/总表重构

**Files:**
- Modify: `client/src/pages/wms/origin/AirCargoMgt.tsx`

**Context:** 空运装箱改造第一步：定义新类型、Mock 数据、重构总表页面。

- [ ] **Step 1: 添加新 state 和类型**

在 AirCargoMgt.tsx 顶部追加类型和 state：

```typescript
// 空运线路
interface AirRoute {
  id: string;
  routeCode: string;
  serviceType: 'EXPRESS' | 'STANDARD';
  goodsType: 'ALL' | 'NORMAL' | 'SPECIAL';
  containerNos: string[];
  volumeCbm: number;
  volumeWeightKgs: number;
  grossWeightKgs: number;
  netWeightKgs: number;
  pieces: number;
  status: 'PENDING' | 'EXECUTED';
  creator: string;
  createTime: string;
}

// 集装号
interface ContainerNo {
  id: string;
  containerNo: string;    // 如 AK01
  routeId: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  grossWeightKgs: number;
  volumeCbm: number;
  volumeWeightKgs: number;
  innerPieces: number;
  orders: any[];
}
```

新增 state（约 15 个）：
- `routes` / `selectedRoute` — 线路列表和选中线路
- `createRouteModalVisible` — 创建线路弹窗
- `containerMgtModalVisible` — 集装号管理菜单
- `batchCreateModalVisible` — 批量创建集装号
- `labelPreviewVisible` — 标签预览
- `dataEntryDrawerVisible` — 录入数据 Drawer
- `containerNos` — 当前线路的集装号列表

- [ ] **Step 2: Mock 数据**

在组件顶部定义 MOCK_AIR_ROUTES（至少 20 条），包含多条线路如 CAN.CHN→LOS.NGN、CAN.CHN→ACC.GHA 等，状态混合待执行/已执行。

- [ ] **Step 3: 重构总表页面**

> **定位**：现有 AirCargoMgt.tsx 的 return 语句中的主体 JSX（Stats Row + Filter Card + Table Card + Modals）需要整体替换。保留组件函数签名、useEffect 数据加载、和顶层 state 定义。

替换现有的总表渲染：
- 顶部筛选栏：国家/城市 Select + 搜索 Input + 「创建线路」Button
- Stats Cards：总线路数、待执行、已执行、总件数
- Table columns：序号、线路（含创建人+时间）、集装号列表（Tag 组，最多显示 6 个 + `+N more`）、服务类型 Tag、说明、体积CBM、体积重KGS、毛重KGS、净重KGS、件数、状态 Tag、操作（集装号 Button + 添加订单 Button）、更新日期

- [ ] **Step 4: 验证编译**

```bash
cd /Users/mac/Documents/code/111 && npm run build 2>&1 | tail -10
```

---

### Task 9b: AirCargoMgt 创建线路 + 集装号管理 Modals

**Files:**
- Modify: `client/src/pages/wms/origin/AirCargoMgt.tsx`（续 Task 9a）

**Context:** 空运装箱改造第二步：创建线路 Modal + 集装号管理菜单 + 批量创建 + 标签预览 + 录入数据 Drawer。

- [ ] **Step 1: 创建线路 Modal**

```tsx
<Modal title="创建线路" open={createRouteModalVisible} onCancel={...} onOk={handleCreateRoute}>
  <Form layout="vertical">
    <Form.Item label="选择线路" required>
      <Select options={ROUTE_OPTIONS} />
    </Form.Item>
    <Form.Item label="服务类型" required>
      <Radio.Group options={[{ label: '普快', value: 'STANDARD' }, { label: '特快', value: 'EXPRESS' }]} />
    </Form.Item>
    <Form.Item label="货物说明" required>
      <Radio.Group options={[{ label: '全部', value: 'ALL' }, { label: '普货', value: 'NORMAL' }, { label: '非普货', value: 'SPECIAL' }]} />
    </Form.Item>
    <Form.Item label="创建日期">
      <span>{currentUser} {dayjs().format('YYYY/MM/DD HH:mm:ss')}</span>
    </Form.Item>
  </Form>
</Modal>
```

- [ ] **Step 2: 集装号管理 Modal（菜单式）**

```tsx
<Modal title="集装号" open={containerMgtModalVisible} footer={null} width={360}>
  <Space direction="vertical" style={{ width: '100%' }}>
    <Button block onClick={() => { setContainerMgtModalVisible(false); setBatchCreateModalVisible(true); }}>
      创建集装号
    </Button>
    <Button block onClick={() => { setContainerMgtModalVisible(false); setLabelPreviewVisible(true); }}>
      打印标签
    </Button>
    <Button block onClick={() => { setContainerMgtModalVisible(false); setDataEntryDrawerVisible(true); }}>
      录入数据
    </Button>
  </Space>
</Modal>
```

- [ ] **Step 3: 批量创建集装号 Modal**

动态行列表：每行 = 前缀(Input) + 起始段号(InputNumber) + 结束段号(InputNumber) + 打印Button + 删除Button。底部「+添加段」。确认后生成集装号列表（如 AK01~AK22）并追加到当前线路。

- [ ] **Step 4: 集装号标签预览 Modal**

```tsx
<Modal title="集装号标签" open={labelPreviewVisible} width={800} footer={<Button onClick={() => message.info('打印功能开发中')}>批量打印</Button>}>
  <Row gutter={[16, 16]}>
    {containerNos.map(cn => (
      <Col span={8} key={cn.id}>
        <Card size="small" style={{ textAlign: 'center', border: '2px solid #333' }}>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{cn.containerNo}</div>
          <Divider style={{ margin: '8px 0' }} />
          <Tag>{selectedRoute?.serviceType === 'EXPRESS' ? 'EXPRESS' : 'AIR CARGO'}</Tag>
          <div style={{ fontSize: 12, marginTop: 8 }}>{selectedRoute?.routeCode} {dayjs().format('YYYY/MM/DD HH:mm:ss')}</div>
        </Card>
      </Col>
    ))}
  </Row>
</Modal>
```

- [ ] **Step 5: 录入数据 Drawer**

Drawer width={900}，可编辑 Table：
- 列：集装号（只读）、长CM(InputNumber)、宽CM(InputNumber)、高CM(InputNumber)、毛重KGS(InputNumber)、体积CBM（自动计算，只读）、体积重KGS（自动计算，只读）
- 底部汇总行
- footer：「返回」「保存」(暂存到 state) 「提交」(message.success)

- [ ] **Step 6: 验证编译**

```bash
cd /Users/mac/Documents/code/111 && npm run build 2>&1 | tail -10
```

---

### Task 10: AirCargoMgt 添加订单 + 详情 + 离境锁定

**Files:**
- Modify: `client/src/pages/wms/origin/AirCargoMgt.tsx`（续 Task 9b）

**Context:** 空运装箱第三步：添加订单 Drawer（手动模式）、详情页、离境后功能锁定。

**前置确认**：确保以下 import 已存在于文件顶部（如缺失则补充）：
```typescript
import { Row, Col, Segmented, DatePicker, Badge, Tooltip, Alert, Progress, Divider } from 'antd';
import { ShippingUnitDetail } from './ShippingUnitDetail';
```

- [ ] **Step 1: 添加订单 Drawer state**

```typescript
const [addOrderDrawerVisible, setAddOrderDrawerVisible] = useState(false);
const [addOrderMode, setAddOrderMode] = useState<'scan' | 'manual'>('manual');
const [selectedContainerNo, setSelectedContainerNo] = useState<string>('');
const [orderSearchParams, setOrderSearchParams] = useState({ keyword: '', dateRange: [null, null] as any, sales: '', customer: '' });
const [availableOrders, setAvailableOrders] = useState<any[]>([]);  // 可添加的订单
const [containerOrders, setContainerOrders] = useState<Record<string, any[]>>({});  // 每个集装号已添加的订单
```

- [ ] **Step 2: 实现添加订单 Drawer**

Drawer width={1200}：

顶部：Segmented 切换「扫描集装 / 手动集装」
- 扫描集装 → disabled + Tooltip "仅PDA可用"
- 手动集装 → 默认激活

筛选栏（Space wrap）：订单号 Input + 日期范围 RangePicker + 业务员 Select + 用户 Select + 查询/重置 Button

左侧 (Col span={6})：集装号列表
- 每个集装号一个 Card，可点击选中，选中时高亮
- 显示已添加订单数量 Badge

右侧 (Col span={18})：
- 选中集装号时显示已添加订单 Table（单号、第三方运单、国家、业务员、用户、品名、说明、件数、重量、X删除按钮）+ 底部汇总
- 分隔线
- 「可添加订单」Table（从 mock 数据过滤未被添加的订单），每行末尾「添加」按钮

- [ ] **Step 3: 智能提示逻辑**

```typescript
const handleAddOrder = (order: any) => {
  // 检查重复
  const existing = containerOrders[selectedContainerNo] || [];
  if (existing.some(o => o.subOrderNo === order.subOrderNo)) {
    message.warning(`${order.subOrderNo} 重复录入`);
    return;
  }

  // 检查多分单
  const siblingCount = availableOrders.filter(o => o.masterOrderNo === order.masterOrderNo).length;
  if (siblingCount > 1) {
    Modal.confirm({
      title: '提示',
      content: `${order.masterOrderNo} 有 ${siblingCount} 个分单，是否全部添加？`,
      okText: '是',
      cancelText: '否',
      onOk: () => addAllSiblings(order.masterOrderNo),
      onCancel: () => addSingleOrder(order),
    });
    return;
  }

  addSingleOrder(order);
};
```

提交成功后提示跳转下一集装号：
```typescript
Modal.confirm({
  title: '提示',
  content: `${selectedContainerNo} 提交成功！是否进入下一个集装号添加订单？`,
  okText: '是',
  cancelText: '否',
  onOk: () => selectNextContainerNo(),
});
```

- [ ] **Step 4: 详情页 Drawer**

新增 `detailDrawerVisible` + `detailRoute` state。

Drawer width={1000}：
- 线路级汇总 Table：列 = 序号、集装号、尺寸CM、内件数、体积CBM、体积重KGS、毛量KGS，底部合计行
- 点击某集装号行 → 展开子 Table（expandedRowRender）或切换显示 ShippingUnitDetail 组件
- 集装号级明细：单号、第三方运单、国家、业务员、用户、品名、说明、件数、体积/体积重/毛量

- [ ] **Step 5: 离境后功能锁定**

在操作列、添加订单 Drawer、录入数据 Drawer 中加入状态检查：

```typescript
const isShipped = selectedRoute?.status === 'EXECUTED';

// 按钮禁用
<Button disabled={isShipped} onClick={...}>添加订单</Button>
<Button disabled={isShipped} onClick={...}>录入数据</Button>

// Drawer 中的编辑功能
{isShipped && <Alert type="warning" message="货物已离境，编辑功能已锁定" showIcon style={{ marginBottom: 16 }} />}
```

- [ ] **Step 6: 验证编译**

```bash
cd /Users/mac/Documents/code/111 && npm run build 2>&1 | tail -10
```

---

## Chunk 5: 海运装箱模块

### Task 11: ContainerMgt 海运装箱补充功能

**Files:**
- Modify: `client/src/pages/wms/origin/ContainerMgt.tsx`

**Context:** 在现有海运装箱基础上补充：添加订单 Drawer、录入数据功能、详情页、智能提示。与空运结构一致但差异化处理。

- [ ] **Step 1: 新增 state 和 import**

```typescript
import { DimensionInput } from '../../components/warehouse/DimensionInput';

// 新增 state
const [addOrderDrawerVisible, setAddOrderDrawerVisible] = useState(false);
const [selectedContainer, setSelectedContainer] = useState<any>(null);
const [dataEntryDrawerVisible, setDataEntryDrawerVisible] = useState(false);
const [containerDetailDrawerVisible, setContainerDetailDrawerVisible] = useState(false);
const [containerOrders, setContainerOrders] = useState<Record<string, any[]>>({});
```

- [ ] **Step 2: 添加订单 Drawer**

与空运 Task 10 Step 2 结构相同，差异点：
- 左侧展示集装箱列表（箱号 + 箱型 Tag + 利用率 Progress）
- 订单表格增加「目的城市」列
- 利用率超过 90% 时显示 Alert 警告

复用同样的智能提示逻辑（重复录入 + 多分单全部添加 + 提交后跳转下一箱）。

- [ ] **Step 3: 录入数据 Drawer**

与空运 Task 9 Step 8 类似，差异点：
- 列增加「箱型」只读列（20GP/40GP/40HQ/45HQ）
- 标准箱型已有尺寸预填，仅需录入实际毛重
- 体积重系数使用 ×1000（海运）
- 利用率自动计算并显示 Progress 条

- [ ] **Step 4: 详情页 Drawer**

Drawer width={1000}：
- 集装箱级汇总 Table：序号、箱号、箱型、尺寸、内件数、体积CBM、体积重KGS、毛量KGS、利用率
- 底部合计行
- expandedRowRender → 箱内订单分单列表

- [ ] **Step 5: 操作列增加按钮**

在现有操作列追加：
- 「添加订单」Button（状态为 LOADING 时可用）
- 「录入数据」Button
- 「详情」Button

已有的「绑定Job」、「编辑」保留。

状态为 SHIPPED/ARRIVED 时禁用添加订单和录入数据。

- [ ] **Step 6: 验证编译**

```bash
cd /Users/mac/Documents/code/111 && npm run build 2>&1 | tail -10
```

---

## Chunk 6: 无订单快递 + 清理

### Task 12: 合并 NoOrderExpress + 删除 UnknownExpress

**Files:**
- Modify: `client/src/pages/wms/origin/NoOrderExpress.tsx`
- Delete: `client/src/pages/wms/origin/UnknownExpress.tsx`
- Modify: `client/src/App.tsx`

**Context:** 以 NoOrderExpress 为基础，吸收 UnknownExpress 的功能，然后删除 UnknownExpress 并更新路由。

- [ ] **Step 1: 确认并清理 UnknownExpress 引用**

> **注意**: 经确认 `UnknownExpress` 未在 App.tsx 中注册（不在 MENU_CONFIG 和 ContentRenderer 中），无需修改 App.tsx。但需检查其他文件是否有 import 引用：

```bash
cd /Users/mac/Documents/code/111/client && grep -r "UnknownExpress" src/ --include="*.tsx" --include="*.ts"
```

如有引用则移除。如无引用直接跳到 Step 2。

- [ ] **Step 2: 删除 UnknownExpress.tsx**

```bash
rm /Users/mac/Documents/code/111/client/src/pages/wms/origin/UnknownExpress.tsx
```

- [ ] **Step 3: 优化 NoOrderExpress 手动入库表单**

修改 `createInboundModalVisible` 对应的 Modal Form，补全字段：

```tsx
<Form form={createForm} layout="vertical">
  <Row gutter={16}>
    <Col span={12}>
      <Form.Item label="业务线" name="businessLine" rules={[{ required: true }]}>
        <Select options={[{ label: '空运', value: 'AIR' }, { label: '海运', value: 'SEA' }]} />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="快递公司" name="expressCompany" rules={[{ required: true }]}>
        <Select options={EXPRESS_COMPANY_OPTIONS} />
      </Form.Item>
    </Col>
  </Row>
  <Row gutter={16}>
    <Col span={12}>
      <Form.Item label="快递单号" name="trackingNo" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="发往国家" name="destCountry">
        <Select options={COUNTRY_OPTIONS} />
      </Form.Item>
    </Col>
  </Row>
  <Row gutter={16}>
    <Col span={12}>
      <Form.Item label="类别" name="category">
        <Select options={GOODS_CATEGORIES.map(c => ({ label: c, value: c }))} />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="说明/品名" name="goodsName">
        <Input />
      </Form.Item>
    </Col>
  </Row>
  <Row gutter={16}>
    <Col span={8}>
      <Form.Item label="件数" name="pieces"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
    </Col>
    <Col span={8}>
      <Form.Item label="重量Kg" name="weight"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
    </Col>
    <Col span={8}>
      <Form.Item label="体积CBM" name="volume"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
    </Col>
  </Row>
  <Row gutter={16}>
    <Col span={12}>
      <Form.Item label="收件人姓名" name="receiverName"><Input /></Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="收件人电话" name="receiverPhone"><Input /></Form.Item>
    </Col>
  </Row>
  <Row gutter={16}>
    <Col span={12}>
      <Form.Item label="仓位" name="warehouseLocation">
        <Select options={WAREHOUSE_LOCATIONS} />
      </Form.Item>
    </Col>
    <Col span={12}>
      <Form.Item label="备注" name="remark"><Input.TextArea rows={2} /></Form.Item>
    </Col>
  </Row>
</Form>
```

- [ ] **Step 4: 确保「新建订单」操作保留**

现有 NoOrderExpress.tsx 已有 `createOrderModalVisible` state 和 `OrderCreate` import（从 `../../oms/OrderCreate`）。确认操作列中「新建订单」按钮存在且正常工作：
- 待处理状态显示「新建订单」Button
- 点击后打开 Modal，内嵌 `<OrderCreate />` 组件
- 从当前快递记录预填信息（快递单号、件数、重量、收件人等）传入 OrderCreate
- 创建成功后自动关联当前快递，状态更新为「已匹配」并记录流转

如现有代码已实现则保留，如缺失则补充。

- [ ] **Step 5: 优化匹配订单 Modal**

修改 `matchModalVisible` 对应 Modal：
- 顶部搜索区：快递单号 Input + 收件人 Input + 搜索 Button
- 推荐订单列表 Table：订单号、客户、业务员、线路、件数、重量、创建日期
- 单选 Radio，选中后高亮
- 匹配成功 handler：
  ```typescript
  const handleMatchConfirm = async () => {
    if (!selectedMatchOrder) { message.warning('请选择要匹配的订单'); return; }
    // 调用 v2WmsApi.matchUnmatchedPackage
    await v2WmsApi.matchUnmatchedPackage(selectedRecord!.id, { orderId: selectedMatchOrder.id });
    message.success('匹配成功');
    setMatchModalVisible(false);
    // 追加流转记录
    addFlowRecord(selectedRecord!.id, '匹配订单', `关联订单: ${selectedMatchOrder.orderNo}`);
    fetchData();
  };
  ```

- [ ] **Step 6: 优化流转记录时间线**

在详情 Drawer 中完善 Timeline 展示：

```tsx
<Divider orientation="left">流转记录</Divider>
<Timeline
  mode="left"
  items={selectedRecord?.flowRecords?.sort((a, b) =>
    dayjs(b.time).valueOf() - dayjs(a.time).valueOf()
  ).map((record) => ({
    color: record.action.includes('入库') ? 'green' :
           record.action.includes('匹配') ? 'blue' :
           record.action.includes('通知') ? 'orange' : 'gray',
    label: dayjs(record.time).format('YYYY-MM-DD HH:mm'),
    children: (
      <div>
        <div style={{ fontWeight: 500 }}>{record.action}</div>
        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
          操作人: {record.operator} {record.detail && `| ${record.detail}`}
        </div>
      </div>
    ),
  }))}
/>
```

- [ ] **Step 7: 验证编译**

```bash
cd /Users/mac/Documents/code/111 && npm run build 2>&1 | tail -10
```

---

### Task 13: 最终验证 + 浏览器验证

**Files:** 无新文件

- [ ] **Step 1: 全量编译检查**

```bash
cd /Users/mac/Documents/code/111 && npm run build
```

确认无新增 TypeScript 错误（pre-existing 的 SubOrderDetail_new.tsx 和 DestInboundDetail_clean.tsx 错误忽略）。

- [ ] **Step 2: 启动 dev server 验证**

```bash
cd /Users/mac/Documents/code/111 && npm run dev
```

浏览器端验证清单：
1. 登录后切换到「中国仓库」角色
2. 入库列表 → 新筛选项可用 → 点击「入库」按钮 → InboundDetailDrawer 弹出 → 分单列表可编辑 → 尺寸录入可添加行 → 「录入费用」打开 FeeEntryDrawer → 运价表可展开
3. 库存列表 → 筛选项完整 → 运单号标记显示 → 「编辑」打开 Drawer → 「取消」打开 CancelOrderModal → 分单可勾选 + 选择原因
4. 空运装箱 → 总表显示 → 「创建线路」Modal → 「集装号」菜单 → 批量创建 → 标签预览 → 录入数据 → 添加订单（手动模式 + 智能提示）→ 详情页 → 离境锁定
5. 海运装箱 → 添加订单 Drawer → 录入数据 → 详情页
6. 无订单快递 → 手动入库表单字段完整 → 匹配订单推荐列表 → 流转时间线

- [ ] **Step 3: 确认 UnknownExpress 已移除**

验证菜单中不再显示原 UnknownExpress 入口，NoOrderExpress 正常工作。
