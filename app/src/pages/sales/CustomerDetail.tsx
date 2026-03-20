import { useState, useEffect } from 'react'
import { NavBar, Card, Tag, Button, List, SpinLoading, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { PhoneFill, MailOutline } from 'antd-mobile-icons'
import { clientApi, orderApi } from '@/api'
import type { SalesCustomer, SalesOrder } from '@/types/sales'

const CUST_STATUS_MAP: Record<string, { text: string; color: string }> = {
  ACTIVE: { text: '活跃', color: '#52c41a' },
  DORMANT: { text: '沉睡', color: '#faad14' },
  FROZEN: { text: '冻结', color: '#8c8c8c' },
}

const ORDER_STATUS_MAP: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待处理', color: '#faad14' },
  PROCESSING: { text: '处理中', color: '#1677ff' },
  SHIPPED: { text: '已发运', color: '#722ed1' },
  DELIVERED: { text: '已到达', color: '#52c41a' },
  COMPLETED: { text: '已完成', color: '#8c8c8c' },
}

const CustomerDetail = () => {
  const navigate = useNavigate()
  const { customerId } = useParams<{ customerId: string }>()
  const [customer, setCustomer] = useState<SalesCustomer | null>(null)
  const [customerOrders, setCustomerOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (!customerId) return
      try {
        setLoading(true)
        const [customerRes, ordersRes] = await Promise.all([
          clientApi.get(customerId),
          orderApi.listMaster({ customerId })
        ])
        setCustomer((customerRes as any)?.data || null)
        setCustomerOrders((ordersRes as any)?.data || [])
      } catch (e: any) {
        Toast.show({ content: e.message || '加载客户详情失败', icon: 'fail' })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [customerId])

  if (loading) {
    return (
      <div>
        <NavBar onBack={() => navigate(-1)} style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>客户详情</NavBar>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <SpinLoading color='primary' />
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div>
        <NavBar onBack={() => navigate(-1)}>客户详情</NavBar>
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>客户不存在</div>
      </div>
    )
  }

  const statusInfo = CUST_STATUS_MAP[customer.status] || { text: customer.status, color: '#999' }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar
        onBack={() => navigate(-1)}
        style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}
      >
        客户详情
      </NavBar>

      <div style={{ padding: '12px 16px' }}>
        {/* 客户信息 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 'bold', color: '#fff'
            }}>
              {customer.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{customer.name}</span>
                <Tag style={{
                  '--background-color': `${statusInfo.color}15`,
                  '--text-color': statusInfo.color,
                  '--border-color': 'transparent',
                  fontSize: '11px'
                }}>
                  {statusInfo.text}
                </Tag>
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>{customer.shortCode} · {customer.country}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center', padding: '10px 0', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1677ff' }}>{customer.totalOrders}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>总订单</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 0', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#52c41a' }}>{customer.industry || '-'}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>行业</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 0', background: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{customer.lastOrderTime ? new Date(customer.lastOrderTime).toLocaleDateString() : '-'}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>最近下单</div>
            </div>
          </div>

          <List style={{ '--border-top': 'none', '--border-bottom': 'none', '--border-inner': 'none' }}>
            <List.Item prefix={<PhoneFill style={{ color: '#1677ff' }} />} extra={customer.contact?.phone}>
              电话
            </List.Item>
            <List.Item prefix={<MailOutline style={{ color: '#fa8c16' }} />} extra={customer.contact?.email || '-'}>
              邮箱
            </List.Item>
          </List>
          <div style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>
            来源：{customer.source || '-'} · 创建于 {new Date(customer.createdAt).toLocaleDateString()}
          </div>
          {customer.remark && (
            <div style={{ fontSize: '13px', color: '#666', marginTop: '8px', padding: '8px 12px', background: '#fffbe6', borderRadius: '6px' }}>
              备注：{customer.remark}
            </div>
          )}
        </Card>

        {/* 订单历史 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
            订单历史（{customerOrders.length}）
          </div>
          {customerOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无订单</div>
          ) : (
            customerOrders.map(order => {
              const orderStatus = ORDER_STATUS_MAP[order.status] || { text: order.status, color: '#999' }
              return (
                <div
                  key={order.id}
                  onClick={() => navigate(`/sales/order/${order.id}`)}
                  style={{
                    padding: '10px 12px', background: '#fafafa', borderRadius: '8px',
                    marginBottom: '8px', cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>{order.orderNo}</span>
                    <Tag style={{
                      '--background-color': `${orderStatus.color}15`,
                      '--text-color': orderStatus.color,
                      '--border-color': 'transparent',
                      fontSize: '10px'
                    }}>
                      {orderStatus.text}
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#999' }}>{order.productName} · {order.createdAt}</span>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>${(order.amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              )
            })
          )}
        </Card>
      </div>

      {/* 底部按钮 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px', background: '#fff',
        borderTop: '1px solid #f0f0f0', zIndex: 100,
        display: 'flex', gap: '12px'
      }}>
        <Button
          block
          fill="outline"
          size="large"
          style={{ '--border-radius': '10px', flex: 1 }}
          onClick={() => { window.location.href = `tel:${customer.contact?.phone}` }}
        >
          拨打电话
        </Button>
        <Button
          block
          color="primary"
          size="large"
          style={{ '--border-radius': '10px', flex: 1, '--background-color': '#11998e', '--border-color': '#11998e' }}
          onClick={() => navigate('/sales/order/create')}
        >
          创建订单
        </Button>
      </div>
    </div>
  )
}

export default CustomerDetail
