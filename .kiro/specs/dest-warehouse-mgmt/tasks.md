# Implementation Plan

- [x] 1. 货物入库列表（DestInboundList 重构）
- [x] 1.1 定义 Mock 数据和类型，重构入库列表基础表格
  - 定义 DestInboundJobRecord 类型和 Mock 数据（20条JOB记录，含父子JOB关系）
  - 重构 DestInboundList 组件，替换现有表格为 JOB 维度展示
  - 表格列：序号、站点/JOB、类型（特快/普快Tag）、承运人/提单号、起运港、目的港、集装号、重量、件数、物流状态、操作账户、操作按钮、更新日期
  - 使用 Table expandable 实现父子 JOB 行展示，子JOB折叠在父JOB下
  - 集装号列使用 Tag 组件渲染，超过 8 个时截断显示"......More"并附 Tooltip 展示完整列表
  - _Requirements: 1.1, 1.5, 1.6_

- [x] 1.2 实现三级级联筛选和搜索功能
  - 添加国家→城市→站点三级联动 Select 筛选器，默认展示当前站点数据
  - 添加年/月/日筛选器和执行状态下拉筛选
  - 添加关键词搜索框，支持按JOB号、提单号、航空公司搜索
  - 筛选联动：选择国家后城市选项更新，选择城市后站点选项更新
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 1.3 实现视图切换和操作按钮
  - 添加 currentView state 控制列表/入库操作/JOB详情三个视图的切换
  - "入库"按钮点击后切换到 DestInboundOperation 子视图，传递选中的 jobId
  - "清单"按钮点击后切换到 JobDetail 子视图，传递选中的 jobId
  - _Requirements: 1.7, 1.8_

- [x] 2. 货物入库操作（DestInboundOperation 新建）
- [x] 2.1 创建入库操作组件和表格
  - 创建 DestInboundOperation 组件，接收 jobId 和 onBack 回调
  - 顶部显示操作账号（只读）和入库日期 DatePicker（默认当天）
  - 添加"扫码入库"Checkbox 模式切换
  - 定义 InboundOperationItem Mock 数据（按JOB/站点+集装号分组，约22条运单）
  - _Requirements: 2.1, 2.2_

- [x] 2.2 实现表格分组展示和异常标记
  - 表格按 JOB/站点和集装号分组，使用 rowSpan 合并相同分组的单元格
  - 集装号列显示"AK1 5PCS"格式（集装号+件数）
  - 表格列：JOB/站点、集装号(COLL)、单号、放行状态（Tag）、业务员、说明、件数、重量Kg
  - 添加 4 个 Checkbox 列：到达仓库、货物损坏、包装损坏、货物丢失
  - Checkbox 勾选后更新对应运单的状态标记
  - 底部汇总行显示总件数和总重量
  - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 2.3 实现提交和返回逻辑
  - "提交"按钮点击后收集所有入库记录和异常标记，message.success 提示成功
  - 提交后更新运单物流状态为"已入库"
  - "返回"按钮调用 onBack 回调返回入库列表
  - _Requirements: 2.8, 2.9_

- [x] 3. JOB详情与集装号详情（JobDetail + CollDetail 新建）
- [x] 3.1 (P) 创建 JobDetail 组件
  - 创建 JobDetail 组件，接收 jobNo 和 onBack 回调
  - 显示 JOB 编号标题
  - 表格展示该 JOB 下所有集装号：序号、集装号、线路、服务、说明、内件数量、尺寸CM、体积CBM、体积重KGS、毛量KGS
  - 定义 JobCollRecord Mock 数据（约19个集装号）
  - 底部汇总行统计总件数、总体积、总体积重、总毛重
  - 点击集装号行切换到 CollDetail 子视图
  - "返回"按钮调用 onBack
  - _Requirements: 3.1, 3.2, 3.6_

- [x] 3.2 (P) 创建 CollDetail 组件
  - 创建 CollDetail 组件，接收 collNo 和 onBack 回调
  - 显示集装号标题
  - 表格展示运单明细：序号、单号、第三方运单（快递公司+单号格式）、城市、业务员、用户、品名、说明、件数、体积CBM、体积重KGS、毛量KGS
  - 定义 CollWaybillRecord Mock 数据（约18条运单，含顺丰/韵达/圆通等快递信息）
  - 底部汇总行统计总件数、总体积、总体积重、总毛重
  - "返回"按钮调用 onBack
  - _Requirements: 3.3, 3.4, 3.5, 3.6_

- [x] 4. 库存列表（DestStockList 重构）
- [x] 4.1 (P) 重构库存列表表格和 Mock 数据
  - 定义 StockWaybillRecord Mock 数据（20条运单记录，含不同支付方式/状态/业务员）
  - 重构表格列：序号、运单号、业务员、用户、线路、服务类型（特快/普快Tag）、说明（普货/其它）、重量Kg、件数、支付方式、支付状态（Tag）、物流状态、操作（通知+打印按钮）、更新日期
  - _Requirements: 4.1_

- [x] 4.2 (P) 实现多维筛选和搜索
  - 添加国家→城市→站点三级联动筛选
  - 添加日期范围选择器（起始日期-结束日期）
  - 添加物流状态、支付方式、支付状态、业务员下拉筛选
  - 添加关键词搜索框，支持按订单号、JOB号、集装号、快递单号、电话、收发货人名字搜索
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] 4.3 实现批量通知和打印操作
  - 表格添加 rowSelection 勾选功能
  - 单条"通知"按钮点击后标记该运单为已通知
  - 批量勾选后显示"批量完成通知"按钮，点击批量标记选中运单为已通知
  - "打印"按钮点击触发 message.success 占位提示
  - _Requirements: 4.6, 4.7_

- [x] 5. DPN管理列表（DPNManageList 新建）
- [x] 5.1 创建 DPN 管理列表基础组件和 Mock 数据
  - 定义 DPNManageRecord 和 DPNJobSubRow Mock 数据（20条DPN记录，每条含1-4个JOB子行）
  - 创建 DPNManageList 组件，表格列：序号、DPN号（含创建时间）、线路、JOB（站点）、订单号、重量Kg、件数、物流状态（含站点+时间）、执行状态（含站点+时间）、操作按钮、更新日期
  - 使用 Table expandable 实现 DPN→JOB 父子行展示
  - JOB 子行显示站点信息和包含的订单号列表，订单号超出显示"......更多"
  - _Requirements: 5.1, 5.2_

- [x] 5.2 实现筛选、搜索和操作按钮
  - 添加国家→城市级联筛选、年/月筛选
  - 添加线路、物流状态、执行状态下拉筛选
  - 添加关键词搜索框（调度号/JOB号/订单号）
  - "创建DPN任务"按钮切换到创建视图
  - 操作列按执行状态动态渲染：待执行显示"执行+打印"，已执行仅显示"打印"
  - 点击DPN号或订单号打开DPN详情视图
  - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

- [x] 6. 创建与编辑DPN（DPNCreate 新建）
- [x] 6.1 (P) 创建DPN表单组件
  - 创建 DPNCreate 组件，接收 isEdit、dpnId、onBack 回调
  - 左侧栏：DPN号（自动生成只读）、创建日期/账号（自动填充只读）、发往站点（Select）、重量（InputNumber）、件数（InputNumber）、执行日期（DatePicker）、运输方式（空运/陆运 Radio）、备注（TextArea）
  - 右侧栏：收件人姓名、电话、地址；物流公司（Select）、运单号/订单号（Input）、查询电话（Input）、司机名称、司机电话、车牌
  - 使用 Row + Col 实现左右两栏布局
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 6.2 实现发布、保存和编辑逻辑
  - "发布"按钮：表单校验通过后保存DPN并返回列表，message.success 提示
  - "保存"按钮（仅编辑模式）：暂存修改不发布
  - 编辑模式：根据 dpnId 加载已有DPN数据预填充表单
  - "返回"按钮调用 onBack
  - _Requirements: 6.4, 6.5, 6.6_

- [x] 7. DPN详情（DPNDetail 新建）
- [x] 7.1 (P) 创建DPN详情组件
  - 创建 DPNDetail 组件，接收 dpnId 和 onBack 回调
  - 顶部显示 DPN 基本信息（DPN号、线路、创建时间）
  - 表格展示运单明细：DPN、JOB/站点、单号、业务员、用户、线路、件数、尺寸CM、体积CBM、体积重KGS、重量KGS
  - 按 JOB/站点对运单进行分组展示（rowSpan 合并）
  - 定义 DPNWaybillRecord Mock 数据（约12条运单，跨多个JOB）
  - 底部汇总行统计总件数、总体积、总体积重、总重量
  - "提交"按钮确认DPN入库（打包完成），message.success 提示
  - "返回"按钮调用 onBack
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8. 执行DPN任务（DPNExecute 新建）
- [x] 8.1 (P) 创建执行DPN基础组件
  - 创建 DPNExecute 组件，接收 dpnId 和 onBack 回调
  - 顶部添加手动添加/扫描添加 Checkbox 切换和离库日期 DatePicker
  - 表格展示待配送运单列表：DPN、JOB/站点、订单号、业务员、收件人、线路、件数、尺寸CM、体积CBM、体积重Kg、重量Kg
  - 定义 DPNExecWaybill Mock 数据（约9条运单）
  - 底部汇总行统计总件数、总体积、总体积重、总重量
  - _Requirements: 8.1, 8.2, 8.3, 8.8_

- [x] 8.2 实现手动添加面板和执行逻辑
  - 手动添加模式下显示可添加运单表格（带 rowSelection 勾选框）
  - 手动添加面板底部显示汇总行和"确认"按钮
  - 勾选运单并点击"确认"后，将选中运单从可添加列表移到配送列表
  - 配送列表中每行支持"X"按钮移除，移除后运单回到可添加列表
  - "执行"按钮更新DPN状态为"配送中"，记录离库日期，message.success 提示
  - "返回"按钮调用 onBack
  - _Requirements: 8.4, 8.5, 8.6, 8.7_

- [x] 9. 配送列表（DeliveryList 重构）
- [x] 9.1 重构配送列表表格和 Mock 数据
  - 定义 DeliveryWaybillRecord Mock 数据（20条运单，含不同支付/通知状态）
  - 重构表格列：序号、运单编号（带勾选框）、服务类型（Tag）、发货人、收货人、电话、详细地址、区/城市、重量kg、件数、支付方式/状态（含时间）、物流状态（含站点+时间）、操作（通知+配送按钮）、更新日期
  - 添加国家→城市→站点三级筛选、服务类型/支付方式/支付状态下拉筛选
  - 添加关键词搜索框
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 9.2 实现批量通知和配送校验逻辑
  - 表格添加 rowSelection 勾选功能
  - "批量完成通知"按钮：批量将选中运单标记为已通知状态
  - 单条"通知"按钮：标记该运单为已通知
  - 配送按钮校验：未通知收货人时弹出 Modal.warning 阻断（"尚未通知收货人，不能配送"）
  - 配送按钮校验：未支付时弹出 Modal.confirm 确认（"尚未支付XXX，是否继续配送？"）
  - 校验通过后弹出配送方式选择弹窗（Radio：自提/配送），确认后更新运单状态
  - _Requirements: 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

- [x] 10. DPN入库确认（DPNInbound 重构）
- [x] 10.1 (P) 重构DPN入库组件
  - 定义 DPNInboundItem Mock 数据（约12条运单，按JOB/站点分组）
  - 顶部添加手动入库/扫码入库 Checkbox 切换
  - 表格按JOB/站点分组展示：DPN、JOB/站点、单号、业务员、用户、线路、件数、重量Kg
  - 添加 4 个 Checkbox 列：到达仓库、货物损坏、包装损坏、货物丢失
  - Checkbox 勾选后更新对应运单状态标记
  - 底部汇总行统计总件数和总重量
  - "提交"按钮保存入库记录并更新DPN状态，message.success 提示
  - "返回"按钮返回DPN列表
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 11. 菜单集成与视图联调
- [x] 11.1 更新 App.tsx 菜单配置和路由
  - 在 MENU_CONFIG 的 wms_dest 菜单下添加/更新菜单项：货物入库、库存查询、DPN管理、DPN入库、配送列表
  - 在 ContentRenderer switch 中添加/更新对应 case，渲染正确的组件
  - 确保所有新组件正确 import
  - 验证菜单项的 roles 权限数组包含 WAREHOUSE_US 和 OPS_US
  - _Requirements: 1.1, 4.1, 5.1, 9.1, 10.1_

- [x] 11.2 验证完整业务流转路径
  - 验证入库流程：入库列表 → 点击入库 → 入库操作 → 提交 → 返回列表
  - 验证JOB详情流程：入库列表 → 点击清单 → JOB详情 → 点击集装号 → 集装号详情 → 返回
  - 验证DPN流程：DPN列表 → 创建DPN → 发布 → DPN详情 → 提交入库 → 执行DPN → 配送中
  - 验证配送流程：配送列表 → 批量通知 → 点击配送 → 校验 → 选择配送方式 → 完成
  - 确保所有返回按钮正确返回上一级视图
  - _Requirements: 1.7, 1.8, 2.8, 2.9, 3.6, 5.7, 5.10, 6.4, 7.4, 7.5, 8.7, 9.7_
