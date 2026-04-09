# 客户企业资质信息需求文档

## 项目描述

在现有 CRM 客户管理模块中新增"企业资质信息"区域。客户分三种类型：中国企业（COMPANY_CN，固定字段）、海外企业（COMPANY_OVERSEAS，基础字段 + 自定义字段）、个人（INDIVIDUAL，证件信息）。所有类型共享通用银行信息字段，并支持上传证照文件。本项目为 Demo 原型，文件上传使用 Mock 方式。

> 实现位置：`client/src/pages/crm/CRMModules.tsx` 的 `CustomerFormDrawer` 与 `CustomerDetailDrawer`。

---

## 1. 业务需求

### 1.1 业务背景

客户的企业资质决定后续报关、开票、收付款等业务环节的实操方式。例如：

- 中国企业需要提供统一社会信用代码、开票信息以便开具增值税发票；
- 海外企业（如尼日利亚、加纳等目的国客户）的注册号、税号、证件信息字段差异大，需要灵活的自定义字段支撑；
- 个人客户主要使用身份证或护照办理业务，无需企业字段。

### 1.2 角色与场景

- 销售人员（SALES）：在新增/编辑客户时录入企业资质，确保后续创建订单可以引用准确的开票/报关信息；
- 起运国操作（OPS_CN）/管理员（ADMIN）：在客户详情页查看企业资质用于办理报关、开票等手续；
- 财务（FINANCE）：在订单详情中查看客户企业资质生成发票或处理收款。

### 1.3 触发时机

- **新增客户**：在 CRM 客户中心点击"新增客户"打开 Drawer 表单时，"企业资质信息"作为必填区块出现；
- **编辑客户**：在客户列表选择"编辑"后，可修改企业资质字段；
- **客户详情**：在客户详情 Drawer 的"基础资料"Tab 中以只读形式展示。

### 1.4 数据来源与去向

- **来源**：销售手动录入；
- **去向**：
  - 写入 `Client.enterpriseInfo` 字段；
  - OMS 订单详情、主单详情抽屉的"用户公司信息"区块直接读取展示；
  - 财务模块开票、对账场景引用。

---

## 2. 客户类型定义

| 枚举值 | 中文名称 | 适用场景 |
|--------|---------|---------|
| `COMPANY_CN` | 中国企业 | 国内主体，使用营业执照与统一社会信用代码 |
| `COMPANY_OVERSEAS` | 海外企业 | 海外主体（尼日利亚 / 加纳 / 美国 / 英国 / 其他），字段灵活可扩展 |
| `INDIVIDUAL` | 个人 | 个人主体，使用身份证或护照办理业务 |

> 客户类型字段为非必填，可保持"未设置"状态以兼容历史客户数据。

---

## 3. 表单字段

### 3.1 客户类型选择器

| 字段名 | 标签 | 组件 | 必填 | 说明 |
|--------|------|------|------|------|
| `enterpriseInfo.entityType` | 客户类型 | Select | 否 | 选项：中国企业 / 海外企业 / 个人；可清空 |

> 切换 entityType 时，下方动态字段区域会即时切换为对应的子表单。

### 3.2 中国企业字段（entityType = COMPANY_CN）

| 字段名 | 标签 | 组件 | 必填 | 校验规则 |
|--------|------|------|------|---------|
| `companyName` | 公司全称 | Input | 否 | - |
| `unifiedCreditCode` | 信用代码 | Input | 否 | 18 位字符（数字 + 大写字母），正则 `^[0-9A-Z]{18}$` |
| `legalRepresentative` | 法定代表人 | Input | 否 | - |
| `registeredAddress` | 注册地址 | Input | 否 | - |
| `taxpayerId` | 纳税人识别号 | Input | 否 | 通常与统一社会信用代码相同 |
| `invoiceAddress` | 开票地址 | Input | 否 | - |
| `invoicePhone` | 开票电话 | Input | 否 | - |
| `contactPhone` | 联系电话 | Input | 否 | - |
| `contactEmail` | 邮箱 | Input | 否 | - |

> 中国企业表单内部分为"基础信息 / 开票信息 / 联系方式"三个分隔区，使用 `Divider` 区分。

### 3.3 海外企业字段（entityType = COMPANY_OVERSEAS）

| 字段名 | 标签 | 组件 | 必填 | 说明 |
|--------|------|------|------|------|
| `overseasCompanyName` | 公司名称 | Input | 否 | Registered company name |
| `overseasCountry` | 注册国家 | Select | 否 | 尼日利亚 / 加纳 / 美国 / 英国 / 其他 |
| `overseasRegNumber` | 注册号 | Input | 否 | RC / BN / RGD Number |
| `overseasTaxNumber` | 税号 TIN | Input | 否 | Tax identification number |
| `overseasDirector` | 负责人 | Input | 否 | 负责人 / Owner name |
| `customFields[n].label` | 字段名 | Input | 是 | Form.List 动态字段，启用条目时必填 |
| `customFields[n].value` | 字段值 | Input | 是 | 同上 |

**业务规则：**

- `customFields` 使用 Ant Design `Form.List`，支持动态添加 / 删除自定义字段；
- 每条条目需要同时填写 `label` 与 `value`；
- 适用于不同国家（尼日利亚 CAC Number、美国 D-U-N-S Number 等）的扩展字段。

### 3.4 个人字段（entityType = INDIVIDUAL）

| 字段名 | 标签 | 组件 | 必填 | 选项 |
|--------|------|------|------|------|
| `realName` | 姓名 | Input | 否 | - |
| `idType` | 证件类型 | Select | 否 | 身份证（ID_CARD）/ 护照（PASSPORT） |
| `idNumber` | 证件号码 | Input | 否 | - |
| `contactPhone` | 联系电话 | Input | 否 | - |
| `contactEmail` | 邮箱 | Input | 否 | - |

### 3.5 通用银行信息（所有类型共享）

| 字段名 | 标签 | 组件 | 必填 | 说明 |
|--------|------|------|------|------|
| `bankName` | 开户银行 | Input | 否 | 仅在 entityType 已选择时显示 |
| `bankAccount` | 银行账号 | Input | 否 | 同上 |

> 银行信息区块仅在 `entityType` 非空时渲染；entityType 为空时整个银行信息区块隐藏。

---

## 4. 数据结构

```ts
interface EnterpriseInfo {
  entityType?: 'COMPANY_CN' | 'COMPANY_OVERSEAS' | 'INDIVIDUAL';

  // 中国企业
  companyName?: string;
  unifiedCreditCode?: string;
  legalRepresentative?: string;
  registeredAddress?: string;
  taxpayerId?: string;
  invoiceAddress?: string;
  invoicePhone?: string;

  // 海外企业
  overseasCompanyName?: string;
  overseasCountry?: string;
  overseasRegNumber?: string;
  overseasTaxNumber?: string;
  overseasDirector?: string;
  customFields?: Array<{ label: string; value: string }>;

  // 个人
  realName?: string;
  idType?: 'ID_CARD' | 'PASSPORT';
  idNumber?: string;

  // 通用联系方式
  contactPhone?: string;
  contactEmail?: string;

  // 通用银行信息
  bankName?: string;
  bankAccount?: string;
}
```

> `EnterpriseInfo` 作为 `Client.enterpriseInfo` 字段挂载到客户对象上；提交表单时若 `entityType` 为空则整个对象设置为 `undefined`。

---

## 5. 客户详情展示规则

在 `CustomerDetailDrawer` 的"基础资料"Tab 中，根据 `entityType` 渲染不同的 `Descriptions` 布局：

| entityType | 展示字段 |
|-----------|---------|
| `COMPANY_CN` | 公司全称、统一社会信用代码、法定代表人、注册地址、纳税人识别号、开票地址、开票电话、联系电话、联系邮箱、开户银行、银行账号 |
| `COMPANY_OVERSEAS` | 公司名称、注册国家、注册号、税号 TIN、负责人、自定义字段列表、开户银行、银行账号 |
| `INDIVIDUAL` | 真实姓名、证件类型、证件号码、联系电话、联系邮箱、开户银行、银行账号 |
| 未设置 | 显示 `Alert` 警告提示"未设置企业资质，可能影响开票/报关"，引导前往编辑客户补全 |

---

## 6. 与其它模块的联动

| 引用方 | 引用方式 |
|--------|---------|
| OMS 主单详情抽屉 `MasterOrderDetailDrawer` | "用户公司信息"区块按 entityType 渲染相同布局 |
| OMS 订单详情页 `OrderDetail` | 同上 |
| 财务中心（应收明细 / 发票） | 读取开票信息字段生成发票数据 |

---

## 7. Mock 数据约定

为方便 Demo 演示，CRM 列表加载客户数据时按客户索引轮转注入四类企业资质：

| 索引 % 4 | entityType | 用途 |
|---------|-----------|------|
| 0 | `COMPANY_CN` | 演示中国企业字段布局 |
| 1 | `COMPANY_OVERSEAS` | 演示海外企业 + 自定义字段 |
| 2 | `INDIVIDUAL` | 演示个人字段 |
| 3 | 未设置 | 演示警告提示 |

> Mock 数据写在 `CRMModules.tsx` 顶部的 `MOCK_ENTERPRISE_INFOS` 常量中，仅在客户原本无 `enterpriseInfo` 时注入，不会覆盖真实数据。

---

## 8. 边界规则

- 切换 `entityType` 不会清空已填写的其他类型字段，但只有当前类型的字段会被展示与提交；
- 海外企业的 `customFields` 在提交时会自动剔除空条目；
- 提交时若 `entityType` 未选择，整个 `enterpriseInfo` 字段不写入 `Client` 对象；
- 文件上传（营业执照、护照等证照）当前仅 UI 占位，使用 Mock URL，不实际上传。

---

*文档结束*
