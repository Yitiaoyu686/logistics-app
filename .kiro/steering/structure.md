# Project Structure

## Organization Philosophy

按业务模块组织（Module-first），每个模块对应物流业务链路中的一个环节。Web Client 是核心，Mobile App 和 Server 独立部署。

## Directory Patterns

### Web Client Pages (`/client/src/pages/{module}/`)
**Location**: `/client/src/pages/`
**Purpose**: 按业务模块划分页面组件
**Modules**: `crm/`, `oms/`, `tms/`, `wms/origin/`, `wms/destination/`, `finance/`, `system/`, `dashboard/`, `sales/`, `analytics/`, `auth/`, `integration/`
**Pattern**: 每个模块文件夹下为该模块的页面组件，PascalCase 命名

### Type Definitions (`/client/src/types/`)
**Location**: `/client/src/types/`
**Purpose**: 按领域拆分共享类型
**Files**: `core.ts`（核心实体）, `order.ts`, `finance.ts`, `warehouse.ts`, `delivery.ts`
**Rule**: 跨模块共享类型 → types/ 文件，模块私有类型 → 组件文件顶部

### Hooks (`/client/src/hooks/`)
**Location**: `/client/src/hooks/`
**Purpose**: 可复用的业务逻辑 hook
**Pattern**: `use*.ts`，如 `useBusinessMode.ts`（空运/海运切换）、`useOrderBaseOptions.ts`（订单元数据缓存）、`useTableScrollY.ts`（表格高度自适应）

### Shared Components (`/client/src/components/`)
**Location**: `/client/src/components/`
**Purpose**: 跨页面共享的 UI 组件
**Pattern**: PascalCase，如 `BusinessModeSwitcher.tsx`（Segmented 切换器）、`ListPageToolbar.tsx`（列表页工具栏组件族）
**子目录**: 按业务领域分组，如 `warehouse/`（仓储专用共享组件：Modal、Drawer、Panel 等）

### Styles (`/client/src/styles/`)
**Location**: `/client/src/styles/`
**Purpose**: 全局工具类 CSS（布局框架、紧凑模式）
**Pattern**: `ui-compact.css` 在 `main.tsx` 中全局引入，提供 `.list-page-toolbar`、`.compact-stats` 等工具类

### API Layer (`/client/src/api/`)
**Location**: `/client/src/api/`
**Purpose**: Axios 封装，按业务领域分组的 API 调用
**Pattern**: `index.ts` 导出 `orderApi`, `warehouseApi`, `jobApi` 等命名空间

### Data (`/client/src/data/`)
**Location**: `/client/src/data/`
**Purpose**: 静态常量数据（目的地、快递公司、货物分类等）
**Pattern**: 导出常量数组

### Utilities (`/client/src/utils/`)
**Location**: `/client/src/utils/`
**Purpose**: 业务工具函数
**Pattern**: 按领域命名，如 `orderUtils.ts`, `jobUtils.ts`, `dataQuery.ts`, `commissionCalc.ts`, `freightCalc.ts`

### Server Database (`/server/src/database/`)
**Location**: `/server/src/database/`
**Purpose**: SQLite 数据库定义
**Files**: `connection.ts`（连接）, `schema.ts`（26 张表 + 迁移）, `seed.ts`（种子数据）

### Server Routes (`/server/src/routes/`)
**Location**: `/server/src/routes/`
**Purpose**: Express API 路由，按业务领域拆分
**Pattern**: 每个文件导出一个 Router，在 index.ts 中挂载

### Mobile App (`/app/src/`)
**Location**: `/app/`
**Purpose**: 移动端 H5 应用，使用 Ant Design Mobile
**Pattern**: 独立 Vite 项目，React Router 路由

## Naming Conventions

- **Components/Files**: PascalCase（如 `OrderListV2.tsx`, `JobManager.tsx`）
- **Variables/State**: camelCase
- **Types/Interfaces**: PascalCase
- **Mock Constants**: UPPER_SNAKE_CASE（如 `MOCK_CLIENTS`）
- **备份文件**: `.backup` 后缀（如 `SubOrderDetail.tsx.backup`）

## Import Organization

```typescript
// 1. React
import React, { useState, useMemo } from 'react';
// 2. Ant Design components
import { Table, Card, Button, message } from 'antd';
// 3. Ant Design icons
import { PlusOutlined } from '@ant-design/icons';
// 4. Local types
import type { SomeType } from '../../types/core';
// 5. Local data/utils
import { MOCK_DATA } from '../../data/mock';
```

**Path**: 使用相对路径，无 alias 配置

## Adding a New Page (Critical Pattern)

1. 创建组件: `/client/src/pages/{module}/ComponentName.tsx`
2. 在 `App.tsx` 的 `MENU_CONFIG` 中添加菜单项（含 `roles` 权限数组）
3. 在 `ContentRenderer` switch 中添加对应 case
4. 样式使用内联 + `theme.useToken()` + `ui-compact.css` 工具类

## Component Patterns

- **列表页**: BusinessModeSwitcher → Stats Cards → ListPageToolbar（筛选+操作） → Data Table → Detail Drawer/Modal
- **详情页**: 左侧 Anchor 锚点导航 + 右侧滚动 Card 区域（OrderDetail 模式）
- **表单**: Modal/Drawer + `destroyOnClose`，父组件控制 visible state
- **业务切换**: 页面顶部 `<BusinessModeSwitcher>` + `useBusinessMode()` hook
- **UI 反馈**: `message.success()` / `message.error()`
- **日期格式**: `YYYY-MM-DD` 或 `YYYY-MM-DD HH:mm`

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
