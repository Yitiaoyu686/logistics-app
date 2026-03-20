# Research & Design Decisions

## Summary
- **Feature**: `sales-commission-bonus-system`
- **Discovery Scope**: Extension（重构现有提成规则管理和提成计算两个模块）
- **Key Findings**:
  - 现有 CommissionRuleManagement.tsx（1137行）使用通用规则模型（PERCENTAGE/TIERED/FIXED/HYBRID），不支持4套差异化方案，需完全重写数据模型和表单
  - 现有 CommissionCalculation.tsx（849行）按单个JOB计算提成，不支持月度汇总、方案匹配、绩效追踪，需重构为月度聚合计算模式
  - 已成功验证的模式：freightCalc.ts 工具库模式（纯函数 + 类型定义 + 默认配置），可复用到提成计算领域

## Research Log

### 现有代码分析

- **Context**: 分析现有两个组件的架构、数据模型和扩展点
- **Sources Consulted**: CommissionRuleManagement.tsx, CommissionCalculation.tsx, App.tsx
- **Findings**:
  - `CommissionRuleManagement` 使用空数组初始化 `useState<CommissionRule[]>([])`，无 Mock 数据
  - 规则类型 `CommissionRuleType = 'PERCENTAGE' | 'TIERED' | 'FIXED' | 'HYBRID'` 与需求中的4套方案完全不匹配
  - 表单结构为通用阶梯配置，不支持双指标互锁、多币种、体积/重量等特化字段
  - `CommissionCalculation` 按单个JOB为粒度，关联单个规则，无月度汇总能力
  - 审批流程（PENDING → APPROVED → PAID）可保留并增强
  - 两个组件的类型均定义在文件内部，不在共享 types/ 中
- **Implications**: 数据模型需完全重新设计；UI组件保留整体布局模式但内容需重构；审批流程可复用

### App.tsx 集成点

- **Context**: 确认菜单注册和角色控制
- **Findings**:
  - `fin_commission`（销售提成）和 `fin_commission_rules`（提成规则）已注册在财务模块
  - `fin_commission_rules` 限制 `['ADMIN', 'BOSS']`，需求要求增加 FINANCE 角色
  - 导入路径：`./pages/finance/CommissionRuleManagement` 和 `./pages/finance/CommissionCalculation`
- **Implications**: 保持现有 tab key 和导入路径不变，仅需修改 roles 数组

### freightCalc.ts 工具库模式验证

- **Context**: 评估是否可复用 air-freight-billing-rules 中验证通过的架构模式
- **Findings**:
  - 纯函数 + TypeScript 接口 + 默认配置常量 的模式已成功实施
  - 工具库独立于UI，支持 useMemo 实时联动
  - 返回结构化 Breakdown 对象，UI 层按需渲染
- **Implications**: 提成计算工具库 `commissionCalc.ts` 采用相同模式

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 策略模式工具库 | 每套方案一个纯计算函数，由调度函数按方案类型路由 | 类型安全、可测试、各方案独立 | 函数数量较多 | 与 freightCalc.ts 一致 |
| 单一组件重构 | 在现有文件上增量修改 | 改动范围可控 | 现有模型完全不兼容，增量修改反而更复杂 | 不推荐 |

## Design Decisions

### Decision: 方案类型枚举替代通用规则类型
- **Context**: 现有 PERCENTAGE/TIERED/FIXED/HYBRID 无法表达4套方案+彩蛋奖金
- **Alternatives Considered**:
  1. 扩展现有类型增加字段 — 导致大量可选字段和条件逻辑
  2. 全新方案类型枚举 — 每种方案有独立的配置接口
- **Selected Approach**: 方案类型枚举 `PLAN_A_ABCD | PLAN_B_SEA_VETERAN | PLAN_C_NIGERIA_SEA | PLAN_D_NIGERIA_AIR | BONUS_EASTER_EGG`
- **Rationale**: 各方案计算逻辑差异极大，统一接口反而增加复杂度
- **Trade-offs**: 新增方案需要新增类型和计算函数；但方案数量有限（5种）

### Decision: 月度聚合计算替代逐单计算
- **Context**: 现有按单个JOB计算，需求要求按月汇总
- **Selected Approach**: 月度聚合模型，先汇总员工当月所有JOB数据，再按绑定方案计算
- **Rationale**: 双指标互锁、彩蛋奖金等规则都依赖月度汇总数据

### Decision: 多币种支持
- **Context**: 方案三/四使用 NGN，方案一/二使用 CNY
- **Selected Approach**: 计算结果包含 currency 字段，UI 层根据币种显示对应符号
- **Rationale**: Demo 原型无需汇率换算，只需正确标注币种

## Risks & Mitigations
- 组件文件行数可能较大 → 按职责拆分（工具库、规则管理、计算页面）
- 4套方案的Mock数据设计复杂 → 提供完整的默认配置常量和示例数据
- 应收款校验和坏账扣减逻辑较抽象 → Mock 数据中直接标注状态字段
