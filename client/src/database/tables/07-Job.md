# Job - 运输任务表

## 📋 表说明

**表名**: `Job`
**所属模块**: TMS（运输管理系统）
**用途**: 存储运输任务信息，管理运输单元的运输过程

---

## 🔑 字段定义（第1部分 - 基本信息）

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| jobNo | string | PK, NOT NULL | - | 任务编号（主键） |
| route | string | NOT NULL | - | 运输路线 |
| pol | string | NOT NULL | - | 起运港/机场 |
| pod | string | NOT NULL | - | 目的港/机场 |
| carrier | string | NOT NULL | - | 承运人 |
| vesselVoyage | string | NULL | - | 船名/航次（海运） |
| flightNo | string | NULL | - | 航班号（空运） |
| transportType | enum | NOT NULL | - | 运输类型 |
| etd | string | NOT NULL | - | 预计离港时间 |
| eta | string | NOT NULL | - | 预计到港时间 |
| atd | string | NULL | - | 实际离港时间 |
| ata | string | NULL | - | 实际到港时间 |
| status | string | NOT NULL | - | 任务状态 |

---

## 📊 枚举类型定义

### TransportType（运输类型）
```typescript
type TransportType = 'SEA' | 'AIR';
```

---

## 🔑 字段定义（第2部分 - 阶段管理）

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| currentPhase | enum | NOT NULL | 'ORIGIN' | 当前阶段 |
| originPhaseStatus | string | NULL | - | 起运国阶段状态 |
| originOperator | string | NULL | - | 起运国操作员 |
| originCost | number | NULL | - | 起运国成本 |
| originCostCurrency | string | NULL | - | 起运国成本币种 |
| destPhaseStatus | string | NULL | - | 到达国阶段状态 |
| destOperator | string | NULL | - | 到达国操作员 |
| destCost | number | NULL | - | 到达国成本 |
| destCostCurrency | string | NULL | - | 到达国成本币种 |
| customsClearanceDate | string | NULL | - | 清关完成时间 |

### CurrentPhase（当前阶段）
```typescript
type CurrentPhase = 'ORIGIN' | 'IN_TRANSIT' | 'DESTINATION';
```

---

## 🔑 字段定义（第3部分 - 关联数据）

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| shippingUnitIds | JSON | NOT NULL | [] | 运输单元ID数组 |
| orderIds | JSON | NOT NULL | [] | 订单ID数组（汇总） |
| stats | JSON | NOT NULL | {} | 统计信息对象 |
| capacity | JSON | NULL | {} | 容量信息对象 |
| createdAt | string | NOT NULL | - | 创建时间 |
| updatedAt | string | NULL | - | 更新时间 |

---

## 🔗 JSON 字段结构

### stats（统计信息）
```typescript
interface JobStats {
  containers: number;  // 集装箱/货物单元数量
  orders: number;      // 订单数量
  pieces: number;      // 总件数
  weight: number;      // 总重量（kg）
  volume: number;      // 总体积（m³）
}
```

### capacity（容量信息）
```typescript
interface JobCapacity {
  weight: number;   // 总载重（kg）
  volume: number;   // 总容积（m³）
}
```

---

## 🔍 索引建议

### 主键索引
- `PRIMARY KEY (jobNo)`

### 普通索引
- `INDEX idx_job_status (status)`
- `INDEX idx_job_transport (transportType)`
- `INDEX idx_job_phase (currentPhase)`
- `INDEX idx_job_etd (etd)`
- `INDEX idx_job_created (createdAt)`

---

## 🔗 关联关系

### 对内关系
- **1:N → ShippingUnit**: 一个任务包含多个运输单元
  - 关联字段: `shippingUnitIds[]` 包含所有绑定的运输单元ID
  - 反向引用: `ShippingUnit.jobNo` → `Job.jobNo`

### 对外关系
- **1:N → Fee**: 一个任务产生多个费用项
  - 关联字段: `Fee.jobNo` → `Job.jobNo`

---

## 📝 示例数据

```json
{
  "jobNo": "JOB-SZX-LAX-231028",
  "route": "深圳 (SZX) → 洛杉矶 (LAX)",
  "pol": "深圳港",
  "pod": "洛杉矶港",
  "carrier": "MAERSK",
  "vesselVoyage": "MAERSK LINE",
  "flightNo": null,
  "transportType": "SEA",
  "etd": "2024-01-20",
  "eta": "2024-02-05",
  "atd": "2024-01-20T14:00:00Z",
  "ata": null,
  "status": "DEPARTED",
  "currentPhase": "IN_TRANSIT",
  "originPhaseStatus": "DEPARTED",
  "originOperator": "张运营",
  "originCost": 45000,
  "originCostCurrency": "CNY",
  "destPhaseStatus": "IN_TRANSIT",
  "destOperator": null,
  "destCost": null,
  "destCostCurrency": null,
  "customsClearanceDate": null,
  "shippingUnitIds": ["UNIT-001", "UNIT-002", "UNIT-003"],
  "orderIds": ["SUB-001", "SUB-002", "SUB-003"],
  "stats": {
    "containers": 3,
    "orders": 3,
    "pieces": 90,
    "weight": 55500,
    "volume": 174
  },
  "capacity": {
    "weight": 78000,
    "volume": 228
  },
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-20T14:30:00Z"
}
```

---

## 💡 业务规则

1. **任务编号规则**:
   - 格式: `JOB-{起运港}-{目的港}-YYMMDD`
   - 示例: `JOB-SZX-LAX-231028`

2. **数据汇总规则**:
   - `orderIds[]` 从所有 `shippingUnitIds[]` 对应的运输单元汇总
   - `stats` 统计数据从所有运输单元汇总计算
   - 必须保持数据一致性

3. **阶段管理**:
   - ORIGIN（起运国）→ IN_TRANSIT（运输中）→ DESTINATION（到达国）
   - 每个阶段有独立的状态、操作员、成本信息

4. **海运与空运字段区分**:
   - 海运任务：使用 `vesselVoyage`（船名/航次），`flightNo` 为 null
   - 空运任务：使用 `flightNo`（航班号），`vesselVoyage` 可选
   - 示例：
     - 海运：`vesselVoyage: "MAERSK LINE"`, `flightNo: null`
     - 空运：`flightNo: "CZ6043"`, `vesselVoyage: null`

---

## 📝 空运任务示例数据

```json
{
  "jobNo": "JOB-PVG-LAX-AIR-001",
  "route": "广州 (CAN) → 洛杉矶 (LAX)",
  "pol": "广州白云机场",
  "pod": "洛杉矶国际机场",
  "carrier": "CZ",
  "vesselVoyage": null,
  "flightNo": "CZ327",
  "transportType": "AIR",
  "etd": "2024-01-22T22:00:00Z",
  "eta": "2024-01-23T18:30:00Z",
  "atd": "2024-01-22T22:15:00Z",
  "ata": null,
  "status": "IN_TRANSIT",
  "currentPhase": "IN_TRANSIT",
  "originPhaseStatus": "DEPARTED",
  "originOperator": "张运营",
  "originCost": 28000,
  "originCostCurrency": "CNY",
  "destPhaseStatus": "IN_TRANSIT",
  "shippingUnitIds": ["AIR-001"],
  "orderIds": ["SUB-004"],
  "stats": {
    "containers": 1,
    "orders": 1,
    "pieces": 45,
    "weight": 850,
    "volume": 1.92
  },
  "createdAt": "2024-01-20T10:00:00Z",
  "updatedAt": "2024-01-22T22:30:00Z"
}
```
