import { useState, useEffect } from 'react'
import { NavBar, Card, Tag, ProgressBar, Button, Steps, SpinLoading, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { jobApi, orderApi } from '@/api'
import type { ShippingTask, SalesOrder } from '@/types/sales'

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
  LOADING: { text: '装载中', color: '#1677ff' },
  IN_TRANSIT: { text: '运输中', color: '#722ed1' },
  ARRIVED: { text: '已到达', color: '#52c41a' },
  COMPLETED: { text: '已完成', color: '#8c8c8c' },
}

const { Step } = Steps

const ShippingTaskDetail = () => {
  const navigate = useNavigate()
  const { taskId } = useParams<{ taskId: string }>()
  const [task, setTask] = useState<ShippingTask | null>(null)
  const [relatedOrders, setRelatedOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (!taskId) return
      try {
        setLoading(true)
        const [taskRes, ordersRes] = await Promise.all([
          jobApi.get(taskId),
          orderApi.listMaster()
        ])
        const rawTask = (taskRes as any)?.data || null
        setTask(rawTask ? mapServerJobToTask(rawTask) : null)
        const allOrders: SalesOrder[] = (ordersRes as any)?.data || []
        setRelatedOrders(
          allOrders.filter(o => o.status === 'PROCESSING' || o.status === 'SHIPPED').slice(0, 4)
        )
      } catch (e: any) {
        Toast.show({ content: e.message || '加载任务详情失败', icon: 'fail' })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [taskId])

  if (loading) {
    return (
      <div>
        <NavBar onBack={() => navigate(-1)} style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>任务详情</NavBar>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <SpinLoading color='primary' />
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div>
        <NavBar onBack={() => navigate(-1)}>任务详情</NavBar>
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>任务不存在</div>
      </div>
    )
  }

  const statusInfo = STATUS_MAP[task.status] || { text: task.status, color: '#999' }

  const currentStep = task.status === 'LOADING' ? 0 : task.status === 'IN_TRANSIT' ? 1 : task.status === 'ARRIVED' ? 2 : 3

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar
        onBack={() => navigate(-1)}
        style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}
      >
        任务详情
      </NavBar>

      <div style={{ padding: '12px 16px' }}>
        {/* 基本信息 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>{task.jobNo}</span>
            <Tag style={{
              '--background-color': `${statusInfo.color}15`,
              '--text-color': statusInfo.color,
              '--border-color': 'transparent'
            }}>
              {statusInfo.text}
            </Tag>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f8f9fa', borderRadius: '10px', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{task.origin}</div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>起运地</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', color: '#11998e', fontWeight: 'bold' }}>
              {task.type === 'SEA' ? '🚢' : '✈️'} →
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{task.destination}</div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>目的地</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
            <div><span style={{ color: '#999' }}>运输方式：</span><span style={{ color: '#333' }}>{task.type === 'SEA' ? '海运' : '空运'}</span></div>
            <div><span style={{ color: '#999' }}>集装箱号：</span><span style={{ color: '#333' }}>{task.containerNo || '-'}</span></div>
            <div><span style={{ color: '#999' }}>ETD：</span><span style={{ color: '#333' }}>{task.etd}</span></div>
            <div><span style={{ color: '#999' }}>ETA：</span><span style={{ color: '#333' }}>{task.eta}</span></div>
            <div><span style={{ color: '#999' }}>总件数：</span><span style={{ color: '#333' }}>{task.totalPieces}件</span></div>
            <div><span style={{ color: '#999' }}>总重量：</span><span style={{ color: '#333' }}>{task.totalWeight}kg</span></div>
            <div><span style={{ color: '#999' }}>总体积：</span><span style={{ color: '#333' }}>{task.totalVolume}CBM</span></div>
            <div><span style={{ color: '#999' }}>客户数：</span><span style={{ color: '#333' }}>{task.customerCount}</span></div>
          </div>
        </Card>

        {/* 装载率 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>装载率</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>当前装载</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: task.loadRate > 80 ? '#ff4d4f' : '#11998e' }}>
              {task.loadRate}%
            </span>
          </div>
          <ProgressBar
            percent={task.loadRate}
            style={{
              '--fill-color': task.loadRate > 80 ? '#ff4d4f' : '#11998e',
              '--track-color': '#f0f0f0',
              '--track-width': '10px'
            }}
          />
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
            参考价格：{task.price > 0 ? `$${task.price}/CBM` : '-'} · {task.currency}
          </div>
        </Card>

        {/* 运输节点 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>运输进度</div>
          <Steps current={currentStep} direction="vertical" style={{ '--icon-size': '22px' }}>
            <Step title="装载中" description={`ETD: ${task.etd}`} />
            <Step title="运输中" description={task.type === 'SEA' ? '海上运输' : '空中运输'} />
            <Step title="已到达" description={`ETA: ${task.eta}`} />
            <Step title="已完成" description="配送完成" />
          </Steps>
        </Card>

        {/* 关联订单 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
            关联订单（{task.orderCount}）
          </div>
          {relatedOrders.map(order => (
            <div
              key={order.id}
              onClick={() => navigate(`/sales/order/${order.id}`)}
              style={{
                padding: '10px 12px', background: '#fafafa', borderRadius: '8px',
                marginBottom: '8px', cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#333' }}>{order.orderNo}</span>
                <span style={{ fontSize: '13px', color: '#333' }}>${(order.amount || 0).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#999' }}>
                {order.customerName} · {order.totalPieces}件 · {order.totalWeight}kg
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* 底部按钮 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px', background: '#fff',
        borderTop: '1px solid #f0f0f0', zIndex: 100
      }}>
        <Button
          block
          color="primary"
          size="large"
          style={{ '--border-radius': '10px', '--background-color': '#11998e', '--border-color': '#11998e' }}
          onClick={() => navigate(`/sales/quote/${task.id}`)}
        >
          向客户报价
        </Button>
      </div>
    </div>
  )
}

export default ShippingTaskDetail
