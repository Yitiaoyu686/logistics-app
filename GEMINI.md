# 项目背景：跨境物流管理系统 (TMS)

## 项目概览
本项目是一个全栈 Web 应用程序，专为 **跨境物流管理 (TMS/ERP)** 设计。它支持多种用户角色（销售、仓库、操作、财务、管理员），并管理国际运输订单的整个生命周期，从客户获取 (CRM) 到订单处理 (OMS)、运输 (TMS) 和仓储 (WMS)。

## 技术栈

### 客户端 (`/client`)
*   **框架:** React 19 (via Vite)
*   **语言:** TypeScript
*   **UI 库:** Ant Design (antd)
*   **路由:** React Router DOM
*   **状态/数据:** React Hooks (useState, useMemo), Axios (用于 API 请求), Day.js (日期处理)
*   **构建工具:** Vite

### 服务端 (`/server`)
*   **运行时:** Node.js
*   **框架:** Express.js
*   **语言:** TypeScript
*   **开发工具:** Nodemon (用于热重载)
*   **数据存储:** 内存中 (当前为模拟数据)

## 目录结构
```
/
├── client/                 # 前端应用
│   ├── src/
│   │   ├── components/     # 可复用 UI 组件
│   │   ├── data/           # 模拟数据
│   │   ├── pages/          # 功能模块 (CRM, OMS, TMS 等)
│   │   ├── types/          # 共享 TypeScript 接口 (core.ts)
│   │   └── App.tsx         # 主入口、布局和路由逻辑
│   ├── package.json
│   └── vite.config.ts
├── server/                 # 后端 API
│   ├── src/
│   │   └── index.ts        # 服务端入口点 & API 路由
│   └── package.json
└── package-lock.json       # 根依赖锁文件
```

## 安装与运行

### 客户端
1.  进入客户端目录：`cd client`
2.  安装依赖：`npm install`
3.  启动开发服务器：`npm run dev`
    *   应用访问地址：`http://localhost:5173` (默认 Vite 端口)

### 服务端
1.  进入服务端目录：`cd server`
2.  安装依赖：`npm install`
3.  启动开发服务器：`npm run dev`
    *   服务器运行地址：`http://localhost:3000`

## 关键模块与功能

应用程序分为几个核心模块，可通过侧边栏菜单访问。可见性由 `UserRole`（例如 ADMIN, SALES, WAREHOUSE_CN）控制。

1.  **工作台 (Dashboard)**: 基于角色的着陆页，包含统计数据和任务。
2.  **CRM (客户关系管理)**:
    *   **公海池**: 未分配的客户。
    *   **我的客户**: 销售专属客户列表。
    *   **工具**: 价格计算器、推广素材。
3.  **OMS (订单管理系统)**:
    *   **订单列表**: 查看并按状态筛选订单（已创建、已入库、运输中等）。
    *   **订单详情**: 特定订单的详细视图。
    *   **创建订单**: 创建新订单的表单。
4.  **WMS (仓储管理系统)**:
    *   **入库**: 管理入库包裹。
    *   **库存**: 库存跟踪。
5.  **TMS (运输管理系统)**:
    *   **任务管理**: 管理货运任务（空运/海运/卡车）。
    *   **跟踪**: 更新运输状态/轨迹。
6.  **财务 (Finance)**:
    *   **应收账款 (AR)**: 管理应收款项。
    *   **费用审批**: 管理层审批费用。

## 开发规范

*   **TypeScript**: 鼓励使用严格类型。共享类型位于 `client/src/types/core.ts`。
*   **UI 组件**: 为了保持一致性，请使用 **Ant Design** 组件。
*   **样式**: 目前使用内联样式和 Ant Design 的设计 Token 系统。
*   **模拟数据**: 项目目前严重依赖模拟数据 (`client/src/data/mock.ts`) 和服务端的内存存储。