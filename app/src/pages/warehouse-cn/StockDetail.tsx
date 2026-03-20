import { useState, useEffect } from 'react'
import { Card, Button, NavBar, List, Tag, Steps, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { FileOutline, ContentOutline, EditSOutline } from 'antd-mobile-icons'
import { warehouseApi } from '../../api'

// 存放位置类型
type StorageLocationType = 'WAREHOUSE' | 'CONTAINER' | 'SHELF'

// 库存状态
type StockStatus = 'IN_STOCK' | 'ALLOCATED' | 'PACKED' | 'SHIPPED'

// 操作类型
type OperationType = 'INBOUND' | 'ALLOCATE' | 'PACK' | 'SHIP' | 'TRANSFER' | 'ADJUST'

// 存放位置信息
interface StorageLocation {
  type: StorageLocationType
  code: string
  name: string
}

// 操作历史记录
interface OperationHistory {
  id: string
  type: OperationType
  operator: string
  operateTime: string
  description: string
  fromLocation?: StorageLocation
  toLocation?: StorageLocation
}

// 子订单库存详情
interface StockDetail {
  subOrderNo: string
  mainOrderNo: string
  customerName: string
  pieces: number
  weight: number
  volume: number
  status: StockStatus
  storageLocation: StorageLocation
  inboundTime: string
  shelfLife: number
  productName?: string
  productSku?: string
  packageInfo?: string
  operationHistory: OperationHistory[]
}

const StockDetail = () => {
  const navigate = useNavigate()
  const { subOrderNo } = useParams()
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null)

  useEffect(() => {
    const fetchDetail = async () => {
      if (!subOrderNo) return
      try {
        const res: any = await warehouseApi.listStock({ keyword: subOrderNo })
        const data = Array.isArray(res) ? res : (res?.data || [])
        const found = (data as any[]).find((r: any) => r.subOrderNo === subOrderNo) || data[0]
        if (found) {
          // 计算在库天数
          let shelfLife = 0
          if (found.inboundTime) {
            const inDate = new Date(found.inboundTime)
            const now = new Date()
            shelfLife = Math.floor((now.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24))
          }
          // 构造存放位置对象
          const storageLocation: StorageLocation = {
            type: (found.shippingUnitId ? 'CONTAINER' : 'WAREHOUSE') as StorageLocationType,
            code: found.warehouseLocation || found.location || found.warehouse || '-',
            name: found.warehouseLocation || found.location || (found.warehouse === 'CN' ? '广州仓' : '拉各斯仓'),
          }
          // 构造操作历史
          const operationHistory: OperationHistory[] = [
            {
              id: '1',
              type: 'INBOUND' as OperationType,
              operator: found.salesPerson || '-',
              operateTime: found.inboundTime ? found.inboundTime.replace('T', ' ').slice(0, 16) : '-',
              description: `入库 ${found.pieces || 0} 件，${found.weight || 0} kg`,
              toLocation: storageLocation,
            },
          ]
          if (found.status === 'PACKED' || found.status === 'SHIPPED') {
            operationHistory.push({
              id: '2',
              type: 'PACK' as OperationType,
              operator: '-',
              operateTime: '-',
              description: '装箱完成',
            })
          }
          if (found.status === 'SHIPPED') {
            operationHistory.push({
              id: '3',
              type: 'SHIP' as OperationType,
              operator: '-',
              operateTime: '-',
              description: '已发运',
            })
          }
          const detail: StockDetail = {
            subOrderNo: found.subOrderNo || '-',
            mainOrderNo: found.masterOrderNo || '-',
            customerName: found.clientName || '-',
            pieces: found.pieces || 0,
            weight: found.weight || 0,
            volume: found.volume || 0,
            status: (found.status || 'IN_STOCK') as StockStatus,
            storageLocation,
            inboundTime: found.inboundTime ? found.inboundTime.replace('T', ' ').slice(0, 16) : '-',
            shelfLife,
            productName: found.productName || undefined,
            operationHistory,
          }
          setStockDetail(detail)
        } else {
          Toast.show({ icon: 'fail', content: '未找到库存详情' })
        }
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '获取库存详情失败' })
      }
    }
    fetchDetail()
  }, [subOrderNo])

  if (!stockDetail) {
    return <div>加载中...</div>
  }

  // 获取状态文本
  const getStatusText = (status: StockStatus) => {
    const statusMap = {
      IN_STOCK: '在库',
      ALLOCATED: '已分配',
      PACKED: '已装箱',
      SHIPPED: '已发运'
    }
    return statusMap[status]
  }

  // 获取状态颜色
  const getStatusColor = (status: StockStatus) => {
    const colorMap = {
      IN_STOCK: 'success',
      ALLOCATED: 'primary',
      PACKED: 'warning',
      SHIPPED: 'default'
    }
    return colorMap[status]
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

  // 获取操作类型文本
  const getOperationTypeText = (type: OperationType) => {
    const typeMap = {
      INBOUND: '入库',
      ALLOCATE: '分配',
      PACK: '装箱',
      SHIP: '发运',
      TRANSFER: '转移',
      ADJUST: '调整'
    }
    return typeMap[type]
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>库存详情</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 状态标签 */}
        <div style={{ marginBottom: '16px' }}>
          <Tag
            color={getStatusColor(stockDetail.status)}
            style={{ fontSize: '13px', padding: '4px 12px' }}
          >
            {getStatusText(stockDetail.status)}
          </Tag>
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
            <List.Item extra={stockDetail.subOrderNo}>子订单号</List.Item>
            <List.Item extra={stockDetail.mainOrderNo}>主订单号</List.Item>
            <List.Item extra={stockDetail.customerName}>客户名称</List.Item>
            {stockDetail.productName && (
              <List.Item extra={stockDetail.productName}>产品名称</List.Item>
            )}
            {stockDetail.productSku && (
              <List.Item extra={stockDetail.productSku}>产品SKU</List.Item>
            )}
            {stockDetail.packageInfo && (
              <List.Item extra={stockDetail.packageInfo}>包装信息</List.Item>
            )}
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
          <div style={{ display: 'flex', gap: '12px' }}>
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
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0f9ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1677ff', marginBottom: '4px' }}>
                {stockDetail.volume}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>体积(m³)</div>
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
          {stockDetail.storageLocation && (
          <div style={{
            padding: '16px',
            background: '#f0f9ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
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
          )}
          <List style={{ marginTop: '12px' }}>
            <List.Item extra={stockDetail.inboundTime}>入库时间</List.Item>
            <List.Item extra={`${stockDetail.shelfLife} 天`}>在库天数</List.Item>
          </List>
        </Card>

        {/* 操作历史卡片 */}
        <Card
          title={<><EditSOutline style={{ fontSize: '16px' }} /> 操作历史</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Steps
            direction="vertical"
            current={stockDetail.operationHistory?.length || 0}
          >
            {(stockDetail.operationHistory || []).map((history) => (
              <Steps.Step
                key={history.id}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>
                      {getOperationTypeText(history.type)}
                    </span>
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      {history.operateTime}
                    </span>
                  </div>
                }
                description={
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      {history.description}
                    </div>
                    {history.fromLocation && history.toLocation && (
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {getLocationIcon(history.fromLocation.type)} {history.fromLocation.name}
                        <span style={{ margin: '0 4px' }}>→</span>
                        {getLocationIcon(history.toLocation.type)} {history.toLocation.name}
                      </div>
                    )}
                    {!history.fromLocation && history.toLocation && (
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {getLocationIcon(history.toLocation.type)} {history.toLocation.name}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                      操作人：{history.operator}
                    </div>
                  </div>
                }
              />
            ))}
          </Steps>
        </Card>
      </div>
    </div>
  )
}

export default StockDetail
