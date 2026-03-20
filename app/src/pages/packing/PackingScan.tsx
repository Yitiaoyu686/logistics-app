import { useState, useEffect } from 'react'
import { NavBar, Card, Button, Toast, Input, Tag, List } from 'antd-mobile'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ScanningOutline, InformationCircleOutline, CheckCircleFill } from 'antd-mobile-icons'
import { orderApi, warehouseApi } from '../../api'

interface ScannedOrder {
  id: string
  orderNo: string
  customerName: string
  pieces: number
  weight: number
  volume: number
  status: 'pending' | 'scanned'
}

const PackingScan = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const unitId = searchParams.get('unitId') || ''
  const jobNo = searchParams.get('jobNo') || ''
  const containerNo = searchParams.get('containerNo') || ''

  const [scanning, setScanning] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [orders, setOrders] = useState<ScannedOrder[]>([])
  const [submitting, setSubmitting] = useState(false)

  // 加载已入库待装箱的子订单
  useEffect(() => {
    const fetchPendingOrders = async () => {
      try {
        const res: any = await orderApi.listSub({ status: 'INBOUND', pageSize: 100 })
        const data = res?.data || res
        const list = Array.isArray(data) ? data : (data?.data || [])
        const mapped: ScannedOrder[] = list.map((o: any) => ({
          id: o.id,
          orderNo: o.subOrderNo || o.id,
          customerName: o.consignee || o.goodsDescription || '-',
          pieces: o.pieces || 0,
          weight: o.weight || 0,
          volume: o.volume || 0,
          status: 'pending' as const
        }))
        setOrders(mapped)
      } catch (err) {
        Toast.show({ icon: 'fail', content: '获取待装箱订单失败' })
      }
    }
    fetchPendingOrders()
  }, [jobNo])

  const scannedCount = orders.filter(o => o.status === 'scanned').length
  const totalCount = orders.length

  const handleScan = () => {
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      const pendingOrder = orders.find(o => o.status === 'pending')
      if (pendingOrder) {
        setOrders(prev => prev.map(o =>
          o.id === pendingOrder.id ? { ...o, status: 'scanned' as const } : o
        ))
        Toast.show({ content: `${pendingOrder.orderNo} 扫码成功`, icon: 'success' })
      } else {
        Toast.show({ content: '所有订单已扫码完成', icon: 'success' })
      }
    }, 1500)
  }

  const handleManualAdd = async () => {
    const input = manualInput.trim()
    if (!input) {
      Toast.show({ content: '请输入订单号', icon: 'fail' })
      return
    }

    // 先在已加载的列表中查找
    const found = orders.find(o => o.orderNo === input || o.id === input)
    if (found) {
      if (found.status === 'scanned') {
        Toast.show({ content: '该订单已扫码', icon: 'fail' })
      } else {
        setOrders(prev => prev.map(o =>
          o.id === found.id ? { ...o, status: 'scanned' as const } : o
        ))
        Toast.show({ content: `${found.orderNo} 确认成功`, icon: 'success' })
      }
    } else {
      // 在 API 搜索
      try {
        const res: any = await orderApi.search(input)
        const data = res?.data || res
        const subs = data?.subOrders || []
        if (subs.length > 0 && subs[0].status === 'INBOUND') {
          const sub = subs[0]
          const newOrder: ScannedOrder = {
            id: sub.id,
            orderNo: sub.subOrderNo || sub.id,
            customerName: sub.consignee || '-',
            pieces: sub.pieces || 0,
            weight: sub.weight || 0,
            volume: sub.volume || 0,
            status: 'scanned'
          }
          setOrders(prev => [...prev, newOrder])
          Toast.show({ content: `${newOrder.orderNo} 添加成功`, icon: 'success' })
        } else {
          Toast.show({ content: '未找到可装箱的订单（需已入库状态）', icon: 'fail' })
        }
      } catch {
        Toast.show({ content: '搜索订单失败', icon: 'fail' })
      }
    }
    setManualInput('')
  }

  const handleRemove = (id: string) => {
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, status: 'pending' as const } : o
    ))
    Toast.show({ content: '已移除' })
  }

  const handleConfirm = async () => {
    if (scannedCount === 0) {
      Toast.show({ content: '请至少扫码一个订单', icon: 'fail' })
      return
    }
    const confirmed = window.confirm(`确认将 ${scannedCount} 个订单装入 ${containerNo || '运输单元'}？`)
    if (!confirmed) return

    setSubmitting(true)
    try {
      const scannedIds = orders.filter(o => o.status === 'scanned').map(o => o.id)
      if (unitId) {
        await warehouseApi.loadUnit(unitId, scannedIds)
      }
      Toast.show({ content: '装箱成功', icon: 'success' })
      setTimeout(() => navigate(-1), 800)
    } catch (e: any) {
      Toast.show({ content: e.message || '装箱失败', icon: 'fail' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>扫码装箱</NavBar>

      <div style={{ padding: '12px 16px' }}>
        {/* 任务信息 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>{jobNo || '装箱操作'}</div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{containerNo || unitId}</div>
            </div>
            <Tag style={{
              '--background-color': '#e6f4ff',
              '--text-color': '#1677ff',
              '--border-color': 'transparent',
              fontSize: '13px',
              padding: '4px 12px'
            }}>
              {scannedCount}/{totalCount} 已扫
            </Tag>
          </div>
        </Card>

        {/* 扫码区域 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px', textAlign: 'center' }}>
          {!scanning ? (
            <div style={{ padding: '20px 0' }}>
              <ScanningOutline style={{ fontSize: '60px', color: '#1677ff', marginBottom: '12px' }} />
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                扫描订单条码添加到装箱列表
              </div>
              <Button
                color="primary"
                size="large"
                onClick={handleScan}
                style={{ '--border-radius': '8px', width: '80%' }}
              >
                <ScanningOutline /> 扫码
              </Button>
            </div>
          ) : (
            <div style={{ padding: '30px 0' }}>
              <ScanningOutline style={{ fontSize: '60px', color: '#1677ff', marginBottom: '12px' }} />
              <div style={{ fontSize: '16px', color: '#1677ff' }}>扫描中...</div>
            </div>
          )}

          {/* 手动输入 */}
          <div style={{
            display: 'flex', gap: '8px', marginTop: '12px',
            padding: '12px 0 0', borderTop: '1px solid #f0f0f0'
          }}>
            <Input
              placeholder="手动输入订单号"
              value={manualInput}
              onChange={setManualInput}
              style={{ flex: 1, '--font-size': '14px' }}
              onEnterPress={handleManualAdd}
            />
            <Button
              color="primary"
              fill="outline"
              size="small"
              onClick={handleManualAdd}
              style={{ '--border-radius': '6px', flexShrink: 0 }}
            >
              确认
            </Button>
          </div>
        </Card>

        {/* 已扫码订单 */}
        {scannedCount > 0 && (
          <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
              已扫码（{scannedCount}）
            </div>
            {orders.filter(o => o.status === 'scanned').map(order => (
              <div
                key={order.id}
                style={{
                  padding: '10px 12px', background: '#f0fdf4', borderRadius: '8px',
                  border: '1px solid #bbf7d0', marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircleFill style={{ fontSize: '16px', color: '#52c41a' }} />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{order.orderNo}</span>
                  </div>
                  <span
                    style={{ fontSize: '12px', color: '#ff4d4f', cursor: 'pointer' }}
                    onClick={() => handleRemove(order.id)}
                  >
                    移除
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginLeft: '22px' }}>
                  {order.customerName} · {order.pieces}件 · {order.weight}kg · {order.volume}m³
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* 待扫码订单 */}
        {orders.filter(o => o.status === 'pending').length > 0 && (
          <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
              待扫码（{totalCount - scannedCount}）
            </div>
            <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
              {orders.filter(o => o.status === 'pending').map(order => (
                <List.Item
                  key={order.id}
                  description={`${order.customerName} · ${order.pieces}件 · ${order.weight}kg`}
                >
                  {order.orderNo}
                </List.Item>
              ))}
            </List>
          </Card>
        )}

        {/* 提示 */}
        <Card style={{ borderRadius: '12px' }}>
          <div style={{ fontSize: '13px', color: '#666', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <InformationCircleOutline style={{ fontSize: '16px', color: '#faad14', flexShrink: 0, marginTop: '1px' }} />
            <div style={{ lineHeight: 1.6 }}>
              扫码后订单将加入装箱列表，确认装箱后不可撤销。请确保实际货物与订单信息一致。
            </div>
          </div>
        </Card>
      </div>

      {/* 底部确认按钮 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px', background: '#fff',
        borderTop: '1px solid #f0f0f0', zIndex: 100
      }}>
        <Button
          block
          color="primary"
          size="large"
          disabled={scannedCount === 0}
          loading={submitting}
          onClick={handleConfirm}
          style={{ '--border-radius': '8px', fontSize: '16px', fontWeight: 'bold' }}
        >
          确认装箱（{scannedCount}单）
        </Button>
      </div>
    </div>
  )
}

export default PackingScan
