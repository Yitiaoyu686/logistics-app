import { useState, useEffect } from 'react'
import { Card, SearchBar, NavBar, Tag, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { warehouseApi } from '../../api'

// 运输方式
type TransportMode = 'SEA' | 'AIR'

// 装箱记录状态
type RecordStatus = 'SHIPPED' | 'IN_TRANSIT' | 'ARRIVED'

// 装箱记录
interface PackingRecord {
  id: string
  jobNo: string
  containerNo: string
  transportMode: TransportMode
  containerType?: string
  route: string
  etd: string
  atd?: string
  eta?: string
  status: RecordStatus
  totalOrders: number
  totalPieces: number
  totalWeight: number
  totalVolume: number
  operator: string
  packingDate: string
  shippingDate?: string
}

const PackingRecords = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [records, setRecords] = useState<PackingRecord[]>([])

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res: any = await warehouseApi.listUnits()
        const list = Array.isArray(res) ? res : (res?.data || [])
        const mapped: PackingRecord[] = (list as any[]).map((u: any) => {
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
          let status: RecordStatus = 'SHIPPED'
          if (u.status === 'SHIPPED' || u.status === 'SEALED') status = 'SHIPPED'
          else if (u.status === 'ARRIVED') status = 'ARRIVED'

          return {
            id: u.id,
            jobNo: u.jobNo || '-',
            containerNo: u.unitNo || '-',
            transportMode: u.transportMode || 'SEA',
            containerType: u.unitType,
            route,
            etd,
            status,
            totalOrders: u.loadedOrders || 0,
            totalPieces: u.loadedPieces || 0,
            totalWeight: u.currentWeight || 0,
            totalVolume: u.currentVolume || 0,
            operator: '-',
            packingDate: u.updatedAt ? u.updatedAt.split('T')[0] : '-',
            shippingDate: u.atd ? u.atd.split('T')[0] : undefined,
            eta: etd,
          }
        })
        setRecords(mapped)
      } catch (err) {
        Toast.show({ icon: 'fail', content: '获取装箱记录失败' })
      }
    }
    fetchRecords()
  }, [])

  // 获取状态文本
  const getStatusText = (status: RecordStatus) => {
    switch (status) {
      case 'SHIPPED':
        return '已发运'
      case 'IN_TRANSIT':
        return '运输中'
      case 'ARRIVED':
        return '已到达'
    }
  }

  // 获取状态颜色
  const getStatusColor = (status: RecordStatus) => {
    switch (status) {
      case 'SHIPPED':
        return { color: '#1677ff', bg: '#e6f4ff' }
      case 'IN_TRANSIT':
        return { color: '#faad14', bg: '#fffbeb' }
      case 'ARRIVED':
        return { color: '#52c41a', bg: '#f0fdf4' }
      default:
        return { color: '#999', bg: '#f5f5f5' }
    }
  }

  // 获取运输方式文本
  const getTransportModeText = (mode: TransportMode) => {
    return mode === 'SEA' ? '海运' : '空运'
  }

  // 搜索过滤
  const filteredRecords = records.filter(record => {
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      record.jobNo.toLowerCase().includes(searchLower) ||
      record.containerNo.toLowerCase().includes(searchLower) ||
      record.route.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      <NavBar onBack={() => navigate(-1)}>装箱记录</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 搜索框 */}
        <SearchBar
          placeholder="搜索任务号、集装箱号、路线"
          value={searchText}
          onChange={setSearchText}
          style={{
            '--border-radius': '8px',
            '--background': '#fff',
            marginBottom: '16px'
          }}
        />

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
              {filteredRecords.reduce((sum, r) => sum + r.totalOrders, 0)}
            </div>
            <div style={{ color: '#999', marginTop: '4px' }}>总订单</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }}>
              {filteredRecords.reduce((sum, r) => sum + r.totalPieces, 0)}
            </div>
            <div style={{ color: '#999', marginTop: '4px' }}>总件数</div>
          </div>
        </div>
      </div>

      {/* 装箱记录列表 */}
      <div style={{ padding: '0 16px' }}>
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <Card
              key={record.id}
              onClick={() => navigate(`/packing/task/${record.id}`)}
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
                    {record.jobNo}
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

                {/* 运输方式和集装箱号 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Tag
                    color={record.transportMode === 'SEA' ? 'primary' : 'success'}
                    style={{ fontSize: '12px' }}
                  >
                    {getTransportModeText(record.transportMode)}
                  </Tag>
                  {record.containerType && (
                    <Tag color="default" style={{ fontSize: '12px' }}>
                      {record.containerType}
                    </Tag>
                  )}
                </div>

                {/* 集装箱号和路线 */}
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  {record.transportMode === 'SEA' ? '集装箱号' : '航班号'}：{record.containerNo}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  路线：{record.route}
                </div>

                {/* 货物统计 */}
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
                    <span style={{ color: '#1677ff', fontWeight: 'bold' }}>{record.totalOrders}</span> 单
                  </div>
                  <div>
                    <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{record.totalPieces}</span> 件
                  </div>
                  <div>
                    <span style={{ color: '#faad14', fontWeight: 'bold' }}>{record.totalWeight}</span> kg
                  </div>
                  <div>
                    <span style={{ color: '#722ed1', fontWeight: 'bold' }}>{record.totalVolume}</span> m³
                  </div>
                </div>

                {/* 时间信息 */}
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  装箱时间：{record.packingDate}
                </div>
                {record.shippingDate && (
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    发运时间：{record.shippingDate}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  预计到达：{record.eta}
                </div>

                {/* 操作人 */}
                <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                  操作人：{record.operator}
                </div>
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
            暂无装箱记录
          </div>
        )}
      </div>
    </div>
  )
}

export default PackingRecords
