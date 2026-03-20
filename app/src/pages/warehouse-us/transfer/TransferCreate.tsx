import { useState, useEffect } from 'react'
import { Card, Button, NavBar, List, Input, Picker, TextArea, Toast, Tag } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { DeleteOutline, ScanningOutline, AddCircleOutline, FileOutline, PieOutline, ContentOutline } from 'antd-mobile-icons'
import { warehouseApi } from '@/api'

// 仓库选项（配置数据，非 mock）
const WAREHOUSES = [
  { code: '拉各斯主仓', name: '拉各斯主仓', location: '拉各斯' },
  { code: '拉各斯自提点A', name: '拉各斯自提点A', location: '拉各斯' },
  { code: '拉各斯自提点B', name: '拉各斯自提点B', location: '拉各斯' },
  { code: '广州仓', name: '广州仓', location: '广州' },
  { code: '深圳仓', name: '深圳仓', location: '深圳' },
]

interface OrderItem {
  orderNo: string
  customerName: string
  pieces: number
  weight: number
  volume: number
}

const TransferCreate = () => {
  const navigate = useNavigate()
  const [fromWarehouse] = useState(WAREHOUSES[0]) // 默认当前仓库（拉各斯仓）
  const [toWarehouseCode, setToWarehouseCode] = useState<string>('')
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [remark, setRemark] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [showScanInput, setShowScanInput] = useState(false)
  const [availableOrders, setAvailableOrders] = useState<OrderItem[]>([])

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const res = await warehouseApi.listStock()
        const raw = (res as any)?.data || []
        const mapped: OrderItem[] = (raw as any[]).map((s: any) => ({
          orderNo: s.subOrderNo || s.trackingNo || '-',
          customerName: s.goodsName || s.clientName || '-',
          pieces: s.pieces || 0,
          weight: s.weight || 0,
          volume: s.volume || 0,
        }))
        setAvailableOrders(mapped)
      } catch (err: any) {
        Toast.show({ icon: 'fail', content: err.message || '获取库存数据失败' })
      }
    }
    fetchStock()
  }, [])

  // 目标仓库选项（排除当前仓库）
  const toWarehouseOptions = WAREHOUSES
    .filter(w => w.code !== fromWarehouse.code)
    .map(w => ({ label: `${w.name} (${w.location})`, value: w.code }))

  const selectedToWarehouse = WAREHOUSES.find(w => w.code === toWarehouseCode)

  // 统计数据
  const totalPieces = orders.reduce((sum, o) => sum + o.pieces, 0)
  const totalWeight = orders.reduce((sum, o) => sum + o.weight, 0)


  // 扫码/手动添加订单
  const handleAddOrder = (orderNo: string) => {
    const trimmed = orderNo.trim()
    if (!trimmed) return

    // 检查是否已添加
    if (orders.find(o => o.orderNo === trimmed)) {
      Toast.show({ content: '该订单已在列表中', icon: 'fail' })
      return
    }

    // 从可添加的订单中查找
    const found = availableOrders.find(o => o.orderNo === trimmed)
    if (found) {
      setOrders([...orders, found])
      setScanInput('')
      Toast.show({ content: `订单 ${trimmed} 已添加`, icon: 'success' })
    } else {
      Toast.show({ content: '未找到该订单或订单不在当前仓库', icon: 'fail' })
    }
  }

  // 移除订单
  const handleRemoveOrder = (orderNo: string) => {
    if (!window.confirm(`确定要移除订单 ${orderNo} 吗？`)) return
    setOrders(orders.filter(o => o.orderNo !== orderNo))
    Toast.show({ content: '订单已移除', icon: 'success' })
  }

  // 调用创建 API
  const doCreate = async (status: 'DRAFT' | 'PACKED') => {
    try {
      await warehouseApi.createTransfer({
        fromWarehouse: fromWarehouse.code,
        toWarehouse: toWarehouseCode,
        transferType: 'DESTINATION',
        itemType: 'ORDER',
        totalPieces: totalPieces,
        totalWeight: totalWeight,
        status,
        remark,
        items: orders.map(o => ({
          subOrderNo: o.orderNo,
          goodsName: o.customerName,
          pieces: o.pieces,
          weight: o.weight,
          volume: o.volume,
        })),
      })
      Toast.show({ content: status === 'DRAFT' ? '草稿已保存' : '调拨单已提交', icon: 'success' })
      setTimeout(() => navigate(-1), 800)
    } catch (err: any) {
      Toast.show({ content: err.message || '操作失败', icon: 'fail' })
    }
  }

  // 保存草稿
  const handleSaveDraft = () => {
    if (!toWarehouseCode) {
      Toast.show({ content: '请选择目标仓库', icon: 'fail' })
      return
    }
    if (!window.confirm('确定保存为草稿吗？')) return
    doCreate('DRAFT')
  }

  // 提交调拨单
  const handleSubmit = () => {
    if (!toWarehouseCode) {
      Toast.show({ content: '请选择目标仓库', icon: 'fail' })
      return
    }
    if (orders.length === 0) {
      Toast.show({ content: '请至少添加一个订单', icon: 'fail' })
      return
    }
    if (!window.confirm('确定要提交调拨单吗？提交后将无法修改。')) return
    doCreate('PACKED')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>创建调拨单</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 仓库信息卡片 */}
        <Card
          title={<><FileOutline style={{ fontSize: '16px' }} /> 调拨信息</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <List>
            <List.Item extra={`${fromWarehouse.name} (${fromWarehouse.location})`}>
              发出仓库
            </List.Item>
            <List.Item
              extra={
                selectedToWarehouse
                  ? `${selectedToWarehouse.name} (${selectedToWarehouse.location})`
                  : <span style={{ color: '#ccc' }}>请选择</span>
              }
              onClick={() => { setShowPicker(true) }}
              clickable
            >
              目标仓库
            </List.Item>
          </List>

          <Picker
            columns={[toWarehouseOptions]}
            visible={showPicker}
            onClose={() => { setShowPicker(false) }}
            onConfirm={(val) => {
              if (val[0]) {
                setToWarehouseCode(val[0] as string)
              }
            }}
          />

          <div style={{ padding: '12px 0 0 0' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>备注</div>
            <TextArea
              placeholder="请输入调拨备注（选填）"
              value={remark}
              onChange={setRemark}
              rows={2}
              style={{
                '--font-size': '14px'
              }}
            />
          </div>
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
                {orders.length}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>订单数</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a', marginBottom: '4px' }}>
                {totalPieces}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>总件数</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#fffbeb', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#faad14', marginBottom: '4px' }}>
                {totalWeight}
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  size="small"
                  color="primary"
                  fill="outline"
                  onClick={() => { setShowScanInput(!showScanInput) }}
                >
                  <ScanningOutline /> 扫码添加
                </Button>
              </div>
            </div>
          }
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          {/* 扫码/输入框 */}
          {showScanInput && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
              padding: '12px',
              background: '#f0f9ff',
              borderRadius: '8px'
            }}>
              <Input
                placeholder="输入或扫描订单号"
                value={scanInput}
                onChange={setScanInput}
                onEnterPress={() => { handleAddOrder(scanInput) }}
                clearable
                style={{
                  '--font-size': '14px',
                  flex: 1
                }}
              />
              <Button
                size="small"
                color="primary"
                onClick={() => { handleAddOrder(scanInput) }}
              >
                添加
              </Button>
            </div>
          )}

          {/* 快速添加提示 */}
          {showScanInput && orders.length === 0 && (
            <div style={{
              padding: '12px',
              marginBottom: '12px',
              background: '#fffbe6',
              borderRadius: '8px',
              border: '1px solid #ffe58f'
            }}>
              <div style={{ fontSize: '13px', color: '#d48806', marginBottom: '8px' }}>
                可添加的在库订单：
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {availableOrders.filter(o => !orders.find(added => added.orderNo === o.orderNo)).slice(0, 4).map(o => (
                  <Tag
                    key={o.orderNo}
                    color="primary"
                    fill="outline"
                    style={{ fontSize: '12px', cursor: 'pointer' }}
                    onClick={() => { handleAddOrder(o.orderNo) }}
                  >
                    {o.orderNo}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* 订单列表 */}
          {orders.length === 0 ? (
            <div style={{
              padding: '32px 0',
              textAlign: 'center',
              color: '#999',
              fontSize: '14px'
            }}>
              <AddCircleOutline style={{ fontSize: '36px', color: '#ccc', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
              暂无订单，请扫码或手动添加
            </div>
          ) : (
            orders.map((order, index) => (
              <div
                key={order.orderNo}
                style={{
                  padding: '12px',
                  marginBottom: index < orders.length - 1 ? '8px' : 0,
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
                  <Button
                    size="mini"
                    color="danger"
                    fill="none"
                    onClick={() => { handleRemoveOrder(order.orderNo) }}
                  >
                    <DeleteOutline />
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* 底部操作按钮 */}
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
            onClick={handleSaveDraft}
            style={{
              '--border-radius': '8px',
              fontSize: '16px',
              flex: 1
            }}
          >
            保存草稿
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
    </div>
  )
}

export default TransferCreate
