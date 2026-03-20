/**
 * 订单相关类型定义
 * 包含主订单、子订单、订单物品等
 */

// ==================== 原始快递包裹 ====================

export interface ExpressPackage {
  id: string;
  courier: string;                   // 快递公司（顺丰、韵达等）
  trackingNo: string;                // 第三方运单号
  status: 'PENDING' | 'RECEIVED' | 'INBOUND' | 'DELETED';
  receivedAt?: string;               // 收货时间
  inboundAt?: string;                // 入库时间

  // 包裹内容
  itemName: string;                  // 品名
  category: string;                  // 类别
  description: string;               // 说明（普货/敏感货等）
  weight: number;                    // 重量Kg
  pieces: number;                    // 件数
  declaredValue: number;             // 货值USD

  // 尺寸信息
  length?: number;                   // 长度(cm)
  width?: number;                    // 宽度(cm)
  height?: number;                   // 高度(cm)

  // 关联信息
  subOrderNo?: string;               // 关联的子运单号
  shippingUnitNo?: string;           // 关联的集装号

  // 照片和备注
  photos?: string[];                 // 收货照片
  remark?: string;                   // 备注
}

// ==================== 发票信息 ====================

export interface InvoiceInfo {
  companyName: string;           // 公司名称
  taxNumber: string;             // 信用代码/税号
  contactPerson: string;         // 联系人
  contactPhone: string;          // 联系电话
  address: string;               // 地址
  bankName: string;              // 开户行
  bankAccount: string;           // 银行账号
  invoiceStatus?: 'PENDING' | 'ISSUED' | 'CANCELLED';  // 发票状态
  invoiceNumber?: string;        // 发票号
  invoiceDate?: string;          // 开票日期
  invoiceAmount?: number;        // 发票金额
}

// ==================== 订单物品 ====================

export interface OrderItem {
  id: string;
  name: string;                      // 品名
  nameEn?: string;                   // 英文品名
  category: string;                  // 货物分类
  quantity: number;                  // 数量
  weight: number;                    // 重量(kg)
  volume: number;                    // 体积(m³)
  declaredValue?: number;            // 申报价值
  hsCode?: string;                   // HS编码
  description?: string;              // 说明
}

// ==================== 主订单状态 ====================

export type MasterOrderStatus =
  | 'PENDING_INBOUND'      // 等待入库
  | 'INBOUND'              // 已入库
  | 'PENDING_DEPARTURE'    // 等待发货
  | 'DEPARTED'             // 已发运
  | 'IN_TRANSIT'           // 运输中
  | 'ARRIVED'              // 已到达
  | 'PARTIAL_DELIVERED'    // 部分签收
  | 'COMPLETED'            // 已完成
  | 'EXCEPTION'            // 异常
  | 'RETURN_APPLIED'       // 退单申请中
  | 'CANCELLED';           // 已取消

// ==================== 子订单状态 ====================

export type SubOrderStatus =
  | 'PENDING_INBOUND'      // 待入库
  | 'INBOUND'              // 已入库
  | 'PENDING_PACKING'      // 等待装箱
  | 'PACKED'               // 已装箱
  | 'PENDING_DEPARTURE'    // 等待发货
  | 'IN_TRANSIT'           // 运输中
  | 'CUSTOMS_CLEARANCE'    // 清关中
  | 'ARRIVED'              // 已到达
  | 'PENDING_DELIVERY'     // 等待配送
  | 'DELIVERING'           // 配送中
  | 'DELIVERED'            // 已签收
  | 'EXCEPTION'            // 异常
  | 'RETURN_APPLIED'       // 退单申请中
  | 'CANCELLED';           // 已取消

// ==================== 物流轨迹 ====================

export type LogisticsStep =
  | 'INBOUND'              // 入库
  | 'QUALITY_CHECK'        // 质检
  | 'PACKING'              // 包装加固
  | 'CONTAINER_LOADING'    // 装箱配载
  | 'OUTBOUND'             // 出库
  | 'EXPORT_CUSTOMS'       // 出口报关
  | 'DEPARTED'             // 发运
  | 'IN_TRANSIT'           // 运输中
  | 'ARRIVED_PORT'         // 到达目的港
  | 'IMPORT_CUSTOMS'       // 进口清关
  | 'WAREHOUSE_IN'         // 入目的仓
  | 'DELIVERY_DISPATCH'    // 配送派送
  | 'DELIVERED';           // 已签收

export interface Document {
  id: string;
  type: 'PACKING_LIST' | 'INVOICE' | 'CUSTOMS_DECLARATION' | 'BILL_OF_LADING' | 'OTHER';
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface LogisticsRecord {
  id: string;
  subOrderId: string;
  step: LogisticsStep;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXCEPTION';
  operator?: string;            // 操作人
  timestamp?: string;           // 操作时间
  location?: string;            // 地点
  remark?: string;              // 备注说明
  photos?: string[];            // 照片记录
  documents?: Document[];       // 相关单证
}

// ==================== 主订单 ====================

export interface MasterOrder {
  id: string;
  orderNo: string;                   // 主运单号 ORD-20240115-001
  customerId: string;                // 客户ID
  customerName: string;              // 客户名称

  // 拆单相关
  subOrderIds: string[];             // 子订单ID列表
  splitStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED'; // 拆单状态

  // 原始快递包裹（客户寄送到仓库的快递）
  expressPackages: ExpressPackage[];

  // 物品清单（保留兼容性）
  items: OrderItem[];

  // 发货人信息
  sender?: string;                   // 发货人姓名
  senderPhone?: string;              // 发货人电话
  senderAddress?: string;            // 发货人详细地址
  senderCity?: string;               // 发货人城市
  senderDistrict?: string;           // 发货人区/州
  senderCityId?: string;             // 发货人城市ID
  senderCountry?: string;            // 发货人国家
  senderCountryId?: string;          // 发货人国家ID

  // 收件信息
  consignee: string;                 // 收货人
  consigneePhone: string;            // 电话
  consigneeEmail?: string;           // 邮箱
  destAddress: string;               // 详细地址
  destCountry: string;               // 国家
  destCity: string;                  // 城市
  district?: string;                 // 区/州

  // 汇总数据（从子订单计算）
  totalPieces: number;               // 总件数
  totalWeight: number;               // 总重量(kg)
  totalVolume: number;               // 总体积(m³)

  // 费用信息
  paymentMethod?: 'COD' | 'PREPAID' | 'CREDIT_CARD'; // 支付方式
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID'; // 支付状态
  paymentChannel?: string;             // 支付渠道
  paymentTime?: string;                // 支付时间
  totalFreight?: number;             // 总金额
  paidAmount?: number;               // 已付金额
  currency: 'CNY' | 'USD' | 'NGN';   // 币种

  // 状态（自动计算）
  status: MasterOrderStatus;         // 由子订单状态汇总

  // 业务信息
  transportType?: 'SEA' | 'AIR';     // 主订单运输方式（可选，兼容历史数据）
  salesPerson: string;               // 业务员
  createdBy: string;                 // 创建人
  serviceType?: string;              // 服务类型（普快/特快/拼柜/整柜）
  routeCode?: string;                // 线路代码
  warehouseEntryNo?: string;         // 入仓号（海运）
  containerType?: string;            // 柜型（海运）
  inboundDate?: string;              // 入库日期

  // 发票信息
  invoiceInfo?: InvoiceInfo;         // 发票信息（可选）

  // 备注
  remark?: string;
  internalNote?: string;             // 内部备注

  // 退单信息
  returnType?: 'CUSTOMER_CANCEL' | 'GOODS_ISSUE' | 'ADDRESS_ERROR' | 'OTHER';
  returnReason?: string;
  returnRefundAmount?: number;
  returnRefundMethod?: 'ORIGINAL' | 'BANK_TRANSFER' | 'OFFLINE';
  needReturn?: boolean;
  returnShippingNote?: string;
  returnAppliedBy?: string;
  returnAppliedAt?: string;
  returnApprovedAt?: string;
  returnApprover?: string;
  returnRejectReason?: string;
  previousStatus?: MasterOrderStatus;

  // 时间戳
  createdAt: string;
  updatedAt: string;
}

// ==================== 子订单 ====================

export interface SubOrder {
  id: string;
  subOrderNo: string;                // 子运单号 ORD-20240115-001-01
  masterOrderId: string;             // 主订单ID
  masterOrderNo: string;             // 主运单号（冗余，便于显示）

  // 批次信息
  batchNo: number;                   // 批次号（1, 2, 3...）
  batchName?: string;                // 批次名称（可选）

  // 运输信息
  transportType: 'SEA' | 'AIR';      // 运输方式
  route: string;                     // 线路 (如: SZX → LOS)
  serviceType: string;               // 服务类型（特快/标准）

  // 分配的物品
  items: OrderItem[];                // 从主订单分配的物品

  // 物流数据
  pieces: number;                    // 件数
  weight: number;                    // 重量(kg)
  volume: number;                    // 体积(m³)
  chargeableWeight?: number;         // 计费重量

  // 关联关系
  shippingUnitId?: string;           // 装入的集装箱ID
  shippingUnitNo?: string;           // 集装箱号（冗余）
  jobNo?: string;                    // 关联的任务号

  // 快递信息
  trackingNumber?: string;           // 运单号
  thirdPartyTracking?: string;       // 第三方快递单号

  // 收件信息（继承自主订单，可单独修改）
  consignee: string;
  consigneePhone: string;
  destAddress: string;
  destCountry: string;
  destCity: string;
  district?: string;

  // 状态
  status: SubOrderStatus;            // 独立状态管理

  // 物流轨迹记录
  logisticsRecords?: LogisticsRecord[];

  // 费用信息
  estimatedCost?: number;            // 预估费用
  actualCost?: number;               // 实际费用

  // 备注
  remark?: string;

  // 时间戳
  createdAt: string;
  updatedAt: string;
  inboundAt?: string;                // 入库时间
  packedAt?: string;                 // 装箱时间
  departedAt?: string;               // 发运时间
  arrivedAt?: string;                // 到达时间
  deliveredAt?: string;              // 签收时间
}

// ==================== 订单拆分配置 ====================

export interface OrderSplitConfig {
  batchNo: number;                   // 批次号
  batchName?: string;                // 批次名称
  transportType: 'SEA' | 'AIR';      // 运输方式
  route: string;                     // 线路
  serviceType: string;               // 服务类型
  itemIds: string[];                 // 分配的物品ID列表
}

// ==================== 状态显示配置 ====================

export const MASTER_ORDER_STATUS_CONFIG: Record<MasterOrderStatus, { label: string; color: string }> = {
  PENDING_INBOUND: { label: '等待入库', color: 'warning' },
  INBOUND: { label: '已入库', color: 'cyan' },
  PENDING_DEPARTURE: { label: '等待发货', color: 'orange' },
  DEPARTED: { label: '已发运', color: 'blue' },
  IN_TRANSIT: { label: '运输中', color: 'geekblue' },
  ARRIVED: { label: '已到达', color: 'purple' },
  PARTIAL_DELIVERED: { label: '部分签收', color: 'lime' },
  COMPLETED: { label: '已完成', color: 'success' },
  EXCEPTION: { label: '异常', color: 'error' },
  RETURN_APPLIED: { label: '退单申请中', color: 'volcano' },
  CANCELLED: { label: '已取消', color: 'default' },
};

export const SUB_ORDER_STATUS_CONFIG: Record<SubOrderStatus, { label: string; color: string }> = {
  PENDING_INBOUND: { label: '待入库', color: 'default' },
  INBOUND: { label: '已入库', color: 'cyan' },
  PENDING_PACKING: { label: '等待装箱', color: 'orange' },
  PACKED: { label: '已装箱', color: 'blue' },
  PENDING_DEPARTURE: { label: '等待发货', color: 'orange' },
  IN_TRANSIT: { label: '运输中', color: 'geekblue' },
  CUSTOMS_CLEARANCE: { label: '清关中', color: 'purple' },
  ARRIVED: { label: '已到达', color: 'purple' },
  PENDING_DELIVERY: { label: '等待配送', color: 'lime' },
  DELIVERING: { label: '配送中', color: 'lime' },
  DELIVERED: { label: '已签收', color: 'success' },
  EXCEPTION: { label: '异常', color: 'error' },
  RETURN_APPLIED: { label: '退单申请中', color: 'volcano' },
  CANCELLED: { label: '已取消', color: 'default' },
};

// ==================== 物流步骤显示配置 ====================

export const LOGISTICS_STEP_CONFIG: Record<LogisticsStep, { label: string; icon: string }> = {
  INBOUND: { label: '入库', icon: '📦' },
  QUALITY_CHECK: { label: '质检', icon: '🔍' },
  PACKING: { label: '包装加固', icon: '📦' },
  CONTAINER_LOADING: { label: '装箱配载', icon: '🚛' },
  OUTBOUND: { label: '出库', icon: '📤' },
  EXPORT_CUSTOMS: { label: '出口报关', icon: '📋' },
  DEPARTED: { label: '发运', icon: '🚢' },
  IN_TRANSIT: { label: '运输中', icon: '🌊' },
  ARRIVED_PORT: { label: '到达目的港', icon: '⚓' },
  IMPORT_CUSTOMS: { label: '进口清关', icon: '📋' },
  WAREHOUSE_IN: { label: '入目的仓', icon: '🏢' },
  DELIVERY_DISPATCH: { label: '配送派送', icon: '🚚' },
  DELIVERED: { label: '已签收', icon: '✅' },
};
