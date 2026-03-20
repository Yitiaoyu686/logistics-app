import { useState, useEffect } from 'react'
import { Card, SearchBar, Tabs, NavBar, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { warehouseApi } from '../../api'

// 入库类型
type InboundType = 'ORDER' | 'CUSTOMS_RETURN'

// 入库状态
type InboundStatus = 'COMPLETED' | 'PARTIAL'

// 入库记录
interface InboundRecord {
  id: string
  type: InboundType
  taskNo: string
  orderNo?: string
  customerName?: string
  jobNo?: string
  containerNo?: string
  pieces: number
  weight: number
  volume: number
  status: InboundStatus
  inboundTime: string
  operator: string
  storageLocation: string
  remark?: string
}

const InboundHistory = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'order' | 'customs'>('all')
  const [records, setRecords] = useState<InboundRecord[]>([])

  // 从 API 加载入库记录
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res: any = await warehouseApi.listInbound()
        const data = Array.isArray(res) ? res : (res?.data || [])
        const mapped: InboundRecord[] = (data as any[]).map((r: any) => ({
          id: r.id,
          type: 'ORDER' as InboundType,
          taskNo: r.trackingNo || r.id,
          orderNo: r.subOrderId || '-',
          customerName: r.clientName || '-',
          jobNo: undefined,
          containerNo: undefined,
          pieces: r.pieces || 0,
          weight: r.actualWeight || 0,
          volume: r.actualVolume || 0,
          status: (r.status === 'COMPLETED' ? 'COMPLETED' : 'PARTIAL') as InboundStatus,
          inboundTime: r.inboundTime ? r.inboundTime.replace('T', ' ').slice(0, 16) : '-',
          operator: r.operator || '-',
          storageLocation: r.warehouseLocation || '-',
          remark: r.remark || undefined,
        }))
        setRecords(mapped)
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '获取入库记录失败' })
      }
    }
    fetchRecords()
  }, [])

  // 获取类型文本
  const getTypeText = (type: InboundType) => {
    return type === 'ORDER' ? '客户下单' : '报关退回'
  }

  // 获取状态文本
  const getStatusText = (status: InboundStatus) => {
    return status === 'COMPLETED' ? '已完成' : '部分入库'
  }

  // 获取状态颜色
  const getStatusColor = (status: InboundStatus) => {
    return status === 'COMPLETED'
      ? { color: '#52c41a', bg: '#f0fdf4' }
      : { color: '#faad14', bg: '#fffbeb' }
  }

  // 筛选和搜索
  const filteredRecords = records.filter(record => {
    // 类型筛选
    if (activeTab === 'order' && record.type !== 'ORDER') return false
    if (activeTab === 'customs' && record.type !== 'CUSTOMS_RETURN') return false

    // 搜索过滤
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      record.taskNo.toLowerCase().includes(searchLower) ||
      record.orderNo?.toLowerCase().includes(searchLower) ||
      record.customerName?.toLowerCase().includes(searchLower) ||
      record.jobNo?.toLowerCase().includes(searchLower) ||
      record.containerNo?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      <NavBar onBack={() => navigate(-1)}>入库记录</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 搜索框 */}
        <SearchBar
          placeholder="搜索任务号、订单号、客户名称"
          value={searchText}
          onChange={setSearchText}
          style={{
            '--border-radius': '8px',
            '--background': '#fff',
            marginBottom: '16px'
          }}
        />

        {/* 类型筛选按钮组 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <div
            onClick={() => setActiveTab('all')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '14px',
              textAlign: 'center',
              borderRadius: '6px',
              background: activeTab === 'all' ? '#1677ff' : '#f5f5f5',
              color: activeTab === 'all' ? '#fff' : '#666',
              fontWeight: activeTab === 'all' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            全部
          </div>
          <div
            onClick={() => setActiveTab('order')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '14px',
              textAlign: 'center',
              borderRadius: '6px',
              background: activeTab === 'order' ? '#1677ff' : '#f5f5f5',
              color: activeTab === 'order' ? '#fff' : '#666',
              fontWeight: activeTab === 'order' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            客户下单
          </div>
          <div
            onClick={() => setActiveTab('customs')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '14px',
              textAlign: 'center',
              borderRadius: '6px',
              background: activeTab === 'customs' ? '#1677ff' : '#f5f5f5',
              color: activeTab === 'customs' ? '#fff' : '#666',
              fontWeight: activeTab === 'customs' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            报关退回
          </div>
        </div>

        {/* 统计信息 */}
        <div style={{
          marginBottom: '16px',
          padding: '12px',
          background: '#fff',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-around',
          fontSize: '13px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1677ff' }}>
              {filteredRecords.length}
            </div>
            <div style={{ color: '#999', marginTop: '4px' }}>记录数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
              {filteredRecords.reduce((sum, r) => sum + r.pieces, 0)}
            </div>
            <div style={{ color: '#999', marginTop: '4px' }}>总件数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }}>
              {filteredRecords.reduce((sum, r) => sum + r.weight, 0).toFixed(1)}
            </div>
            <div style={{ color: '#999', marginTop: '4px' }}>总重量(kg)</div>
          </div>
        </div>
      </div>

      {/* 入库记录列表 */}
      <div style={{ padding: '0 16px' }}>
        {filteredRecords.length > 0 ? (
            filteredRecords.map((record) => (
              <Card
                key={record.id}
                onClick={() => navigate(`/inbound/task/${record.id}`)}
                style={{
                  marginBottom: '12px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ padding: '4px 0' }}>
                  {/* 任务号和状态 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                      {record.taskNo}
                    </div>
                    <div
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: getStatusColor(record.status).color,
                        background: getStatusColor(record.status).bg
                      }}
                    >
                      {getStatusText(record.status)}
                    </div>
                  </div>

                  {/* 类型标签 */}
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      background: record.type === 'ORDER' ? '#e6f4ff' : '#fff7e6',
                      color: record.type === 'ORDER' ? '#1677ff' : '#faad14'
                    }}>
                      {getTypeText(record.type)}
                    </span>
                  </div>

                  {/* 订单/任务信息 */}
                  {record.type === 'ORDER' ? (
                    <>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                        订单号：{record.orderNo}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                        客户：{record.customerName}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                        任务号：{record.jobNo}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                        集装箱：{record.containerNo}
                      </div>
                    </>
                  )}

                  {/* 货物信息 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#999',
                    paddingTop: '8px',
                    borderTop: '1px solid #f0f0f0',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{record.pieces}</span> 件
                    </div>
                    <div>
                      <span style={{ color: '#faad14', fontWeight: 'bold' }}>{record.weight}</span> kg
                    </div>
                    <div>
                      <span style={{ color: '#1677ff', fontWeight: 'bold' }}>{record.volume}</span> m³
                    </div>
                  </div>

                  {/* 存放位置 */}
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    存放位置：{record.storageLocation}
                  </div>

                  {/* 操作信息 */}
                  <div style={{ fontSize: '12px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                    <span>操作人：{record.operator}</span>
                    <span>{record.inboundTime}</span>
                  </div>

                  {/* 备注 */}
                  {record.remark && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 8px',
                      background: '#fffbeb',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#faad14'
                    }}>
                      {record.remark}
                    </div>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#999',
              fontSize: '14px'
            }}>
              暂无入库记录
            </div>
          )}
      </div>
    </div>
  )
}

export default InboundHistory
