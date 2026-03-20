import { useState, useEffect } from 'react'
import { Card, Tabs, Toast } from 'antd-mobile'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  SendOutline,
  TruckOutline,
  CheckCircleOutline,
  CloseCircleOutline,
  DownCircleOutline,
  UpCircleOutline,
  EditSOutline,
  UnorderedListOutline,
  FileOutline,
  ContentOutline
} from 'antd-mobile-icons'
import FloatingScanButton from '@/components/FloatingScanButton'
import StockList from './StockList'
import { deliveryApi, warehouseApi } from '@/api'
import { isDestWarehouseVisibleUnit } from '@/utils/taskVisibility'

// Warehouse object for transfer display
interface Warehouse {
  code: string
  name: string
  location: string
}

// Mapped transfer type
interface Transfer {
  id: string
  transferNo: string
  itemType: 'ORDER' | 'CONTAINER'
  fromWarehouse: Warehouse
  toWarehouse: Warehouse
  status: 'DRAFT' | 'PACKED' | 'SHIPPED' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED'
  orderCount: number
  totalPieces: number
  totalWeight: number
  containerNo?: string
  containerType?: string
}

// Mapped delivery type
interface DeliveryOrder {
  id: string
  dpnNo: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  city: string
  deliveryMethod: 'SELF_PICKUP' | 'DELIVERY' | 'SATELLITE_STATION'
  driverName?: string
  driverPhone?: string
  status: 'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED' | 'REJECTED' | 'CANCELLED'
  totalPieces: number
  totalWeight: number
  deliveryFee: number
  currency: string
  itemCount: number
  signedAt?: string
  createdAt?: string
}

// 入库任务类型
interface InboundTask {
  id: string
  type: 'CONTAINER' | 'ORDER'
  jobNo?: string
  containerNo?: string
  orderNo?: string
  customerName?: string
  orderCount?: number
  expectedTime: string
  priority: 'high' | 'normal'
}

const TaskHub = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('inbound')
  const [transferSubTab, setTransferSubTab] = useState('inbound')
  const [deliverySubTab, setDeliverySubTab] = useState('pending')

  // 从 URL 参数读取默认标签页
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['inbound', 'delivery', 'transfer', 'stock'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // 待入库任务数据
  const [inboundTasks, setInboundTasks] = useState<InboundTask[]>([])

  // 配送数据
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [, setLoading] = useState(true)

  // Helper: convert warehouse string to object
  const toWh = (v: any): Warehouse => {
    if (typeof v === 'object' && v?.name) return v
    return { code: v || '-', name: v || '-', location: '' }
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [deliveryRes, transferRes, unitsRes] = await Promise.all([
          deliveryApi.list(),
          warehouseApi.listTransfers(),
          warehouseApi.listUnits()
        ])

        // Map delivery orders
        const rawDeliveries = (deliveryRes as any)?.data || []
        const mappedDeliveries: DeliveryOrder[] = rawDeliveries.map((d: any) => ({
          id: d.id,
          dpnNo: d.dpnNo || '-',
          recipientName: d.recipientName || '-',
          recipientPhone: d.recipientPhone || '',
          recipientAddress: d.recipientAddress || '',
          city: d.city || '-',
          deliveryMethod: d.deliveryMethod || 'DELIVERY',
          driverName: d.driverName || undefined,
          driverPhone: d.driverPhone || undefined,
          status: d.status || 'PENDING',
          totalPieces: d.totalPieces || 0,
          totalWeight: d.totalWeight || 0,
          deliveryFee: d.deliveryFee || 0,
          currency: d.currency || 'NGN',
          itemCount: d.items?.length || 0,
          signedAt: d.signedAt ? d.signedAt.replace('T', ' ').slice(0, 16) : undefined,
          createdAt: d.createdAt ? d.createdAt.replace('T', ' ').slice(0, 16) : undefined,
        }))
        setDeliveryOrders(mappedDeliveries)

        // Map transfers
        const rawTransfers = (transferRes as any)?.data || []
        const mappedTransfers: Transfer[] = rawTransfers.map((t: any) => ({
          id: t.id,
          transferNo: t.transferNo || '-',
          itemType: t.itemType || 'ORDER',
          fromWarehouse: toWh(t.fromWarehouse),
          toWarehouse: toWh(t.toWarehouse),
          status: t.status || 'DRAFT',
          orderCount: t.items?.length || 0,
          totalPieces: t.totalPieces || 0,
          totalWeight: t.totalWeight || 0,
          containerNo: t.containerNo || undefined,
          containerType: t.containerNo ? '40HQ' : undefined,
        }))
        setTransfers(mappedTransfers)

        // Map inbound tasks from shipping units
        const rawUnits = (unitsRes as any)?.data || []
        const mappedTasks: InboundTask[] = rawUnits
          .filter((u: any) => isDestWarehouseVisibleUnit(u.status))
          .map((u: any) => ({
            id: u.id,
            type: 'CONTAINER' as const,
            jobNo: u.jobNo || u.unitNo || '',
            containerNo: u.containerNo || u.unitNo || '',
            orderCount: u.items?.length || 0,
            expectedTime: u.createdAt ? u.createdAt.replace('T', ' ').slice(0, 10) : '-',
            priority: 'normal' as const,
          }))
        setInboundTasks(mappedTasks)
      } catch (err: any) {
        Toast.show({ icon: 'fail', content: err.message || '数据加载失败' })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // 配送数据过滤
  const pendingDeliveries = deliveryOrders.filter(order => order.status === 'PENDING')
  const inTransitDeliveries = deliveryOrders.filter(order => order.status === 'IN_TRANSIT')
  const completedDeliveries = deliveryOrders.filter(order => order.status === 'SIGNED')

  // 调拨数据过滤
  const inboundTransfers = transfers.filter(t =>
    ['ARRIVED', 'IN_TRANSIT'].includes(t.status)
  )

  const outboundTransfers = transfers.filter(t =>
    ['SHIPPED', 'PACKED'].includes(t.status)
  )

  const draftTransfers = transfers.filter(t =>
    t.status === 'DRAFT'
  )

  // 获取配送状态文本
  const getDeliveryStatusText = (status: DeliveryOrder['status']) => {
    const statusMap = {
      'PENDING': '待配送',
      'ACCEPTED': '已接单',
      'PICKED_UP': '已取件',
      'IN_TRANSIT': '配送中',
      'DELIVERED': '已送达',
      'SIGNED': '已签收',
      'REJECTED': '已拒收',
      'CANCELLED': '已取消'
    }
    return statusMap[status] || status || '未知'
  }

  // 获取配送状态颜色
  const getDeliveryStatusColor = (status: DeliveryOrder['status']) => {
    const colorMap = {
      'PENDING': { color: '#faad14', bg: '#fffbe6' },
      'ACCEPTED': { color: '#1677ff', bg: '#e6f4ff' },
      'PICKED_UP': { color: '#1677ff', bg: '#e6f4ff' },
      'IN_TRANSIT': { color: '#722ed1', bg: '#f9f0ff' },
      'DELIVERED': { color: '#52c41a', bg: '#f0fdf4' },
      'SIGNED': { color: '#52c41a', bg: '#f0fdf4' },
      'REJECTED': { color: '#ff4d4f', bg: '#fff1f0' },
      'CANCELLED': { color: '#999', bg: '#f5f5f5' }
    }
    return colorMap[status] || { color: '#999', bg: '#f5f5f5' }
  }

  // 获取调拨状态文本
  const getTransferStatusText = (status: Transfer['status']) => {
    const statusMap = {
      'DRAFT': '草稿',
      'PACKED': '已打包',
      'SHIPPED': '已发运',
      'IN_TRANSIT': '运输中',
      'ARRIVED': '已到达',
      'RECEIVED': '已签收'
    }
    return statusMap[status] || status || '未知'
  }

  // 获取调拨状态颜色
  const getTransferStatusColor = (status: Transfer['status']) => {
    const colorMap = {
      'DRAFT': { color: '#999', bg: '#f5f5f5' },
      'PACKED': { color: '#1677ff', bg: '#e6f4ff' },
      'SHIPPED': { color: '#faad14', bg: '#fffbeb' },
      'IN_TRANSIT': { color: '#faad14', bg: '#fffbeb' },
      'ARRIVED': { color: '#52c41a', bg: '#f0fdf4' },
      'RECEIVED': { color: '#52c41a', bg: '#f0fdf4' }
    }
    return colorMap[status] || { color: '#999', bg: '#f5f5f5' }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      {/* 顶部标题栏 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '24px 16px',
        color: 'white',
        marginBottom: '16px',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}><UnorderedListOutline style={{ fontSize: '24px' }} /> 任务中心</h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
          待办任务 {inboundTasks.length + pendingDeliveries.length} 项
        </p>
      </div>

      {/* Tab切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ '--title-font-size': '15px' }}
      >
        <Tabs.Tab title="入库" key="inbound" />
        <Tabs.Tab title="配送" key="delivery" />
        <Tabs.Tab title="调拨" key="transfer" />
        <Tabs.Tab title="库存" key="stock" />
      </Tabs>

      <div style={{ padding: '0 16px', marginTop: '16px' }}>
        {/* 入库待办列表 */}
        {activeTab === 'inbound' && (
          <>
            {inboundTasks.length > 0 ? (
              inboundTasks.map((task) => {
                if (task.type === 'CONTAINER') {
                  return (
                    <Card
                      key={task.id}
                      onClick={() => navigate(`/warehouse-us/container/task/${task.id}`)}
                      style={{
                        marginBottom: '12px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#1677ff',
                            background: '#e6f4ff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            集装箱到港
                          </div>
                          {task.priority === 'high' && (
                            <div style={{
                              fontSize: '11px',
                              color: '#ff4d4f',
                              background: '#fff1f0',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              紧急
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontSize: '32px' }}><DownCircleOutline style={{ fontSize: '32px', color: '#1677ff' }} /></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                              {task.jobNo} / {task.containerNo}
                            </div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                              订单数：{task.orderCount}个
                            </div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              预计到达：{task.expectedTime}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                } else {
                  return (
                    <Card
                      key={task.id}
                      onClick={() => navigate(`/warehouse-us/container/task/${task.id}`)}
                      style={{
                        marginBottom: '12px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#52c41a',
                            background: '#f6ffed',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            客户订单
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontSize: '32px' }}><FileOutline style={{ fontSize: '32px', color: '#52c41a' }} /></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                              {task.orderNo}
                            </div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                              客户：{task.customerName}
                            </div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              预计到达：{task.expectedTime}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                }
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                <div style={{ fontSize: '16px' }}>暂无待入库任务</div>
              </div>
            )}
          </>
        )}

        {/* 配送列表 */}
        {activeTab === 'delivery' && (
          <>
            {/* 状态筛选按钮组 */}
            <div style={{
              padding: '0 16px 12px 16px',
              display: 'flex',
              gap: '8px'
            }}>
              <div
                onClick={() => setDeliverySubTab('pending')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  background: deliverySubTab === 'pending' ? '#1677ff' : '#f5f5f5',
                  color: deliverySubTab === 'pending' ? '#fff' : '#666',
                  fontWeight: deliverySubTab === 'pending' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                待配送
              </div>
              <div
                onClick={() => setDeliverySubTab('inTransit')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  background: deliverySubTab === 'inTransit' ? '#1677ff' : '#f5f5f5',
                  color: deliverySubTab === 'inTransit' ? '#fff' : '#666',
                  fontWeight: deliverySubTab === 'inTransit' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                配送中
              </div>
              <div
                onClick={() => setDeliverySubTab('completed')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  background: deliverySubTab === 'completed' ? '#1677ff' : '#f5f5f5',
                  color: deliverySubTab === 'completed' ? '#fff' : '#666',
                  fontWeight: deliverySubTab === 'completed' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                已完成
              </div>
            </div>

            {/* 待配送列表 */}
            {deliverySubTab === 'pending' && (
              <>
                {pendingDeliveries.length > 0 ? (
                  pendingDeliveries.map((order) => (
                <Card
                  key={order.id}
                  onClick={() => navigate(`/warehouse-us/delivery/detail/${order.dpnNo}`)}
                  style={{
                    marginBottom: '12px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{
                        fontSize: '11px',
                        color: getDeliveryStatusColor(order.status).color,
                        background: getDeliveryStatusColor(order.status).bg,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>
                        {getDeliveryStatusText(order.status)}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#1677ff',
                        background: '#e6f4ff',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {order.deliveryMethod === 'DELIVERY' ? '送货上门' : '自提'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '32px' }}><ContentOutline style={{ fontSize: '32px', color: '#faad14' }} /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                          {order.dpnNo}
                        </div>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                          收件人：{order.recipientName} · {order.city}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {order.totalPieces}件 · {order.totalWeight}kg · {order.itemCount || 0}个订单
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                <div style={{ fontSize: '16px' }}>暂无待配送任务</div>
              </div>
            )}
          </>
        )}

            {/* 配送中列表 */}
            {deliverySubTab === 'inTransit' && (
              <>
                {inTransitDeliveries.length > 0 ? (
                  inTransitDeliveries.map((order) => (
                    <Card
                      key={order.id}
                      onClick={() => navigate(`/warehouse-us/delivery/detail/${order.dpnNo}`)}
                      style={{
                        marginBottom: '12px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{
                            fontSize: '11px',
                            color: getDeliveryStatusColor(order.status).color,
                            background: getDeliveryStatusColor(order.status).bg,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            {getDeliveryStatusText(order.status)}
                          </div>
                          {order.driverName && (
                            <div style={{
                              fontSize: '11px',
                              color: '#52c41a',
                              background: '#f0fdf4',
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}>
                              司机：{order.driverName}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontSize: '32px' }}><SendOutline style={{ fontSize: '32px', color: '#faad14' }} /></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                              {order.dpnNo}
                            </div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                              收件人：{order.recipientName} · {order.city}
                            </div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              {order.totalPieces}件 · {order.totalWeight}kg
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                    <div style={{ fontSize: '16px' }}>暂无配送中订单</div>
                  </div>
                )}
              </>
            )}

            {/* 已完成列表 */}
            {deliverySubTab === 'completed' && (
              <>
                {completedDeliveries.length > 0 ? (
                  completedDeliveries.map((order) => (
                    <Card
                      key={order.id}
                      onClick={() => navigate(`/warehouse-us/delivery/detail/${order.dpnNo}`)}
                      style={{
                        marginBottom: '12px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{
                            fontSize: '11px',
                            color: getDeliveryStatusColor(order.status).color,
                            background: getDeliveryStatusColor(order.status).bg,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            {getDeliveryStatusText(order.status)}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#999',
                            background: '#f5f5f5',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            {order.signedAt}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontSize: '32px' }}><CheckCircleOutline style={{ fontSize: '32px', color: '#52c41a' }} /></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                              {order.dpnNo}
                            </div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                              收件人：{order.recipientName} · {order.city}
                            </div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              {order.totalPieces}件 · {order.totalWeight}kg · 配送费：{order.deliveryFee} {order.currency}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}><CloseCircleOutline style={{ fontSize: '48px', color: '#999' }} /></div>
                    <div style={{ fontSize: '16px' }}>暂无已完成订单</div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 调拨Tab */}
        {activeTab === 'transfer' && (
          <>
            {/* 状态筛选按钮组 */}
            <div style={{
              padding: '0 16px 12px 16px',
              display: 'flex',
              gap: '8px'
            }}>
              <div
                onClick={() => setTransferSubTab('inbound')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  background: transferSubTab === 'inbound' ? '#1677ff' : '#f5f5f5',
                  color: transferSubTab === 'inbound' ? '#fff' : '#666',
                  fontWeight: transferSubTab === 'inbound' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                待入库
              </div>
              <div
                onClick={() => setTransferSubTab('outbound')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  background: transferSubTab === 'outbound' ? '#1677ff' : '#f5f5f5',
                  color: transferSubTab === 'outbound' ? '#fff' : '#666',
                  fontWeight: transferSubTab === 'outbound' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                待签收
              </div>
              <div
                onClick={() => setTransferSubTab('draft')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  background: transferSubTab === 'draft' ? '#1677ff' : '#f5f5f5',
                  color: transferSubTab === 'draft' ? '#fff' : '#666',
                  fontWeight: transferSubTab === 'draft' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                草稿
              </div>
            </div>

            {/* 待入库列表 */}
            {transferSubTab === 'inbound' && (
              <>
                {inboundTransfers.length > 0 ? (
                  inboundTransfers.map((transfer) => {
                    const statusColor = getTransferStatusColor(transfer.status)
                    return (
                      <Card
                        key={transfer.id}
                        onClick={() => navigate(`/warehouse-us/transfer/detail/${transfer.id}`)}
                        style={{
                          marginBottom: '12px',
                          borderRadius: '12px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                          background: '#fff'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{
                              fontSize: '11px',
                              color: '#1677ff',
                              background: '#e6f4ff',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              {transfer.itemType === 'ORDER' ? '订单调拨' : '集装箱调拨'}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: statusColor.color,
                              background: statusColor.bg,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              {getTransferStatusText(transfer.status)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '32px' }}>
                              {transfer.itemType === 'ORDER' ? <ContentOutline style={{ fontSize: '32px', color: '#1677ff' }} /> : <TruckOutline style={{ fontSize: '32px', color: '#1677ff' }} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                                {transfer.transferNo}
                              </div>
                              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                                {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                              </div>
                              {transfer.itemType === 'CONTAINER' && (
                                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                                  集装箱：{transfer.containerNo} ({transfer.containerType})
                                </div>
                              )}
                              <div style={{ fontSize: '12px', color: '#999' }}>
                                订单数：{transfer.orderCount} · {transfer.totalPieces}件 · {transfer.totalWeight}kg
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                    <div style={{ fontSize: '16px' }}>暂无待入库调拨</div>
                  </div>
                )}
              </>
            )}

            {/* 待签收列表 */}
            {transferSubTab === 'outbound' && (
              <>
                {outboundTransfers.length > 0 ? (
                  outboundTransfers.map((transfer) => {
                    const statusColor = getTransferStatusColor(transfer.status)
                    return (
                      <Card
                        key={transfer.id}
                        onClick={() => navigate(`/warehouse-us/transfer/detail/${transfer.id}`)}
                        style={{
                          marginBottom: '12px',
                          borderRadius: '12px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                          background: '#fff'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{
                              fontSize: '11px',
                              color: '#1677ff',
                              background: '#e6f4ff',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              {transfer.itemType === 'ORDER' ? '订单调拨' : '集装箱调拨'}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: statusColor.color,
                              background: statusColor.bg,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              {getTransferStatusText(transfer.status)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '32px' }}>
                              {transfer.itemType === 'ORDER' ? <UpCircleOutline style={{ fontSize: '32px', color: '#faad14' }} /> : <TruckOutline style={{ fontSize: '32px', color: '#faad14' }} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                                {transfer.transferNo}
                              </div>
                              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                                {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                              </div>
                              {transfer.itemType === 'CONTAINER' && (
                                <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                                  集装箱：{transfer.containerNo} ({transfer.containerType})
                                </div>
                              )}
                              <div style={{ fontSize: '12px', color: '#999' }}>
                                订单数：{transfer.orderCount} · {transfer.totalPieces}件 · {transfer.totalWeight}kg
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                    <div style={{ fontSize: '16px' }}>暂无待签收调拨</div>
                  </div>
                )}
              </>
            )}

            {/* 草稿列表 */}
            {transferSubTab === 'draft' && (
              <>
                {draftTransfers.length > 0 ? (
                  draftTransfers.map((transfer) => (
                    <Card
                      key={transfer.id}
                      onClick={() => navigate(`/warehouse-us/transfer/detail/${transfer.id}`)}
                      style={{
                        marginBottom: '12px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                        background: '#fff',
                        border: '1px dashed #d9d9d9'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#1677ff',
                            background: '#e6f4ff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            {transfer.itemType === 'ORDER' ? '订单调拨' : '集装箱调拨'}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#999',
                            background: '#f5f5f5',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            草稿
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontSize: '32px' }}><EditSOutline style={{ fontSize: '32px', color: '#999' }} /></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                              {transfer.transferNo}
                            </div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                              {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              订单数：{transfer.orderCount} · {transfer.totalPieces}件 · {transfer.totalWeight}kg
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                    <div style={{ fontSize: '16px' }}>暂无草稿</div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 库存Tab - 暂时显示空状态 */}
        {activeTab === 'stock' && <StockList />}
      </div>

      {/* 悬浮扫码按钮 */}
      <FloatingScanButton />
    </div>
  )
}

export default TaskHub
