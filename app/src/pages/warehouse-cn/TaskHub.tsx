import { useState, useEffect } from 'react'
import { Card, Badge, Tabs, Toast } from 'antd-mobile'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  EditSOutline,
  DeleteOutline,
  UnorderedListOutline,
  InformationCircleOutline,
  CheckCircleOutline,
  GlobalOutline,
  SendOutline,
  ContentOutline,
  TruckOutline,
  UpCircleOutline
} from 'antd-mobile-icons'
import FloatingScanButton from '@/components/FloatingScanButton'
import StockList from './StockList'
import { jobApi, warehouseApi, orderApi } from '../../api'

// 客户下单类型
interface OrderInbound {
  id: string
  type: 'ORDER'
  orderNo: string
  customerName: string
  expectedTime: string
  priority: 'high' | 'normal'
}

// 报关退回类型
interface CustomsReturnInbound {
  id: string
  type: 'CUSTOMS_RETURN'
  jobNo: string
  containerNo: string
  orderCount: number
  returnDate: string
  reason: string
}

type InboundTask = OrderInbound | CustomsReturnInbound

// 集装单元（装箱任务）
interface ShippingUnit {
  id: string
  unitNo: string
  unitType: string
  transportMode: 'SEA' | 'AIR'
  status: 'EMPTY' | 'LOADING' | 'SEALED' | 'SHIPPED'
  maxWeight: number
  maxVolume: number
  currentWeight: number
  currentVolume: number
  loadedPieces: number
  loadedOrders: number
  jobNo: string | null
  warehouse: string | null
  sealNo: string | null
  orderIds: string[]
  createdAt: string
}

// 退运原因类型
type ReturnReason =
  | 'CUSTOMER_CANCEL'      // 客户取消订单
  | 'DAMAGED'              // 货物破损
  | 'CUSTOMS_REJECT'       // 报关退回
  | 'DELIVERY_FAILED'      // 配送失败
  | 'CUSTOMER_REJECT'      // 客户拒收
  | 'QUALITY_ISSUE'        // 质量问题
  | 'ADDRESS_ERROR'        // 地址错误

// 退运任务
interface ReturnTask {
  id: string
  orderNo: string
  customerName: string
  returnReason: ReturnReason
  reasonDetail: string
  pieces: number
  weight: number
  volume?: number
  currentLocation: string
  applyTime: string
  applicant: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED'
  priority: 'high' | 'normal'
}

// 调拨类型
type TransferItemType = 'ORDER' | 'CONTAINER'
type TransferStatus = 'DRAFT' | 'PACKED' | 'SHIPPED' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED'

interface Warehouse {
  code: string
  name: string
  location: string
}

interface TransferBase {
  id: string
  transferNo: string
  itemType: TransferItemType
  fromWarehouse: Warehouse
  toWarehouse: Warehouse
  orderCount: number
  createTime: string
  status: TransferStatus
}

interface OrderTransfer extends TransferBase {
  itemType: 'ORDER'
  orderNos: string[]
  totalPieces: number
  totalWeight: number
}

interface ContainerTransfer extends TransferBase {
  itemType: 'CONTAINER'
  containerNo: string
  containerType: string
  totalPieces: number
  totalWeight: number
}

type Transfer = OrderTransfer | ContainerTransfer

const TaskHub = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('inbound')
  const [transferSubTab, setTransferSubTab] = useState('inbound')
  const [packingTasks, setPackingTasks] = useState<ShippingUnit[]>([])
  const [returnTasks, setReturnTasks] = useState<ReturnTask[]>([])
  const [inboundTasks, setInboundTasks] = useState<InboundTask[]>([])
  const [transferTasks, setTransferTasks] = useState<Transfer[]>([])
  const [outboundTransfers, setOutboundTransfers] = useState<Transfer[]>([])
  const [draftTransfers, setDraftTransfers] = useState<Transfer[]>([])

  // 从 URL 参数读取默认标签页
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['inbound', 'packing', 'transfer', 'stock', 'return'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // 加载集装单元数据
  useEffect(() => {
    const fetchPackingTasks = async () => {
      try {
        const res: any = await warehouseApi.listUnits()
        const raw = res?.data || res || []
        const units: ShippingUnit[] = (Array.isArray(raw) ? raw : [])
          .filter((u: any) => u.status === 'EMPTY' || u.status === 'LOADING')
          .map((u: any) => ({
            id: u.id,
            unitNo: u.unitNo || '-',
            unitType: u.unitType || '-',
            transportMode: u.transportMode || 'SEA',
            status: u.status || 'EMPTY',
            maxWeight: u.maxWeight || 0,
            maxVolume: u.maxVolume || 0,
            currentWeight: u.currentWeight || 0,
            currentVolume: u.currentVolume || 0,
            loadedPieces: u.loadedPieces || 0,
            loadedOrders: u.loadedOrders || 0,
            jobNo: u.jobNo || null,
            warehouse: u.warehouse || null,
            sealNo: u.sealNo || null,
            orderIds: u.orderIds || [],
            createdAt: u.createdAt || '',
          }))
        setPackingTasks(units)
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '获取集装单元失败' })
      }
    }
    fetchPackingTasks()
  }, [])

  // 加载退运任务数据
  useEffect(() => {
    const fetchReturnTasks = async () => {
      try {
        const res: any = await warehouseApi.listReturns()
        const raw = Array.isArray(res) ? res : (res?.data || [])
        setReturnTasks((raw as any[]).map((r: any) => ({
          id: r.id,
          orderNo: r.orderNo || '-',
          customerName: r.customerName || '-',
          returnReason: (r.returnType || r.reason || 'CUSTOMER_CANCEL') as ReturnReason,
          reasonDetail: r.reason || '-',
          pieces: r.pieces || 0,
          weight: r.weight || 0,
          volume: r.volume || 0,
          currentLocation: r.currentLocation || '-',
          applyTime: r.applyTime ? r.applyTime.replace('T', ' ').slice(0, 16) : '-',
          applicant: r.applicant || '-',
          status: r.status === 'APPROVED' || r.status === 'RETURNING' ? 'PROCESSING' : r.status === 'RETURNED' ? 'COMPLETED' : 'PENDING',
          priority: r.status === 'PENDING' ? 'high' as const : 'normal' as const,
        })))
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '获取退运任务失败' })
      }
    }
    fetchReturnTasks()
  }, [])

  // 加载入库任务数据（查询等待入库的主订单）
  useEffect(() => {
    const fetchInboundTasks = async () => {
      try {
        const res: any = await orderApi.listMaster({ status: 'PENDING_INBOUND' })
        const raw = res?.data || []
        const orders = Array.isArray(raw) ? raw : []
        setInboundTasks(orders.map((o: any) => ({
          id: o.id,
          type: 'ORDER' as const,
          orderNo: o.orderNo || o.id,
          customerName: o.customerName || '-',
          expectedTime: o.createdAt ? o.createdAt.replace('T', ' ').slice(0, 16) : '-',
          priority: 'normal' as const,
          totalPieces: o.totalPieces || 0,
          totalWeight: o.totalWeight || 0,
          destCountry: o.destCountry || '',
          destCity: o.destCity || '',
          consignee: o.consignee || '',
        })))
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '获取入库任务失败' })
      }
    }
    fetchInboundTasks()
  }, [])

  // 加载调拨任务数据
  useEffect(() => {
    const toWh = (v: any): Warehouse => {
      if (typeof v === 'object' && v?.name) return v
      return { code: v || '-', name: v || '-', location: '' }
    }
    const fetchTransfers = async () => {
      try {
        const res: any = await warehouseApi.listTransfers()
        const rawList = Array.isArray(res) ? res : (res?.data || [])
        const all: Transfer[] = (rawList as any[]).map((t: any) => ({
          id: t.id,
          transferNo: t.transferNo || '-',
          itemType: (t.itemType || 'ORDER') as TransferItemType,
          fromWarehouse: toWh(t.fromWarehouse),
          toWarehouse: toWh(t.toWarehouse),
          orderCount: t.items?.length || 0,
          createTime: t.createdAt ? t.createdAt.replace('T', ' ').slice(0, 16) : '-',
          status: t.status as TransferStatus,
          totalPieces: t.totalPieces || 0,
          totalWeight: t.totalWeight || 0,
          ...(t.itemType === 'CONTAINER' ? {
            containerNo: t.containerNo || '-',
            containerType: t.containerNo ? '40HQ' : '-',
          } : {}),
          orderNos: (t.items || []).map((i: any) => i.subOrderNo || '-'),
        }))
        setTransferTasks(all.filter(t => ['IN_TRANSIT', 'ARRIVED'].includes(t.status)))
        setOutboundTransfers(all.filter(t => ['SHIPPED', 'PACKED'].includes(t.status)))
        setDraftTransfers(all.filter(t => t.status === 'DRAFT'))
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '获取调拨任务失败' })
      }
    }
    fetchTransfers()
  }, [])

  // 删除集装箱
  const handleDeleteContainer = async (containerId: string, containerNo: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`确定要删除集装箱 ${containerNo} 吗？`)) return
    try {
      await warehouseApi.deleteUnit(containerId)
      setPackingTasks(prev => prev.filter(t => t.id !== containerId))
      Toast.show({ content: '集装箱已删除', icon: 'success' })
    } catch (err: any) {
      Toast.show({ content: err.message || '删除失败', icon: 'fail' })
    }
  }

  // 删除退运任务
  const handleDeleteReturn = (taskId: string, orderNo: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`确定要删除退运任务 ${orderNo} 吗？`)) return
    setReturnTasks(prev => prev.filter(t => t.id !== taskId))
    Toast.show({ content: '退运任务已删除', icon: 'success' })
  }

  // 各 Tab 待办数
  const inboundCount = inboundTasks.length
  const packingCount = packingTasks.length
  const transferCount = transferTasks.length + outboundTransfers.length + draftTransfers.length
  const returnCount = returnTasks.length
  const totalCount = inboundCount + packingCount + transferCount + returnCount

  const getPriorityColor = (priority: string) => {
    return priority === 'high' ? '#ff4d4f' : '#faad14'
  }

  const getPriorityText = (priority: string) => {
    return priority === 'high' ? '紧急' : '普通'
  }

  const getTransferStatusText = (status: TransferStatus) => {
    const statusMap = {
      DRAFT: '草稿',
      PACKED: '已打包',
      SHIPPED: '已发运',
      IN_TRANSIT: '在途中',
      ARRIVED: '已到达',
      RECEIVED: '已签收'
    }
    return statusMap[status] || status || '未知'
  }

  const getTransferStatusColor = (status: TransferStatus) => {
    const colorMap = {
      DRAFT: { color: '#999', bg: '#f5f5f5' },
      PACKED: { color: '#1677ff', bg: '#e6f4ff' },
      SHIPPED: { color: '#faad14', bg: '#fffbeb' },
      IN_TRANSIT: { color: '#faad14', bg: '#fffbeb' },
      ARRIVED: { color: '#52c41a', bg: '#f0fdf4' },
      RECEIVED: { color: '#52c41a', bg: '#f0fdf4' }
    }
    return colorMap[status] || { color: '#999', bg: '#f5f5f5' }
  }

  const getReturnReasonText = (reason: ReturnReason) => {
    const reasonMap: Record<string, string> = {
      CUSTOMER_CANCEL: '客户取消',
      DAMAGED: '货物破损',
      CUSTOMS_REJECT: '报关退回',
      DELIVERY_FAILED: '配送失败',
      CUSTOMER_REJECT: '客户拒收',
      QUALITY_ISSUE: '质量问题',
      ADDRESS_ERROR: '地址错误',
      GOODS_ISSUE: '货物问题',
      OTHER: '其他'
    }
    return reasonMap[reason] || reason || '未知'
  }

  const getReturnReasonColor = (reason: ReturnReason) => {
    const colorMap: Record<string, { color: string; bg: string }> = {
      CUSTOMER_CANCEL: { color: '#faad14', bg: '#fffbeb' },
      DAMAGED: { color: '#ff4d4f', bg: '#fff1f0' },
      CUSTOMS_REJECT: { color: '#722ed1', bg: '#f9f0ff' },
      DELIVERY_FAILED: { color: '#ff4d4f', bg: '#fff1f0' },
      CUSTOMER_REJECT: { color: '#faad14', bg: '#fffbeb' },
      QUALITY_ISSUE: { color: '#ff4d4f', bg: '#fff1f0' },
      ADDRESS_ERROR: { color: '#faad14', bg: '#fffbeb' },
      GOODS_ISSUE: { color: '#ff4d4f', bg: '#fff1f0' },
      OTHER: { color: '#999', bg: '#f5f5f5' }
    }
    return colorMap[reason] || { color: '#999', bg: '#f5f5f5' }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      {/* 顶部固定区域：标题 + Tabs */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '24px 16px',
          color: 'white',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}><UnorderedListOutline style={{ fontSize: '24px' }} /> 任务中心</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
            待办任务 {totalCount} 项
          </p>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{
            '--title-font-size': '15px',
            background: '#fff'
          }}
        >
        <Tabs.Tab
          title={
            <Badge content={inboundCount > 0 ? inboundCount : null} style={{ '--right': '-10px', '--top': '-3px' }}>
              入库
            </Badge>
          }
          key="inbound"
        />
        <Tabs.Tab
          title={
            <Badge content={packingCount > 0 ? packingCount : null} style={{ '--right': '-10px', '--top': '-3px' }}>
              装箱
            </Badge>
          }
          key="packing"
        />
        <Tabs.Tab
          title={
            <Badge content={transferCount > 0 ? transferCount : null} style={{ '--right': '-10px', '--top': '-3px' }}>
              调拨
            </Badge>
          }
          key="transfer"
        />
        <Tabs.Tab title="库存" key="stock" />
        <Tabs.Tab
          title={
            <Badge content={returnCount > 0 ? returnCount : null} style={{ '--right': '-10px', '--top': '-3px' }}>
              退运
            </Badge>
          }
          key="return"
        />
        </Tabs>
      </div>

      <div style={{ padding: '0 16px', marginTop: '16px' }}>
        {/* 入库待办列表 */}
        {activeTab === 'inbound' && (
          <>
            {inboundTasks.length > 0 ? (
              inboundTasks.map((task: any) => (
                <Card
                  key={task.id}
                  onClick={() => navigate(`/inbound/order/${task.id}`)}
                  style={{
                    marginBottom: '12px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ padding: '4px 0' }}>
                    {/* 标签行 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: '#fff7e6',
                        color: '#fa8c16',
                        fontWeight: 'bold'
                      }}>
                        待收货
                      </span>
                      {task.destCountry && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          background: '#f0f5ff',
                          color: '#1677ff'
                        }}>
                          {task.destCountry}{task.destCity ? `-${task.destCity}` : ''}
                        </span>
                      )}
                    </div>

                    {/* 订单号 */}
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '6px' }}>
                      {task.orderNo}
                    </div>

                    {/* 客户和收件人 */}
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      客户：{task.customerName}
                    </div>
                    {task.consignee && (
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                        收件人：{task.consignee}
                      </div>
                    )}

                    {/* 货物信息 + 下单时间 */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid #f0f0f0'
                    }}>
                      <span style={{ fontSize: '13px', color: '#666' }}>
                        {task.totalPieces > 0 ? `${task.totalPieces}件` : '-'}
                        {task.totalWeight > 0 ? ` / ${task.totalWeight}kg` : ''}
                      </span>
                      <span style={{ fontSize: '12px', color: '#999' }}>
                        {task.expectedTime}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                <div style={{ fontSize: '16px' }}>暂无待入库订单</div>
              </div>
            )}
          </>
        )}

        {/* 装箱待办列表 */}
        {activeTab === 'packing' && (
          <>
            {packingTasks.length > 0 ? (
              packingTasks.map((unit) => {
                const weightRate = unit.maxWeight > 0 ? Math.round((unit.currentWeight / unit.maxWeight) * 100) : 0
                const volumeRate = unit.maxVolume > 0 ? Math.round((unit.currentVolume / unit.maxVolume) * 100) : 0
                const isOverloaded = weightRate > 100 || volumeRate > 100
                const isSea = unit.transportMode === 'SEA'
                const statusText = unit.status === 'EMPTY' ? '空箱' : '装货中'
                const statusColor = unit.status === 'EMPTY' ? { color: '#999', bg: '#f5f5f5' } : { color: '#1677ff', bg: '#e6f4ff' }
                // 显示合适的重量单位
                const weightUnit = isSea ? 'kg' : 'kg'
                const volumeUnit = 'm³'

                return (
                  <Card
                    key={unit.id}
                    onClick={() => navigate(`/packing/task/${unit.id}`)}
                    style={{
                      marginBottom: '12px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      background: '#fff',
                      border: isOverloaded ? '2px solid #ff4d4f' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ padding: '4px 0' }}>
                      {/* 标签行 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '11px',
                            color: isSea ? '#1677ff' : '#52c41a',
                            background: isSea ? '#e6f4ff' : '#f0fdf4',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            {isSea ? '海运' : '空运'}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            color: '#666',
                            background: '#f5f5f5',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            {unit.unitType}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            color: statusColor.color,
                            background: statusColor.bg,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            {statusText}
                          </span>
                          {isOverloaded && (
                            <span style={{ fontSize: '11px', color: '#fff', background: '#ff4d4f', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                              超载
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <EditSOutline
                            fontSize={18}
                            color="#1677ff"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/container/edit/${unit.id}`)
                            }}
                          />
                          <DeleteOutline
                            fontSize={18}
                            color="#ff4d4f"
                            onClick={(e) => handleDeleteContainer(unit.id, unit.unitNo, e)}
                          />
                        </div>
                      </div>

                      {/* 单元号 */}
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                        {unit.unitNo}
                      </div>

                      {/* 基本信息 */}
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                        {unit.jobNo ? `任务：${unit.jobNo}` : '未绑定任务'}
                        {unit.warehouse ? ` · ${unit.warehouse}` : ''}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                        已装 {unit.loadedOrders} 单 / {unit.loadedPieces} 件
                      </div>

                      {/* 装载进度条 */}
                      <div style={{ background: '#f5f5f5', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: '#666' }}>重量：{unit.currentWeight}{weightUnit} / {unit.maxWeight}{weightUnit}</span>
                          <span style={{ fontWeight: 'bold', color: weightRate > 100 ? '#ff4d4f' : weightRate > 80 ? '#faad14' : '#52c41a' }}>
                            {weightRate}%
                          </span>
                        </div>
                        <div style={{
                          width: '100%', height: '4px', background: '#e0e0e0', borderRadius: '2px', overflow: 'hidden', marginBottom: '8px'
                        }}>
                          <div style={{
                            width: `${Math.min(weightRate, 100)}%`, height: '100%', borderRadius: '2px',
                            background: weightRate > 100 ? '#ff4d4f' : weightRate > 80 ? '#faad14' : '#52c41a'
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#666' }}>体积：{unit.currentVolume}{volumeUnit} / {unit.maxVolume}{volumeUnit}</span>
                          <span style={{ fontWeight: 'bold', color: volumeRate > 100 ? '#ff4d4f' : volumeRate > 80 ? '#faad14' : '#52c41a' }}>
                            {volumeRate}%
                          </span>
                        </div>
                        <div style={{
                          width: '100%', height: '4px', background: '#e0e0e0', borderRadius: '2px', overflow: 'hidden', marginTop: '4px'
                        }}>
                          <div style={{
                            width: `${Math.min(volumeRate, 100)}%`, height: '100%', borderRadius: '2px',
                            background: volumeRate > 100 ? '#ff4d4f' : volumeRate > 80 ? '#faad14' : '#52c41a'
                          }} />
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                <div style={{ fontSize: '16px' }}>暂无待装箱集装单元</div>
              </div>
            )}
          </>
        )}

        {/* 调拨待办列表 */}
        {activeTab === 'transfer' && (
          <>
            {/* 状态筛选按钮组 */}
            <div style={{
              padding: '0 16px 12px 16px',
              display: 'flex',
              gap: '8px'
            }}>
              <div
                onClick={() => setTransferSubTab('inbound')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  background: transferSubTab === 'inbound' ? '#1677ff' : '#f5f5f5',
                  color: transferSubTab === 'inbound' ? '#fff' : '#666',
                  fontWeight: transferSubTab === 'inbound' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                待入库
              </div>
              <div
                onClick={() => setTransferSubTab('outbound')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  background: transferSubTab === 'outbound' ? '#1677ff' : '#f5f5f5',
                  color: transferSubTab === 'outbound' ? '#fff' : '#666',
                  fontWeight: transferSubTab === 'outbound' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                待签收
              </div>
              <div
                onClick={() => setTransferSubTab('draft')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  background: transferSubTab === 'draft' ? '#1677ff' : '#f5f5f5',
                  color: transferSubTab === 'draft' ? '#fff' : '#666',
                  fontWeight: transferSubTab === 'draft' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                草稿
              </div>
            </div>

            {/* 待入库列表 */}
            {transferSubTab === 'inbound' && (
              <>
                {transferTasks.length > 0 ? (
                  transferTasks.map((transfer) => {
                const statusColor = getTransferStatusColor(transfer.status)
                return (
                  <Card
                    key={transfer.id}
                    onClick={() => navigate(`/transfer/detail/${transfer.id}`)}
                    style={{
                      marginBottom: '12px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      background: '#fff'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{
                          fontSize: '11px',
                          color: '#1677ff',
                          background: '#e6f4ff',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 'bold'
                        }}>
                          {transfer.itemType === 'ORDER' ? '订单调拨' : '集装箱调拨'}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: statusColor.color,
                          background: statusColor.bg,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 'bold'
                        }}>
                          {getTransferStatusText(transfer.status)}
                        </div>
                      </div>

                      {/* 主要信息 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '32px' }}>
                          {transfer.itemType === 'ORDER' ? <ContentOutline style={{ fontSize: '32px', color: '#1677ff' }} /> : <TruckOutline style={{ fontSize: '32px', color: '#fa8c16' }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                            {transfer.transferNo}
                          </div>
                          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                            {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                          </div>
                          {transfer.itemType === 'CONTAINER' && (
                            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                              集装箱：{transfer.containerNo} ({transfer.containerType})
                            </div>
                          )}
                          <div style={{ fontSize: '12px', color: '#999' }}>
                            订单数：{transfer.orderCount} · {transfer.totalPieces}件 · {transfer.totalWeight}kg
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                <div style={{ fontSize: '16px' }}>暂无调拨任务</div>
              </div>
            )}
          </>
            )}

            {/* 待签收列表 */}
            {transferSubTab === 'outbound' && (
              <>
                {outboundTransfers.length > 0 ? (
                  outboundTransfers.map((transfer) => {
                    const statusColor = getTransferStatusColor(transfer.status)
                    return (
                      <Card
                        key={transfer.id}
                        onClick={() => navigate(`/transfer/detail/${transfer.id}`)}
                        style={{
                          marginBottom: '12px',
                          borderRadius: '12px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                          background: '#fff'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{
                              fontSize: '11px',
                              color: '#1677ff',
                              background: '#e6f4ff',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              {transfer.itemType === 'ORDER' ? '订单调拨' : '集装箱调拨'}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: statusColor.color,
                              background: statusColor.bg,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              {getTransferStatusText(transfer.status)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ fontSize: '32px' }}><UpCircleOutline style={{ fontSize: '32px', color: '#faad14' }} /></div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                                {transfer.transferNo}
                              </div>
                              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                                {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#999' }}>
                                订单数：{transfer.orderCount} · {transfer.totalPieces}件 · {transfer.totalWeight}kg
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                    <div style={{ fontSize: '16px' }}>暂无待签收调拨</div>
                  </div>
                )}
              </>
            )}

            {/* 草稿列表 */}
            {transferSubTab === 'draft' && (
              <>
                {draftTransfers.length > 0 ? (
                  draftTransfers.map((transfer) => (
                    <Card
                      key={transfer.id}
                      onClick={() => navigate(`/transfer/detail/${transfer.id}`)}
                      style={{
                        marginBottom: '12px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                        background: '#fff',
                        border: '1px dashed #d9d9d9'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <div style={{
                            fontSize: '11px',
                            color: '#1677ff',
                            background: '#e6f4ff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            {transfer.itemType === 'ORDER' ? '订单调拨' : '集装箱调拨'}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#999',
                            background: '#f5f5f5',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            草稿
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ fontSize: '32px' }}><EditSOutline style={{ fontSize: '32px', color: '#999' }} /></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                              {transfer.transferNo}
                            </div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                              {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              订单数：{transfer.orderCount} · {transfer.totalPieces}件 · {transfer.totalWeight}kg
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                    <div style={{ fontSize: '16px' }}>暂无草稿</div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 库存列表 */}
        {activeTab === 'stock' && <StockList />}

        {/* 退运待办列表 */}
        {activeTab === 'return' && (
          <>
            {returnTasks.length > 0 ? (
              returnTasks.map((task) => {
                const reasonColor = getReturnReasonColor(task.returnReason)
                return (
                  <Card
                    key={task.id}
                    onClick={() => navigate(`/return/detail/${task.id}`)}
                    style={{
                      marginBottom: '12px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ padding: '4px 0' }}>
                      {/* 退运原因和优先级标签 */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: reasonColor.color,
                            background: reasonColor.bg
                          }}>
                            {getReturnReasonText(task.returnReason)}
                          </span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            background: getPriorityColor(task.priority),
                            color: '#fff'
                          }}>
                            {getPriorityText(task.priority)}
                          </span>
                        </div>
                        <DeleteOutline
                          fontSize={18}
                          color="#ff4d4f"
                          onClick={(e) => handleDeleteReturn(task.id, task.orderNo, e)}
                        />
                      </div>

                      {/* 订单信息 */}
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                        {task.orderNo}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                        客户：{task.customerName}
                      </div>

                      {/* 退运原因详情 */}
                      <div style={{
                        marginBottom: '8px',
                        padding: '8px',
                        background: '#fffbeb',
                        borderRadius: '6px'
                      }}>
                        <div style={{ fontSize: '12px', color: '#faad14', marginBottom: '4px', fontWeight: 'bold' }}>
                          退运原因
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          {task.reasonDetail}
                        </div>
                      </div>

                      {/* 货物信息 */}
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                        件数：{task.pieces} 件 · 重量：{task.weight} kg
                        {task.volume && ` · 体积：${task.volume} m³`}
                      </div>

                      {/* 当前位置 */}
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                        当前位置：{task.currentLocation}
                      </div>

                      {/* 申请信息 */}
                      <div style={{
                        fontSize: '12px',
                        color: '#999',
                        paddingTop: '8px',
                        borderTop: '1px solid #f0f0f0'
                      }}>
                        申请人：{task.applicant} · {task.applyTime}
                      </div>
                    </div>
                  </Card>
                )
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                <div style={{ fontSize: '16px' }}>暂无退运任务</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 全局悬浮扫码按钮 */}
      <FloatingScanButton />
    </div>
  )
}

export default TaskHub
