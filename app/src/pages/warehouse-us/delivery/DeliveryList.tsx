import { useState, useEffect } from 'react'
import { Card, Tabs, SearchBar, Badge, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { TruckOutline, ContentOutline, GiftOutline } from 'antd-mobile-icons'
import { deliveryApi } from '@/api'

type DeliveryStatus = 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED'

interface DeliveryOrder {
  id: string
  dpnNo: string
  recipientName: string
  city: string
  deliveryMethod: string
  driverName?: string
  status: DeliveryStatus
  totalPieces: number
  totalWeight: number
  itemCount: number
}

const DeliveryList = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<DeliveryStatus>('PENDING')
  const [searchText, setSearchText] = useState('')
  const [allOrders, setAllOrders] = useState<DeliveryOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDeliveryOrders = async () => {
      setLoading(true)
      try {
        const res = await deliveryApi.list()
        const raw = (res as any)?.data || []
        const mapped: DeliveryOrder[] = raw.map((d: any) => ({
          id: d.id,
          dpnNo: d.dpnNo || '-',
          recipientName: d.recipientName || '-',
          city: d.city || '-',
          deliveryMethod: d.deliveryMethod || 'DELIVERY',
          driverName: d.driverName || undefined,
          status: d.status || 'PENDING',
          totalPieces: d.totalPieces || 0,
          totalWeight: d.totalWeight || 0,
          itemCount: d.items?.length || 0,
        }))
        setAllOrders(mapped)
      } catch (err: any) {
        Toast.show({ content: err.message || '配送数据加载失败' })
      } finally {
        setLoading(false)
      }
    }
    fetchDeliveryOrders()
  }, [])

  // 根据状态过滤配送单
  const filteredOrders = allOrders.filter(order => {
    const matchStatus = order.status === activeTab
    const matchSearch = searchText === '' ||
      order.dpnNo.includes(searchText) ||
      order.recipientName.includes(searchText)
    return matchStatus && matchSearch
  })

  // 状态标签映射
  const getStatusBadge = (status: DeliveryStatus) => {
    const statusMap = {
      'PENDING': { text: '待配送', color: '#faad14' },
      'ACCEPTED': { text: '已接单', color: '#1677ff' },
      'IN_TRANSIT': { text: '配送中', color: '#52c41a' },
      'DELIVERED': { text: '已送达', color: '#13c2c2' },
      'SIGNED': { text: '已签收', color: '#999' }
    }
    return statusMap[status]
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
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}><TruckOutline style={{ fontSize: '24px' }} /> 配送管理</h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
          配送单总数 {allOrders.length} 个
        </p>
      </div>

      {/* 搜索栏 */}
      <div style={{ padding: '0 16px 16px' }}>
        <SearchBar
          placeholder="搜索DPN号/收货人"
          value={searchText}
          onChange={setSearchText}
          style={{
            '--border-radius': '8px',
            '--background': '#fff'
          }}
        />
      </div>

      {/* Tab切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as DeliveryStatus)}
        style={{ '--title-font-size': '15px' }}
      >
        <Tabs.Tab title="待配送" key="PENDING" />
        <Tabs.Tab title="配送中" key="IN_TRANSIT" />
        <Tabs.Tab title="已完成" key="SIGNED" />
      </Tabs>

      <div style={{ padding: '16px' }}>
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const statusBadge = getStatusBadge(order.status)
            return (
              <Card
                key={order.id}
                onClick={() => navigate(`/warehouse-us/delivery/detail/${order.dpnNo}`)}
                style={{
                  marginBottom: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  background: '#fff'
                }}
              >
                <div>
                  {/* 标签行 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: statusBadge.color,
                      background: `${statusBadge.color}15`,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}>
                      {statusBadge.text}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#1677ff',
                      background: '#e6f4ff',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {order.deliveryMethod === 'DELIVERY' ? '送货上门' : order.deliveryMethod === 'SELF_PICKUP' ? '自提' : '卫星站点'}
                    </div>
                  </div>

                  {/* 主要信息 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '32px' }}><ContentOutline style={{ fontSize: '32px', color: '#1677ff' }} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                        {order.dpnNo}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                        收件人：{order.recipientName} · {order.city}
                      </div>
                      {order.driverName && (
                        <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                          司机：{order.driverName}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {order.totalPieces}件 · {order.totalWeight}kg · {order.itemCount || 0}个订单
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}><GiftOutline style={{ fontSize: '48px', color: '#ccc' }} /></div>
            <div style={{ fontSize: '16px' }}>暂无配送单</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DeliveryList
