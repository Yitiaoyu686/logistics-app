# Requirements Document

## Introduction

到达国仓管理模块，覆盖跨境物流到达目的国后的完整业务链路：货物入库（JOB维度清关后接收）→ 库存管理 → DPN管理（按收货地址跨JOB重新组包）→ 配送管理。本模块面向到达国仓库操作员和运营人员，作为产品经理 Demo 原型，使用 Mock 数据，重点关注视觉还原度、交互动效和界面流转完整性。

**核心数据层级**: JOB（航运批次）→ 集装号（COLL）→ 运单 → 件

**状态流转**: 已入库 → 待配送 → 配送中 → 已完成

**站点数据隔离**: 国家 → 城市 → 站点 三级筛选，操作员只能查看本站点数据

## Requirements

### Requirement 1: 货物入库列表

**Objective:** As a 到达国仓库操作员, I want 查看所有到达的JOB航运批次及其入库状态, so that 我能掌握当前到货情况并安排入库操作

#### Acceptance Criteria

1. The 到达国仓模块 shall 以表格形式展示JOB列表，包含列：序号、站点/JOB、类型（特快/普快）、承运人/提单号、起运港、目的港、集装号、重量、件数、物流状态、操作账户、操作、更新日期
2. The 到达国仓模块 shall 支持按国家→城市→站点三级级联筛选，默认展示当前操作员所属站点的数据
3. The 到达国仓模块 shall 支持按年/月/日筛选和按执行状态筛选
4. The 到达国仓模块 shall 支持通过JOB号、提单号、航空公司关键词搜索
5. When 一个JOB包含多个子JOB时, the 到达国仓模块 shall 将子JOB作为主JOB下的子行展示（父子行合并显示）
6. The 到达国仓模块 shall 在集装号列中展示该JOB下所有集装号标签，超过一定数量时显示"......More"折叠提示
7. When 用户点击"入库"按钮时, the 到达国仓模块 shall 跳转到该JOB的货物入库操作页面
8. When 用户点击"清单"按钮时, the 到达国仓模块 shall 打开该JOB的详情页，展示所有集装号及其运单明细

### Requirement 2: 货物入库操作

**Objective:** As a 到达国仓库操作员, I want 对到达的货物逐件进行入库确认并标记异常, so that 准确记录实际到货情况并追踪货损货差

#### Acceptance Criteria

1. The 货物入库页面 shall 显示操作账号和入库日期选择器，入库日期默认为当天
2. The 货物入库页面 shall 支持"扫码入库"模式切换（checkbox）
3. The 货物入库页面 shall 以表格展示待入库运单列表，按JOB/站点分组，包含列：JOB/站点、集装号（COLL）、单号、放行状态、业务员、说明、件数、重量Kg、到达仓库、货物损坏、包装损坏、货物丢失
4. The 货物入库页面 shall 在每个集装号旁显示该集装号内的件数（如"AK1 5PCS"）
5. When 用户勾选"到达仓库"checkbox时, the 货物入库页面 shall 将该运单标记为已到库
6. When 用户勾选"货物损坏"、"包装损坏"或"货物丢失"checkbox时, the 货物入库页面 shall 将该运单标记为对应异常状态
7. The 货物入库页面 shall 在表格底部显示汇总行，包含总件数和总重量
8. When 用户点击"提交"按钮时, the 货物入库页面 shall 保存所有入库记录和异常标记，更新运单物流状态为"已入库"
9. When 用户点击"返回"按钮时, the 货物入库页面 shall 返回货物入库列表

### Requirement 3: JOB详情与集装号详情

**Objective:** As a 到达国运营人员, I want 查看JOB下所有集装号的货物明细, so that 我能了解每批货物的组成和状态

#### Acceptance Criteria

1. When 用户点击JOB清单时, the 到达国仓模块 shall 显示JOB详情，以表格展示该JOB下所有集装号列表，包含列：序号、集装号、线路、服务、说明、内件数量、尺寸CM、体积CBM、体积重KGS、毛量KGS
2. The JOB详情页面 shall 在底部显示汇总行，统计总件数、总体积、总体积重、总毛重
3. When 用户点击某个集装号时, the 到达国仓模块 shall 显示该集装号的运单明细，包含列：序号、单号、第三方运单、城市、业务员、用户、品名、说明、件数、体积CBM、体积重KGS、毛量KGS
4. The 集装号详情 shall 显示第三方快递公司及运单号信息（如"顺丰速运 SF1012605193752"）
5. The 集装号详情 shall 在底部显示汇总行，统计总件数、总体积、总体积重、总毛重
6. When 用户点击"返回"按钮时, the 详情页面 shall 返回上一级页面

### Requirement 4: 库存列表

**Objective:** As a 到达国仓库操作员, I want 查看已入库到仓库中的所有运单库存, so that 我能管理库存并安排后续配送

#### Acceptance Criteria

1. The 库存列表 shall 以表格展示所有已入库运单，包含列：序号、运单号、业务员、用户、线路、服务类型、说明、重量Kg、件数、支付方式、支付状态、物流状态、操作、更新日期
2. The 库存列表 shall 支持按国家→城市→站点三级级联筛选
3. The 库存列表 shall 支持按起始日期和结束日期范围筛选
4. The 库存列表 shall 支持按物流状态、支付方式、支付状态、业务员筛选
5. The 库存列表 shall 支持通过订单号、JOB号、集装号、快递单号、电话、收发货人名字关键词搜索
6. When 用户点击"通知"按钮时, the 库存列表 shall 触发对该运单收货人的通知操作（批量勾选后支持批量通知）
7. When 用户点击"打印"按钮时, the 库存列表 shall 触发该运单的打印操作

### Requirement 5: DPN管理列表

**Objective:** As a 到达国运营人员, I want 管理DPN配送调度任务, so that 我能将同目的地的运单跨JOB重新组包并安排配送

#### Acceptance Criteria

1. The DPN管理列表 shall 以表格展示所有DPN任务，包含列：序号、DPN号、线路、JOB、订单号、重量Kg、件数、物流状态、执行状态、操作、更新日期
2. When 一个DPN包含多个JOB时, the DPN管理列表 shall 将多个JOB作为该DPN下的子行展示，每个JOB行显示其所属站点和包含的订单号
3. The DPN管理列表 shall 支持按国家→城市三级级联筛选
4. The DPN管理列表 shall 支持按年/月筛选
5. The DPN管理列表 shall 支持按线路、物流状态、执行状态筛选
6. The DPN管理列表 shall 支持通过调度号、JOB号、订单号关键词搜索
7. When 用户点击"创建DPN任务"按钮时, the DPN管理列表 shall 跳转到创建DPN页面
8. While DPN执行状态为"待执行"时, the DPN管理列表 shall 在操作列显示"执行"和"打印"按钮
9. While DPN执行状态为"已执行"时, the DPN管理列表 shall 在操作列仅显示"打印"按钮
10. When 用户点击DPN号或订单号时, the DPN管理列表 shall 打开DPN详情页

### Requirement 6: 创建与编辑DPN

**Objective:** As a 到达国运营人员, I want 创建和编辑DPN配送任务, so that 我能将库存中同目的地的运单组合到一个配送批次中

#### Acceptance Criteria

1. The 创建DPN页面 shall 包含以下表单字段：DPN号（自动生成）、创建日期/账号（自动填充）、发往站点（选择）、重量、件数、执行日期（选择）、运输方式（空运/陆运单选）、备注
2. The 创建DPN页面 shall 包含收件人信息：名字、电话、地址
3. The 创建DPN页面 shall 包含物流信息：物流公司（选择）、运单号/订单号（录入）、查询电话（录入）、司机名称、司机电话、车牌
4. When 用户点击"发布"按钮时, the 创建DPN页面 shall 保存DPN任务并返回列表
5. The 编辑DPN页面 shall 加载已有DPN数据并允许修改所有可编辑字段
6. The 编辑DPN页面 shall 额外提供"保存"按钮用于暂存修改（不发布）

### Requirement 7: DPN详情与运单管理

**Objective:** As a 到达国运营人员, I want 查看DPN内的运单明细并管理运单分配, so that 我能确认DPN包含的货物正确无误

#### Acceptance Criteria

1. The DPN详情页面 shall 显示DPN基本信息和运单明细表格，包含列：DPN、JOB/站点、单号、业务员、用户、线路、件数、尺寸CM、体积CBM、体积重KGS、重量KGS
2. The DPN详情页面 shall 按JOB/站点对运单进行分组展示
3. The DPN详情页面 shall 在底部显示汇总行，统计总件数、总体积、总体积重、总重量
4. When 用户点击"提交"按钮时, the DPN详情页面 shall 确认DPN入库（打包完成）
5. When 用户点击"返回"按钮时, the DPN详情页面 shall 返回DPN列表

### Requirement 8: 执行DPN任务（开始配送）

**Objective:** As a 到达国运营人员, I want 执行DPN任务开始配送, so that 货物能从仓库发出送达客户

#### Acceptance Criteria

1. The 执行DPN页面 shall 支持两种添加运单方式：手动添加和扫描添加（checkbox切换）
2. The 执行DPN页面 shall 包含离库日期选择器
3. The 执行DPN页面 shall 以表格展示待配送运单列表，包含列：DPN、JOB/站点、订单号、业务员、收件人、线路、件数、尺寸CM、体积CBM、体积重Kg、重量Kg
4. When 用户选择"手动添加"模式时, the 执行DPN页面 shall 显示手动添加面板，以表格展示可添加的运单，每行带勾选框
5. The 手动添加面板 shall 在底部显示汇总行和"确认"按钮
6. When 用户勾选运单并点击"确认"时, the 手动添加面板 shall 将选中运单添加到配送列表，支持通过"X"按钮移除
7. When 用户点击"执行"按钮时, the 执行DPN页面 shall 更新DPN状态为"配送中"，记录离库日期
8. The 执行DPN页面 shall 在底部显示汇总行，统计总件数、总体积、总体积重、总重量

### Requirement 9: 配送列表

**Objective:** As a 到达国运营人员, I want 查看和管理所有待配送和配送中的运单, so that 我能跟踪配送进度并通知客户

#### Acceptance Criteria

1. The 配送列表 shall 以表格展示所有配送运单，包含列：序号、运单编号（带勾选框）、服务类型、发货人、收货人、电话、详细地址、区/城市、重量kg、件数、支付方式/状态、物流状态、操作、更新日期
2. The 配送列表 shall 支持按国家→城市→站点三级级联筛选
3. The 配送列表 shall 支持通过订单号、JOB号、集装号、快递单号、电话、收发货人名字关键词搜索
4. The 配送列表 shall 支持按服务类型、支付方式、支付状态筛选
5. When 用户勾选多条运单并点击"批量完成通知"按钮时, the 配送列表 shall 批量将选中运单标记为已通知状态
6. When 用户点击单条运单的"通知"按钮时, the 配送列表 shall 将该运单标记为已通知
7. When 用户点击"配送"按钮时, the 配送列表 shall 触发配送操作，更新运单状态
8. While 运单支付状态为"未付"时, when 用户点击"配送"按钮, the 配送列表 shall 弹出提示"尚未支付XXX，是否继续配送？"要求用户确认
9. While 运单未通知收货人时, when 用户点击"配送"按钮, the 配送列表 shall 弹出提示"尚未通知收货人，不能配送"并阻断操作
10. The 配送列表 shall 在配送操作中支持选择配送方式：自提或配送

### Requirement 10: DPN入库确认

**Objective:** As a 到达国仓库操作员, I want 对DPN打包完成的货物进行入库确认, so that 打包好的配送批次正式进入待配送状态

#### Acceptance Criteria

1. The DPN入库页面 shall 支持两种入库方式：手动入库和扫码入库（checkbox切换）
2. The DPN入库页面 shall 以表格展示DPN内的运单列表，按JOB/站点分组，包含列：DPN、JOB/站点、单号、业务员、用户、线路、件数、重量Kg、到达仓库、货物损坏、包装损坏、货物丢失
3. When 用户勾选"到达仓库"checkbox时, the DPN入库页面 shall 将该运单标记为已入库到DPN
4. When 用户勾选"货物损坏"、"包装损坏"或"货物丢失"checkbox时, the DPN入库页面 shall 记录该运单的异常状态
5. The DPN入库页面 shall 在底部显示汇总行，统计总件数和总重量
6. When 用户点击"提交"按钮时, the DPN入库页面 shall 保存入库记录并更新DPN状态
7. When 用户点击"返回"按钮时, the DPN入库页面 shall 返回DPN列表
