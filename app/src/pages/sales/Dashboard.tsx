import { useState, useEffect, useMemo } from 'react'
import { Card, Grid, SpinLoading } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import {
  AddCircleOutline,
  FileOutline,
  UserOutline,
  BillOutline
} from 'antd-mobile-icons'
import { orderApi, salesApi } from '@/api'
import type { SalesOrder, PendingPayment } from '@/types/sales'

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待处理', color: '#faad14' },
  PROCESSING: { text: '处理中', color: '#1677ff' },
  SHIPPED: { text: '已发运', color: '#722ed1' },
  DELIVERED: { text: '已到达', color: '#52c41a' },
  COMPLETED: { text: '已完成', color: '#8c8c8c' },
}

const SalesDashboard = () => {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [payments, setPayments] = useState<PendingPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [ordersRes, paymentsRes] = await Promise.allSettled([
          orderApi.listMaster(),
          salesApi.pendingPayments()
        ])

        if (ordersRes.status === 'fulfilled') {
          setOrders((ordersRes.value as any)?.data || [])
        } else {
          setOrders([])
        }

        if (paymentsRes.status === 'fulfilled') {
          setPayments((paymentsRes.value as any)?.data || [])
        } else {
          setPayments([])
        }
      } catch {
        setOrders([])
        setPayments([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const todayOrders = orders.filter(o => o.createdAt === today).length
    const pendingFollow = orders.filter(o => o.status === 'PENDING' || o.status === 'PROCESSING').length
    const completed = orders.filter(o => o.status === 'COMPLETED' || o.status === 'DELIVERED').length
    const pendingPayment = payments.reduce((sum, p) => sum + (p.pendingAmount || 0), 0)
    return [
      { label: '今日订单', value: todayOrders, color: '#1677ff', bg: '#e6f4ff' },
      { label: '待跟进', value: pendingFollow, color: '#fa8c16', bg: '#fff7e6' },
      { label: '已成交', value: completed, color: '#52c41a', bg: '#f6ffed' },
      { label: '待收款', value: `$${(pendingPayment / 1000).toFixed(1)}k`, color: '#ff4d4f', bg: '#fff2f0' },
    ]
  }, [orders, payments])

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
  }, [orders])

  const quickActions = [
    { label: '创建订单', icon: <AddCircleOutline style={{ fontSize: '28px', color: '#1677ff' }} />, path: '/sales/order/create' },
    { label: '报价工具', icon: <FileOutline style={{ fontSize: '28px', color: '#fa8c16' }} />, path: '/sales/quote' },
    { label: '我的客户', icon: <UserOutline style={{ fontSize: '28px', color: '#52c41a' }} />, path: '/sales/task-hub?tab=customers' },
    { label: '催款管理', icon: <BillOutline style={{ fontSize: '28px', color: '#ff4d4f' }} />, path: '/sales/task-hub?tab=collection' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      {/* 头部渐变 */}
      <div style={{
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        padding: '24px 16px 32px',
        color: 'white',
        boxShadow: '0 4px 12px rgba(17, 153, 142, 0.3)'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
          Sales Portal
        </h2>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
          销售工作台
        </p>
      </div>

      <div style={{ padding: '0 16px', marginTop: '-16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <SpinLoading color='primary' />
          </div>
        ) : (
          <>
            {/* 统计卡片 2x2 */}
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
              <Grid columns={2} gap={12}>
                {stats.map((s, i) => (
                  <Grid.Item key={i}>
                    <div style={{
                      textAlign: 'center',
                      padding: '16px 8px',
                      background: s.bg,
                      borderRadius: '10px'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: s.color, marginBottom: '4px' }}>
                        {s.value}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{s.label}</div>
                    </div>
                  </Grid.Item>
                ))}
              </Grid>
            </Card>

            {/* 快捷入口 */}
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
              <div style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                快捷入口
              </div>
              <Grid columns={4} gap={8}>
                {quickActions.map((action, i) => (
                  <Grid.Item key={i}>
                    <div
                      onClick={() => navigate(action.path)}
                      style={{ textAlign: 'center', padding: '8px 0', cursor: 'pointer' }}
                    >
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: '#f8f9fa', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', margin: '0 auto 6px'
                      }}>
                        {action.icon}
                      </div>
                      <div style={{ fontSize: '12px', color: '#333' }}>{action.label}</div>
                    </div>
                  </Grid.Item>
                ))}
              </Grid>
            </Card>

            {/* 最近订单 */}
            <Card style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>最近订单</div>
                <span
                  style={{ fontSize: '13px', color: '#11998e', cursor: 'pointer' }}
                  onClick={() => navigate('/sales/task-hub?tab=orders')}
                >
                  查看全部
                </span>
              </div>
              {recentOrders.map(order => {
                const statusInfo = STATUS_MAP[order.status] || { text: order.status, color: '#999' }
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/sales/order/${order.id}`)}
                    style={{
                      padding: '12px',
                      background: '#fafafa',
                      borderRadius: '10px',
                      marginBottom: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{order.orderNo}</span>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                        background: `${statusInfo.color}15`, color: statusInfo.color
                      }}>
                        {statusInfo.text}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        {order.customerName} · {order.productName}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>
                        ${(order.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

export default SalesDashboard
