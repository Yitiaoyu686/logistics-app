// 用户角色类型
export type UserRole = 'WAREHOUSE_CN' | 'WAREHOUSE_US' | 'SALES'

// 扫码类型
export type ScanType =
  | 'EXPRESS_TRACKING_NO'  // 快递单号
  | 'ORDER_NO'             // 订单号
  | 'CONTAINER_NO'         // 集装箱号
  | 'TRANSFER_NO'          // 调拨单号
  | 'DELIVERY_NO'          // 配送单号
  | 'UNKNOWN'              // 未知类型

// 用户信息
export interface User {
  id: string
  name: string
  role: UserRole
  warehouseId: string
  warehouseName: string
  phone?: string
  avatar?: string
}

// 订单信息
export interface Order {
  id: string
  orderNo: string
  customerName: string
  productName: string
  totalPieces: number
  totalWeight: number
  totalVolume: number
  status: string
  destination: {
    country: string
    city: string
  }
  recipient: string
  recipientPhone: string
  recipientAddress: string
  createdAt: string
  updatedAt: string
}

// 入库方式
export type InboundMethod = 'SCAN' | 'MANUAL'

// 包裹状态
export type PackageCondition = 'GOOD' | 'DAMAGED' | 'WET' | 'OPENED' | 'INCOMPLETE'

// 入库记录（对齐DB: inbound_records 表）
export interface InboundRecord {
  id: string
  subOrderId: string
  masterOrderId: string
  trackingNo: string
  expressCompany: string
  clientCode: string
  clientName: string
  pieces: number
  actualWeight?: number
  actualVolume?: number
  packageCondition: PackageCondition
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ABNORMAL'
  inboundTime?: string
  inboundMethod?: InboundMethod
  warehouseLocation?: string
  warehouse?: string
  operator?: string
  photos?: string
  remark?: string
  createdAt: string
}
