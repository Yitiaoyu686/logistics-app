import { useState, useEffect } from 'react'
import { Card, Button, NavBar, Toast, Input, Tag, SpinLoading } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { ScanningOutline, SearchOutline, ContentOutline, SendOutline } from 'antd-mobile-icons'
import { orderApi, warehouseApi } from '@/api'

interface OrderDetail {
  id: string
  orderNo: string
  customerName: string
  sender: string
  senderPhone: string
  consignee: string
  consigneePhone: string
  destCountry: string
  destCity: string
  destAddress: string
  transportType: string
  totalPieces: number
  totalWeight: number
  totalVolume: number
  totalValue: number
  remark: string
  createdAt: string
  expressPackages: ExpressPackage[]
}

interface ExpressPackage {
  id: string
  trackingNo: string
  expressCompany: string
  name: string
  pieces: number
  weight: number
  value: number
  category: string
  cargoType: string
  status: string
}

interface InboundRecord {
  id: string
  trackingNo: string
  pieces: number
  actualWeight: number
  status: string
}

const InboundOrderDetail = () => {
  const navigate = useNavigate()
  const { orderId } = useParams()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [inboundRecords, setInboundRecords] = useState<InboundRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [scanCode, setScanCode] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!orderId) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const [orderRes, inboundRes]: any[] = await Promise.all([
          orderApi.getMaster(orderId),
          warehouseApi.listInbound({ masterOrderId: orderId })
        ])
        const orderData = orderRes?.data || orderRes
        setOrder(orderData)
        const records = inboundRes?.data || inboundRes || []
        setInboundRecords(Array.isArray(records) ? records : [])
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '加载订单信息失败' })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [orderId])

  // 判断快递包裹是否已入库
  const isPackageInbounded = (trackingNo: string) => {
    return inboundRecords.some(r => r.trackingNo === trackingNo)
  }

  // 统计
  const totalPackages = order?.expressPackages?.length || 0
  const inboundedCount = order?.expressPackages?.filter(p => isPackageInbounded(p.trackingNo)).length || 0
  const pendingCount = totalPackages - inboundedCount

  // 扫码/手动输入 → 跳转入库表单
  const handleScanInbound = async () => {
    const code = scanCode.trim()
    if (!code) {
      Toast.show({ icon: 'fail', content: '请输入快递单号' })
      return
    }

    // 检查是否在当前订单的快递预报中
    const matchedPkg = order?.expressPackages?.find(p => p.trackingNo === code)
    if (matchedPkg && isPackageInbounded(code)) {
      Toast.show({ icon: 'fail', content: '该快递已入库' })
      return
    }

    setSearching(true)
    try {
      // 跳转到入库表单，带上订单信息
      navigate(`/inbound/form?code=${encodeURIComponent(code)}&masterId=${orderId}`)
    } finally {
      setSearching(false)
    }
  }

  // 点击某个包裹直接入库
  const handlePackageInbound = (pkg: ExpressPackage) => {
    if (isPackageInbounded(pkg.trackingNo)) {
      Toast.show({ content: '该快递已入库' })
      return
    }
    navigate(`/inbound/form?code=${encodeURIComponent(pkg.trackingNo)}&masterId=${orderId}`)
  }

  const getTransportLabel = (type: string) => {
    if (type === 'SEA') return '海运'
    if (type === 'AIR') return '空运'
    return type || '-'
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>订单入库</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <SpinLoading style={{ '--size': '32px' }} />
          <div style={{ marginTop: '12px', color: '#999' }}>加载订单信息...</div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>订单入库</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          未找到订单信息
          <div style={{ marginTop: '16px' }}>
            <Button color="primary" onClick={() => navigate(-1)}>返回</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '140px' }}>
      <NavBar onBack={() => navigate(-1)}>订单入库</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 订单基本信息 */}
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
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>订单信息</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {order.transportType && (
                  <Tag color={order.transportType === 'SEA' ? 'primary' : 'warning'} fill="outline" style={{ '--border-radius': '4px' }}>
                    {getTransportLabel(order.transportType)}
                  </Tag>
                )}
                <Tag color="default" fill="outline" style={{ '--border-radius': '4px' }}>
                  {order.destCountry}{order.destCity ? `-${order.destCity}` : ''}
                </Tag>
              </div>
            </div>

            {/* 订单号 */}
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1677ff', marginBottom: '12px' }}>
              {order.orderNo}
            </div>

            {/* 信息网格 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>客户</div>
                <div style={{ fontSize: '14px', color: '#333' }}>{order.customerName || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>发货人</div>
                <div style={{ fontSize: '14px', color: '#333' }}>{order.sender || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>收件人</div>
                <div style={{ fontSize: '14px', color: '#333' }}>{order.consignee || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>收件电话</div>
                <div style={{ fontSize: '14px', color: '#333' }}>{order.consigneePhone || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>预报件数</div>
                <div style={{ fontSize: '14px', color: '#333', fontWeight: 'bold' }}>{order.totalPieces || 0} 件</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#999' }}>预报重量</div>
                <div style={{ fontSize: '14px', color: '#333', fontWeight: 'bold' }}>{order.totalWeight || 0} kg</div>
              </div>
            </div>

            {/* 收件地址 */}
            {order.destAddress && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: '12px', color: '#999' }}>收件地址</div>
                <div style={{ fontSize: '13px', color: '#333', marginTop: '2px' }}>{order.destAddress}</div>
              </div>
            )}

            {/* 备注 */}
            {order.remark && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: '12px', color: '#999' }}>备注</div>
                <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>{order.remark}</div>
              </div>
            )}

            {/* 下单时间 */}
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#999', textAlign: 'right' }}>
              下单时间：{order.createdAt ? order.createdAt.replace('T', ' ').slice(0, 16) : '-'}
            </div>
          </div>
        </Card>

        {/* 快递包裹预报信息 */}
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
                <SendOutline style={{ fontSize: '16px', color: '#1677ff' }} />
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>快递预报</span>
              </div>
              <span style={{ fontSize: '13px', color: '#666' }}>
                {inboundedCount}/{totalPackages} 已入库
              </span>
            </div>

            {/* 入库进度 */}
            {totalPackages > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: '#f0f0f0',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${totalPackages > 0 ? (inboundedCount / totalPackages) * 100 : 0}%`,
                    height: '100%',
                    background: inboundedCount === totalPackages ? '#52c41a' : '#1677ff',
                    borderRadius: '3px',
                    transition: 'width 0.3s'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: '#999' }}>
                  <span>待入库 {pendingCount} 个</span>
                  <span>已入库 {inboundedCount} 个</span>
                </div>
              </div>
            )}

            {/* 快递包裹列表 */}
            {totalPackages > 0 ? (
              order.expressPackages.map((pkg, idx) => {
                const inbounded = isPackageInbounded(pkg.trackingNo)
                return (
                  <div
                    key={pkg.id || idx}
                    onClick={() => handlePackageInbound(pkg)}
                    style={{
                      padding: '12px',
                      marginBottom: idx < totalPackages - 1 ? '8px' : 0,
                      background: inbounded ? '#f6ffed' : '#fff',
                      borderRadius: '8px',
                      border: `1px solid ${inbounded ? '#b7eb8f' : '#f0f0f0'}`,
                      cursor: inbounded ? 'default' : 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                          {pkg.trackingNo}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                          {pkg.expressCompany || '-'} | {pkg.name || '-'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {pkg.pieces || 1}件
                          {pkg.weight > 0 ? ` / ${pkg.weight}kg` : ''}
                          {pkg.value > 0 ? ` / $${pkg.value}` : ''}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: inbounded ? '#52c41a' : '#fa8c16',
                        whiteSpace: 'nowrap',
                        marginLeft: '12px'
                      }}>
                        {inbounded ? '已入库' : '点击入库 >'}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '13px' }}>
                该订单暂无快递预报信息
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 底部固定：扫码入库区域 */}
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
              placeholder="输入或扫描快递单号"
              value={scanCode}
              onChange={setScanCode}
              clearable
              style={{
                '--font-size': '15px',
                background: '#f5f5f5',
                borderRadius: '8px',
                padding: '0 12px'
              }}
              onEnterPress={handleScanInbound}
            />
          </div>
          <Button
            color="primary"
            onClick={handleScanInbound}
            loading={searching}
            style={{ '--border-radius': '8px' }}
          >
            <SearchOutline style={{ fontSize: '16px' }} /> 查询
          </Button>
        </div>

        {/* 扫码按钮 */}
        <Button
          block
          color="primary"
          size="large"
          onClick={() => navigate(`/inbound/scan?orderId=${orderId}&orderNo=${order.orderNo}`)}
          style={{
            '--border-radius': '8px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          <ScanningOutline style={{ fontSize: '18px' }} /> 扫码入库
        </Button>
      </div>
    </div>
  )
}

export default InboundOrderDetail
