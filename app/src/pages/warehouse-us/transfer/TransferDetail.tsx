import { useState, useEffect } from 'react'
import { Card, Button, NavBar, List, Tag, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { DeleteOutline, ScanningOutline, FileOutline, PieOutline, ContentOutline } from 'antd-mobile-icons'
import { warehouseApi } from '@/api'

interface Warehouse { code: string; name: string; location: string }

type TransferStatus = 'DRAFT' | 'PACKED' | 'SHIPPED' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED'

// 订单信息
interface OrderInfo {
  orderNo: string
  customerName: string
  pieces: number
  weight: number
  volume: number
}

const toWh = (name: string): Warehouse => {
  const map: Record<string, Warehouse> = {
    '广州仓': { code: '广州仓', name: '广州仓', location: '广州' },
    '深圳仓': { code: '深圳仓', name: '深圳仓', location: '深圳' },
    '拉各斯主仓': { code: '拉各斯主仓', name: '拉各斯主仓', location: '拉各斯' },
    '拉各斯自提点A': { code: '拉各斯自提点A', name: '拉各斯自提点A', location: '拉各斯' },
    '拉各斯自提点B': { code: '拉各斯自提点B', name: '拉各斯自提点B', location: '拉各斯' },
  }
  return map[name] || { code: name, name, location: '' }
}

// 调拨详情
interface TransferDetailData {
  id: string
  transferNo: string
  itemType: 'ORDER' | 'CONTAINER'
  fromWarehouse: Warehouse
  toWarehouse: Warehouse
  status: TransferStatus
  orderCount: number
  totalPieces: number
  totalWeight: number
  totalVolume: number
  containerNo?: string
  containerType?: string
  createTime: string
  createUser?: string
  remark?: string
  orders: OrderInfo[]
}

const TransferDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [transferDetail, setTransferDetail] = useState<TransferDetailData | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    const fetchTransferDetail = async () => {
      try {
        const res = await warehouseApi.listTransfers()
        const raw = (res as any)?.data || []
        const transfer = (raw as any[]).find((t: any) => String(t.id) === String(id))

        if (!transfer) {
          Toast.show({ content: '调拨单不存在', icon: 'fail' })
          navigate(-1)
          return
        }

        const orders: OrderInfo[] = (transfer.items || []).map((item: any) => ({
          orderNo: item.subOrderNo || item.trackingNo || '-',
          customerName: item.goodsName || '-',
          pieces: item.pieces || 0,
          weight: item.weight || 0,
          volume: item.volume || 0,
        }))

        const detail: TransferDetailData = {
          id: transfer.id,
          transferNo: transfer.transferNo || '-',
          itemType: transfer.itemType || 'ORDER',
          fromWarehouse: toWh(transfer.fromWarehouse || ''),
          toWarehouse: toWh(transfer.toWarehouse || ''),
          status: transfer.status || 'DRAFT',
          orderCount: orders.length,
          totalPieces: transfer.totalPieces || 0,
          totalWeight: transfer.totalWeight || 0,
          totalVolume: transfer.totalVolume || 0,
          containerNo: transfer.containerNo,
          containerType: transfer.containerType,
          createTime: transfer.createdAt ? transfer.createdAt.replace('T', ' ').slice(0, 16) : '-',
          createUser: transfer.createdBy || '-',
          remark: transfer.remark || undefined,
          orders,
        }

        setTransferDetail(detail)

        // 只有草稿状态才进入编辑模式
        if (detail.status === 'DRAFT') {
          setIsEditing(true)
        }
      } catch (err: any) {
        Toast.show({ content: err.message || '加载调拨详情失败', icon: 'fail' })
      }
    }
    fetchTransferDetail()
  }, [id, navigate])

  if (!transferDetail) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#999' }}>加载中...</div>
      </div>
    )
  }

  // 获取状态文本
  const getStatusText = (status: TransferStatus) => {
    const statusMap = {
      DRAFT: '草稿',
      PACKED: '已打包',
      SHIPPED: '已发运',
      IN_TRANSIT: '运输中',
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

  // 移除订单（草稿状态）
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
      totalVolume: newTotalVolume,
      orderCount: newOrders.length
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
    } catch (err: any) {
      Toast.show({ content: err.message || '提交失败', icon: 'fail' })
    }
  }

  // 确认入库（已到达状态）
  const handleConfirmInbound = () => {
    if (!window.confirm('确定要确认入库吗？')) return
    navigate(`/warehouse-us/inbound/scan?transferId=${transferDetail.id}`)
  }

  // 取消调拨单（草稿状态）
  const handleCancel = async () => {
    if (!window.confirm('确定要取消这个调拨单吗？取消后将无法恢复。')) return
    try {
      await warehouseApi.updateTransfer(transferDetail.id, { status: 'CANCELLED' })
      Toast.show({ content: '调拨单已取消', icon: 'success' })
      setTimeout(() => navigate(-1), 800)
    } catch (err: any) {
      Toast.show({ content: err.message || '取消失败', icon: 'fail' })
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
            <List.Item extra={`${transferDetail.fromWarehouse.name} (${transferDetail.fromWarehouse.location})`}>
              发出仓库
            </List.Item>
            <List.Item extra={`${transferDetail.toWarehouse.name} (${transferDetail.toWarehouse.location})`}>
              目标仓库
            </List.Item>
            {transferDetail.itemType === 'CONTAINER' && (
              <>
                <List.Item extra={transferDetail.containerNo}>集装箱号</List.Item>
                <List.Item extra={transferDetail.containerType}>箱型</List.Item>
              </>
            )}
            <List.Item extra={transferDetail.createTime}>创建时间</List.Item>
            {transferDetail.createUser && (
              <List.Item extra={transferDetail.createUser}>创建人</List.Item>
            )}
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
                  onClick={() => navigate('/warehouse-us/inbound/scan?mode=transfer')}
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
            开始入库
          </Button>
        </div>
      )}
    </div>
  )
}

export default TransferDetail
