# App 搭建任务清单

> 创建日期：2026-04-11
> 需求文档：`.kiro/specs/full-system-requirements/modules/10-App端需求规格-20260410.md`
> 实施计划：`~/.claude/plans/lexical-tinkering-ocean.md`

---

## 整体进度

| 阶段 | 状态 | 说明 |
|------|------|------|
| 阶段一：后端搭建 | ✅ 完成 | 34表数据库 + 7个路由文件 + JWT认证 + Seed数据 |
| 阶段二：App骨架 | ✅ 完成 | Expo项目 + 5Tab导航 + 登录 + 任务流首页 |
| 阶段三：P0页面 | ✅ 完成 | 19页中已完成 19 页（骨架5 + 第一批4 + 第二批4 + 第三批4 + 复用2） |
| 阶段四：数据联通验证 | ⬜ 未开始 | Web↔App数据互通 |

---

## 阶段一：后端（✅ 已完成）

### 数据库 34 表

| 分类 | 表 | 说明 |
|------|---|------|
| 身份权限(3) | sys_user, sys_role, sys_user_role | 9个用户, 9个角色 |
| 基础数据(9) | md_country, md_city, md_site, md_warehouse, md_supplier, md_route, md_logistics_node, md_fee_item, fx_rate | 3国/6城/5站/5仓/11供应商/6线路 |
| CRM(3) | crm_customer, crm_sender_profile, crm_recipient_address | 6客户+5收货地址 |
| OMS(4) | oms_order, oms_sub_order, oms_package_initial, oms_package_actual | 6主单+9子单+9包裹 |
| WMS(5) | wms_inbound_order, wms_inbound_item, wms_stock, wms_unmatched_package, wms_transfer | 3调拨+2无单 |
| TMS(4) | tms_job, tms_shipping_unit, tms_job_order_rel, tms_tracking_event | 10任务+2集装箱 |
| POD(4) | pod_dpn, pod_dpn_item, pod_delivery_task, pod_pickup | 4DPN+2配送+2自提 |
| FIN(2) | fin_fee, fin_payment | — |

### API 路由 7 个文件

| 文件 | 路径前缀 | 接口数 | 状态 |
|------|---------|-------|------|
| auth.ts | /api/auth | 3 | ✅ |
| system.ts | /api/system, /api | ~25 | ✅ |
| customers.ts | /api/v2/oms/customers, /api/clients | 7 | ✅ |
| orders.ts | /api/v2/oms/orders | 5 | ✅ |
| warehouse.ts | /api/v2/wms, /api/warehouse | 14 | ✅ |
| jobs.ts | /api/jobs, /api/v2/tms | 6 | ✅ |
| delivery.ts | /api/v2/pod, /api/delivery | 12 | ✅ |

### 演示账号

| 账号 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | ADMIN（仅Web） |
| sales1 | 123456 | SALES |
| warehouse_cn1 | 123456 | WAREHOUSE_CN |
| warehouse_us1 | 123456 | WAREHOUSE_US |
| ops_cn1 | 123456 | OPS_CN |
| ops_us1 | 123456 | OPS_US |
| finance1 | 123456 | FINANCE |
| boss1 | 123456 | BOSS |
| driver1 | 123456 | DRIVER |

### 启动命令

```bash
cd server && npm run dev    # 后端 → http://localhost:3001
```

---

## 阶段二：App 骨架（✅ 已完成）

### 已完成页面

| 页面 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 根布局 | app/_layout.tsx | ✅ | 认证路由守卫 |
| 入口重定向 | app/index.tsx | ✅ | → 登录页 |
| 登录 | app/(auth)/login.tsx | ✅ | 用户名密码 + 3个快捷按钮 |
| Tab导航 | app/(tabs)/_layout.tsx | ✅ | 5Tab + 中央扫码凸起按钮，按角色切换图标标签 |
| 任务流 | app/(tabs)/tasks.tsx | ✅ | 核心页面，按角色加载不同任务卡片，从后端API实时读取 |
| 查询 | app/(tabs)/search.tsx | ✅ | 搜索栏 + 6个功能入口网格（占位） |
| 扫码 | app/(tabs)/scan.tsx | ✅ | 相机占位 + 扫描框 + 手动输入 |
| 消息 | app/(tabs)/messages.tsx | ✅ | Mock通知列表 |
| 个人中心 | app/(tabs)/profile.tsx | ✅ | 头像/角色/菜单/退出登录 |

### 共享代码

| 文件 | 说明 |
|------|------|
| lib/api.ts | API客户端（web用localhost，native用局域网IP） |
| lib/auth.ts | 认证状态 + 角色工具函数 |
| lib/theme.ts | 设计Token（颜色/间距/圆角/字体） |

### 启动命令

```bash
cd app && npx expo start --web --port 4003    # Web预览 → http://localhost:4003
```

### 已验证

- ✅ sales1 登录 → 看到 2条未完成订单 + 5条运输进度
- ✅ warehouse_cn1 登录 → 看到 2待入库 + 3待装箱 + 3调拨 + 2无单 + 运营预告
- ⬜ warehouse_us1 登录 → 待验证

---

## 阶段三：P0 页面（🔵 进行中，19页）

### 起运国仓管（4页）

| # | 页面 | 文件路径 | 状态 | 说明 |
|---|------|---------|------|------|
| 1 | 任务流首页 | app/(tabs)/tasks.tsx | ✅ 已完成 | 任务卡片列表+运营预告+筛选Tab+快捷入口 |
| 2 | 扫码入库操作 | app/task/inbound.tsx | ✅ 已完成 | 扫码→称重量方→生成子运单→打印面单→上架 |
| 3 | 库存列表+详情 | app/task/stock.tsx | ✅ 已完成 | 搜索/扫码+筛选+详情底抽+补打面单+改库位 |
| 4 | 装箱/执行出库 | app/task/packing.tsx | ✅ 已完成 | 添加订单+绑定任务+执行出库(拖车/司机表单) |

### 到达国仓管（5页）

| # | 页面 | 文件路径 | 状态 | 说明 |
|---|------|---------|------|------|
| 5 | 任务流首页 | app/(tabs)/tasks.tsx | ✅ 已完成 | 同文件，按角色分支+US快捷入口 |
| 6 | 任务入库 | app/task/dest-inbound.tsx | ✅ 已完成 | 扫码核对+逐条标记(到货/少件/破损)+进度条+拍照+提交 |
| 7 | DPN管理 | app/task/dpn.tsx | ✅ 已完成 | 4模式切换(绑运单/发车/到达/入库)+按状态自动初始化 |
| 8 | 配送签收/失败 | app/task/delivery.tsx | ✅ 已完成 | 签收(拍照+COD)+失败(原因+拍照)+转自提 |
| 9 | 自提管理 | app/task/pickup.tsx | ✅ 已完成 | 通知(短信)+核销(验提货码+COD) |

### 销售（5页）

| # | 页面 | 文件路径 | 状态 | 说明 |
|---|------|---------|------|------|
| 10 | 待办首页 | app/(tabs)/tasks.tsx | ✅ 已完成 | 同文件，按角色分支+SALES快捷入口 |
| 11 | 客户列表+详情 | app/task/customer.tsx | ✅ 已完成 | 搜索+列表+详情底抽(联系人/地址/快速操作) |
| 12 | 订单列表+详情 | app/task/order.tsx | ✅ 已完成 | 筛选Tab+列表+详情底抽(7段物流时间线+子单+包裹+费用) |
| 13 | 运费试算 | app/task/quote.tsx | ✅ 已完成 | 路线选择+体积计费+演示报价+复制+分享 |

### 通用（5页）

| # | 页面 | 文件路径 | 状态 | 说明 |
|---|------|---------|------|------|
| 14 | 登录 | app/(auth)/login.tsx | ✅ 已完成 | — |
| 15 | 扫码页 | app/(tabs)/scan.tsx | ✅ 已完成 | expo-camera条码扫描+万能识别(JOB/DPN/运单/库位)+手动输入+最近扫描 |
| 16 | 消息中心 | app/(tabs)/messages.tsx | ✅ 已完成 | 后端动态消息+角色过滤+4Tab+已读状态+点击跳转目标页 |
| 17 | 个人中心 | app/(tabs)/profile.tsx | ✅ 已完成 | — |
| 18 | 库存查询(仓管US) | (复用#3) | ✅ 复用 | 复用 stock.tsx，多仓筛选 |
| 19 | 订单查询(只读) | (复用#12) | ✅ 复用 | 复用 order.tsx |

### 开发优先级

```
第一批（核心操作）：✅ 完成
  #2 扫码入库 → #4 装箱/执行出库 → #8 配送签收 → #9 自提

第二批（查询详情）：✅ 完成
  #3 库存列表 → #11 客户列表 → #12 订单详情 → #13 运费试算
  + tasks.tsx SALES/WAREHOUSE_CN 快捷入口
  + seed.ts 补充 wms_stock 8条数据

第三批（补全）：✅ 完成
  #6 任务入库(dest-inbound) → #7 DPN管理 → #15 扫码万能识别 → #16 消息中心
  + WAREHOUSE_US 快捷入口
  + 后端 /api/system/notifications 动态消息生成
```

阶段三共 19 页全部完成。下一步：阶段四 数据联通验证。

---

## 阶段四：数据联通验证（⬜ 未开始）

| 场景 | 操作方 | 预期结果 |
|------|--------|---------|
| Web建单→App看到 | Web创建订单 | App仓管CN任务流出现"待入库"卡片 |
| App入库→Web更新 | App扫码入库 | Web库存列表出现新入库记录 |
| Web创建JOB→App预告 | Web起运国办创建任务 | App仓管CN看到"即将发运"预告卡片 |
| App签收→Web状态 | App到达国配送签收 | Web订单状态变更为已签收 |
| App运费试算 | App销售查询运费 | 返回正确计算结果 |

---

## 已知问题

| 问题 | 影响 | 解决方案 |
|------|------|---------|
| 登录后跳转：web端用 `window.location.href` 而非 `router.replace` | 仅web预览 | 后续优化Expo Router web兼容 |
| Web端(5173)连新后端(3001)部分API返回500 | 仅Web，不影响App | 需补全Web端调用的特殊接口（如v2路由兼容） |
| 后端无错误处理中间件 | 500错误无详情 | 后续添加 errorHandler 中间件 |
| 扫码页仅占位 | 无法真实扫码 | 需接入 expo-camera barcode scanning |

---

## 文件结构

```
111/
├── server/                         # 后端 (阶段一 ✅)
│   ├── src/
│   │   ├── index.ts                # Express 入口
│   │   ├── database/schema.ts      # 34表建表
│   │   ├── database/seed.ts        # Mock数据
│   │   ├── middleware/auth.ts      # JWT认证
│   │   ├── routes/auth.ts          # 登录/用户
│   │   ├── routes/system.ts        # 系统管理(仓库/国家/线路/角色/汇率等)
│   │   ├── routes/customers.ts     # 客户CRUD
│   │   ├── routes/orders.ts        # 订单CRUD
│   │   ├── routes/warehouse.ts     # 入库/库存/装箱/调拨/无单
│   │   ├── routes/jobs.ts          # JOB任务/跟踪事件
│   │   ├── routes/delivery.ts      # DPN/配送/自提
│   │   └── utils/idGenerator.ts    # 编号生成
│   ├── logistics.db                # SQLite数据库
│   └── package.json
│
├── app/                            # React Native App (阶段二 ✅ + 阶段三 🔵)
│   ├── app/
│   │   ├── _layout.tsx             # 根布局
│   │   ├── index.tsx               # 入口重定向
│   │   ├── (auth)/login.tsx        # 登录页
│   │   ├── (tabs)/_layout.tsx      # 5Tab导航
│   │   ├── (tabs)/tasks.tsx        # ★ 任务流首页（核心）
│   │   ├── (tabs)/search.tsx       # 查询
│   │   ├── (tabs)/scan.tsx         # 扫码占位
│   │   ├── (tabs)/messages.tsx     # 消息
│   │   ├── (tabs)/profile.tsx      # 个人中心
│   │   └── task/                   # ⬜ 待开发：各任务操作页
│   ├── lib/api.ts                  # API客户端
│   ├── lib/auth.ts                 # 认证
│   ├── lib/theme.ts                # 设计Token
│   └── package.json
│
├── client/                         # Web前端（已有）
├── .kiro/specs/                    # 需求文档
├── docs/                           # 项目文档
└── CLAUDE.md
```
