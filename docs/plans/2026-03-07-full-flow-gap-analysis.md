# 全流程跑通 — 差距分析与准备工作清单

> 日期：2026-03-07
> 目标：Web 端跑通从客户下单到配送签收的完整业务流程（空运+海运）
> 现状：后端 SQLite 26 张表已建、前端 13+ 页面已实现，但存在断点

---

## 一、端到端业务流程（目标状态）

```
┌─────────────────────────── 完整业务闭环 ───────────────────────────┐
│                                                                    │
│  ① 客户管理    ② 下单          ③ 起运国仓库      ④ 起运国办       │
│  CRM          OMS             WMS-Origin        TMS-Origin        │
│  公海→私海     创建订单         扫码入库           创建任务          │
│  客户认领      (空运/海运)      称重量尺寸         选承运人          │
│               录入快递单号      库存管理           出口跟踪          │
│               批量智能粘贴      装箱/打板          JOB成本录入       │
│                               调拨管理           应收管理          │
│                                                                    │
│  ⑤ 运输中      ⑥ 到达国办       ⑦ 到达国仓库      ⑧ 财务结算       │
│  Transit      TMS-Dest        WMS-Dest          Finance           │
│  状态自动更新   进口跟踪         货物入库           费用录入/审批      │
│               创建DPN          库存管理           应收/应付          │
│               JOB成本POD       执行DPN            利润分析          │
│               通知客户          配送签收                            │
│               DPN成本                                              │
│               应收管理                                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、现状 vs 需求逐环节对比

### 环节 ① 客户管理 (CRM)

| 功能 | 前端页面 | 后端API | 数据库 | 状态 |
|------|---------|---------|--------|------|
| 公海客户列表 | ✅ PublicPool | ✅ GET /clients | ✅ clients | **已通** |
| 我的客户列表 | ✅ MyCustomers | ✅ GET /clients?poolType | ✅ | **已通** |
| 客户认领/释放 | ✅ | ✅ POST /clients/:id/claim | ✅ | **已通** |
| 客户创建/编辑 | ✅ | ✅ POST/PUT /clients | ✅ | **已通** |

**结论：CRM 模块已跑通，无需改动。**

---

### 环节 ② 订单管理 (OMS)

| 功能 | 前端页面 | 后端API | 数据库 | 状态 |
|------|---------|---------|--------|------|
| 订单列表 | ✅ OrderListV2 | ✅ GET /orders/master | ✅ master_orders | **已通** |
| 创建订单 | ✅ OrderCreate | ✅ POST /orders/master | ✅ | **已通** |
| 订单详情 | ✅ OrderDetail | ✅ GET /orders/master/:id | ✅ | **已通** |
| 订单拆分(子单) | ✅ OrderSplitModal | ✅ POST /orders/sub | ✅ sub_orders | **已通** |
| 退单申请/审批 | ✅ | ✅ approve/reject-return | ✅ | **已通** |
| **空运/海运切换** | ❌ 无Segmented | — | ✅ transportType字段已有 | **需加UI** |
| **海运入仓号生成** | ❌ | ❌ 无自动生成逻辑 | ❌ 无warehouseEntryNo | **需新增** |
| **海运拼柜/整柜** | ❌ | — | ❌ 无containerType字段 | **需新增** |
| **空运普快/特快** | ✅ serviceType已有 | ✅ | ✅ | **已通** |
| **计费规则差异** | ❌ 未按空运/海运分开计算 | ❌ | — | **需实现** |
| **发票信息** | ❌ 前端无展示 | — | ❌ 无invoice字段 | **需新增** |
| **批量快递录入** | ✅ 智能粘贴已实现 | ✅ | ✅ | **已通** |

**Gap 总结：**
- 前端：OrderListV2/OrderCreate/OrderDetail 加 Segmented 切换器
- 前端：OrderCreate 区分空运/海运表单字段
- 前端：OrderDetail 改为 Anchor 锚点导航
- 数据库：master_orders 加 `warehouse_entry_no`, `container_type` 字段
- 后端：海运入仓号自动生成逻辑
- 前端+后端：计费重量自动计算（空运 max(毛重, L×W×H/6000)，海运 max(体积, 毛重/700)）

---

### 环节 ③ 起运国仓库 (WMS-Origin)

| 功能 | 前端页面 | 后端API | 数据库 | 状态 |
|------|---------|---------|--------|------|
| 入库记录 | ✅ InboundList | ✅ GET/POST /warehouse/inbound | ✅ inbound_records | **已通** |
| 入库补录(抽屉) | ✅ InboundSupplementDrawer | — | ✅ | **已通** |
| 库存列表 | ✅ StockList | ✅ GET /warehouse/stock | ✅ stock_items | **已通** |
| 海运集装箱管理 | ✅ ContainerMgt | ✅ GET/POST /warehouse/units | ✅ shipping_units | **已通** |
| 空运货物管理 | ✅ AirCargoMgt | ✅ | ✅ | **已通** |
| 调拨管理 | ✅ TransferList | ✅ GET/POST /warehouse/transfers | ✅ transfer_orders | **已通** |
| 退运处理 | ✅ ReturnProcess | ✅ /warehouse/returns | ✅ return_records | **已通** |
| 无订单快递 | ✅ NoOrderExpress | ✅ /warehouse/no-order-express | ✅ | **已通** |
| **空运/海运切换** | ❌ 无Segmented | — | — | **需加UI** |
| **装箱扫码** | ⚠️ 有load API但前端未完整实现 | ✅ POST /units/:id/load | ✅ | **需完善** |
| **封箱操作** | ⚠️ 有seal API但前端按钮不完整 | ✅ POST /units/:id/seal | ✅ | **需完善** |

**Gap 总结：**
- 前端：6 个页面加 Segmented 切换器
- 前端：ContainerMgt/AirCargoMgt 的装箱扫码+封箱 UI 交互完善
- 已有数据流：入库→库存→装箱→绑定Job，核心已通

---

### 环节 ④ 起运国办 (TMS-Origin)

| 功能 | 前端页面 | 后端API | 数据库 | 状态 |
|------|---------|---------|--------|------|
| 任务列表 | ✅ OriginJobList | ✅ GET /jobs | ✅ jobs | **已通** |
| 创建任务 | ✅ (在JobList内) | ✅ POST /jobs | ✅ | **已通** |
| 绑定运输单元 | ✅ | ✅ POST /jobs/:id/bind-units | ✅ | **已通** |
| **出口跟踪** | ❌ 无页面 | ❌ 无专用API | ⚠️ jobs表有阶段状态 | **需新增** |
| **JOB成本录入(POL)** | ❌ 无页面 | ⚠️ fees API可用但无POL专用 | ✅ fee_records | **需新增页面** |
| **应收管理(POL)** | ❌ 无页面 | ⚠️ fees API可用 | ✅ | **需新增页面** |
| **订单费用** | ❌ 无页面 | ⚠️ fees API可用 | ✅ | **需新增页面** |
| **空运/海运切换** | ❌ | — | — | **需加UI** |

**Gap 总结：**
- 前端：需新建 4 个页面（出口跟踪、JOB成本录入、应收管理、订单费用）
- 后端：出口跟踪需要 Job 阶段状态更新 API（originPhaseStatus 流转）
- 后端：费用 API 已有，前端页面按 relatedType=JOB + feeDirection=PAYABLE/RECEIVABLE 筛选即可

---

### 环节 ⑤ 运输中 (Transit)

| 功能 | 前端 | 后端 | 数据库 | 状态 |
|------|------|------|--------|------|
| Job状态自动更新 | ⚠️ 手动更新 | ✅ PUT /jobs/:id | ✅ | **需完善自动化** |
| 子订单状态同步 | ⚠️ 部分 | ⚠️ orderFlow.ts有辅助函数 | ✅ logistics_records | **需完善** |

**Gap 总结：**
- 更新 Job 状态时自动级联更新子订单状态（DEPARTED→IN_TRANSIT→ARRIVED）
- 前端 Job 列表需显示进度可视化（已有基础）

---

### 环节 ⑥ 到达国办 (TMS-Dest)

| 功能 | 前端页面 | 后端API | 数据库 | 状态 |
|------|---------|---------|--------|------|
| 任务列表 | ✅ DestJobManager(壳) → DestJobList | ✅ GET /jobs | ✅ | **已通** |
| **进口跟踪** | ❌ 无页面 | ❌ 无专用API | ⚠️ destPhaseStatus字段已有 | **需新增** |
| **创建DPN** | ❌ 无页面 | ⚠️ delivery API部分可用 | ⚠️ delivery_orders | **需新增** |
| **通知客户** | ❌ 无页面 | ⚠️ notifications API | ✅ notifications | **需新增** |
| **JOB成本录入(POD)** | ❌ 无页面 | ⚠️ fees API可用 | ✅ fee_records | **需新增页面** |
| **DPN成本** | ❌ 无页面 | ⚠️ fees API可用(relatedType=DELIVERY) | ✅ | **需新增页面** |
| **应收管理(POD)** | ❌ 无页面 | ⚠️ fees API可用 | ✅ | **需新增页面** |

**Gap 总结：**
- 前端：需新建 6 个页面
- 后端：进口跟踪需 destPhaseStatus 更新 API
- 后端：通知客户可复用 notifications API，需加模板
- DPN 可复用 delivery_orders 表和 API

---

### 环节 ⑦ 到达国仓库 (WMS-Dest)

| 功能 | 前端页面 | 后端API | 数据库 | 状态 |
|------|---------|---------|--------|------|
| 入库记录 | ✅ DestInboundList | ✅ GET /warehouse/inbound?warehouse=US | ✅ | **已通** |
| 库存列表 | ✅ DestStockList | ✅ GET /warehouse/stock?warehouse=US | ✅ | **已通** |
| 配送列表 | ✅ DeliveryList | ✅ GET /delivery | ✅ delivery_orders | **已通** |
| 调拨管理 | ✅ DestTransferList | ✅ | ✅ | **已通** |
| **DPN入库** | ❌ 无独立页面 | ⚠️ inbound API可扩展 | ⚠️ 需加dpnNo字段 | **需新增** |
| **执行DPN** | ❌ 无页面 | ⚠️ delivery API部分可用 | ⚠️ | **需新增** |
| **配送签收** | ⚠️ 有sign API | ✅ POST /delivery/:id/sign | ✅ | **需完善UI** |
| **空运/海运切换** | ❌ | — | — | **需加UI** |

**Gap 总结：**
- 前端：DPN入库、执行DPN 页面新建
- 前端：配送签收 UI 完善（照片上传+签名）
- 前端：4 个页面加 Segmented
- 数据库：inbound_records 加 `dpn_no` 关联字段

---

### 环节 ⑧ 财务结算 (Finance)

| 功能 | 前端页面 | 后端API | 数据库 | 状态 |
|------|---------|---------|--------|------|
| 费用录入 | ✅ FeeInput | ✅ POST /fees | ✅ fee_records | **已通** |
| 费用审批 | ✅ FeeApproval | ✅ approve/reject | ✅ | **已通** |
| 任务盈亏看板 | ✅ JobProfitDashboard | ⚠️ 前端Mock | — | **需接后端** |
| 任务成本总览 | ✅ JobCostAudit | ⚠️ 前端Mock | — | **需接后端** |
| 应付账款 | ✅ PayableManagement | ⚠️ 前端Mock | ✅ | **需接后端** |
| 应收账款 | ✅ ReceivableManagement | ⚠️ 前端Mock | ✅ | **需接后端** |
| 备用金申请/核销 | ✅ PettyCashApply/Verify | ⚠️ 前端Mock | ❌ 无表 | **Mock可用** |
| 销售提成 | ✅ CommissionCalculation | ⚠️ 前端Mock | ❌ 无表 | **Mock可用** |
| 薪资发放 | ✅ SalaryPayment | ⚠️ 前端Mock | ❌ 无表 | **Mock可用** |
| **全部/空运/海运切换** | ❌ | — | — | **需加UI** |

**Gap 总结：**
- 前端：多个页面加三态 Segmented
- 财务页面大部分有 UI，数据用 Mock 可演示。按需接后端。
- 核心费用流（录入→审批→付款）前后端已通

---

## 三、数据库变更清单

### 需修改的表

| 表 | 变更 | 字段 |
|-----|------|------|
| master_orders | ADD COLUMN | `warehouse_entry_no TEXT` (海运入仓号) |
| master_orders | ADD COLUMN | `container_type TEXT` (LCL/FCL 拼柜/整柜) |
| master_orders | ADD COLUMN | `invoice_info TEXT` (JSON, 发票信息) |
| master_orders | ADD COLUMN | `route_code TEXT` (路线代码 CAN.CHN→LOS.NGA) |
| inbound_records | ADD COLUMN | `length REAL, width REAL, height REAL` (尺寸) |
| inbound_records | ADD COLUMN | `dpn_no TEXT` (关联DPN) |
| sub_orders | ADD COLUMN | `chargeable_weight REAL` (计费重量) |
| sub_orders | ADD COLUMN | `volume_cbm REAL` (海运体积CBM) |

### 无需新增表

分析后发现 **不需要新建表**：
- **DPN** → 复用 `delivery_orders` 表（已有 dpnNo 字段）
- **物流节点** → 复用 `logistics_records` 表（已有 node/status/location/time）
- **应收明细** → 复用 `fee_records` 表（feeDirection=RECEIVABLE, relatedType=ORDER）

---

## 四、后端 API 变更清单

### 需新增的 API

| 接口 | 方法 | 用途 |
|------|------|------|
| `/api/jobs/:jobNo/origin-phase` | PUT | 更新起运国阶段状态(出口跟踪) |
| `/api/jobs/:jobNo/dest-phase` | PUT | 更新到达国阶段状态(进口跟踪) |
| `/api/orders/master/:id/generate-entry-no` | POST | 海运入仓号自动生成 |
| `/api/notifications/send-customer` | POST | 通知客户取件(模板化) |

### 需修改的 API

| 接口 | 变更 |
|------|------|
| POST `/api/orders/master` | 支持 warehouse_entry_no, container_type, invoice_info |
| GET `/api/jobs` | 支持按 originPhaseStatus/destPhaseStatus 筛选 |
| POST `/api/warehouse/inbound` | 支持 length/width/height 尺寸录入 |
| PUT `/api/sub/:id/status` | Job 状态变更时自动级联更新子订单 |

---

## 五、前端页面变更清单

### 需新建的页面 (10 个)

| 页面 | 路径 | 复杂度 | 说明 |
|------|------|--------|------|
| 出口跟踪 | `tms/ExportTracking.tsx` | 中 | Job 起运阶段状态时间线 |
| JOB成本录入(POL) | `tms/JobCostInputPOL.tsx` | 中 | 筛选 fees where relatedType=JOB, 起运国 |
| 应收管理(POL) | `tms/ReceivablePOL.tsx` | 中 | 筛选 fees where direction=RECEIVABLE, 起运国 |
| 订单费用 | `tms/OrderFeeInput.tsx` | 中 | 筛选 fees where relatedType=ORDER |
| 进口跟踪 | `tms/ImportTracking.tsx` | 中 | Job 到达阶段状态时间线 |
| 通知客户 | `tms/CustomerNotify.tsx` | 低 | 通知列表 + 发送通知 |
| JOB成本录入(POD) | `tms/JobCostInputPOD.tsx` | 中 | 同POL，筛选目的国 |
| DPN成本 | `tms/DPNCost.tsx` | 中 | 筛选 fees where relatedType=DELIVERY |
| 应收管理(POD) | `tms/ReceivablePOD.tsx` | 中 | 同POL，筛选目的国 |
| DPN入库 | `wms/destination/DPNInbound.tsx` | 中 | 按DPN维度展示入库 |

### 需修改的页面 (15+ 个)

| 页面 | 变更 |
|------|------|
| App.tsx | RuoYi 布局 + 面包屑 + 菜单重组 + ContentRenderer |
| OrderListV2 | + Segmented 空运/海运 |
| OrderCreate | + 空运/海运差异字段 + 计费规则 |
| OrderDetail | Tabs → Anchor 锚点导航 + 实际信息表格差异 |
| InboundList | + Segmented |
| StockList | + Segmented |
| ContainerMgt | + Segmented + 装箱/封箱 UI 完善 |
| AirCargoMgt | + Segmented |
| TransferList | + Segmented |
| OriginJobList | + Segmented |
| DestInboundList | + Segmented |
| DeliveryList | + Segmented + 签收 UI |
| DestStockList | + Segmented |
| DestJobManager | + Segmented |
| Finance 6个页面 | + 三态 Segmented (全部/空运/海运) |
| Analytics 4个页面 | + 三态 Segmented |

---

## 六、Mock 数据准备

后端 SQLite seed.ts 已有基础 Mock 数据，需补充：

| 数据 | 现有 | 需补充 |
|------|------|--------|
| 用户 | 10个 | ✅ 够用 |
| 客户 | 11个 | ✅ 够用 |
| 主订单 | 有，但都没标 transportType | 需补充空运/海运各若干 |
| 子订单 | 有 | 需补 chargeableWeight, volumeCBM |
| 入库记录 | 有 | 需补尺寸(L/W/H) |
| 运输单元 | 有海运+空运 | ✅ 够用 |
| Job | 有 | 需确保 originPhaseStatus/destPhaseStatus 有值 |
| 费用 | 少量 | 需补充应收(RECEIVABLE)方向的 |
| 配送单 | 有 | ✅ 够用 |
| 物流节点 | logistics_records有 | 需补充完整的多站点节点数据 |

---

## 七、实施优先级（按业务闭环排序）

### P0 — 基础架构改造（前置条件）
1. App.tsx RuoYi 布局 + 面包屑 + 菜单重组
2. useBusinessMode hook + BusinessModeSwitcher 组件
3. 数据库 ALTER TABLE 加字段
4. 后端 API 适配新字段

### P1 — 订单全流程（核心主线）
5. OrderCreate 空运/海运差异
6. OrderListV2 加切换器 + 按 transportType 筛选
7. OrderDetail Anchor 锚点导航 + 计费差异

### P2 — 起运国全流程
8. 仓储 4 页面加切换器
9. ContainerMgt/AirCargoMgt 装箱封箱完善
10. 出口跟踪页面（新建）
11. JOB成本录入POL（新建）

### P3 — 到达国全流程
12. 到达国仓储 4 页面加切换器
13. 进口跟踪页面（新建）
14. 通知客户页面（新建）
15. DPN 入库/执行（新建）

### P4 — 财务 + 经营分析
16. 财务页面加三态切换器
17. 起运国/到达国 应收管理（新建）
18. DPN 成本、JOB 成本 POD（新建）
19. 经营分析页面加三态切换器

### P5 — 数据完善
20. seed.ts 补充空运/海运 Mock 数据
21. 物流节点完整时间线数据
22. 应收方向费用数据

---

## 八、工作量估算

| 类别 | 项目数 | 说明 |
|------|--------|------|
| 新建页面 | 10 | 多数可复用现有模式（Table+Filter+Drawer） |
| 修改页面 | 15+ | 主要是加 Segmented，OrderDetail 改动最大 |
| 后端新增API | 4 | 阶段状态更新 + 入仓号生成 + 通知 |
| 后端修改API | 4 | 加字段支持 |
| 数据库变更 | 8 字段 | ALTER TABLE，无需建新表 |
| Mock 数据 | 5 类 | 补充空运/海运区分的测试数据 |
