# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cross-border logistics management system (TMS/ERP) web client with role-based access control. Modules: CRM, OMS (Orders), TMS (Transport), WMS (Warehouse), Finance, System Settings.

**Current State**: All data is in-memory mock data distributed across module-specific files (see "Data Flow" below). Backend Express server at `/server` exists but is not connected.

## Tech Stack

React 19 + TypeScript (strict mode) + Vite 7 + Ant Design v6 + React Router DOM v7 (not used for routing) + Axios + Day.js

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server at http://localhost:5173
npm run build        # TypeScript compile + Vite build
npm run lint         # ESLint
npm run preview      # Preview production build
```

**No test framework is configured.** No Jest, Vitest, or testing libraries are installed.

## Architecture

### Menu-Driven Navigation (Critical)

This app does **NOT** use React Router for navigation. All routing is state-driven in `/src/App.tsx`:

- `MENU_CONFIG` array defines the entire menu structure with role-based visibility
- Navigation via `activeMenuKey` + `activeTabKey` state
- Content rendered via `ContentRenderer` switch statement
- Menus/tabs filtered by current user role via `useMemo`
- Top-bar role switcher allows testing different permission levels

**To add a new page:**
1. Create component in `/src/pages/{module}/ComponentName.tsx`
2. Add menu item to `MENU_CONFIG` in `App.tsx` with `roles` array
3. Add case to `ContentRenderer` switch for the tab `key`

### User Roles

```typescript
type UserRole = 'ADMIN' | 'SALES' | 'WAREHOUSE_CN' | 'OPS_CN' |
                'OPS_US' | 'WAREHOUSE_US' | 'FINANCE' | 'BOSS'
```

### Type System

Types split across domain-specific files in `/src/types/`:
- `core.ts` - Shared types: Client, MasterOrder, SubOrder, Job, ShippingUnit, InboundRecord, Fee
- `order.ts` - Order-specific types
- `finance.ts` - Finance types
- `warehouse.ts` - Warehouse types
- `delivery.ts` - Delivery types

**Key entity relationships:**
```
MasterOrder (1) ──> (N) SubOrder
SubOrder (N) ──> (1) ShippingUnit (Container/Pallet)
ShippingUnit (N) ──> (1) Job (Transport Task)
```

Many pages also define types locally. When adding types, decide: global/shared → `core.ts`, module-specific → local or `/src/types/{module}.ts`.

### Data Flow

**Mock data is NOT centralized.** It is distributed across module-specific files and inline within page components. Key mock data locations:

- `/src/pages/tms/taskManagerLegacyData.ts` — TMS 任务/JOB/集装箱数据（`LEGACY_TASKS`，核心数据源，~194KB）
- `/src/pages/wms/origin/derivedWarehouseData.ts` — 起运国仓储派生数据
- `/src/pages/wms/destination/podUiMockStore.ts` — 目的国 POD 派送数据
- `/src/data/destinations.ts` — 目的地/地区基础数据
- Inline mock data inside individual `.tsx` pages (CRM, 财务, 仪表盘等模块直接在组件内定义)

To connect backend: locate the relevant mock file/inline data for the feature, then replace with `axios.get('/api/...')` calls with async/await + try/catch. Backend runs on port 3000.

### Page Organization

Pages in `/src/pages/` organized by business module:
- `crm/` - Customer management (public pool, my customers)
- `oms/` - Order management (list, create, detail, split)
- `tms/` - Transport management (jobs, tracking)
- `wms/origin/` - Origin warehouse (inbound, stock, containers, air cargo, returns)
- `wms/destination/` - Destination warehouse (inbound, delivery, stock)
- `finance/` - Fee management, approvals, reports, payroll
- `system/` - System settings (regions, suppliers, carriers, users, roles)
- `dashboard/` - Todo list, alert center
- `sales/` - Sales dashboard, price calculator

### Database Documentation

`/src/database/tables/` contains table structure docs (01-Client through 08-Fee) defining the target schema. These are reference docs, not connected to the app.

## Conventions

- **Styling**: Inline styles only. Use `theme.useToken()` for Ant Design design tokens. No CSS modules or stylesheets.
- **State**: `useState` + `useMemo` only. No Redux or Context API.
- **Dates**: Day.js, format `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`.
- **UI feedback**: `message.success()` / `message.error()` from Ant Design.
- **Naming**: PascalCase for components/types/files, camelCase for state/variables.
- **Component patterns**: Modal/Drawer visibility via parent state + `destroyOnClose`. Tables with row-click → detail drawer. Multi-step forms with `Steps` component. Dynamic fields with `Form.List`.

## Important Files

- `/src/App.tsx` - Main shell, `MENU_CONFIG`, `ContentRenderer`, role switching (~619 lines)
- `/src/types/core.ts` - Core shared type definitions
- `/src/pages/tms/taskManagerLegacyData.ts` - Primary TMS mock data (LEGACY_TASKS)
- `/src/pages/tms/LegacyTaskManager.tsx` - 起运国办/到达国办任务管理主组件 (~2500 lines)
- `/src/utils/orderUtils.ts` - Order utility functions
- `/src/utils/jobUtils.ts` - Job utility functions
- `/src/utils/dataQuery.ts` - Data query utilities

## Business Domain

Cross-border logistics flow: CRM (customer acquisition) → OMS (order creation, may split into SubOrders) → WMS Origin (inbound scanning, stock, packing into ShippingUnits) → TMS (ShippingUnits grouped into Jobs for transport) → Transit (sea/air) → WMS Destination (customs, warehousing, delivery) → Finance (fees, costs, profit).
