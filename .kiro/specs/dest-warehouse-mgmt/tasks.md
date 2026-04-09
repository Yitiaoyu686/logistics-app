# Implementation Plan

> 本 tasks 清单基于当前前端实际实现整理。所有任务均已在 `client/src/pages/wms/destination/` 下完成并接入 `App.tsx` 菜单 `wms_dest`。

- [x] 1. 任务入库 Tab（DestInboundList - JOB 维度）
- [x] 1.1 JOB 列表表格与 Mock 数据
  - 定义 `JobInboundRecord` / `InboundDetailRow` 类型并通过 `buildMockJobs(businessLine)` 生成 Mock
  - 表格列：任务编号（jobNo + 服务类型/业务线）、船公司/提单号、起运港、目的港、集装箱号（monospace）、当前站点、默认交付 Tag、件数、重量、物流状态 Tag + 清关状态、操作、更新日期
  - 统计标签：待入库任务数 / 总件数 / 总重量
  - _Requirements: 1.1, 1.7, 1.8_

- [x] 1.2 三级级联筛选与关键词搜索
  - `COUNTRY_CITY_STATION` 配置（尼日利亚：IKEJ/CV/VI STA、阿布贾 ABUJ STA、卡诺 KAN STA；加纳 ACC STA）
  - 国家→城市→站点联动重置、入库状态下拉、关键词搜索（任务号/提单号/承运商/集装箱号）
  - _Requirements: 1.2, 1.3, 1.4, 8.1, 8.3, 8.4_

- [x] 1.3 抽屉：入库操作与清单
  - `DrawerState` 联合类型控制四种抽屉：JOB_OPERATION、JOB_MANIFEST、DPN_OPERATION、DPN_MANIFEST
  - JOB_OPERATION 抽屉渲染 `DestInboundOperation`，传递 `jobDrafts[jobId]` 作为 initialItems
  - JOB_MANIFEST 抽屉展示 JOB 元数据 Descriptions + `manifestColumns` 清单表格
  - _Requirements: 1.5, 1.6_

- [x] 2. 货物入库操作（DestInboundOperation）
- [x] 2.1 操作头与扫码
  - 操作账号（只读）、入库日期 DatePicker（默认今天）
  - 扫码入库开关 + 扫描输入框，先匹配集装箱号再匹配运单号，命中后高亮 `lastMatchedId`
  - 集装箱号下拉筛选（全部 + 动态 collOptions）
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.2 分组表格与 Radio 操作
  - 按集装箱号 rowSpan 合并（`calcRowSpan`），行按运单展开
  - 列：集装箱号、运单号、清关状态 Tag、业务员、说明、件数、重量、去向 Radio（到达仓库/直送客户）、货物状态 Radio（完好/货损/包装损/遗失）、处理状态 Tag
  - 统计区：总件数/总重量/已处理/到达仓库/直送客户/异常/当前批次/剩余
  - _Requirements: 2.4, 2.5, 2.6, 2.7_

- [x] 2.3 保存批次与最终确认
  - `handleSaveBatch(false)`：仅处理当前筛选范围内未处理的运单，回调 onSaveBatch
  - `handleSaveBatch(true)`：校验全部已处理，否则 message.warning，通过后回调 onFinalConfirm
  - 返回按钮调用 onBack
  - _Requirements: 2.8, 2.9, 2.10_

- [x] 3. DPN 入库 Tab（DestInboundList - DPN 维度）
- [x] 3.1 DPN 列表表格与 Mock 数据
  - `buildMockDpns(businessLine)` 生成 DpnInboundRecord Mock
  - 列：DPN号（含关联任务数）、调度线路、运输信息（运输方式/司机/车牌）、关联任务 Tag、当前站点、件数、重量、到站/入库状态、操作、更新日期
  - 复用 JOB 的筛选工具栏与统计标签
  - _Requirements: 3.1, 3.2_

- [x] 3.2 DPN 入库执行面板（DpnInboundExecutionPanel 内联组件）
  - 抽屉顶部：DPN Descriptions（DPN号/收货人/发往站点/执行日期/电话/地址/运输方式/物流公司/查询电话/司机/车牌/备注/入库状态/调度线路/关联任务/到站状态/件数/重量/更新时间）
  - 面板顶部：扫码入库开关 + 扫描输入框；统计 Tag（已选/待入库/已入库/到仓/异常）
  - 表格：所属任务 rowSpan 合并、运单号、到站状态 Tag、业务员、说明、件数、重量、入库结果 Radio、处理状态
  - _Requirements: 3.3, 3.4, 3.5, 3.6_

- [x] 3.3 提交与清单
  - 「提交入库」按钮：将勾选运单 handled 置为 true，根据剩余未处理数量更新 DPN inboundStatus 为 PARTIAL/COMPLETED
  - 清单抽屉复用 `dpnManifestColumns`，仅展示只读明细
  - _Requirements: 3.7, 3.8_

- [x] 4. 库存查询（DestStockList）
- [x] 4.1 表格与 Mock 数据
  - 定义 `StockWaybillRecord` 类型和 `buildMockData()` Mock（多组主订单 + 子订单）
  - 列：运单号（子单+主单）、业务员、用户、线路、服务类型 Tag、说明、重量、件数、支付方式、支付状态 Tag、履约方式 Tag、末端状态 Tag + 站点、操作、更新日期
  - 顶部统计：总记录数/总件数/总重量
  - _Requirements: 4.1, 4.10_

- [x] 4.2 国家-城市-站点级联与高级筛选
  - `LOCATION_DATA`（尼日利亚/加纳/几内亚/中国 + 对应城市/站点）
  - 基础筛选：国家/城市/站点/关键词
  - 高级筛选（展开面板）：日期范围 RangePicker、履约方式、物流状态、支付方式、支付状态、业务员
  - _Requirements: 4.2, 4.3, 4.4, 8.2, 8.3_

- [x] 4.3 批量通知与操作按钮
  - rowSelection 多选 + 批量通知
  - 按末端状态分支显示操作按钮：IN_STOCK 显示「安排配送/安排自提」；DPN_BOUND 显示「转为自提」；PICKUP_PENDING 显示「转为配送」；全部显示「通知/打印」
  - 安排配送弹 Modal 录入司机姓名/电话
  - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9_

- [x] 5. DPN 管理（DPNManageList）
- [x] 5.1 DPN 列表与角色视图
  - 顶部流程说明卡片 + Radio.Group 切换角色视图（全部/我发出的/发给我的）
  - `listViewRows` 将每条 DpnListRow 展开为 sender/receiver 两行 `DpnViewRow`，按 roleFilter 过滤
  - 表格列：DPN、类型（发出/接收 Tag）、站点流向、运单数、件数、重量Kg、当前状态、当前责任站点、操作、更新日期
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5.2 筛选、搜索与 API 集成
  - 关键词、线路、物流状态、执行状态筛选
  - `fetchDpns()` 调用 `v2PodApi.listDpns`，失败或数据不足时使用 `MOCK_DPN_ROWS` 兜底（按状态去重）
  - `listDpnCandidates` / `bindSubOrders` / `createDeliveryTask` / `getDpnDetail` / `createDpnDraft` 完整接入
  - _Requirements: 5.5, 5.6_

- [x] 5.3 创建 DPN Modal
  - 表单字段：发往站点、执行日期、运输方式（空运口/陆运口 Radio）、收件人姓名/电话/地址、物流公司、查询电话、司机姓名/电话、车牌、备注
  - 提交后组装 `remark` 字符串（`key:value | key:value`）调用 `createDpnDraft`，创建成功后打开绑定抽屉
  - _Requirements: 5.7, 5.13_

- [x] 5.4 绑定运单抽屉
  - 支持 MANUAL / SCAN 两种模式切换
  - 候选运单表格：JOB/站点（rowSpan）、运单号、订单号、客户、状态、件数、重量、更新时间
  - 底部显示已选汇总（count/pieces/weightKg）
  - _Requirements: 5.8_

- [x] 5.5 执行发车（派单）Modal
  - 表单字段：司机姓名、司机电话、driverUserId
  - 提交调用 `createDeliveryTask`
  - _Requirements: 5.9_

- [x] 5.6 详情抽屉与 Popover 悬停明细
  - 详情抽屉：DPN 元数据 Descriptions + 运单明细表（DPN 列 rowSpan 合并、JOB/站点 rowSpan 合并、汇总行）
  - 「运单数/件数/重量Kg」列 Popover 悬浮异步加载明细（`ensureHoverDetail` + `hoverDetails` 缓存）
  - 操作列按角色视图与状态显隐：绑定运单/执行发车/查看/入库/打印
  - _Requirements: 5.4, 5.10, 5.11, 5.12_

- [x] 6. 配送列表（DeliveryList）
- [x] 6.1 表格与 Mock Store
  - 使用 `podUiMockStore.buildDeliveryTaskRows` 加载数据
  - 列：序号、运单编号（子单+主单）、DPN（dpnNo + taskNo）、服务类型（配送方式 + 业务线）、发货人、收货人、电话、详细地址、区/城市、重量、件数、支付方式/状态、物流状态（任务状态 + DPN 状态 + 失败原因）、操作、更新日期
  - 统计标签：配送单总数 / 执行中 / 已签收 / 失败
  - _Requirements: 6.1, 6.7_

- [x] 6.2 筛选
  - 服务类型、支付状态、任务状态下拉 + 关键词搜索
  - _Requirements: 6.2_

- [x] 6.3 配送完成 / 失败 / 转自提
  - 「配送完成」按钮：Modal.confirm 二次确认 → `markDeliveryTaskCompleted`
  - 「配送失败」按钮：Modal 选 8 种原因（`DELIVERY_FAILURE_REASONS`） + 备注 → `markDeliveryTaskFailed`
  - 「转为自提」按钮：Modal 选自提站点（`PICKUP_STATION_OPTIONS`：IKEJ/ABUJ/LEKKI/YABA STA） + 备注 → `convertDeliveryTaskToPickup`
  - 操作按钮显隐逻辑：`ACTIVE_TASK_STATUSES` ∋ taskStatus 且 dpnStatus 非 SIGNED/CANCELLED 且 deliveryMethod=DELIVERY
  - _Requirements: 6.3, 6.4, 6.5, 6.6_

- [x] 7. 自提列表（PickupList）
- [x] 7.1 表格与 Mock Store
  - 使用 `podUiMockStore.listPickupRecords` 加载数据
  - 列：自提单号（含来源 Tag MOCK/CONVERTED）、运单号、收件人、电话、自提站点、自提码 Tag、支付（方式 + 状态 + 金额）、通知状态、操作、更新时间
  - 统计标签：自提单总数 / 已通知 / 已核销
  - _Requirements: 7.1, 7.6_

- [x] 7.2 筛选
  - 基础筛选：站点下拉、关键词
  - 高级筛选（展开面板）：支付状态、通知状态
  - _Requirements: 7.2, 7.3_

- [x] 7.3 通知与核销操作
  - 「通知」按钮：`markPickupNotified` 将记录置为 NOTIFIED；若已 PICKED_UP 则 message.info
  - 「核销自提」按钮：PENDING 时 message.warning 阻断；通过后 `markPickupCompleted`
  - _Requirements: 7.4, 7.5_

- [x] 8. 菜单集成
- [x] 8.1 App.tsx `MENU_CONFIG.wms_dest` 定义 6 个 Tab
  - `wms_dest_in_job` → DestInboundList initialTab="JOB"
  - `wms_dest_in_dpn` → DestInboundList initialTab="DPN"
  - `wms_dest_stock_list` → DestStockList
  - `wms_dest_dpn_manage` → DPNManageList
  - `wms_delivery_list` → DeliveryList
  - `wms_pickup_list` → PickupList
  - 角色权限：WAREHOUSE_US、OPS_US、ADMIN
  - _Requirements: 1.1, 3.1, 4.1, 5.1, 6.1, 7.1_
