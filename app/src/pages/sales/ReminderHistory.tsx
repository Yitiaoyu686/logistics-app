import { useState, useEffect } from 'react'
import { NavBar, Card, Tag, SpinLoading, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { salesApi } from '@/api'
import type { ReminderRecord, PendingPayment } from '@/types/sales'

const METHOD_MAP: Record<string, { text: string; color: string }> = {
  SMS: { text: '短信', color: '#1677ff' },
  PHONE: { text: '电话', color: '#52c41a' },
  EMAIL: { text: '邮件', color: '#fa8c16' },
  WECHAT: { text: '微信', color: '#07c160' },
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  SENT: { text: '已发送', color: '#1677ff' },
  RECEIVED: { text: '已确认', color: '#fa8c16' },
  PAID: { text: '已付款', color: '#52c41a' },
}

const ReminderHistory = () => {
  const navigate = useNavigate()
  const { paymentId } = useParams<{ paymentId: string }>()
  const [payment, setPayment] = useState<PendingPayment | null>(null)
  const [records, setRecords] = useState<ReminderRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [paymentsRes, recordsRes] = await Promise.all([
          salesApi.pendingPayments(),
          paymentId ? salesApi.getReminderHistory(paymentId) : Promise.resolve([])
        ])
        const allPayments: PendingPayment[] = (paymentsRes as any)?.data || []
        const foundPayment = paymentId ? allPayments.find(p => p.id === paymentId) || null : null
        setPayment(foundPayment)
        setRecords((recordsRes as any)?.data || [])
      } catch (e: any) {
        Toast.show({ content: e.message || '加载催款记录失败', icon: 'fail' })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [paymentId])

  if (loading) {
    return (
      <div>
        <NavBar onBack={() => navigate(-1)} style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>催款记录</NavBar>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <SpinLoading color='primary' />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <NavBar
        onBack={() => navigate(-1)}
        style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}
      >
        催款记录
      </NavBar>

      <div style={{ padding: '12px 16px' }}>
        {/* 关联的待收款信息 */}
        {payment && (
          <Card style={{ borderRadius: '12px', marginBottom: '12px', background: '#fff7e6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>{payment.orderNo}</span>
              <span style={{ fontSize: '12px', color: '#999' }}>{payment.customerName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#999' }}>待收金额</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fa8c16' }}>
                ${(payment.pendingAmount || 0).toLocaleString()}
              </span>
            </div>
          </Card>
        )}

        {records.map(record => {
          const methodInfo = METHOD_MAP[record.method] || { text: record.method, color: '#999' }
          const statusInfo = STATUS_MAP[record.status] || { text: record.status, color: '#999' }
          return (
            <Card key={record.id} style={{ borderRadius: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>{record.orderNo}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <Tag style={{
                    '--background-color': `${methodInfo.color}15`,
                    '--text-color': methodInfo.color,
                    '--border-color': 'transparent',
                    fontSize: '11px'
                  }}>
                    {methodInfo.text}
                  </Tag>
                  <Tag style={{
                    '--background-color': `${statusInfo.color}15`,
                    '--text-color': statusInfo.color,
                    '--border-color': 'transparent',
                    fontSize: '11px'
                  }}>
                    {statusInfo.text}
                  </Tag>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                客户：{record.customerName}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#999' }}>{record.sentAt}</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#333' }}>
                  ${(record.amount || 0).toLocaleString()}
                </span>
              </div>
              {record.remark && (
                <div style={{ fontSize: '12px', color: '#999', padding: '6px 10px', background: '#f8f9fa', borderRadius: '6px' }}>
                  {record.remark}
                </div>
              )}
            </Card>
          )
        })}

        {records.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无催款记录</div>
        )}
      </div>
    </div>
  )
}

export default ReminderHistory
