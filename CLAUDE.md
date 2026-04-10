# 跨境物流管理系统

## 项目概述

跨境物流管理系统（TMS/ERP），当前阶段为**产品经理需求 Demo 原型**。Web 端 UI 已完成，所有数据为本地 Mock。下一步：梳理 App 端需求 → 统一设计数据库 → 搭建后端 API → 开发 App。

## 项目结构

```
.
├── client/          # Web 前端（React + TypeScript + Ant Design）
│   └── src/
│       ├── pages/   # 页面组件（按业务模块组织）
│       ├── types/   # 类型定义
│       ├── api/     # API 层（当前连接后端，待重建）
│       ├── utils/   # 工具函数
│       └── App.tsx  # 主入口、菜单配置、路由
├── miomio/          # 客户提供的原始业务文档
├── docs/            # 项目文档
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
cd client
npm install          # 安装依赖
npm run dev          # 启动开发服务器（http://localhost:5173）
npm run build        # 生产构建
```

## 当前状态

- **Web 前端**: ✅ 完成，所有页面含 Mock 数据和完整交互
- **后端 API**: ❌ 已删除（旧数据错乱），待重建
- **数据库**: ❌ 待设计（等 App 需求梳理完后统一建库）
- **App 端**: ❌ 待梳理需求

## 需求文档

- 完整需求规格: `.kiro/specs/full-system-requirements/modules/`（00-09 共 10 个模块文档）
- 改动清单: `docs/2026-04-08-需求改动清单.md`
- 客户原始资料: `miomio/`

## Development Guidelines
- 使用中文回复用户
- Follow the user's instructions precisely, and within that scope act autonomously
