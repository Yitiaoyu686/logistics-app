# WAREHOUSE_CN (起运国仓管) E2E 测试报告

测试时间: 2026-05-18
测试角色: warehouse_cn1 / 起运国仓管
测试环境: http://localhost:5173 (海运默认域, 空运侧验证)
截图目录: /Users/mac/Documents/code/111/docs/comparison-screenshots/web-warehouse-cn/

---

## 总结

- 测试覆盖页数: 11个页面 (工作台 + 订单列表 + 起运国仓储9个子页)
- 截图总数: 29张
- 所有页面均可正常加载并展示数据
- 共发现 4 个待关注项 (详见下文)

---

## 逐页检测报告

### 1. 工作台 (Dashboard)
- 数据加载: ✅ WorkbenchOverview 组件正常渲染
- 卡片布局展示: 待办事项、预警通知等统计卡片
- 截图: web-warehouse-cn--01-dashboard.png, web-warehouse-cn--01-dashboard-final.png

### 2. 订单列表 (订单中心)
- 数据行数: 10行
- 启用的操作按钮: `查询` `重置` `高级筛选` `新建订单` `详情` `编辑` `取消订单` `暂停`
- 禁用的操作按钮: (无)
- 新建订单: ✅ 已成功打开表单截屏 (web-warehouse-cn--02-订单列表-new-order.png)
- 截图: web-warehouse-cn--02-订单列表.png

### 3. 起运国仓储 > 快递入库
- 数据行数: 20行
- 启用的操作按钮: `查询` `重置` `添加三方快递`
- **禁用的操作按钮**: `完成入库` (需要选中记录后启用)
- 补充操作: ✅ 成功打开补充 Drawer
- 添加三方快递 Modal: ✅ 成功打开并截屏
- ⚠️ 行点击无详情 Drawer (InboundList 页面无 row-onClick 绑定，需要通过操作列按钮)
- 截图: web-warehouse-cn--03a-快递入库.png, web-warehouse-cn--03a-快递入库-add-waybill-modal.png

### 4. 起运国仓储 > 调拨入库
- 数据行数: 1行
- 启用的操作按钮: `查询` `重置` `入库` `清单`
- **禁用的操作按钮**: (无)
- 清单 Drawer: ✅ 成功打开 (web-warehouse-cn--03b-调拨入库-bill-drawer.png)
- 截图: web-warehouse-cn--03b-调拨入库.png

### 5. 起运国仓储 > 退回入库
- 数据行数: 2行
- 启用的操作按钮: `查询` `重置` `入库` `清单`
- **禁用的操作按钮**: (无)
- 清单 Drawer: ✅ 成功打开 (web-warehouse-cn--03c-退回入库-bill-drawer.png)
- 截图: web-warehouse-cn--03c-退回入库.png

### 6. 起运国仓储 > 库存列表
- 数据行数: 20行
- 启用的操作按钮: `查询` `重置` `刷新` `编辑` `打印` `退运`
- **禁用的操作按钮**: (无)
- 每行操作列按钮: `编辑` (打开 InboundDetailDrawer 编辑模式), `打印` (开发中, 仅 toast 提示), `退运` (打开退运 Modal)
- 退运 Modal: ✅ 成功打开并截屏 (web-warehouse-cn--03d-库存列表-return-modal.png)
- ⚠️ 库存列表无独立"详情"按钮，"编辑"按钮承担查看/编辑功能
- ⚠️ "打印"按钮无实际功能 (仅 toast: "打印功能开发中")
- 截图: web-warehouse-cn--03d-库存列表.png

### 7. 起运国仓储 > 无订单快递
- 数据行数: 3行
- 启用的操作按钮: `查询` `重置` `新增无订单快递` `详情` `编辑` `匹配` `创单` `通知` `退回` `删除`
- **禁用的操作按钮**: (无)
- 新增表单: ✅ 成功打开 Modal
  - 表单字段: `快递公司` `快递单号` `寄件人` `寄件人电话` `发往国家` `件数` `重量Kg` `体积CBM` `类别` `说明/品名` `仓位` `备注` (共12个字段)
- 详情 Drawer: ✅ 成功打开
- 截图: web-warehouse-cn--03e-无订单快递.png, web-warehouse-cn--03e-无订单快递-create-modal.png, web-warehouse-cn--03e-无订单快递-detail-drawer.png

### 8. 起运国仓储 > 任务执行(海运)
- 数据行数: 3行
- 页级启用的操作按钮: `查询` `重置` `刷新` `创建线路`
- 每行操作列按钮 (SEA模式):
  - `绑定任务` (无任务时显示, 离境后禁用)
  - `添加订单` (无集装号或全部已离境时 **禁用**)
  - `详情`
  - `执行出库` (有任务时显示, 无集装号或已离境时禁用)
- **禁用的操作按钮**: `添加订单` (工具栏和行内均显示禁用状态, 原因是该行没有集装号)
- 创建线路 Modal: ✅ 成功打开
  - 表单字段: `线路` `集装箱号` `服务类型` `货物类型` `站点` `创建人`
- 详情 Drawer: ✅ 成功打开
- 执行出库 Modal: ✅ 成功打开
- ⚠️ SEA模式下无"集装号"按钮 (该按钮仅在 AIR 模式出现, 代码: `{!isSea && <Button>集装号</Button>}`)
- 截图: web-warehouse-cn--03f-任务执行-海运.png, web-warehouse-cn--03f-任务执行-海运-create-route-modal.png, web-warehouse-cn--03f-任务执行-海运-detail-drawer.png, web-warehouse-cn--03f-任务执行-海运-execute-modal.png

### 9. 起运国仓储 > 任务执行(空运)
- 数据行数: 3行
- 页级启用的操作按钮: `查询` `重置` `刷新` `创建线路`
- 每行操作列按钮 (AIR模式):
  - `集装号` ✅ (AIR模式特有)
  - `绑定任务` (无任务时)
  - `添加订单` (无集装号时 **禁用**)
  - `详情`
- **禁用的操作按钮**: `添加订单` (工具栏禁用状态)
- 详情 Drawer: ✅ 成功打开
- 集装号 Drawer: ✅ 成功打开
  - Drawer 内按钮: `批量打印` `新增集装号` `删除` `保存`
- 截图: web-warehouse-cn--03g-任务执行-空运.png, web-warehouse-cn--03g-任务执行-空运-detail-drawer.png, web-warehouse-cn--03g-任务执行-空运-unit-drawer.png

### 10. 起运国仓储 > 调拨管理
- 数据行数: 3行
- 启用的操作按钮: `查询` `重置` `创建调拨单`
- 每行操作列按钮: `详情` `绑定运单` `执行` `打印` `确认到达` `确认入库`
- **禁用的操作按钮**: (无)
- 创建调拨单 Modal: ✅ 成功打开
  - 表单字段: `源仓库` `目标仓库` `线路名称` `计划执行日期` `运输方式` `装箱号` `调拨原因` `备注` (共8个字段)
- 详情 Drawer: ✅ 成功打开
- 绑定运单 Drawer: ✅ 成功打开
- 截图: web-warehouse-cn--03h-调拨管理.png, web-warehouse-cn--03h-调拨管理-create-modal.png, web-warehouse-cn--03h-调拨管理-detail-drawer.png, web-warehouse-cn--03h-调拨管理-bind-drawer.png

### 11. 起运国仓储 > 退运处理
- 数据行数: 8行
- 启用的操作按钮: `重置` `新建退运`
- 每行操作按钮 (按状态动态显示):
  - PENDING_APPROVAL 状态: `通过` `驳回` `详情`
  - APPROVED (有订单退运): `费用结算` `详情`
  - APPROVED (无订单退运): `执行退运` `详情`
  - SETTLING + 待补缴: `确认补缴`
  - SETTLED: `执行退运` `详情`
  - EXECUTING: `完成` `详情`
- **禁用的操作按钮**: (无)
- 新建退运 Modal: ✅ 成功打开 (第一轮测试)
  - 表单字段: `主运单号` `子运单号` `客户名称` `退运类型` `货物处置方式` `件数` `重量(kg)` `线路` `退运原因` (共9个字段)
- 详情 Drawer: ✅ 成功打开
  - 包含费用明细、退款/补缴信息
- 费用结算 Drawer: ⚠️ 第一行无费用结算按钮 (需要 APPROVED 状态且为非无订单退运)
- 截图: web-warehouse-cn--03i-退运处理.png, web-warehouse-cn--03i-退运处理-新建表单.png, web-warehouse-cn--03i-退运处理-detail-drawer.png

---

## 关键发现与待关注项

### 需要关注的问题 (4项)

1. **库存列表 "打印" 按钮无功能** (低优)
   - 位置: 起运国仓储 > 库存列表 > 行操作 > 打印
   - 现状: 点击仅 toast 提示 "打印功能开发中"
   - 影响: 用户点击无实际效果

2. **任务执行 - "添加订单" 按钮在无集装号时禁用** (中优 - 设计确认)
   - 位置: 任务执行(海运/空运) > 行操作 > 添加订单
   - 原因: 代码逻辑 `disabled={row.units.length === 0}` 
   - 是否合理: 语义上合理 (先创建集装号再添加订单)，但用户可能困惑为何按钮置灰
   - 建议: 添加 tooltip 提示 "请先创建集装号"

3. **SEA 模式 vs AIR 模式按钮差异** (中优 - 一致性)
   - SEA 模式下行操作无 "集装号" 按钮，AIR 模式有 "集装号" 按钮
   - 代码: ContainerMgt.tsx line 1325 `{!isSea && <Button>集装号</Button>}`
   - SEA 模式通过创建线路 Modal 管理，交互路径不同
   - 这可能是有意设计，但建议确认两侧功能对等

4. **库存列表缺少独立"详情"按钮** (低优)
   - "编辑"按钮承载了查看详情的功能
   - 与其他页面 (订单列表、调拨管理等) 有独立"详情"按钮的交互模式不一致

### 正常行为 (无需处理)

- `完成入库` 在快递入库页面禁用 -- 需选中记录后启用
- 退运处理行按钮根据状态动态显示 -- 符合业务流程设计
- 任务执行(海运/空运)的 `添加订单` 工具栏按钮禁用 -- 需先选中行
- 调拨入库/退回入库数据量少 (1-2行) -- 正常 Demo 数据

---

## 截图清单 (29张)

| # | 文件名 | 内容 |
|---|--------|------|
| 1 | web-warehouse-cn--01-dashboard.png | 工作台首页 |
| 2 | web-warehouse-cn--01-dashboard-final.png | 工作台首页(最终) |
| 3 | web-warehouse-cn--02-订单列表.png | 订单列表 |
| 4 | web-warehouse-cn--02-订单列表-new-order.png | 新建订单 |
| 5 | web-warehouse-cn--03a-快递入库.png | 快递入库列表 |
| 6 | web-warehouse-cn--03a-快递入库-add-waybill-modal.png | 添加快递运单 Modal |
| 7 | web-warehouse-cn--03b-调拨入库.png | 调拨入库列表 |
| 8 | web-warehouse-cn--03b-调拨入库-bill-drawer.png | 调拨入库清单 Drawer |
| 9 | web-warehouse-cn--03c-退回入库.png | 退回入库列表 |
| 10 | web-warehouse-cn--03c-退回入库-bill-drawer.png | 退回入库清单 Drawer |
| 11 | web-warehouse-cn--03d-库存列表.png | 库存列表 |
| 12 | web-warehouse-cn--03d-库存列表-return-modal.png | 库存退运 Modal |
| 13 | web-warehouse-cn--03e-无订单快递.png | 无订单快递列表 |
| 14 | web-warehouse-cn--03e-无订单快递-create-modal.png | 新增无订单快递 Modal |
| 15 | web-warehouse-cn--03e-无订单快递-detail-drawer.png | 无订单快递详情 Drawer |
| 16 | web-warehouse-cn--03f-任务执行-海运.png | 任务执行(海运) |
| 17 | web-warehouse-cn--03f-任务执行-海运-create-route-modal.png | 创建线路 Modal |
| 18 | web-warehouse-cn--03f-任务执行-海运-detail-drawer.png | 线路详情 Drawer |
| 19 | web-warehouse-cn--03f-任务执行-海运-execute-modal.png | 执行出库 Modal |
| 20 | web-warehouse-cn--03g-任务执行-空运.png | 任务执行(空运) |
| 21 | web-warehouse-cn--03g-任务执行-空运-detail-drawer.png | 空运线路详情 Drawer |
| 22 | web-warehouse-cn--03g-任务执行-空运-unit-drawer.png | 空运集装号管理 Drawer |
| 23 | web-warehouse-cn--03h-调拨管理.png | 调拨管理列表 |
| 24 | web-warehouse-cn--03h-调拨管理-create-modal.png | 创建调拨单 Modal |
| 25 | web-warehouse-cn--03h-调拨管理-detail-drawer.png | 调拨详情 Drawer |
| 26 | web-warehouse-cn--03h-调拨管理-bind-drawer.png | 绑定运单 Drawer |
| 27 | web-warehouse-cn--03i-退运处理.png | 退运处理列表 |
| 28 | web-warehouse-cn--03i-退运处理-新建表单.png | 新建退运 Modal |
| 29 | web-warehouse-cn--03i-退运处理-detail-drawer.png | 退运详情 Drawer |

所有截图路径: /Users/mac/Documents/code/111/docs/comparison-screenshots/web-warehouse-cn/
