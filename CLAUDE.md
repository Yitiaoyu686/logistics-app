# 跨境物流管理系统

## 项目概述

跨境物流管理系统（TMS/ERP），**产品经理需求 Demo 原型**。Web 端 + App 端 UI 均已完成，后端 SQLite + Express API 已搭建，数据联通验证通过。

## 项目结构

```
.
├── server/          # 后端（Express + SQLite）
│   └── src/
│       ├── index.ts              # 入口
│       ├── database/schema.ts    # 34表建表
│       ├── database/seed.ts      # Mock数据
│       ├── middleware/auth.ts    # JWT认证
│       └── routes/               # 7个路由文件
├── app/             # App 端（React Native + Expo 54 + expo-router）
│   ├── app/
│   │   ├── (auth)/login.tsx      # 登录
│   │   ├── (tabs)/               # Tab导航(仓管5Tab/销售4Tab)
│   │   └── task/                 # 22个任务操作页
│   ├── components/               # 共享组件
│   └── lib/                      # api/auth/theme/nav
├── client/          # Web 前端（React + TypeScript + Ant Design）
│   └── src/
│       ├── pages/   # 页面组件（按业务模块组织）
│       ├── types/   # 类型定义
│       ├── api/     # API 层
│       ├── utils/   # 工具函数
│       └── App.tsx  # 主入口、菜单配置、路由
├── miomio/          # 客户提供的原始业务文档
├── docs/            # 项目文档（含任务清单、验证报告）
├── .kiro/
│   ├── specs/       # 需求规格文档（按模块）
│   └── steering/    # 项目引导配置
└── CLAUDE.md        # 本文件
```

## 业务模块

| 模块 | 路径 | 说明 |
|------|------|------|
| CRM | `pages/crm/` | 客户管理（公海池、我的客户） |
| OMS | `pages/oms/` | 订单管理（创建、列表、详情、拆单） |
| WMS 起运国 | `pages/wms/origin/` | 入库、库存、装箱、空运、退运、调拨 |
| TMS | `pages/tms/` | 任务管理、发车、跟踪、成本录入 |
| WMS 到达国 | `pages/wms/destination/` | 入库、DPN派送、签收、库存 |
| 财务 | `pages/finance/` | 费用、审批、应收应付、提成、薪资 |
| 系统管理 | `pages/system/` | 组织、用户、角色、基础设置、消息通知 |
| 经营分析 | `pages/analytics/` | 仪表盘、客户分析、路线利润 |
| 工作台 | `pages/dashboard/` | 待办、预警、通知 |

## 开发命令

```bash
cd server && npm run dev              # 后端 → http://localhost:3001
cd app && npx expo start --web --port 4003  # App Web预览 → http://localhost:4003
cd client && npm run dev              # Web前端 → http://localhost:5173
```

## 当前状态

- **Web 前端**: ✅ 完成，所有页面含 Mock 数据和完整交互
- **后端 API**: ✅ 完成，34表 + 7路由 + JWT认证 + Seed数据
- **App 端**: ✅ 完成，22页 + 3角色 + 数据联通验证通过
- **UI 设计**: ✅ Apple HIG 风格，全部 Ionicons 图标（无 emoji）

## App 设计规范

- 图标库：`@expo/vector-icons/Ionicons`（无 emoji）
- 图标容器：squircle 风格 borderRadius 14
- 设计 Token：`app/lib/theme.ts`（colors/spacing/radius/font/shadow）
- 角色分支：SALES(4Tab) / WAREHOUSE_CN(5Tab) / WAREHOUSE_US(5Tab)

## 需求文档

- 完整需求规格: `.kiro/specs/full-system-requirements/modules/`（00-09 共 10 个模块文档）
- 改动清单: `docs/2026-04-08-需求改动清单.md`
- 客户原始资料: `miomio/`

## Development Guidelines
- 使用中文回复用户
- Follow the user's instructions precisely, and within that scope act autonomously
