import { useState } from 'react'
import { Card, NavBar, Button, Tag, Space, Toast, Input } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { ScanningOutline, GiftOutline } from 'antd-mobile-icons'
import { orderApi } from '@/api'

// ========== 类型定义 ==========

// 扫码识别的业务对象类型
type ScanObjectType = 'ORDER' | 'CONTAINER' | 'DPN' | 'TRANSFER'

// 订单状态（到达国仓视角 - 仅货物到达目的国后的环节）
type OrderStatus =
  | 'NOT_ARRIVED'       // 未到达（扫到还在运输中/起运国仓的订单）
  | 'PENDING_INBOUND'   // 待入仓（已清关，等待入仓）
  | 'IN_STOCK'          // 已入仓
  | 'PENDING_DELIVERY'  // 待配送（已创建配送单）
  | 'IN_DELIVERY'       // 配送中
  | 'SIGNED'            // 已签收
  | 'COMPLETED'         // 已完成

// 集装箱状态（到达国视角 - 集装箱到港入库流程）
type ContainerStatus =
  | 'IN_TRANSIT'           // 运输中（即将到达）
  | 'ARRIVED'              // 已到港
  | 'INBOUND_IN_PROGRESS'  // 入库中
  | 'COMPLETED'            // 入库完成

// 配送单状态
type DPNStatus =
  | 'PENDING'     // 待配送
  | 'ACCEPTED'    // 已接单
  | 'IN_TRANSIT'  // 配送中
  | 'DELIVERED'   // 已送达
  | 'SIGNED'      // 已签收

// 调拨单状态
type TransferStatus =
  | 'DRAFT'       // 草稿
  | 'SHIPPED'     // 已发运
  | 'IN_TRANSIT'  // 运输中
  | 'ARRIVED'     // 已到达
  | 'RECEIVED'    // 已签收

// ========== 数据接口 ==========

interface OrderInfo {
  orderNo: string
  customerName: string
  customerPhone: string
  status: OrderStatus
  destination: string
  pieces: number
  weight: number
  volume?: number
  createTime: string
  // 到仓信息
  containerNo?: string
  arrivalTime?: string
  customsClearTime?: string
  // 入仓信息
  inboundTime?: string
  inboundOperator?: string
  storageLocation?: string
  daysInStock?: number
  condition?: string
  // 配送信息
  dpnNo?: string
  recipientName?: string
  recipientPhone?: string
  deliveryAddress?: string
  deliveryMethod?: string
  driverName?: string
  driverPhone?: string
  // 签收信息
  signTime?: string
  signPerson?: string
  remark?: string
}

interface ContainerInfo {
  containerNo: string
  jobNo: string
  status: ContainerStatus
  transportMode: string
  route: string
  etd: string
  eta: string
  actualArrivalDate?: string
  totalOrders: number
  inboundOrders: number
  totalPieces: number
  inboundPieces: number
  totalWeight: number
  inboundWeight: number
  warehouseName: string
  completedTime?: string
  shortPieces?: number
  damagedPieces?: number
  remark?: string
}

interface DPNInfo {
  dpnNo: string
  status: DPNStatus
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  city: string
  deliveryMethod: string
  pickupStation?: string
  orderCount: number
  totalPieces: number
  totalWeight: number
  deliveryFee: number
  currency: string
  createdAt: string
  driverName?: string
  driverPhone?: string
  vehicleType?: string
  licensePlate?: string
  acceptedAt?: string
  pickedUpAt?: string
  deliveredAt?: string
  signedAt?: string
  remark?: string
}

interface TransferInfo {
  transferNo: string
  status: TransferStatus
  itemType: string
  fromWarehouse: string
  toWarehouse: string
  orderCount: number
  totalPieces: number
  totalWeight: number
  containerNo?: string
  containerType?: string
  createTime: string
  shippedTime?: string
  estimatedArrival?: string
  arrivedTime?: string
  receivedTime?: string
  receivedBy?: string
  remark?: string
}

type ScanResult =
  | { type: 'ORDER'; data: OrderInfo }
  | { type: 'CONTAINER'; data: ContainerInfo }
  | { type: 'DPN'; data: DPNInfo }
  | { type: 'TRANSFER'; data: TransferInfo }

// ========== 组件 ==========

const ScanOrderUS = () => {
  const navigate = useNavigate()
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [activeType, setActiveType] = useState<ScanObjectType>('ORDER')
  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)

  // 映射 API 订单状态到组件状态
  const mapOrderStatus = (status: string): OrderStatus => {
    const map: Record<string, OrderStatus> = {
      PENDING: 'NOT_ARRIVED',
      PROCESSING: 'NOT_ARRIVED',
      IN_TRANSIT: 'NOT_ARRIVED',
      ARRIVED: 'PENDING_INBOUND',
      CUSTOMS: 'PENDING_INBOUND',
      IN_STOCK: 'IN_STOCK',
      DELIVERING: 'IN_DELIVERY',
      DELIVERED: 'SIGNED',
      COMPLETED: 'COMPLETED',
    }
    return map[status] || 'NOT_ARRIVED'
  }

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      Toast.show({ icon: 'fail', content: '请输入查询内容' })
      return
    }
    setSearching(true)
    try {
      const res = await orderApi.search(searchInput.trim())
      const data = (res as any)?.data
      if (!data) {
        Toast.show({ icon: 'fail', content: '未找到相关数据' })
        return
      }

      if (activeType === 'ORDER') {
        // 从 masterOrders 或 subOrders 中取第一个
        const master = data.masterOrders?.[0]
        const sub = data.subOrders?.[0]
        const raw = master || sub
        if (!raw) {
          Toast.show({ icon: 'fail', content: '未找到相关订单' })
          return
        }
        const orderInfo: OrderInfo = {
          orderNo: raw.orderNo || raw.subOrderNo || '-',
          customerName: raw.customerName || raw.clientName || '-',
          customerPhone: raw.senderPhone || '',
          status: mapOrderStatus(raw.status),
          destination: raw.destCity || raw.destination || '-',
          pieces: raw.totalPieces || raw.pieces || 0,
          weight: raw.totalWeight || raw.weight || 0,
          volume: raw.totalVolume || raw.volume,
          createTime: raw.createdAt ? raw.createdAt.replace('T', ' ').slice(0, 16) : '-',
          recipientName: raw.consignee || undefined,
          recipientPhone: raw.consigneePhone || undefined,
          deliveryAddress: raw.destAddress || undefined,
          remark: raw.remark || undefined,
        }
        setScanResult({ type: 'ORDER', data: orderInfo })
      } else {
        // 其他类型直接显示
        const result = Array.isArray(data) ? data[0] : data
        if (result) {
          setScanResult({ type: activeType, data: result } as ScanResult)
        } else {
          Toast.show({ icon: 'fail', content: '未找到相关数据' })
        }
      }
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '查询失败' })
    } finally {
      setSearching(false)
    }
  }

  // ========== 状态映射 ==========

  const orderStatusMap: Record<OrderStatus, { text: string; color: any }> = {
    NOT_ARRIVED: { text: '未到达', color: 'default' },
    PENDING_INBOUND: { text: '待入仓', color: 'warning' },
    IN_STOCK: { text: '已入仓', color: 'primary' },
    PENDING_DELIVERY: { text: '待配送', color: 'warning' },
    IN_DELIVERY: { text: '配送中', color: 'primary' },
    SIGNED: { text: '已签收', color: 'success' },
    COMPLETED: { text: '已完成', color: 'success' }
  }

  const containerStatusMap: Record<ContainerStatus, { text: string; color: any }> = {
    IN_TRANSIT: { text: '运输中', color: 'default' },
    ARRIVED: { text: '已到港', color: 'warning' },
    INBOUND_IN_PROGRESS: { text: '入库中', color: 'primary' },
    COMPLETED: { text: '入库完成', color: 'success' }
  }

  const dpnStatusMap: Record<DPNStatus, { text: string; color: any }> = {
    PENDING: { text: '待配送', color: 'warning' },
    ACCEPTED: { text: '已接单', color: 'primary' },
    IN_TRANSIT: { text: '配送中', color: 'primary' },
    DELIVERED: { text: '已送达', color: 'success' },
    SIGNED: { text: '已签收', color: 'success' }
  }

  const transferStatusMap: Record<TransferStatus, { text: string; color: any }> = {
    DRAFT: { text: '草稿', color: 'default' },
    SHIPPED: { text: '已发运', color: 'warning' },
    IN_TRANSIT: { text: '运输中', color: 'warning' },
    ARRIVED: { text: '已到达', color: 'primary' },
    RECEIVED: { text: '已签收', color: 'success' }
  }

  // ========== 通用组件 ==========

  const InfoRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', lineHeight: '28px' }}>
      <span style={{ color: '#999', flexShrink: 0 }}>{label}</span>
      <span style={{ color: highlight ? '#ff4d4f' : '#333', fontWeight: highlight ? 'bold' : 'normal', textAlign: 'right', marginLeft: '12px' }}>{value}</span>
    </div>
  )

  const RemarkBox = ({ text }: { text: string }) => (
    <div style={{ marginTop: '8px', padding: '8px', background: '#fffbe6', borderRadius: '6px', fontSize: '12px', color: '#faad14' }}>
      {text}
    </div>
  )

  // ========== 渲染订单详情 ==========

  const renderOrderDetail = (order: OrderInfo) => (
    <>
      {/* 基本信息 */}
      <Card style={{ marginBottom: '12px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{order.orderNo}</span>
          <Tag color={orderStatusMap[order.status].color}>{orderStatusMap[order.status].text}</Tag>
        </div>
        <InfoRow label="客户" value={order.customerName} />
        <InfoRow label="电话" value={order.customerPhone} />
        <InfoRow label="目的地" value={order.destination} />
        <InfoRow label="货物" value={`${order.pieces} 件 · ${order.weight} kg${order.volume ? ` · ${order.volume} m³` : ''}`} />
        <InfoRow label="下单时间" value={order.createTime} />
        {order.remark && <RemarkBox text={order.remark} />}
      </Card>

      {/* 未到达 */}
      {order.status === 'NOT_ARRIVED' && (
        <Card style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}><GiftOutline style={{ fontSize: '48px' }} /></div>
            <div style={{ fontSize: '16px', color: '#999', fontWeight: 'bold' }}>该订单尚未到达本仓</div>
            <div style={{ fontSize: '13px', color: '#ccc', marginTop: '8px' }}>货物可能在起运国仓或运输途中</div>
          </div>
        </Card>
      )}

      {/* 待入仓 */}
      {order.status === 'PENDING_INBOUND' && (
        <>
          <Card title="到仓信息" style={{ marginBottom: '12px', borderRadius: '12px' }}>
            {order.containerNo && <InfoRow label="所属集装箱" value={order.containerNo} />}
            <InfoRow label="到港时间" value={order.arrivalTime!} />
            <InfoRow label="清关时间" value={order.customsClearTime!} />
          </Card>
          <Card title="快速操作" style={{ marginBottom: '12px', borderRadius: '12px' }}>
            <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
              <Button block color="primary" size="large" style={{ '--border-radius': '8px', fontWeight: 'bold' }}
                onClick={() => { navigate('/warehouse-us/inbound/scan') }}>
                办理入仓
              </Button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Button color="warning" fill="outline" onClick={() => {
                  Toast.show({ content: '已上报货物异常，运营将跟进处理' })
                }}>
                  货物异常
                </Button>
                <Button fill="outline" onClick={() => { Toast.show({ content: '查看订单详情' }) }}>
                  订单详情
                </Button>
              </div>
            </Space>
          </Card>
        </>
      )}

      {/* 已入仓 */}
      {order.status === 'IN_STOCK' && (
        <>
          <Card title="仓储信息" style={{ marginBottom: '12px', borderRadius: '12px' }}>
            <InfoRow label="入仓时间" value={order.inboundTime!} />
            <InfoRow label="操作员" value={order.inboundOperator!} />
            <InfoRow label="库位" value={order.storageLocation!} />
            <InfoRow label="货物状态" value={order.condition!} />
            <InfoRow label="在仓天数" value={`${order.daysInStock} 天${order.daysInStock! > 3 ? ' (超期)' : ''}`} highlight={order.daysInStock! > 3} />
          </Card>
          <Card title="快速操作" style={{ marginBottom: '12px', borderRadius: '12px' }}>
            <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
              <Button block color="primary" size="large" style={{ '--border-radius': '8px', fontWeight: 'bold' }}
                onClick={() => { navigate('/warehouse-us/delivery/create') }}>
                创建配送单
              </Button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Button fill="outline" onClick={() => { Toast.show({ content: '创建调拨单' }) }}>
                  创建调拨
                </Button>
                <Button fill="outline" onClick={() => { Toast.show({ content: '录入仓储费' }) }}>
                  录入费用
                </Button>
              </div>
            </Space>
          </Card>
        </>
      )}

      {/* 待配送 */}
      {order.status === 'PENDING_DELIVERY' && (
        <>
          <Card title="仓储信息" style={{ marginBottom: '12px', borderRadius: '12px' }}>
            <InfoRow label="入仓时间" value={order.inboundTime!} />
            <InfoRow label="库位" value={order.storageLocation!} />
            <InfoRow label="在仓天数" value={`${order.daysInStock} 天`} highlight={order.daysInStock! > 3} />
          </Card>
          <Card title="配送安排" style={{ marginBottom: '12px', borderRadius: '12px' }}>
            <InfoRow label="配送单号" value={order.dpnNo!} />
            <InfoRow label="收件人" value={order.recipientName!} />
            <InfoRow label="电话" value={order.recipientPhone!} />
            <InfoRow label="地址" value={order.deliveryAddress!} />
            <InfoRow label="配送方式" value={order.deliveryMethod!} />
          </Card>
          <Card title="快速操作" style={{ marginBottom: '12px', borderRadius: '12px' }}>
            <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
              <Button block color="primary" size="large" style={{ '--border-radius': '8px', fontWeight: 'bold' }}
                onClick={() => { navigate(`/warehouse-us/delivery/detail/${order.dpnNo}`) }}>
                查看配送单
              </Button>
              <Button block color="danger" fill="outline" onClick={() => {
                if (window.confirm('确定取消该配送安排？')) { Toast.show({ content: '已取消配送' }) }
              }}>
                取消配送
              </Button>
            </Space>
          </Card>
        </>
      )}

      {/* 配送中 */}
      {order.status === 'IN_DELIVERY' && (
        <>
          <Card title="配送信息" style={{ marginBottom: '12px', borderRadius: '12px' }}>
            <InfoRow label="配送单号" value={order.dpnNo!} />
            <InfoRow label="收件人" value={`${order.recipientName} ${order.recipientPhone}`} />
            <InfoRow label="地址" value={order.deliveryAddress!} />
            <InfoRow label="配送方式" value={order.deliveryMethod!} />
            <InfoRow label="司机" value={`${order.driverName} ${order.driverPhone}`} />
          </Card>
          <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Button color="primary" fill="outline" onClick={() => { Toast.show({ content: '查看配送轨迹' }) }}>
                配送轨迹
              </Button>
              <Button fill="outline" onClick={() => { Toast.show({ content: `正在拨打 ${order.driverPhone}` }) }}>
                联系司机
              </Button>
            </div>
          </Card>
        </>
      )}

      {/* 已签收 */}
      {order.status === 'SIGNED' && (
        <Card title="签收信息" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <InfoRow label="配送单号" value={order.dpnNo!} />
          <InfoRow label="签收人" value={order.signPerson!} />
          <InfoRow label="签收时间" value={order.signTime!} />
          <InfoRow label="配送地址" value={order.deliveryAddress!} />
          <div style={{ marginTop: '12px', textAlign: 'center', color: '#52c41a', fontWeight: 'bold', fontSize: '14px' }}>
            客户已签收
          </div>
        </Card>
      )}

      {/* 已完成 */}
      {order.status === 'COMPLETED' && (
        <Card title="完成信息" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <InfoRow label="签收时间" value={order.signTime!} />
          <InfoRow label="签收人" value={order.signPerson!} />
          <div style={{ marginTop: '12px', textAlign: 'center', color: '#52c41a', fontWeight: 'bold', fontSize: '14px' }}>
            订单已完成结算
          </div>
        </Card>
      )}
    </>
  )

  // ========== 渲染集装箱详情 ==========

  const renderContainerDetail = (container: ContainerInfo) => {
    const progress = container.totalOrders > 0
      ? Math.round((container.inboundOrders / container.totalOrders) * 100)
      : 0

    return (
      <>
        <Card style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{container.containerNo}</span>
            <Tag color={containerStatusMap[container.status].color}>{containerStatusMap[container.status].text}</Tag>
          </div>
          <InfoRow label="任务号" value={container.jobNo} />
          <InfoRow label="运输方式" value={container.transportMode} />
          <InfoRow label="路线" value={container.route} />
          <InfoRow label="ETD" value={container.etd} />
          <InfoRow label="ETA" value={container.eta} />
          {container.actualArrivalDate && <InfoRow label="实际到达" value={container.actualArrivalDate} />}
          <InfoRow label="目的仓" value={container.warehouseName} />
          {container.remark && <RemarkBox text={container.remark} />}
        </Card>

        {/* 货物统计 */}
        <Card title="货物统计" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f0f5ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1677ff' }}>{container.inboundOrders}/{container.totalOrders}</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>已入库/总订单</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px', background: '#f6ffed', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a' }}>{container.inboundPieces}/{container.totalPieces}</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>已入库/总件数</div>
            </div>
          </div>
          <InfoRow label="总重量" value={`${container.totalWeight} kg`} />
          <InfoRow label="已入库重量" value={`${container.inboundWeight} kg`} />
          {container.status === 'INBOUND_IN_PROGRESS' && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                <span>入库进度</span><span>{progress}%</span>
              </div>
              <div style={{ height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #1677ff, #69b1ff)', borderRadius: '4px', transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </Card>

        {/* 操作区域 */}
        {container.status === 'IN_TRANSIT' && (
          <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#999' }}>
              集装箱尚在运输途中
            </div>
          </Card>
        )}

        {container.status === 'ARRIVED' && (
          <Card title="快速操作" style={{ marginBottom: '12px', borderRadius: '12px' }}>
            <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
              <Button block color="primary" size="large" style={{ '--border-radius': '8px', fontWeight: 'bold' }}
                onClick={() => { navigate('/warehouse-us/inbound/scan') }}>
                开始入库
              </Button>
              <Button block fill="outline" onClick={() => { Toast.show({ content: '查看订单清单' }) }}>
                查看订单清单
              </Button>
            </Space>
          </Card>
        )}

        {container.status === 'INBOUND_IN_PROGRESS' && (
          <Card title="快速操作" style={{ marginBottom: '12px', borderRadius: '12px' }}>
            <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
              <Button block color="primary" size="large" style={{ '--border-radius': '8px', fontWeight: 'bold' }}
                onClick={() => { navigate('/warehouse-us/inbound/scan') }}>
                继续入库
              </Button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Button fill="outline" onClick={() => { Toast.show({ content: '查看已入库清单' }) }}>
                  已入库清单
                </Button>
                <Button fill="outline" onClick={() => { Toast.show({ content: '查看未入库清单' }) }}>
                  未入库清单
                </Button>
              </div>
            </Space>
          </Card>
        )}

        {container.status === 'COMPLETED' && (
          <>
            <Card title="入库结果" style={{ marginBottom: '12px', borderRadius: '12px' }}>
              <InfoRow label="完成时间" value={container.completedTime!} />
              <InfoRow label="入库件数" value={`${container.inboundPieces} / ${container.totalPieces} 件`} />
              {container.shortPieces! > 0 && <InfoRow label="短少" value={`${container.shortPieces} 件`} highlight />}
              {container.damagedPieces! > 0 && <InfoRow label="破损" value={`${container.damagedPieces} 件`} highlight />}
            </Card>
            <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <Button fill="outline" onClick={() => { Toast.show({ content: '查看入库报告' }) }}>
                  入库报告
                </Button>
                <Button fill="outline" onClick={() => { Toast.show({ content: '查看差异明细' }) }}>
                  差异明细
                </Button>
              </div>
            </Card>
          </>
        )}
      </>
    )
  }

  // ========== 渲染配送单详情 ==========

  const renderDPNDetail = (dpn: DPNInfo) => (
    <>
      <Card style={{ marginBottom: '12px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{dpn.dpnNo}</span>
          <Tag color={dpnStatusMap[dpn.status].color}>{dpnStatusMap[dpn.status].text}</Tag>
        </div>
        <InfoRow label="收件人" value={dpn.recipientName} />
        <InfoRow label="电话" value={dpn.recipientPhone} />
        <InfoRow label="地址" value={dpn.recipientAddress} />
        <InfoRow label="城市" value={dpn.city} />
        <InfoRow label="配送方式" value={dpn.deliveryMethod === 'SELF_PICKUP' ? '自提' : dpn.deliveryMethod === 'SATELLITE_STATION' ? '卫星站' : dpn.deliveryMethod} />
        {dpn.pickupStation && <InfoRow label="自提站点" value={dpn.pickupStation} />}
        <InfoRow label="货物" value={`${dpn.orderCount} 单 · ${dpn.totalPieces} 件 · ${dpn.totalWeight} kg`} />
        <InfoRow label="配送费" value={`${dpn.deliveryFee.toLocaleString()} ${dpn.currency}`} />
        <InfoRow label="创建时间" value={dpn.createdAt} />
        {dpn.remark && <RemarkBox text={dpn.remark} />}
      </Card>

      {/* 司机信息 */}
      {dpn.driverName && (
        <Card title="司机信息" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <InfoRow label="司机" value={dpn.driverName} />
          <InfoRow label="电话" value={dpn.driverPhone!} />
          {dpn.vehicleType && <InfoRow label="车辆" value={`${dpn.vehicleType} (${dpn.licensePlate})`} />}
        </Card>
      )}

      {/* 时间节点 */}
      {(dpn.acceptedAt || dpn.pickedUpAt || dpn.deliveredAt || dpn.signedAt) && (
        <Card title="时间节点" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          {dpn.acceptedAt && <InfoRow label="接单时间" value={dpn.acceptedAt} />}
          {dpn.pickedUpAt && <InfoRow label="取货时间" value={dpn.pickedUpAt} />}
          {dpn.deliveredAt && <InfoRow label="送达时间" value={dpn.deliveredAt} />}
          {dpn.signedAt && <InfoRow label="签收时间" value={dpn.signedAt} />}
        </Card>
      )}

      {/* 操作 */}
      {dpn.status === 'PENDING' && (
        <Card title="快速操作" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
            <Button block color="primary" size="large" style={{ '--border-radius': '8px', fontWeight: 'bold' }}
              onClick={() => { Toast.show({ content: '打开司机选择', icon: 'success' }) }}>
              指派司机
            </Button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Button fill="outline" onClick={() => { navigate(`/warehouse-us/delivery/detail/${dpn.dpnNo}`) }}>
                编辑配送单
              </Button>
              <Button color="danger" fill="outline" onClick={() => {
                if (window.confirm('确定取消该配送单？')) { Toast.show({ content: '已取消' }) }
              }}>
                取消配送
              </Button>
            </div>
          </Space>
        </Card>
      )}

      {dpn.status === 'ACCEPTED' && (
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Button color="primary" fill="outline" onClick={() => { Toast.show({ content: `正在拨打 ${dpn.driverPhone}` }) }}>
              联系司机
            </Button>
            <Button color="danger" fill="outline" onClick={() => {
              if (window.confirm('确定取消指派？将释放司机')) { Toast.show({ content: '已取消指派' }) }
            }}>
              取消指派
            </Button>
          </div>
        </Card>
      )}

      {dpn.status === 'IN_TRANSIT' && (
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Button color="primary" fill="outline" onClick={() => { Toast.show({ content: '查看配送轨迹' }) }}>
              配送轨迹
            </Button>
            <Button fill="outline" onClick={() => { Toast.show({ content: `正在拨打 ${dpn.driverPhone}` }) }}>
              联系司机
            </Button>
          </div>
        </Card>
      )}

      {dpn.status === 'DELIVERED' && (
        <Card title="快速操作" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
            <Button block color="primary" size="large" style={{ '--border-radius': '8px', fontWeight: 'bold' }}
              onClick={() => {
                if (window.confirm('确认客户已签收货物？')) { Toast.show({ content: '已确认签收', icon: 'success' }) }
              }}>
              确认签收
            </Button>
            <Button block color="danger" fill="outline"
              onClick={() => {
                if (window.confirm('客户拒收？将退回仓库')) { Toast.show({ content: '已标记拒收，货物将退回仓库' }) }
              }}>
              拒收处理
            </Button>
          </Space>
        </Card>
      )}

      {dpn.status === 'SIGNED' && (
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ textAlign: 'center', color: '#52c41a', fontWeight: 'bold', fontSize: '14px', padding: '8px 0', marginBottom: '8px' }}>
            配送已完成
          </div>
          <Button block fill="outline" onClick={() => { navigate(`/warehouse-us/delivery/detail/${dpn.dpnNo}`) }}>
            查看完整详情
          </Button>
        </Card>
      )}
    </>
  )

  // ========== 渲染调拨单详情 ==========

  const renderTransferDetail = (transfer: TransferInfo) => (
    <>
      <Card style={{ marginBottom: '12px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{transfer.transferNo}</span>
          <Tag color={transferStatusMap[transfer.status].color}>{transferStatusMap[transfer.status].text}</Tag>
        </div>
        <InfoRow label="调拨类型" value={transfer.itemType} />
        <InfoRow label="路线" value={`${transfer.fromWarehouse} → ${transfer.toWarehouse}`} />
        <InfoRow label="货物" value={`${transfer.orderCount} 单 · ${transfer.totalPieces} 件 · ${transfer.totalWeight} kg`} />
        {transfer.containerNo && <InfoRow label="集装箱" value={`${transfer.containerNo} (${transfer.containerType})`} />}
        <InfoRow label="创建时间" value={transfer.createTime} />
        {transfer.remark && <RemarkBox text={transfer.remark} />}
      </Card>

      {(transfer.shippedTime || transfer.arrivedTime || transfer.receivedTime) && (
        <Card title="物流节点" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          {transfer.shippedTime && <InfoRow label="发运时间" value={transfer.shippedTime} />}
          {transfer.estimatedArrival && <InfoRow label="预计到达" value={transfer.estimatedArrival} />}
          {transfer.arrivedTime && <InfoRow label="到达时间" value={transfer.arrivedTime} />}
          {transfer.receivedTime && <InfoRow label="签收时间" value={transfer.receivedTime} />}
          {transfer.receivedBy && <InfoRow label="签收人" value={transfer.receivedBy} />}
        </Card>
      )}

      {transfer.status === 'DRAFT' && (
        <Card title="快速操作" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
            <Button block color="primary" size="large" style={{ '--border-radius': '8px', fontWeight: 'bold' }}
              onClick={() => {
                if (window.confirm('确定提交该调拨单？')) { Toast.show({ content: '已提交', icon: 'success' }) }
              }}>
              提交调拨
            </Button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Button fill="outline" onClick={() => { navigate(`/warehouse-us/transfer/detail/1`) }}>
                编辑
              </Button>
              <Button color="danger" fill="outline" onClick={() => {
                if (window.confirm('确定删除该调拨草稿？')) { Toast.show({ content: '已删除' }) }
              }}>
                删除
              </Button>
            </div>
          </Space>
        </Card>
      )}

      {(transfer.status === 'SHIPPED' || transfer.status === 'IN_TRANSIT') && (
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#999' }}>
            调拨单运输中，等待到达
          </div>
        </Card>
      )}

      {transfer.status === 'ARRIVED' && (
        <Card title="快速操作" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
            <Button block color="primary" size="large" style={{ '--border-radius': '8px', fontWeight: 'bold' }}
              onClick={() => {
                if (window.confirm('确认签收该调拨单？货物将入库')) { Toast.show({ content: '已签收入库', icon: 'success' }) }
              }}>
              确认签收
            </Button>
            <Button block fill="outline" onClick={() => { Toast.show({ content: '查看货物清单' }) }}>
              查看货物清单
            </Button>
          </Space>
        </Card>
      )}

      {transfer.status === 'RECEIVED' && (
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ textAlign: 'center', color: '#52c41a', fontWeight: 'bold', fontSize: '14px', padding: '8px 0', marginBottom: '8px' }}>
            调拨已完成
          </div>
          <Button block fill="outline" onClick={() => { navigate(`/warehouse-us/transfer/detail/1`) }}>
            查看完整详情
          </Button>
        </Card>
      )}
    </>
  )

  // ========== 类型切换样式 ==========

  const typeTabStyle = (type: ScanObjectType) => ({
    flex: 1,
    padding: '8px 4px',
    fontSize: '13px',
    textAlign: 'center' as const,
    borderRadius: '6px',
    background: activeType === type ? '#667eea' : '#f5f5f5',
    color: activeType === type ? '#fff' : '#666',
    fontWeight: activeType === type ? 'bold' as const : 'normal' as const,
    cursor: 'pointer',
    transition: 'all 0.3s'
  })

  // ========== 主渲染 ==========

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '20px' }}>
      <NavBar onBack={() => { navigate(-1) }} style={{ background: '#fff' }}>扫码查询</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 扫码按钮 */}
        <Card style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <Button block color="primary" size="large"
            onClick={() => { Toast.show({ content: '扫码功能开发中', icon: 'fail' }) }}
            style={{ '--border-radius': '8px' }}>
            <ScanningOutline style={{ marginRight: '8px', fontSize: '20px' }} />
            扫描条码
          </Button>
        </Card>

        {/* 手动查询 */}
        <Card title="手动查询" style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
            输入订单号、集装箱号、配送单号或调拨单号进行查询
          </div>

          {/* 类型选择 */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            <div style={typeTabStyle('ORDER')} onClick={() => { setActiveType('ORDER') }}>订单</div>
            <div style={typeTabStyle('CONTAINER')} onClick={() => { setActiveType('CONTAINER') }}>集装箱</div>
            <div style={typeTabStyle('DPN')} onClick={() => { setActiveType('DPN') }}>配送单</div>
            <div style={typeTabStyle('TRANSFER')} onClick={() => { setActiveType('TRANSFER') }}>调拨单</div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Input
              placeholder="请输入编号"
              value={searchInput}
              onChange={setSearchInput}
              onEnterPress={handleSearch}
              clearable
              style={{ '--font-size': '14px', flex: 1 }}
            />
            <Button
              color="primary"
              loading={searching}
              onClick={handleSearch}
              style={{ '--border-radius': '8px' }}
            >
              查询
            </Button>
          </div>
        </Card>

        {/* 扫码结果 */}
        {scanResult && (
          <>
            {scanResult.type === 'ORDER' && renderOrderDetail(scanResult.data)}
            {scanResult.type === 'CONTAINER' && renderContainerDetail(scanResult.data)}
            {scanResult.type === 'DPN' && renderDPNDetail(scanResult.data)}
            {scanResult.type === 'TRANSFER' && renderTransferDetail(scanResult.data)}
          </>
        )}
      </div>
    </div>
  )
}

export default ScanOrderUS
