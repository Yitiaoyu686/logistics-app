import { useState, useEffect } from 'react'
import { Card, SearchBar, Tag, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { GlobalOutline } from 'antd-mobile-icons'
import { orderApi, warehouseApi } from '@/api'
import { isDestWarehouseVisibleUnit } from '@/utils/taskVisibility'

interface ContainerTask {
  id: string
  jobNo: string
  containerNo: string
  transportMode: string
  route: string
  eta: string
  status: 'PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'INBOUND_IN_PROGRESS' | 'COMPLETED'
  totalOrders: number
  inboundOrders: number
  totalPieces: number
  inboundPieces: number
  totalWeight: number
  inboundWeight: number
}

const mapUnitStatus = (
  unitStatus: string,
  inboundOrders: number,
  totalOrders: number
): ContainerTask['status'] => {
  if (totalOrders > 0 && inboundOrders >= totalOrders) return 'COMPLETED'
  if (inboundOrders > 0) return 'INBOUND_IN_PROGRESS'
  if (unitStatus === 'ARRIVED') return 'ARRIVED'
  if (unitStatus === 'SEALED' || unitStatus === 'SHIPPED') return 'IN_TRANSIT'
  return 'PENDING'
}

const ContainerTaskList = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [tasks, setTasks] = useState<ContainerTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true)
      try {
        const [unitRes, usStockRes] = await Promise.all([
          warehouseApi.listUnits(),
          warehouseApi.listStock({ warehouse: 'US' }),
        ])
        const raw = (unitRes as any)?.data || []
        const usStocks = (usStockRes as any)?.data || []
        const usStockSubOrderNoSet = new Set(
          (usStocks as any[]).map((item: any) => item?.subOrderNo).filter(Boolean)
        )

        const visibleUnits = (raw as any[]).filter((u: any) => isDestWarehouseVisibleUnit(u.status))
        const mapped: ContainerTask[] = await Promise.all(
          visibleUnits.map(async (u: any) => {
            let subs: any[] = []
            try {
              const subRes: any = await orderApi.listSub({ shippingUnitId: u.id, pageSize: 500 })
              subs = subRes?.data || []
            } catch {
              subs = []
            }

            const inboundSubs = subs.filter((s) => usStockSubOrderNoSet.has(s.subOrderNo))
            const totalOrders = subs.length || Number(u.orderIds?.length || 0)
            const inboundOrders = inboundSubs.length
            const totalPieces = subs.reduce((sum, s) => sum + Number(s.pieces || 0), 0) || Number(u.loadedPieces || 0)
            const inboundPieces = inboundSubs.reduce((sum, s) => sum + Number(s.pieces || 0), 0)
            const totalWeight = subs.reduce((sum, s) => sum + Number(s.weight || 0), 0) || Number(u.currentWeight || 0)
            const inboundWeight = inboundSubs.reduce((sum, s) => sum + Number(s.weight || 0), 0)

            return {
              id: u.id,
              jobNo: u.jobNo || u.unitNo || '-',
              containerNo: u.containerNo || u.unitNo || '-',
              transportMode: u.transportMode || 'SEA',
              route: u.warehouse ? `${u.warehouse} → ${u.location || '目的仓'}` : '-',
              eta: u.createdAt ? String(u.createdAt).replace('T', ' ').slice(0, 10) : '-',
              status: mapUnitStatus(u.status, inboundOrders, totalOrders),
              totalOrders,
              inboundOrders,
              totalPieces,
              inboundPieces,
              totalWeight,
              inboundWeight,
            }
          })
        )
        setTasks(mapped)
      } catch (err: any) {
        Toast.show({ content: err.message || '集装箱任务加载失败' })
      } finally {
        setLoading(false)
      }
    }
    fetchTasks()
  }, [])

  // 获取状态信息
  const getStatusInfo = (status: ContainerTask['status']) => {
    const statusMap = {
      'PENDING': { text: '待发运', color: '#999' },
      'IN_TRANSIT': { text: '运输中', color: '#1677ff' },
      'ARRIVED': { text: '已到达', color: '#52c41a' },
      'INBOUND_IN_PROGRESS': { text: '入库中', color: '#faad14' },
      'COMPLETED': { text: '已完成', color: '#13c2c2' }
    }
    return statusMap[status] || { text: status, color: '#999' }
  }

  // 过滤任务
  const filteredTasks = tasks.filter(task => {
    if (!searchText) return true
    return task.jobNo.includes(searchText) ||
           task.containerNo.includes(searchText) ||
           task.route.includes(searchText)
  })

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
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
          <GlobalOutline style={{ fontSize: '24px' }} /> 集装箱任务
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
          任务总数 {tasks.length} 个
        </p>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* 搜索栏 */}
        <SearchBar
          placeholder="搜索任务号/集装箱号/路线"
          value={searchText}
          onChange={setSearchText}
          style={{
            '--border-radius': '8px',
            '--background': '#fff',
            marginBottom: '16px'
          }}
        />

        {/* 任务列表 */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '32px 0' }}>加载中...</div>
        ) : filteredTasks.map((task) => {
          const statusInfo = getStatusInfo(task.status)
          const progress = task.totalOrders > 0
            ? Math.round((task.inboundOrders / task.totalOrders) * 100)
            : 0

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
                {/* 标题行 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                    {task.containerNo}
                  </div>
                  <Tag color={statusInfo.color} fill="solid">
                    {statusInfo.text}
                  </Tag>
                </div>

                {/* 基本信息 */}
                <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.8', marginBottom: '12px' }}>
                  <div>任务号：{task.jobNo}</div>
                  <div>运输方式：{task.transportMode === 'SEA' ? '海运' : '空运'}</div>
                  <div>路线：{task.route}</div>
                  <div>预计到达：{task.eta}</div>
                </div>

                {/* 进度信息 */}
                <div style={{
                  background: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#666' }}>入库进度</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1677ff' }}>
                      {progress}%
                    </span>
                  </div>
                  <div style={{
                    height: '6px',
                    background: '#e5e5e5',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: '#1677ff',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>

                {/* 统计信息 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '8px',
                  fontSize: '12px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999' }}>订单</div>
                    <div style={{ color: '#333', fontWeight: 'bold', marginTop: '4px' }}>
                      {task.inboundOrders}/{task.totalOrders}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999' }}>件数</div>
                    <div style={{ color: '#333', fontWeight: 'bold', marginTop: '4px' }}>
                      {task.inboundPieces}/{task.totalPieces}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#999' }}>重量(kg)</div>
                    <div style={{ color: '#333', fontWeight: 'bold', marginTop: '4px' }}>
                      {task.inboundWeight}/{task.totalWeight}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default ContainerTaskList
