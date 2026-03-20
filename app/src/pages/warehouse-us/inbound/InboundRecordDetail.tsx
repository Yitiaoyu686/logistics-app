import { useState, useEffect } from 'react'
import { Card, NavBar, List, Image, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { FileOutline, PieOutline, ContentOutline, EditSOutline, GiftOutline } from 'antd-mobile-icons'
import { warehouseApi } from '@/api'

type GoodsCondition = 'GOOD' | 'DAMAGED' | 'SHORT'

// 订单入库详情
interface OrderInboundDetail {
  orderNo: string
  customerName: string
  pieces: number
  actualPieces: number
  weight: number
  condition: GoodsCondition
  photos: string[]
  remark?: string
}

// 入库任务记录详情
interface InboundTaskRecordDetail {
  id: string
  type: 'CONTAINER' | 'TRANSFER'
  taskNo: string
  containerNo?: string
  transferNo?: string

  // 统计信息
  orderCount: number
  totalPieces: number
  totalWeight: number
  completedOrders: number

  // 订单列表
  orders: OrderInboundDetail[]

  // 操作信息
  operator: string
  operatorPhone: string
  inboundTime: string
  completedTime?: string

  // 其他
  status: 'COMPLETED' | 'PARTIAL'
  remark?: string
}

const InboundRecordDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [recordDetail, setRecordDetail] = useState<InboundTaskRecordDetail | null>(null)

  useEffect(() => {
    const fetchRecordDetail = async () => {
      if (!id) return
      try {
        const res = await warehouseApi.listInbound()
        const raw = (res as any)?.data || []
        const found = (raw as any[]).find((r: any) => String(r.id) === String(id))
        if (found) {
          const detail: InboundTaskRecordDetail = {
            id: found.id,
            type: 'CONTAINER',
            taskNo: found.trackingNo || found.id,
            containerNo: found.trackingNo || '-',
            orderCount: 1,
            totalPieces: found.pieces || 0,
            totalWeight: found.actualWeight || 0,
            completedOrders: found.status === 'COMPLETED' ? 1 : 0,
            orders: [{
              orderNo: found.subOrderId || '-',
              customerName: found.clientName || '-',
              pieces: found.pieces || 0,
              actualPieces: found.pieces || 0,
              weight: found.actualWeight || 0,
              condition: 'GOOD' as GoodsCondition,
              photos: found.photos ? (typeof found.photos === 'string' ? JSON.parse(found.photos) : found.photos) : [],
              remark: found.remark || undefined,
            }],
            operator: found.operator || '-',
            operatorPhone: '',
            inboundTime: found.inboundTime ? found.inboundTime.replace('T', ' ').slice(0, 16) : '-',
            status: found.status === 'COMPLETED' ? 'COMPLETED' : 'PARTIAL',
            remark: found.remark || undefined,
          }
          setRecordDetail(detail)
        }
      } catch (err: any) {
        Toast.show({ icon: 'fail', content: err.message || '获取入库记录详情失败' })
      }
    }
    fetchRecordDetail()
  }, [id])

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

  // 获取货物状态文本
  const getConditionText = (condition: GoodsCondition) => {
    const map = {
      GOOD: '完好',
      DAMAGED: '破损',
      SHORT: '短少'
    }
    return map[condition]
  }

  // 获取货物状态颜色
  const getConditionColor = (condition: GoodsCondition) => {
    const map = {
      GOOD: { color: '#52c41a', bg: '#f0fdf4' },
      DAMAGED: { color: '#ff4d4f', bg: '#fff1f0' },
      SHORT: { color: '#faad14', bg: '#fffbeb' }
    }
    return map[condition]
  }

  if (!recordDetail) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#999' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}><GiftOutline style={{ fontSize: '48px', color: '#ccc' }} /></div>
          <div>加载中...</div>
        </div>
      </div>
    )
  }

  const statusColor = getStatusColor(recordDetail.status)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      {/* 顶部导航栏 */}
      <NavBar onBack={() => navigate(-1)}>
        入库记录详情
      </NavBar>

      <div style={{ padding: '16px' }}>
        {/* 状态标签 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <div style={{
            fontSize: '11px',
            color: statusColor.color,
            background: statusColor.bg,
            padding: '2px 8px',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            {getStatusText(recordDetail.status)}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#1677ff',
            background: '#e6f4ff',
            padding: '2px 8px',
            borderRadius: '4px'
          }}>
            {recordDetail.type === 'CONTAINER' ? '集装箱入库' : '调拨入库'}
          </div>
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
            <List.Item extra={recordDetail.taskNo}>任务号</List.Item>
            {recordDetail.type === 'CONTAINER' && (
              <List.Item extra={recordDetail.containerNo}>集装箱号</List.Item>
            )}
            {recordDetail.type === 'TRANSFER' && (
              <List.Item extra={recordDetail.transferNo}>调拨单号</List.Item>
            )}
            <List.Item extra={recordDetail.inboundTime}>入库时间</List.Item>
            {recordDetail.completedTime && (
              <List.Item extra={recordDetail.completedTime}>完成时间</List.Item>
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
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: '12px 0'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1677ff', marginBottom: '4px' }}>
                {recordDetail.completedOrders}/{recordDetail.orderCount}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>订单数</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a', marginBottom: '4px' }}>
                {recordDetail.totalPieces}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>总件数</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#faad14', marginBottom: '4px' }}>
                {recordDetail.totalWeight}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>总重量(kg)</div>
            </div>
          </div>
        </Card>

        {/* 订单列表卡片 */}
        <Card
          title={<><ContentOutline style={{ fontSize: '16px' }} /> 订单列表 ({recordDetail.orders.length})</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          {recordDetail.orders.map((order, index) => {
            const conditionColor = getConditionColor(order.condition)
            return (
              <div
                key={order.orderNo}
                style={{
                  padding: '12px',
                  marginBottom: index < recordDetail.orders.length - 1 ? '12px' : 0,
                  background: '#fafafa',
                  borderRadius: '8px',
                  border: '1px solid #f0f0f0'
                }}
              >
                {/* 订单号和状态 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                    {order.orderNo}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: conditionColor.color,
                    background: conditionColor.bg,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 'bold'
                  }}>
                    {getConditionText(order.condition)}
                  </div>
                </div>

                {/* 客户信息 */}
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  客户：{order.customerName}
                </div>

                {/* 件数和重量 */}
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
                  预报：{order.pieces}件 · 实收：{order.actualPieces}件 · {order.weight}kg
                </div>

                {/* 照片 */}
                {order.photos && order.photos.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>照片：</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {order.photos.map((photo, photoIndex) => (
                        <Image
                          key={photoIndex}
                          src={photo}
                          width={60}
                          height={60}
                          fit="cover"
                          style={{ borderRadius: '4px' }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 备注 */}
                {order.remark && (
                  <div style={{
                    fontSize: '12px',
                    color: '#ff4d4f',
                    background: '#fff1f0',
                    padding: '6px 8px',
                    borderRadius: '4px'
                  }}>
                    备注：{order.remark}
                  </div>
                )}
              </div>
            )
          })}
        </Card>

        {/* 操作员信息卡片 */}
        <Card
          title="操作员信息"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <List>
            <List.Item extra={recordDetail.operator}>操作员</List.Item>
            <List.Item extra={recordDetail.operatorPhone}>联系电话</List.Item>
          </List>
        </Card>

        {/* 备注信息 */}
        {recordDetail.remark && (
          <Card
            title={<><EditSOutline style={{ fontSize: '16px' }} /> 备注</>}
            style={{
              marginBottom: '16px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
              {recordDetail.remark}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default InboundRecordDetail
