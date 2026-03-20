# Research & Design Decisions

## Summary
- **Feature**: `dest-warehouse-mgmt`
- **Discovery Scope**: Extension（已有到达国仓储模块基础代码，需重构对齐 Excel 原型需求）
- **Key Findings**:
  - 已有 13 个组件文件在 `wms/destination/` 下，覆盖入库、库存、配送、DPN入库、调拨功能
  - 现有代码使用 API 调用模式（warehouseApi/deliveryApi），需保留并扩展
  - Excel 原型中「DPN管理列表」和「执行DPN任务」是新增功能，现有代码无对应组件
  - 需要新增「货物入库2022」模式的 JOB 维度入库（含集装号分组 + 异常标记）

## Research Log

### 现有组件映射分析
- **Context**: 需确认哪些现有组件可复用、哪些需重写
- **Findings**:
  - `DestInboundList.tsx` — 入库列表，已有基础筛选和 API 调用，但缺少 JOB 维度展示（父子行合并、集装号标签）
  - `DestInboundDetail.tsx` — 入库详情，需重构为「货物入库操作」（逐件 checkbox 入库 + 异常标记）
  - `DestStockList.tsx` — 库存列表，已有基础结构，需补充 Excel 中的完整筛选条件
  - `DeliveryList.tsx` — 配送列表，已有基础结构，需补充批量通知、配送校验逻辑
  - `DPNInbound.tsx` — DPN 入库，已有基础框架，需对齐 Excel 中的 checkbox 入库模式
  - `DestTransferList.tsx` / `DestTransferCreate.tsx` — 调拨功能，与本次需求无关，保留不动
  - **缺失组件**: DPN管理列表、创建/编辑DPN、DPN详情、执行DPN任务、JOB详情、集装号详情

### 数据模型分析
- **Context**: 确认现有类型定义和 Mock 数据结构
- **Findings**:
  - `delivery.ts` 已定义 `DeliveryOrder`、`DPNTask` 类型，可扩展使用
  - `warehouse.ts` 已定义 `ShippingUnit`、`StockItem` 类型
  - 需新增类型：`DestInboundJob`（JOB维度入库记录）、`CollDetail`（集装号详情）、`DPNManagementItem`（DPN管理列表项）
  - Mock 数据需按 Excel 原型结构重新组织

### 页面导航分析
- **Context**: 确认 App.tsx 菜单结构
- **Findings**:
  - 已有菜单项：`wms_dest`（到达国仓储）下有入库、配送记录、库存查询、DPN入库
  - 需新增菜单项：DPN管理列表（含创建/编辑/详情/执行子页面）
  - 页面间跳转通过父组件 state 控制视图切换（现有模式：列表 → 详情 Drawer/子视图）

## Design Decisions

### Decision: 页面内视图切换 vs 独立组件
- **Context**: DPN管理涉及列表→创建→编辑→详情→执行多个视图
- **Alternatives Considered**:
  1. 每个视图独立组件 + App.tsx 独立菜单项
  2. 主组件内 state 控制视图切换
- **Selected Approach**: 主组件内 state 控制视图切换（Option 2）
- **Rationale**: 与现有 `DeliveryList` 模式一致（列表组件内 import Detail/Create 子组件），避免 App.tsx 菜单膨胀
- **Trade-offs**: 主组件代码量较大，但保持一致性

### Decision: 重构现有组件 vs 新建组件
- **Context**: 现有 DestInboundList 等组件已有 API 调用基础
- **Selected Approach**: 重构现有组件，对齐 Excel 原型需求
- **Rationale**: 保留已有 API 集成代码，避免重复工作
- **Trade-offs**: 需仔细处理现有逻辑与新需求的兼容

## Risks & Mitigations
- 现有组件已有复杂逻辑，重构时可能引入回归 — 逐步替换，保留 _reference 文件作为参考
- DPN 管理列表父子行展示较复杂 — 使用 Ant Design Table expandable 行展开功能
- Mock 数据量较大 — 按模块拆分 Mock 数据常量
