# 数据表关系图（ERD）

## 📊 完整实体关系图

```
┌─────────────────┐
│     Client      │ 客户表
│  (客户中心)      │
├─────────────────┤
│ PK: id          │
│    shortCode    │
│    name         │
│    poolType     │
│    salesPerson  │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────┐
│  MasterOrder    │ 主订单表
│  (订单中心)      │
├─────────────────┤
│ PK: id          │
│ FK: clientId    │
│    orderNo      │
│    totalAmount  │
│    status       │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────┐
│   SubOrder      │ 子订单表
│  (订单中心)      │
├─────────────────┤
│ PK: id          │
│ FK: masterOrderId│
│ FK: shippingUnitId│
│    subOrderNo   │
│    trackingNo   │
│    weight       │
│    volume       │
│    pieces       │
│    status       │
└────┬────────┬───┘
     │ 1      │ N
     │        │
     │ N      │ 1
┌────▼─────┐  │
│ Inbound  │  │
│ Record   │  │
│(起运国仓储)│  │
├──────────┤  │
│ PK: id   │  │
│ FK: subOrderId│
│ trackingNo│  │
│ actualWeight│ │
│ actualVolume│ │
│ inboundTime│  │
└──────────┘  │
              │
         ┌────▼────────────────┐
         │  ShippingUnit       │ 运输单元（抽象）
         │  (仓储/运输)         │
         └──────┬──────────────┘
                │
        ┌───────┴───────┐
        │               │
┌───────▼──────┐ ┌──────▼──────┐
│ SeaContainer │ │   AirUnit   │
│  (海运集装箱) │ │  (空运货物)  │
├──────────────┤ ├─────────────┤
│ PK: id       │ │ PK: id      │
│ FK: jobNo    │ │ FK: jobNo   │
│ containerNo  │ │ unitNo      │
│ containerType│ │ unitType    │
│ sealNo       │ │ mawb/hawb   │
│ orderIds[]   │ │ orderIds[]  │
│ status       │ │ status      │
└──────┬───────┘ └──────┬──────┘
       │ N              │ N
       │                │
       └────────┬───────┘
                │ 1
         ┌──────▼──────┐
         │     Job     │ 运输任务表
         │  (干线运输)  │
         ├─────────────┤
         │ PK: jobNo   │
         │ route       │
         │ pol/pod     │
         │ carrier     │
         │ vesselVoyage│ (海运)
         │ flightNo    │ (空运)
         │ transportType│
         │ etd/eta     │
         │ shippingUnitIds[]│
         │ orderIds[]  │
         │ status      │
         └──────┬──────┘
                │ 1
                │
                │ N
         ┌──────▼──────┐
         │     Fee     │ 费用表
         │  (财务中心)  │
         ├─────────────┤
         │ PK: id      │
         │ FK: jobNo   │
         │ feeType     │
         │ amount      │
         │ currency    │
         │ status      │
         └─────────────┘
```

## 🔗 关系说明

### 1. Client → MasterOrder (1:N)
- 一个客户可以创建多个主订单
- 外键: `MasterOrder.clientId` → `Client.id`

### 2. MasterOrder → SubOrder (1:N)
- 一个主订单可以拆分为多个子订单
- 外键: `SubOrder.masterOrderId` → `MasterOrder.id`

### 3. SubOrder → InboundRecord (1:N)
- 一个子订单可以有多次入库记录（分批入库）
- 外键: `InboundRecord.subOrderId` → `SubOrder.id`

### 4. SubOrder → ShippingUnit (N:1)
- 多个子订单装入一个运输单元
- 外键: `SubOrder.shippingUnitId` → `ShippingUnit.id`
- 反向引用: `ShippingUnit.orderIds[]` 包含所有装载的子订单ID

### 5. ShippingUnit → Job (N:1)
- 多个运输单元绑定到一个运输任务
- 外键: `ShippingUnit.jobNo` → `Job.jobNo`
- 反向引用: `Job.shippingUnitIds[]` 包含所有绑定的运输单元ID

### 6. Job → Fee (1:N)
- 一个运输任务产生多个费用项
- 外键: `Fee.jobNo` → `Job.jobNo`

## 📋 数据流转路径

### 完整业务流程的数据流转：

```
1. 客户下单
   Client → MasterOrder → SubOrder

2. 快递预报入库
   SubOrder → InboundRecord (扫码入库)

3. 装箱/打板
   SubOrder → ShippingUnit (SeaContainer 或 AirUnit)
   更新: SubOrder.shippingUnitId
   更新: ShippingUnit.orderIds[]

4. 创建运输任务
   ShippingUnit → Job
   更新: ShippingUnit.jobNo
   更新: Job.shippingUnitIds[]
   汇总: Job.orderIds[] (从所有运输单元汇总)

5. 费用管理
   Job → Fee (运费、报关费、仓储费等)
```

## 🎯 关键约束

### 唯一性约束
- `Client.shortCode` - 客户简码唯一
- `MasterOrder.orderNo` - 主运单号唯一
- `SubOrder.subOrderNo` - 子运单号唯一
- `SubOrder.trackingNo` - 快递单号唯一
- `SeaContainer.containerNo` - 集装箱号唯一
- `AirUnit.unitNo` - 空运单元编号唯一
- `Job.jobNo` - 任务编号唯一

### 外键约束
- `MasterOrder.clientId` 必须存在于 `Client.id`
- `SubOrder.masterOrderId` 必须存在于 `MasterOrder.id`
- `SubOrder.shippingUnitId` 可选，存在时必须有效
- `InboundRecord.subOrderId` 必须存在于 `SubOrder.id`
- `ShippingUnit.jobNo` 可选，存在时必须有效
- `Fee.jobNo` 必须存在于 `Job.jobNo`

### 业务约束
- 子订单只能装入一个运输单元
- 运输单元只能绑定到一个任务
- 运输单元的 `orderIds[]` 必须与实际装载的子订单一致
- 任务的 `orderIds[]` 必须从所有运输单元汇总得出
- 任务的统计数据必须与实际装载数据一致
