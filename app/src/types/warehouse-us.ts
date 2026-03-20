// 到达国仓储类型定义

// 集装箱任务状态
export type ContainerTaskStatus = 'PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'INBOUND_IN_PROGRESS' | 'COMPLETED'

// 订单入库状态
export type OrderInboundStatus = 'PENDING' | 'INBOUND' | 'COMPLETED'

// 集装箱任务
export interface ContainerTask {
  id: string
  jobNo: string                    // 任务号
  containerNo: string              // 集装箱号

  // 运输信息
  transportMode: 'SEA' | 'AIR'
  route: string                    // 路线
  etd: string                      // 预计开船日期
  eta: string                      // 预计到达日期
  actualArrivalDate?: string       // 实际到达日期

  // 状态
  status: ContainerTaskStatus

  // 订单信息
  orders: ContainerOrder[]
  totalOrders: number              // 总订单数
  inboundOrders: number            // 已入库订单数

  // 货物统计
  totalPieces: number              // 总件数
  inboundPieces: number            // 已入库件数
  totalWeight: number              // 总重量(kg)
  inboundWeight: number            // 已入库重量(kg)

  // 仓库信息
  warehouseId: string
  warehouseName: string

  // 其他
  remark?: string
  createdAt: string
  createdBy: string
}

// 集装箱内的订单
export interface ContainerOrder {
  id: string
  orderNo: string
  subOrderNo: string
  customerName: string
  customerPhone: string

  // 货物信息
  pieces: number                   // 件数
  weight: number                   // 重量

  // 入库状态
  inboundStatus: OrderInboundStatus
  actualPieces?: number            // 实际入库件数
  condition?: GoodsCondition       // 货物状态
  inboundTime?: string             // 入库时间
  inboundOperator?: string         // 入库操作员
  photos?: string[]                // 入库照片
  remark?: string
}

// 配送方式
export type DeliveryMethod = 'SELF_PICKUP' | 'DELIVERY' | 'SATELLITE_STATION'

// 配送单状态
export type DeliveryStatus = 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED'

// 货物状态
export type GoodsCondition = 'GOOD' | 'DAMAGED' | 'SHORT'

// 配送单（DPN）
export interface DeliveryOrder {
  id: string
  dpnNo: string                    // 配送单号 DPN-YYYYMMDD-XXX
  orderIds: string[]               // 关联的订单ID数组

  // 收货信息
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  city: string

  // 配送方式
  deliveryMethod: DeliveryMethod
  pickupStation?: string           // 自提站点
  satelliteStation?: string        // 卫星站点

  // 司机信息
  driverId?: string
  driverName?: string
  driverPhone?: string

  // 状态
  status: DeliveryStatus

  // 货物信息
  totalPieces: number              // 总件数
  totalWeight: number              // 总重量

  // 费用
  deliveryFee: number
  currency: string                 // 币种（NGN/GHS等）

  // 时间记录
  createdAt: string
  acceptedAt?: string              // 司机接单时间
  pickedUpAt?: string              // 取货时间
  deliveredAt?: string             // 送达时间
  signedAt?: string                // 签收时间

  // 其他
  photos?: string[]                // 配送照片
  remark?: string
  createdBy: string                // 创建人
}

// 司机信息
export interface Driver {
  id: string
  name: string
  phone: string

  // 状态
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE'

  // 统计
  currentTasks: number             // 当前任务数
  completedTasks: number           // 已完成任务数

  // 区域
  serviceArea: string              // 服务区域

  // 其他
  vehicleType?: string             // 车辆类型
  licensePlate?: string            // 车牌号
}

// 到达国入库记录
export interface DestinationInboundRecord {
  id: string
  orderId: string
  orderNo: string

  // 货物信息
  customerName: string
  pieces: number                   // 预计件数
  actualPieces: number             // 实际到达件数
  weight?: number

  // 状态
  condition: GoodsCondition
  photos: string[]

  // 仓库信息
  warehouseId: string
  warehouseName: string

  // 操作信息
  operator: string
  inboundTime: string
  remark?: string
}

// 到达国库存
export interface DestinationStock {
  id: string
  orderId: string
  orderNo: string
  customerName: string

  // 货物信息
  pieces: number
  weight: number

  // 状态
  status: 'PENDING_DELIVERY' | 'IN_DELIVERY' | 'COMPLETED'
  condition: GoodsCondition

  // 仓库信息
  warehouseId: string
  warehouseName: string

  // 时间
  inboundTime: string
  daysInStock: number              // 在库天数

  // 预警
  isAlert: boolean                 // 是否预警（>3天）
  alertLevel?: 'WARNING' | 'DANGER' // 预警级别
}

// 调拨类型
export type TransferItemType = 'ORDER' | 'CONTAINER'

// 调拨状态
export type TransferStatus = 'DRAFT' | 'PACKED' | 'SHIPPED' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED'

// 仓库信息
export interface Warehouse {
  code: string
  name: string
  location: string
}

// 订单信息
export interface OrderInfo {
  orderNo: string
  customerName: string
  pieces: number
  weight: number
  volume: number
}

// 调拨单基础信息
export interface TransferBase {
  id: string
  transferNo: string
  itemType: TransferItemType
  fromWarehouse: Warehouse
  toWarehouse: Warehouse
  orderCount: number
  createTime: string
  status: TransferStatus
}

// 订单级别调拨
export interface OrderTransfer extends TransferBase {
  itemType: 'ORDER'
  orderNos: string[]
  totalPieces: number
  totalWeight: number
}

// 集装箱级别调拨
export interface ContainerTransfer extends TransferBase {
  itemType: 'CONTAINER'
  containerNo: string
  containerType: string
  totalPieces: number
  totalWeight: number
}

export type Transfer = OrderTransfer | ContainerTransfer

// 调拨详情
export interface TransferDetail {
  id: string
  transferNo: string
  itemType: TransferItemType
  fromWarehouse: Warehouse
  toWarehouse: Warehouse
  status: TransferStatus
  createTime: string
  createUser: string
  orders: OrderInfo[]
  containerNo?: string
  containerType?: string
  totalPieces: number
  totalWeight: number
  totalVolume: number
  remark?: string
}
