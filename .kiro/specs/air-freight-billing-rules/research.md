# Research & Design Decisions

## Summary
- **Feature**: `air-freight-billing-rules`
- **Discovery Scope**: Extension（扩展现有 FreightRateRule 模块）
- **Key Findings**:
  - `FreightRateRule.tsx`（745行）已实现空运计费重量和海运拼箱计费体积的基础判定，可直接扩展
  - `PriceCalculator.tsx`（163行）为多渠道比价工具（调后端API），定位不同，不做改动
  - 核心缺失：重量进位、首重续重阶梯、附加费、混装逻辑，均为纯前端计算，无需后端

## Research Log

### 现有 FreightRateRule 组件分析
- **Context**: 评估现有组件可复用程度
- **Sources Consulted**: `client/src/pages/system/FreightRateRule.tsx`
- **Findings**:
  - 已有 `ChargeCalculator` 子组件，含空运（尺寸→体积重→计费重）和海运拼箱（密度→轻/重货→计费体积）计算
  - 规则 CRUD：`FreightRateRule` 接口含 transportMode、volumetricDivisor、volumeWeightRatio、unitPrice、minCharge 等字段
  - Mock 数据 4 条规则（FR001-FR004），含空运和海运拼箱
  - 缺失：无阶梯价格数组、无附加费率、无品类字段、无进位逻辑
- **Implications**: ChargeCalculator 是主要扩展点，需增加运费金额计算输出；规则接口需扩展阶梯和附加费字段

### 计费逻辑复杂度评估
- **Context**: 评估计算逻辑是否应提取为独立工具函数
- **Findings**:
  - 空运计费涉及 5 步串联：计费重量判定 → 进位 → 首重续重阶梯 → 附加费 → 混装判定
  - 各步骤为纯函数（输入确定→输出确定），适合提取到 utils
  - 海运拼箱计费已在 ChargeCalculator 中实现，仅需最终乘以单价
- **Implications**: 创建 `utils/freightCalc.ts` 提取纯计算逻辑，UI 组件调用并展示结果

### App.tsx 菜单集成
- **Context**: 确认现有页面入口
- **Findings**:
  - FreightRateRule 挂在系统设置 → 基础数据 → `set_base_rate`（运费规则），ADMIN 可见
  - PriceCalculator 挂在 CRM → `crm_price`，SALES 可见
  - 增强 ChargeCalculator 不需要新增菜单项
- **Implications**: 无需修改 App.tsx 菜单配置

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 扩展 FreightRateRule | 在现有组件中增加阶梯/附加费/混装 UI 和逻辑 | 最少新文件，复用现有 CRUD 和 Calculator | 文件可能从745行增至1200+ | 可通过提取子组件缓解 |
| 新建独立页面 | 创建全新 BillingCalculator 组件 | 职责清晰 | 与现有规则管理脱节 | 不推荐 |
| **混合方案（推荐）** | 提取计算逻辑到 utils，扩展现有 UI | 逻辑可复用，UI 不臃肿 | 需拆分现有 ChargeCalculator | 最佳平衡 |

## Design Decisions

### Decision: 计算逻辑提取到 freightCalc.ts
- **Context**: 计费逻辑（进位、阶梯、附加费）需要在 ChargeCalculator 和潜在的其他场景（订单创建、费用估算）中复用
- **Alternatives Considered**:
  1. 逻辑内联在 ChargeCalculator 组件中
  2. 提取到独立 utils/freightCalc.ts
- **Selected Approach**: 提取到 `utils/freightCalc.ts`
- **Rationale**: 纯函数易于测试和复用，符合项目 utils 模式（已有 orderUtils.ts, jobUtils.ts）
- **Trade-offs**: 多一个文件，但逻辑清晰可复用

### Decision: 扩展现有 FreightRateRule 接口而非新建
- **Context**: 需要存储阶梯价格和附加费率配置
- **Selected Approach**: 在现有 `FreightRateRule` 接口上增加可选字段（阶梯数组、附加费率 Map）
- **Rationale**: 保持与现有 CRUD 的兼容性，现有规则数据无需迁移
- **Trade-offs**: 接口变大但通过可选字段保持后向兼容

## Risks & Mitigations
- FreightRateRule.tsx 行数膨胀 → 将 ChargeCalculator 提取为独立子组件文件
- Mock 数据需同步更新 → 在 MOCK_RULES 中追加阶梯和附加费字段
- 进位规则边界case → 在 freightCalc.ts 中通过详细的边界处理覆盖
