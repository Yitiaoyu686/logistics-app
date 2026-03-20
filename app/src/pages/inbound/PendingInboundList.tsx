import { useState, useEffect } from 'react'
import { Card, Tabs, Badge, SearchBar, Empty, NavBar, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { ClockCircleOutline, ContentOutline, GlobalOutline } from 'antd-mobile-icons'
import { orderApi, warehouseApi } from '../../api'

// 待入库类型
type PendingInboundType = 'ORDER' | 'CUSTOMS_RETURN'

// 客户下单类型
interface OrderInbound {
  id: string
  type: 'ORDER'
  orderNo: string
  customerName: string
  expectedPieces: number
  confirmedPieces: number
  pendingPieces: number
  createdAt: string
}

// 报关退回类型
interface CustomsReturnInbound {
  id: string
  type: 'CUSTOMS_RETURN'
  jobNo: string
  containerNo: string
  orderCount: number
  confirmedCount: number
  pendingCount: number
  returnDate: string
  reason: string
}

const PendingInboundList = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<PendingInboundType>('ORDER')
  const [searchText, setSearchText] = useState('')
  const [orderInbounds, setOrderInbounds] = useState<OrderInbound[]>([])
  const [customsReturns, setCustomsReturns] = useState<CustomsReturnInbound[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, returnRes] = await Promise.all([
          orderApi.listSub({ status: 'PENDING_INBOUND', pageSize: 500 }),
          warehouseApi.listReturns({ status: 'PENDING' }),
        ])

        const subs = (subRes as any)?.data || []
        const returns = (returnRes as any)?.data || []

        const orders: OrderInbound[] = (subs as any[]).map((sub: any) => ({
          id: sub.id,
          type: 'ORDER',
          orderNo: sub.subOrderNo || sub.id,
          customerName: sub.consignee || '-',
          expectedPieces: Number(sub.pieces || 0),
          confirmedPieces: 0,
          pendingPieces: Number(sub.pieces || 0),
          createdAt: sub.createdAt
            ? String(sub.createdAt).replace('T', ' ').slice(0, 16)
            : '-',
        }))

        const customs: CustomsReturnInbound[] = (returns as any[]).map((record: any) => ({
          id: record.id,
          type: 'CUSTOMS_RETURN',
          jobNo: record.returnNo || record.id,
          containerNo: record.orderNo || record.trackingNo || '-',
          orderCount: 1,
          confirmedCount: 0,
          pendingCount: Number(record.pieces || 0),
          returnDate: record.applyTime
            ? String(record.applyTime).replace('T', ' ').slice(0, 16)
            : (record.createdAt ? String(record.createdAt).replace('T', ' ').slice(0, 16) : '-'),
          reason: record.reason || '-',
        }))

        setOrderInbounds(orders)
        setCustomsReturns(customs)
      } catch (err) {
        Toast.show({ icon: 'fail', content: '获取待入库数据失败' })
      }
    }
    fetchData()
  }, [])

  // 过滤数据
  const filteredOrderInbounds = orderInbounds.filter(item =>
    String(item.orderNo || '').toLowerCase().includes(searchText.toLowerCase()) ||
    String(item.customerName || '').includes(searchText)
  )

  const filteredCustomsReturns = customsReturns.filter(item =>
    String(item.jobNo || '').toLowerCase().includes(searchText.toLowerCase()) ||
    String(item.containerNo || '').toLowerCase().includes(searchText.toLowerCase())
  )

  // 渲染客户下单卡片
  const renderOrderCard = (item: OrderInbound) => (
    <Card
      key={item.id}
      onClick={() => navigate(`/inbound/scan?orderNo=${item.orderNo}`)}
      style={{
        marginBottom: '12px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ fontSize: '32px' }}><ContentOutline style={{ fontSize: '32px', color: '#1677ff' }} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
              {item.orderNo}
            </div>
            <Badge content={item.pendingPieces} style={{ '--right': '0' }} />
          </div>

          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
            客户：{item.customerName}
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#999', marginBottom: '8px' }}>
            <span>预计：{item.expectedPieces}件</span>
            <span style={{ color: '#52c41a' }}>已确认：{item.confirmedPieces}件</span>
            <span style={{ color: '#ff4d4f' }}>待确认：{item.pendingPieces}件</span>
          </div>

          <div style={{ fontSize: '12px', color: '#999' }}>
            <ClockCircleOutline style={{ marginRight: '4px' }} />
            {item.createdAt}
          </div>
        </div>
      </div>
    </Card>
  )

  // 渲染报关退回卡片
  const renderCustomsReturnCard = (item: CustomsReturnInbound) => (
    <Card
      key={item.id}
      onClick={() => navigate(`/inbound/scan?jobNo=${item.jobNo}&containerNo=${item.containerNo}`)}
      style={{
        marginBottom: '12px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ fontSize: '32px' }}><GlobalOutline style={{ fontSize: '32px', color: '#1677ff' }} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                {item.jobNo}
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                集装箱：{item.containerNo}
              </div>
            </div>
            <Badge content={item.pendingCount} style={{ '--right': '0' }} />
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#999', marginBottom: '8px' }}>
            <span>订单数：{item.orderCount}</span>
            <span style={{ color: '#52c41a' }}>已确认：{item.confirmedCount}</span>
            <span style={{ color: '#ff4d4f' }}>待确认：{item.pendingCount}</span>
          </div>

          <div style={{ fontSize: '12px', color: '#ff4d4f', marginBottom: '4px' }}>
            退回原因：{item.reason}
          </div>

          <div style={{ fontSize: '12px', color: '#999' }}>
            <ClockCircleOutline style={{ marginRight: '4px' }} />
            {item.returnDate}
          </div>
        </div>
      </div>
    </Card>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      <NavBar onBack={() => navigate(-1)}>待入库列表</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 搜索栏 */}
        <div style={{ marginBottom: '16px' }}>
          <SearchBar
            placeholder={activeTab === 'ORDER' ? '搜索订单号/客户' : '搜索任务号/集装箱号'}
            value={searchText}
            onChange={setSearchText}
            style={{
              '--border-radius': '8px',
              '--background': '#fff',
              '--height': '40px'
            }}
          />
        </div>

        {/* 标签页 */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as PendingInboundType)}
          style={{
            '--title-font-size': '15px',
            '--active-line-color': '#1677ff'
          }}
        >
          <Tabs.Tab
            title={
              <span>
                客户下单
                <Badge content={orderInbounds.reduce((sum, item) => sum + item.pendingPieces, 0)} style={{ marginLeft: '8px' }} />
              </span>
            }
            key="ORDER"
          >
            <div style={{ marginTop: '16px' }}>
              {filteredOrderInbounds.length > 0 ? (
                filteredOrderInbounds.map(renderOrderCard)
              ) : (
                <Empty description="暂无待入库订单" />
              )}
            </div>
          </Tabs.Tab>

          <Tabs.Tab
            title={
              <span>
                报关退回
                <Badge content={customsReturns.reduce((sum, item) => sum + item.pendingCount, 0)} style={{ marginLeft: '8px' }} />
              </span>
            }
            key="CUSTOMS_RETURN"
          >
            <div style={{ marginTop: '16px' }}>
              {filteredCustomsReturns.length > 0 ? (
                filteredCustomsReturns.map(renderCustomsReturnCard)
              ) : (
                <Empty description="暂无报关退回" />
              )}
            </div>
          </Tabs.Tab>
        </Tabs>
      </div>
    </div>
  )
}

export default PendingInboundList
