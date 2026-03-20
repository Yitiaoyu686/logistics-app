import { useState, useEffect } from 'react'
import { NavBar, Card, Tag, Button, Steps, Toast, ActionSheet, SpinLoading } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { orderApi } from '@/api'
import type { SalesOrder } from '@/types/sales'

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待处理', color: '#faad14' },
  PROCESSING: { text: '处理中', color: '#1677ff' },
  SHIPPED: { text: '已发运', color: '#722ed1' },
  DELIVERED: { text: '已到达', color: '#52c41a' },
  COMPLETED: { text: '已完成', color: '#8c8c8c' },
}

const PAY_STATUS_MAP: Record<string, { text: string; color: string }> = {
  UNPAID: { text: '未付款', color: '#ff4d4f' },
  PARTIAL: { text: '部分付款', color: '#fa8c16' },
  PAID: { text: '已付清', color: '#52c41a' },
}

const { Step } = Steps

const SalesOrderDetail = () => {
  const navigate = useNavigate()
  const { orderId } = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<SalesOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [reminderVisible, setReminderVisible] = useState(false)

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return
      try {
        setLoading(true)
        const res = await orderApi.getMaster(orderId)
        setOrder((res as any)?.data || null)
      } catch (e: any) {
        Toast.show({ content: e.message || '加载订单详情失败', icon: 'fail' })
      } finally {
        setLoading(false)
      }
    }
    fetchOrder()
  }, [orderId])

  if (loading) {
    return (
      <div>
        <NavBar onBack={() => navigate(-1)} style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>订单详情</NavBar>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <SpinLoading color='primary' />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div>
        <NavBar onBack={() => navigate(-1)}>订单详情</NavBar>
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>订单不存在</div>
      </div>
    )
  }

  const statusInfo = STATUS_MAP[order.status] || { text: order.status, color: '#999' }
  const payInfo = PAY_STATUS_MAP[order.paymentStatus] || { text: order.paymentStatus, color: '#999' }

  const currentStep = (order.trackingNodes || []).findIndex(n => n.status === 'current')

  const handleShare = () => {
    const text = [
      `订单号: ${order.orderNo}`,
      `客户: ${order.customerName}`,
      `产品: ${order.productName}`,
      `目的地: ${order.destination}`,
      `件数: ${order.totalPieces} | 重量: ${order.totalWeight}kg | 体积: ${order.totalVolume}CBM`,
      `金额: $${(order.amount || 0).toLocaleString()} (${payInfo.text})`,
      `状态: ${statusInfo.text}`,
      `运输: ${order.shippingType === 'SEA' ? '海运' : '空运'}`,
    ].join('\n')

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        Toast.show({ content: '订单信息已复制到剪贴板', icon: 'success' })
      })
    } else {
      Toast.show({ content: '复制失败，请手动复制', icon: 'fail' })
    }
  }

  const handleReminder = () => {
    setReminderVisible(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar
        onBack={() => navigate(-1)}
        style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}
      >
        订单详情
      </NavBar>

      <div style={{ padding: '12px 16px' }}>
        {/* 订单状态 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{order.orderNo}</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Tag style={{
                '--background-color': `${statusInfo.color}15`,
                '--text-color': statusInfo.color,
                '--border-color': 'transparent'
              }}>
                {statusInfo.text}
              </Tag>
              <Tag style={{
                '--background-color': `${payInfo.color}15`,
                '--text-color': payInfo.color,
                '--border-color': 'transparent'
              }}>
                {payInfo.text}
              </Tag>
            </div>
          </div>

          {/* 金额信息 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '12px', background: '#f8f9fa', borderRadius: '10px', marginBottom: '12px'
          }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>${(order.amount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>总金额</div>
            </div>
            <div style={{ width: '1px', background: '#e5e5e5' }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>${(order.paidAmount || 0).toLocaleString()}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>已付</div>
            </div>
            <div style={{ width: '1px', background: '#e5e5e5' }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{
                fontSize: '18px', fontWeight: 'bold',
                color: (order.amount || 0) - (order.paidAmount || 0) > 0 ? '#ff4d4f' : '#52c41a'
              }}>
                ${((order.amount || 0) - (order.paidAmount || 0)).toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#999' }}>待收</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
            <div><span style={{ color: '#999' }}>客户：</span><span style={{ color: '#333' }}>{order.customerName}</span></div>
            <div><span style={{ color: '#999' }}>产品：</span><span style={{ color: '#333' }}>{order.productName}</span></div>
            <div><span style={{ color: '#999' }}>目的地：</span><span style={{ color: '#333' }}>{order.destination}</span></div>
            <div><span style={{ color: '#999' }}>运输方式：</span><span style={{ color: '#333' }}>{order.shippingType === 'SEA' ? '海运' : '空运'}</span></div>
            <div><span style={{ color: '#999' }}>件数：</span><span style={{ color: '#333' }}>{order.totalPieces}件</span></div>
            <div><span style={{ color: '#999' }}>重量：</span><span style={{ color: '#333' }}>{order.totalWeight}kg</span></div>
            <div><span style={{ color: '#999' }}>体积：</span><span style={{ color: '#333' }}>{order.totalVolume}CBM</span></div>
            <div><span style={{ color: '#999' }}>创建：</span><span style={{ color: '#333' }}>{order.createdAt}</span></div>
          </div>
        </Card>

        {/* 收件人信息 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>收件人信息</div>
          <div style={{ fontSize: '13px', lineHeight: 2 }}>
            <div><span style={{ color: '#999' }}>姓名：</span>{order.recipientName}</div>
            <div><span style={{ color: '#999' }}>电话：</span>
              <a href={`tel:${order.recipientPhone}`} style={{ color: '#1677ff' }}>{order.recipientPhone}</a>
            </div>
            <div><span style={{ color: '#999' }}>地址：</span>{order.recipientAddress}</div>
          </div>
        </Card>

        {/* 物流轨迹 */}
        {order.trackingNodes && order.trackingNodes.length > 0 && (
          <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>物流轨迹</div>
            <Steps current={currentStep >= 0 ? currentStep : 0} direction="vertical" style={{ '--icon-size': '22px' }}>
              {order.trackingNodes.map((node, i) => (
                <Step
                  key={i}
                  title={node.title}
                  description={
                    <span style={{ color: '#999', fontSize: '12px' }}>
                      {node.time && `${node.time} `}{node.description}
                    </span>
                  }
                  status={node.status === 'done' ? 'finish' : node.status === 'current' ? 'process' : 'wait'}
                />
              ))}
            </Steps>
          </Card>
        )}
      </div>

      {/* 底部操作按钮 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px', background: '#fff',
        borderTop: '1px solid #f0f0f0', zIndex: 100,
        display: 'flex', gap: '8px'
      }}>
        <Button
          size="large"
          fill="outline"
          style={{ '--border-radius': '10px', flex: 1 }}
          onClick={handleShare}
        >
          分享订单
        </Button>
        {order.paymentStatus !== 'PAID' && (
          <Button
            size="large"
            color="warning"
            style={{ '--border-radius': '10px', flex: 1 }}
            onClick={handleReminder}
          >
            发送催款
          </Button>
        )}
        <Button
          size="large"
          color="primary"
          style={{ '--border-radius': '10px', flex: 1, '--background-color': '#11998e', '--border-color': '#11998e' }}
          onClick={() => { window.location.href = `tel:${order.recipientPhone}` }}
        >
          联系客户
        </Button>
      </div>

      <ActionSheet
        visible={reminderVisible}
        onClose={() => setReminderVisible(false)}
        actions={[
          { text: '短信催款', key: 'SMS' },
          { text: '电话催款', key: 'PHONE' },
          { text: '邮件催款', key: 'EMAIL' },
          { text: '微信催款', key: 'WECHAT' },
        ]}
        onAction={(action) => {
          const methodMap: Record<string, string> = { SMS: '短信', PHONE: '电话', EMAIL: '邮件', WECHAT: '微信' }
          Toast.show({ content: `${methodMap[action.key as string]}催款通知已发送`, icon: 'success' })
          setReminderVisible(false)
        }}
        cancelText="取消"
      />
    </div>
  )
}

export default SalesOrderDetail
