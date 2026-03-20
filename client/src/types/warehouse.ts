/**
 * 仓储相关类型定义
 * 包含入库记录、集装箱、库存等
 */

// ==================== 入库记录 ====================
// Re-export from core.ts for backwards compatibility
export type { InboundRecord, InboundStatus as InboundRecordStatus, InboundMethod } from './core';

// ==================== 集装箱状态 ====================

export type ShippingUnitStatus =
  | 'EMPTY'                // 空箱
  | 'LOADING'              // 装载中
  | 'SEALED'               // 已封箱
  | 'SHIPPED'              // 已出库
  | 'ARRIVED';             // 已到达

// ==================== 集装箱类型 ====================

export type ShippingUnitType = '20GP' | '40GP' | '40HQ' | 'PALLET';

// ==================== 集装箱 ====================

export interface ShippingUnit {
  id: string;
  unitNo: string;                    // 集装箱号/托盘号
  unitType: ShippingUnitType;        // 箱型

  // 运输方式
  transportMode: 'SEA' | 'AIR';

  // 容量信息
  maxWeight: number;                 // 最大重量(kg)
  maxVolume: number;                 // 最大体积(m³)
  currentWeight: number;             // 当前重量(kg)
  currentVolume: number;             // 当前体积(m³)

  // 关联数据
  orderIds: string[];                // 子订单ID列表
  jobNo?: string;                    // 关联的任务号

  // 装载统计
  loadedPieces: number;              // 已装载件数
  loadedOrders: number;              // 已装载订单数

  // 封条信息
  sealNo?: string;                   // 封条号

  // 仓库信息
  warehouse: string;                 // 仓库位置
  location?: string;                 // 具体位置

  // 状态
  status: ShippingUnitStatus;

  // 备注
  remark?: string;

  // 时间戳
  createdAt: string;
  updatedAt: string;
  sealedAt?: string;                 // 封箱时间
  shippedAt?: string;                // 出库时间
  arrivedAt?: string;                // 到达时间
}

// ==================== 库存状态 ====================
// 对齐DB: IN_STOCK|ALLOCATED|PACKED|SHIPPED|RETURNED
// Re-export from core.ts for backwards compatibility

export type { StockStatus, StockItem } from './core';

// ==================== 状态显示配置 ====================

export const INBOUND_RECORD_STATUS_CONFIG: Record<import('./core').InboundStatus, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'default' },
  PROCESSING: { label: '处理中', color: 'processing' },
  COMPLETED: { label: '已完成', color: 'success' },
  ABNORMAL: { label: '异常', color: 'error' },
};

export const SHIPPING_UNIT_STATUS_CONFIG: Record<ShippingUnitStatus, { label: string; color: string }> = {
  EMPTY: { label: '空箱', color: 'default' },
  LOADING: { label: '装载中', color: 'processing' },
  SEALED: { label: '已封箱', color: 'warning' },
  SHIPPED: { label: '已出库', color: 'success' },
  ARRIVED: { label: '已到达', color: 'purple' },
};

export const STOCK_STATUS_CONFIG: Record<import('./core').StockStatus, { label: string; color: string }> = {
  IN_STOCK: { label: '在库', color: 'success' },
  ALLOCATED: { label: '已分配', color: 'processing' },
  PACKED: { label: '已装箱', color: 'blue' },
  SHIPPED: { label: '已出库', color: 'default' },
  RETURNED: { label: '退运', color: 'error' },
};

// ==================== 集装箱容量配置 ====================

export const SHIPPING_UNIT_CAPACITY: Record<ShippingUnitType, { weight: number; volume: number }> = {
  '20GP': { weight: 21000, volume: 33 },      // 21吨, 33m³
  '40GP': { weight: 26000, volume: 67 },      // 26吨, 67m³
  '40HQ': { weight: 26000, volume: 76 },      // 26吨, 76m³
  'PALLET': { weight: 1000, volume: 2 },      // 1吨, 2m³
};

// ==================== 仓库调拨相关类型 ====================

// 调拨类型
export type TransferType = 'ORIGIN' | 'DESTINATION';

// 调拨状态
export type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

// 异常类型
export type AbnormalType = 'SHORT' | 'DAMAGED' | 'LOST' | 'OTHER';

// 调拨订单
export interface TransferOrder {
  id: string;
  transferNo: string;           // 调拨单号（如：TRF-20260201-001）

  // 调拨信息
  fromWarehouse: string;         // 源仓库ID
  fromWarehouseName?: string;    // 源仓库名称
  toWarehouse: string;           // 目标仓库ID
  toWarehouseName?: string;      // 目标仓库名称
  transferType: TransferType;    // 调拨类型（起运国/目的国）

  // 货物信息
  items: TransferItem[];         // 调拨货物清单
  totalPieces: number;           // 总件数
  totalWeight: number;           // 总重量(kg)
  totalVolume?: number;          // 总体积(m³)

  // 状态
  status: TransferStatus;        // 调拨状态

  // 时间信息
  expectedArrival?: string;      // 预计到达时间
  outboundAt?: string;           // 出库时间
  inboundAt?: string;            // 入库时间

  // 备注
  reason?: string;               // 调拨原因
  remark?: string;               // 备注

  // 操作人
  createdBy: string;             // 创建人ID
  createdByName?: string;        // 创建人姓名
  outboundOperator?: string;     // 出库操作人
  outboundOperatorName?: string; // 出库操作人姓名
  inboundOperator?: string;      // 入库操作人
  inboundOperatorName?: string;  // 入库操作人姓名

  // 异常信息
  abnormalInfo?: AbnormalInfo;   // 异常信息

  // 时间戳
  createdAt: string;
  updatedAt: string;
}

// 调拨货物项
export interface TransferItem {
  id: string;
  orderId?: string;              // 关联订单ID
  trackingNo: string;            // 运单号
  goodsName?: string;            // 货物名称
  pieces: number;                // 件数
  weight: number;                // 重量(kg)
  volume?: number;               // 体积(m³)
  remark?: string;               // 备注
}

// 异常信息
export interface AbnormalInfo {
  type: AbnormalType;            // 异常类型
  description: string;           // 异常描述
  actualPieces?: number;         // 实际到达件数
  photos?: string[];             // 异常照片URL数组
  reportedAt: string;            // 上报时间
  reportedBy: string;            // 上报人ID
  reportedByName?: string;       // 上报人姓名
}

// 站点信息
export interface Station {
  id: string;
  code: string;                  // 站点编码（如：CN-FS, NG-LOS）
  name: string;                  // 站点名称
  nameEn?: string;               // 英文名称
  type: 'ORIGIN' | 'DESTINATION'; // 站点类型
  country: string;               // 所在国家
  city: string;                  // 所在城市
  address?: string;              // 详细地址
  contact?: string;              // 联系人
  phone?: string;                // 联系电话
  status: 'ACTIVE' | 'INACTIVE'; // 状态
  createdAt: string;
  updatedAt: string;
}

// 调拨状态配置
export const TRANSFER_STATUS_CONFIG: Record<TransferStatus, { label: string; color: string }> = {
  PENDING: { label: '待出库', color: 'default' },
  IN_TRANSIT: { label: '运输中', color: 'processing' },
  COMPLETED: { label: '已完成', color: 'success' },
  CANCELLED: { label: '已取消', color: 'error' },
};

// 异常类型配置
export const ABNORMAL_TYPE_CONFIG: Record<AbnormalType, { label: string; color: string }> = {
  SHORT: { label: '货物短少', color: 'warning' },
  DAMAGED: { label: '货物损坏', color: 'error' },
  LOST: { label: '货物丢失', color: 'error' },
  OTHER: { label: '其他异常', color: 'default' },
};
