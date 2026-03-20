import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { NavBar, Card, Tag, ProgressBar, Steps, List, SpinLoading, Toast, Button } from 'antd-mobile'
import { GlobalOutline, SendOutline } from 'antd-mobile-icons'
import { jobApi, warehouseApi } from '@/api'
import { isOriginWarehouseVisibleJob } from '@/utils/taskVisibility'

type TaskStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'DEPARTED'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'CLEARED'
  | 'COMPLETED'
  | 'CANCELLED'
  | string

interface JobDetail {
  jobNo: string
  status: TaskStatus
  transportType: 'SEA' | 'AIR' | string
  route: string
  pol: string
  pod: string
  etd?: string
  eta?: string
  stats: {
    orders: number
    pieces: number
    weight: number
    volume: number
  }
  capacity: {
    weight: number
    volume: number
  }
  shippingUnitIds: string[]
}

interface UnitBrief {
  id: string
  unitNo: string
  status: string
  loadedOrders: number
  currentWeight: number
  currentVolume: number
}

const STATUS_META: Record<string, { text: string; color: string; step: number }> = {
  PLANNED: { text: '已计划', color: '#1677ff', step: 0 },
  IN_PROGRESS: { text: '执行中', color: '#1677ff', step: 0 },
  DEPARTED: { text: '已发运', color: '#722ed1', step: 1 },
  IN_TRANSIT: { text: '运输中', color: '#722ed1', step: 1 },
  ARRIVED: { text: '已到达', color: '#52c41a', step: 2 },
  CLEARED: { text: '已清关', color: '#52c41a', step: 2 },
  COMPLETED: { text: '已完成', color: '#8c8c8c', step: 3 },
  CANCELLED: { text: '已取消', color: '#8c8c8c', step: 3 },
}

const UNIT_STATUS_TEXT: Record<string, string> = {
  EMPTY: '待装箱',
  LOADING: '装箱中',
  SEALED: '已封箱',
  SHIPPED: '已发运',
  ARRIVED: '已到港',
}

const { Step } = Steps

const TaskPlanDetail = () => {
  const navigate = useNavigate()
  const { taskId } = useParams<{ taskId: string }>()
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<JobDetail | null>(null)
  const [units, setUnits] = useState<UnitBrief[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!taskId) {
        setTask(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const [jobRes, unitRes] = await Promise.all([
          jobApi.get(taskId),
          warehouseApi.listUnits().catch(() => ({ data: [] })),
        ])

        const rawJob = (jobRes as any)?.data || jobRes
        if (!rawJob) {
          setTask(null)
          setUnits([])
          return
        }

        const mappedTask: JobDetail = {
          jobNo: rawJob.jobNo || rawJob.id || taskId,
          status: rawJob.status || 'PLANNED',
          transportType: rawJob.transportType || 'SEA',
          route: rawJob.route || '',
          pol: rawJob.pol || '',
          pod: rawJob.pod || '',
          etd: rawJob.etd || '',
          eta: rawJob.eta || '',
          stats: {
            orders: Number(rawJob?.stats?.orders || 0),
            pieces: Number(rawJob?.stats?.pieces || 0),
            weight: Number(rawJob?.stats?.weight || 0),
            volume: Number(rawJob?.stats?.volume || 0),
          },
          capacity: {
            weight: Number(rawJob?.capacity?.weight || 0),
            volume: Number(rawJob?.capacity?.volume || 0),
          },
          shippingUnitIds: Array.isArray(rawJob?.shippingUnitIds) ? rawJob.shippingUnitIds : [],
        }

        const unitRaw = (unitRes as any)?.data || unitRes || []
        const allUnits = Array.isArray(unitRaw) ? unitRaw : []
        const relatedUnitIdSet = new Set(mappedTask.shippingUnitIds.map((id) => String(id)))
        const related = allUnits
          .filter((u: any) => (
            String(u.jobNo || '') === String(mappedTask.jobNo || '') ||
            relatedUnitIdSet.has(String(u.id))
          ))
          .map((u: any) => ({
            id: String(u.id),
            unitNo: u.unitNo || u.id || '-',
            status: u.status || '-',
            loadedOrders: Number(u.loadedOrders || 0),
            currentWeight: Number(u.currentWeight || 0),
            currentVolume: Number(u.currentVolume || 0),
          }))

        setTask(mappedTask)
        setUnits(related)
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: e.message || '加载任务计划失败' })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [taskId])

  const statusMeta = useMemo(() => {
    if (!task) return { text: '-', color: '#999', step: 0 }
    return STATUS_META[task.status] || { text: task.status, color: '#999', step: 0 }
  }, [task])

  const routeText = useMemo(() => {
    if (!task) return '-'
    if (task.route) return task.route
    const from = task.pol || '-'
    const to = task.pod || '-'
    return `${from} → ${to}`
  }, [task])

  const loadRate = useMemo(() => {
    if (!task) return 0
    if (task.capacity.volume > 0) {
      return Math.min(100, Math.round((task.stats.volume / task.capacity.volume) * 100))
    }
    return 0
  }, [task])

  const visibleForOrigin = useMemo(() => {
    if (!task) return false
    return isOriginWarehouseVisibleJob(task.status)
  }, [task])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>任务计划详情</NavBar>
        <div style={{ textAlign: 'center', padding: '56px 0' }}>
          <SpinLoading color="primary" />
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>任务计划详情</NavBar>
        <div style={{ textAlign: 'center', padding: '56px 16px', color: '#999' }}>
          任务不存在或已删除
        </div>
      </div>
    )
  }

  if (!visibleForOrigin) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>任务计划详情</NavBar>
        <div style={{ textAlign: 'center', padding: '56px 16px', color: '#999' }}>
          当前任务已发运，请在到达国仓管端查看
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '84px' }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        任务计划详情
      </NavBar>

      <div style={{ padding: '12px 16px' }}>
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px', fontWeight: 600 }}>{task.jobNo}</span>
            <Tag style={{
              '--background-color': `${statusMeta.color}15`,
              '--text-color': statusMeta.color,
              '--border-color': 'transparent'
            }}>
              {statusMeta.text}
            </Tag>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {task.transportType === 'AIR'
                ? <SendOutline style={{ fontSize: '20px', color: '#52c41a' }} />
                : <GlobalOutline style={{ fontSize: '20px', color: '#1677ff' }} />}
              <span style={{ fontSize: '14px', color: '#333' }}>
                {task.transportType === 'AIR' ? '空运' : '海运'}
              </span>
            </div>
            <span style={{ fontSize: '13px', color: '#666' }}>{routeText}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
            <div><span style={{ color: '#999' }}>ETD：</span><span>{task.etd ? task.etd.slice(0, 10) : '-'}</span></div>
            <div><span style={{ color: '#999' }}>ETA：</span><span>{task.eta ? task.eta.slice(0, 10) : '-'}</span></div>
            <div><span style={{ color: '#999' }}>订单数：</span><span>{task.stats.orders}</span></div>
            <div><span style={{ color: '#999' }}>件数：</span><span>{task.stats.pieces}</span></div>
            <div><span style={{ color: '#999' }}>重量：</span><span>{task.stats.weight}kg</span></div>
            <div><span style={{ color: '#999' }}>体积：</span><span>{task.stats.volume}CBM</span></div>
          </div>
        </Card>

        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>装载率</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>
              {task.stats.volume} / {task.capacity.volume || 0} CBM
            </span>
            <span style={{ fontWeight: 600, color: loadRate >= 80 ? '#52c41a' : '#1677ff' }}>
              {loadRate}%
            </span>
          </div>
          <ProgressBar percent={loadRate} style={{ '--track-width': '8px' }} />
        </Card>

        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>运输进度</div>
          <Steps current={statusMeta.step} direction="vertical" style={{ '--icon-size': '20px' }}>
            <Step title="任务执行中" description={`ETD: ${task.etd ? task.etd.slice(0, 10) : '-'}`} />
            <Step title="已发运/运输中" description={task.transportType === 'AIR' ? '空运干线运输' : '海运干线运输'} />
            <Step title="已到达/已清关" description={`ETA: ${task.eta ? task.eta.slice(0, 10) : '-'}`} />
            <Step title="任务完成" description="全部环节处理完毕" />
          </Steps>
        </Card>

        <Card style={{ borderRadius: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>
            关联集装单元（{units.length}）
          </div>
          {units.length === 0 ? (
            <div style={{ color: '#999', fontSize: '13px', padding: '8px 0' }}>
              暂无关联集装单元
            </div>
          ) : (
            <List>
              {units.map((unit) => (
                <List.Item
                  key={unit.id}
                  onClick={() => navigate(`/packing/task/${unit.id}`)}
                  arrow={true}
                  description={`${UNIT_STATUS_TEXT[unit.status] || unit.status} · ${unit.loadedOrders}单 · ${unit.currentWeight}kg · ${unit.currentVolume}CBM`}
                >
                  {unit.unitNo}
                </List.Item>
              ))}
            </List>
          )}
        </Card>
      </div>

      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '12px 16px',
        borderTop: '1px solid #f0f0f0',
        background: '#fff'
      }}>
        <Button block color="primary" onClick={() => navigate('/task-hub?tab=packing')}>
          前往任务中心继续处理
        </Button>
      </div>
    </div>
  )
}

export default TaskPlanDetail
