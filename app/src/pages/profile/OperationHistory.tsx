import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { NavBar, Tabs, Tag, DotLoading } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import {
  DownCircleOutline,
  UpCircleOutline,
  AppstoreOutline,
  TruckOutline,
  SendOutline,
  CloseCircleOutline,
  FileOutline,
  BillOutline,
  UserOutline,
  MessageOutline,
} from 'antd-mobile-icons'
import dayjs from 'dayjs'
import { notificationApi } from '@/api'

type OpType = 'INBOUND' | 'OUTBOUND' | 'PACKING' | 'DELIVERY' | 'TRANSFER' | 'RETURN'
type SalesOpType = 'ORDER' | 'QUOTE' | 'PAYMENT' | 'CUSTOMER' | 'REMINDER'

type RecordType = OpType | SalesOpType

interface OperationRecord {
  id: string
  type: RecordType
  title: string
  detail: string
  orderNo?: string
  time: string
  date: string
}

const OP_TYPE_CONFIG: Record<OpType, { label: string; color: string; icon: ReactNode }> = {
  INBOUND: { label: '入库', color: '#1677ff', icon: <DownCircleOutline /> },
  OUTBOUND: { label: '出库', color: '#52c41a', icon: <UpCircleOutline /> },
  PACKING: { label: '装箱', color: '#13c2c2', icon: <AppstoreOutline /> },
  DELIVERY: { label: '配送', color: '#722ed1', icon: <TruckOutline /> },
  TRANSFER: { label: '调拨', color: '#eb2f96', icon: <SendOutline /> },
  RETURN: { label: '退运', color: '#faad14', icon: <CloseCircleOutline /> },
}

const SALES_OP_TYPE_CONFIG: Record<SalesOpType, { label: string; color: string; icon: ReactNode }> = {
  ORDER: { label: '订单', color: '#1677ff', icon: <FileOutline /> },
  QUOTE: { label: '报价', color: '#fa8c16', icon: <MessageOutline /> },
  PAYMENT: { label: '收款', color: '#52c41a', icon: <BillOutline /> },
  CUSTOMER: { label: '客户', color: '#722ed1', icon: <UserOutline /> },
  REMINDER: { label: '催款', color: '#ff4d4f', icon: <SendOutline /> },
}

function mapToRecordType(raw: any, isSales: boolean): RecordType {
  const text = `${raw?.type || ''} ${raw?.title || ''} ${raw?.message || ''}`.toUpperCase()
  if (isSales) {
    if (text.includes('PAY') || text.includes('收款')) return 'PAYMENT'
    if (text.includes('QUOTE') || text.includes('报价')) return 'QUOTE'
    if (text.includes('CUSTOMER') || text.includes('客户')) return 'CUSTOMER'
    if (text.includes('REMIND') || text.includes('催')) return 'REMINDER'
    return 'ORDER'
  }
  if (text.includes('OUTBOUND') || text.includes('出库')) return 'OUTBOUND'
  if (text.includes('PACK') || text.includes('装')) return 'PACKING'
  if (text.includes('DELIVER') || text.includes('配送')) return 'DELIVERY'
  if (text.includes('TRANSFER') || text.includes('调拨')) return 'TRANSFER'
  if (text.includes('RETURN') || text.includes('退')) return 'RETURN'
  return 'INBOUND'
}

const OperationHistory = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<OperationRecord[]>([])

  const userRole = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      return user.role || 'WAREHOUSE_CN'
    } catch {
      return 'WAREHOUSE_CN'
    }
  }, [])

  const isSales = userRole === 'SALES'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res: any = await notificationApi.list({ page: 1, pageSize: 200 })
        const rows = Array.isArray(res?.data) ? res.data : []
        const mapped: OperationRecord[] = rows.map((row: any, index: number) => {
          const t = row?.createdAt || row?.timestamp || new Date().toISOString()
          const d = dayjs(t)
          return {
            id: String(row?.id || `N-${index}`),
            type: mapToRecordType(row, isSales),
            title: String(row?.title || row?.type || '系统通知'),
            detail: String(row?.message || row?.content || '-'),
            orderNo: row?.orderNo || row?.relatedNo || undefined,
            date: d.format('YYYY-MM-DD'),
            time: d.format('HH:mm'),
          }
        })
        setRecords(mapped)
      } catch {
        setRecords([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isSales])

  const typeConfigMap = isSales ? SALES_OP_TYPE_CONFIG : OP_TYPE_CONFIG
  const accentColor = isSales ? '#11998e' : '#1677ff'

  const filteredRecords = activeTab === 'all' ? records : records.filter((record) => record.type === activeTab)

  const groupedRecords = useMemo(() => {
    const grouped: Record<string, OperationRecord[]> = {}
    filteredRecords.forEach((record) => {
      grouped[record.date] = grouped[record.date] || []
      grouped[record.date].push(record)
    })
    return grouped
  }, [filteredRecords])

  const todayKey = dayjs().format('YYYY-MM-DD')
  const yesterdayKey = dayjs().subtract(1, 'day').format('YYYY-MM-DD')

  const getDateLabel = (date: string) => {
    if (date === todayKey) return '今天'
    if (date === yesterdayKey) return '昨天'
    return date
  }

  const todayCount = records.filter((record) => record.date === todayKey).length
  const totalCount = records.length

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>操作历史</NavBar>

      <div
        style={{
          padding: '12px 16px',
          background: '#fff',
          display: 'flex',
          gap: '16px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '8px',
            background: isSales ? '#e6fffb' : '#f0f9ff',
            borderRadius: '8px',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: accentColor }}>{todayCount}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>今日操作</div>
        </div>
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '8px',
            background: '#f0fdf4',
            borderRadius: '8px',
          }}
        >
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a' }}>{totalCount}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>记录总数</div>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{
          '--title-font-size': '13px',
          '--active-title-color': accentColor,
          '--active-line-color': accentColor,
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {isSales ? (
          <>
            <Tabs.Tab title="全部" key="all" />
            <Tabs.Tab title="订单" key="ORDER" />
            <Tabs.Tab title="报价" key="QUOTE" />
            <Tabs.Tab title="收款" key="PAYMENT" />
            <Tabs.Tab title="客户" key="CUSTOMER" />
          </>
        ) : (
          <>
            <Tabs.Tab title="全部" key="all" />
            <Tabs.Tab title="入库" key="INBOUND" />
            <Tabs.Tab title="配送" key="DELIVERY" />
            <Tabs.Tab title="调拨" key="TRANSFER" />
            <Tabs.Tab title="退运" key="RETURN" />
          </>
        )}
      </Tabs>

      <div style={{ padding: '12px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
            <DotLoading /> 加载中
          </div>
        )}

        {!loading && Object.keys(groupedRecords).length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>暂无操作记录</div>
        )}

        {!loading &&
          Object.entries(groupedRecords).map(([date, dateRecords]) => (
            <div key={date} style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#999',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div style={{ width: '3px', height: '14px', background: accentColor, borderRadius: '2px' }} />
                {getDateLabel(date)}
                <span style={{ fontWeight: 'normal', fontSize: '12px' }}>({dateRecords.length}条)</span>
              </div>

              {dateRecords.map((record, idx) => {
                const typeConfig = (typeConfigMap as Record<string, { label: string; color: string; icon: ReactNode }>)[record.type]
                if (!typeConfig) return null
                return (
                  <div
                    key={record.id}
                    style={{
                      padding: '12px 14px',
                      marginBottom: idx < dateRecords.length - 1 ? '8px' : 0,
                      background: '#fff',
                      borderRadius: '12px',
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '10px',
                          background: `${typeConfig.color}12`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          color: typeConfig.color,
                          flexShrink: 0,
                        }}
                      >
                        {typeConfig.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>{record.title}</span>
                          <Tag
                            style={{
                              margin: 0,
                              border: 'none',
                              background: `${typeConfig.color}12`,
                              color: typeConfig.color,
                              fontSize: '11px',
                              padding: '2px 8px',
                            }}
                          >
                            {typeConfig.label}
                          </Tag>
                        </div>
                        <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.4', marginBottom: '6px' }}>{record.detail}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#999' }}>{record.time}</span>
                          {record.orderNo && <span style={{ fontSize: '11px', color: '#999' }}>{record.orderNo}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
      </div>
    </div>
  )
}

export default OperationHistory
