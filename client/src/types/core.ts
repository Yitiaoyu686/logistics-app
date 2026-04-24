// User Roles
export type Role =
  | 'ADMIN'           // 系统管理员
  | 'SALES'           // 销售人员
  | 'WAREHOUSE_CN'    // 起运国仓管
  | 'OPS_CN'          // 起运国运营
  | 'WAREHOUSE_US'    // 目的国仓管
  | 'OPS_US'          // 目的国运营
  | 'FINANCE'         // 财务人员
  | 'BOSS'            // 管理层
  | 'DRIVER';         // 司机

// 兼容旧角色类型
export type LegacyRole = 'SALES' | 'WAREHOUSE' | 'OFFICE' | 'FINANCE' | 'ADMIN';

// --- CRM (Customer Relationship Management) Types ---

export type ClientStatus = 'ACTIVE' | 'DORMANT' | 'FROZEN'; // 活跃 | 沉睡 | 冻结
export type ClientSource = 'DEVELOP' | 'EXHIBITION' | 'ONLINE' | 'REFERRAL'; // 自主开发 | 展会 | 线上 | 转介绍
export type ClientIndustry = 'ECOMMERCE' | 'TRADE' | 'FACTORY' | 'PERSONAL' | 'OTHER'; // 电商 | 贸易 | 工厂 | 个人
export type ClientPoolType = 'PRIVATE' | 'PUBLIC'; // 私海 | 公海

export interface ClientContact {
  name: string;
  phone: string;
  email?: string;
  social?: string; // WeChat/WhatsApp
}

export interface Client {
  id: string; // UUID
  shortCode: string; // 4-5位助记码 (系统生成)
  name: string; // 客户名称
  country: string; // 所在国家
  address?: string; // 所在城市/地址
  industry?: ClientIndustry; // 行业
  
  // Contacts
  contact: ClientContact; // 主要联系人

  // Business Preferences
  targetCountries?: string[]; // 常运目标国家
  source?: ClientSource; // 客户来源
  
  // System Info
  status: ClientStatus;
  poolType: ClientPoolType;
  salesId?: string; // 归属销售ID (公海为null)
  formerSalesName?: string; // 前所属销售 (公海展示用)
  returnReason?: string; // 退回公海原因
  enterPoolTime?: string; // 进入公海时间
  
  // Stats
  totalOrders: number;
  lastOrderTime?: string;
  createdAt: string;
}

// --- Enterprise Info Types ---

export type EntityType = 'COMPANY_CN' | 'COMPANY_OVERSEAS' | 'INDIVIDUAL';

export interface CustomField {
  label: string;    // 字段名，用户自己填，如 "CAC Number"
  value: string;    // 字段值
}

export interface DocFile {
  id: string;
  name: string;       // 文件名
  url: string;        // 文件路径（mock）
  type: string;       // 证照类别：营业执照/身份证正面/身份证反面/护照/其他
  uploadedAt: string;
}

export interface EnterpriseInfo {
  entityType: EntityType;

  // 中国企业字段
  companyName?: string;              // 公司全称
  unifiedCreditCode?: string;        // 统一社会信用代码（18位）
  legalRepresentative?: string;      // 法定代表人
  registeredCapital?: string;        // 注册资本
  establishDate?: string;            // 成立日期
  expiryDate?: string;               // 营业期限（空=长期）
  registeredAddress?: string;        // 注册地址
  businessScope?: string;            // 经营范围

  // 中国企业开票信息
  taxpayerId?: string;               // 纳税人识别号
  invoiceTitle?: string;             // 开票抬头
  invoiceAddress?: string;           // 开票地址
  invoicePhone?: string;             // 开票电话

  // 海外企业字段
  overseasCompanyName?: string;      // 公司名称
  overseasCountry?: string;          // 注册国家
  overseasRegNumber?: string;        // 注册号
  overseasTaxNumber?: string;        // 税号 / TIN
  overseasDirector?: string;         // 负责人
  customFields?: CustomField[];      // 自定义字段

  // 个人字段
  realName?: string;                 // 真实姓名
  idType?: 'ID_CARD' | 'PASSPORT';   // 身份证/护照
  idNumber?: string;                 // 证件号码

  // 通用
  bankName?: string;                 // 开户银行
  bankAccount?: string;              // 银行账号
  documents: DocFile[];              // 证照文件
}

// --- OMS (Order Management System) Types ---

// 订单状态
export type OrderStatus =
  | 'PENDING_INBOUND'     // 待入库
  | 'INBOUND'             // 已入库
  | 'PENDING_DEPARTURE'   // 待发货
  | 'DEPARTED'            // 已发货
  | 'IN_TRANSIT'          // 运输中
  | 'ARRIVED'             // 已到达
  | 'PARTIAL_DELIVERED'   // 部分签收
  | 'COMPLETED'           // 已完成
  | 'EXCEPTION'           // 异常
  | 'RETURN_APPLIED'      // 退单申请中
  | 'CANCELLED';          // 已取消

// 子订单状态
export type SubOrderStatus =
  | 'PENDING_INBOUND'     // 待入库
  | 'INBOUND'             // 已入库
  | 'PENDING_PACKING'     // 待装箱
  | 'PACKED'              // 已装箱
  | 'PENDING_DEPARTURE'   // 待发货
  | 'IN_TRANSIT'          // 运输中
  | 'CUSTOMS_CLEARANCE'   // 清关中
  | 'ARRIVED'             // 已到达
  | 'PENDING_DELIVERY'    // 待配送
  | 'DELIVERING'          // 配送中
  | 'DELIVERED'           // 已签收
  | 'EXCEPTION'           // 异常
  | 'RETURN_APPLIED'      // 退单申请中
  | 'CANCELLED';          // 已取消

// 拆单状态
export type SplitStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

// 拆单方式
export type SplitType = 'MANUAL' | 'AUTO';

// 订单物品
export interface OrderItem {
  id: string;
  name: string;              // 物品名称
  nameEn?: string;           // 英文名称
  quantity: number;          // 数量
  unitPrice?: number;        // 单价
  weight: number;            // 重量(kg)
  volume: number;            // 体积(m³)
  category?: string;         // 货物分类
  attributes?: string[];     // 货物属性（带电池、液体类等）
  declaredValue?: number;    // 申报价值
  hsCode?: string;           // 海关编码
  remark?: string;
}

// 快递包裹（订单初始信息）
export interface ExpressPackage {
  id: string;
  expressCompany: string;    // 快递公司
  trackingNo: string;        // 运单号
  status: string;            // 状态
  inboundDate?: string;      // 入库时间
  name: string;              // 品名
  category?: string;         // 类别
  cargoType?: string;        // 说明（普货/特货等）
  weight: number;            // 重量(kg)
  pieces: number;            // 件数
  value: number;             // 货值(USD)
  remark?: string;           // 备注
  subOrderId?: string;       // 关联的子订单ID
}

// 物流节点
export interface LogisticsNode {
  id: string;
  node: string;              // 节点名称
  nodeEn?: string;           // 英文节点名称
  status: string;            // 状态
  location?: string;         // 位置
  time: string;              // 时间
  operator?: string;         // 操作人
  remark?: string;
}

// 费用信息
export interface FeeItem {
  id: string;
  feeType: string;           // 费用类型
  feeTypeName?: string;      // 费用类型名称
  amount: number;            // 金额
  currency: 'CNY' | 'USD';   // 币种
  description?: string;      // 说明
  status: 'PENDING' | 'CONFIRMED' | 'PAID';
  createdAt: string;
}

// 主订单（客户下单）
export interface MasterOrder {
  // 基本信息
  id: string;
  orderNo: string;           // 主运单号（客户可见，如：ORD-20240115-001）
  customerId: string;
  customerName: string;
  customerCode?: string;     // 客户编号

  // 订单内容
  items: OrderItem[];        // 所有物品明细
  expressPackages?: ExpressPackage[]; // 快递包裹列表（订单初始信息）
  totalPieces: number;       // 总件数
  totalWeight: number;       // 总重量(kg)
  totalVolume: number;       // 总体积(m³)
  totalValue: number;        // 总货值

  // 拆单信息
  subOrderIds: string[];     // 关联的子订单ID列表
  splitStatus: SplitStatus;  // 拆单状态
  splitType?: SplitType;     // 拆单方式

  // 订单状态（综合所有子订单状态）
  status: OrderStatus;

  // 发货人信息
  sender: string;
  senderPhone?: string;
  senderAddress?: string;
  pickupAddress?: string;    // 取件地址

  // 收货人信息
  consignee: string;
  consigneePhone: string;
  consigneeEmail?: string;
  destCountry: string;
  destCity: string;
  destAddress: string;       // 收货地址

  // 运输信息
  transportType?: 'SEA' | 'AIR';
  preferredRoute?: string;

  // 费用信息（汇总）
  totalFreight?: number;     // 总运费
  totalFees?: number;        // 总费用
  paidAmount?: number;       // 已支付金额
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';

  // 运费预估/实际（下单估算 → 入库称重后实算 → 客户基于实算支付）
  estimatedFreight?: number;  // 预估运费，按申报重量计算
  actualFreight?: number;     // 实际运费，按入库称重后计算
  freightCurrency?: string;   // 默认 CNY

  // 时间信息
  orderDate: string;         // 下单时间
  createdAt: string;
  updatedAt: string;

  // 备注
  remark?: string;

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
  previousStatus?: OrderStatus;
}

// 子订单（运单/Shipment）
export interface SubOrder {
  // 基本信息
  id: string;
  subOrderNo: string;        // 子运单号（如：ORD-20240115-001-01）
  masterOrderId: string;     // 关联主订单ID
  masterOrderNo: string;     // 主运单号

  // 批次信息
  batchNo: number;           // 批次号（第几批发货）
  splitReason?: string;      // 拆单原因

  // 物品清单（从主订单分配的物品）
  items: OrderItem[];        // 分配到的物品
  pieces: number;            // 件数
  weight: number;            // 重量(kg)
  volume: number;            // 体积(m³)
  value: number;             // 货值

  // 运输信息
  transportType: 'SEA' | 'AIR';
  route?: string;            // 运输路线
  shippingUnitId?: string;   // 关联集装箱ID
  jobNo?: string;            // 关联任务号

  // 仓储信息
  warehouseId?: string;      // 所在仓库
  inboundDate?: string;      // 入库时间
  outboundDate?: string;     // 出库时间

  // 状态管理
  status: SubOrderStatus;

  // 物流节点
  currentNode?: string;      // 当前节点
  timeline: LogisticsNode[]; // 物流轨迹

  // 费用信息（独立核算）
  freight?: number;          // 运费
  extraFees: FeeItem[];      // 额外费用
  totalFee?: number;         // 总费用

  // 客户信息（继承自主订单，但可能不同）
  customerId: string;
  customerName: string;

  // 收货信息（可能与主订单不同）
  consignee?: string;        // 收货人
  consigneePhone?: string;
  destCountry: string;
  destCity: string;
  destAddress?: string;

  // 时间信息
  estimatedDeparture?: string;  // 预计发货时间
  estimatedArrival?: string;    // 预计到达时间
  actualDeparture?: string;     // 实际发货时间
  actualArrival?: string;       // 实际到达时间

  createdAt: string;
  updatedAt: string;

  // 备注
  remark?: string;
  operator?: string;         // 操作人

  // 快递信息
  expressCompany?: string;   // 快递公司
  expressTrackingNo?: string; // 快递单号

  // 业务信息
  salesPerson?: string;      // 业务员
  goodsDescription?: string; // 品名描述
  cargoType?: string;        // 货物类型（普货/特货等）
  volumeWeight?: number;     // 体积重(kg)
}

// 兼容旧的Order类型（逐步废弃）
export interface Order extends MasterOrder {
  trackingNo: string;
  clientCode: string;
  sender: string;
  receiver: string;
  actualWeight?: number;
  actualVolume?: number;
  inboundTime?: string;
  jobNo?: string;
}

export type JobStatus = 'PLANNED' | 'IN_PROGRESS' | 'DEPARTED' | 'IN_TRANSIT' | 'ARRIVED' | 'CLEARED' | 'COMPLETED' | 'CANCELLED';

// 任务阶段
export type JobPhase = 'ORIGIN' | 'IN_TRANSIT' | 'DESTINATION';

// 起运国阶段状态
export type OriginPhaseStatus = 'PLANNED' | 'LOADING' | 'CUSTOMS_EXPORT' | 'DEPARTED';

// 到达国阶段状态
export type DestinationPhaseStatus = 'IN_TRANSIT' | 'ARRIVED' | 'CUSTOMS_CLEARANCE' | 'CLEARED' | 'WAREHOUSED' | 'COMPLETED';

export interface Job {
  jobNo: string;

  // 线路信息
  route: string;
  pol: string;                       // 起运港（Port of Loading）
  pod: string;                       // 目的港（Port of Discharge）
  transitPort?: string;              // 中转港

  // 承运信息
  carrier: string;                   // 承运人
  billOfLading?: string;             // 提单号（海运）
  vesselVoyage?: string;             // 船名航次（海运）
  flightNo?: string;                 // 航班号（空运）

  // 运输信息
  transportType: 'AIR' | 'SEA' | 'TRUCK';
  serviceType?: string;              // 服务类型

  // 阶段管理
  currentPhase: JobPhase;            // 当前阶段

  // 起运国阶段信息
  originPhaseStatus: OriginPhaseStatus;  // 起运国阶段状态
  originOperator?: string;           // 起运国负责人 (OPS_CN)
  originCost?: number;               // 起运国成本
  originCostCurrency?: 'CNY' | 'USD';

  // 到达国阶段信息
  destPhaseStatus: DestinationPhaseStatus;  // 到达国阶段状态
  destOperator?: string;             // 到达国负责人 (OPS_US)
  destCost?: number;                 // 到达国成本
  destCostCurrency?: string;         // 到达国币种 (NGN, GHS等)
  customsClearanceDate?: string;     // 清关完成日期
  warehouseInDate?: string;          // 入仓日期

  // 关联数据
  shippingUnitIds?: string[];        // 绑定的运输单元ID列表（集装箱或空运货物单元）
  orderIds: string[];                // 所有订单ID（从运输单元汇总）

  // 装载统计（从运输单元汇总）
  stats?: {
    containers: number;               // 运输单元数量（集装箱/托盘/纸箱）
    orders: number;                   // 订单数
    pieces: number;                   // 件数
    weight: number;                   // 总重量(kg)
    volume: number;                   // 总体积(m³)
  };

  // 容量信息（所有运输单元的总容量，仅海运适用）
  capacity?: {
    weight: number;                   // 总最大重量(kg)
    volume: number;                   // 总最大体积(m³)
  };

  // 时间节点
  cutoffDate?: string;               // 截单日期
  cutoffSupplementDate?: string;     // 截补料日期
  etd: string;                       // 预计离港
  eta: string;                       // 预计到港
  atd?: string;                      // 实际离港
  ata?: string;                      // 实际到港

  // 成本信息
  billWeight?: number;               // 提单重量
  warehouseDepartureDate?: string;   // 离库日期
  portDepartureDate?: string;        // 离港日期
  portArrivalDate?: string;          // 到港日期

  // 状态
  status: JobStatus;

  // 备注
  remark?: string;

  // 时间戳
  createdAt?: string;
  updatedAt?: string;
}

export interface Fee {
  id: string; orderId?: string; jobId?: string; type: string;
  amount: number; currency: 'CNY' | 'USD'; status: 'PENDING' | 'CONFIRMED' | 'PAID';
}

// --- WMS (Warehouse Management System) Types ---

// 入库状态
export type InboundStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ABNORMAL';

// 包裹状态
export type PackageCondition = 'GOOD' | 'DAMAGED' | 'WET' | 'OPENED' | 'INCOMPLETE';

// 快递信息
export interface ExpressInfo {
  company: string; // 快递公司
  trackingNo: string; // 快递单号
  weight?: number; // 重量(kg)
  receivedDate?: string; // 收件日期
}

// 入库方式
export type InboundMethod = 'SCAN' | 'MANUAL';

// 入库记录（对齐DB: inbound_records 表）
export interface InboundRecord {
  id: string; // 入库记录ID
  subOrderId: string; // 关联子订单ID
  masterOrderId: string; // 关联主订单ID
  trackingNo: string; // 快递单号
  expressCompany: string; // 快递公司
  clientCode: string; // 客户编号
  clientName: string; // 客户名称

  // 包裹信息
  pieces: number; // 件数
  actualWeight?: number; // 实际重量(kg)
  actualVolume?: number; // 实际体积(m³)
  packageCondition: PackageCondition; // 包裹状态

  // 入库信息
  status: InboundStatus; // 入库状态
  inboundTime?: string; // 入库时间
  inboundMethod?: InboundMethod; // 入库方式
  warehouseLocation?: string; // 仓库位置
  warehouse?: string; // 仓库（CN/US）

  // 调拨入库（有此字段则为调拨类型，否则为快递类型）
  transferNo?: string; // 调拨单号
  jobNo?: string; // 运输任务号（到达国入库用）

  // 备注与操作
  remark?: string; // 备注
  operator?: string; // 操作人
  photos?: string; // 照片（TEXT，JSON字符串）

  createdAt: string; // 创建时间
}

// 运输单元类型（集装箱/托盘/大箱）
export type ShippingUnitType =
  | '20GP' | '40GP' | '40HQ' | '45HQ'  // 海运集装箱
  | 'PALLET' | 'BOX';                   // 空运托盘/大箱

// 运输单元状态
export type ShippingUnitStatus = 'EMPTY' | 'LOADING' | 'SEALED' | 'SHIPPED' | 'ARRIVED';

// 运输方式
export type TransportMode = 'SEA' | 'AIR';

// 运输单元（集装箱/托盘）
export interface ShippingUnit {
  id: string; // 单元ID
  unitNo: string; // 集装箱号/托盘号
  unitType: ShippingUnitType; // 类型
  transportMode: TransportMode; // 运输方式
  sealNo?: string; // 封条号（海运专用）

  // 线路信息
  route?: string; // 线路（如：中国佛山→尼日利亚各斯）

  // 容量信息
  maxWeight: number; // 最大承重(kg)
  maxVolume: number; // 最大体积(m³)
  currentWeight: number; // 当前重量(kg)
  currentVolume: number; // 当前体积(m³)

  // 尺寸信息
  length?: number; // 长(cm)
  width?: number; // 宽(cm)
  height?: number; // 高(cm)

  // 装载信息
  orderIds: string[]; // 装载的子订单ID列表
  loadedPieces: number; // 已装件数
  loadedOrders: number; // 已装订单数

  // 状态信息
  status: ShippingUnitStatus; // 状态
  jobNo?: string; // 关联任务号
  loadingStartTime?: string; // 开始装载时间
  sealedTime?: string; // 封箱时间
  shippedAt?: string; // 出库时间
  arrivedAt?: string; // 到达时间

  // 操作信息
  operator?: string; // 操作人
  warehouseLocation?: string; // 仓库位置
  remark?: string; // 备注

  createdAt: string;
  updatedAt?: string;
}

// 库存状态（对齐DB: IN_STOCK|ALLOCATED|PACKED|SHIPPED|RETURNED）
export type StockStatus = 'IN_STOCK' | 'ALLOCATED' | 'PACKED' | 'SHIPPED' | 'RETURNED';

// 库存信息
export interface StockItem {
  id: string;
  masterOrderNo: string; // 主运单号
  subOrderNo: string; // 子运单号（库存维度）
  trackingNo: string; // 快递运单号
  clientCode: string; // 客户编号
  clientName: string; // 客户名称

  // 包裹信息
  pieces: number; // 件数
  weight: number; // 重量(kg)
  volume: number; // 体积(m³)

  // 订单关联信息
  batchNo?: number; // 批次号
  batchName?: string; // 批次名称
  transportType?: 'SEA' | 'AIR'; // 运输方式
  route?: string; // 路线
  recipient?: string; // 收件人
  destination?: string; // 目的地

  // 库存状态
  status: StockStatus; // 状态
  warehouseLocation?: string; // 仓库位置
  warehouse?: string; // 仓库（CN/US）
  location?: string; // 具体位置
  inboundTime: string; // 入库时间
  shippingUnitId?: string; // 装载的运输单元ID
  shippingUnitNo?: string; // 集装箱号

  // DB新增字段
  productName?: string; // 品名
  salesPerson?: string; // 业务员

  remark?: string; // 备注
}