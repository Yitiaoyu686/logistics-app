# Research & Design Decisions

## Summary
- **Feature**: `dest-warehouse-mgmt`
- **Discovery Scope**: Extension（已有到达国仓储模块完整实现，本次研究用于对齐 spec 与现行前端）
- **Key Findings**:
  - 菜单 `wms_dest` 下共 6 个 Tab：任务入库、DPN 入库、库存查询、DPN 管理、配送列表、自提列表
  - 任务入库与 DPN 入库复用同一 `DestInboundList` 组件，通过 `initialTab` prop 切分
  - DPN 管理是唯一接入真实 API（`v2PodApi`）的模块，其余全部 Mock
  - 配送与自提共享 `podUiMockStore.ts`，包含可变 mutator 用于状态流转
  - 旧 spec 中提及的 `DPNCreate` / `DPNDetail` / `DPNExecute` / `JobDetail` / `CollDetail` 独立组件并未实际作为菜单页使用，已被当前单页 + Drawer/Modal 模式替代

## Research Log

### 现有组件清单
- **Context**: 通过 Glob `wms/destination/**` 枚举实际存在的 tsx 与 ts 文件
- **Findings**:
  - 主入口组件（菜单直接引用）：
    - `DestInboundList.tsx`（1291 行）— 任务入库 + DPN 入库双 Tab + 四种抽屉（JOB/DPN × 操作/清单）
    - `DestStockList.tsx`（621 行）— 库存查询
    - `DPNManageList.tsx`（1704 行）— DPN 管理，含创建 Modal、绑定抽屉、派单 Modal、详情抽屉、Popover 悬停明细
    - `DeliveryList.tsx`（540 行）— 配送列表 + 失败原因 Modal + 转自提 Modal
    - `PickupList.tsx`（231 行）— 自提列表 + 通知 / 核销
  - 子组件：
    - `DestInboundOperation.tsx`（402 行）— 入库操作抽屉，按集装箱分组 + 扫码 + 批次保存 / 最终确认
    - `DpnInboundExecutionPanel`（内联于 DestInboundList）— DPN 入库执行面板
  - 共享数据：
    - `podUiMockStore.ts`（574 行）— 配送任务与自提记录的内存 Store
  - 未在菜单使用但目录存在：
    - `DestInboundDetail.tsx` / `.backup*` / `.broken` / `.original` / `_reference.tsx` — 历史备份，可忽略
    - `DPNDetail.tsx` / `DPNInbound.tsx` / `JobDetail.tsx` / `DeliveryCreate.tsx` / `DeliveryDetail.tsx` / `DestStockDetail.tsx` / `DestTransferList.tsx` / `DestTransferCreate.tsx` / `DestTransferDetail.tsx` — 未在 App.tsx 中被路由 case 引用到当前 6 Tab，可能仅作为历史或未来扩展

### 菜单集成
- **Context**: `client/src/App.tsx` 第 198-219 行定义 `tms_dest` 与 `wms_dest` 菜单
- **Findings**:
  - `wms_dest` 配置 `domains: ['SEA', 'AIR']`、`roles: ['WAREHOUSE_US', 'OPS_US', 'ADMIN']`
  - 6 个 Tab key 在 ContentRenderer 第 896-906 行对应 case，全部渲染到 `wms/destination` 下的组件
  - `initialTab` 复用 `DestInboundList` 实现两个菜单 Tab，避免代码重复

### DPN 管理的统一状态文案
- **Context**: `DPNManageList.tsx` 中 `buildUnifiedStatusText` / `buildSenderStatusText` / `buildReceiverStatusText`
- **Findings**:
  - 统一流程：待绑定 → 待发运 → 运输中 → 已到达 → 待入库 → 已入库
  - SENDER 视角关注 DRAFT/PENDING_ASSIGN/ASSIGNED/IN_TRANSIT；RECEIVER 视角关注 DELIVERED/SIGNED
  - 顶部 Radio.Group 切换角色视图会将每条 DpnListRow 展开为 sender+receiver 两行 DpnViewRow
  - `parseRemarkMeta(remark)` 解析 `发往站点 / 执行日期 / 物流公司 / 查询电话 / 司机名称 / 司机电话 / 车牌 / 备注` 等元数据用于回填详情与创建表单

### 配送失败原因与自提站点
- **Context**: `podUiMockStore.ts` 暴露常量
- **Findings**:
  - `DELIVERY_FAILURE_REASONS`：PHONE_UNREACHABLE / ADDRESS_NOT_FOUND / CUSTOMER_NOT_HOME / CUSTOMER_RESCHEDULE / REFUSED_BY_CUSTOMER / PAYMENT_NOT_READY / SECURITY_RESTRICTION / PACKAGE_DAMAGED 共 8 项
  - `PICKUP_STATION_OPTIONS`：IKEJ / ABUJ / LEKKI / YABA STA 共 4 项
  - 配送操作仅在任务状态为 PENDING/ACCEPTED/IN_TRANSIT/DELIVERED、DPN 状态非 SIGNED/CANCELLED 且 deliveryMethod=DELIVERY 时显示三按钮

### 库存查询的级联配置
- **Context**: `DestStockList.tsx` 的 `LOCATION_DATA`
- **Findings**:
  - 尼日利亚：拉各斯（IKEJ STA / HAIZ STA）、卡诺（KANO STA）、阿布贾（ABUJ STA）、奥尼查（ONIT STA）
  - 加纳：阿克拉（ACCRA STA）
  - 几内亚：科纳克里（CONK STA）
  - 中国：广州（GZ STA）、深圳（SZ STA）
  - 与任务入库 / DPN 入库的 `COUNTRY_CITY_STATION` 配置略有差异（后者没有几内亚/中国/HAIZ/ONIT 等），属已知待对齐点

## Design Decisions

### Decision: 任务入库与 DPN 入库复用同一组件
- **Context**: Excel 原型将二者作为两个独立功能，但数据字段和筛选 UI 高度重合
- **Alternatives Considered**:
  1. 独立组件 DestJobInboundList + DestDpnInboundList
  2. 单组件 DestInboundList + `initialTab` prop
- **Selected Approach**: Option 2
- **Rationale**: 复用国家-城市-站点筛选、扫码入库抽屉、分页统计等逻辑
- **Trade-offs**: 组件偏大（1291 行），但菜单维护成本最小

### Decision: DPN 管理在无后端时回退到 Mock
- **Context**: 其他模块全部 Mock，而 DPN 已接入 `v2PodApi`
- **Selected Approach**: 调用 `v2PodApi.listDpns` 正常拉取，同时用 `MOCK_DPN_ROWS` 按状态去重合并，保证六种状态均可演示
- **Rationale**: Demo 时即便后端无数据也能完整看到流程；有后端时同样可工作
- **Trade-offs**: 页面逻辑多出一层兜底代码

### Decision: Drawer 抽屉代替独立页面做操作子视图
- **Context**: 入库操作、DPN 入库执行、DPN 创建/绑定/派单/详情都需要较多表单与表格
- **Selected Approach**: 全部使用 Drawer/Modal，父组件 state 控制开关
- **Rationale**: 与项目整体 Drawer-driven 模式一致，避免菜单膨胀
- **Trade-offs**: 单个组件文件偏大

## Risks & Mitigations
- 任务入库与库存查询的级联站点配置不完全一致 — 当前保留两份配置，未来可抽取 `LOCATION_DATA` 到 `src/data/destinations.ts` 统一
- DPN 管理依赖 `v2PodApi` 后端数据，演示环境需保证 MOCK 兜底逻辑始终有效 — 保留 `MOCK_DPN_DETAIL_MAP` 保证悬停明细与详情抽屉不出现空状态
- `DestInboundDetail*` 系列备份文件容易造成代码误读 — 已在文档中标注为历史备份，应在后续清理中删除
