# Client - 客户表

## 📋 表说明

**表名**: `Client`
**所属模块**: CRM（客户关系管理）
**用途**: 存储客户基本信息、联系方式、物流信息等

---

## 🔑 字段定义

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | string | PK, NOT NULL | - | 客户唯一标识 |
| shortCode | string | UNIQUE, NOT NULL | - | 客户简码（用于快速识别） |
| name | string | NOT NULL | - | 客户名称/公司名称 |
| country | string | NOT NULL | - | 所属国家 |
| status | enum | NOT NULL | '活跃' | 客户状态：活跃/沉睡/冻结 |
| poolType | enum | NOT NULL | '公海' | 客户池类型：公海/私海 |
| totalOrders | number | NOT NULL | 0 | 累计订单数 |
| lastOrderTime | string | NULL | - | 最后下单时间（ISO 8601） |
| createdAt | string | NOT NULL | - | 创建时间（ISO 8601） |
| contact | JSON | NOT NULL | - | 联系人信息对象 |
| industry | string | NULL | - | 所属行业 |
| address | string | NULL | - | 详细地址 |
| source | string | NULL | - | 客户来源 |
| salesPerson | string | NULL | - | 负责销售人员 |
| remark | string | NULL | - | 备注信息 |
| companyType | string | NULL | - | 公司类型 |
| creditLevel | string | NULL | - | 信用等级 |
| logisticsInfo | JSON | NULL | - | 物流信息对象 |

---

## 📊 枚举类型定义

### ClientStatus（客户状态）
```typescript
type ClientStatus = '活跃' | '沉睡' | '冻结';
```

### ClientPoolType（客户池类型）
```typescript
type ClientPoolType = '私海' | '公海';
```

---

## 🔗 JSON 字段结构

### contact（联系人信息）
```typescript
interface ClientContact {
  name: string;        // 联系人姓名
  phone: string;       // 联系电话
  email?: string;      // 电子邮箱（可选）
}
```

### logisticsInfo（物流信息）
```typescript
interface LogisticsInfo {
  senderName?: string;           // 发件人姓名
  senderPhone?: string;          // 发件人电话
  senderAddress?: string;        // 发件人地址
  senderCity?: string;           // 发件人城市
  senderCountry?: string;        // 发件人国家
  consigneeName?: string;        // 收件人姓名
  consigneePhone?: string;       // 收件人电话
  consigneeAddress?: string;     // 收件人地址
  consigneeCity?: string;        // 收件人城市
  consigneeCountry?: string;     // 收件人国家
  consigneeZipCode?: string;     // 收件人邮编
  preferredTransportType?: string;  // 偏好运输方式
  preferredRoute?: string;       // 偏好路线
  preferredServiceType?: string; // 偏好服务类型
  paymentMethod?: string;        // 付款方式
}
```

---

## 🔍 索引建议

### 主键索引
- `PRIMARY KEY (id)`

### 唯一索引
- `UNIQUE INDEX idx_client_shortcode (shortCode)`

### 普通索引
- `INDEX idx_client_pooltype (poolType)` - 用于公海/私海筛选
- `INDEX idx_client_salesperson (salesPerson)` - 用于按销售人员查询
- `INDEX idx_client_status (status)` - 用于按状态筛选
- `INDEX idx_client_created (createdAt)` - 用于按创建时间排序

---

## 🔗 关联关系

### 对外关系
- **1:N → MasterOrder**: 一个客户可以创建多个主订单
  - 关联字段: `MasterOrder.clientId` → `Client.id`

---

## 📝 示例数据

```json
{
  "id": "C1",
  "shortCode": "SZ01",
  "name": "深圳大疆贸易有限公司",
  "country": "中国",
  "status": "活跃",
  "poolType": "私海",
  "totalOrders": 50,
  "lastOrderTime": "2024-01-15T10:30:00Z",
  "createdAt": "2023-01-10T08:00:00Z",
  "contact": {
    "name": "张经理",
    "phone": "13800138001",
    "email": "zhang@dji-trade.com"
  },
  "industry": "电商",
  "address": "深圳市龙岗区科技园",
  "source": "展会",
  "salesPerson": "李销售",
  "remark": "长期合作客户",
  "companyType": "有限公司",
  "creditLevel": "A",
  "logisticsInfo": {
    "senderName": "张经理",
    "senderPhone": "13800138001",
    "senderAddress": "深圳市龙岗区科技园",
    "senderCity": "深圳",
    "senderCountry": "中国",
    "preferredTransportType": "海运",
    "preferredRoute": "深圳→洛杉矶",
    "paymentMethod": "微信支付"
  }
}
```

---

## 💡 业务规则

1. **客户池管理**:
   - 新客户默认进入公海池（`poolType = '公海'`）
   - 销售认领后转入私海（`poolType = '私海'`，设置 `salesPerson`）
   - 私海客户长期未下单可能回到公海

2. **客户状态**:
   - 活跃：近期有订单或活跃沟通
   - 沉睡：超过一定时间未下单（如180天）
   - 冻结：因信用问题或其他原因被冻结

3. **shortCode 生成规则**:
   - 通常由城市缩写+序号组成（如 SZ01, SH05）
   - 必须唯一，用于快速识别客户

4. **totalOrders 更新**:
   - 每次创建新订单时自动累加
   - `lastOrderTime` 同步更新为最新订单时间
