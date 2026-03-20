# AirUnit - 空运货物表

## 📋 表说明

**表名**: `AirUnit`
**所属模块**: WMS/TMS（仓储/运输管理）
**用途**: 存储空运货物单元信息，包括托盘、纸箱等

---

## 🔑 字段定义

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | string | PK, NOT NULL | - | 空运单元唯一标识 |
| unitNo | string | UNIQUE, NOT NULL | - | 单元编号 |
| unitType | enum | NOT NULL | - | 单元类型 |
| transportMode | string | NOT NULL | 'AIR' | 运输方式（固定为AIR） |
| mawb | string | NULL | - | 主运单号 |
| hawb | string | NULL | - | 分运单号 |
| length | number | NULL | - | 长度（cm） |
| width | number | NULL | - | 宽度（cm） |
| height | number | NULL | - | 高度（cm） |
| grossWeight | number | NOT NULL | - | 毛重（kg） |
| chargeableWeight | number | NOT NULL | - | 计费重量（kg） |
| volumeWeight | number | NULL | - | 体积重（kg） |
| pieces | number | NOT NULL | - | 件数 |
| orderIds | JSON | NOT NULL | [] | 装载的订单ID数组 |
| status | enum | NOT NULL | 'RECEIVED' | 货物状态 |
| route | string | NULL | - | 运输路线 |
| jobNo | string | FK, NULL | - | 任务编号（绑定后） |
| operator | string | NULL | - | 操作员 |
| warehouseLocation | string | NULL | - | 仓库位置 |
| palletizedTime | string | NULL | - | 打板时间 |
| remark | string | NULL | - | 备注信息 |
| createdAt | string | NOT NULL | - | 创建时间 |
| updatedAt | string | NULL | - | 更新时间 |

---

## 📊 枚举类型定义

### AirUnitType（单元类型）
```typescript
type AirUnitType =
  | 'PALLET'  // 托盘（打板货物）
  | 'CARTON'  // 纸箱
  | 'LOOSE';  // 散货
```

### AirUnitStatus（货物状态）
```typescript
type AirUnitStatus =
  | 'RECEIVED'    // 已收货
  | 'PALLETIZED'  // 已打板
  | 'SHIPPED'     // 已发运
  | 'ARRIVED';    // 已到达
```

---

## 🔍 索引建议

### 主键索引
- `PRIMARY KEY (id)`

### 唯一索引
- `UNIQUE INDEX idx_airunit_no (unitNo)`

### 外键索引
- `INDEX idx_airunit_jobno (jobNo)`

### 普通索引
- `INDEX idx_airunit_status (status)`
- `INDEX idx_airunit_mawb (mawb)`
- `INDEX idx_airunit_route (route)`
- `INDEX idx_airunit_created (createdAt)`

---

## 🔗 关联关系

### 对内关系
- **N:1 → Job**: 多个空运单元绑定到一个任务
  - 外键: `jobNo` → `Job.jobNo`（可选，绑定后才有值）

### 对外关系
- **1:N → SubOrder**: 一个空运单元装载多个子订单
  - 关联字段: `orderIds[]` 包含所有装载的子订单ID
  - 反向引用: `SubOrder.shippingUnitId` → `AirUnit.id`

---

## 📝 示例数据

```json
{
  "id": "AIR-001",
  "unitNo": "PLT-20240115-001",
  "unitType": "PALLET",
  "transportMode": "AIR",
  "mawb": "999-12345678",
  "hawb": "HAWB-001",
  "length": 120,
  "width": 100,
  "height": 160,
  "grossWeight": 850,
  "chargeableWeight": 960,
  "volumeWeight": 960,
  "pieces": 45,
  "orderIds": ["SUB-004", "SUB-005"],
  "status": "SHIPPED",
  "route": "广州→洛杉矶",
  "jobNo": "JOB-PVG-LAX-AIR-001",
  "operator": "张仓管",
  "warehouseLocation": "广州白云仓",
  "palletizedTime": "2024-01-16T10:00:00Z",
  "remark": "已打板，等待航班",
  "createdAt": "2024-01-15T14:00:00Z",
  "updatedAt": "2024-01-16T10:00:00Z"
}
```

---

## 💡 业务规则

1. **单元编号规则**:
   - 格式: `{类型}-YYYYMMDD-XXX`
   - 示例: `PLT-20240115-001`（托盘）、`CTN-20240115-001`（纸箱）

2. **状态流转**:
   - RECEIVED（已收货）→ PALLETIZED（已打板）→ SHIPPED（已发运）→ ARRIVED（已到达）

3. **计费重量计算**:
   - 体积重 = (长 × 宽 × 高) / 6000
   - 计费重 = MAX(毛重, 体积重)

4. **运单号**:
   - MAWB（主运单号）: 航空公司提供
   - HAWB（分运单号）: 货代公司提供
