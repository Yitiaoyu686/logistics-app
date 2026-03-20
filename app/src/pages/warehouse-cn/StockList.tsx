import { useState, useEffect } from 'react'
import { Card, SearchBar, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { warehouseApi } from '../../api'

// 存放位置类型
type StorageLocationType = 'WAREHOUSE' | 'CONTAINER' | 'SHELF'

// 库存状态
type StockStatus = 'IN_STOCK' | 'ALLOCATED' | 'PACKED' | 'SHIPPED'

// 存放位置信息
interface StorageLocation {
  type: StorageLocationType
  code: string
  name: string
}

// 子订单库存信息
interface SubOrderStock {
  subOrderNo: string
  mainOrderNo: string
  customerName: string
  pieces: number
  weight: number
  volume: number
  status: StockStatus
  storageLocation: StorageLocation
  inboundTime: string
  shelfLife?: number // 在库天数
}

const StockList = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [stockList, setStockList] = useState<SubOrderStock[]>([])

  // 从 API 加载库存数据
  useEffect(() => {
    const fetchStock = async () => {
      try {
        const res: any = await warehouseApi.listStock()
        const data = Array.isArray(res) ? res : (res?.data || [])
        const mapped: SubOrderStock[] = (data as any[]).map((r: any) => {
          // 计算在库天数
          let shelfLife: number | undefined
          if (r.inboundTime) {
            const inDate = new Date(r.inboundTime)
            const now = new Date()
            shelfLife = Math.floor((now.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24))
          }
          // 构造存放位置对象
          const storageLocation: StorageLocation = {
            type: (r.shippingUnitId ? 'CONTAINER' : 'WAREHOUSE') as StorageLocationType,
            code: r.warehouseLocation || r.location || r.warehouse || '-',
            name: r.warehouseLocation || r.location || (r.warehouse === 'CN' ? '广州仓' : '拉各斯仓'),
          }
          return {
            subOrderNo: r.subOrderNo || '-',
            mainOrderNo: r.masterOrderNo || '-',
            customerName: r.clientName || '-',
            pieces: r.pieces || 0,
            weight: r.weight || 0,
            volume: r.volume || 0,
            status: (r.status || 'IN_STOCK') as StockStatus,
            storageLocation,
            inboundTime: r.inboundTime ? r.inboundTime.replace('T', ' ').slice(0, 16) : '-',
            shelfLife,
          }
        })
        setStockList(mapped)
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '获取库存数据失败' })
      }
    }
    fetchStock()
  }, [])

  // 获取状态文本
  const getStatusText = (status: StockStatus) => {
    const statusMap: Record<string, string> = {
      IN_STOCK: '在库',
      ALLOCATED: '已分配',
      PACKED: '已装箱',
      SHIPPED: '已发运',
      RETURNED: '已退运'
    }
    return statusMap[status] || status || '未知'
  }

  // 获取状态颜色
  const getStatusColor = (status: StockStatus) => {
    const colorMap: Record<string, { color: string; bg: string }> = {
      IN_STOCK: { color: '#52c41a', bg: '#f0fdf4' },
      ALLOCATED: { color: '#1677ff', bg: '#e6f4ff' },
      PACKED: { color: '#faad14', bg: '#fffbeb' },
      SHIPPED: { color: '#999', bg: '#f5f5f5' },
      RETURNED: { color: '#ff4d4f', bg: '#fff1f0' }
    }
    return colorMap[status] || { color: '#999', bg: '#f5f5f5' }
  }

  // 获取存放位置图标
  const getLocationIcon = (type: StorageLocationType) => {
    const iconMap = {
      WAREHOUSE: '▣',
      CONTAINER: '▦',
      SHELF: '▶'
    }
    return iconMap[type]
  }

  // 搜索过滤
  const filteredStockList = stockList.filter(item => {
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      item.subOrderNo.toLowerCase().includes(searchLower) ||
      item.mainOrderNo.toLowerCase().includes(searchLower) ||
      item.customerName.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      <div style={{ padding: '16px' }}>
        {/* 搜索框 */}
        <SearchBar
          placeholder="搜索订单号、客户名称"
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
              {filteredStockList.length}
            </div>
            <div style={{ color: '#999', marginTop: '4px' }}>库存数量</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
              {filteredStockList.reduce((sum, item) => sum + item.pieces, 0)}
            </div>
            <div style={{ color: '#999', marginTop: '4px' }}>总件数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }}>
              {filteredStockList.reduce((sum, item) => sum + item.weight, 0).toFixed(1)}
            </div>
            <div style={{ color: '#999', marginTop: '4px' }}>总重量(kg)</div>
          </div>
        </div>

        {/* 库存卡片列表 */}
        {filteredStockList.length > 0 ? (
          filteredStockList.map((item) => (
            <Card
              key={item.subOrderNo}
              onClick={() => navigate(`/stock/detail/${item.subOrderNo}`)}
              style={{
                marginBottom: '12px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                cursor: 'pointer'
              }}
            >
              <div style={{ padding: '4px 0' }}>
                {/* 子订单号和状态 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                    {item.subOrderNo}
                  </div>
                  <div
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: getStatusColor(item.status).color,
                      background: getStatusColor(item.status).bg
                    }}
                  >
                    {getStatusText(item.status)}
                  </div>
                </div>

                {/* 主订单号和客户名称 */}
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  主订单：{item.mainOrderNo}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  客户：{item.customerName}
                </div>

                {/* 存放位置 */}
                <div style={{
                  padding: '8px',
                  background: '#f0f9ff',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '18px' }}>
                    {item.storageLocation?.type ? getLocationIcon(item.storageLocation.type) : '▣'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#1677ff', fontWeight: 'bold' }}>
                      {item.storageLocation?.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {item.storageLocation?.code}
                    </div>
                  </div>
                </div>

                {/* 货物信息 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#999',
                  paddingTop: '8px',
                  borderTop: '1px solid #f0f0f0'
                }}>
                  <div>
                    <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{item.pieces}</span> 件
                  </div>
                  <div>
                    <span style={{ color: '#faad14', fontWeight: 'bold' }}>{item.weight}</span> kg
                  </div>
                  <div>
                    <span style={{ color: '#1677ff', fontWeight: 'bold' }}>{item.volume}</span> m³
                  </div>
                  {item.shelfLife && (
                    <div>
                      在库 <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{item.shelfLife}</span> 天
                    </div>
                  )}
                </div>

                {/* 入库时间 */}
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  入库时间：{item.inboundTime}
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
            暂无库存数据
          </div>
        )}
      </div>
    </div>
  )
}

export default StockList
