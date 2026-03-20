import { useState, useEffect } from 'react'
import { Card, Button, NavBar, List, Tag, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { DeleteOutline, ScanningOutline, FileOutline, PieOutline, ContentOutline } from 'antd-mobile-icons'
import { warehouseApi } from '../../api'

// 调拨类型
type TransferItemType = 'ORDER' | 'CONTAINER'
type TransferStatus = 'DRAFT' | 'PACKED' | 'SHIPPED' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED'

// 仓库信息
interface Warehouse {
  code: string
  name: string
  location: string
}

// 订单信息
interface OrderInfo {
  orderNo: string
  customerName: string
  pieces: number
  weight: number
  volume: number
}

// 调拨详情
interface TransferDetail {
  id: string
  transferNo: string
  itemType: TransferItemType
  fromWarehouse: Warehouse
  toWarehouse: Warehouse
  status: TransferStatus
  createTime: string
  createUser: string
  orders: OrderInfo[]
  containerNo?: string
  containerType?: string
  totalPieces: number
  totalWeight: number
  totalVolume: number
  remark?: string
}

const TransferDetail = () => {
  const navigate = useNavigate()
  const { transferId } = useParams()
  const [transferDetail, setTransferDetail] = useState<TransferDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // 构造仓库对象（从字符串名称）
  const toWarehouseObj = (name: string): Warehouse => {
    return { code: name || '-', name: name || '-', location: '' }
  }

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res: any = await warehouseApi.listTransfers()
        const list = Array.isArray(res) ? res : (res?.data || [])
        const found = list.find((t: any) => String(t.id) === String(transferId))
        if (found) {
          const orders: OrderInfo[] = (found.items || []).map((item: any) => ({
            orderNo: item.subOrderNo || '-',
            customerName: item.goodsName || '-',
            pieces: item.pieces || 0,
            weight: item.weight || 0,
            volume: item.volume || 0,
          }))
          const detail: TransferDetail = {
            id: found.id,
            transferNo: found.transferNo || '-',
            itemType: (found.itemType || 'ORDER') as TransferItemType,
            fromWarehouse: typeof found.fromWarehouse === 'object' ? found.fromWarehouse : toWarehouseObj(found.fromWarehouse),
            toWarehouse: typeof found.toWarehouse === 'object' ? found.toWarehouse : toWarehouseObj(found.toWarehouse),
            status: found.status as TransferStatus,
            createTime: found.createdAt ? found.createdAt.replace('T', ' ').slice(0, 16) : '-',
            createUser: found.createdBy || '-',
            orders,
            containerNo: found.containerNo || undefined,
            totalPieces: found.totalPieces || 0,
            totalWeight: found.totalWeight || 0,
            totalVolume: found.totalVolume || 0,
            remark: found.remark || undefined,
          }
          setTransferDetail(detail)
          if (found.status === 'DRAFT') {
            setIsEditing(true)
          }
        } else {
          Toast.show({ icon: 'fail', content: '未找到调拨单' })
        }
      } catch (err) {
        Toast.show({ icon: 'fail', content: '获取调拨详情失败' })
      }
    }
    if (transferId) {
      fetchDetail()
    }
  }, [transferId])

  if (!transferDetail) {
    return <div>加载中...</div>
  }

  // 获取状态文本
  const getStatusText = (status: TransferStatus) => {
    const statusMap = {
      DRAFT: '草稿',
      PACKED: '已打包',
      SHIPPED: '已发运',
      IN_TRANSIT: '在途中',
      ARRIVED: '已到达',
      RECEIVED: '已签收'
    }
    return statusMap[status]
  }

  // 获取状态颜色
  const getStatusColor = (status: TransferStatus) => {
    if (status === 'DRAFT') return 'default'
    if (status === 'ARRIVED' || status === 'RECEIVED') return 'success'
    return 'primary'
  }

  // 移除订单
  const handleRemoveOrder = (orderNo: string) => {
    if (!window.confirm(`确定要移除订单 ${orderNo} 吗？`)) return
    const newOrders = transferDetail.orders.filter(o => o.orderNo !== orderNo)
    const newTotalPieces = newOrders.reduce((sum, o) => sum + o.pieces, 0)
    const newTotalWeight = newOrders.reduce((sum, o) => sum + o.weight, 0)
    const newTotalVolume = newOrders.reduce((sum, o) => sum + o.volume, 0)

    setTransferDetail({
      ...transferDetail,
      orders: newOrders,
      totalPieces: newTotalPieces,
      totalWeight: newTotalWeight,
      totalVolume: newTotalVolume
    })
    Toast.show({ content: '订单已移除', icon: 'success' })
  }

  // 提交调拨单（草稿状态）
  const handleSubmit = async () => {
    if (transferDetail.orders.length === 0) {
      Toast.show({ content: '请至少添加一个订单', icon: 'fail' })
      return
    }
    if (!window.confirm('确定要提交调拨单吗？提交后将无法修改。')) return

    try {
      await warehouseApi.updateTransfer(transferDetail.id, { status: 'PACKED' })
      Toast.show({ content: '调拨单已提交', icon: 'success' })
      setTimeout(() => navigate(-1), 800)
    } catch (e: any) {
      Toast.show({ content: e.message || '提交失败', icon: 'fail' })
    }
  }

  // 确认入库（待入库状态）
  const handleConfirmInbound = async () => {
    if (!window.confirm('确定要确认入库吗？')) return

    try {
      await warehouseApi.updateTransfer(transferDetail.id, { status: 'RECEIVED' })
      Toast.show({ content: '入库确认成功', icon: 'success' })
      setTimeout(() => navigate(-1), 800)
    } catch (e: any) {
      Toast.show({ content: e.message || '确认失败', icon: 'fail' })
    }
  }

  // 取消调拨单（草稿状态）
  const handleCancel = async () => {
    if (!window.confirm('确定要取消这个调拨单吗？取消后将无法恢复。')) return

    try {
      await warehouseApi.updateTransfer(transferDetail.id, { status: 'CANCELLED' })
      Toast.show({ content: '调拨单已取消', icon: 'success' })
      setTimeout(() => navigate(-1), 800)
    } catch (e: any) {
      Toast.show({ content: e.message || '取消失败', icon: 'fail' })
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>调拨详情</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 状态标签 */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
          <Tag
            color={getStatusColor(transferDetail.status)}
            style={{ fontSize: '13px', padding: '4px 12px' }}
          >
            {getStatusText(transferDetail.status)}
          </Tag>
          <Tag
            color="success"
            style={{ fontSize: '13px', padding: '4px 12px' }}
          >
            {transferDetail.itemType === 'ORDER' ? '订单调拨' : '集装箱调拨'}
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
            <List.Item extra={transferDetail.transferNo}>调拨单号</List.Item>
            <List.Item extra={transferDetail.fromWarehouse.location ? `${transferDetail.fromWarehouse.name} (${transferDetail.fromWarehouse.location})` : transferDetail.fromWarehouse.name}>
              调出仓库
            </List.Item>
            <List.Item extra={transferDetail.toWarehouse.location ? `${transferDetail.toWarehouse.name} (${transferDetail.toWarehouse.location})` : transferDetail.toWarehouse.name}>
              调入仓库
            </List.Item>
            <List.Item extra={transferDetail.createTime}>创建时间</List.Item>
            <List.Item extra={transferDetail.createUser}>创建人</List.Item>
            {transferDetail.remark && (
              <List.Item>
                <div>
                  <div style={{ color: '#999', fontSize: '14px', marginBottom: '4px' }}>备注</div>
                  <div style={{ fontSize: '14px' }}>{transferDetail.remark}</div>
                </div>
              </List.Item>
            )}
          </List>
        </Card>

        {/* 统计信息卡片 */}
        <Card
          title={<><PieOutline style={{ fontSize: '16px' }} /> 统计信息</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0f9ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1677ff', marginBottom: '4px' }}>
                {transferDetail.orders.length}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>订单数</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a', marginBottom: '4px' }}>
                {transferDetail.totalPieces}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>总件数</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#fffbeb', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#faad14', marginBottom: '4px' }}>
                {transferDetail.totalWeight}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>总重量(kg)</div>
            </div>
          </div>
        </Card>

        {/* 订单列表卡片 */}
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><ContentOutline style={{ fontSize: '16px' }} /> 订单列表</span>
              {isEditing && transferDetail.status === 'DRAFT' && (
                <Button
                  size="small"
                  color="primary"
                  fill="outline"
                  onClick={() => navigate('/inbound/scan?mode=transfer')}
                >
                  <ScanningOutline /> 扫码添加
                </Button>
              )}
            </div>
          }
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          {transferDetail.orders.map((order, index) => (
            <div
              key={index}
              style={{
                padding: '12px',
                marginBottom: index < transferDetail.orders.length - 1 ? '8px' : 0,
                background: '#fafafa',
                borderRadius: '8px',
                border: '1px solid #f0f0f0'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                    {order.orderNo}
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    {order.customerName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {order.pieces}件 · {order.weight}kg · {order.volume}m³
                  </div>
                </div>
                {isEditing && transferDetail.status === 'DRAFT' && (
                  <Button
                    size="mini"
                    color="danger"
                    fill="none"
                    onClick={() => handleRemoveOrder(order.orderNo)}
                  >
                    <DeleteOutline />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* 底部操作按钮 */}
      {/* 草稿状态：取消和提交调拨单 */}
      {transferDetail.status === 'DRAFT' && (
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
              onClick={handleCancel}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                flex: 1
              }}
            >
              取消调拨单
            </Button>
            <Button
              color="primary"
              size="large"
              onClick={handleSubmit}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                flex: 1
              }}
            >
              提交调拨单
            </Button>
          </div>
        </div>
      )}

      {/* 待入库状态（已到达）：确认入库 */}
      {transferDetail.status === 'ARRIVED' && (
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
            color="success"
            size="large"
            onClick={handleConfirmInbound}
            style={{
              '--border-radius': '8px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            确认入库
          </Button>
        </div>
      )}
    </div>
  )
}

export default TransferDetail
