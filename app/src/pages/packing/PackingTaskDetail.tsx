import { useState, useEffect } from 'react'
import { Card, Button, NavBar, Toast, SpinLoading, Input, Modal } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { ContentOutline, ScanningOutline, SearchOutline } from 'antd-mobile-icons'
import { warehouseApi, orderApi } from '../../api'

interface UnitDetail {
  id: string
  unitNo: string
  unitType: string
  transportMode: 'SEA' | 'AIR'
  status: string
  maxWeight: number
  maxVolume: number
  currentWeight: number
  currentVolume: number
  loadedPieces: number
  loadedOrders: number
  jobNo: string | null
  warehouse: string | null
  sealNo: string | null
  createdAt: string
}

interface LoadedOrder {
  id: string
  orderNo: string
  consignee: string
  pieces: number
  weight: number
  volume: number
  status: string
}

const PackingTaskDetail = () => {
  const navigate = useNavigate()
  const { taskId } = useParams()
  const [unit, setUnit] = useState<UnitDetail | null>(null)
  const [orders, setOrders] = useState<LoadedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [scanCode, setScanCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [sealing, setSealing] = useState(false)

  const fetchData = async () => {
    if (!taskId) return
    setLoading(true)
    try {
      // 获取集装单元详情
      const res: any = await warehouseApi.listUnits({ id: taskId })
      const list = Array.isArray(res) ? res : (res?.data || [])
      // listUnits 不支持 id 筛选，手动 find
      const allUnits: any[] = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
      const found = allUnits.find((u: any) => String(u.id) === String(taskId))

      if (!found) {
        Toast.show({ icon: 'fail', content: '未找到集装单元' })
        setLoading(false)
        return
      }

      setUnit({
        id: found.id,
        unitNo: found.unitNo || '-',
        unitType: found.unitType || '-',
        transportMode: found.transportMode || 'SEA',
        status: found.status || 'EMPTY',
        maxWeight: found.maxWeight || 0,
        maxVolume: found.maxVolume || 0,
        currentWeight: found.currentWeight || 0,
        currentVolume: found.currentVolume || 0,
        loadedPieces: found.loadedPieces || 0,
        loadedOrders: found.loadedOrders || 0,
        jobNo: found.jobNo || null,
        warehouse: found.warehouse || null,
        sealNo: found.sealNo || null,
        createdAt: found.createdAt || '',
      })

      // 获取已装载的子订单
      const orderIds: string[] = found.orderIds || []
      if (orderIds.length > 0) {
        const orderDetails = await Promise.all(
          orderIds.map(async (oid: string) => {
            try {
              const subRes: any = await orderApi.getSub(oid)
              const sub = subRes?.data || subRes
              return {
                id: sub.id,
                orderNo: sub.subOrderNo || sub.id,
                consignee: sub.consignee || sub.goodsDescription || '-',
                pieces: sub.pieces || 0,
                weight: sub.weight || 0,
                volume: sub.volume || 0,
                status: sub.status || 'PACKED',
              }
            } catch {
              return { id: oid, orderNo: oid, consignee: '-', pieces: 0, weight: 0, volume: 0, status: 'PACKED' }
            }
          })
        )
        setOrders(orderDetails)
      } else {
        setOrders([])
      }
    } catch (err) {
      Toast.show({ icon: 'fail', content: '获取集装单元详情失败' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [taskId])

  // 扫码/手动输入添加货物
  const handleAddOrder = async () => {
    const code = scanCode.trim()
    if (!code) {
      Toast.show({ icon: 'fail', content: '请输入子订单号' })
      return
    }

    setSearching(true)
    try {
      // 搜索子订单
      const res: any = await orderApi.search(code)
      const data = res?.data || res
      const subs = data?.subOrders || []

      if (subs.length === 0) {
        Toast.show({ icon: 'fail', content: '未找到匹配的子订单' })
        return
      }

      const sub = subs[0]
      if (sub.status !== 'INBOUND') {
        Toast.show({ icon: 'fail', content: `该订单状态为 ${sub.status}，需要"已入库"状态才能装箱` })
        return
      }

      // 检查是否已在本单元中
      if (orders.some(o => o.id === sub.id)) {
        Toast.show({ icon: 'fail', content: '该订单已在此集装单元中' })
        return
      }

      // 调用 loadUnit API
      await warehouseApi.loadUnit(taskId!, [sub.id])
      Toast.show({ icon: 'success', content: `${sub.subOrderNo || sub.id} 装箱成功` })
      setScanCode('')
      // 刷新数据
      fetchData()
    } catch (e: any) {
      Toast.show({ icon: 'fail', content: e.message || '装箱失败' })
    } finally {
      setSearching(false)
    }
  }

  const [sealConfirmVisible, setSealConfirmVisible] = useState(false)

  // 封箱操作
  const handleSeal = () => {
    setSealConfirmVisible(true)
  }

  const doSeal = async () => {
    setSealConfirmVisible(false)
    setSealing(true)
    try {
      await warehouseApi.sealUnit(taskId!)
      Toast.show({ icon: 'success', content: '封箱成功' })
      fetchData()
    } catch (e: any) {
      Toast.show({ icon: 'fail', content: e.message || '封箱失败' })
    } finally {
      setSealing(false)
    }
  }

  const getStatusText = (status: string) => {
    const map: Record<string, string> = { EMPTY: '空箱', LOADING: '装货中', SEALED: '已封箱', SHIPPED: '已发运' }
    return map[status] || status
  }

  const getStatusStyle = (status: string) => {
    const map: Record<string, { color: string; bg: string }> = {
      EMPTY: { color: '#999', bg: '#f5f5f5' },
      LOADING: { color: '#1677ff', bg: '#e6f4ff' },
      SEALED: { color: '#52c41a', bg: '#f0fdf4' },
      SHIPPED: { color: '#722ed1', bg: '#f9f0ff' },
    }
    return map[status] || { color: '#999', bg: '#f5f5f5' }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>装箱详情</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <SpinLoading style={{ '--size': '32px' }} />
          <div style={{ marginTop: '12px', color: '#999' }}>加载中...</div>
        </div>
      </div>
    )
  }

  if (!unit) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>装箱详情</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          未找到集装单元
          <div style={{ marginTop: '16px' }}>
            <Button color="primary" onClick={() => navigate(-1)}>返回</Button>
          </div>
        </div>
      </div>
    )
  }

  const weightRate = unit.maxWeight > 0 ? Math.round((unit.currentWeight / unit.maxWeight) * 100) : 0
  const volumeRate = unit.maxVolume > 0 ? Math.round((unit.currentVolume / unit.maxVolume) * 100) : 0
  const isSea = unit.transportMode === 'SEA'
  const isSealed = unit.status === 'SEALED' || unit.status === 'SHIPPED'
  const statusStyle = getStatusStyle(unit.status)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: isSealed ? '20px' : '140px' }}>
      <NavBar onBack={() => navigate(-1)}>装箱详情</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 集装单元信息 */}
        <Card
          style={{
            marginBottom: '12px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ padding: '4px 0' }}>
            {/* 标题行 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ContentOutline style={{ fontSize: '16px', color: '#1677ff' }} />
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>集装单元</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold',
                  color: isSea ? '#1677ff' : '#52c41a',
                  background: isSea ? '#e6f4ff' : '#f0fdf4',
                }}>{isSea ? '海运' : '空运'}</span>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold',
                  color: statusStyle.color, background: statusStyle.bg,
                }}>{getStatusText(unit.status)}</span>
              </div>
            </div>

            {/* 单元号 */}
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1677ff', marginBottom: '12px' }}>
              {unit.unitNo}
            </div>

            {/* 信息网格 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>柜型</div>
                <div style={{ fontSize: '14px', color: '#333' }}>{unit.unitType}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>关联任务</div>
                <div style={{ fontSize: '14px', color: '#333' }}>{unit.jobNo || '未绑定'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>仓库</div>
                <div style={{ fontSize: '14px', color: '#333' }}>{unit.warehouse || '-'}</div>
              </div>
              {unit.sealNo && (
                <div>
                  <div style={{ fontSize: '12px', color: '#999' }}>封条号</div>
                  <div style={{ fontSize: '14px', color: '#333' }}>{unit.sealNo}</div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* 装载进度 */}
        <Card
          style={{
            marginBottom: '12px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ padding: '4px 0' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
              装载进度
            </div>

            {/* 统计数字 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px', background: '#f0f9ff', borderRadius: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1677ff' }}>{unit.loadedOrders}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>已装单数</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px', background: '#f0fdf4', borderRadius: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a' }}>{unit.loadedPieces}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>已装件数</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px', background: '#fff7e6', borderRadius: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fa8c16' }}>{weightRate}%</div>
                <div style={{ fontSize: '12px', color: '#666' }}>重量利用</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '10px 4px', background: '#f9f0ff', borderRadius: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#722ed1' }}>{volumeRate}%</div>
                <div style={{ fontSize: '12px', color: '#666' }}>体积利用</div>
              </div>
            </div>

            {/* 重量进度条 */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                <span>重量 {unit.currentWeight}kg / {unit.maxWeight}kg</span>
                <span style={{ fontWeight: 'bold', color: weightRate > 100 ? '#ff4d4f' : weightRate > 80 ? '#faad14' : '#52c41a' }}>{weightRate}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(weightRate, 100)}%`, height: '100%', borderRadius: '3px',
                  background: weightRate > 100 ? '#ff4d4f' : weightRate > 80 ? '#faad14' : '#1677ff',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>

            {/* 体积进度条 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                <span>体积 {unit.currentVolume}m³ / {unit.maxVolume}m³</span>
                <span style={{ fontWeight: 'bold', color: volumeRate > 100 ? '#ff4d4f' : volumeRate > 80 ? '#faad14' : '#52c41a' }}>{volumeRate}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(volumeRate, 100)}%`, height: '100%', borderRadius: '3px',
                  background: volumeRate > 100 ? '#ff4d4f' : volumeRate > 80 ? '#faad14' : '#1677ff',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          </div>
        </Card>

        {/* 已装货物列表 */}
        <Card
          style={{
            marginBottom: '12px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>已装货物</span>
              <span style={{ fontSize: '13px', color: '#666' }}>{orders.length} 单</span>
            </div>

            {orders.length > 0 ? (
              orders.map((order, idx) => (
                <div
                  key={order.id}
                  style={{
                    padding: '10px 12px',
                    marginBottom: idx < orders.length - 1 ? '8px' : 0,
                    background: '#f6ffed',
                    borderRadius: '8px',
                    border: '1px solid #b7eb8f',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                        {order.orderNo}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {order.consignee} | {order.pieces}件 / {order.weight}kg
                        {order.volume > 0 ? ` / ${order.volume}m³` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#52c41a', fontWeight: 'bold' }}>已装箱</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: '#999', fontSize: '13px' }}>
                暂无装箱货物，请扫码添加
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 封箱确认弹窗 */}
      <Modal
        visible={sealConfirmVisible}
        title="确认封箱"
        content={`确定要封箱 ${unit?.unitNo} 吗？封箱后将不能再添加货物。`}
        closeOnAction
        onClose={() => setSealConfirmVisible(false)}
        actions={[
          { key: 'cancel', text: '取消', onClick: () => setSealConfirmVisible(false) },
          { key: 'confirm', text: '确认封箱', bold: true, danger: true, onClick: doSeal },
        ]}
      />

      {/* 底部操作区（非已封箱状态时显示） */}
      {!isSealed && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.1)',
          padding: '12px 16px',
          zIndex: 100
        }}>
          {/* 扫码输入行 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1 }}>
              <Input
                placeholder="输入或扫描子订单号"
                value={scanCode}
                onChange={setScanCode}
                clearable
                style={{
                  '--font-size': '15px',
                  background: '#f5f5f5',
                  borderRadius: '8px',
                  padding: '0 12px'
                }}
                onEnterPress={handleAddOrder}
              />
            </div>
            <Button
              color="primary"
              onClick={handleAddOrder}
              loading={searching}
              style={{ '--border-radius': '8px' }}
            >
              <SearchOutline style={{ fontSize: '16px' }} /> 装入
            </Button>
          </div>

          {/* 操作按钮行 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              block
              size="large"
              onClick={() => navigate(`/packing/scan?unitId=${unit.id}&jobNo=${unit.jobNo || ''}&containerNo=${unit.unitNo}`)}
              style={{
                '--border-radius': '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                flex: 1,
              }}
            >
              <ScanningOutline style={{ fontSize: '16px' }} /> 扫码装箱
            </Button>
            <Button
              color="warning"
              size="large"
              onClick={handleSeal}
              loading={sealing}
              disabled={orders.length === 0}
              style={{
                '--border-radius': '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                flex: 1,
              }}
            >
              封箱完成
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default PackingTaskDetail
