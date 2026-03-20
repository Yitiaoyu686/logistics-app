# 若依风格 Demo 菜单与权限蓝图

日期：2026-03-12  
适用范围：`/Users/mac/Documents/code/111` 原型 Demo 项目（React + Express + SQLite）

## 1. 定位与实施口径

本方案采用“若依架构思想”，不强制迁移到若依 Java 技术栈，保持你当前 Demo 架构：

- 前端：React + Ant Design（若依式布局）
- 后端：Express + SQLite
- 权限：菜单权限 + 按钮权限 + 数据权限（简化版）

目标是：在最小改造成本下，快速得到“像若依”的后台管理体验，并确保海运/空运流程隔离。

## 2. 总体信息架构（若依式）

### 2.1 一级导航（顶部）

1. 工作台
2. 海运（SEA）
3. 空运（AIR）
4. 全业务（ALL）
5. 系统管理

说明：

- `ALL` 仅用于财务和经营分析，不提供一线业务创建/编辑。
- 海运与空运入口独立，进入后上下文固定，不再在页面内切换海空。

### 2.2 二三级导航（左侧）

海运（SEA）与空运（AIR）采用同构菜单骨架：

1. 客户中心
2. 订单中心
3. 起运国仓
4. 起运国办
5. 到达国办
6. 到达国仓
7. 业务报表

全业务（ALL）：

1. 财务中心
2. 审核中心
3. 经营分析

系统管理：

1. 主数据
2. 组织权限
3. 内容增长

## 3. 菜单 Key 规范（建议）

统一格式：`{line}:{domain}:{module}:{page}`  
其中 `line` 取值：`sea` / `air` / `all` / `sys` / `wk`

示例：

- `sea:oms:order:list`
- `air:wms:origin:inbound`
- `all:finance:receivable:list`
- `sys:mdm:rate:general`
- `wk:dashboard:overview`

## 4. 路由规划（建议）

### 4.1 业务线分根

- `/sea/**`
- `/air/**`
- `/all/**`
- `/sys/**`
- `/wk/**`

### 4.2 典型路由

- `/sea/oms/order/list`
- `/sea/oms/order/create`
- `/sea/tms/origin/export-tracking`
- `/air/wms/origin/inbound`
- `/all/finance/receivable`
- `/all/audit/cost-pol`
- `/sys/mdm/country-site`

## 5. 菜单清单（可直接用于配置）

### 5.1 工作台

1. `wk:dashboard:overview`（工作概览）
2. `wk:dashboard:todo`（待办事项）
3. `wk:dashboard:alert`（预警中心）

### 5.2 海运（SEA）

#### 客户中心

1. `sea:crm:public:list`（公海池）
2. `sea:crm:private:list`（我的客户）
3. `sea:crm:customer:detail`（客户详情）

#### 订单中心

1. `sea:oms:order:list`（订单列表）
2. `sea:oms:order:create`（创建订单）
3. `sea:oms:order:detail`（订单详情）
4. `sea:oms:price:query`（运价查询）

#### 起运国仓

1. `sea:wms:origin:inbound`（货物入库）
2. `sea:wms:origin:stock`（库存列表）
3. `sea:wms:origin:noorder`（未知快递）
4. `sea:wms:origin:return`（退运管理）
5. `sea:wms:origin:unit`（运输单元）
6. `sea:wms:origin:transfer`（调拨管理）

#### 起运国办

1. `sea:tms:origin:job`（任务管理）
2. `sea:tms:origin:export`（出口跟踪）
3. `sea:tms:origin:cost-pol`（JOB成本录入）
4. `sea:tms:origin:recv-pol`（应收管理）
5. `sea:tms:origin:order-fee`（订单费用）

#### 到达国办

1. `sea:tms:dest:import`（进口跟踪）
2. `sea:tms:dest:dpn-create`（创建DPN）
3. `sea:tms:dest:notify`（通知客户）
4. `sea:tms:dest:cost-pod`（JOB成本录入）
5. `sea:tms:dest:dpn-cost`（DPN成本）
6. `sea:tms:dest:recv-pod`（应收管理）

#### 到达国仓

1. `sea:wms:dest:arrival-inbound`（到港入库）
2. `sea:wms:dest:dpn-inbound`（DPN入库）
3. `sea:wms:dest:stock`（库存列表）
4. `sea:wms:dest:dpn-exec`（执行DPN）
5. `sea:wms:dest:delivery`（配送列表）

#### 业务报表

1. `sea:report:profit`（利润分析）
2. `sea:report:timeliness`（时效分析）
3. `sea:report:cost`（成本结构）

### 5.3 空运（AIR）

与 SEA 同构，仅将 key 前缀改为 `air:*`，例如：

- `air:oms:order:list`
- `air:wms:origin:inbound`
- `air:tms:origin:export`
- `air:tms:dest:dpn-create`
- `air:report:profit`

### 5.4 全业务（ALL）

#### 财务中心

1. `all:finance:payable:list`
2. `all:finance:receivable:list`
3. `all:finance:cashflow`
4. `all:finance:profit-dashboard`

#### 审核中心

1. `all:audit:receivable`
2. `all:audit:cost-pol`
3. `all:audit:cost-pod`
4. `all:audit:dpn-cost`
5. `all:audit:petty-cash`
6. `all:audit:compensation`
7. `all:audit:procurement`

#### 经营分析

1. `all:analytics:executive`
2. `all:analytics:customer-value`
3. `all:analytics:route-profit`
4. `all:analytics:transit`
5. `all:analytics:cost-structure`

### 5.5 系统管理（SYS）

#### 主数据

1. `sys:mdm:price:general`（通用运价）
2. `sys:mdm:price:category`（类别运价）
3. `sys:mdm:country-site`（国家站点）
4. `sys:mdm:supplier`（供应商）
5. `sys:mdm:logistics-node`（物流节点）
6. `sys:mdm:fee-item`（费用项目）
7. `sys:mdm:fx-rate`（汇率管理）

#### 组织权限

1. `sys:org:employee`（员工管理）
2. `sys:org:department`（部门岗位）
3. `sys:org:attendance`（考勤）
4. `sys:org:salary`（工资）
5. `sys:auth:user`（账户管理）
6. `sys:auth:role`（角色管理）
7. `sys:auth:perm-template`（模板管理）
8. `sys:auth:perm-matrix`（权限矩阵）

#### 内容增长

1. `sys:content:guide`（服务指南）
2. `sys:content:franchise`（加盟合作）
3. `sys:content:promotion`（推广管理）
4. `sys:content:work-report`（工作报告）
5. `sys:content:procurement`（采购管理）

## 6. 权限码设计（若依风格）

### 6.1 菜单权限

直接使用菜单 key 作为菜单权限码。

### 6.2 按钮权限

格式：`{line}:{domain}:{module}:{action}`

常用动作：

- `list`、`query`、`add`、`edit`、`delete`
- `audit`、`approve`、`reject`
- `import`、`export`、`print`
- `execute`、`bind`、`unbind`、`confirm`

示例：

- `sea:oms:order:add`
- `air:wms:origin:inbound:confirm`
- `all:audit:cost-pol:approve`
- `sys:auth:user:edit`

### 6.3 数据权限（Demo 简化版）

建议三层：

1. 业务线：SEA / AIR / ALL
2. 区域：起运国 / 到达国
3. 站点/仓库：按用户绑定仓库过滤

## 7. 角色与菜单可见性矩阵（建议）

### 7.1 角色

1. `ADMIN`（系统管理员）
2. `SALES`（销售）
3. `WAREHOUSE_CN`（起运仓）
4. `OPS_CN`（起运操作）
5. `OPS_US`（到达操作）
6. `WAREHOUSE_US`（到达仓）
7. `FINANCE`（财务）
8. `BOSS`（老板）

### 7.2 可见范围（摘要）

1. 销售：`sea/air` 下 CRM + OMS + 部分报表。
2. 起运仓：`sea/air` 下起运国仓模块。
3. 起运操作：`sea/air` 下起运国办 + 协同仓模块。
4. 到达操作：`sea/air` 下到达国办 + 协同仓模块。
5. 到达仓：`sea/air` 下到达国仓模块。
6. 财务：`all` 财务中心 + 审核中心。
7. 老板：`all` 财务 + 审核 + 经营分析。
8. 管理员：全部菜单。

## 8. 页面布局标准（若依式）

1. 顶部：一级导航 + 用户区 + 消息区。
2. 左侧：当前一级下二三级菜单。
3. 中上：面包屑 + 页面标题 + 主按钮。
4. 中部：筛选区 + 统计卡。
5. 下部：表格/表单主区 + 抽屉详情。
6. 标签页：启用 `TagsView` 风格（卡片页签）。

## 9. Demo 实施顺序（最小可用）

1. 先改壳层：一级导航分为 SEA/AIR/ALL/SYS。
2. 再改菜单：把“已有页面但不可达”的 key 全接出来。
3. 再改权限：先做菜单可见，后补按钮权限。
4. 最后做数据权限：按仓库和业务线过滤。

## 10. 你这个项目的落地建议

基于当前代码，先不做大迁移，按以下路径推进：

1. 保留现有 `App.tsx` 架构，先完成菜单 key 重排。
2. 新增“业务线路由上下文”层，替换全局 `ALL/AIR/SEA` 顶部切换逻辑。
3. 将 `oms_order_create` 从 `ComingSoon` 改成真实页面入口。
4. 将起运国办中已实现但隐藏的页面全部接入菜单。
5. 第二阶段再考虑引入真正的 React Router 分根（`/sea/*` `/air/*`）。

