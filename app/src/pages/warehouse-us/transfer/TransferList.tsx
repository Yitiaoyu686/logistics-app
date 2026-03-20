import { useState, useEffect } from 'react'
import { Card, Tabs, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { SendOutline, ContentOutline, TruckOutline, UpCircleOutline, CheckCircleOutline } from 'antd-mobile-icons'
import { warehouseApi } from '@/api'

interface Warehouse { code: string; name: string; location: string }

type TransferStatus = 'DRAFT' | 'PACKED' | 'SHIPPED' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED'

interface Transfer {
  id: string
  transferNo: string
  itemType: 'ORDER' | 'CONTAINER'
  fromWarehouse: Warehouse
  toWarehouse: Warehouse
  orderCount: number
  totalPieces: number
  totalWeight: number
  containerNo?: string
  containerType?: string
  createTime: string
  status: TransferStatus
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

const TransferList = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('inbound')
  const [allTransfers, setAllTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTransfers = async () => {
      setLoading(true)
      try {
        const res = await warehouseApi.listTransfers()
        const raw = (res as any)?.data || []
        const mapped: Transfer[] = (raw as any[]).map((t: any) => ({
          id: t.id,
          transferNo: t.transferNo || '-',
          itemType: t.itemType || 'ORDER',
          fromWarehouse: toWh(t.fromWarehouse || ''),
          toWarehouse: toWh(t.toWarehouse || ''),
          orderCount: t.items?.length || 0,
          totalPieces: t.totalPieces || 0,
          totalWeight: t.totalWeight || 0,
          containerNo: t.containerNo,
          containerType: t.containerType,
          createTime: t.createdAt ? t.createdAt.replace('T', ' ').slice(0, 16) : '-',
          status: t.status || 'DRAFT',
        }))
        setAllTransfers(mapped)
      } catch (err: any) {
        Toast.show({ content: err.message || '调拨数据加载失败' })
      } finally {
        setLoading(false)
      }
    }
    fetchTransfers()
  }, [])

  // 待入库调拨（来自其他仓库）
  const inboundTransfers = allTransfers.filter(t =>
    ['ARRIVED', 'IN_TRANSIT'].includes(t.status)
  )

  // 待签收调拨（调往其他仓库）
  const outboundTransfers = allTransfers.filter(t =>
    ['SHIPPED', 'DRAFT', 'PACKED'].includes(t.status)
  )

  // 获取状态文本
  const getStatusText = (status: TransferStatus) => {
    const statusMap = {
      'DRAFT': '草稿',
      'PACKED': '已打包',
      'SHIPPED': '已发运',
      'IN_TRANSIT': '运输中',
      'ARRIVED': '已到达',
      'RECEIVED': '已签收'
    }
    return statusMap[status]
  }

  // 获取状态颜色
  const getStatusColor = (status: TransferStatus) => {
    const colorMap = {
      'DRAFT': '#999',
      'PACKED': '#faad14',
      'SHIPPED': '#1677ff',
      'IN_TRANSIT': '#1677ff',
      'ARRIVED': '#52c41a',
      'RECEIVED': '#13c2c2'
    }
    return colorMap[status]
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      {/* 顶部标题栏 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '24px 16px',
        color: 'white',
        marginBottom: '16px',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
          <SendOutline style={{ fontSize: '24px' }} /> 仓库调拨
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
          调拨单总数 {allTransfers.length} 个
        </p>
      </div>

      {/* Tab切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        style={{ '--title-font-size': '15px' }}
      >
        <Tabs.Tab title={`待入库 (${inboundTransfers.length})`} key="inbound" />
        <Tabs.Tab title={`待签收 (${outboundTransfers.length})`} key="outbound" />
      </Tabs>

      <div style={{ padding: '16px' }}>
        {/* 待入库列表 */}
        {activeTab === 'inbound' && (
          <>
            {inboundTransfers.length > 0 ? (
              inboundTransfers.map((transfer) => (
                <Card
                  key={transfer.id}
                  onClick={() => navigate(`/warehouse-us/transfer/detail/${transfer.id}`)}
                  style={{
                    marginBottom: '12px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <div>
                    {/* 标签行 */}
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
                        color: getStatusColor(transfer.status),
                        background: '#fff',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        border: `1px solid ${getStatusColor(transfer.status)}`
                      }}>
                        {getStatusText(transfer.status)}
                      </div>
                    </div>

                    {/* 主要信息 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '32px' }}>
                        {transfer.itemType === 'ORDER' ? <ContentOutline style={{ fontSize: '32px', color: '#1677ff' }} /> : <TruckOutline style={{ fontSize: '32px', color: '#1677ff' }} />}
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
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                <div style={{ fontSize: '16px' }}>暂无待入库调拨</div>
              </div>
            )}
          </>
        )}

        {/* 待签收列表 */}
        {activeTab === 'outbound' && (
          <>
            {outboundTransfers.length > 0 ? (
              outboundTransfers.map((transfer) => (
                <Card
                  key={transfer.id}
                  onClick={() => navigate(`/warehouse-us/transfer/detail/${transfer.id}`)}
                  style={{
                    marginBottom: '12px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <div>
                    {/* 标签行 */}
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
                        color: getStatusColor(transfer.status),
                        background: '#fff',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        border: `1px solid ${getStatusColor(transfer.status)}`
                      }}>
                        {getStatusText(transfer.status)}
                      </div>
                    </div>

                    {/* 主要信息 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '32px' }}>
                        {transfer.itemType === 'ORDER' ? <UpCircleOutline style={{ fontSize: '32px', color: '#faad14' }} /> : <TruckOutline style={{ fontSize: '32px', color: '#faad14' }} />}
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
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
                <div style={{ fontSize: '16px' }}>暂无待签收调拨</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default TransferList
