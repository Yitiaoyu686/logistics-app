import { useState, useEffect } from 'react'
import { Card, NavBar, Button, Toast, List, ProgressBar } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { ScanningOutline, GlobalOutline, CheckCircleOutline, ContentOutline, CloseCircleOutline } from 'antd-mobile-icons'
import { orderApi, warehouseApi } from '@/api'
import { isDestWarehouseVisibleUnit } from '@/utils/taskVisibility'
import InboundModal, { type InboundData } from './InboundModal'

interface ContainerOrder {
  id: string
  orderNo: string
  subOrderNo: string
  masterOrderId: string
  trackingNo: string
  expressCompany: string
  clientCode: string
  clientName: string
  customerName: string
  customerPhone: string
  pieces: number
  weight: number
  inboundStatus: 'PENDING' | 'INBOUND' | 'COMPLETED'
  actualPieces?: number
  condition?: 'GOOD' | 'DAMAGED' | 'SHORT'
  inboundTime?: string
  inboundOperator?: string
  photos?: string[]
  remark?: string
}

interface ContainerTask {
  id: string
  jobNo: string
  containerNo: string
  transportMode: string
  route: string
  etd?: string
  eta: string
  actualArrivalDate?: string
  status: 'PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'INBOUND_IN_PROGRESS' | 'COMPLETED'
  orders: ContainerOrder[]
  totalOrders: number
  inboundOrders: number
  totalPieces: number
  inboundPieces: number
  totalWeight: number
  inboundWeight: number
  warehouseName?: string
  warehouseId?: string
}

const mapUnitStatus = (
  unitStatus: string,
  inboundOrders: number,
  totalOrders: number
): ContainerTask['status'] => {
  if (totalOrders > 0 && inboundOrders >= totalOrders) return 'COMPLETED'
  if (inboundOrders > 0) return 'INBOUND_IN_PROGRESS'
  if (unitStatus === 'ARRIVED') return 'ARRIVED'
  if (unitStatus === 'SEALED' || unitStatus === 'SHIPPED') return 'IN_TRANSIT'
  return 'PENDING'
}

const mapConditionToPackage = (condition: InboundData['condition']) => {
  if (condition === 'DAMAGED') return 'DAMAGED'
  if (condition === 'SHORT') return 'INCOMPLETE'
  return 'GOOD'
}

const ContainerTaskDetail = () => {
  const navigate = useNavigate()
  const { taskId } = useParams()
  const [task, setTask] = useState<ContainerTask | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [inboundModalVisible, setInboundModalVisible] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<ContainerOrder | null>(null)

  const fetchTask = async () => {
    if (!taskId) {
      setTask(undefined)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [unitRes, usStockRes] = await Promise.all([
        warehouseApi.listUnits(),
        warehouseApi.listStock({ warehouse: 'US' }),
      ])
      const units = (unitRes as any)?.data || []
      const usStocks = (usStockRes as any)?.data || []
      const found = (units as any[]).find((t: any) => String(t.id) === String(taskId))
      if (!found) {
        setTask(undefined)
        return
      }
      if (!isDestWarehouseVisibleUnit(found.status)) {
        setTask(undefined)
        return
      }

      const subRes: any = await orderApi.listSub({ shippingUnitId: found.id, pageSize: 500 })
      const subs = subRes?.data || []

      const stockBySubNo = new Map<string, any>()
      for (const stock of usStocks as any[]) {
        if (!stock?.subOrderNo) continue
        const existing = stockBySubNo.get(stock.subOrderNo)
        if (!existing || String(stock.inboundTime || '') > String(existing.inboundTime || '')) {
          stockBySubNo.set(stock.subOrderNo, stock)
        }
      }

      const masterIds = [...new Set((subs as any[]).map((s: any) => s.masterOrderId).filter(Boolean))]
      const masterMap = new Map<string, any>()
      await Promise.all(
        masterIds.map(async (id) => {
          try {
            const masterRes: any = await orderApi.getMaster(id as string)
            const master = masterRes?.data || masterRes
            if (master?.id) masterMap.set(master.id, master)
          } catch {
            // 单条主单读取失败不阻断页面展示
          }
        })
      )

      const orders: ContainerOrder[] = (subs as any[]).map((sub: any) => {
        const master = masterMap.get(sub.masterOrderId)
        const stock = stockBySubNo.get(sub.subOrderNo)
        const inboundDone = Boolean(stock)
        return {
          id: sub.id,
          orderNo: sub.subOrderNo || '-',
          subOrderNo: sub.subOrderNo || '-',
          masterOrderId: sub.masterOrderId,
          trackingNo: sub.expressTrackingNo || sub.subOrderNo || sub.id,
          expressCompany: sub.expressCompany || 'UNKNOWN',
          clientCode: master?.customerId || 'UNKNOWN',
          clientName: master?.customerName || sub.consignee || '-',
          customerName: master?.customerName || sub.consignee || '-',
          customerPhone: master?.consigneePhone || sub.consigneePhone || '-',
          pieces: Number(sub.pieces || 0),
          weight: Number(sub.weight || 0),
          inboundStatus: inboundDone ? 'COMPLETED' : 'PENDING',
          actualPieces: inboundDone ? Number(stock.pieces || sub.pieces || 0) : undefined,
          inboundTime: stock?.inboundTime
            ? String(stock.inboundTime).replace('T', ' ').slice(0, 16)
            : undefined,
          remark: stock?.remark || undefined,
        }
      })

      const totalPieces = orders.reduce((sum, o) => sum + Number(o.pieces || 0), 0)
      const totalWeight = orders.reduce((sum, o) => sum + Number(o.weight || 0), 0)
      const inboundOrders = orders.filter((o) => o.inboundStatus === 'COMPLETED').length
      const inboundPieces = orders
        .filter((o) => o.inboundStatus === 'COMPLETED')
        .reduce((sum, o) => sum + Number(o.actualPieces || 0), 0)
      const inboundWeight = orders
        .filter((o) => o.inboundStatus === 'COMPLETED')
        .reduce((sum, o) => {
          const stock = stockBySubNo.get(o.subOrderNo)
          return sum + Number(stock?.weight || o.weight || 0)
        }, 0)

      setTask({
        id: found.id,
        jobNo: found.jobNo || found.unitNo || '-',
        containerNo: found.containerNo || found.unitNo || '-',
        transportMode: found.transportMode || 'SEA',
        route: found.warehouse ? `${found.warehouse} → ${found.location || '目的仓'}` : '-',
        eta: found.createdAt ? String(found.createdAt).replace('T', ' ').slice(0, 10) : '-',
        status: mapUnitStatus(found.status, inboundOrders, orders.length),
        orders,
        totalOrders: orders.length,
        inboundOrders,
        totalPieces: totalPieces || Number(found.loadedPieces || 0),
        inboundPieces,
        totalWeight: totalWeight || Number(found.currentWeight || 0),
        inboundWeight,
        warehouseName: found.warehouse || '-',
        warehouseId: found.warehouseId || undefined,
      })
    } catch (err: any) {
      Toast.show({ content: err.message || '加载集装箱详情失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTask()
  }, [taskId])

  // 处理扫码入库
  const handleScanInbound = (order: ContainerOrder) => {
    if (order.inboundStatus === 'COMPLETED') {
      Toast.show('该订单已入库')
      return
    }
    setSelectedOrder(order)
    setInboundModalVisible(true)
  }

  // 确认入库
  const handleConfirmInbound = async (data: InboundData) => {
    if (!task) return
    const order = task.orders.find((o) => o.id === data.orderId)
    if (!order) {
      Toast.show('订单不存在')
      return
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const currentWarehouseId = localStorage.getItem('currentWarehouseId') || task.warehouseId

    setSubmitting(true)
    try {
      await warehouseApi.createInbound({
        subOrderId: order.id,
        masterOrderId: order.masterOrderId,
        trackingNo: order.trackingNo,
        expressCompany: order.expressCompany,
        clientCode: order.clientCode,
        clientName: order.clientName,
        pieces: Number(data.actualPieces),
        actualWeight: Number(order.weight || 0),
        actualVolume: 0,
        packageCondition: mapConditionToPackage(data.condition),
        inboundMethod: 'SCAN',
        warehouseLocation: null,
        warehouse: 'US',
        warehouseId: currentWarehouseId,
        operator: user?.name || user?.realName || '仓管员',
        photos: data.photos || [],
        remark: data.remark || null,
      })

      Toast.show('入库成功')
      setInboundModalVisible(false)
      setSelectedOrder(null)
      await fetchTask()
    } catch (err: any) {
      Toast.show(err.message || '入库失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>集装箱详情</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          加载中...
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>集装箱详情</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}><CloseCircleOutline style={{ fontSize: '48px', color: '#ff4d4f' }} /></div>
          <div style={{ fontSize: '16px' }}>任务不存在</div>
        </div>
      </div>
    )
  }

  // 获取状态文本和颜色
  const getStatusInfo = (status: ContainerTask['status']) => {
    const statusMap = {
      'PENDING': { text: '待发运', color: '#999' },
      'IN_TRANSIT': { text: '运输中', color: '#1677ff' },
      'ARRIVED': { text: '已到达', color: '#52c41a' },
      'INBOUND_IN_PROGRESS': { text: '入库中', color: '#faad14' },
      'COMPLETED': { text: '已完成', color: '#13c2c2' }
    }
    return statusMap[status] || { text: status, color: '#999' }
  }

  const statusInfo = getStatusInfo(task.status)
  const progress = task.totalOrders > 0
    ? Math.round((task.inboundOrders / task.totalOrders) * 100)
    : 0

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>集装箱详情</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 基本信息卡片 */}
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><GlobalOutline style={{ fontSize: '16px' }} /> 集装箱信息</span>
              <span style={{
                fontSize: '12px',
                color: '#fff',
                background: statusInfo.color,
                padding: '4px 8px',
                borderRadius: '4px'
              }}>
                {statusInfo.text}
              </span>
            </div>
          }
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <List>
            <List.Item extra={task.containerNo}>集装箱号</List.Item>
            <List.Item extra={task.jobNo}>任务号</List.Item>
            <List.Item extra={task.transportMode === 'SEA' ? '海运' : '空运'}>运输方式</List.Item>
            <List.Item extra={task.route}>路线</List.Item>
            <List.Item extra={task.etd}>预计开船</List.Item>
            <List.Item extra={task.eta}>预计到达</List.Item>
            {task.actualArrivalDate && (
              <List.Item extra={task.actualArrivalDate}>实际到达</List.Item>
            )}
            <List.Item extra={task.warehouseName}>仓库</List.Item>
          </List>
        </Card>

        {/* 入库进度卡片 */}
        <Card
          title={<><CheckCircleOutline style={{ fontSize: '16px' }} /> 入库进度</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>
                已入库 {task.inboundOrders} / {task.totalOrders} 个订单
              </span>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff' }}>
                {progress}%
              </span>
            </div>
            <ProgressBar
              percent={progress}
              style={{
                '--fill-color': task.inboundOrders === task.totalOrders ? '#52c41a' : '#1677ff',
                '--track-width': '8px'
              }}
            />
          </div>

          {/* 统计信息 */}
          <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0f9ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1677ff', marginBottom: '4px' }}>
                {task.totalOrders}
              </div>
              <div style={{ color: '#666' }}>总订单</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a', marginBottom: '4px' }}>
                {task.inboundOrders}
              </div>
              <div style={{ color: '#666' }}>已入库</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#fef2f2', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff4d4f', marginBottom: '4px' }}>
                {task.totalOrders - task.inboundOrders}
              </div>
              <div style={{ color: '#666' }}>待入库</div>
            </div>
          </div>
        </Card>

        {/* 订单列表 */}
        <Card
          title={<><ContentOutline style={{ fontSize: '16px' }} /> 待入库订单</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          {task.orders.map((order, index) => {
            const isCompleted = order.inboundStatus === 'COMPLETED'

            return (
              <div
                key={order.id}
                style={{
                  padding: '12px',
                  marginBottom: index < task.orders.length - 1 ? '8px' : 0,
                  background: isCompleted ? '#f0fdf4' : '#fef2f2',
                  borderRadius: '8px',
                  border: `1px solid ${isCompleted ? '#86efac' : '#fecaca'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                      {order.subOrderNo}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {order.customerName} | {order.customerPhone}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: isCompleted ? '#52c41a' : '#ff4d4f',
                    background: isCompleted ? '#f0fdf4' : '#fef2f2',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    border: `1px solid ${isCompleted ? '#86efac' : '#fecaca'}`
                  }}>
                    {isCompleted ? '✓ 已入库' : '待入库'}
                  </div>
                </div>

                <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                  <div>件数：{order.pieces}件 | 重量：{order.weight}kg</div>
                  {order.inboundTime && (
                    <div>入库时间：{order.inboundTime}</div>
                  )}
                  {order.actualPieces && (
                    <div>实际件数：{order.actualPieces}件</div>
                  )}
                </div>
              </div>
            )
          })}
        </Card>
      </div>

      {/* 底部固定按钮 */}
      {task.inboundOrders < task.totalOrders && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)'
        }}>
          <Button
            block
            color="primary"
            size="large"
            onClick={() => {
              if (submitting) return
              // 找到第一个待入库的订单
              const pendingOrder = task.orders.find(o => o.inboundStatus !== 'COMPLETED')
              if (pendingOrder) {
                handleScanInbound(pendingOrder)
              } else {
                Toast.show('所有订单已入库')
              }
            }}
            style={{
              fontSize: '16px',
              fontWeight: 'bold'
            }}
            loading={submitting}
          >
            <ScanningOutline style={{ fontSize: '16px' }} /> 开始扫码入库
          </Button>
        </div>
      )}

      {/* 入库弹窗 */}
      <InboundModal
        visible={inboundModalVisible}
        order={selectedOrder}
        onClose={() => {
          setInboundModalVisible(false)
          setSelectedOrder(null)
        }}
        onConfirm={handleConfirmInbound}
      />
    </div>
  )
}

export default ContainerTaskDetail
