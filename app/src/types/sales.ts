// 运输任务
export interface ShippingTask {
  id: string
  jobNo: string
  type: 'SEA' | 'AIR'
  origin: string
  destination: string
  etd: string
  eta: string
  status: 'LOADING' | 'IN_TRANSIT' | 'ARRIVED' | 'COMPLETED'
  containerNo?: string
  loadRate: number // 装载率百分比
  totalPieces: number
  totalWeight: number
  totalVolume: number
  price: number
  currency: string
  customerCount: number
  orderCount: number
}

// 销售客户（对齐 Server DB）
export interface SalesCustomer {
  id: string
  shortCode: string
  name: string
  country: string
  address?: string | null
  industry?: string | null
  contact: { name: string; phone: string; email?: string }
  logisticsInfo?: any
  status: 'ACTIVE' | 'DORMANT' | 'FROZEN'
  poolType: 'PRIVATE' | 'PUBLIC'
  salesId?: string | null
  source?: string | null
  totalOrders: number
  lastOrderTime?: string | null
  remark?: string | null
  createdAt: string
}

// 销售订单
export interface SalesOrder {
  id: string
  orderNo: string
  customerName: string
  customerId: string
  productName: string
  destination: string
  totalPieces: number
  totalWeight: number
  totalVolume: number
  amount: number
  paidAmount: number
  currency: string
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED'
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID'
  shippingType: 'SEA' | 'AIR'
  createdAt: string
  updatedAt: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  trackingNodes: TrackingNode[]
}

// 物流节点
export interface TrackingNode {
  time: string
  title: string
  description: string
  status: 'done' | 'current' | 'pending'
}

// 待收款记录
export interface PendingPayment {
  id: string
  orderNo: string
  customerName: string
  customerId: string
  totalAmount: number
  paidAmount: number
  pendingAmount: number
  currency: string
  dueDate: string
  overdueDays: number
  lastReminderDate?: string
  reminderCount: number
}

// 催款记录
export interface ReminderRecord {
  id: string
  paymentId: string
  orderNo: string
  customerName: string
  amount: number
  currency: string
  method: 'SMS' | 'PHONE' | 'EMAIL' | 'WECHAT'
  status: 'SENT' | 'RECEIVED' | 'PAID'
  sentAt: string
  remark?: string
}

// 报价结果
export interface QuoteResult {
  id: string
  channel: string
  shippingType: 'SEA' | 'AIR'
  transitDays: string
  pricePerKg: number
  pricePerCbm: number
  totalPrice: number
  currency: string
  remark?: string
}
