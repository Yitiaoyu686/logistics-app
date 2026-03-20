# 起运国仓储优化设计文档

## 概述

基于 Excel 原型文档（`docs/excel-起运国仓.md`）对 Web 端起运国仓储系统的 4 个模块进行功能对齐优化：入库、库存、装箱（空运+海运）、无订单快递。

**实现策略**：共享组件优先 — 先抽取跨模块共享组件，再逐模块对齐 Excel 原型。

**范围约束**：
- 仅 Web 端，不涉及移动端/PDA 扫描功能
- 空运和海运业务完全独立，不混用
- 产品经理 Demo 原型，使用 Mock 数据
- 每个模块 Mock 数据量至少 20 条记录，保证 Demo 真实感

**明确排除**：
- `InboundScan.tsx` — 扫描入库属于移动端功能
- `执行任务` 模块 — 不在本次 4 模块优化范围内
- `ReturnProcess.tsx` — 退件处理，不在本次范围
- `TransferList.tsx` — 转运列表，不在本次范围
- `取消订单` 独立列表页 — 取消功能已整合为库存模块的 CancelOrderModal 操作，不单独建页

## 第一部分：共享组件

路径：`/client/src/components/warehouse/`

### 1. FeeEntryDrawer — 费用录入抽屉

**使用场景**：入库对话框「录入费用」按钮、库存列表「编辑」操作

**结构**：
- 顶部：订单号、线路、服务类型、业务员/用户信息（只读）
- 上半区「费用明细」：已有费用项表格（只读），字段：项目 / 单价USD / 数量 / 小计USD / 录入日期，底部合计行 + 汇率折算行（如 USD1.00=NGN480，折合NGN金额）
- 下半区「录入费用」：可编辑表格，支持添加行（项目下拉选择 + 单价 + 数量），支持负数（减免），可删除行（X 按钮），底部小计
- 「展开运价列表」按钮 → 展开 PriceTablePanel

**Props**：
```typescript
interface FeeEntryDrawerProps {
  visible: boolean;
  orderId: string;
  routeCode: string;
  serviceType: 'EXPRESS' | 'STANDARD';
  existingFees?: FeeItem[];
  onSubmit: (newFees: FeeItem[]) => void;
  onClose: () => void;
}
```

### 2. PriceTablePanel — 运价表面板

**使用场景**：嵌入 FeeEntryDrawer 中

**结构**：Collapse 折叠面板
- 首重/续重阶梯价格表（区分预付CNY / 到付USD）
- 不同重量段价格
- 附加规则说明列表（特殊货物加收、计费规则、禁运物品等）
- 更新日期 + 历史价格入口

**Props**：
```typescript
interface PriceTablePanelProps {
  routeCode: string;
  serviceType: 'EXPRESS' | 'STANDARD';
}
```

**价格表结构对齐 Excel**：双币种列（预付CNY / 到付USD），首重/续重按重量段分行，底部 11 条附加规则说明。

### 3. DimensionInput — 尺寸录入组件

**使用场景**：入库对话框、装箱录入数据

**结构**：动态行列表
- 每行：长CM + 宽CM + 高CM + 件数 + 删除按钮
- 底部「+添加」按钮
- 自动计算：体积CBM = 长×宽×高/1000000，体积重KGS = 体积CBM × 167（空运）或 × 1000（海运）

**Props**：
```typescript
interface DimensionInputProps {
  value?: DimensionRow[];
  onChange?: (rows: DimensionRow[]) => void;
  mode: 'AIR' | 'SEA' | 'GENERIC'; // GENERIC 用于入库场景（尚未确定运输方式时，不计算体积重）
}
interface DimensionRow {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  pieces: number;
}
```

### 4. ScanMatcherModal — 扫描模糊匹配弹窗

**使用场景**：入库列表查找运单、装箱添加订单

**结构**：
- 输入运单号后，系统对比已有运单号（相似度 ≥ 70%）
- 弹窗展示匹配运单列表：第三方运单、物流状态、订单号、业务员、用户、件数
- 单选/多选后确认

**Props**：
```typescript
interface ScanMatcherModalProps {
  visible: boolean;
  trackingNo: string;
  mode: 'single' | 'multi';
  onMatch: (matched: MatchedOrder[]) => void;
  onCancel: () => void;
}
```

### 5. CancelOrderModal — 取消订单弹窗

**使用场景**：库存列表「取消」操作

**结构**：
- 订单基本信息（订单号、线路、业务员/用户）只读
- 分单列表：第三方运单、订单号、状态、取消原因下拉、勾选框
- 底部：「返回 / 提交」

**Props**：
```typescript
interface CancelOrderModalProps {
  visible: boolean;
  orderId: string;
  onSubmit: (cancelledSubOrders: string[], reasons: Record<string, string>) => void;
  onCancel: () => void;
}
```

---

## 第二部分：入库模块优化

优化文件：`/client/src/pages/wms/origin/InboundList.tsx`（665行）

InboundScan.tsx 不在本次优化范围（属移动端功能）。

### 1. InboundList — 入库列表页

**筛选栏增强**：
- 增加「站点」筛选（国家→城市→站点三级联动）
- 增加「支付方式」「支付状态」筛选
- 增加「业务员」下拉筛选
- 搜索支持：订单号/JOB/集装号/快递单号/电话/收发货人

**列表字段补充**：
- 增加「站点/JOB」列
- 增加「集装号」列
- 增加「支付方式/状态」列

**操作列对齐**：
- 「待入库」→「入库」按钮
- 「已入库」→「详情」按钮

### 2. InboundDetailDrawer — 入库操作对话框

对齐 Excel「入库对话框」sheet，核心改造：

**顶部信息区**（只读）：订单号、线路、服务类型、业务员/用户/订单日期

**分单列表区**：展示该订单下所有第三方运单（分单），每个分单可录入：
- 类别（下拉：日用百货/机械五金/食品等）
- 说明/品名（输入）
- 重量Kg、件数（输入）
- 备注（输入）
- 入库日期

**尺寸录入区**：嵌入 `DimensionInput` 共享组件

**状态标记**：每个分单可标记「入库 / 遗失 / 损坏」（三状态复选框）

**底部操作**：「返回」「录入费用」（打开 FeeEntryDrawer）「提交」

**文件说明**：新建 `InboundDetailDrawer.tsx` 组件文件，替代现有的 `InboundSupplementDrawer.tsx`（功能被完全覆盖，删除旧文件）。

**复用说明**：此组件同时用于库存模块的编辑功能，通过 `mode: 'inbound' | 'edit'` 区分。入库模式有状态标记（入库/遗失/损坏），编辑模式没有。

---

## 第三部分：库存模块优化

优化文件：`/client/src/pages/wms/origin/StockList.tsx`（690行）

### 1. StockList — 库存列表页

**筛选栏对齐**：
- 增加「站点」三级联动筛选（国家→城市→站点）
- 增加「支付状态」筛选（已付/未付/部分付）
- 增加「业务员」下拉筛选
- 搜索支持：订单号/JOB/集装号/快递单号/电话/收发货人

**列表字段对齐**：
- 运单号列增加标记显示（♻回收件、X 异常件等 Tag 标识）
- 补充「支付方式/状态」合并列（如「到付 未付」）

**操作列对齐 Excel**：
- 「编辑」→ 打开 InboundDetailDrawer（mode='edit'）
- 「打印」→ 打印运单
- 「@」→ 通知相关人员（消息弹窗）
- 「取消」→ 打开 CancelOrderModal 共享组件

### 2. 费用录入流程

点击编辑 Drawer 中的「录入费用」→ 打开 FeeEntryDrawer：
- 查看已有费用明细（只读）+ 合计 + 汇率折算
- 下方可编辑区新增/删除费用项
- 「展开运价列表」→ 展开 PriceTablePanel
- 提交

---

## 第四部分：装箱模块优化

空运优化 `AirCargoMgt.tsx`，海运优化 `ContainerMgt.tsx`，两者完全独立。

### 空运装箱（AirCargoMgt）

#### 1. 总表页面

**筛选栏**：国家→城市筛选 + 搜索（集装号/订单号）+ 「创建线路」按钮

**列表字段对齐 Excel 总表**：
- 线路、集装号列表（Tag 组展示）、服务类型、说明
- 体积CBM、体积重KGS、毛重KGS、净重KGS、件数
- 状态（待执行/已执行）
- 操作列：「集装号」「添加订单」

**数据模型补充**：现有 AirCargoMgt 使用 `grossWeight` 和 `chargeableWeight`，需新增 `netWeight`（净重）字段到 Mock 数据模型中。

#### 2. 创建线路 Modal
- 选择线路（下拉）
- 服务类型：普快/特快（Radio）
- 货物说明：全部/普货/非普货（Radio）
- 创建人+日期自动填充

#### 3. 集装号管理 Modal
点击「集装号」按钮弹出菜单：
- 创建集装号 → 批量创建
- 打印标签 → 标签预览
- 录入数据 → 尺寸重量录入

#### 4. 批量创建集装号 Modal
- 动态行列表：前缀（Input）+ 起始段号 + 结束段号 + 「打印/删除」按钮
- 底部「+添加」增加新段
- 示例：AK, 01~22 → AK01~AK22

#### 5. 集装号标签预览
- 标签卡片：集装号 + 服务标识（EXPRESS/AIR CARGO）+ 线路 + 日期
- 批量打印

#### 6. 录入数据 Drawer
- 表格：每行一个集装号 → 长CM / 宽CM / 高CM / 毛重KGS
- 自动计算体积CBM、体积重KGS
- 底部汇总行
- 「保存」（暂存）「提交」（确认）

#### 7. 添加订单 Drawer

顶部保留「扫描集装 / 手动集装」切换 UI（扫描模式禁用并显示"仅PDA可用"提示），默认手动模式：
- 顶部筛选：订单号、日期范围、业务员、用户
- 左侧：集装号列表（AK01~AK19），点击展开/收起
- 右侧：选中集装号时，显示已添加的订单表格（单号、第三方运单、国家、业务员、用户、品名、说明、件数、重量、操作）
- 勾选订单添加到当前集装号
- 智能提示：多分单全部添加？/ 重复录入警告 / 提交成功后跳转下一集装号

#### 8. 详情页 Drawer
- 线路级汇总：所有集装号的尺寸、内件数、体积、毛重 + 合计
- 集装号级明细：点击某集装号 → 复用现有 `ShippingUnitDetail.tsx` 组件展示订单分单列表

#### 9. 离境后功能锁定
- 状态为「已发运」后，「编辑品名」「导入品名」「添加订单」按钮禁用/隐藏

### 海运装箱（ContainerMgt）

对齐空运的同等功能结构，差异点：

| 对比项 | 空运 AirCargoMgt | 海运 ContainerMgt |
|--------|-----------------|-------------------|
| 运输单元 | 集装号（AK01~AK22） | 集装箱（20GP/40GP/40HQ/45HQ） |
| 创建方式 | 前缀+段号批量创建 | 单个创建，选择箱型 |
| 体积重系数 | ×167 | ×1000 |
| 标签标识 | EXPRESS / AIR CARGO | 箱型 + 封条号 |
| 容量展示 | 件数/重量 | 利用率百分比 |

海运侧需补充功能：
- 添加订单 Drawer（手动模式，与空运结构一致）
- 录入数据（实际装箱后重量录入）
- 详情页（集装箱级汇总 + 箱内订单明细）
- 智能提示（重复录入、分单全部添加）

---

## 第五部分：无订单快递模块优化

合并 `NoOrderExpress.tsx`(1085行) + `UnknownExpress.tsx`(315行)。

### 合并策略
- 以 NoOrderExpress.tsx 为基础优化
- 删除 UnknownExpress.tsx
- 更新 App.tsx 菜单配置和 ContentRenderer

### NoOrderExpress — 无订单快递列表页

**筛选栏**：状态（待处理/已匹配/已关闭）+ 搜索（快递单号、快递公司、收件人线索）+ 日期范围

**列表字段**：入库时间、快递公司、快递单号、收件人姓名/电话、件数、重量、体积、仓位、状态、匹配订单号、处理人、备注、创建时间

**操作列**：
- 「详情」→ 详情 Drawer
- 「匹配」→ 匹配 Modal（待处理状态）
- 「新建订单」→ 新建订单 Modal（待处理状态）
- 「通知」→ 通知客户（待处理状态）
- 已匹配/已关闭状态禁用操作

### 手动入库表单
字段：业务线（空运/海运）、快递单号、快递公司（下拉）、发往国家（下拉）、类别（日用百货/机械五金等下拉）、说明/品名、件数、重量、体积、收件人姓名/电话、仓位（下拉）、备注

### 匹配订单 Modal
- 输入快递单号/收件人后推荐相似订单列表
- 列表：订单号、客户、业务员、线路、件数、重量、创建日期
- 单选关联，匹配成功自动更新状态 + 记录流转

### 新建订单流程
- 从当前快递记录预填信息
- 复用 OMS 模块 OrderCreate 组件
- 创建成功自动关联，状态更新为「已匹配」

### 流转记录时间线
- Ant Design Timeline 组件
- 每条记录：操作类型（入库/匹配/通知/关闭）+ 操作人 + 时间 + 备注
- 时间倒序

---

## 涉及文件清单

所有路径相对于 `/client/src/`。

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `components/warehouse/FeeEntryDrawer.tsx` | 费用录入共享抽屉 |
| 新建 | `components/warehouse/PriceTablePanel.tsx` | 运价表折叠面板 |
| 新建 | `components/warehouse/DimensionInput.tsx` | 尺寸录入共享组件 |
| 新建 | `components/warehouse/ScanMatcherModal.tsx` | 模糊匹配弹窗 |
| 新建 | `components/warehouse/CancelOrderModal.tsx` | 取消订单弹窗 |
| 新建 | `pages/wms/origin/InboundDetailDrawer.tsx` | 入库/编辑操作 Drawer |
| 改造 | `pages/wms/origin/InboundList.tsx` | 入库列表筛选+字段增强 |
| 删除 | `pages/wms/origin/InboundSupplementDrawer.tsx` | 被 InboundDetailDrawer 替代 |
| 改造 | `pages/wms/origin/StockList.tsx` | 库存列表筛选+操作列对齐 |
| 改造 | `pages/wms/origin/AirCargoMgt.tsx` | 空运装箱全面改造 |
| 改造 | `pages/wms/origin/ContainerMgt.tsx` | 海运装箱补充功能 |
| 改造 | `pages/wms/origin/NoOrderExpress.tsx` | 合并 UnknownExpress 功能 |
| 删除 | `pages/wms/origin/UnknownExpress.tsx` | 功能合并至 NoOrderExpress |
| 改造 | `App.tsx` | 移除 UnknownExpress 菜单/路由 |
| 不动 | `pages/wms/origin/ShippingUnitList.tsx` | 不在本次范围，但装箱详情复用 ShippingUnitDetail |
| 不动 | `pages/wms/origin/ShippingUnitDetail.tsx` | 装箱详情页复用此组件 |
| 不动 | `pages/wms/origin/InboundScan.tsx` | 移动端功能，不在范围 |
| 不动 | `pages/wms/origin/ReturnProcess.tsx` | 不在本次范围 |
| 不动 | `pages/wms/origin/TransferList.tsx` | 不在本次范围 |
