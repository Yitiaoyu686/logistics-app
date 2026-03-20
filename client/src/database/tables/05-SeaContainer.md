# SeaContainer - 海运集装箱表

## 📋 表说明

**表名**: `SeaContainer`
**所属模块**: WMS/TMS（仓储/运输管理）
**用途**: 存储海运集装箱信息，包括装载情况、封条号等

---

## 🔑 字段定义

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | string | PK, NOT NULL | - | 集装箱唯一标识 |
| containerNo | string | UNIQUE, NOT NULL | - | 集装箱号 |
| containerType | enum | NOT NULL | - | 集装箱类型 |
| transportMode | string | NOT NULL | 'SEA' | 运输方式（固定为SEA） |
| sealNo | string | NULL | - | 封条号 |
| maxWeight | number | NOT NULL | - | 最大载重（kg） |
| maxVolume | number | NOT NULL | - | 最大容积（m³） |
| currentWeight | number | NOT NULL | 0 | 当前重量（kg） |
| currentVolume | number | NOT NULL | 0 | 当前体积（m³） |
| loadedPieces | number | NOT NULL | 0 | 已装件数 |
| orderIds | JSON | NOT NULL | [] | 装载的订单ID数组 |
| status | enum | NOT NULL | 'EMPTY' | 集装箱状态 |
| route | string | NULL | - | 运输路线 |
| jobNo | string | FK, NULL | - | 任务编号（绑定后） |
| operator | string | NULL | - | 操作员 |
| warehouseLocation | string | NULL | - | 仓库位置 |
| loadingStartTime | string | NULL | - | 开始装载时间 |
| sealedTime | string | NULL | - | 封箱时间 |
| remark | string | NULL | - | 备注信息 |
| createdAt | string | NOT NULL | - | 创建时间 |
| updatedAt | string | NULL | - | 更新时间 |

---

## 📊 枚举类型定义

### SeaContainerType（集装箱类型）
```typescript
type SeaContainerType = '20GP' | '40GP' | '40HQ' | '45HQ';
```

**容量参考**:
- 20GP: 最大载重 21,000kg, 容积 33m³
- 40GP: 最大载重 26,000kg, 容积 67.7m³
- 40HQ: 最大载重 26,000kg, 容积 76m³
- 45HQ: 最大载重 27,000kg, 容积 86m³

### SeaContainerStatus（集装箱状态）
```typescript
type SeaContainerStatus =
  | 'EMPTY'     // 空箱
  | 'LOADING'   // 装载中
  | 'SEALED'    // 已封箱
  | 'SHIPPED'   // 已发运
  | 'ARRIVED';  // 已到达
```

---

## 🔍 索引建议

### 主键索引
- `PRIMARY KEY (id)`

### 唯一索引
- `UNIQUE INDEX idx_container_no (containerNo)`

### 外键索引
- `INDEX idx_container_jobno (jobNo)`

### 普通索引
- `INDEX idx_container_status (status)`
- `INDEX idx_container_route (route)`
- `INDEX idx_container_created (createdAt)`

---

## 🔗 关联关系

### 对内关系
- **N:1 → Job**: 多个集装箱绑定到一个任务
  - 外键: `jobNo` → `Job.jobNo`（可选，绑定后才有值）

### 对外关系
- **1:N → SubOrder**: 一个集装箱装载多个子订单
  - 关联字段: `orderIds[]` 包含所有装载的子订单ID
  - 反向引用: `SubOrder.shippingUnitId` → `SeaContainer.id`

---

## 📝 示例数据

```json
{
  "id": "UNIT-001",
  "containerNo": "MSKU1234567",
  "containerType": "40HQ",
  "transportMode": "SEA",
  "sealNo": "SEAL123456",
  "maxWeight": 26000,
  "maxVolume": 76,
  "currentWeight": 18500,
  "currentVolume": 58,
  "loadedPieces": 30,
  "orderIds": ["SUB-001", "SUB-002"],
  "status": "SHIPPED",
  "route": "深圳→洛杉矶",
  "jobNo": "JOB-SZX-LAX-231028",
  "operator": "李仓管",
  "warehouseLocation": "深圳龙岗仓A区",
  "loadingStartTime": "2024-01-15T08:00:00Z",
  "sealedTime": "2024-01-18T16:00:00Z",
  "remark": "",
  "createdAt": "2024-01-15T08:00:00Z",
  "updatedAt": "2024-01-18T16:00:00Z"
}
```

---

## 💡 业务规则

1. **集装箱号规则**:
   - 由船公司提供，全球唯一
   - 格式: 4位字母 + 7位数字（如 MSKU1234567）

2. **状态流转**:
   - EMPTY（空箱）→ LOADING（装载中）→ SEALED（已封箱）→ SHIPPED（已发运）→ ARRIVED（已到达）

3. **装载管理**:
   - 装载时更新 `currentWeight`、`currentVolume`、`loadedPieces`
   - 添加订单ID到 `orderIds[]`
   - 同时更新 `SubOrder.shippingUnitId`

4. **封箱规则**:
   - 封箱时必须填写 `sealNo`
   - 记录 `sealedTime`
   - 状态变更为 SEALED

5. **绑定任务**:
   - 只有 SEALED 状态的集装箱才能绑定到任务
   - 绑定后设置 `jobNo`
   - 同时更新 `Job.shippingUnitIds[]`
