import { useState, useEffect, useMemo } from 'react'
import { Card, Badge, Tabs, SearchBar, Tag, ProgressBar, Button, Toast, ActionSheet, SpinLoading } from 'antd-mobile'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PhoneFill } from 'antd-mobile-icons'
import { jobApi, clientApi, orderApi, salesApi } from '@/api'
import type { ShippingTask, SalesCustomer, SalesOrder, PendingPayment } from '@/types/sales'

// Server Job → ShippingTask 状态映射
function mapJobStatusToTaskStatus(s: string): ShippingTask['status'] {
  switch (s) {
    case 'PLANNED':
    case 'IN_PROGRESS': return 'LOADING'
    case 'DEPARTED':
    case 'IN_TRANSIT': return 'IN_TRANSIT'
    case 'ARRIVED':
    case 'CLEARED': return 'ARRIVED'
    case 'COMPLETED':
    default: return 'COMPLETED'
  }
}

// Server Job → ShippingTask 字段映射
function mapServerJobToTask(j: any): ShippingTask {
  const routeParts = (j.route || '').split('→').map((p: string) => p.trim())
  return {
    id: j.jobNo || j.id,
    jobNo: j.jobNo || '',
    type: j.transportType === 'AIR' ? 'AIR' : 'SEA',
    origin: j.pol || routeParts[0] || '',
    destination: j.pod || routeParts[1] || '',
    etd: j.etd || '',
    eta: j.eta || '',
    status: mapJobStatusToTaskStatus(j.status),
    containerNo: j.shippingUnitIds?.[0] || undefined,
    loadRate: (j.capacity?.volume > 0)
      ? Math.round((j.stats?.volume || 0) / j.capacity.volume * 100)
      : 0,
    totalPieces: j.stats?.pieces || 0,
    totalWeight: j.stats?.weight || 0,
    totalVolume: j.stats?.volume || 0,
    price: 0,
    currency: 'USD',
    customerCount: j.stats?.orders || 0,
    orderCount: j.stats?.orders || 0,
  }
}

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

const CUST_STATUS_MAP: Record<string, { text: string; color: string }> = {
  ACTIVE: { text: '活跃', color: '#52c41a' },
  DORMANT: { text: '沉睡', color: '#faad14' },
  FROZEN: { text: '冻结', color: '#8c8c8c' },
}

const TASK_STATUS_MAP: Record<string, { text: string; color: string }> = {
  LOADING: { text: '装载中', color: '#1677ff' },
  IN_TRANSIT: { text: '运输中', color: '#722ed1' },
  ARRIVED: { text: '已到达', color: '#52c41a' },
  COMPLETED: { text: '已完成', color: '#8c8c8c' },
}

const SalesWorkHub = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'tasks'
  const [activeTab, setActiveTab] = useState(initialTab)
  const [taskSubTab, setTaskSubTab] = useState<'SEA' | 'AIR'>('SEA')
  const [orderSubTab, setOrderSubTab] = useState('all')
  const [customerSearch, setCustomerSearch] = useState('')
  const [reminderTarget, setReminderTarget] = useState<string | null>(null)

  const [shippingTasks, setShippingTasks] = useState<ShippingTask[]>([])
  const [customers, setCustomers] = useState<SalesCustomer[]>([])
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([])
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [tasksRes, customersRes, ordersRes, paymentsRes] = await Promise.allSettled([
          jobApi.list(),
          clientApi.list(),
          orderApi.listMaster(),
          salesApi.pendingPayments()
        ])

        const serverJobs = tasksRes.status === 'fulfilled' ? ((tasksRes.value as any)?.data || []) : []
        const customers = customersRes.status === 'fulfilled' ? ((customersRes.value as any)?.data || []) : []
        const orders = ordersRes.status === 'fulfilled' ? ((ordersRes.value as any)?.data || []) : []
        const payments = paymentsRes.status === 'fulfilled' ? ((paymentsRes.value as any)?.data || []) : []

        setShippingTasks(serverJobs.map(mapServerJobToTask))
        setCustomers(customers)
        setSalesOrders(orders)
        setPendingPayments(payments)

        if ([tasksRes, customersRes, ordersRes, paymentsRes].some(r => r.status === 'rejected')) {
          Toast.show({ content: '部分数据加载失败，已展示可用数据', icon: 'fail' })
        }
      } catch (e: any) {
        Toast.show({ content: e.message || '加载失败', icon: 'fail' })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Tasks
  const filteredTasks = useMemo(() =>
    shippingTasks.filter(t => t.type === taskSubTab),
    [taskSubTab, shippingTasks]
  )

  // Customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers
    const q = customerSearch.toLowerCase()
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.shortCode.toLowerCase().includes(q) ||
      c.contact?.name?.toLowerCase().includes(q)
    )
  }, [customerSearch, customers])

  // Orders
  const filteredOrders = useMemo(() => {
    if (orderSubTab === 'all') return salesOrders
    if (orderSubTab === 'active') return salesOrders.filter(o => ['PENDING', 'PROCESSING', 'SHIPPED'].includes(o.status))
    return salesOrders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status))
  }, [orderSubTab, salesOrders])

  // Tab counts
  const taskCount = shippingTasks.filter(t => t.status === 'LOADING' || t.status === 'IN_TRANSIT').length
  const custCount = customers.filter(c => c.status === 'ACTIVE').length
  const orderCount = salesOrders.filter(o => !['COMPLETED', 'DELIVERED'].includes(o.status)).length
  const payCount = pendingPayments.length

  // Render tasks tab
  const renderTasks = () => (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {(['SEA', 'AIR'] as const).map(type => (
          <Tag
            key={type}
            onClick={() => setTaskSubTab(type)}
            style={{
              '--background-color': taskSubTab === type ? '#11998e' : '#f0f0f0',
              '--text-color': taskSubTab === type ? '#fff' : '#666',
              '--border-color': 'transparent',
              padding: '4px 16px',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {type === 'SEA' ? '海运' : '空运'}
          </Tag>
        ))}
      </div>
      {filteredTasks.map(task => {
        const statusInfo = TASK_STATUS_MAP[task.status] || { text: task.status, color: '#999' }
        return (
          <Card
            key={task.id}
            onClick={() => navigate(`/sales/task/${task.id}`)}
            style={{ borderRadius: '12px', marginBottom: '12px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#333' }}>{task.jobNo}</span>
              <Tag style={{
                '--background-color': `${statusInfo.color}15`,
                '--text-color': statusInfo.color,
                '--border-color': 'transparent',
                fontSize: '11px'
              }}>
                {statusInfo.text}
              </Tag>
            </div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              {task.origin} → {task.destination} · {task.type === 'SEA' ? '海运' : '空运'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#999' }}>ETD: {task.etd}</span>
              <span style={{ fontSize: '12px', color: '#999' }}>ETA: {task.eta}</span>
            </div>
            <div style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>装载率</span>
                <span style={{ fontSize: '12px', fontWeight: '500', color: task.loadRate > 80 ? '#ff4d4f' : '#11998e' }}>
                  {task.loadRate}%
                </span>
              </div>
              <ProgressBar
                percent={task.loadRate}
                style={{
                  '--fill-color': task.loadRate > 80 ? '#ff4d4f' : '#11998e',
                  '--track-color': '#f0f0f0',
                  '--track-width': '6px'
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: '#999' }}>
                {task.customerCount}个客户 · {task.orderCount}个订单
              </span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#11998e' }}>
                {task.price > 0 ? `$${task.price}/CBM` : '-'}
              </span>
            </div>
          </Card>
        )
      })}
    </div>
  )

  // Render customers tab
  const renderCustomers = () => (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <SearchBar
            placeholder="搜索客户名称/编号/联系人"
            value={customerSearch}
            onChange={setCustomerSearch}
            style={{ '--border-radius': '8px' }}
          />
        </div>
        <Button
          color="primary"
          onClick={() => navigate('/sales/customer/create')}
          style={{ '--border-radius': '8px', '--background-color': '#11998e', '--border-color': '#11998e' }}
        >
          新增客户
        </Button>
      </div>
      {filteredCustomers.map(cust => {
        const statusInfo = CUST_STATUS_MAP[cust.status] || { text: cust.status, color: '#999' }
        return (
          <Card
            key={cust.id}
            onClick={() => navigate(`/sales/customer/${cust.id}`)}
            style={{ borderRadius: '12px', marginBottom: '12px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: `${statusInfo.color}15`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: '600', color: statusInfo.color
                }}>
                  {cust.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>{cust.name}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{cust.shortCode} · {cust.contact?.name}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag style={{
                  '--background-color': `${statusInfo.color}15`,
                  '--text-color': statusInfo.color,
                  '--border-color': 'transparent',
                  fontSize: '11px'
                }}>
                  {statusInfo.text}
                </Tag>
                <div
                  onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${cust.contact?.phone}` }}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: '#e6f4ff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <PhoneFill style={{ fontSize: '14px', color: '#1677ff' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
              <span>{cust.totalOrders} 单</span>
              <span>{cust.country}</span>
              <span>最近: {cust.lastOrderTime ? new Date(cust.lastOrderTime).toLocaleDateString() : '-'}</span>
            </div>
          </Card>
        )
      })}
    </div>
  )

  // Render orders tab
  const renderOrders = () => (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {[
          { key: 'all', label: '全部' },
          { key: 'active', label: '进行中' },
          { key: 'done', label: '已完成' }
        ].map(sub => (
          <Tag
            key={sub.key}
            onClick={() => setOrderSubTab(sub.key)}
            style={{
              '--background-color': orderSubTab === sub.key ? '#11998e' : '#f0f0f0',
              '--text-color': orderSubTab === sub.key ? '#fff' : '#666',
              '--border-color': 'transparent',
              padding: '4px 16px',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {sub.label}
          </Tag>
        ))}
      </div>
      {filteredOrders.map(order => {
        const statusInfo = STATUS_MAP[order.status] || { text: order.status, color: '#999' }
        const payInfo = PAY_STATUS_MAP[order.paymentStatus] || { text: order.paymentStatus, color: '#999' }
        return (
          <Card
            key={order.id}
            onClick={() => navigate(`/sales/order/${order.id}`)}
            style={{ borderRadius: '12px', marginBottom: '12px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>{order.orderNo}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <Tag style={{
                  '--background-color': `${statusInfo.color}15`,
                  '--text-color': statusInfo.color,
                  '--border-color': 'transparent',
                  fontSize: '11px'
                }}>
                  {statusInfo.text}
                </Tag>
                <Tag style={{
                  '--background-color': `${payInfo.color}15`,
                  '--text-color': payInfo.color,
                  '--border-color': 'transparent',
                  fontSize: '11px'
                }}>
                  {payInfo.text}
                </Tag>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
              {order.customerName} · {order.productName}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#999' }}>
                {order.destination} · {order.shippingType === 'SEA' ? '海运' : '空运'} · {order.totalPieces}件
              </span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                ${(order.amount || 0).toLocaleString()}
              </span>
            </div>
          </Card>
        )
      })}
    </div>
  )

  // Render collection tab
  const renderCollection = () => (
    <div>
      {[...pendingPayments]
        .sort((a, b) => b.overdueDays - a.overdueDays)
        .map(pay => (
          <Card
            key={pay.id}
            style={{ borderRadius: '12px', marginBottom: '12px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>{pay.orderNo}</span>
              {pay.overdueDays > 0 && (
                <Tag style={{
                  '--background-color': '#fff2f0',
                  '--text-color': '#ff4d4f',
                  '--border-color': 'transparent',
                  fontSize: '11px'
                }}>
                  逾期{pay.overdueDays}天
                </Tag>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              {pay.customerName} · 到期日: {pay.dueDate}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', background: '#fafafa', borderRadius: '8px', marginBottom: '8px'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#999' }}>待收金额</div>
                <div style={{
                  fontSize: '18px', fontWeight: 'bold',
                  color: pay.overdueDays > 0 ? '#ff4d4f' : '#333'
                }}>
                  ${(pay.pendingAmount || 0).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#999' }}>已收/总额</div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  ${(pay.paidAmount || 0).toLocaleString()} / ${(pay.totalAmount || 0).toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                size="small"
                color="primary"
                fill="solid"
                style={{ '--border-radius': '6px', flex: 1, '--background-color': '#11998e', '--border-color': '#11998e' }}
                onClick={() => setReminderTarget(pay.id)}
              >
                发送催款
              </Button>
              <Button
                size="small"
                fill="outline"
                style={{ '--border-radius': '6px', flex: 1 }}
                onClick={() => navigate(`/sales/reminder/${pay.id}`)}
              >
                催款记录
              </Button>
            </div>
          </Card>
        ))}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      {/* 头部 */}
      <div style={{
        background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        padding: '20px 16px 12px',
        color: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>工作中心</h2>
          <span style={{ fontSize: '13px', opacity: 0.9 }}>
            {taskCount + orderCount + payCount} 项待办
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', position: 'sticky', top: '52px', zIndex: 99 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{
            '--title-font-size': '14px',
            '--active-line-color': '#11998e',
            '--active-title-color': '#11998e',
          }}
        >
          <Tabs.Tab title={<Badge content={taskCount > 0 ? taskCount : null} style={{ '--right': '-10px', '--top': '-4px' }}>任务</Badge>} key="tasks" />
          <Tabs.Tab title={<Badge content={custCount > 0 ? custCount : null} style={{ '--right': '-10px', '--top': '-4px' }}>客户</Badge>} key="customers" />
          <Tabs.Tab title={<Badge content={orderCount > 0 ? orderCount : null} style={{ '--right': '-10px', '--top': '-4px' }}>订单</Badge>} key="orders" />
          <Tabs.Tab title={<Badge content={payCount > 0 ? payCount : null} style={{ '--right': '-10px', '--top': '-4px' }}>催款</Badge>} key="collection" />
        </Tabs>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <SpinLoading color='primary' />
          </div>
        ) : (
          <>
            {activeTab === 'tasks' && renderTasks()}
            {activeTab === 'customers' && renderCustomers()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'collection' && renderCollection()}
          </>
        )}
      </div>

      <ActionSheet
        visible={!!reminderTarget}
        onClose={() => setReminderTarget(null)}
        actions={[
          { text: '短信催款', key: 'SMS' },
          { text: '电话催款', key: 'PHONE' },
          { text: '邮件催款', key: 'EMAIL' },
          { text: '微信催款', key: 'WECHAT' },
        ]}
        onAction={(action) => {
          const methodMap: Record<string, string> = { SMS: '短信', PHONE: '电话', EMAIL: '邮件', WECHAT: '微信' }
          Toast.show({ content: `${methodMap[action.key as string]}催款通知已发送`, icon: 'success' })
          setReminderTarget(null)
        }}
        cancelText="取消"
      />
    </div>
  )
}

export default SalesWorkHub
