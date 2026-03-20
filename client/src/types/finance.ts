/**
 * 财务相关类型定义
 * 包含费用、支付、审批等
 */

// ==================== 费用类型 ====================

// 费用类型枚举
export type FeeType =
  | 'FREIGHT'           // 运费
  | 'CUSTOMS'           // 报关费
  | 'WAREHOUSE'         // 仓储费
  | 'DELIVERY'          // 配送费
  | 'INSURANCE'         // 保险费
  | 'HANDLING'          // 操作费
  | 'OVERWEIGHT'        // 超重费
  | 'PACKAGING'         // 包装加固费
  | 'OTHER';            // 其他费用

// 费用状态
export type FeeStatus =
  | 'PENDING'           // 待审批
  | 'APPROVED'          // 已审批
  | 'REJECTED'          // 已驳回
  | 'PAID'              // 已支付
  | 'CANCELLED';        // 已取消

// 费用方向
export type FeeDirection = 'PAYABLE' | 'RECEIVABLE';  // 应付 | 应收

// 币种
export type Currency = 'CNY' | 'USD' | 'NGN' | 'EUR';

// ==================== 费用记录 ====================

export interface FeeRecord {
  id: string;
  feeNo: string;                // 费用编号（如：FEE-20260201-001）

  // 关联信息
  relatedType: 'ORDER' | 'JOB' | 'UNIT' | 'TRANSFER' | 'DPN';  // 关联类型
  relatedId: string;            // 关联ID
  relatedNo: string;            // 关联单号

  // 费用信息
  feeType: FeeType;             // 费用类型
  feeDirection: FeeDirection;   // 费用方向
  amount: number;               // 金额
  currency: Currency;           // 币种
  exchangeRate?: number;        // 汇率（转换为CNY）
  amountCNY?: number;           // 人民币金额

  // 供应商/客户信息
  supplierId?: string;          // 供应商ID（应付时）
  supplierName?: string;        // 供应商名称
  customerId?: string;          // 客户ID（应收时）
  customerName?: string;        // 客户名称

  // 状态
  status: FeeStatus;            // 费用状态

  // 审批信息
  approver?: string;            // 审批人ID
  approverName?: string;        // 审批人姓名
  approvedAt?: string;          // 审批时间
  rejectReason?: string;        // 驳回原因

  // 支付信息
  paymentMethod?: string;       // 支付方式
  paymentChannel?: string;      // 支付渠道
  paymentAccount?: string;      // 支付账号
  paymentOperator?: string;     // 支付操作人
  paidAt?: string;              // 支付时间
  paymentVoucher?: string;      // 支付凭证URL

  // 凭证信息
  invoiceNo?: string;           // 发票号
  invoiceUrl?: string;          // 发票URL
  voucherUrls?: string[];       // 凭证URL数组

  // 描述
  description?: string;         // 费用说明
  remark?: string;              // 备注

  // 操作人
  createdBy: string;            // 创建人ID
  createdByName?: string;       // 创建人姓名

  // 时间戳
  createdAt: string;
  updatedAt: string;
}

// ==================== 支付记录 ====================

// 支付方式
export type PaymentMethod =
  | 'BANK_TRANSFER'     // 银行转账
  | 'CASH'              // 现金
  | 'ALIPAY'            // 支付宝
  | 'WECHAT'            // 微信支付
  | 'CREDIT_CARD'       // 信用卡
  | 'CHECK'             // 支票
  | 'OTHER';            // 其他

// 支付状态
export type PaymentStatus =
  | 'PENDING'           // 待支付
  | 'PROCESSING'        // 处理中
  | 'COMPLETED'         // 已完成
  | 'FAILED'            // 失败
  | 'CANCELLED';        // 已取消

// 支付记录
export interface PaymentRecord {
  id: string;
  paymentNo: string;            // 支付编号

  // 关联费用
  feeIds: string[];             // 关联费用ID列表
  totalAmount: number;          // 总金额
  currency: Currency;           // 币种

  // 支付信息
  paymentMethod: PaymentMethod; // 支付方式
  status: PaymentStatus;        // 支付状态

  // 收款方/付款方
  payerName?: string;           // 付款方
  payeeName?: string;           // 收款方
  bankAccount?: string;         // 银行账号
  bankName?: string;            // 银行名称

  // 凭证
  voucherUrls?: string[];       // 凭证URL数组
  transactionNo?: string;       // 交易流水号

  // 时间
  paymentDate?: string;         // 支付日期
  completedAt?: string;         // 完成时间

  // 备注
  remark?: string;

  // 操作人
  createdBy: string;
  createdByName?: string;

  // 时间戳
  createdAt: string;
  updatedAt: string;
}

// ==================== 供应商信息 ====================

export interface Supplier {
  id: string;
  code: string;                 // 供应商编码
  name: string;                 // 供应商名称
  type: string;                 // 供应商类型（船公司、报关行、仓库等）
  contact?: string;             // 联系人
  phone?: string;               // 联系电话
  email?: string;               // 邮箱
  address?: string;             // 地址
  bankAccount?: string;         // 银行账号
  bankName?: string;            // 开户行
  status: 'ACTIVE' | 'INACTIVE'; // 状态
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== 配置常量 ====================

// 费用类型配置
export const FEE_TYPE_CONFIG: Record<FeeType, { label: string; color: string }> = {
  FREIGHT: { label: '运费', color: 'blue' },
  CUSTOMS: { label: '报关费', color: 'orange' },
  WAREHOUSE: { label: '仓储费', color: 'green' },
  DELIVERY: { label: '配送费', color: 'purple' },
  INSURANCE: { label: '保险费', color: 'cyan' },
  HANDLING: { label: '操作费', color: 'geekblue' },
  OVERWEIGHT: { label: '超重费', color: 'red' },
  PACKAGING: { label: '包装加固费', color: 'volcano' },
  OTHER: { label: '其他费用', color: 'default' },
};

// 费用状态配置
export const FEE_STATUS_CONFIG: Record<FeeStatus, { label: string; color: string }> = {
  PENDING: { label: '待审批', color: 'default' },
  APPROVED: { label: '已审批', color: 'success' },
  REJECTED: { label: '已驳回', color: 'error' },
  PAID: { label: '已支付', color: 'processing' },
  CANCELLED: { label: '已取消', color: 'default' },
};

// 支付方式配置
export const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, { label: string }> = {
  BANK_TRANSFER: { label: '银行转账' },
  CASH: { label: '现金' },
  ALIPAY: { label: '支付宝' },
  WECHAT: { label: '微信支付' },
  CREDIT_CARD: { label: '信用卡' },
  CHECK: { label: '支票' },
  OTHER: { label: '其他' },
};

// 支付状态配置
export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string }> = {
  PENDING: { label: '待支付', color: 'default' },
  PROCESSING: { label: '处理中', color: 'processing' },
  COMPLETED: { label: '已完成', color: 'success' },
  FAILED: { label: '失败', color: 'error' },
  CANCELLED: { label: '已取消', color: 'default' },
};

// 币种配置
export const CURRENCY_CONFIG: Record<Currency, { label: string; symbol: string }> = {
  CNY: { label: '人民币', symbol: '¥' },
  USD: { label: '美元', symbol: '$' },
  NGN: { label: '奈拉', symbol: '₦' },
  EUR: { label: '欧元', symbol: '€' },
};
