import { useState } from 'react'
import { Card, NavBar, Button, Tag, Space, Toast, Input } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import {
  ScanningOutline,
  ContentOutline,
  InformationCircleOutline,
  AppstoreOutline,
  FileOutline,
  ExclamationCircleOutline,
  GlobalOutline,
  TruckOutline,
  CheckCircleOutline,
  UpCircleOutline,
  EditSOutline,
  SendOutline
} from 'antd-mobile-icons'
import { orderApi, warehouseApi } from '../../api'

// 订单状态
type OrderStatus =
  | 'PENDING_INBOUND'   // 待入库
  | 'IN_STOCK'          // 已入库
  | 'PACKED'            // 已装箱
  | 'SHIPPED'           // 已发运
  | 'IN_TRANSIT'        // 运输中
  | 'ARRIVED'           // 已到港
  | 'WAREHOUSED'        // 已入仓（目的国）
  | 'IN_DELIVERY'       // 配送中
  | 'DELIVERED'         // 已送达
  | 'COMPLETED'         // 已完成
  | 'CANCELLED'         // 已取消
  | 'EXCEPTION'         // 异常
  | 'RETURN_APPLIED'    // 已申请退运

// 订单信息
interface OrderInfo {
  subOrderId?: string
  masterOrderId?: string
  shippingUnitId?: string
  trackingNo?: string
  backendStatus?: string
  orderNo: string
  customerName: string
  customerPhone: string
  status: OrderStatus
  destination: string
  pieces: number
  weight: number
  volume?: number
  createTime: string
  // 入库信息
  inboundTime?: string
  inboundOperator?: string
  storageLocation?: string
  // 装箱信息
  containerNo?: string
  packingTime?: string
  // 发运信息
  shippingTime?: string
  carrier?: string
  transportMode?: string
  estimatedArrival?: string
  // 到港信息
  arrivalTime?: string
  portName?: string
  customsStatus?: string
  // 配送信息
  deliveryNo?: string
  deliveryOperator?: string
  deliveryAddress?: string
  // 签收信息
  signTime?: string
  signPerson?: string
  // 其他
  remark?: string
  daysInStock?: number
}

const ScanOrder = () => {
  const navigate = useNavigate()
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const toastInfo = (content: string, icon: 'success' | 'fail' = 'success') => {
    Toast.show({ content, icon })
  }

  const formatTime = (v?: string) => {
    if (!v) return '-'
    return String(v).replace('T', ' ').slice(0, 16)
  }

  const calcDaysInStock = (inboundTime?: string) => {
    if (!inboundTime) return undefined
    const at = new Date(inboundTime).getTime()
    if (Number.isNaN(at)) return undefined
    const diff = Date.now() - at
    return Math.max(0, Math.floor(diff / (24 * 3600 * 1000)))
  }

  const mapBackendStatusToUi = (status?: string): OrderStatus => {
    const s = status || ''
    if (s === 'PENDING_INBOUND') return 'PENDING_INBOUND'
    if (s === 'INBOUND' || s === 'PENDING_PACKING') return 'IN_STOCK'
    if (s === 'PACKED') return 'PACKED'
    if (s === 'PENDING_DEPARTURE' || s === 'DEPARTED') return 'SHIPPED'
    if (s === 'IN_TRANSIT') return 'IN_TRANSIT'
    if (s === 'ARRIVED' || s === 'CUSTOMS_CLEARANCE') return 'ARRIVED'
    if (s === 'PENDING_DELIVERY') return 'WAREHOUSED'
    if (s === 'DELIVERING') return 'IN_DELIVERY'
    if (s === 'DELIVERED') return 'DELIVERED'
    if (s === 'RETURN_APPLIED') return 'RETURN_APPLIED'
    if (s === 'EXCEPTION') return 'EXCEPTION'
    if (s === 'CANCELLED') return 'CANCELLED'
    return 'PENDING_INBOUND'
  }

  const buildOrderInfoFromSub = async (sub: any): Promise<OrderInfo> => {
    const [masterRes, stockRes] = await Promise.all([
      sub?.masterOrderId ? orderApi.getMaster(sub.masterOrderId) : Promise.resolve(null),
      warehouseApi.listStock({ keyword: sub?.subOrderNo || '' }),
    ])
    const master = (masterRes as any)?.data || masterRes || {}
    const stocks = (stockRes as any)?.data || []
    const stock = (stocks as any[]).find((item) => item.subOrderNo === sub.subOrderNo)
    const daysInStock = calcDaysInStock(stock?.inboundTime)

    return {
      subOrderId: sub.id,
      masterOrderId: sub.masterOrderId,
      shippingUnitId: sub.shippingUnitId || stock?.shippingUnitId || undefined,
      trackingNo: sub.expressTrackingNo || '',
      backendStatus: sub.status,
      orderNo: sub.subOrderNo || sub.id,
      customerName: master?.customerName || sub.consignee || '-',
      customerPhone: master?.senderPhone || sub.consigneePhone || '-',
      status: mapBackendStatusToUi(sub.status),
      destination: `${sub.destCountry || ''}${sub.destCity ? `-${sub.destCity}` : ''}` || '-',
      pieces: Number(sub.pieces || 0),
      weight: Number(sub.weight || 0),
      volume: Number(sub.volume || 0),
      createTime: formatTime(sub.createdAt),
      inboundTime: formatTime(stock?.inboundTime),
      inboundOperator: '-',
      storageLocation: stock?.warehouseLocation || '-',
      containerNo: sub.shippingUnitId || stock?.shippingUnitId || '-',
      packingTime: sub.status === 'PACKED' ? formatTime(sub.updatedAt) : '-',
      shippingTime: formatTime(sub.atd),
      carrier: '-',
      transportMode: sub.transportType || master?.transportType || 'SEA',
      estimatedArrival: formatTime(sub.eta),
      arrivalTime: formatTime(sub.ata),
      portName: '-',
      customsStatus: sub.status === 'CUSTOMS_CLEARANCE' ? '清关中' : (sub.status === 'ARRIVED' ? '已到港' : '-'),
      deliveryAddress: sub.destAddress || '-',
      signTime: sub.status === 'DELIVERED' ? formatTime(sub.updatedAt) : '-',
      signPerson: sub.consignee || '-',
      remark: sub.remark || undefined,
      daysInStock,
    }
  }

  const reloadBySubId = async (subOrderId?: string) => {
    if (!subOrderId) return
    const subRes: any = await orderApi.getSub(subOrderId)
    const sub = subRes?.data || subRes
    if (!sub?.id) return
    const next = await buildOrderInfoFromSub(sub)
    setOrderInfo(next)
    setSearchKeyword(next.orderNo)
  }

  // 通过 API 搜索订单
  const handleSearch = async (keyword: string) => {
    const trimmed = keyword.trim()
    if (!trimmed) {
      toastInfo('请输入订单号', 'fail')
      return
    }
    setSearching(true)
    try {
      const res: any = await orderApi.search(trimmed)
      const data = res?.data || res || {}
      let sub = Array.isArray(data.subOrders) && data.subOrders.length > 0
        ? data.subOrders.find((s: any) => s.subOrderNo === trimmed || s.expressTrackingNo === trimmed) || data.subOrders[0]
        : null

      if (!sub && Array.isArray(data.masterOrders) && data.masterOrders.length > 0) {
        const master = data.masterOrders[0]
        const subRes: any = await orderApi.listSub({ masterOrderId: master.id, pageSize: 50 })
        const subList = subRes?.data || []
        sub = Array.isArray(subList) && subList.length > 0 ? subList[0] : null
      }

      if (!sub) {
        toastInfo('未找到该订单', 'fail')
        return
      }

      const normalized = await buildOrderInfoFromSub(sub)
      setOrderInfo(normalized)
    } catch (err) {
      toastInfo('查询订单失败', 'fail')
    } finally {
      setSearching(false)
    }
  }

  const handleReportException = async () => {
    if (!orderInfo?.subOrderId) return toastInfo('订单标识缺失，无法上报异常', 'fail')
    setActionLoading(true)
    try {
      await orderApi.updateSub(orderInfo.subOrderId, {
        status: 'EXCEPTION',
        currentNode: '货物异常待处理',
      })
      await reloadBySubId(orderInfo.subOrderId)
      toastInfo('异常已上报')
    } catch (err: any) {
      toastInfo(err.message || '上报异常失败', 'fail')
    } finally {
      setActionLoading(false)
    }
  }

  const handlePackToUnit = async () => {
    if (!orderInfo?.subOrderId) return toastInfo('订单标识缺失，无法装箱', 'fail')
    setActionLoading(true)
    try {
      if (orderInfo.shippingUnitId) {
        toastInfo('该订单已在运输单元中')
        return
      }
      const unitRes: any = await warehouseApi.listUnits({ transportMode: orderInfo.transportMode || 'SEA' })
      const units = unitRes?.data || []
      const available = (units as any[]).find((u) => ['EMPTY', 'LOADING'].includes(u.status))
      if (!available?.id) {
        toastInfo('暂无可用运输单元，请先创建集装箱/舱位', 'fail')
        return
      }
      await warehouseApi.loadUnit(available.id, [orderInfo.subOrderId])
      await reloadBySubId(orderInfo.subOrderId)
      toastInfo(`装箱成功：${available.unitNo || available.id}`)
    } catch (err: any) {
      toastInfo(err.message || '装箱失败', 'fail')
    } finally {
      setActionLoading(false)
    }
  }

  const handleApplyReturn = async () => {
    if (!orderInfo?.subOrderId) return toastInfo('订单标识缺失，无法申请退运', 'fail')
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setActionLoading(true)
    try {
      await warehouseApi.createReturn({
        orderNo: orderInfo.orderNo,
        trackingNo: orderInfo.trackingNo || null,
        customerName: orderInfo.customerName || '-',
        returnType: 'CUSTOMER',
        returnStage: 'ORIGIN',
        reason: '扫码页面申请退运',
        pieces: Number(orderInfo.pieces || 0),
        weight: Number(orderInfo.weight || 0),
        volume: Number(orderInfo.volume || 0),
        applicant: user.name || user.realName || 'warehouse',
        remark: '由起运国扫码页发起',
      })
      await orderApi.updateSub(orderInfo.subOrderId, {
        status: 'RETURN_APPLIED',
        currentNode: '已申请退运',
      })
      await reloadBySubId(orderInfo.subOrderId)
      toastInfo('退运申请已提交')
    } catch (err: any) {
      toastInfo(err.message || '申请退运失败', 'fail')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmOutbound = async () => {
    if (!orderInfo?.subOrderId) return toastInfo('订单标识缺失，无法确认出库', 'fail')
    setActionLoading(true)
    try {
      await orderApi.updateSub(orderInfo.subOrderId, {
        status: 'PENDING_DEPARTURE',
        currentNode: '等待发货',
      })
      await reloadBySubId(orderInfo.subOrderId)
      toastInfo('已确认出库，等待发运')
    } catch (err: any) {
      toastInfo(err.message || '确认出库失败', 'fail')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveFromContainer = async () => {
    if (!orderInfo?.subOrderId) return toastInfo('订单标识缺失，无法移出集装箱', 'fail')
    setActionLoading(true)
    try {
      await orderApi.updateSub(orderInfo.subOrderId, {
        shippingUnitId: null,
        status: 'INBOUND',
        currentNode: '已移出集装箱',
      })
      await reloadBySubId(orderInfo.subOrderId)
      toastInfo('已移出集装箱')
    } catch (err: any) {
      toastInfo(err.message || '移出失败', 'fail')
    } finally {
      setActionLoading(false)
    }
  }

  // 获取状态文本
  const getStatusText = (status: OrderStatus) => {
    const statusMap = {
      PENDING_INBOUND: '待入库',
      IN_STOCK: '已入库',
      PACKED: '已装箱',
      SHIPPED: '已发运',
      IN_TRANSIT: '运输中',
      ARRIVED: '已到港',
      WAREHOUSED: '已入仓',
      IN_DELIVERY: '配送中',
      DELIVERED: '已送达',
      COMPLETED: '已完成',
      CANCELLED: '已取消',
      EXCEPTION: '异常',
      RETURN_APPLIED: '退运申请中'
    }
    return statusMap[status]
  }

  // 获取状态颜色
  const getStatusColor = (status: OrderStatus) => {
    const colorMap = {
      PENDING_INBOUND: 'warning',
      IN_STOCK: 'primary',
      PACKED: 'success',
      SHIPPED: 'default',
      IN_TRANSIT: 'default',
      ARRIVED: 'warning',
      WAREHOUSED: 'primary',
      IN_DELIVERY: 'success',
      DELIVERED: 'success',
      COMPLETED: 'default',
      CANCELLED: 'danger',
      EXCEPTION: 'danger',
      RETURN_APPLIED: 'warning'
    }
    return colorMap[status] as any
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '20px' }}>
      <NavBar onBack={() => navigate(-1)}>扫码查询</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 扫码按钮 */}
        <Card style={{ marginBottom: '16px', borderRadius: '12px' }}>
          <Button
            block
            color="primary"
            size="large"
            onClick={() => { toastInfo('扫码功能开发中，请先手动输入', 'fail') }}
            style={{ '--border-radius': '8px', marginBottom: '12px' }}
          >
            <ScanningOutline style={{ marginRight: '8px', fontSize: '20px' }} />
            扫描订单条码
          </Button>

          {/* 手动输入搜索 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input
              placeholder="输入订单号查询"
              value={searchKeyword}
              onChange={setSearchKeyword}
              onEnterPress={() => handleSearch(searchKeyword)}
              clearable
              style={{ flex: 1, '--font-size': '14px' }}
            />
            <Button
              color="primary"
              fill="outline"
              loading={searching}
              onClick={() => handleSearch(searchKeyword)}
              style={{ '--border-radius': '6px', flexShrink: 0 }}
            >
              查询
            </Button>
          </div>
        </Card>

        {/* 订单信息展示区域 */}
        {orderInfo && (
          <>
            {/* 基本信息卡片 */}
            <Card
              title={<><ContentOutline style={{ fontSize: '16px' }} /> 订单信息</>}
              style={{ marginBottom: '16px', borderRadius: '12px' }}
            >
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                    {orderInfo.orderNo}
                  </span>
                  <Tag color={getStatusColor(orderInfo.status)}>
                    {getStatusText(orderInfo.status)}
                  </Tag>
                </div>
                <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                  <div>客户：{orderInfo.customerName}</div>
                  <div>电话：{orderInfo.customerPhone}</div>
                  <div>目的地：{orderInfo.destination}</div>
                  <div>
                    货物：{orderInfo.pieces} 件 · {orderInfo.weight} kg
                    {orderInfo.volume && ` · ${orderInfo.volume} m³`}
                  </div>
                  <div>创建时间：{orderInfo.createTime}</div>
                </div>
              </div>

              {orderInfo.remark && (
                <div style={{
                  padding: '8px',
                  background: '#fffbeb',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#faad14'
                }}>
                  <InformationCircleOutline style={{ fontSize: '14px' }} /> {orderInfo.remark}
                </div>
              )}
            </Card>

            {/* 待入库状态 */}
            {orderInfo.status === 'PENDING_INBOUND' && (
              <Card
                title={<><AppstoreOutline style={{ fontSize: '16px' }} /> 快速操作</>}
                style={{ marginBottom: '16px', borderRadius: '12px' }}
              >
                <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
                  <Button
                    block
                    color="primary"
                    size="large"
                    loading={actionLoading}
                    onClick={() => {
                      if (!orderInfo.subOrderId) {
                        toastInfo('订单标识缺失，无法进入入库流程', 'fail')
                        return
                      }
                      navigate(`/inbound/form?subId=${orderInfo.subOrderId}`)
                    }}
                    style={{ '--border-radius': '8px', fontWeight: 'bold' }}
                  >
                    <ContentOutline style={{ fontSize: '16px' }} /> 办理入库
                  </Button>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <Button
                      color="warning"
                      fill="outline"
                      loading={actionLoading}
                      onClick={handleReportException}
                    >
                      <ExclamationCircleOutline style={{ fontSize: '14px' }} /> 货物异常
                    </Button>
                    <Button
                      fill="outline"
                      onClick={() => { toastInfo('当前即为订单详情页') }}
                    >
                      <FileOutline style={{ fontSize: '14px' }} /> 订单详情
                    </Button>
                  </div>
                </Space>
              </Card>
            )}

            {/* 已入库状态 */}
            {orderInfo.status === 'IN_STOCK' && (
              <>
                <Card
                  title={<><FileOutline style={{ fontSize: '16px' }} /> 库存信息</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>入库时间：{orderInfo.inboundTime}</div>
                    <div>入库人：{orderInfo.inboundOperator}</div>
                    <div>存放位置：{orderInfo.storageLocation}</div>
                    <div style={{ color: orderInfo.daysInStock! > 7 ? '#ff4d4f' : '#666' }}>
                      库存天数：{orderInfo.daysInStock} 天
                      {orderInfo.daysInStock! > 7 && <> <ExclamationCircleOutline style={{ fontSize: '14px' }} /> 超期</>}
                    </div>
                  </div>
                </Card>
                <Card
                  title={<><AppstoreOutline style={{ fontSize: '16px' }} /> 快速操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
                    {/* 主要操作 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Button
                        color="success"
                        loading={actionLoading}
                        onClick={handlePackToUnit}
                        style={{ '--border-radius': '8px' }}
                      >
                        <ContentOutline style={{ fontSize: '14px' }} /> 装箱
                      </Button>
                      <Button
                        color="danger"
                        loading={actionLoading}
                        onClick={handleApplyReturn}
                        style={{ '--border-radius': '8px' }}
                      >
                        <SendOutline style={{ fontSize: '14px' }} /> 退运
                      </Button>
                    </div>

                    {/* 次要操作 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Button
                        fill="outline"
                        size="small"
                        onClick={() => { toastInfo('仓储费录入请在 Web 财务端处理') }}
                      >
                        仓储费
                      </Button>
                      <Button
                        fill="outline"
                        size="small"
                        onClick={() => { toastInfo('库存调整功能待接入') }}
                      >
                        <EditSOutline style={{ fontSize: '14px' }} /> 调整
                      </Button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Button
                        fill="outline"
                        size="small"
                        onClick={() => { toastInfo('补充照片功能待接入') }}
                      >
                        照片
                      </Button>
                      <Button
                        fill="outline"
                        size="small"
                        onClick={() => { toastInfo('当前即为详情页面') }}
                      >
                        <FileOutline style={{ fontSize: '14px' }} /> 详情
                      </Button>
                    </div>
                  </Space>
                </Card>
              </>
            )}

            {/* 已装箱状态 */}
            {orderInfo.status === 'PACKED' && (
              <>
                <Card
                  title={<><ContentOutline style={{ fontSize: '16px' }} /> 装箱信息</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>集装箱号：{orderInfo.containerNo}</div>
                    <div>装箱时间：{orderInfo.packingTime}</div>
                    <div>存放位置：{orderInfo.storageLocation}</div>
                  </div>
                </Card>
                <Card
                  title={<><AppstoreOutline style={{ fontSize: '16px' }} /> 快速操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
                    <Button
                      block
                      color="primary"
                      size="large"
                      loading={actionLoading}
                      onClick={handleConfirmOutbound}
                      style={{ '--border-radius': '8px', fontWeight: 'bold' }}
                    >
                      <CheckCircleOutline style={{ fontSize: '16px' }} /> 确认出库
                    </Button>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Button
                        color="warning"
                        fill="outline"
                        loading={actionLoading}
                        onClick={handleRemoveFromContainer}
                      >
                        <UpCircleOutline style={{ fontSize: '14px' }} /> 移出
                      </Button>
                      <Button
                        color="danger"
                        fill="outline"
                        loading={actionLoading}
                        onClick={handleApplyReturn}
                      >
                        <SendOutline style={{ fontSize: '14px' }} /> 退运
                      </Button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Button
                        fill="outline"
                        size="small"
                        onClick={() => { toastInfo('额外费用请在 Web 财务端录入') }}
                      >
                        费用
                      </Button>
                      <Button
                        fill="outline"
                        size="small"
                        onClick={() => {
                          if (!orderInfo.shippingUnitId) {
                            toastInfo('当前订单未绑定集装箱', 'fail')
                            return
                          }
                          navigate(`/warehouse-us/container/task/${orderInfo.shippingUnitId}`)
                        }}
                      >
                        <FileOutline style={{ fontSize: '14px' }} /> 详情
                      </Button>
                    </div>
                  </Space>
                </Card>
              </>
            )}

            {/* 已发运状态 - 简化版 */}
            {orderInfo.status === 'SHIPPED' && (
              <>
                <Card
                  title={<><GlobalOutline style={{ fontSize: '16px' }} /> 运输信息</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>发运时间：{orderInfo.shippingTime}</div>
                    <div>承运人：{orderInfo.carrier}</div>
                    <div>运输方式：{orderInfo.transportMode === 'SEA' ? '海运' : '空运'}</div>
                    <div>集装箱号：{orderInfo.containerNo}</div>
                    <div>预计到达：{orderInfo.estimatedArrival}</div>
                  </div>
                </Card>
                <Card
                  title={<><FileOutline style={{ fontSize: '16px' }} /> 查看操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <Button
                      fill="outline"
                      onClick={() => { toastInfo('物流轨迹功能待接入') }}
                    >
                      <GlobalOutline style={{ fontSize: '14px' }} /> 物流轨迹
                    </Button>
                    <Button
                      fill="outline"
                      onClick={() => { toastInfo('当前即为订单详情页') }}
                    >
                      <FileOutline style={{ fontSize: '14px' }} /> 订单详情
                    </Button>
                  </div>
                </Card>
              </>
            )}

            {/* 运输中状态 - 简化版 */}
            {orderInfo.status === 'IN_TRANSIT' && (
              <>
                <Card
                  title={<><GlobalOutline style={{ fontSize: '16px' }} /> 运输信息</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>发运时间：{orderInfo.shippingTime}</div>
                    <div>承运人：{orderInfo.carrier}</div>
                    <div>运输方式：{orderInfo.transportMode === 'SEA' ? '海运' : '空运'}</div>
                    <div>预计到达：{orderInfo.estimatedArrival}</div>
                    <div style={{ color: '#1677ff', fontWeight: 'bold' }}>
                      <GlobalOutline style={{ fontSize: '14px' }} /> 货物运输中
                    </div>
                  </div>
                </Card>
                <Card
                  title={<><FileOutline style={{ fontSize: '16px' }} /> 查看操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <Button
                      fill="outline"
                      onClick={() => { toastInfo('物流轨迹功能待接入') }}
                    >
                      <GlobalOutline style={{ fontSize: '14px' }} /> 物流轨迹
                    </Button>
                    <Button
                      fill="outline"
                      onClick={() => { toastInfo('当前即为订单详情页') }}
                    >
                      <FileOutline style={{ fontSize: '14px' }} /> 订单详情
                    </Button>
                  </div>
                </Card>
              </>
            )}

            {/* 已到港状态 - 简化版 */}
            {orderInfo.status === 'ARRIVED' && (
              <>
                <Card
                  title={<><GlobalOutline style={{ fontSize: '16px' }} /> 到港信息</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>到港时间：{orderInfo.arrivalTime}</div>
                    <div>港口名称：{orderInfo.portName}</div>
                    <div>清关状态：{orderInfo.customsStatus}</div>
                    <div style={{ color: '#faad14', fontWeight: 'bold' }}>
                      等待清关放行
                    </div>
                  </div>
                </Card>
                <Card
                  title={<><FileOutline style={{ fontSize: '16px' }} /> 查看操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <Button
                    block
                    fill="outline"
                    onClick={() => { toastInfo('当前即为订单详情页') }}
                  >
                    <FileOutline style={{ fontSize: '14px' }} /> 查看订单详情
                  </Button>
                </Card>
              </>
            )}

            {/* 已入仓状态（目的国） - 简化版 */}
            {orderInfo.status === 'WAREHOUSED' && (
              <>
                <Card
                  title={<><ContentOutline style={{ fontSize: '16px' }} /> 仓储信息</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>存放位置：{orderInfo.storageLocation}</div>
                    <div>配送地址：{orderInfo.deliveryAddress}</div>
                    <div style={{ color: orderInfo.daysInStock! > 5 ? '#ff4d4f' : '#666' }}>
                      在仓天数：{orderInfo.daysInStock} 天
                      {orderInfo.daysInStock! > 5 && <> <ExclamationCircleOutline style={{ fontSize: '14px' }} /> 超期</>}
                    </div>
                  </div>
                </Card>
                <Card
                  title={<><FileOutline style={{ fontSize: '16px' }} /> 查看操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <Button
                    block
                    fill="outline"
                    onClick={() => { toastInfo('当前即为订单详情页') }}
                  >
                    <FileOutline style={{ fontSize: '14px' }} /> 查看订单详情
                  </Button>
                </Card>
              </>
            )}

            {/* 配送中状态 - 简化版 */}
            {orderInfo.status === 'IN_DELIVERY' && (
              <>
                <Card
                  title={<><TruckOutline style={{ fontSize: '16px' }} /> 配送信息</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>配送单号：{orderInfo.deliveryNo}</div>
                    <div>配送员：{orderInfo.deliveryOperator}</div>
                    <div>配送地址：{orderInfo.deliveryAddress}</div>
                    <div>预计送达：{orderInfo.estimatedArrival}</div>
                    <div style={{ color: '#52c41a', fontWeight: 'bold' }}>
                      <TruckOutline style={{ fontSize: '14px' }} /> 配送中
                    </div>
                  </div>
                </Card>
                <Card
                  title={<><FileOutline style={{ fontSize: '16px' }} /> 查看操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <Button
                    block
                    fill="outline"
                    onClick={() => { toastInfo('配送轨迹功能待接入') }}
                  >
                    <GlobalOutline style={{ fontSize: '14px' }} /> 查看配送轨迹
                  </Button>
                </Card>
              </>
            )}

            {/* 已送达状态 - 简化版 */}
            {orderInfo.status === 'DELIVERED' && (
              <>
                <Card
                  title={<><CheckCircleOutline style={{ fontSize: '16px' }} /> 签收信息</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>配送单号：{orderInfo.deliveryNo}</div>
                    <div>签收人：{orderInfo.signPerson}</div>
                    <div>签收时间：{orderInfo.signTime}</div>
                    <div>配送地址：{orderInfo.deliveryAddress}</div>
                    <div style={{ color: '#52c41a', fontWeight: 'bold' }}>
                      <CheckCircleOutline style={{ fontSize: '14px' }} /> 已签收
                    </div>
                  </div>
                </Card>
                <Card
                  title={<><FileOutline style={{ fontSize: '16px' }} /> 查看操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <Button
                    block
                    fill="outline"
                    onClick={() => { toastInfo('当前即为订单详情页') }}
                  >
                    <FileOutline style={{ fontSize: '14px' }} /> 查看订单详情
                  </Button>
                </Card>
              </>
            )}

            {/* 已完成状态 - 简化版 */}
            {orderInfo.status === 'COMPLETED' && (
              <>
                <Card
                  title={<><CheckCircleOutline style={{ fontSize: '16px' }} /> 订单已完成</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>签收时间：{orderInfo.signTime}</div>
                    <div style={{ color: '#52c41a', fontWeight: 'bold', marginTop: '8px' }}>
                      <CheckCircleOutline style={{ fontSize: '14px' }} /> 订单已完成结算
                    </div>
                  </div>
                </Card>
                <Card
                  title={<><FileOutline style={{ fontSize: '16px' }} /> 查看操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <Button
                    block
                    fill="outline"
                    onClick={() => { toastInfo('当前即为订单详情页') }}
                  >
                    <FileOutline style={{ fontSize: '14px' }} /> 查看订单详情
                  </Button>
                </Card>
              </>
            )}

            {/* 异常状态 */}
            {orderInfo.status === 'EXCEPTION' && (
              <>
                <Card
                  title={<><ExclamationCircleOutline style={{ fontSize: '16px' }} /> 订单异常</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>订单号：{orderInfo.orderNo}</div>
                    <div>当前状态：异常待处理</div>
                    <div>备注：{orderInfo.remark || '-'}</div>
                  </div>
                </Card>
                <Card
                  title={<><AppstoreOutline style={{ fontSize: '16px' }} /> 快速操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <Space direction="vertical" style={{ width: '100%', '--gap': '10px' }}>
                    <Button
                      block
                      color="danger"
                      fill="outline"
                      loading={actionLoading}
                      onClick={handleApplyReturn}
                    >
                      <SendOutline style={{ fontSize: '14px' }} /> 申请退运
                    </Button>
                    <Button
                      block
                      fill="outline"
                      onClick={() => { toastInfo('异常处理记录请在 Web 端查看') }}
                    >
                      <FileOutline style={{ fontSize: '14px' }} /> 查看处理记录
                    </Button>
                  </Space>
                </Card>
              </>
            )}

            {/* 退运申请中状态 */}
            {orderInfo.status === 'RETURN_APPLIED' && (
              <>
                <Card
                  title={<><SendOutline style={{ fontSize: '16px' }} /> 退运申请中</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>订单号：{orderInfo.orderNo}</div>
                    <div>已提交退运申请，等待审核</div>
                    <div>申请备注：{orderInfo.remark || '-'}</div>
                  </div>
                </Card>
                <Card
                  title={<><FileOutline style={{ fontSize: '16px' }} /> 查看操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <Button
                    block
                    fill="outline"
                    onClick={() => { toastInfo('退运审批进度请在 Web 端查看') }}
                  >
                    <FileOutline style={{ fontSize: '14px' }} /> 查看审批进度
                  </Button>
                </Card>
              </>
            )}

            {/* 已取消状态 - 简化版 */}
            {orderInfo.status === 'CANCELLED' && (
              <>
                <Card
                  title={<><ExclamationCircleOutline style={{ fontSize: '16px' }} /> 订单已取消</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
                    <div>创建时间：{orderInfo.createTime}</div>
                    <div style={{ color: '#ff4d4f', fontWeight: 'bold', marginTop: '8px' }}>
                      <ExclamationCircleOutline style={{ fontSize: '14px' }} /> 订单已取消
                    </div>
                  </div>
                </Card>
                <Card
                  title={<><FileOutline style={{ fontSize: '16px' }} /> 查看操作</>}
                  style={{ marginBottom: '16px', borderRadius: '12px' }}
                >
                  <Button
                    block
                    fill="outline"
                    onClick={() => { toastInfo('当前即为订单详情页') }}
                  >
                    <FileOutline style={{ fontSize: '14px' }} /> 查看订单详情
                  </Button>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ScanOrder
