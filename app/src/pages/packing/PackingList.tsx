import { useState, useEffect } from 'react'
import { Card, SearchBar, NavBar, Tag, Empty, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { ExclamationCircleOutline } from 'antd-mobile-icons'
import { warehouseApi } from '../../api'

// 运输方式
type TransportMode = 'SEA' | 'AIR'

// 装箱状态
type PackingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

// 装箱任务
interface PackingTask {
  id: string
  jobNo: string
  containerNo: string
  transportMode: TransportMode
  route: string
  etd: string
  status: PackingStatus
  totalOrders: number
  packedOrders: number
  totalPieces: number
  packedPieces: number
  totalWeight: number
  packedWeight: number
  isOverload: boolean
}

const PackingList = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [tasks, setTasks] = useState<PackingTask[]>([])

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res: any = await warehouseApi.listUnits()
        const list = Array.isArray(res) ? res : (res?.data || [])
        const mapped: PackingTask[] = (list as any[]).map((u: any) => {
          // 从 remark 解析路线和 ETD
          let route = '-'
          let etd = '-'
          if (u.remark) {
            const routeMatch = u.remark.match(/路线:(.+?)(?:\s|$)/)
            const etdMatch = u.remark.match(/ETD:(.+?)(?:\s|$)/)
            if (routeMatch) route = routeMatch[1]
            if (etdMatch) etd = etdMatch[1]
          }
          // 状态映射
          let status: PackingStatus = 'NOT_STARTED'
          if (u.status === 'LOADING') status = 'IN_PROGRESS'
          else if (u.status === 'SEALED' || u.status === 'SHIPPED' || u.status === 'ARRIVED') status = 'COMPLETED'

          return {
            id: u.id,
            jobNo: u.jobNo || '-',
            containerNo: u.unitNo || '-',
            transportMode: u.transportMode || 'SEA',
            route,
            etd,
            status,
            totalOrders: u.loadedOrders || 0,
            packedOrders: u.loadedOrders || 0,
            totalPieces: u.loadedPieces || 0,
            packedPieces: u.loadedPieces || 0,
            totalWeight: u.maxWeight || 0,
            packedWeight: u.currentWeight || 0,
            isOverload: (u.currentWeight || 0) > (u.maxWeight || 0),
          }
        })
        setTasks(mapped)
      } catch (err) {
        Toast.show({ icon: 'fail', content: '获取装箱任务失败' })
      }
    }
    fetchTasks()
  }, [])

  // 获取状态文本
  const getStatusText = (status: PackingStatus) => {
    switch (status) {
      case 'NOT_STARTED':
        return '未开始'
      case 'IN_PROGRESS':
        return '装箱中'
      case 'COMPLETED':
        return '已完成'
    }
  }

  // 获取状态颜色
  const getStatusColor = (status: PackingStatus) => {
    switch (status) {
      case 'NOT_STARTED':
        return { color: '#999', bg: '#f5f5f5' }
      case 'IN_PROGRESS':
        return { color: '#1677ff', bg: '#e6f4ff' }
      case 'COMPLETED':
        return { color: '#52c41a', bg: '#f0fdf4' }
      default:
        return { color: '#999', bg: '#f5f5f5' }
    }
  }

  // 获取运输方式文本
  const getTransportModeText = (mode: TransportMode) => {
    return mode === 'SEA' ? '海运' : '空运'
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
      <NavBar onBack={() => navigate(-1)}>装箱记录</NavBar>

      <div style={{ padding: '16px' }}>
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
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => {
            const statusColor = getStatusColor(task.status)
            const progress = task.totalOrders > 0
              ? Math.round((task.packedOrders / task.totalOrders) * 100)
              : 0

            return (
              <Card
                key={task.id}
                onClick={() => navigate(`/packing/task/${task.id}`)}
                style={{
                  marginBottom: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}
              >
                <div>
                  {/* 标题行 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                      {task.jobNo}
                    </div>
                    <Tag
                      color={statusColor.color}
                      fill="outline"
                      style={{
                        '--background-color': statusColor.bg,
                        '--border-color': statusColor.color,
                        '--text-color': statusColor.color
                      }}
                    >
                      {getStatusText(task.status)}
                    </Tag>
                  </div>

                  {/* 基本信息 */}
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.8', marginBottom: '12px' }}>
                    <div>集装箱号：{task.containerNo}</div>
                    <div>运输方式：{getTransportModeText(task.transportMode)}</div>
                    <div>路线：{task.route}</div>
                    <div>预计开船：{task.etd}</div>
                  </div>

                  {/* 进度信息 */}
                  <div style={{
                    background: '#f5f5f5',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#666' }}>装箱进度</span>
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
                        {task.packedOrders}/{task.totalOrders}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#999' }}>件数</div>
                      <div style={{ color: '#333', fontWeight: 'bold', marginTop: '4px' }}>
                        {task.packedPieces}/{task.totalPieces}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#999' }}>重量(kg)</div>
                      <div style={{
                        color: task.isOverload ? '#ff4d4f' : '#333',
                        fontWeight: 'bold',
                        marginTop: '4px'
                      }}>
                        {task.packedWeight}/{task.totalWeight}
                        {task.isOverload && <> <ExclamationCircleOutline style={{ fontSize: '12px' }} /></>}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        ) : (
          <Empty
            description="暂无装箱任务"
            style={{ padding: '60px 0' }}
          />
        )}
      </div>
    </div>
  )
}

export default PackingList
