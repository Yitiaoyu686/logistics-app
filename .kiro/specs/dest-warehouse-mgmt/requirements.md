# Requirements Document

## Introduction

到达国仓储模块，覆盖跨境物流到达目的国后的完整业务链路：货物入库（任务入库 + DPN入库 双维度）→ 库存管理（统一查询） → DPN跨站点调拨（我发出的/发给我的协同） → 配送列表 / 自提列表 → 末端签收。本模块面向到达国仓库操作员（WAREHOUSE_US）和到达国运营人员（OPS_US），作为产品经理 Demo 原型，使用 Mock 数据，重点关注视觉还原度、交互动效和界面流转完整性。

**核心数据层级**: JOB（航运批次）→ 集装箱号（COLL）→ 主运单 → 子运单（pieces）

**站点数据隔离**: 国家 → 城市 → 站点 三级筛选，操作员默认查看本站点数据

**导航定位**: 菜单 `wms_dest`（到达国仓储），下含 6 个 Tab：任务入库、DPN入库、库存查询、DPN管理、配送列表、自提列表。

## Requirements

### Requirement 1: 任务入库（DestInboundList - JOB Tab）

**Objective:** As a 到达国仓库操作员, I want 按 JOB 任务维度查看到达的航运批次并执行入库, so that 我能将清关放行后的货物按任务接收并标记入库结果

#### Acceptance Criteria

1. The 任务入库页面 shall 以表格形式展示 JOB 列表，包含列：任务编号（jobNo + 服务类型/业务线）、船公司/提单号、起运港、目的港、集装箱号、当前站点、默认交付（待配送/待自提/待确认/混合）、件数、重量(kg)、物流状态（待入库/部分入库/已入库 + 清关状态）、操作（入库/清单）、更新日期。
2. The 任务入库页面 shall 支持按国家→城市→站点三级级联筛选，三级联动重置子级。
3. The 任务入库页面 shall 提供入库状态下拉筛选（待入库 / 部分入库 / 已入库）。
4. The 任务入库页面 shall 提供关键词搜索框，支持按任务号、提单号、承运商、集装箱号搜索。
5. When 用户点击「入库」按钮时, the 任务入库页面 shall 在抽屉中打开 `DestInboundOperation` 操作界面，加载该 JOB 的待入库运单。
6. When 用户点击「清单」按钮时, the 任务入库页面 shall 在抽屉中显示该 JOB 的运单清单（含集装箱号、运单号、订单号、状态、业务员、说明、件数、重量、入库结果、处理状态）。
7. The 任务入库页面 shall 在顶部展示统计标签（待入库任务数 / 总件数 / 总重量）。
8. The 任务入库页面 shall 在物流状态列同时展示状态 Tag（颜色：processing/warning/success）和清关状态 + 当前站点的辅助文本。

### Requirement 2: 货物入库操作（DestInboundOperation）

**Objective:** As a 到达国仓库操作员, I want 对到达的货物按集装箱分组逐件确认入库结果, so that 准确记录实际到货情况、处理货损货差并支持分批保存

#### Acceptance Criteria

1. The 入库操作页面 shall 顶部显示操作账号（只读）和入库日期 DatePicker（默认当天）。
2. The 入库操作页面 shall 提供「扫码入库」开关，开启后显示扫描输入框；扫描集装箱号定位该箱所有运单，扫描运单号定位单条记录。
3. The 入库操作页面 shall 提供集装箱号下拉筛选（"全部" + 该 JOB 下所有集装箱号）。
4. The 入库操作页面 shall 以表格展示该 JOB 的运单列表，列：集装箱号（rowSpan 合并相同集装箱）、运单号、清关状态（已清关/未清关 Tag）、业务员、说明、件数、重量Kg、去向（Radio：到达仓库/直送客户）、货物状态（Radio：完好/货损/包装损/遗失）、处理状态（已处理/未处理 Tag）。
5. When 用户切换「去向」Radio时, the 入库操作页面 shall 更新该运单的 deliveryStatus 字段。
6. When 用户切换「货物状态」Radio时, the 入库操作页面 shall 更新该运单的 cargoCondition 字段；非 GOOD 时计入异常统计。
7. The 入库操作页面 shall 显示统计区：总件数、总重量、已处理数、到达仓库数、直送客户数、异常数、当前批次待处理数、剩余待处理数。
8. When 用户点击「保存批次」按钮时, the 入库操作页面 shall 仅将当前可见筛选范围内未处理的运单标记为已入库，并回调 onSaveBatch 持久化到列表组件，列表 JOB 入库状态变为 PARTIAL（若仍有未处理）。
9. When 用户点击「最终确认」按钮时, the 入库操作页面 shall 要求所有运单已处理，否则弹出 message.warning；通过后回调 onFinalConfirm，列表 JOB 状态置为 COMPLETED。
10. When 用户点击「返回」按钮时, the 入库操作页面 shall 关闭抽屉返回任务入库列表。

### Requirement 3: DPN 入库（DestInboundList - DPN Tab）

**Objective:** As a 卫星站到达国仓库操作员, I want 接收主仓通过 DPN 转运过来的货物并完成入库确认, so that 卫星站库存正确接收 DPN 内的所有运单

#### Acceptance Criteria

1. The DPN 入库页面 shall 以表格展示 DPN 列表，列：DPN 号（含关联任务数 + 业务线）、调度线路、运输信息（运输方式 + 司机 + 车牌）、关联任务（Tag 列表）、当前站点、件数、重量(kg)、到站/入库状态（Tag + 到站状态/当前站点）、操作（入库/清单）、更新日期。
2. The DPN 入库页面 shall 复用与任务入库相同的国家/城市/站点三级筛选和入库状态筛选。
3. When 用户点击「入库」按钮时, the DPN 入库页面 shall 打开 DPN 入库执行抽屉，顶部展示 DPN 元数据 Descriptions（DPN号、收货人、发往站点、执行日期、电话、地址、运输方式、物流公司、查询电话、司机名称/电话、车牌、备注、入库状态、调度线路、关联任务、到站状态/时间、总件数、总重量、更新时间）。
4. The DPN 入库执行面板 shall 在表格上方提供「扫码入库」开关；扫描运单号自动勾选对应行。
5. The DPN 入库执行面板 shall 以表格展示运单明细：所属任务（rowSpan 合并）、运单号、到站状态、业务员、说明、件数、重量、入库结果（Radio：到达仓库/货损/包装损/货物遗失）、处理状态。
6. The DPN 入库执行面板 shall 在顶部展示统计 Tag：已选运单、待入库、已入库；表格上方展示运单数、到仓数、异常数、件数、重量。
7. When 用户勾选运单并点击「提交入库」按钮时, the DPN 入库页面 shall 将所选运单 handled 置为 true，根据剩余未处理数量更新 DPN 状态为 PARTIAL 或 COMPLETED，并 message.success 提示。
8. When 用户点击「清单」按钮时, the DPN 入库页面 shall 打开清单抽屉，仅展示运单只读明细（不含 Radio 操作）。

### Requirement 4: 库存查询（DestStockList）

**Objective:** As a 到达国仓库操作员, I want 查看本站点已入库到仓库的所有运单库存, so that 我能管理库存并安排后续配送或自提

#### Acceptance Criteria

1. The 库存查询页面 shall 以表格展示已入库运单，列：运单号（子单 + 主单）、业务员、用户、线路、服务类型（特快/普快 Tag）、说明、重量Kg、件数、支付方式（预付/到付）、支付状态（已付/未付 Tag）、履约方式（配送/自提 Tag）、末端状态（在库待分配/待配送/待自提 Tag + 站点）、操作、更新日期。
2. The 库存查询页面 shall 支持国家→城市→站点三级级联筛选，使用 LOCATION_DATA 配置（尼日利亚-拉各斯/卡诺/阿布贾/奥尼查、加纳-阿克拉、几内亚-科纳克里、中国-广州/深圳）。
3. The 库存查询页面 shall 提供高级筛选展开面板，包含：日期范围、履约方式、物流状态（在库待分配 / 待配送 / 待自提）、支付方式、支付状态、业务员。
4. The 库存查询页面 shall 提供关键词搜索框，支持按运单号、订单号、用户、业务员、线路搜索。
5. The 库存查询页面 shall 支持 rowSelection 多选并提供"批量通知"操作（操作列）。
6. While 末端状态为 IN_STOCK 时, the 库存查询页面 shall 在操作列显示「安排配送」和「安排自提」按钮。
7. While 末端状态为 DPN_BOUND 时, the 库存查询页面 shall 在操作列显示「转为自提」按钮。
8. While 末端状态为 PICKUP_PENDING 时, the 库存查询页面 shall 在操作列显示「转为配送」按钮。
9. The 库存查询页面 shall 始终在操作列显示「通知」（已通知则置灰）和「打印」按钮。
10. The 库存查询页面 shall 在顶部展示统计标签：总记录数 / 总件数 / 总重量。

### Requirement 5: DPN 管理（DPNManageList）

**Objective:** As a 到达国运营人员, I want 创建并管理跨站点 DPN 调拨任务，从"我发出的"和"发给我的"两个视角协同完成发运与接收, so that 主仓与卫星站之间的运单流转有据可查

#### Acceptance Criteria

1. The DPN 管理页面 shall 提供角色视图筛选：全部 / 我发出的（SENDER） / 发给我的（RECEIVER），以 Radio.Group 展示，默认全部。
2. The DPN 管理页面 shall 在顶部展示统一流程说明卡片：待绑定 → 待发运 → 运输中 → 已到达 → 待入库 → 已入库。
3. The DPN 管理页面 shall 以表格展示 DPN 列表，列：DPN（dpnNo + 创建时间，可点击进入详情）、类型（发出/接收 Tag）、站点流向（发出站 → 接收站 + 调度线路）、运单数、件数、重量Kg、当前状态（统一状态 Tag）、当前责任站点、操作、更新日期。
4. The DPN 管理页面 shall 在「运单数 / 件数 / 重量Kg」列上鼠标悬浮时弹出 Popover 展示该 DPN 内的运单明细（DPN明细子表，含 JOB/站点 rowSpan、单号、业务员、用户、线路、件数、尺寸CM、体积CBM、体积重Kg、重量Kg）。
5. The DPN 管理页面 shall 提供筛选条件：关键词（DPN号/任务号/运单号/站点）、线路下拉、物流状态下拉、执行状态下拉。
6. The DPN 管理页面 shall 提供「查询」「刷新」「创建DPN任务」三个工具栏按钮。
7. When 用户点击「创建DPN任务」按钮时, the DPN 管理页面 shall 弹出**精简版**创建 Modal（2026-04 设计调整），仅录入规划阶段信息：DPN号（自动生成只读）、收件人姓名/电话/地址、发往站点（toStation）、执行日期（executeDate）、运输方式（DELIVERY 空运口 / SATELLITE_STATION 陆运口 Radio）、备注。**不再包含**物流公司、查询电话、司机姓名、司机电话、车牌字段（迁移到执行发车环节）。Modal 底部显示蓝色 Alert 提示此迁移规则。提交后调用 `v2PodApi.createDpnDraft` 创建草稿并自动打开「绑定运单」抽屉。
8. While DPN 处于 SENDER 角色视图且状态为「待绑定」时, the 操作列 shall 显示「绑定运单」按钮；点击后打开绑定抽屉，提供「手动选择 / 扫码」两种模式从可绑定运单候选列表中勾选并调用 `v2PodApi.bindSubOrders` 提交。
9. While DPN 处于 SENDER 角色视图且状态为「待发运」（itemCount > 0）时, the 操作列 shall 显示「执行发车」按钮；点击后弹出**增强版**执行发车 Modal（2026-04 重构，宽度 720px），分三组字段：① 物流公司信息：物流公司 Select（数据源：基础设置 → 供应商管理 `supplierType=TRUCKING`，失败时回退到 `FALLBACK_DPN_TRUCKING_SUPPLIERS` 5 家预设）、查询电话；② 司机与车辆：司机名称、司机电话、车牌号（均必填）；③ 发车时间与备注：实际发车时间（DatePicker showTime，默认当前时间）、发车备注。提交后调用 `v2PodApi.createDeliveryTask`，并将所有新字段合并进 DPN.remark 后 `setRows` 本地即时刷新。已移除原 `driverUserId` 字段，改为内部默认 `U-OPS-US-01`。
10. While DPN 处于 RECEIVER 角色视图且状态为「待入库」时, the 操作列 shall 显示「入库」按钮，点击提示用户前往「DPN 入库」Tab 处理。
11. The 操作列 shall 始终显示「查看」（打开详情抽屉）和「打印」按钮。
12. When 用户点击 DPN 号或「查看」按钮时, the DPN 管理页面 shall 打开详情抽屉，展示 DPN 元数据 + 运单明细表（含 DPN 列 rowSpan 合并、JOB/站点 列 rowSpan 合并、汇总行：件数/体积/体积重/重量）。
13. The DPN 管理页面 shall 通过解析 `remark` 字段提取 routeName/toStation/executeDate/logisticsCompany/queryPhone/driverName/driverPhone/plateNo/**actualDepartureTime**/note 等元数据用于展示（2026-04 新增 actualDepartureTime 字段）。
14. The DPN 详情抽屉顶部 shall 分两行展示信息：① 第一行规划信息（DPN/发往站点/执行日期）；② 第二行灰底卡片"发车信息"区块（物流公司/车牌/司机/司机电话/查询电话/实际发车时间/备注），副标题注明"由执行发车时填写"。执行发车成功后发车信息区块立即刷新。

### Requirement 6: 配送列表（DeliveryList）

**Objective:** As a 到达国仓库操作员, I want 管理所有送货上门的配送任务，跟踪状态并处理失败/转自提场景, so that 配送闭环可控且失败可追溯

#### Acceptance Criteria

1. The 配送列表页面 shall 以表格展示配送任务，列：序号、运单编号（子单 + 主单）、DPN（dpnNo + taskNo）、服务类型（送货上门/自提/卫星站点 + 海运/空运 Tag）、发货人（客户名 + 仓库）、收货人、电话、详细地址、区/城市、重量kg、件数、支付方式/状态（Tag + 金额 + 币种）、物流状态（任务状态 Tag + DPN 状态 + 失败原因）、操作、更新日期。
2. The 配送列表页面 shall 提供筛选：服务类型（送货上门/自提/卫星站点）、支付状态（未付/部分付款/已付）、任务状态（待接单/已接单/配送中/已送达/已签收/配送失败/已取消）、关键词（任务号/DPN号/收件人/电话/客户/地址）。
3. While 任务状态为 PENDING/ACCEPTED/IN_TRANSIT/DELIVERED 且 DPN 状态非 SIGNED/CANCELLED 且 deliveryMethod=DELIVERY 时, the 操作列 shall 显示「配送完成」「配送失败」「转为自提」三个按钮，否则显示「-」。
4. When 用户点击「配送完成」按钮时, the 配送列表页面 shall 弹出 Modal.confirm 二次确认；确认后调用 `markDeliveryTaskCompleted`，将 DPN 状态置为 SIGNED，并 message.success。
5. When 用户点击「配送失败」按钮时, the 配送列表页面 shall 弹出失败原因表单 Modal，必填字段为失败原因（PHONE_UNREACHABLE、ADDRESS_NOT_FOUND、CUSTOMER_NOT_HOME、CUSTOMER_RESCHEDULE、REFUSED_BY_CUSTOMER、PAYMENT_NOT_READY、SECURITY_RESTRICTION、PACKAGE_DAMAGED 共 8 项），可选备注；提交后调用 `markDeliveryTaskFailed`。
6. When 用户点击「转为自提」按钮时, the 配送列表页面 shall 弹出转自提表单 Modal，必填自提站点（IKEJ / ABUJ / LEKKI / YABA STA），可选备注；提交后调用 `convertDeliveryTaskToPickup`，运单转入自提列表。
7. The 配送列表页面 shall 在顶部展示统计 Tag：配送单总数 / 执行中 / 已签收 / 失败。

### Requirement 7: 自提列表（PickupList）

**Objective:** As a 到达国仓库操作员, I want 管理所有自提运单，先发通知后核销取件, so that 客户到站自提的流程可追溯

#### Acceptance Criteria

1. The 自提列表页面 shall 以表格展示自提记录，列：自提单号（pickupNo + 来源 Tag MOCK/CONVERTED）、运单号、收件人、电话、自提站点（含备注）、自提码（紫色 Tag）、支付（方式 + 状态 Tag + 金额）、通知状态（待通知/已通知/已核销 Tag）、操作（通知/核销自提）、更新时间。
2. The 自提列表页面 shall 提供基础筛选：自提站点下拉、关键词（自提单号/运单号/收件人/电话）。
3. The 自提列表页面 shall 提供高级筛选展开面板：支付状态、通知状态。
4. When 用户点击「通知」按钮时, the 自提列表页面 shall 调用 `markPickupNotified` 将该记录置为 NOTIFIED，并 message.success 显示自提码；若已 PICKED_UP 则提示已完成核销。
5. When 用户点击「核销自提」按钮时, the 自提列表页面 shall 校验通知状态：若为 PENDING 则 message.warning 阻断；通过后调用 `markPickupCompleted` 将记录置为 PICKED_UP。
6. The 自提列表页面 shall 在顶部展示统计 Tag：自提单总数 / 已通知 / 已核销。

### Requirement 8: 国家-城市-站点级联与数据隔离

**Objective:** As a 系统使用者, I want 在所有列表页统一使用国家→城市→站点三级筛选, so that 不同站点的操作员只看到自己的数据

#### Acceptance Criteria

1. The 任务入库 / DPN 入库页面 shall 使用 COUNTRY_CITY_STATION 配置：尼日利亚（拉各斯：IKEJ STA / CV STA / VI STA、阿布贾：ABUJ STA、卡诺：KAN STA）、加纳（阿克拉：ACC STA）。
2. The 库存查询页面 shall 使用 LOCATION_DATA 配置：尼日利亚（拉各斯：IKEJ STA / HAIZ STA、卡诺：KANO STA、阿布贾：ABUJ STA、奥尼查：ONIT STA）、加纳（阿克拉：ACCRA STA）、几内亚（科纳克里：CONK STA）、中国（广州：GZ STA、深圳：SZ STA）。
3. When 用户切换上级筛选时, the 所有列表页 shall 重置下级筛选为「全部」。
4. The 三级筛选 shall 使用 Ant Design Select + ListPageToolbarField 渲染。
