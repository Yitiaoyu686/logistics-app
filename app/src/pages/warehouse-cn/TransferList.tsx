import { useState, useEffect } from 'react'
import { Card, Tabs, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import {
  SendOutline,
  ContentOutline,
  TruckOutline,
  UpCircleOutline,
  EditSOutline,
  CheckCircleOutline
} from 'antd-mobile-icons'
import FloatingScanButton from '@/components/FloatingScanButton'
import { warehouseApi } from '../../api'

// 调拨类型：订单级别或集装箱级别
type TransferItemType = 'ORDER' | 'CONTAINER'

// 调拨状态
type TransferStatus = 'DRAFT' | 'PACKED' | 'SHIPPED' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED'

// 仓库信息
interface Warehouse {
  code: string
  name: string
  location: string
}

// 调拨单基础信息
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

// 订单级别调拨
interface OrderTransfer extends TransferBase {
  itemType: 'ORDER'
  orderNos: string[]
  totalPieces: number
  totalWeight: number
}

// 集装箱级别调拨
interface ContainerTransfer extends TransferBase {
  itemType: 'CONTAINER'
  containerNo: string
  containerType: string
  totalPieces: number
  totalWeight: number
}

type Transfer = OrderTransfer | ContainerTransfer

const TransferList = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('inbound')
  const [inboundTransfers, setInboundTransfers] = useState<Transfer[]>([])
  const [outboundTransfers, setOutboundTransfers] = useState<Transfer[]>([])
  const [draftTransfers, setDraftTransfers] = useState<Transfer[]>([])

  // 构造仓库对象（从字符串名称）
  const toWarehouseObj = (name: string): Warehouse => {
    return { code: name || '-', name: name || '-', location: '' }
  }

  // 从 API 加载调拨数据
  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const res: any = await warehouseApi.listTransfers()
        const rawList = Array.isArray(res) ? res : (res?.data || [])
        const all: Transfer[] = (rawList as any[]).map((t: any) => ({
          id: t.id,
          transferNo: t.transferNo || '-',
          itemType: (t.itemType || 'ORDER') as TransferItemType,
          fromWarehouse: typeof t.fromWarehouse === 'object' ? t.fromWarehouse : toWarehouseObj(t.fromWarehouse),
          toWarehouse: typeof t.toWarehouse === 'object' ? t.toWarehouse : toWarehouseObj(t.toWarehouse),
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
        setInboundTransfers(all.filter(t => ['IN_TRANSIT', 'ARRIVED'].includes(t.status)))
        setOutboundTransfers(all.filter(t => ['SHIPPED', 'PACKED'].includes(t.status)))
        setDraftTransfers(all.filter(t => t.status === 'DRAFT'))
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '获取调拨数据失败' })
      }
    }
    fetchTransfers()
  }, [])

  const getStatusText = (status: TransferStatus) => {
    const statusMap = {
      DRAFT: '草稿',
      PACKED: '已打包',
      SHIPPED: '已发运',
      IN_TRANSIT: '在途中',
      ARRIVED: '已到达',
      RECEIVED: '已签收'
    }
    return statusMap[status]
  }

  const getStatusColor = (status: TransferStatus) => {
    const colorMap = {
      DRAFT: { color: '#999', bg: '#f5f5f5' },
      PACKED: { color: '#1677ff', bg: '#e6f4ff' },
      SHIPPED: { color: '#faad14', bg: '#fffbeb' },
      IN_TRANSIT: { color: '#faad14', bg: '#fffbeb' },
      ARRIVED: { color: '#52c41a', bg: '#f0fdf4' },
      RECEIVED: { color: '#52c41a', bg: '#f0fdf4' }
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
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}><SendOutline style={{ fontSize: '24px' }} /> 调拨管理</h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
          待处理调拨 {inboundTransfers.length} 项
        </p>
      </div>

      {/* Tab切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ '--title-font-size': '15px' }}
      >
        <Tabs.Tab title="待入库" key="inbound" />
        <Tabs.Tab title="待签收" key="outbound" />
        <Tabs.Tab title="草稿" key="draft" />
      </Tabs>

      <div style={{ padding: '0 16px', marginTop: '16px' }}>
        {/* 待入库列表 */}
        {activeTab === 'inbound' && (
          <>
            {inboundTransfers.length > 0 ? (
              inboundTransfers.map((transfer) => (
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
                        color: getStatusColor(transfer.status).color,
                        background: getStatusColor(transfer.status).bg,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>
                        {getStatusText(transfer.status)}
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
              outboundTransfers.map((transfer) => {
                const statusColor = getStatusColor(transfer.status)
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
                          color: statusColor.color,
                          background: statusColor.bg,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: 'bold'
                        }}>
                          {getStatusText(transfer.status)}
                        </div>
                      </div>

                      {/* 主要信息 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '32px' }}>
                          {transfer.itemType === 'ORDER' ? <UpCircleOutline style={{ fontSize: '32px', color: '#faad14' }} /> : <TruckOutline style={{ fontSize: '32px', color: '#fa8c16' }} />}
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
                <div style={{ fontSize: '16px' }}>暂无待签收调拨</div>
              </div>
            )}
          </>
        )}

        {/* 草稿列表 */}
        {activeTab === 'draft' && (
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
                        color: '#999',
                        background: '#f5f5f5',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                      }}>
                        草稿
                      </div>
                    </div>

                    {/* 主要信息 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
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
      </div>

      {/* 全局悬浮扫码按钮 */}
      <FloatingScanButton />
    </div>
  )
}

export default TransferList
