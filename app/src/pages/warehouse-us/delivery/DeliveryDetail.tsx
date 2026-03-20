import { useState, useEffect } from 'react'
import { Card, NavBar, Steps, Button, List, Tag, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { FileOutline, ContentOutline, CloseCircleOutline } from 'antd-mobile-icons'
import { deliveryApi } from '@/api'
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
  orderItems: { subOrderNo: string }[]
  pickupStation?: string
  createdAt?: string
  createdBy?: string
  acceptedAt?: string
  pickedUpAt?: string
  deliveredAt?: string
  signedAt?: string
  photos?: string[]
  remark?: string
}

const DeliveryDetail = () => {
  const navigate = useNavigate()
  const { dpnNo } = useParams()
  const [order, setOrder] = useState<DeliveryOrder | null>(null)
  const [loading, setLoading] = useState(true)

  const fmtTime = (t: string | undefined) => t ? t.replace('T', ' ').slice(0, 16) : undefined

  const fetchOrder = async () => {
    if (!dpnNo) return
    setLoading(true)
    try {
      const res = await deliveryApi.list()
      const allOrders = (res as any)?.data || []
      const found = allOrders.find((o: any) => o.dpnNo === dpnNo)
      if (found) {
        setOrder({
          id: found.id,
          dpnNo: found.dpnNo || '-',
          recipientName: found.recipientName || '-',
          recipientPhone: found.recipientPhone || '',
          recipientAddress: found.recipientAddress || '-',
          city: found.city || '-',
          deliveryMethod: found.deliveryMethod || 'DELIVERY',
          driverName: found.driverName || undefined,
          driverPhone: found.driverPhone || undefined,
          status: found.status || 'PENDING',
          totalPieces: found.totalPieces || 0,
          totalWeight: found.totalWeight || 0,
          deliveryFee: found.deliveryFee || 0,
          currency: found.currency || 'NGN',
          orderItems: found.items || [],
          pickupStation: found.pickupStation || undefined,
          createdAt: fmtTime(found.createdAt),
          createdBy: found.createdBy || '-',
          acceptedAt: fmtTime(found.acceptedAt),
          pickedUpAt: fmtTime(found.pickedUpAt),
          deliveredAt: fmtTime(found.deliveredAt),
          signedAt: fmtTime(found.signedAt),
          photos: found.photos || [],
          remark: found.remark || undefined,
        })
      }
    } catch (err: any) {
      Toast.show({ content: err.message || '加载配送详情失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrder()
  }, [dpnNo])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>配送单详情</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          <div style={{ fontSize: '16px' }}>加载中...</div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>配送单详情</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}><CloseCircleOutline style={{ fontSize: '48px', color: '#ff4d4f' }} /></div>
          <div style={{ fontSize: '16px' }}>配送单不存在</div>
        </div>
      </div>
    )
  }

  // 状态映射
  const getStatusText = (status: DeliveryOrder['status']) => {
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
    return statusMap[status]
  }

  // 状态颜色
  const getStatusColor = (status: DeliveryOrder['status']) => {
    if (status === 'SIGNED') return 'success'
    if (status === 'PENDING') return 'warning'
    if (status === 'CANCELLED' || status === 'REJECTED') return 'danger'
    return 'primary'
  }

  // 分配司机
  const handleAssignDriver = async () => {
    if (!window.confirm('确定要分配司机吗？')) return
    const driverId = window.prompt('请输入司机ID（必填）')?.trim()
    if (!driverId) {
      Toast.show({ content: '司机ID不能为空', icon: 'fail' })
      return
    }
    const driverName = window.prompt('请输入司机姓名（选填）')?.trim()
    const driverPhone = window.prompt('请输入司机电话（选填）')?.trim()
    try {
      await deliveryApi.assign(order.id, { driverId, driverName, driverPhone })
      Toast.show({ content: '司机分配成功', icon: 'success' })
      await fetchOrder()
    } catch (e: any) {
      Toast.show({ content: e.message || '分配失败', icon: 'fail' })
    }
  }

  // 联系司机
  const handleContactDriver = () => {
    if (order.driverPhone) {
      window.location.href = `tel:${order.driverPhone}`
    } else {
      Toast.show({ content: '暂无司机电话', icon: 'fail' })
    }
  }

  // 联系收货人
  const handleContactRecipient = () => {
    window.location.href = `tel:${order.recipientPhone}`
  }

  // 确认送达
  const handleConfirmDelivered = async () => {
    if (!window.confirm('确定货物已送达吗？')) return
    try {
      await deliveryApi.update(order.id, { status: 'DELIVERED' })
      Toast.show({ content: '送达确认成功', icon: 'success' })
      await fetchOrder()
    } catch (e: any) {
      Toast.show({ content: e.message || '操作失败', icon: 'fail' })
    }
  }

  // 确认签收
  const handleConfirmSigned = async () => {
    if (!window.confirm('确定收货人已签收吗？')) return
    try {
      await deliveryApi.sign(order.id)
      Toast.show({ content: '签收确认成功', icon: 'success' })
      await fetchOrder()
    } catch (e: any) {
      Toast.show({ content: e.message || '操作失败', icon: 'fail' })
    }
  }

  // 取消配送单
  const handleCancelOrder = async () => {
    if (!window.confirm('确定要取消这个配送单吗？')) return
    try {
      await deliveryApi.update(order.id, { status: 'CANCELLED' })
      Toast.show({ content: '配送单已取消', icon: 'success' })
      await fetchOrder()
    } catch (e: any) {
      Toast.show({ content: e.message || '取消失败', icon: 'fail' })
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>配送单详情</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 状态标签 */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
          <Tag
            color={getStatusColor(order.status)}
            style={{ fontSize: '13px', padding: '4px 12px' }}
          >
            {getStatusText(order.status)}
          </Tag>
          <Tag
            color="success"
            style={{ fontSize: '13px', padding: '4px 12px' }}
          >
            {order.deliveryMethod === 'DELIVERY' ? '送货上门' : order.deliveryMethod === 'SELF_PICKUP' ? '自提' : '卫星站点'}
          </Tag>
        </div>

        {/* 基本信息卡片 */}
        <Card
          title={<><FileOutline style={{ fontSize: '16px' }} /> 基本信息</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <List>
            <List.Item extra={order.dpnNo}>配送单号</List.Item>
            <List.Item extra={order.createdAt}>创建时间</List.Item>
            <List.Item extra={order.createdBy}>创建人</List.Item>
          </List>
        </Card>

        {/* 收货信息卡片 */}
        <Card
          title="收货信息"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <List>
            <List.Item extra={order.recipientName}>收货人</List.Item>
            <List.Item
              extra={order.recipientPhone}
              onClick={handleContactRecipient}
              clickable
            >
              电话
            </List.Item>
            <List.Item extra={order.city}>城市</List.Item>
            <List.Item>
              <div>
                <div style={{ color: '#999', fontSize: '14px', marginBottom: '4px' }}>地址</div>
                <div style={{ fontSize: '14px' }}>{order.recipientAddress}</div>
              </div>
            </List.Item>
            {order.pickupStation && (
              <List.Item extra={order.pickupStation}>自提点</List.Item>
            )}
          </List>
        </Card>

        {/* 司机信息卡片 */}
        {order.driverName && (
          <Card
            title="司机信息"
            style={{
              marginBottom: '16px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}
          >
            <List>
              <List.Item extra={order.driverName}>司机</List.Item>
              <List.Item
                extra={order.driverPhone}
                onClick={handleContactDriver}
                clickable
              >
                电话
              </List.Item>
              {order.acceptedAt && (
                <List.Item extra={order.acceptedAt}>接单时间</List.Item>
              )}
              {order.pickedUpAt && (
                <List.Item extra={order.pickedUpAt}>取货时间</List.Item>
              )}
            </List>
          </Card>
        )}

        {/* 货物清单卡片 */}
        <Card
          title={<><ContentOutline style={{ fontSize: '16px' }} /> 货物清单</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0f9ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1677ff', marginBottom: '4px' }}>
                {order.orderItems?.length || 0}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>订单数</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a', marginBottom: '4px' }}>
                {order.totalPieces}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>总件数</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#fffbeb', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#faad14', marginBottom: '4px' }}>
                {order.totalWeight}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>总重量(kg)</div>
            </div>
          </div>

          <div style={{ padding: '12px', background: '#fafafa', borderRadius: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
              订单列表
            </div>
            {(order.orderItems || []).map((item, index) => (
              <div key={index} style={{
                fontSize: '12px',
                color: '#666',
                marginBottom: index < (order.orderItems?.length || 0) - 1 ? '4px' : 0
              }}>
                • {typeof item === 'string' ? item : item.subOrderNo || '-'}
              </div>
            ))}
          </div>
        </Card>

        {/* 费用信息卡片 */}
        <Card
          title="费用信息"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <List>
            <List.Item extra={`${order.currency} ${order.deliveryFee.toLocaleString()}`}>
              配送费用
            </List.Item>
          </List>
        </Card>

        {/* 配送时间轴卡片 */}
        <Card
          title="配送时间轴"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Steps direction="vertical">
            <Steps.Step
              title="创建配送单"
              description={order.createdAt}
              status="finish"
            />
            {order.acceptedAt && (
              <Steps.Step
                title="司机已接单"
                description={order.acceptedAt}
                status="finish"
              />
            )}
            {order.pickedUpAt && (
              <Steps.Step
                title="已取货"
                description={order.pickedUpAt}
                status="finish"
              />
            )}
            {order.status === 'IN_TRANSIT' && (
              <Steps.Step
                title="配送中"
                description="正在配送..."
                status="process"
              />
            )}
            {order.deliveredAt && (
              <Steps.Step
                title="已送达"
                description={order.deliveredAt}
                status="finish"
              />
            )}
            {order.signedAt && (
              <Steps.Step
                title="已签收"
                description={order.signedAt}
                status="finish"
              />
            )}
          </Steps>
        </Card>
      </div>

      {/* 底部操作按钮 */}
      {/* 待配送状态：分配司机 + 取消配送单 */}
      {order.status === 'PENDING' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              color="default"
              size="large"
              onClick={handleCancelOrder}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                flex: 1
              }}
            >
              取消配送单
            </Button>
            <Button
              color="primary"
              size="large"
              onClick={handleAssignDriver}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                flex: 1
              }}
            >
              分配司机
            </Button>
          </div>
        </div>
      )}

      {/* 配送中状态：联系司机 + 联系收货人 */}
      {order.status === 'IN_TRANSIT' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              color="primary"
              size="large"
              onClick={handleContactDriver}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                flex: 1
              }}
            >
              联系司机
            </Button>
            <Button
              color="success"
              size="large"
              onClick={handleConfirmDelivered}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                flex: 1
              }}
            >
              确认送达
            </Button>
          </div>
        </div>
      )}

      {/* 已送达状态：确认签收 */}
      {order.status === 'DELIVERED' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
          zIndex: 100
        }}>
          <Button
            block
            color="success"
            size="large"
            onClick={handleConfirmSigned}
            style={{
              '--border-radius': '8px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            确认签收
          </Button>
        </div>
      )}
    </div>
  )
}

export default DeliveryDetail
