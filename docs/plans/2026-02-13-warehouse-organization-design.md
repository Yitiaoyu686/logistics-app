# 组织管理（多仓库）实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为跨境物流管理系统新增多仓库管理功能，实现仓库 CRUD、用户-仓库多对多关联、全局仓库切换器，以及所有仓储相关模块的仓库数据隔离。

**Architecture:** 新增 `warehouses` 和 `user_warehouses` 两张表，渐进式改造现有表的仓库字段。服务端 API 加入仓库维度过滤（ADMIN/BOSS 无限制，其他角色按关联仓库过滤）。前端 App.tsx 顶栏增加仓库切换器，选中仓库 ID 通过 props/state 传递到各页面。

**Tech Stack:** React 19 + TypeScript + Ant Design v6 + Express.js + better-sqlite3 + SQLite

---

## Task 1: 新增 warehouses 和 user_warehouses 表

**Files:**
- Modify: `server/src/database/schema.ts` (在 createTables 函数末尾添加两个新表)

**Step 1: 在 schema.ts 的 `db.exec` 中添加两个新表**

在 `no_order_express` 表定义之后、`console.log` 之前，添加：

```sql
-- 25. warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  nameEn TEXT,
  type TEXT NOT NULL CHECK(type IN ('ORIGIN','DESTINATION','TRANSIT')),
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  managerId TEXT,
  managerName TEXT,
  managerPhone TEXT,
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
  remark TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_wh_type ON warehouses(type);
CREATE INDEX IF NOT EXISTS idx_wh_status ON warehouses(status);

-- 26. user_warehouses
CREATE TABLE IF NOT EXISTS user_warehouses (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  warehouseId TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE(userId, warehouseId)
);
CREATE INDEX IF NOT EXISTS idx_uw_user ON user_warehouses(userId);
CREATE INDEX IF NOT EXISTS idx_uw_warehouse ON user_warehouses(warehouseId);
```

更新 console.log 为 `'All 26 tables created successfully'`。

**Step 2: 验证服务端重启无报错**

Run: 删除 `server/logistics.db`，重启服务端
Expected: `All 26 tables created successfully` + `Database seeded successfully!`

---

## Task 2: 添加仓库和用户-仓库关联的种子数据

**Files:**
- Modify: `server/src/database/seed.ts` (在 seedNotifs 之后添加仓库种子数据)

**Step 1: 在 seed.ts 末尾（seedNotifs 之后、console.log 之前）添加仓库种子数据**

```typescript
// ========== 17. WAREHOUSES ==========
const insertWarehouse = db.prepare(`
  INSERT INTO warehouses (id, code, name, nameEn, type, country, city, address, managerId, managerName, managerPhone, capacity, status, remark, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedWarehouses = db.transaction(() => {
  insertWarehouse.run('WH-GZ-001', 'GZ-A', '广州仓A', 'Guangzhou Warehouse A', 'ORIGIN', '中国', '广州', '广州市白云区太和镇xxx路xxx号', 'USR-003', '李仓管', '13800000002', 5000, 'ACTIVE', null, now, now);
  insertWarehouse.run('WH-SZ-001', 'SZ-A', '深圳仓A', 'Shenzhen Warehouse A', 'ORIGIN', '中国', '深圳', '深圳市宝安区福永镇xxx路xxx号', null, null, null, 3000, 'ACTIVE', null, now, now);
  insertWarehouse.run('WH-SH-001', 'SH-A', '上海仓A', 'Shanghai Warehouse A', 'ORIGIN', '中国', '上海', '上海市浦东新区xxx路xxx号', null, null, null, 4000, 'ACTIVE', null, now, now);
  insertWarehouse.run('WH-LOS-001', 'LOS-A', '拉各斯主仓', 'Lagos Main Warehouse', 'DESTINATION', '尼日利亚', '拉各斯', '123 Marina Street, Lagos', 'USR-006', '王仓管', '13800000005', 8000, 'ACTIVE', null, now, now);
  insertWarehouse.run('WH-ABJ-001', 'ABJ-A', '阿布贾分仓', 'Abuja Branch Warehouse', 'DESTINATION', '尼日利亚', '阿布贾', '456 Central District, Abuja', null, null, null, 2000, 'ACTIVE', null, now, now);
  insertWarehouse.run('WH-ACC-001', 'ACC-A', '阿克拉主仓', 'Accra Main Warehouse', 'DESTINATION', '加纳', '阿克拉', '321 Oxford Street, Osu, Accra', null, null, null, 3000, 'ACTIVE', null, now, now);
  insertWarehouse.run('WH-PH-001', 'PH-A', '哈科特港分仓', 'Port Harcourt Warehouse', 'DESTINATION', '尼日利亚', '哈科特港', '555 Trans Amadi, Port Harcourt', null, null, null, 1500, 'ACTIVE', null, now, now);
});
seedWarehouses();

// ========== 18. USER_WAREHOUSES ==========
const insertUserWarehouse = db.prepare(`
  INSERT INTO user_warehouses (id, userId, warehouseId, createdAt)
  VALUES (?, ?, ?, ?)
`);

const seedUserWarehouses = db.transaction(() => {
  // 起运国仓管 - 关联广州仓和深圳仓
  insertUserWarehouse.run('UW-001', 'USR-003', 'WH-GZ-001', now);
  insertUserWarehouse.run('UW-002', 'USR-003', 'WH-SZ-001', now);
  // 起运国运营 - 关联所有起运国仓库
  insertUserWarehouse.run('UW-003', 'USR-004', 'WH-GZ-001', now);
  insertUserWarehouse.run('UW-004', 'USR-004', 'WH-SZ-001', now);
  insertUserWarehouse.run('UW-005', 'USR-004', 'WH-SH-001', now);
  // 到达国仓管 - 关联拉各斯主仓和阿布贾分仓
  insertUserWarehouse.run('UW-006', 'USR-006', 'WH-LOS-001', now);
  insertUserWarehouse.run('UW-007', 'USR-006', 'WH-ABJ-001', now);
  // 到达国运营 - 关联所有到达国仓库
  insertUserWarehouse.run('UW-008', 'USR-005', 'WH-LOS-001', now);
  insertUserWarehouse.run('UW-009', 'USR-005', 'WH-ABJ-001', now);
  insertUserWarehouse.run('UW-010', 'USR-005', 'WH-ACC-001', now);
  insertUserWarehouse.run('UW-011', 'USR-005', 'WH-PH-001', now);
  // 司机 - 关联拉各斯主仓
  insertUserWarehouse.run('UW-012', 'USR-009', 'WH-LOS-001', now);
  insertUserWarehouse.run('UW-013', 'USR-010', 'WH-LOS-001', now);
});
seedUserWarehouses();
```

**Step 2: 重建数据库验证**

Run: 删除 `server/logistics.db`，重启服务端
Expected: 无报错，`Database seeded successfully!`

---

## Task 3: 仓库 CRUD API

**Files:**
- Modify: `server/src/routes/system.ts` (添加仓库 CRUD 路由)

**Step 1: 在 system.ts 中添加仓库管理路由**

在 `no-order-express` 路由之后、`export default router` 之前添加：

```typescript
// ==================== WAREHOUSES ====================

// GET /api/system/warehouses
router.get('/warehouses', (req, res) => {
  const db = getDb();
  const { type, status, country } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (type) { where += ' AND type = ?'; params.push(type); }
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (country) { where += ' AND country = ?'; params.push(country); }

  const rows = db.prepare(`SELECT * FROM warehouses ${where} ORDER BY type, createdAt ASC`).all(...params);
  success(res, rows);
});

// GET /api/system/warehouses/:id
router.get('/warehouses/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id);
  if (!row) { error(res, 'Warehouse not found', 404); return; }
  success(res, row);
});

// POST /api/system/warehouses
router.post('/warehouses', (req, res) => {
  const db = getDb();
  const id = generateId('WH');
  const now = new Date().toISOString();

  const { code, name, nameEn, type, country, city, address, managerId, managerName, managerPhone, capacity, remark } = req.body;

  if (!code || !name || !type || !country || !city) {
    error(res, 'Missing required fields: code, name, type, country, city');
    return;
  }

  // Check unique code
  const existing = db.prepare('SELECT id FROM warehouses WHERE code = ?').get(code);
  if (existing) { error(res, '仓库编码已存在'); return; }

  db.prepare(`
    INSERT INTO warehouses (id, code, name, nameEn, type, country, city, address, managerId, managerName, managerPhone, capacity, status, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
  `).run(id, code, name, nameEn || null, type, country, city, address || null,
    managerId || null, managerName || null, managerPhone || null, capacity || null,
    remark || null, now, now);

  const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
  success(res, warehouse);
});

// PUT /api/system/warehouses/:id
router.put('/warehouses/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM warehouses WHERE id = ?').get(req.params.id);
  if (!existing) { error(res, 'Warehouse not found', 404); return; }

  const fields = req.body;
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }

  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  db.prepare(`UPDATE warehouses SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id);
  success(res, warehouse);
});

// DELETE /api/system/warehouses/:id
router.delete('/warehouses/:id', (req, res) => {
  const db = getDb();
  const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id) as any;
  if (!warehouse) { error(res, 'Warehouse not found', 404); return; }

  // Check if warehouse has associated data
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM user_warehouses WHERE warehouseId = ?').get(req.params.id) as any).c;
  if (userCount > 0) {
    error(res, '该仓库仍有关联用户，无法删除');
    return;
  }

  db.prepare('DELETE FROM warehouses WHERE id = ?').run(req.params.id);
  success(res, null, '仓库删除成功');
});

// ==================== USER-WAREHOUSE ASSOCIATION ====================

// GET /api/system/warehouses/user/:userId
router.get('/warehouses/user/:userId', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT w.* FROM warehouses w
    INNER JOIN user_warehouses uw ON w.id = uw.warehouseId
    WHERE uw.userId = ?
    ORDER BY w.type, w.name
  `).all(req.params.userId);
  success(res, rows);
});

// PUT /api/system/warehouses/user/:userId
router.put('/warehouses/user/:userId', (req, res) => {
  const db = getDb();
  const { warehouseIds } = req.body;

  if (!Array.isArray(warehouseIds)) {
    error(res, 'warehouseIds array is required');
    return;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    // Remove existing associations
    db.prepare('DELETE FROM user_warehouses WHERE userId = ?').run(req.params.userId);
    // Add new associations
    const insert = db.prepare('INSERT INTO user_warehouses (id, userId, warehouseId, createdAt) VALUES (?, ?, ?, ?)');
    for (const whId of warehouseIds) {
      insert.run(generateId('UW'), req.params.userId, whId, now);
    }
  });
  tx();

  // Return updated warehouse list
  const rows = db.prepare(`
    SELECT w.* FROM warehouses w
    INNER JOIN user_warehouses uw ON w.id = uw.warehouseId
    WHERE uw.userId = ?
    ORDER BY w.type, w.name
  `).all(req.params.userId);
  success(res, rows);
});
```

需要在文件顶部添加 `generateId` import：
```typescript
import { generateId } from '../utils/idGenerator';
```

同时更新 `idGenerator.ts` 的 UNION 查询，加入 warehouses 和 user_warehouses 表。

**Step 2: 验证 API**

Run: `curl http://localhost:3001/api/system/warehouses`
Expected: 返回 7 个仓库的 JSON 数组

---

## Task 4: 改造登录 API 返回用户仓库列表

**Files:**
- Modify: `server/src/routes/auth.ts` (login 和 profile 返回 warehouses 数组)

**Step 1: 修改 login handler**

在 login 路由中，`success(res, ...)` 之前，查询用户关联的仓库：

```typescript
// Query user warehouses
const warehouses = db.prepare(`
  SELECT w.id, w.code, w.name, w.nameEn, w.type, w.country, w.city
  FROM warehouses w
  INNER JOIN user_warehouses uw ON w.id = uw.warehouseId
  WHERE uw.userId = ? AND w.status = 'ACTIVE'
  ORDER BY w.type, w.name
`).all(user.id);
```

将 `warehouses` 添加到返回的 user 对象中。对于 ADMIN/BOSS 角色，返回所有活跃仓库。

**Step 2: 修改 profile handler**

同样在 profile 返回中加入 warehouses 数组。

**Step 3: 修改 list users handler**

在 `/api/auth/users` 中，为每个用户附加 warehouses 数组。

---

## Task 5: 前端 API 层添加仓库相关接口

**Files:**
- Modify: `client/src/api/index.ts` (添加 warehouseManagementApi)

**Step 1: 在 systemApi 之后添加仓库管理 API**

```typescript
// ==================== Warehouse Management ====================
export const warehouseManagementApi = {
  list: (params?: Record<string, any>) => api.get('/system/warehouses', { params }),
  get: (id: string) => api.get(`/system/warehouses/${id}`),
  create: (data: any) => api.post('/system/warehouses', data),
  update: (id: string, data: any) => api.put(`/system/warehouses/${id}`, data),
  delete: (id: string) => api.delete(`/system/warehouses/${id}`),
  getUserWarehouses: (userId: string) => api.get(`/system/warehouses/user/${userId}`),
  setUserWarehouses: (userId: string, warehouseIds: string[]) =>
    api.put(`/system/warehouses/user/${userId}`, { warehouseIds }),
};
```

---

## Task 6: 前端 WarehouseManagement.tsx 页面

**Files:**
- Create: `client/src/pages/system/WarehouseManagement.tsx`
- Modify: `client/src/App.tsx` (import + MENU_CONFIG + ContentRenderer)

**Step 1: 创建 WarehouseManagement.tsx**

完整的仓库管理页面，包含：
- 统计卡片（总仓库数、起运国仓库、到达国仓库、中转仓库）
- 筛选区（类型、状态、国家）
- 数据表格（编码、名称、类型、国家/城市、负责人、状态、操作）
- 创建/编辑 Modal（表单字段：编码、名称、英文名、类型、国家、城市、地址、负责人、电话、容量、备注）
- 状态切换（启用/禁用）
- 关联用户查看（点击查看按钮弹出 drawer 显示关联用户列表）

使用项目标准模式：`theme.useToken()` + 内联样式 + Ant Design 组件。调用 `warehouseManagementApi` 进行 CRUD。

**Step 2: 在 App.tsx 中注册**

Import:
```typescript
import { WarehouseManagement } from './pages/system/WarehouseManagement';
```

MENU_CONFIG `set_base` 的 tabs 中，在 `set_base_warehouse`（中转仓库）之前插入：
```typescript
{ key: 'set_base_org', label: '组织管理' },
```

ContentRenderer switch 中添加：
```typescript
case 'set_base_org': return <WarehouseManagement />;
```

**Step 3: 验证**

用 Playwright 打开 http://localhost:5173，登录 admin 账号，导航到系统设置 > 基础设置 > 组织管理，验证页面加载和数据显示。

---

## Task 7: 全局仓库切换器

**Files:**
- Modify: `client/src/App.tsx` (顶栏添加仓库 Select)

**Step 1: 添加全局仓库状态**

在 App 组件中添加：
```typescript
const [userWarehouses, setUserWarehouses] = useState<any[]>([]);
const [currentWarehouseId, setCurrentWarehouseId] = useState<string>('');
```

在 `handleLoginSuccess` 中，从登录返回的 `user.warehouses` 初始化仓库列表。ADMIN/BOSS 额外调用 `warehouseManagementApi.list()` 获取所有仓库。

**Step 2: 在 Header 中添加仓库切换下拉框**

在用户名和角色标签之间插入 `Select` 组件：
```typescript
<Select
  value={currentWarehouseId}
  onChange={setCurrentWarehouseId}
  style={{ width: 160 }}
  placeholder="选择仓库"
  allowClear
  options={userWarehouses.map(w => ({ value: w.id, label: w.name }))}
/>
```

**Step 3: 将 currentWarehouseId 传递给 ContentRenderer**

修改 ContentRenderer 的 props，增加 `warehouseId` 参数，从 App 传入 `currentWarehouseId`。这样各页面组件可以接收到当前选中的仓库 ID。

**Step 4: 验证**

用 Playwright 登录不同角色，验证仓库切换器显示正确的仓库列表。

---

## Task 8: 改造现有表的仓库字段

**Files:**
- Modify: `server/src/database/schema.ts` (用 migration 方式添加 warehouseId 列)

**Step 1: 在 schema.ts 中添加 migration 逻辑**

在已有的 `ALTER TABLE clients` migration 之后，添加：

```typescript
// Migration: add warehouseId columns to existing tables
try { db.exec('ALTER TABLE inbound_records ADD COLUMN warehouseId TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE stock_items ADD COLUMN warehouseId TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE shipping_units ADD COLUMN warehouseId TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE transfer_orders ADD COLUMN fromWarehouseId TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE transfer_orders ADD COLUMN toWarehouseId TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE notifications ADD COLUMN warehouseId TEXT'); } catch (_) {}
try { db.exec('ALTER TABLE delivery_orders ADD COLUMN warehouseId TEXT'); } catch (_) {}
```

**注意**：保留旧字段（`warehouse`、`fromWarehouse`、`toWarehouse`）不删除，新增 `warehouseId` 字段。这样不破坏现有数据和逻辑，渐进过渡。

**Step 2: 更新种子数据，为新字段填充值**

在 seed.ts 中，在种子数据插入完成后，添加数据迁移：

```typescript
// Migrate warehouse fields to warehouseId
db.prepare("UPDATE inbound_records SET warehouseId = 'WH-GZ-001' WHERE warehouse = 'CN'").run();
db.prepare("UPDATE inbound_records SET warehouseId = 'WH-LOS-001' WHERE warehouse = 'US'").run();
db.prepare("UPDATE stock_items SET warehouseId = 'WH-GZ-001' WHERE warehouse = 'CN'").run();
db.prepare("UPDATE stock_items SET warehouseId = 'WH-LOS-001' WHERE warehouse = 'US'").run();
db.prepare("UPDATE shipping_units SET warehouseId = 'WH-GZ-001' WHERE warehouse LIKE '%深圳%' OR warehouse LIKE '%广州%'").run();
db.prepare("UPDATE shipping_units SET warehouseId = 'WH-SH-001' WHERE warehouse LIKE '%上海%'").run();
db.prepare("UPDATE shipping_units SET warehouseId = 'WH-LOS-001' WHERE warehouse LIKE '%拉各斯%'").run();
db.prepare("UPDATE notifications SET warehouseId = 'WH-GZ-001' WHERE warehouse = 'CN'").run();
db.prepare("UPDATE notifications SET warehouseId = 'WH-LOS-001' WHERE warehouse = 'US'").run();
db.prepare("UPDATE delivery_orders SET warehouseId = 'WH-LOS-001'").run();
```

**Step 3: 重建数据库验证**

Run: 删除 `server/logistics.db`，重启服务端
Expected: 无报错，新字段已填充

---

## Task 9: 改造服务端仓储 API 支持 warehouseId 过滤

**Files:**
- Modify: `server/src/routes/warehouse.ts` (所有查询支持 warehouseId 参数)
- Modify: `server/src/routes/delivery.ts` (配送查询支持 warehouseId)
- Modify: `server/src/routes/notifications.ts` (通知查询支持 warehouseId)

**Step 1: 修改 warehouse.ts 中的 GET /inbound**

将 `if (warehouse)` 条件改为同时支持 `warehouseId`：
```typescript
if (req.query.warehouseId) { where += ' AND warehouseId = ?'; params.push(req.query.warehouseId); }
```

**Step 2: 同样改造 GET /stock、GET /units、GET /transfers、GET /returns**

每个查询路由添加 `warehouseId` 过滤。

**Step 3: POST /inbound 中接收 warehouseId**

创建入库记录时，将 `warehouseId` 写入新字段。

**Step 4: 改造 delivery.ts 和 notifications.ts**

同上模式。

**Step 5: 验证**

Run: `curl "http://localhost:3001/api/warehouse/inbound?warehouseId=WH-GZ-001"`
Expected: 仅返回广州仓的入库记录

---

## Task 10: 改造前端仓储页面传递 warehouseId

**Files:**
- Modify: `client/src/pages/wms/origin/InboundList.tsx`
- Modify: `client/src/pages/wms/origin/StockList.tsx`
- Modify: `client/src/pages/wms/origin/ContainerMgt.tsx`
- Modify: `client/src/pages/wms/origin/AirCargoMgt.tsx`
- Modify: `client/src/pages/wms/origin/ReturnProcess.tsx`
- Modify: `client/src/pages/wms/origin/NoOrderExpress.tsx`
- Modify: `client/src/pages/wms/origin/TransferList.tsx`
- Modify: `client/src/pages/wms/destination/DestInboundList.tsx`
- Modify: `client/src/pages/wms/destination/DeliveryList.tsx`
- Modify: `client/src/pages/wms/destination/DestStockList.tsx`
- Modify: `client/src/pages/wms/destination/DestTransferList.tsx`

**Step 1: 为每个页面组件添加 warehouseId prop**

```typescript
export const InboundList = ({ warehouseId }: { warehouseId?: string }) => {
```

**Step 2: 在数据查询请求中加入 warehouseId 参数**

```typescript
const fetchData = async () => {
  const res = await warehouseApi.listInbound({ warehouseId, ...otherFilters });
  // ...
};
```

当 `warehouseId` 变化时重新请求数据（添加到 useEffect 依赖）。

**Step 3: 从 App.tsx ContentRenderer 传入 warehouseId**

修改 ContentRenderer 以传递 `warehouseId` prop：
```typescript
case 'wms_in_record': return <InboundList warehouseId={warehouseId} />;
```

**Step 4: 用 Playwright 验证**

登录 → 选择仓库 → 导航到起运国仓储 → 验证数据根据仓库过滤。

---

## Task 11: 改造 UserManagement 支持多仓库关联

**Files:**
- Modify: `client/src/pages/system/UserManagement.tsx`

**Step 1: 用户列表增加"所属仓库"列**

在 Table columns 中添加：
```typescript
{
  title: '所属仓库',
  dataIndex: 'warehouses',
  render: (warehouses: any[]) => warehouses?.map(w => <Tag key={w.id}>{w.name}</Tag>)
}
```

**Step 2: 用户创建/编辑表单增加仓库多选**

添加 `Select` 组件，`mode="multiple"`，从 `warehouseManagementApi.list()` 获取选项列表。

**Step 3: 保存时调用 `warehouseManagementApi.setUserWarehouses()`**

创建/编辑用户提交后，调用仓库关联 API。

**Step 4: 用 Playwright 验证**

打开用户管理 → 编辑用户 → 选择多个仓库 → 保存 → 验证显示正确。

---

## Task 12: 合并 TransitWarehouseManagement 到 WarehouseManagement

**Files:**
- Modify: `client/src/App.tsx` (移除旧的中转仓库 tab 或指向新组件)

**Step 1: 修改 MENU_CONFIG**

将 `set_base_warehouse`（中转仓库）的 ContentRenderer case 改为也渲染 `WarehouseManagement`，但默认筛选 `type='TRANSIT'`：

```typescript
case 'set_base_warehouse': return <WarehouseManagement defaultType="TRANSIT" />;
```

或者直接移除 `set_base_warehouse` tab，让用户在组织管理页面中通过类型筛选查看中转仓库。

---

## Task 13: 移动端 - 仓库选择与切换

**Files:**
- Modify: `app/src/App.tsx` (登录后仓库选择逻辑)
- Create: `app/src/pages/auth/WarehouseSelect.tsx` (仓库选择页面)
- Modify: `app/src/pages/profile/ProfilePage.tsx` (添加切换仓库入口)

**Step 1: 创建仓库选择页面 WarehouseSelect.tsx**

登录后如果用户关联多个仓库，跳转到仓库选择页面：
- 显示仓库列表（Card 卡片样式）
- 点击选择后存入 localStorage
- 单仓库时自动跳过

**Step 2: 修改 App.tsx 路由**

添加 `/warehouse-select` 路由。

**Step 3: 修改 ProfilePage**

在个人中心添加"切换仓库"按钮。

**Step 4: 移动端所有仓储相关页面的 API 请求加入 warehouseId**

从 localStorage 读取当前仓库 ID，附加到请求参数中。

**Step 5: 用 Playwright 在移动端验证**

打开 http://localhost:1234 → 登录仓管账号 → 验证仓库选择流程。

---

## 实施顺序依赖关系

```
Task 1 (DB 新表)
  └→ Task 2 (种子数据)
       └→ Task 3 (仓库 CRUD API)
            └→ Task 4 (登录 API 改造)
            └→ Task 5 (前端 API 层)
                 └→ Task 6 (WarehouseManagement 页面)
                 └→ Task 7 (全局仓库切换器)
       └→ Task 8 (改造现有表字段)
            └→ Task 9 (改造仓储 API)
                 └→ Task 10 (改造前端仓储页面)
  Task 11 (UserManagement 改造) - 依赖 Task 5
  Task 12 (合并中转仓库页面) - 依赖 Task 6
  Task 13 (移动端) - 依赖 Task 4 + Task 9
```

可并行的组：
- Task 3 + Task 8（API 新增 和 DB 改造可同时进行）
- Task 6 + Task 7（两个前端页面可同时开发）
- Task 10 + Task 11 + Task 12（三个前端改造可同时进行）
