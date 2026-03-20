# 研究与设计决策日志

## 概要
- **特性**: `origin-task-management`
- **发现范围**: 扩展（Extension）— 在现有 TMS 模块基础上改造
- **关键发现**:
  1. 已有 `JobManager`/`JobList`/`JobDetail`/`TaskDetail` 组件，以 JOB 为维度，但不支持多JOB聚合任务和按集装号粒度的节点跟踪
  2. `LogisticsNodeManagement` 已实现按线路配置节点序列的基础设施，可直接复用其 API（`systemApi.routes()`/节点查询）
  3. 现有 `NodeUpdateModal` 使用硬编码节点列表，需改造为动态读取配置
  4. `ExportTracking` 是独立的出口跟踪页面，改造后其功能将合并到任务管理的JOB详情中

## 研究日志

### 现有 TMS 组件架构
- **上下文**: 需要评估现有组件可复用程度，确定改造 vs 新建策略
- **发现**:
  - `JobManager.tsx`（40行）: 纯路由控制器，管理 LIST/DETAIL/TASK_DETAIL 三个视图切换
  - `JobList.tsx`: 列表页，从 `jobApi.list()` 加载数据，有 NodeUpdateModal 和费用 Modal
  - `JobDetail.tsx`: 创建/编辑页，绑定集装箱和订单，使用 `warehouseApi`/`orderApi`/`jobApi`
  - `TaskDetail.tsx`: 详情页，显示 Tracking Timeline（硬编码 Mock）、集装箱列表、订单列表
  - `ExportTracking.tsx`: 独立出口跟踪，固定4个阶段（待订舱→已订舱→已报关→已发运）
  - `NodeUpdateModal.tsx`: 节点更新弹窗，8个硬编码节点，不支持附件和异常标记
- **影响**: 现有组件的数据模型以单个 JOB 为维度，改造需引入「任务（Task）」作为 JOB 的上层聚合

### 物流节点配置基础设施
- **上下文**: 确认基础设置中的节点配置能力
- **发现**:
  - `LogisticsNodeManagement.tsx` 定义了 `LogisticsNode` 接口：id/routeId/nodeCode/nodeName/nodeType/sortOrder/isRequired/description/status
  - 10 种 `NodeType`: PICKUP/WAREHOUSE_IN/CUSTOMS_EXPORT/DEPARTURE/IN_TRANSIT/ARRIVAL/CUSTOMS_IMPORT/WAREHOUSE_OUT/DELIVERY/SIGNED
  - API: `systemApi.routes()` 获取线路列表, 按 routeId 查询节点序列
  - 节点按 `sortOrder` 排序，有 `isRequired` 标记
- **影响**: 任务管理模块的节点跟踪可直接使用此配置，无需重复定义节点类型

### App.tsx 菜单注册模式
- **上下文**: 确认新页面的注册方式
- **发现**:
  - 现有起运国办菜单项: `tms_job_list`(OriginJobList), `tms_job_new`(JobManager), `tms_export_track`(ExportTracking), `tms_cost_pol_list`, `tms_receivable_pol_list`, `tms_order_fee_list`
  - 改造后需替换 `tms_job_new` 和 `tms_export_track` 的入口，指向新的任务管理组件
  - 保留 `tms_cost_pol_list`/`tms_receivable_pol_list` 不变（独立模块）

## 架构模式评估

| 方案 | 描述 | 优势 | 风险 | 备注 |
|------|------|------|------|------|
| 全新组件 | 新建 OriginTaskManager 系列组件，完全独立于现有 JobManager | 无历史包袱，设计自由度高 | 代码冗余，部分逻辑重复 | 推荐：Demo 原型优先快速交付 |
| 改造现有 | 在 JobManager/JobList/JobDetail 上增量修改 | 复用已有代码 | 改动面大，可能破坏已有功能 | 不推荐 |

## 设计决策

### 决策: 新建独立组件集，替换菜单入口
- **上下文**: 现有 JOB 维度组件不支持多JOB聚合任务概念
- **选定方案**: 新建 `OriginTaskManager`（路由控制器）+ `OriginTaskList`（任务列表）+ `OriginTaskForm`（创建/编辑）+ `OriginTaskDetail`（JOB详情+节点跟踪），独立于现有 JobManager
- **理由**: Demo 原型无需保持后向兼容，新建组件更清晰
- **权衡**: 会有部分字段/UI 模式与现有 JobDetail 相似，可接受

### 决策: 节点更新数据结构
- **上下文**: 需要在集装号维度存储每个节点的更新记录
- **选定方案**: `NodeUpdateRecord` 包含 nodeCode/date/isAbnormal/remark/attachments，挂载在 ContainerNodeProgress 下
- **理由**: 统一的更新记录结构便于时间线渲染和异常标识

### 决策: 汇总状态计算逻辑
- **上下文**: 任务列表需展示整体进度
- **选定方案**: 遍历所有集装号的已完成节点数，取最小值对应的节点名称作为汇总状态；若任何节点标记异常，汇总状态附加异常标记
- **理由**: 简单直观，"木桶效应"反映最差进度

## 风险与缓解
- 风险1: Mock 数据量较大（10任务 * 多JOB * 5集装号 * 3订单），数据结构嵌套深 — 缓解：分层定义 Mock，集装号和订单使用工厂函数生成
- 风险2: 动态节点列数不确定，表格列可能过多 — 缓解：采用方案B（详情页时间线），不在列表页展开节点列
- 风险3: 附件上传为 Mock 模拟 — 缓解：Upload 组件使用 `beforeUpload` 返回 false 阻止真实上传，仅维护本地文件列表状态
