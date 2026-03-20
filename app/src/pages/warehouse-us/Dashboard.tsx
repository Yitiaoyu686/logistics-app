import { useState, useEffect } from 'react'
import { Card, SearchBar, Button, Grid, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import {
  ScanningOutline,
  UnorderedListOutline,
  AddCircleOutline,
  SendOutline,
  TruckOutline,
  SearchOutline,
  ClockCircleOutline,
  AppOutline,
  MoreOutline,
  PieOutline,
  FileOutline,
  DownCircleOutline,
  AppstoreOutline
} from 'antd-mobile-icons'
import FloatingScanButton from '@/components/FloatingScanButton'
import { warehouseApi, deliveryApi } from '@/api'
import { isDestWarehouseVisibleUnit } from '@/utils/taskVisibility'

interface TodayStat {
  label: string
  value: number
  color: string
  iconType: string
}

interface UpcomingArrival {
  id: string
  type: string
  title: string
  jobNo: string
  containerNo: string
  eta: string
  orderCount: number
}

const DashboardUS = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [todayStats, setTodayStats] = useState<TodayStat[]>([
    { label: '待入库', value: 0, color: '#1677ff', iconType: 'inbox' },
    { label: '待配送', value: 0, color: '#faad14', iconType: 'send' },
    { label: '配送中', value: 0, color: '#52c41a', iconType: 'truck' }
  ])
  const [upcomingArrivals, setUpcomingArrivals] = useState<UpcomingArrival[]>([])

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [unitsRes, deliveryRes] = await Promise.all([
          warehouseApi.listUnits(),
          deliveryApi.list()
        ])
        const units = (unitsRes as any)?.data || []
        const deliveries = (deliveryRes as any)?.data || []

        const pendingInbound = units.filter((u: any) => u.status === 'ARRIVED' || u.status === 'INBOUND_IN_PROGRESS').length
        const pendingDelivery = deliveries.filter((d: any) => d.status === 'PENDING').length
        const inTransit = deliveries.filter((d: any) => d.status === 'IN_TRANSIT').length

        setTodayStats([
          { label: '待入库', value: pendingInbound, color: '#1677ff', iconType: 'inbox' },
          { label: '待配送', value: pendingDelivery, color: '#faad14', iconType: 'send' },
          { label: '配送中', value: inTransit, color: '#52c41a', iconType: 'truck' }
        ])

        const arrivals = units
          .filter((u: any) => isDestWarehouseVisibleUnit(u.status))
          .slice(0, 3)
          .map((u: any) => ({
            id: u.id,
            type: 'CONTAINER',
            title: '集装箱到港',
            jobNo: u.jobNo || u.unitNo || '',
            containerNo: u.containerNo || u.unitNo || '',
            eta: u.createdAt ? u.createdAt.replace('T', ' ').slice(0, 10) : '-',
            orderCount: u.items?.length || 0
          }))
        setUpcomingArrivals(arrivals)
      } catch (err: any) {
        Toast.show({ icon: 'fail', content: err.message || '获取数据失败' })
      }
    }
    fetchDashboardData()
  }, [])

  // 获取图标组件
  const getIcon = (iconType: string, color: string) => {
    const iconStyle = { fontSize: '24px', color }
    switch (iconType) {
      case 'inbox':
        return <DownCircleOutline style={iconStyle} />
      case 'send':
        return <SendOutline style={iconStyle} />
      case 'truck':
        return <TruckOutline style={iconStyle} />
      default:
        return null
    }
  }

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
        marginBottom: '16px',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
          ▸ 你好，李师傅
        </h2>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
          拉各斯仓库 · 晴天 ○
        </p>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* 今日数据 */}
        <Card
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 'bold', color: '#333', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PieOutline style={{ fontSize: '16px' }} />
            今日数据
          </div>
          <Grid columns={3} gap={12}>
            {todayStats.map((stat, index) => (
              <Grid.Item key={index}>
                <div style={{
                  textAlign: 'center',
                  padding: '12px 8px',
                  background: '#f5f5f5',
                  borderRadius: '8px'
                }}>
                  <div style={{ marginBottom: '4px' }}>{getIcon(stat.iconType, stat.color)}</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: stat.color, marginBottom: '4px' }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{stat.label}</div>
                </div>
              </Grid.Item>
            ))}
          </Grid>
        </Card>

        {/* 订单查询 */}
        <Card
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 'bold', color: '#333', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <SearchOutline style={{ fontSize: '16px' }} />
            订单查询
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <SearchBar
                placeholder="搜索订单号/客户/DPN号"
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
              onClick={() => navigate('/warehouse-us/scan-order')}
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

        {/* 即将到达 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ClockCircleOutline style={{ fontSize: '16px' }} />
              即将到达
            </h3>
          </div>

          {upcomingArrivals.map((arrival) => (
            <Card
              key={arrival.id}
              style={{
                marginBottom: '12px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '28px' }}><DownCircleOutline style={{ fontSize: '28px', color: '#1677ff' }} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                    {arrival.title}
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    {arrival.jobNo} / {arrival.containerNo}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    预计到达：{arrival.eta} · 订单数：{arrival.orderCount}个
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* 快捷入口 */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#333', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AppOutline style={{ fontSize: '16px' }} />
            快捷入口
          </h3>

          {/* 入库 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <DownCircleOutline style={{ fontSize: '14px' }} />
              入库
            </div>
            <Grid columns={2} gap={8}>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/warehouse-us/inbound/scan')}
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
                  onClick={() => navigate('/warehouse-us/inbound/records')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <FileOutline style={{ fontSize: '32px', color: '#52c41a' }} />
                  <div style={{ fontSize: '14px', color: '#333', marginTop: '8px' }}>入库记录</div>
                </Card>
              </Grid.Item>
            </Grid>
          </div>

          {/* 配送 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TruckOutline style={{ fontSize: '14px' }} />
              配送
            </div>
            <Grid columns={2} gap={8}>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/warehouse-us/delivery/create')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <AddCircleOutline style={{ fontSize: '32px', color: '#1677ff' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>创建配送单</div>
                </Card>
              </Grid.Item>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/warehouse-us/task-hub?tab=delivery')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <UnorderedListOutline style={{ fontSize: '32px', color: '#52c41a' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>配送记录</div>
                </Card>
              </Grid.Item>
            </Grid>
          </div>

          {/* 其他 */}
          <div>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MoreOutline style={{ fontSize: '14px' }} />
              其他
            </div>
            <Grid columns={3} gap={8}>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/warehouse-us/task-hub?tab=stock')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <AppstoreOutline style={{ fontSize: '32px', color: '#722ed1' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>库存管理</div>
                </Card>
              </Grid.Item>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/warehouse-us/transfer/create')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <AddCircleOutline style={{ fontSize: '32px', color: '#13c2c2' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>创建调拨单</div>
                </Card>
              </Grid.Item>
              <Grid.Item>
                <Card
                  onClick={() => navigate('/warehouse-us/task-hub?tab=transfer')}
                  style={{
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    textAlign: 'center',
                    padding: '16px 8px'
                  }}
                >
                  <UnorderedListOutline style={{ fontSize: '32px', color: '#faad14' }} />
                  <div style={{ fontSize: '13px', color: '#333', marginTop: '8px' }}>调拨记录</div>
                </Card>
              </Grid.Item>
            </Grid>
          </div>
        </div>
      </div>

      {/* 悬浮扫码按钮 */}
      <FloatingScanButton />
    </div>
  )
}

export default DashboardUS
