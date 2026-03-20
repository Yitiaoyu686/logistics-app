# Product Overview

喵喵国际物流管理系统（MiaoMiao Logistics）—— 跨境物流全链路管理平台，面向国际海运/空运货代公司内部运营团队。

**项目定位**: 产品经理需求 Demo 原型，以可交互界面演示为目标，非生产级应用。后端 SQLite 已连接提供真实 CRUD，重点关注视觉还原度、交互动效和界面流转完整性。

## Core Capabilities

1. **全链路物流管理**: CRM → 订单(OMS) → 仓储(WMS) → 运输(TMS) → 财务 → 数据分析，覆盖跨境物流完整业务流程
2. **空运/海运双业务线**: 页面级 Segmented 切换器区分空运(AIR)和海运(SEA)业务，计费规则、表单字段、运输单元各自独立
3. **角色权限体系**: 8 种角色（管理员、销售、中国仓库、中国运营、美国运营、美国仓库、财务、老板）按权限过滤菜单和操作
4. **中非双仓协同**: 起运国仓（中国广州）入库-装柜-发运，到达国仓（尼日利亚拉各斯）清关-入库-派送，全流程可视化
5. **RuoYi-Vue 风格后台**: 左侧深色菜单 + 顶部面包屑 + 卡片式 Tab 页签

## Target Use Cases

- **销售人员**: 客户管理、报价计算、订单跟踪（空运/海运切换）、提成查看
- **仓库操作员**: 扫码入库、库存管理、装柜/装板、退件处理（按空运/海运筛选）
- **起运国运营**: Job 管理、出口跟踪、JOB成本录入、应收管理
- **到达国运营**: 进口跟踪、创建DPN、通知客户、DPN成本
- **财务人员**: 费用录入/审核、应收应付（支持全部/空运/海运三态筛选）
- **管理层**: 经营看板、利润分析、客户价值分析（三态筛选）

## Value Proposition

一站式跨境物流 ERP/TMS，将分散在 Excel 和多系统中的物流业务整合到统一平台，实现业务数据流转和角色协同。

## Key Entity Relationships

```
Client → MasterOrder (1:N)
MasterOrder → SubOrder (1:N)
SubOrder → ShippingUnit (N:1, 装柜/装板)
ShippingUnit → Job (N:1, 运输任务)
```

---
_Focus on patterns and purpose, not exhaustive feature lists_
