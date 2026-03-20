import { useState, useEffect, useMemo } from 'react'
import { Card, SearchBar, Button, Grid, ProgressBar, Tag, SpinLoading } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import {
  ScanningOutline,
  UnorderedListOutline,
  AddCircleOutline,
  AppstoreOutline,
  FileOutline,
  UndoOutline,
  SearchOutline,
  GlobalOutline,
  SendOutline,
  ContentOutline
} from 'antd-mobile-icons'
import FloatingScanButton from '@/components/FloatingScanButton'
import { warehouseApi, jobApi } from '@/api'
import { isOriginWarehouseVisibleJob } from '@/utils/taskVisibility'

const Dashboard = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(true)

  // 从 localStorage 读取用户信息
  const userInfo = useMemo(() => {
    try {
      const stored = localStorage.getItem('user')
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return { name: '仓管员', warehouseName: '仓库' }
  }, [])

  // 今日统计数据
  const [todayStats, setTodayStats] = useState([
    { label: '今日入库', value: 0, unit: '件', color: '#1677ff' },
    { label: '今日装箱', value: 0, unit: '单', color: '#52c41a' },
    { label: '待处理', value: 0, unit: '项', color: '#faad14' }
  ])

  // 任务计划数据
  const [taskPlans, setTaskPlans] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // 并行请求入库记录、集装单元和任务列表
        const [inboundRes, unitsRes, jobsRes] = await Promise.all([
          warehouseApi.listInbound({ warehouse: 'CN' }).catch(() => ({ data: [] })),
          warehouseApi.listUnits().catch(() => ({ data: [] })),
          jobApi.list().catch(() => ({ data: [] }))
        ])

        const inboundList = Array.isArray(inboundRes) ? inboundRes : (inboundRes as any)?.data || []
        const unitsList = Array.isArray(unitsRes) ? unitsRes : (unitsRes as any)?.data || []
        const jobsList = Array.isArray(jobsRes) ? jobsRes : (jobsRes as any)?.data || []

        // 统计今日数据
        const today = new Date().toISOString().slice(0, 10)
        const todayInbound = inboundList.filter((r: any) => r.createdAt?.startsWith(today))
        const loadingUnits = unitsList.filter((u: any) => u.status === 'LOADING' || u.status === 'EMPTY')
        const pendingCount = loadingUnits.length

        setTodayStats([
          { label: '今日入库', value: todayInbound.length, unit: '件', color: '#1677ff' },
          { label: '装箱中', value: unitsList.filter((u: any) => u.status === 'LOADING').length, unit: '单', color: '#52c41a' },
          { label: '待处理', value: pendingCount, unit: '项', color: '#faad14' }
        ])

        // 过滤活跃任务
        const activeJobs = jobsList
          .filter((j: any) => isOriginWarehouseVisibleJob(j.status))
          .slice(0, 5)
          .map((j: any) => {
            // 计算装载率（优先体积口径）
            const unitCount = unitsList.filter((u: any) => u.jobNo === j.jobNo).length
            const volumeRate = j?.capacity?.volume > 0
              ? Math.min(100, Math.round(((j?.stats?.volume || 0) / j.capacity.volume) * 100))
              : 0
            return {
              id: j.jobNo || j.id,
              jobNo: j.jobNo || j.id,
              transportMode: j.transportType || 'SEA',
              route: j.route || `${j.pol || '-'} → ${j.pod || '-'}`,
              etd: j.etd ? j.etd.slice(0, 10) : '-',
              loadingRate: volumeRate,
              containerCount: unitCount
            }
          })

        setTaskPlans(activeJobs)
      } catch (e) {
        console.error('Dashboard fetch error:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      paddingBottom: '60px'
    }}>
      {/* 顶部欢迎信息 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '24px 16px',
        color: 'white',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
          你好，{userInfo.name}
        </h2>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
          {userInfo.warehouseName || '仓库'}
        </p>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* 今日数据统计 */}
        <div style={{
          display: 'flex',
          gap: '10px',
          margin: '16px 0'
        }}>
          {todayStats.map((stat, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                background: '#fff',
                borderRadius: '12px',
                padding: '14px 8px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: stat.color,
                lineHeight: 1.2,
                marginBottom: '4px'
              }}>
                {loading ? <SpinLoading style={{ '--size': '20px' }} /> : stat.value}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* 订单查询 */}
        <Card
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
            <SearchOutline style={{ fontSize: '16px' }} /> 订单查询
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <SearchBar
                placeholder="搜索订单号/客户/快递单号"
                value={searchText}
                onChange={setSearchText}
                style={{
                  '--border-radius': '8px',
                  '--background': '#f5f5f5',
                  '--height': '40px'
                }}
              />
            </div>
            <Button
              color="primary"
              fill="solid"
              onClick={() => navigate('/scan-order')}
              style={{
                '--border-radius': '8px',
                fontSize: '20px',
                padding: '0 12px',
                height: '40px'
              }}
            >
              <ScanningOutline />
            </Button>
          </div>
        </Card>

        {/* 任务计划 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              <UnorderedListOutline style={{ fontSize: '16px' }} /> 任务计划
            </h3>
            <Button
              size="small"
              fill="none"
              onClick={() => navigate('/task-hub?tab=packing')}
              style={{ fontSize: '13px', color: '#1677ff' }}
            >
              查看全部 →
            </Button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <SpinLoading style={{ '--size': '24px' }} />
            </div>
          ) : taskPlans.length === 0 ? (
            <Card style={{ borderRadius: '12px', textAlign: 'center', padding: '20px', color: '#999' }}>
              暂无活跃任务
            </Card>
          ) : (
            taskPlans.map((task) => (
              <Card
                key={task.id}
                onClick={() => navigate(`/tasks/${task.id}`)}
                style={{
                  marginBottom: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '28px' }}>
                    {task.transportMode === 'SEA' ? <GlobalOutline style={{ fontSize: '28px', color: '#1677ff' }} /> : <SendOutline style={{ fontSize: '28px', color: '#52c41a' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                        {task.jobNo}
                      </span>
                      <Tag
                        style={{
                          '--background-color': task.transportMode === 'SEA' ? '#e6f4ff' : '#f0fdf4',
                          '--text-color': task.transportMode === 'SEA' ? '#1677ff' : '#52c41a',
                          '--border-color': 'transparent',
                          fontSize: '10px',
                          padding: '0 6px'
                        }}
                      >
                        {task.transportMode === 'SEA' ? '海运' : '空运'}
                      </Tag>
                    </div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {task.route}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
                  预计发运：{task.etd}
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>装载率</span>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1677ff' }}>
                      {task.loadingRate}%
                    </span>
                  </div>
                  <ProgressBar
                    percent={task.loadingRate}
                    style={{
                      '--fill-color': task.loadingRate >= 80 ? '#52c41a' : '#1677ff',
                      '--track-width': '6px'
                    }}
                  />
                </div>
              </Card>
            ))
          )}
        </div>

        {/* 快捷入口 */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
            <AppstoreOutline style={{ fontSize: '16px' }} /> 快捷入口
          </h3>

          {/* 入库 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
              <ContentOutline style={{ fontSize: '13px' }} /> 入库
            </div>
            <Grid columns={2} gap={8}>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/inbound/scan')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <ScanningOutline style={{ fontSize: '32px', color: '#1677ff' }} />
                  <div style={{ fontSize: '14px', color: '#333', marginTop: '8px' }}>扫码入库</div>
                </Card>
              </Grid.Item>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/inbound/history')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <UnorderedListOutline style={{ fontSize: '32px', color: '#52c41a' }} />
                  <div style={{ fontSize: '14px', color: '#333', marginTop: '8px' }}>入库记录</div>
                </Card>
              </Grid.Item>
            </Grid>
          </div>

          {/* 装箱 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
              <ContentOutline style={{ fontSize: '13px' }} /> 装箱
            </div>
            <Grid columns={3} gap={8}>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/container/create')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <AddCircleOutline style={{ fontSize: '32px', color: '#722ed1' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>创建集装箱</div>
                </Card>
              </Grid.Item>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/task-hub?tab=packing')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <AppstoreOutline style={{ fontSize: '32px', color: '#fa8c16' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>装箱</div>
                </Card>
              </Grid.Item>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/packing/records')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <FileOutline style={{ fontSize: '32px', color: '#13c2c2' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>装箱记录</div>
                </Card>
              </Grid.Item>
            </Grid>
          </div>

          {/* 调拨 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
              <SendOutline style={{ fontSize: '13px' }} /> 调拨
            </div>
            <Grid columns={2} gap={8}>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/transfer/create')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <AddCircleOutline style={{ fontSize: '32px', color: '#722ed1' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>创建调拨单</div>
                </Card>
              </Grid.Item>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/task-hub?tab=transfer')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <FileOutline style={{ fontSize: '32px', color: '#13c2c2' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>调拨记录</div>
                </Card>
              </Grid.Item>
            </Grid>
          </div>

          {/* 其他 */}
          <div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>
              <FileOutline style={{ fontSize: '13px' }} /> 其他
            </div>
            <Grid columns={3} gap={8}>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/task-hub?tab=stock')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <AppstoreOutline style={{ fontSize: '32px', color: '#eb2f96' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>库存管理</div>
                </Card>
              </Grid.Item>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/no-order-express')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <AppstoreOutline style={{ fontSize: '32px', color: '#faad14' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>无订单快递</div>
                </Card>
              </Grid.Item>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/return-records')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <UndoOutline style={{ fontSize: '32px', color: '#f5222d' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>退运记录</div>
                </Card>
              </Grid.Item>
            </Grid>
          </div>
        </div>
      </div>

      {/* 全局悬浮扫码按钮 */}
      <FloatingScanButton />
    </div>
  )
}

export default Dashboard
