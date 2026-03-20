import { useState, useEffect } from 'react'
import { Card, SearchBar, Tabs, NavBar, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { GlobalOutline, TruckOutline, GiftOutline } from 'antd-mobile-icons'
import { warehouseApi } from '@/api'

// 入库任务记录类型
interface InboundTaskRecord {
  id: string
  type: 'CONTAINER' | 'TRANSFER'
  taskNo: string
  containerNo?: string
  transferNo?: string
  orderCount: number
  totalPieces: number
  totalWeight: number
  completedOrders: number
  inboundTime: string
  operator: string
  status: 'COMPLETED' | 'PARTIAL'
}

const InboundRecords = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<'CONTAINER' | 'TRANSFER'>('CONTAINER')
  const [allRecords, setAllRecords] = useState<InboundTaskRecord[]>([])

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await warehouseApi.listInbound()
        const raw = (res as any)?.data || []
        const mapped: InboundTaskRecord[] = (raw as any[]).map((r: any) => ({
          id: r.id,
          type: 'CONTAINER' as const,
          taskNo: r.trackingNo || r.id,
          containerNo: r.trackingNo || '-',
          transferNo: undefined,
          orderCount: 1,
          totalPieces: r.pieces || 0,
          totalWeight: r.actualWeight || 0,
          completedOrders: r.status === 'COMPLETED' ? 1 : 0,
          inboundTime: r.inboundTime ? r.inboundTime.replace('T', ' ').slice(0, 16) : '-',
          operator: r.operator || '-',
          status: (r.status === 'COMPLETED' ? 'COMPLETED' : 'PARTIAL') as 'COMPLETED' | 'PARTIAL',
        }))
        setAllRecords(mapped)
      } catch (err: any) {
        Toast.show({ icon: 'fail', content: err.message || '获取入库记录失败' })
      }
    }
    fetchRecords()
  }, [])

  // 获取状态文本
  const getStatusText = (status: 'COMPLETED' | 'PARTIAL') => {
    return status === 'COMPLETED' ? '已完成' : '部分完成'
  }

  // 获取状态颜色
  const getStatusColor = (status: 'COMPLETED' | 'PARTIAL') => {
    return {
      color: status === 'COMPLETED' ? '#52c41a' : '#faad14',
      bg: status === 'COMPLETED' ? '#f0fdf4' : '#fffbeb'
    }
  }

  // 根据类型和搜索过滤
  const filteredRecords = allRecords.filter(record => {
    const matchType = record.type === activeTab
    const matchSearch = searchText === '' ||
      record.taskNo.toLowerCase().includes(searchText.toLowerCase()) ||
      record.containerNo?.toLowerCase().includes(searchText.toLowerCase()) ||
      record.transferNo?.toLowerCase().includes(searchText.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      {/* 顶部导航栏 */}
      <NavBar onBack={() => navigate(-1)}>
        入库记录 ({allRecords.length})
      </NavBar>

      {/* 搜索栏 */}
      <div style={{ padding: '16px 16px 0' }}>
        <SearchBar
          placeholder="搜索任务号/集装箱号/调拨单号"
          value={searchText}
          onChange={setSearchText}
          style={{
            '--border-radius': '8px',
            '--background': '#fff'
          }}
        />
      </div>

      {/* Tab切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'CONTAINER' | 'TRANSFER')}
        style={{ '--title-font-size': '15px' }}
      >
        <Tabs.Tab title="集装箱入库" key="CONTAINER" />
        <Tabs.Tab title="调拨入库" key="TRANSFER" />
      </Tabs>

      <div style={{ padding: '16px' }}>
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => {
            const statusColor = getStatusColor(record.status)
            return (
              <Card
                key={record.id}
                onClick={() => navigate(`/warehouse-us/inbound/record/${record.id}`)}
                style={{
                  marginBottom: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  background: '#fff'
                }}
              >
                <div>
                  {/* 状态标签 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: statusColor.color,
                      background: statusColor.bg,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}>
                      {getStatusText(record.status)}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#1677ff',
                      background: '#e6f4ff',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {record.type === 'CONTAINER' ? '集装箱' : '调拨'}
                    </div>
                  </div>

                  {/* 主要信息 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '32px' }}>
                      {record.type === 'CONTAINER' ? <GlobalOutline style={{ fontSize: '32px', color: '#1677ff' }} /> : <TruckOutline style={{ fontSize: '32px', color: '#1677ff' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                        {record.taskNo}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                        {record.type === 'CONTAINER' ? `集装箱：${record.containerNo}` : `调拨单：${record.transferNo}`}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        订单：{record.completedOrders}/{record.orderCount} · {record.totalPieces}件 · {record.totalWeight}kg
                      </div>
                    </div>
                  </div>

                  {/* 底部信息 */}
                  <div style={{
                    padding: '8px',
                    background: '#fafafa',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    <div style={{ marginBottom: '4px' }}>
                      操作员：{record.operator}
                    </div>
                    <div style={{ color: '#999' }}>
                      {record.inboundTime}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}><GiftOutline style={{ fontSize: '48px', color: '#ccc' }} /></div>
            <div style={{ fontSize: '16px' }}>暂无入库记录</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InboundRecords
