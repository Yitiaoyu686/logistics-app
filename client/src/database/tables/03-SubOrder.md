# SubOrder - 子订单表

## 📋 表说明

**表名**: `SubOrder`
**所属模块**: OMS（订单管理系统）
**用途**: 存储拆分后的子订单信息，每个子订单对应一个快递包裹

---

## 🔑 字段定义

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | string | PK, NOT NULL | - | 子订单唯一标识 |
| subOrderNo | string | UNIQUE, NOT NULL | - | 子运单号 |
| trackingNo | string | UNIQUE, NOT NULL | - | 快递单号 |
| masterOrderId | string | FK, NOT NULL | - | 主订单ID（外键） |
| shippingUnitId | string | FK, NULL | - | 运输单元ID（装箱后） |
| clientCode | string | NOT NULL | - | 客户简码（冗余） |
| clientName | string | NOT NULL | - | 客户名称（冗余） |
| route | string | NOT NULL | - | 运输路线 |
| destCountry | string | NOT NULL | - | 目的国家 |
| sender | string | NOT NULL | - | 发件人 |
| receiver | string | NOT NULL | - | 收件人 |
| description | string | NOT NULL | - | 货物描述 |
| category | string | NOT NULL | - | 货物类别 |
| weight | number | NOT NULL | - | 预报重量（kg） |
| volume | number | NOT NULL | - | 预报体积（m³） |
| pieces | number | NOT NULL | - | 件数 |
| value | number | NOT NULL | - | 货值 |
| status | enum | NOT NULL | 'CREATED' | 订单状态 |
| paymentMethod | string | NULL | - | 付款方式 |
| paymentStatus | enum | NOT NULL | 'UNPAID' | 付款状态 |
| createdAt | string | NOT NULL | - | 创建时间 |
| updatedAt | string | NOT NULL | - | 更新时间 |
| note | string | NULL | - | 订单备注 |
| remark | string | NULL | - | 内部备注 |

---

## 📊 枚举类型定义

### OrderStatus（订单状态）
```typescript
type OrderStatus =
  | 'CREATED'      // 已创建（快递预报）
  | 'IN_WAREHOUSE' // 已入库
  | 'SHIPPED'      // 已发运
  | 'ARRIVED'      // 已到达
  | 'DELIVERED';   // 已签收
```

### PaymentStatus（付款状态）
```typescript
type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
```

---

## 🔍 索引建议

### 主键索引
- `PRIMARY KEY (id)`

### 唯一索引
- `UNIQUE INDEX idx_suborder_no (subOrderNo)`
- `UNIQUE INDEX idx_suborder_tracking (trackingNo)`

### 外键索引
- `INDEX idx_suborder_masterid (masterOrderId)`
- `INDEX idx_suborder_unitid (shippingUnitId)`

### 普通索引
- `INDEX idx_suborder_status (status)`
- `INDEX idx_suborder_client (clientCode)`
- `INDEX idx_suborder_created (createdAt)`

---

## 🔗 关联关系

### 对内关系
- **N:1 → MasterOrder**: 多个子订单属于一个主订单
  - 外键: `masterOrderId` → `MasterOrder.id`
- **N:1 → ShippingUnit**: 多个子订单装入一个运输单元
  - 外键: `shippingUnitId` → `ShippingUnit.id`（可选，装箱后才有值）

### 对外关系
- **1:N → InboundRecord**: 一个子订单可以有多次入库记录
  - 关联字段: `InboundRecord.subOrderId` → `SubOrder.id`

---

## 📝 示例数据

```json
{
  "id": "SUB-001",
  "subOrderNo": "SUB-20240115-001",
  "trackingNo": "SF123456701",
  "masterOrderId": "MO-001",
  "shippingUnitId": "UNIT-001",
  "clientCode": "SZ01",
  "clientName": "深圳大疆贸易有限公司",
  "route": "深圳→洛杉矶",
  "destCountry": "美国",
  "sender": "深圳龙岗仓库",
  "receiver": "John Smith",
  "description": "手机壳/钢化膜",
  "category": "普货",
  "weight": 25.5,
  "volume": 0.1,
  "pieces": 10,
  "value": 1200,
  "status": "SHIPPED",
  "paymentMethod": "微信支付",
  "paymentStatus": "PAID",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-20T14:30:00Z",
  "note": "加急处理",
  "remark": "长期老客户"
}
```

---

## 💡 业务规则

1. **子运单号生成规则**:
   - 格式: `SUB-YYYYMMDD-XXX`
   - 示例: `SUB-20240115-001`

2. **快递单号**:
   - 由客户提供或系统生成
   - 必须唯一，用于扫码入库

3. **状态流转**:
   - CREATED（快递预报）→ IN_WAREHOUSE（扫码入库）→ SHIPPED（装箱发运）→ ARRIVED（到达目的国）→ DELIVERED（签收）

4. **装箱关联**:
   - 初始 `shippingUnitId` 为 NULL
   - 装箱后更新 `shippingUnitId`
   - 同时更新 `ShippingUnit.orderIds[]`

5. **重量体积**:
   - `weight` 和 `volume` 是客户预报的数据
   - 实际重量体积记录在 `InboundRecord` 中
