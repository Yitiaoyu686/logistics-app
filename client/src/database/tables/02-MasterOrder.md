# MasterOrder - 主订单表

## 📋 表说明

**表名**: `MasterOrder`
**所属模块**: OMS（订单管理系统）
**用途**: 存储客户的主订单信息，一个主订单可以拆分为多个子订单

---

## 🔑 字段定义

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | string | PK, NOT NULL | - | 主订单唯一标识 |
| orderNo | string | UNIQUE, NOT NULL | - | 主运单号 |
| clientId | string | FK, NOT NULL | - | 客户ID（外键） |
| clientName | string | NOT NULL | - | 客户名称（冗余字段） |
| totalAmount | number | NOT NULL | 0 | 订单总金额 |
| totalWeight | number | NOT NULL | 0 | 订单总重量（kg） |
| totalVolume | number | NOT NULL | 0 | 订单总体积（m³） |
| totalPieces | number | NOT NULL | 0 | 订单总件数 |
| status | enum | NOT NULL | 'CREATED' | 订单状态 |
| paymentMethod | string | NULL | - | 付款方式 |
| paymentStatus | enum | NOT NULL | 'UNPAID' | 付款状态 |
| createdAt | string | NOT NULL | - | 创建时间（ISO 8601） |
| updatedAt | string | NOT NULL | - | 更新时间（ISO 8601） |
| remark | string | NULL | - | 备注信息 |

---

## 📊 枚举类型定义

### OrderStatus（订单状态）
```typescript
type OrderStatus =
  | 'CREATED'      // 已创建
  | 'IN_WAREHOUSE' // 已入库
  | 'SHIPPED'      // 已发运
  | 'ARRIVED'      // 已到达
  | 'DELIVERED';   // 已签收
```

### PaymentStatus（付款状态）
```typescript
type PaymentStatus =
  | 'UNPAID'   // 未付款
  | 'PARTIAL'  // 部分付款
  | 'PAID';    // 已付款
```

---

## 🔍 索引建议

### 主键索引
- `PRIMARY KEY (id)`

### 唯一索引
- `UNIQUE INDEX idx_masterorder_orderno (orderNo)`

### 外键索引
- `INDEX idx_masterorder_clientid (clientId)`

### 普通索引
- `INDEX idx_masterorder_status (status)`
- `INDEX idx_masterorder_created (createdAt)`
- `INDEX idx_masterorder_payment (paymentStatus)`

---

## 🔗 关联关系

### 对内关系
- **N:1 → Client**: 多个主订单属于一个客户
  - 外键: `clientId` → `Client.id`

### 对外关系
- **1:N → SubOrder**: 一个主订单可以拆分为多个子订单
  - 关联字段: `SubOrder.masterOrderId` → `MasterOrder.id`

---

## 📝 示例数据

```json
{
  "id": "MO-001",
  "orderNo": "MO-20240115-001",
  "clientId": "C1",
  "clientName": "深圳大疆贸易有限公司",
  "totalAmount": 15000,
  "totalWeight": 250.5,
  "totalVolume": 2.8,
  "totalPieces": 30,
  "status": "SHIPPED",
  "paymentMethod": "微信支付",
  "paymentStatus": "PAID",
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-20T14:30:00Z",
  "remark": "加急订单"
}
```

---

## 💡 业务规则

1. **运单号生成规则**:
   - 格式: `MO-YYYYMMDD-XXX`
   - 示例: `MO-20240115-001`

2. **订单拆分**:
   - 一个主订单可以拆分为多个子订单
   - 子订单的总和应等于主订单的统计数据

3. **状态流转**:
   - CREATED → IN_WAREHOUSE → SHIPPED → ARRIVED → DELIVERED
   - 状态由所有子订单的状态决定

4. **金额计算**:
   - `totalAmount` 包含运费、报关费等所有费用
   - 可能与子订单的费用总和不完全一致（有主订单级别的费用）
