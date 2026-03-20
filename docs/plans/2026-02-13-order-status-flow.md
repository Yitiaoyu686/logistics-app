# 订单状态流转逻辑文档

> 最后更新：2026-02-13

---

## 一、主订单状态（MasterOrderStatus）- 11种

| 状态值 | 中文名称 | 说明 |
|--------|----------|------|
| `PENDING_INBOUND` | 待入库 | 新建订单初始状态 |
| `INBOUND` | 已入库 | 货物已到达起运国仓库 |
| `PENDING_DEPARTURE` | 待出发 | 货物已装箱，等待发运 |
| `DEPARTED` | 已出发 | 货物已离开起运港 |
| `IN_TRANSIT` | 运输中 | 货物在途中 |
| `ARRIVED` | 已到达 | 货物到达目的港 |
| `PARTIAL_DELIVERED` | 部分签收 | 部分子订单已签收 |
| `COMPLETED` | 已完成 | 所有子订单已签收 |
| `EXCEPTION` | 异常 | 订单出现异常 |
| `RETURN_APPLIED` | 退单申请中 | 已申请退单，待审核 |
| `CANCELLED` | 已取消 | 订单已取消 |

### 主订单状态流转图

```
正常流程：
PENDING_INBOUND → INBOUND → PENDING_DEPARTURE → DEPARTED → IN_TRANSIT → ARRIVED → PARTIAL_DELIVERED → COMPLETED

异常分支：
任意状态 → EXCEPTION（出现异常时）
任意状态 → RETURN_APPLIED → CANCELLED（退单流程）
PENDING_INBOUND → CANCELLED（直接取消，仅限待入库状态）
```

### 主订单状态自动计算规则

主订单状态由其所有子订单状态自动计算（`calculateMasterOrderStatus()` in `/client/src/utils/orderUtils.ts`）：

| 条件 | 主订单状态 |
|------|-----------|
| 所有子订单为 CANCELLED | CANCELLED |
| 任一子订单为 EXCEPTION | EXCEPTION |
| 任一子订单为 RETURN_APPLIED | RETURN_APPLIED |
| 所有子订单为 DELIVERED | COMPLETED |
| 部分子订单为 DELIVERED | PARTIAL_DELIVERED |
| 任一子订单为 DEST_DELIVERING | ARRIVED |
| 任一子订单为 DEST_WAREHOUSED | ARRIVED |
| 任一子订单为 CUSTOMS_CLEARED | ARRIVED |
| 任一子订单为 ARRIVED_DEST | ARRIVED |
| 任一子订单为 IN_TRANSIT | IN_TRANSIT |
| 任一子订单为 DEPARTED | DEPARTED |
| 任一子订单为 PENDING_DEPARTURE | PENDING_DEPARTURE |
| 任一子订单为 WAREHOUSED / PACKED / LOADED | INBOUND |
| 默认 | PENDING_INBOUND |

---

## 二、子订单状态（SubOrderStatus）- 14种

| 状态值 | 中文名称 | 说明 |
|--------|----------|------|
| `PENDING_INBOUND` | 待入库 | 子订单创建后初始状态 |
| `WAREHOUSED` | 已入库 | 货物已入库 |
| `PACKED` | 已装箱 | 货物已装入集装箱/航空箱 |
| `LOADED` | 已装载 | 货物已装载到运输工具 |
| `PENDING_DEPARTURE` | 待出发 | 等待发运 |
| `DEPARTED` | 已出发 | 已离开起运港 |
| `IN_TRANSIT` | 运输中 | 在途中 |
| `ARRIVED_DEST` | 已到达目的地 | 到达目的港/目的国 |
| `CUSTOMS_CLEARED` | 已清关 | 完成海关清关 |
| `DEST_WAREHOUSED` | 目的仓入库 | 到达目的仓库并入库 |
| `DEST_DELIVERING` | 派送中 | 正在派送给收件人 |
| `DELIVERED` | 已签收 | 收件人已签收 |
| `EXCEPTION` | 异常 | 出现异常 |
| `RETURN_APPLIED` | 退单申请中 | 退单待审核 |

### 子订单状态流转图

```
完整物流链路：
PENDING_INBOUND → WAREHOUSED → PACKED → LOADED → PENDING_DEPARTURE → DEPARTED → IN_TRANSIT → ARRIVED_DEST → CUSTOMS_CLEARED → DEST_WAREHOUSED → DEST_DELIVERING → DELIVERED

异常分支：
任意状态 → EXCEPTION
任意状态 → RETURN_APPLIED（退单申请）
```

---

## 三、快递包裹状态 - 4种

| 状态值 | 中文名称 | 说明 |
|--------|----------|------|
| `PENDING` | 待收件 | 快递包裹已创建 |
| `RECEIVED` | 已签收 | 仓库已签收包裹 |
| `STORED` | 已入库 | 包裹已存入仓库 |
| `ASSIGNED` | 已分配 | 包裹已分配到子订单 |

```
PENDING → RECEIVED → STORED → ASSIGNED
```

---

## 四、拆单状态（SplitStatus）- 3种

| 状态值 | 中文名称 | 说明 |
|--------|----------|------|
| `UNSPLIT` / `PENDING` | 未拆单 | 主订单未进行拆单 |
| `SPLITTING` / `PARTIAL` | 拆单中 | 主订单正在拆分 |
| `SPLIT_DONE` / `COMPLETED` | 拆单完成 | 主订单拆分完毕 |

---

## 五、支付状态（PaymentStatus）- 3种

| 状态值 | 中文名称 | 说明 |
|--------|----------|------|
| `UNPAID` | 未付款 | 未支付费用 |
| `PARTIAL` | 部分付款 | 已支付部分费用 |
| `PAID` | 已付款 | 费用全部支付完成 |

---

## 六、物流节点（LogisticsStep）- 13个

按顺序排列的物流追踪节点：

| 序号 | 节点值 | 中文名称 |
|------|--------|----------|
| 1 | `ORDER_CREATED` | 下单 |
| 2 | `WAREHOUSE_RECEIVED` | 仓库收货 |
| 3 | `WAREHOUSE_STORED` | 入库上架 |
| 4 | `PACKING` | 装箱打包 |
| 5 | `CUSTOMS_DECLARE` | 报关 |
| 6 | `DEPARTED` | 出发 |
| 7 | `IN_TRANSIT` | 运输中 |
| 8 | `ARRIVED_PORT` | 到达港口 |
| 9 | `CUSTOMS_CLEARANCE` | 清关 |
| 10 | `DEST_WAREHOUSE` | 到达仓库 |
| 11 | `LAST_MILE` | 末端派送 |
| 12 | `DELIVERED` | 签收 |
| 13 | `COMPLETED` | 完成 |

---

## 七、退单流程

### 退单申请
- **入口**：订单详情页 → 申请退单
- **条件**：订单非 COMPLETED / CANCELLED / RETURN_APPLIED 状态
- **操作**：将子订单状态改为 `RETURN_APPLIED`

### 退单审核（OrderListV2）
- **审核通过**：子订单状态 → `CANCELLED`，主订单状态重新计算
- **审核拒绝**：子订单状态恢复为 `PENDING_INBOUND`

### 直接取消
- **条件**：仅限 `PENDING_INBOUND` 状态的订单
- **操作**：直接将子订单状态改为 `CANCELLED`

---

## 八、入库记录状态（InboundStatus）- 4种

| 状态值 | 中文名称 |
|--------|----------|
| `PENDING` | 待处理 |
| `PROCESSING` | 处理中 |
| `COMPLETED` | 已完成 |
| `ABNORMAL` | 异常 |

---

## 九、关键代码位置

| 文件 | 作用 |
|------|------|
| `/client/src/types/order.ts` | 状态枚举定义、颜色配置 |
| `/client/src/types/core.ts` | 核心类型定义（OrderStatus, SubOrderStatus） |
| `/client/src/utils/orderUtils.ts` | `calculateMasterOrderStatus()` 自动计算逻辑 |
| `/client/src/pages/oms/OrderListV2.tsx` | 退单审核、取消操作 |
| `/client/src/pages/oms/MasterOrderDetailDrawer.tsx` | 退单申请入口 |
| `/server/src/database/schema.ts` | 数据库状态约束 |
| `/server/src/routes/orders.ts` | 状态变更 API |
