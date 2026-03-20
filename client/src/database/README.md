# 数据库结构文档

## 📁 文档结构

```
database/
├── README.md                    # 本文件 - 总览
├── 业务流程分析.md               # 业务流程和数据流转分析
├── ERD-数据表关系图.md          # 实体关系图
└── tables/                      # 数据表详细文档
    ├── 01-Client.md            # 客户表
    ├── 02-MasterOrder.md       # 主订单表
    ├── 03-SubOrder.md          # 子订单表
    ├── 04-InboundRecord.md     # 入库记录表
    ├── 05-SeaContainer.md      # 海运集装箱表
    ├── 06-AirUnit.md           # 空运货物表
    ├── 07-Job.md               # 运输任务表
    └── 08-Fee.md               # 费用表
```

---

## 📊 核心数据表概览

### 1. Client（客户表）
- **主键**: id
- **用途**: 存储客户基本信息、联系方式、物流信息
- **关联**: 1:N → MasterOrder

### 2. MasterOrder（主订单表）
- **主键**: id
- **外键**: clientId → Client.id
- **用途**: 存储主订单信息，可拆分为多个子订单
- **关联**: N:1 → Client, 1:N → SubOrder

### 3. SubOrder（子订单表）
- **主键**: id
- **外键**: masterOrderId → MasterOrder.id, shippingUnitId → ShippingUnit.id
- **用途**: 存储子订单信息，对应一个快递包裹
- **关联**: N:1 → MasterOrder, 1:N → InboundRecord, N:1 → ShippingUnit

### 4. InboundRecord（入库记录表）
- **主键**: id
- **外键**: subOrderId → SubOrder.id
- **用途**: 记录快递包裹的入库信息
- **关联**: N:1 → SubOrder

### 5. SeaContainer（海运集装箱表）
- **主键**: id
- **外键**: jobNo → Job.jobNo
- **用途**: 存储海运集装箱信息和装载情况
- **关联**: 1:N → SubOrder, N:1 → Job

### 6. AirUnit（空运货物表）
- **主键**: id
- **外键**: jobNo → Job.jobNo
- **用途**: 存储空运货物单元信息
- **关联**: 1:N → SubOrder, N:1 → Job

### 7. Job（运输任务表）
- **主键**: jobNo
- **用途**: 管理运输任务，包含多个运输单元
- **关联**: 1:N → ShippingUnit, 1:N → Fee

### 8. Fee（费用表）
- **主键**: id
- **外键**: jobNo → Job.jobNo
- **用途**: 存储运输任务相关的各类费用
- **关联**: N:1 → Job

---

## 🔗 数据流转路径

```
客户下单:
Client → MasterOrder → SubOrder

快递入库:
SubOrder → InboundRecord

装箱/打板:
SubOrder → ShippingUnit (SeaContainer 或 AirUnit)

创建任务:
ShippingUnit → Job

费用管理:
Job → Fee
```

---

## 🎯 关键约束

### 唯一性约束
- `Client.shortCode` - 客户简码唯一
- `MasterOrder.orderNo` - 主运单号唯一
- `SubOrder.subOrderNo` - 子运单号唯一
- `SubOrder.trackingNo` - 快递单号唯一
- `SeaContainer.containerNo` - 集装箱号唯一
- `AirUnit.unitNo` - 空运单元编号唯一
- `Job.jobNo` - 任务编号唯一

### 数据一致性约束
1. **订单与运输单元**:
   - `SubOrder.shippingUnitId` ⇄ `ShippingUnit.orderIds[]` 双向一致

2. **运输单元与任务**:
   - `ShippingUnit.jobNo` ⇄ `Job.shippingUnitIds[]` 双向一致

3. **任务订单汇总**:
   - `Job.orderIds[]` 必须从所有 `shippingUnitIds[]` 汇总得出
   - `Job.stats` 必须与实际装载数据一致

---

## 📖 使用说明

### 查看数据表详情
每个数据表都有独立的文档，包含：
- 完整字段定义
- 枚举类型说明
- 索引建议
- 关联关系
- 示例数据
- 业务规则

### 数据一致性检查
参考 `业务流程分析.md` 中的"数据一致性检查结果"部分。

### ERD 图
参考 `ERD-数据表关系图.md` 查看完整的实体关系图。

---

## ✅ 已完成的工作

1. ✅ 完整的业务流程分析
2. ✅ 数据表关系图（ERD）
3. ✅ 8个核心数据表的详细文档
4. ✅ 数据一致性检查和修复
5. ✅ 海运和空运运输单元的类型分离

---

## 📝 文档版本

- **创建日期**: 2024-01-15
- **最后更新**: 2024-01-15
- **版本**: v1.0
- **状态**: 已完成
