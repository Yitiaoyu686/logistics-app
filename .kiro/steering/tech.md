# Technology Stack

## Architecture

Monorepo 三端架构：Web 客户端 (`/client`) + 移动端 APP (`/app`) + 后端服务 (`/server`)。后端 Express + SQLite 已完整对接，前端通过 axios 调用 `/api` 接口。当前重心在 Web 端。

## Core Technologies

### Web Client (`/client`)
- **Language**: TypeScript (strict mode)
- **Framework**: React 19
- **UI Library**: Ant Design v6
- **Build Tool**: Vite 7
- **Runtime**: Browser (SPA)
- **Routing**: 无 React Router 路由，使用 App.tsx 中 state-driven 菜单导航

### Mobile App (`/app`)
- **Language**: TypeScript
- **Framework**: React 19
- **UI Library**: Ant Design Mobile v5
- **Build Tool**: Vite
- **Routing**: React Router DOM v7
- **特殊依赖**: html5-qrcode（扫码功能）

### Backend (`/server`)
- **Language**: TypeScript
- **Framework**: Express 5
- **Database**: better-sqlite3（SQLite）
- **Auth**: jsonwebtoken (JWT)
- **Runtime**: Node.js + ts-node + nodemon

## Key Libraries

| 用途 | Web Client | Mobile App | Server |
|------|-----------|------------|--------|
| HTTP | axios | axios | express |
| 日期 | dayjs | dayjs | - |
| UI | antd v6 | antd-mobile v5 | - |

## Development Standards

### Type Safety
- TypeScript strict mode
- 共享类型定义在 `/client/src/types/` 按领域拆分（core.ts, order.ts, finance.ts, warehouse.ts, delivery.ts）
- 页面级局部类型定义在组件文件顶部

### Code Quality
- ESLint (client)
- **无测试框架** — 项目为 Demo 原型，不要求测试覆盖

### Styling Convention
- **纯内联样式** — 不使用 CSS Modules、Styled Components 或 CSS 文件
- 使用 `theme.useToken()` 获取 Ant Design 设计令牌

## Development Environment

### Common Commands
```bash
# Web Client
cd client && npm run dev      # Dev server at :5173
cd client && npm run build    # tsc -b && vite build

# Mobile App
cd app && npm run dev         # Dev server

# Server
cd server && npm run dev      # nodemon at :3001
```

### API Proxy
Vite dev server 将 `/api` 代理到 `http://localhost:3001`

## Key Technical Decisions

1. **State-driven 导航**: App.tsx 中 MENU_CONFIG + ContentRenderer switch + Breadcrumb 面包屑 + 卡片式 Tabs
2. **API-first 数据**: 前端通过 `src/api/index.ts` 调用后端 REST API，SQLite 持久化
3. **Inline Styles Only**: 统一使用内联样式 + useToken()，避免样式文件管理开销
4. **无状态管理库**: 仅 useState + useMemo，组件内自治 — 无 Redux/Context
5. **页面级业务切换**: `useBusinessMode` hook + `BusinessModeSwitcher` 组件实现空运/海运 Segmented 切换

---
_Document standards and patterns, not every dependency_
