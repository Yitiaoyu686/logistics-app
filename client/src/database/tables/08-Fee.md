# Fee - 费用表

## 📋 表说明

**表名**: `Fee`
**所属模块**: Finance（财务管理）
**用途**: 存储运输任务相关的各类费用信息

---

## 🔑 字段定义

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | string | PK, NOT NULL | - | 费用唯一标识 |
| jobNo | string | FK, NOT NULL | - | 任务编号（外键） |
| feeType | string | NOT NULL | - | 费用类型 |
| amount | number | NOT NULL | - | 金额 |
| currency | string | NOT NULL | 'CNY' | 币种 |
| status | enum | NOT NULL | 'PENDING' | 费用状态 |
| approver | string | NULL | - | 审批人 |
| payer | string | NULL | - | 付款人 |
| paymentDate | string | NULL | - | 付款日期 |
| remark | string | NULL | - | 备注信息 |
| createdAt | string | NOT NULL | - | 创建时间 |
| updatedAt | string | NULL | - | 更新时间 |

---

## 📊 枚举类型定义

### FeeStatus（费用状态）
```typescript
type FeeStatus =
  | 'PENDING'   // 待审批
  | 'APPROVED'  // 已审批
  | 'PAID'      // 已支付
  | 'REJECTED'; // 已拒绝
```

### FeeType（费用类型）
常见费用类型包括：
- 运费（海运费/空运费）
- 报关费
- 仓储费
- 装卸费
- 文件费
- 其他杂费

---

## 🔍 索引建议

### 主键索引
- `PRIMARY KEY (id)`

### 外键索引
- `INDEX idx_fee_jobno (jobNo)`

### 普通索引
- `INDEX idx_fee_status (status)`
- `INDEX idx_fee_type (feeType)`
- `INDEX idx_fee_created (createdAt)`

---

## 🔗 关联关系

### 对内关系
- **N:1 → Job**: 多个费用项属于一个运输任务
  - 外键: `jobNo` → `Job.jobNo`

---

## 📝 示例数据

```json
{
  "id": "FEE-001",
  "jobNo": "JOB-SZX-LAX-231028",
  "feeType": "海运费",
  "amount": 45000,
  "currency": "CNY",
  "status": "APPROVED",
  "approver": "财务经理",
  "payer": "张运营",
  "paymentDate": "2024-01-25T10:00:00Z",
  "remark": "3个40HQ集装箱运费",
  "createdAt": "2024-01-20T09:00:00Z",
  "updatedAt": "2024-01-22T14:30:00Z"
}
```

---

## 💡 业务规则

1. **费用状态流转**:
   - PENDING（待审批）→ APPROVED（已审批）→ PAID（已支付）
   - 或 PENDING → REJECTED（已拒绝）

2. **审批流程**:
   - 费用创建后状态为 PENDING
   - 需要财务人员审批
   - 审批通过后状态变为 APPROVED

3. **付款管理**:
   - 审批通过后才能付款
   - 付款时记录 `payer` 和 `paymentDate`
   - 状态变更为 PAID
