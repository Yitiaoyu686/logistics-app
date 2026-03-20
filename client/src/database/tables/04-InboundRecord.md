# InboundRecord - 入库记录表

## 📋 表说明

**表名**: `InboundRecord`
**所属模块**: WMS（仓储管理系统 - 起运国）
**用途**: 记录快递包裹的入库信息，包括实际重量、体积等

---

## 🔑 字段定义

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | string | PK, NOT NULL | - | 入库记录唯一标识 |
| subOrderId | string | FK, NOT NULL | - | 子订单ID（外键） |
| trackingNo | string | NOT NULL | - | 快递单号 |
| actualWeight | number | NOT NULL | - | 实际重量（kg） |
| actualVolume | number | NOT NULL | - | 实际体积（m³） |
| actualPieces | number | NOT NULL | - | 实际件数 |
| inboundTime | string | NOT NULL | - | 入库时间（ISO 8601） |
| operator | string | NOT NULL | - | 操作员 |
| warehouseLocation | string | NULL | - | 仓库位置 |
| remark | string | NULL | - | 备注信息 |
| createdAt | string | NOT NULL | - | 创建时间 |

---

## 🔍 索引建议

### 主键索引
- `PRIMARY KEY (id)`

### 外键索引
- `INDEX idx_inbound_suborderid (subOrderId)`

### 普通索引
- `INDEX idx_inbound_tracking (trackingNo)`
- `INDEX idx_inbound_time (inboundTime)`
- `INDEX idx_inbound_operator (operator)`

---

## 🔗 关联关系

### 对内关系
- **N:1 → SubOrder**: 多次入库记录对应一个子订单
  - 外键: `subOrderId` → `SubOrder.id`

---

## 📝 示例数据

```json
{
  "id": "IB-001",
  "subOrderId": "SUB-001",
  "trackingNo": "SF123456701",
  "actualWeight": 26.2,
  "actualVolume": 0.12,
  "actualPieces": 10,
  "inboundTime": "2024-01-16T09:30:00Z",
  "operator": "李仓管",
  "warehouseLocation": "深圳龙岗仓A区",
  "remark": "包装完好",
  "createdAt": "2024-01-16T09:30:00Z"
}
```

---

## 💡 业务规则

1. **扫码入库**:
   - 通过扫描 `trackingNo` 快速入库
   - 自动关联到对应的 `SubOrder`

2. **实际数据记录**:
   - 记录实际称重的重量、体积
   - 可能与预报数据有差异

3. **分批入库**:
   - 一个子订单可能分多次入库
   - 每次入库创建一条记录
