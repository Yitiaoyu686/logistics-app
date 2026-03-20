/**
 * 配送相关类型定义
 * 包含配送单、DPN任务等
 * 对齐 server/src/database/schema.ts delivery_orders 表
 */

// ==================== 配送单状态 ====================

export type DeliveryOrderStatus = 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED';

// ==================== 配送方式 ====================

export type DeliveryMethod = 'SELF_PICKUP' | 'DELIVERY' | 'SATELLITE_STATION';

// ==================== 配送单 ====================

export interface DeliveryOrder {
  id: string;
  dpnNo: string;                    // 配送单号

  // 收件信息
  recipientName: string;             // 收货人
  recipientPhone: string;            // 电话
  recipientAddress: string;          // 详细地址
  city?: string;                     // 城市
  country?: string;                  // 国家

  // 货物信息
  totalPieces: number;               // 总件数
  totalWeight: number;               // 总重量(kg)
  productName?: string;              // 品名

  // 配送信息
  deliveryMethod?: DeliveryMethod;   // 配送方式

  // 通知记录
  phoneNotified: boolean;            // 电话通知
  smsNotified: boolean;              // 短信通知

  // 支付信息
  paymentStatus: 'PAID' | 'UNPAID';  // 支付状态
  deliveryFee?: number;              // 配送费
  currency?: string;                 // 币种

  // 配送人员
  driverId?: string;                 // 司机ID
  driverName?: string;               // 司机姓名
  driverPhone?: string;              // 司机电话

  // 状态
  status: DeliveryOrderStatus;

  // 照片
  photos?: string;                   // 照片（TEXT，JSON字符串）

  // 备注
  remark?: string;

  // 创建人
  createdBy?: string;

  // 时间戳
  createdAt: string;
  acceptedAt?: string;               // 接单时间
  deliveredAt?: string;              // 送达时间
  signedAt?: string;                 // 签收时间
}

// ==================== DPN任务状态 ====================

export type DPNExecutionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

// ==================== DPN任务 ====================

export interface DPNTask {
  id: string;
  dpnNumber: string;                 // DPN编号

  // 站点信息
  fromStation: string;               // 起始站点
  toStation: string;                 // 目标站点
  route: string;                     // 线路（起点-终点）

  // 关联订单
  orderIds: string[];                // 子订单ID列表
  jobId?: string;                    // 关联的JOB编号

  // 物流信息
  totalWeight: number;               // 总重量(kg)
  totalQuantity: number;             // 总件数
  logisticsCompany?: string;         // 物流公司
  shippingNumber?: string;           // 运单号

  // 收件信息
  recipientName: string;             // 收件人姓名
  recipientPhone: string;            // 电话
  recipientAddress: string;          // 地址

  // 状态
  logisticsStatus: string;           // 物流状态
  executionStatus: DPNExecutionStatus; // 执行状态

  // 备注
  remark?: string;

  // 时间戳
  createdAt: string;
  updatedAt: string;
  departureDate?: string;            // 离库日期
  arrivedAt?: string;                // 到达时间
}

// ==================== 状态显示配置 ====================

export const DELIVERY_ORDER_STATUS_CONFIG: Record<DeliveryOrderStatus, { label: string; color: string }> = {
  PENDING: { label: '待配送', color: 'default' },
  ACCEPTED: { label: '已接单', color: 'processing' },
  IN_TRANSIT: { label: '配送中', color: 'warning' },
  DELIVERED: { label: '已送达', color: 'cyan' },
  SIGNED: { label: '已签收', color: 'success' },
};

export const DPN_EXECUTION_STATUS_CONFIG: Record<DPNExecutionStatus, { label: string; color: string }> = {
  PENDING: { label: '待执行', color: 'default' },
  IN_PROGRESS: { label: '执行中', color: 'processing' },
  COMPLETED: { label: '已完成', color: 'success' },
};
