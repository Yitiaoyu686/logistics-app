import { useState, useEffect } from 'react'
import { Card, Button, NavBar, List, Tag, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { ExclamationCircleOutline, FileOutline, ContentOutline, TruckOutline } from 'antd-mobile-icons'
import { warehouseApi } from '@/api'

// 存放位置类型
type StorageLocationType = 'WAREHOUSE' | 'SHELF' | 'DELIVERY_AREA'

// 库存状态
type StockStatus = 'IN_STOCK' | 'ALLOCATED' | 'DELIVERING' | 'DELIVERED'

// 存放位置信息
interface StorageLocation {
  type: StorageLocationType
  code: string
  name: string
}

// 订单库存详情
interface StockDetail {
  orderNo: string
  customerName: string
  customerPhone: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  city: string
  pieces: number
  weight: number
  status: StockStatus
  storageLocation: StorageLocation
  inboundTime: string
  shelfLife: number

  // 配送相关（已分配/配送中/已送达状态）
  dpnNo?: string
  driverName?: string
  driverPhone?: string
  deliveryMethod?: 'SELF_PICKUP' | 'DELIVERY' | 'SATELLITE_STATION'

  // 其他
  remark?: string
}

const StockDetail = () => {
  const navigate = useNavigate()
  const { orderNo } = useParams<{ orderNo: string }>()
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null)

  useEffect(() => {
    const fetchStockDetail = async () => {
      if (!orderNo) return
      try {
        const res = await warehouseApi.listStock({ subOrderNo: orderNo })
        const data = (res as any)?.data
        const raw = Array.isArray(data) ? data[0] : data
        if (raw) {
          const inT = raw.inboundTime || raw.createdAt || ''
          const days = inT ? Math.max(0, Math.floor((Date.now() - new Date(inT).getTime()) / 86400000)) : 0
          const detail: StockDetail = {
            orderNo: raw.subOrderNo || raw.trackingNo || '-',
            customerName: raw.clientName || '-',
            customerPhone: '',
            recipientName: raw.destination || '-',
            recipientPhone: '',
            recipientAddress: raw.location || '-',
            city: raw.warehouse || '-',
            pieces: raw.pieces || 0,
            weight: raw.weight || 0,
            status: (raw.status === 'PACKED' || raw.status === 'SHIPPED' ? 'DELIVERING' : raw.status || 'IN_STOCK') as StockStatus,
            storageLocation: {
              type: 'WAREHOUSE' as StorageLocationType,
              code: raw.warehouseLocation || '-',
              name: raw.warehouse || '-',
            },
            inboundTime: inT ? inT.replace('T', ' ').slice(0, 16) : '-',
            shelfLife: days,
            remark: raw.remark || undefined,
          }
          setStockDetail(detail)
        }
      } catch (err: any) {
        Toast.show({ icon: 'fail', content: err.message || '获取库存详情失败' })
      }
    }
    fetchStockDetail()
  }, [orderNo])

  if (!stockDetail) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#999' }}>加载中...</div>
      </div>
    )
  }

  // 获取状态文本
  const getStatusText = (status: StockStatus) => {
    const statusMap = {
      IN_STOCK: '在库',
      ALLOCATED: '已分配',
      DELIVERING: '配送中',
      DELIVERED: '已送达'
    }
    return statusMap[status]
  }

  // 获取状态颜色
  const getStatusColor = (status: StockStatus) => {
    if (status === 'IN_STOCK') return 'success'
    if (status === 'ALLOCATED') return 'primary'
    if (status === 'DELIVERING') return 'warning'
    return 'default'
  }

  // 获取存放位置图标
  const getLocationIcon = (type: StorageLocationType) => {
    const iconMap = {
      WAREHOUSE: '▣',
      SHELF: '▦',
      DELIVERY_AREA: '▶'
    }
    return iconMap[type]
  }

  // 获取配送方式文本
  const getDeliveryMethodText = (method?: string) => {
    if (!method) return ''
    const methodMap = {
      DELIVERY: '送货上门',
      SELF_PICKUP: '自提',
      SATELLITE_STATION: '卫星站点'
    }
    return methodMap[method as keyof typeof methodMap] || ''
  }

  // 创建配送单
  const handleCreateDelivery = () => {
    navigate(`/warehouse-us/delivery/create?orderNo=${stockDetail.orderNo}`)
  }

  // 移动位置
  const handleMoveLocation = () => {
    Toast.show({ content: '移动位置功能开发中' })
  }

  // 创建调拨单
  const handleCreateTransfer = () => {
    navigate('/warehouse-us/transfer/create')
  }

  // 查看配送单
  const handleViewDelivery = () => {
    if (stockDetail.dpnNo) {
      navigate(`/warehouse-us/delivery/detail/${stockDetail.dpnNo}`)
    }
  }

  // 取消分配
  const handleCancelAllocation = () => {
    if (!window.confirm('确定要取消分配吗？取消后货物将重新回到在库状态。')) return
    Toast.show({ content: '已取消分配', icon: 'success' })
    setTimeout(() => navigate(-1), 1000)
  }

  // 联系司机
  const handleContactDriver = () => {
    if (stockDetail.driverPhone) {
      window.location.href = `tel:${stockDetail.driverPhone}`
    } else {
      Toast.show({ content: '暂无司机电话', icon: 'fail' })
    }
  }

  // 联系收货人
  const handleContactRecipient = () => {
    window.location.href = `tel:${stockDetail.recipientPhone}`
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>库存详情</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 状态标签 */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Tag
            color={getStatusColor(stockDetail.status)}
            style={{ fontSize: '13px', padding: '4px 12px' }}
          >
            {getStatusText(stockDetail.status)}
          </Tag>
          {stockDetail.shelfLife > 5 && (
            <Tag
              color="danger"
              style={{ fontSize: '13px', padding: '4px 12px' }}
            >
              <ExclamationCircleOutline style={{ fontSize: '13px' }} /> 超期预警
            </Tag>
          )}
        </div>

        {/* 基本信息卡片 */}
        <Card
          title={<><FileOutline style={{ fontSize: '16px' }} /> 基本信息</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <List>
            <List.Item extra={stockDetail.orderNo}>订单号</List.Item>
            <List.Item extra={stockDetail.customerName}>客户名称</List.Item>
            <List.Item
              extra={stockDetail.customerPhone}
              onClick={() => window.location.href = `tel:${stockDetail.customerPhone}`}
              clickable
            >
              客户电话
            </List.Item>
          </List>
        </Card>

        {/* 收货信息卡片 */}
        <Card
          title="收货信息"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <List>
            <List.Item extra={stockDetail.recipientName}>收货人</List.Item>
            <List.Item
              extra={stockDetail.recipientPhone}
              onClick={handleContactRecipient}
              clickable
            >
              电话
            </List.Item>
            <List.Item extra={stockDetail.city}>城市</List.Item>
            <List.Item>
              <div>
                <div style={{ color: '#999', fontSize: '14px', marginBottom: '4px' }}>地址</div>
                <div style={{ fontSize: '14px' }}>{stockDetail.recipientAddress}</div>
              </div>
            </List.Item>
          </List>
        </Card>

        {/* 货物信息卡片 */}
        <Card
          title={<><ContentOutline style={{ fontSize: '16px' }} /> 货物信息</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a', marginBottom: '4px' }}>
                {stockDetail.pieces}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>件数</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#fffbeb', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#faad14', marginBottom: '4px' }}>
                {stockDetail.weight}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>重量(kg)</div>
            </div>
          </div>
        </Card>

        {/* 存放位置卡片 */}
        <Card
          title="存放位置"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{
            padding: '16px',
            background: '#f0f9ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '32px' }}>
              {getLocationIcon(stockDetail.storageLocation.type)}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', color: '#1677ff', fontWeight: 'bold', marginBottom: '4px' }}>
                {stockDetail.storageLocation.name}
              </div>
              <div style={{ fontSize: '13px', color: '#999' }}>
                位置编码：{stockDetail.storageLocation.code}
              </div>
            </div>
          </div>
          <List>
            <List.Item extra={stockDetail.inboundTime}>入库时间</List.Item>
            <List.Item
              extra={
                <span style={{
                  color: stockDetail.shelfLife > 5 ? '#ff4d4f' : '#333',
                  fontWeight: stockDetail.shelfLife > 5 ? 'bold' : 'normal'
                }}>
                  {stockDetail.shelfLife} 天
                </span>
              }
            >
              在库天数
            </List.Item>
          </List>
        </Card>

        {/* 配送信息卡片（已分配/配送中/已送达状态显示）*/}
        {(stockDetail.status === 'ALLOCATED' || stockDetail.status === 'DELIVERING' || stockDetail.status === 'DELIVERED') && (
          <Card
            title={<><TruckOutline style={{ fontSize: '16px' }} /> 配送信息</>}
            style={{
              marginBottom: '16px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}
          >
            <List>
              <List.Item
                extra={stockDetail.dpnNo}
                onClick={handleViewDelivery}
                clickable
              >
                配送单号
              </List.Item>
              {stockDetail.deliveryMethod && (
                <List.Item extra={getDeliveryMethodText(stockDetail.deliveryMethod)}>
                  配送方式
                </List.Item>
              )}
              {stockDetail.driverName && (
                <>
                  <List.Item extra={stockDetail.driverName}>司机</List.Item>
                  <List.Item
                    extra={stockDetail.driverPhone}
                    onClick={handleContactDriver}
                    clickable
                  >
                    司机电话
                  </List.Item>
                </>
              )}
            </List>
          </Card>
        )}
      </div>

      {/* 底部操作按钮 */}
      {/* 在库状态：创建配送单 + 更多操作 */}
      {stockDetail.status === 'IN_STOCK' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
            <Button
              color="default"
              size="large"
              onClick={handleMoveLocation}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                flex: 1
              }}
            >
              移动位置
            </Button>
            <Button
              color="default"
              size="large"
              onClick={handleCreateTransfer}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                flex: 1
              }}
            >
              创建调拨
            </Button>
          </div>
          <Button
            block
            color="primary"
            size="large"
            onClick={handleCreateDelivery}
            style={{
              '--border-radius': '8px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            创建配送单
          </Button>
        </div>
      )}

      {/* 已分配状态：查看配送单 + 取消分配 */}
      {stockDetail.status === 'ALLOCATED' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              color="default"
              size="large"
              onClick={handleCancelAllocation}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                flex: 1
              }}
            >
              取消分配
            </Button>
            <Button
              color="primary"
              size="large"
              onClick={handleViewDelivery}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                flex: 1
              }}
            >
              查看配送单
            </Button>
          </div>
        </div>
      )}

      {/* 配送中状态：联系司机 + 联系收货人 */}
      {stockDetail.status === 'DELIVERING' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
          zIndex: 100
        }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
            <Button
              color="primary"
              size="large"
              onClick={handleContactDriver}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                flex: 1
              }}
            >
              联系司机
            </Button>
            <Button
              color="success"
              size="large"
              onClick={handleContactRecipient}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                flex: 1
              }}
            >
              联系收货人
            </Button>
          </div>
          <Button
            block
            color="default"
            size="large"
            onClick={handleViewDelivery}
            style={{
              '--border-radius': '8px',
              fontSize: '16px'
            }}
          >
            查看配送单
          </Button>
        </div>
      )}

      {/* 已送达状态：查看配送单 */}
      {stockDetail.status === 'DELIVERED' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
          zIndex: 100
        }}>
          <Button
            block
            color="primary"
            size="large"
            onClick={handleViewDelivery}
            style={{
              '--border-radius': '8px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            查看配送单
          </Button>
        </div>
      )}
    </div>
  )
}

export default StockDetail
