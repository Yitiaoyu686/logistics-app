import { useState, useEffect } from 'react'
import { Card, SearchBar, NavBar, Button, Tag, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { ScanningOutline } from 'antd-mobile-icons'
import { warehouseApi } from '../../api'

// 快递状态
type ExpressStatus = 'PENDING' | 'MATCHED' | 'RETURNED'

// 快递公司
type ExpressCompany = 'SF' | 'YTO' | 'ZTO' | 'STO' | 'EMS' | 'JD' | 'OTHER'

// 无订单快递记录
interface NoOrderExpressRecord {
  id: string
  trackingNo: string
  company: ExpressCompany
  companyName: string
  pieces: number
  weight?: number
  signTime: string
  signOperator: string
  status: ExpressStatus
  matchedOrderNo?: string
  matchedCustomer?: string
  matchedTime?: string
  storageLocation?: string
  remark?: string
}

const NoOrderExpress = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'matched'>('all')
  const [records, setRecords] = useState<NoOrderExpressRecord[]>([])

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res: any = await warehouseApi.listNoOrderExpress()
        const list = Array.isArray(res) ? res : (res?.data || [])
        setRecords(list)
      } catch (err) {
        Toast.show({ icon: 'fail', content: '获取无订单快递数据失败' })
      }
    }
    fetchRecords()
  }, [])

  // 获取状态文本
  const getStatusText = (status: ExpressStatus) => {
    switch (status) {
      case 'PENDING':
        return '待匹配'
      case 'MATCHED':
        return '已匹配'
      case 'RETURNED':
        return '已退运'
    }
  }

  // 获取状态颜色
  const getStatusColor = (status: ExpressStatus) => {
    switch (status) {
      case 'PENDING':
        return { color: '#faad14', bg: '#fffbeb' }
      case 'MATCHED':
        return { color: '#52c41a', bg: '#f0fdf4' }
      case 'RETURNED':
        return { color: '#999', bg: '#f5f5f5' }
      default:
        return { color: '#999', bg: '#f5f5f5' }
    }
  }

  // 处理匹配订单
  const handleMatchOrder = (record: NoOrderExpressRecord) => {
    // 跳转到匹配订单页面，传递快递信息
    navigate(`/express/match-order/${record.id}`, {
      state: {
        trackingNo: record.trackingNo,
        company: record.company,
        companyName: record.companyName,
        pieces: record.pieces,
        weight: record.weight
      }
    })
  }

  // 处理退运
  const handleReturn = async (record: NoOrderExpressRecord) => {
    if (!window.confirm(`确定要退运快递单号 ${record.trackingNo} 吗？退运后将被标记为已退运状态。`)) return

    try {
      await warehouseApi.updateNoOrderExpress(record.id, { status: 'RETURNED' })
      setRecords(prev => prev.map(r =>
        r.id === record.id ? { ...r, status: 'RETURNED' as ExpressStatus } : r
      ))
      Toast.show({ content: '退运申请已提交', icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: e.message || '退运失败', icon: 'fail' })
    }
  }

  // 扫码签收
  const handleScanSign = () => {
    navigate('/express/scan-sign')
  }

  // 筛选和搜索
  const filteredRecords = records.filter(record => {
    // 状态筛选
    if (activeTab === 'pending' && record.status !== 'PENDING') return false
    if (activeTab === 'matched' && record.status !== 'MATCHED') return false

    // 搜索过滤
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      record.trackingNo.toLowerCase().includes(searchLower) ||
      record.companyName.toLowerCase().includes(searchLower) ||
      record.matchedOrderNo?.toLowerCase().includes(searchLower) ||
      record.matchedCustomer?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>无订单快递</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 搜索框 */}
        <SearchBar
          placeholder="搜索快递单号、快递公司、订单号"
          value={searchText}
          onChange={setSearchText}
          style={{
            '--border-radius': '8px',
            '--background': '#fff',
            marginBottom: '16px'
          }}
        />

        {/* 状态筛选按钮组 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <div
            onClick={() => setActiveTab('all')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '14px',
              textAlign: 'center',
              borderRadius: '6px',
              background: activeTab === 'all' ? '#1677ff' : '#f5f5f5',
              color: activeTab === 'all' ? '#fff' : '#666',
              fontWeight: activeTab === 'all' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            全部
          </div>
          <div
            onClick={() => setActiveTab('pending')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '14px',
              textAlign: 'center',
              borderRadius: '6px',
              background: activeTab === 'pending' ? '#faad14' : '#f5f5f5',
              color: activeTab === 'pending' ? '#fff' : '#666',
              fontWeight: activeTab === 'pending' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            待匹配
          </div>
          <div
            onClick={() => setActiveTab('matched')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '14px',
              textAlign: 'center',
              borderRadius: '6px',
              background: activeTab === 'matched' ? '#52c41a' : '#f5f5f5',
              color: activeTab === 'matched' ? '#fff' : '#666',
              fontWeight: activeTab === 'matched' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            已匹配
          </div>
        </div>
      </div>

      {/* 快递记录列表 */}
      <div style={{ padding: '0 16px' }}>
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <Card
              key={record.id}
              style={{
                marginBottom: '12px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div style={{ padding: '4px 0' }}>
                {/* 快递单号和状态 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                    {record.trackingNo}
                  </div>
                  <div
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: getStatusColor(record.status).color,
                      background: getStatusColor(record.status).bg
                    }}
                  >
                    {getStatusText(record.status)}
                  </div>
                </div>

                {/* 快递公司 */}
                <div style={{ marginBottom: '8px' }}>
                  <Tag color="primary" style={{ fontSize: '12px' }}>
                    {record.companyName}
                  </Tag>
                </div>

                {/* 货物信息 */}
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  件数：{record.pieces} 件
                  {record.weight && ` · 重量：${record.weight} kg`}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  存放位置：{record.storageLocation}
                </div>

                {/* 已匹配订单信息 */}
                {record.status === 'MATCHED' && record.matchedOrderNo && (
                  <div style={{
                    padding: '8px',
                    background: '#f0fdf4',
                    borderRadius: '6px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ fontSize: '12px', color: '#52c41a', marginBottom: '4px' }}>
                      ✓ 已匹配订单：{record.matchedOrderNo}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      客户：{record.matchedCustomer}
                    </div>
                  </div>
                )}

                {/* 签收信息 */}
                <div style={{
                  fontSize: '12px',
                  color: '#999',
                  paddingTop: '8px',
                  borderTop: '1px solid #f0f0f0'
                }}>
                  <div>签收时间：{record.signTime}</div>
                  <div style={{ marginTop: '4px' }}>操作人：{record.signOperator}</div>
                </div>

                {/* 备注 */}
                {record.remark && (
                  <div style={{
                    marginTop: '8px',
                    padding: '6px 8px',
                    background: '#fffbeb',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#faad14'
                  }}>
                    {record.remark}
                  </div>
                )}

                {/* 待匹配状态显示匹配和退运按钮 */}
                {record.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <Button
                      color="primary"
                      size="small"
                      onClick={() => handleMatchOrder(record)}
                      style={{
                        flex: 1,
                        '--border-radius': '6px'
                      }}
                    >
                      匹配订单
                    </Button>
                    <Button
                      color="danger"
                      size="small"
                      fill="outline"
                      onClick={() => handleReturn(record)}
                      style={{
                        flex: 1,
                        '--border-radius': '6px'
                      }}
                    >
                      退运
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#999',
            fontSize: '14px'
          }}>
            暂无快递记录
          </div>
        )}
      </div>

      {/* 底部固定扫码签收按钮 */}
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
        <Button
          block
          color="primary"
          size="large"
          onClick={handleScanSign}
          style={{
            '--border-radius': '8px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          <ScanningOutline style={{ marginRight: '8px' }} />
          扫码签收
        </Button>
      </div>
    </div>
  )
}

export default NoOrderExpress
