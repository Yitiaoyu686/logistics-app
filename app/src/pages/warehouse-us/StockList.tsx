import { useState, useEffect } from 'react'
import { Card, SearchBar, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { GiftOutline } from 'antd-mobile-icons'
import { warehouseApi } from '@/api'

// 存放位置类型
type StorageLocationType = 'WAREHOUSE' | 'SHELF' | 'DELIVERY_AREA'

// 库存状态
type StockStatus = 'IN_STOCK' | 'ALLOCATED' | 'DELIVERING' | 'DELIVERED' | 'RETURNED'

// 存放位置信息
interface StorageLocation {
  type: StorageLocationType
  code: string
  name: string
}

// 订单库存信息
interface OrderStock {
  orderNo: string
  customerName: string
  recipientName: string
  recipientAddress: string
  city: string
  pieces: number
  weight: number
  status: StockStatus
  storageLocation: StorageLocation
  inboundTime: string
  shelfLife: number // 在库天数
}

const StockList = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [stockList, setStockList] = useState<OrderStock[]>([])

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const res = await warehouseApi.listStock()
        const raw = (res as any)?.data || []
        const mapped: OrderStock[] = (raw as any[]).map((s: any) => {
          const inT = s.inboundTime || s.createdAt || ''
          const days = inT ? Math.max(0, Math.floor((Date.now() - new Date(inT).getTime()) / 86400000)) : 0
          return {
            orderNo: s.subOrderNo || s.trackingNo || '-',
            customerName: s.clientName || '-',
            recipientName: s.destination || '-',
            recipientAddress: s.location || '-',
            city: s.warehouse || '-',
            pieces: s.pieces || 0,
            weight: s.weight || 0,
            status: (s.status === 'PACKED' || s.status === 'SHIPPED' ? 'DELIVERING' : s.status || 'IN_STOCK') as StockStatus,
            storageLocation: {
              type: 'WAREHOUSE' as StorageLocationType,
              code: s.warehouseLocation || '-',
              name: s.warehouse || '-',
            },
            inboundTime: inT ? inT.replace('T', ' ').slice(0, 16) : '-',
            shelfLife: days,
          }
        })
        setStockList(mapped)
      } catch (err: any) {
        Toast.show({ icon: 'fail', content: err.message || '获取库存数据失败' })
      }
    }
    fetchStock()
  }, [])

  // 获取状态文本
  const getStatusText = (status: StockStatus) => {
    const statusMap: Record<string, string> = {
      IN_STOCK: '在库',
      ALLOCATED: '已分配',
      DELIVERING: '配送中',
      DELIVERED: '已送达',
      RETURNED: '已退运'
    }
    return statusMap[status] || status || '-'
  }

  // 获取状态颜色
  const getStatusColor = (status: StockStatus) => {
    const colorMap: Record<string, { color: string; bg: string }> = {
      IN_STOCK: { color: '#52c41a', bg: '#f0fdf4' },
      ALLOCATED: { color: '#1677ff', bg: '#e6f4ff' },
      DELIVERING: { color: '#faad14', bg: '#fffbeb' },
      DELIVERED: { color: '#999', bg: '#f5f5f5' },
      RETURNED: { color: '#ff4d4f', bg: '#fff1f0' }
    }
    return colorMap[status] || { color: '#999', bg: '#f5f5f5' }
  }

  // 获取存放位置图标
  const getLocationIcon = (type: StorageLocationType) => {
    const iconMap: Record<string, string> = {
      WAREHOUSE: '▣',
      SHELF: '▦',
      DELIVERY_AREA: '▶'
    }
    return iconMap[type] || '▣'
  }

  // 搜索过滤
  const filteredStockList = stockList.filter(item => {
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      item.orderNo.toLowerCase().includes(searchLower) ||
      item.customerName.toLowerCase().includes(searchLower) ||
      item.recipientName.toLowerCase().includes(searchLower)
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
              key={item.orderNo}
              onClick={() => navigate(`/warehouse-us/stock/detail/${item.orderNo}`)}
              style={{
                marginBottom: '12px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                cursor: 'pointer'
              }}
            >
              <div style={{ padding: '4px 0' }}>
                {/* 订单号和状态 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                    {item.orderNo}
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

                {/* 客户和收件人信息 */}
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  客户：{item.customerName}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  收件人：{item.recipientName}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  地址：{item.city} · {item.recipientAddress}
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
                    {getLocationIcon(item.storageLocation?.type || 'WAREHOUSE')}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#1677ff', fontWeight: 'bold' }}>
                      {item.storageLocation?.name || '-'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {item.storageLocation?.code || '-'}
                    </div>
                  </div>
                </div>

                {/* 货物信息和在库天数 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {item.pieces}件 · {item.weight}kg
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: item.shelfLife > 5 ? '#ff4d4f' : '#999',
                    fontWeight: item.shelfLife > 5 ? 'bold' : 'normal'
                  }}>
                    在库 {item.shelfLife} 天
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}><GiftOutline style={{ fontSize: '48px', color: '#ccc' }} /></div>
            <div style={{ fontSize: '16px' }}>暂无库存数据</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StockList
