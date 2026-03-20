import { useState, useEffect, useMemo } from 'react'
import { NavBar, Card, Form, Input, Picker, Button, Toast, SpinLoading } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { salesApi, jobApi } from '@/api'
import type { QuoteResult, ShippingTask } from '@/types/sales'

const DESTINATIONS = [
  ['拉各斯', '阿布贾', '卡诺', '哈科特港', '卡杜纳', '伊巴丹']
]

const SHIPPING_TYPES = [
  ['全部', '海运', '空运']
]

const QuoteTool = () => {
  const navigate = useNavigate()
  const { taskId } = useParams<{ taskId: string }>()

  const [task, setTask] = useState<ShippingTask | null>(null)
  const [quoteResults, setQuoteResults] = useState<QuoteResult[]>([])
  const [loadingTask, setLoadingTask] = useState(!!taskId)

  const [destination, setDestination] = useState('')
  const [shippingType, setShippingType] = useState('全部')
  const [weight, setWeight] = useState('')
  const [volume, setVolume] = useState('')
  const [destVisible, setDestVisible] = useState(false)
  const [shippingVisible, setShippingVisible] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [querying, setQuerying] = useState(false)

  // Prefill from task if navigated from task detail
  useEffect(() => {
    const fetchTask = async () => {
      if (!taskId) return
      try {
        setLoadingTask(true)
        const res = await jobApi.get(taskId)
        const t = (res as any) as ShippingTask | null
        if (t) {
          setTask(t)
          setDestination(t.destination || '')
          setShippingType(t.type === 'SEA' ? '海运' : t.type === 'AIR' ? '空运' : '全部')
          setWeight(String(t.totalWeight || ''))
          setVolume(String(t.totalVolume || ''))
          // Auto-query when prefilled from task
          fetchQuotes(t)
        }
      } catch (e: any) {
        Toast.show({ content: e.message || '加载任务信息失败', icon: 'fail' })
      } finally {
        setLoadingTask(false)
      }
    }
    fetchTask()
  }, [taskId])

  const fetchQuotes = async (prefillTask?: ShippingTask) => {
    try {
      setQuerying(true)
      const res = await salesApi.quotes({
        destination: prefillTask?.destination || destination,
        shippingType: prefillTask ? (prefillTask.type === 'SEA' ? '海运' : '空运') : shippingType,
        weight: prefillTask ? prefillTask.totalWeight : Number(weight) || 0,
        volume: prefillTask ? prefillTask.totalVolume : Number(volume) || 0,
      })
      setQuoteResults((res as any)?.data || [])
      setShowResults(true)
    } catch (e: any) {
      Toast.show({ content: e.message || '查询报价失败', icon: 'fail' })
    } finally {
      setQuerying(false)
    }
  }

  const results = useMemo(() => {
    if (!showResults) return []
    const w = Number(weight) || 0
    const v = Number(volume) || 0
    return quoteResults
      .filter(q => {
        if (shippingType === '全部') return true
        return shippingType === '海运' ? q.shippingType === 'SEA' : q.shippingType === 'AIR'
      })
      .map(q => ({
        ...q,
        totalPrice: q.totalPrice || Math.max((q.pricePerKg || 0) * w, (q.pricePerCbm || 0) * v) || (q.pricePerKg || 0) * (w || 100)
      }))
  }, [showResults, weight, volume, shippingType, quoteResults])

  const handleQuery = () => {
    if (!destination) {
      Toast.show({ content: '请选择目的地', icon: 'fail' })
      return
    }
    if (!weight && !volume) {
      Toast.show({ content: '请输入重量或体积', icon: 'fail' })
      return
    }
    fetchQuotes()
  }

  const handleCopyQuote = (q: typeof results[0]) => {
    const text = [
      `报价渠道: ${q.channel}`,
      `目的地: ${destination}`,
      `运输方式: ${q.shippingType === 'SEA' ? '海运' : '空运'}`,
      `时效: ${q.transitDays}`,
      `单价: $${q.pricePerKg}/kg · $${q.pricePerCbm}/CBM`,
      `预估总价: $${q.totalPrice.toFixed(0)}`,
      q.remark ? `备注: ${q.remark}` : '',
    ].filter(Boolean).join('\n')

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        Toast.show({ content: '报价已复制', icon: 'success' })
      })
    } else {
      Toast.show({ content: '复制失败', icon: 'fail' })
    }
  }

  if (loadingTask) {
    return (
      <div>
        <NavBar onBack={() => navigate(-1)} style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>报价工具</NavBar>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <SpinLoading color='primary' />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '20px' }}>
      <NavBar
        onBack={() => navigate(-1)}
        style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}
      >
        报价工具
      </NavBar>

      <div style={{ padding: '12px 16px' }}>
        {/* 查询表单 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <Form layout="vertical">
            <Form.Item label="目的地" required onClick={() => setDestVisible(true)}>
              <Input placeholder="请选择目的地" value={destination} readOnly />
            </Form.Item>
            <Picker
              columns={DESTINATIONS.map(col => col.map(v => ({ label: v, value: v })))}
              visible={destVisible}
              onClose={() => setDestVisible(false)}
              onConfirm={v => { if (v[0]) setDestination(v[0] as string) }}
            />
            <Form.Item label="运输方式" onClick={() => setShippingVisible(true)}>
              <Input placeholder="请选择" value={shippingType} readOnly />
            </Form.Item>
            <Picker
              columns={SHIPPING_TYPES.map(col => col.map(v => ({ label: v, value: v })))}
              visible={shippingVisible}
              onClose={() => setShippingVisible(false)}
              onConfirm={v => { if (v[0]) setShippingType(v[0] as string) }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <Form.Item label="重量(kg)" style={{ flex: 1 }}>
                <Input
                  type="number"
                  placeholder="输入重量"
                  value={weight}
                  onChange={v => { setWeight(v); setShowResults(false) }}
                />
              </Form.Item>
              <Form.Item label="体积(CBM)" style={{ flex: 1 }}>
                <Input
                  type="number"
                  placeholder="输入体积"
                  value={volume}
                  onChange={v => { setVolume(v); setShowResults(false) }}
                />
              </Form.Item>
            </div>
          </Form>
          <Button
            block
            color="primary"
            loading={querying}
            style={{ '--border-radius': '10px', marginTop: '4px', '--background-color': '#11998e', '--border-color': '#11998e' }}
            onClick={handleQuery}
          >
            查询报价
          </Button>
        </Card>

        {/* 报价结果 */}
        {showResults && results.length > 0 && (
          <>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
              报价结果（{results.length}）
            </div>
            {results.map(q => (
              <Card key={q.id} style={{ borderRadius: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '600', color: '#333' }}>{q.channel}</span>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                      background: q.shippingType === 'SEA' ? '#e6f4ff' : '#fff7e6',
                      color: q.shippingType === 'SEA' ? '#1677ff' : '#fa8c16'
                    }}>
                      {q.shippingType === 'SEA' ? '海运' : '空运'}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#999' }}>{q.transitDays}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    ${q.pricePerKg}/kg · ${q.pricePerCbm}/CBM
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#11998e' }}>
                    ${q.totalPrice.toFixed(0)}
                  </div>
                </div>
                {q.remark && (
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>{q.remark}</div>
                )}
                <Button
                  block
                  size="small"
                  fill="outline"
                  style={{ '--border-radius': '6px' }}
                  onClick={() => handleCopyQuote(q)}
                >
                  复制报价
                </Button>
              </Card>
            ))}
          </>
        )}

        {showResults && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无匹配的报价</div>
        )}
      </div>
    </div>
  )
}

export default QuoteTool
