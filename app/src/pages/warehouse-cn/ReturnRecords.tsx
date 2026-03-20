import { useState, useEffect } from 'react'
import { Card, SearchBar, NavBar, Tag, Button, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { InformationCircleOutline } from 'antd-mobile-icons'
import { warehouseApi } from '../../api'

// 退运类型
type ReturnType =
  | 'CUSTOMER_CANCEL'      // 客户取消订单
  | 'DAMAGED'              // 货物破损
  | 'NO_ORDER'             // 无订单快递
  | 'CUSTOMS_REJECT'       // 报关退回
  | 'DELIVERY_FAILED'      // 配送失败
  | 'CUSTOMER_REJECT'      // 客户拒收
  | 'QUALITY_ISSUE'        // 质量问题

// 退运状态
type ReturnStatus =
  | 'REQUESTED'            // 申请中
  | 'APPROVED'             // 已批准
  | 'REJECTED'             // 已拒绝
  | 'RETURNING'            // 退运中
  | 'RETURNED'             // 已退回
  | 'COMPLETED'            // 已完成

// 退运阶段（从哪个状态发起）
type ReturnStage =
  | 'INBOUND'              // 入库阶段
  | 'IN_STOCK'             // 库存阶段
  | 'PACKED'               // 已装箱
  | 'SHIPPED'              // 已发运
  | 'IN_TRANSIT'           // 运输中
  | 'ARRIVED'              // 已到达
  | 'DELIVERY'             // 配送中
  | 'DELIVERED'            // 已送达

// 退运记录
interface ReturnRecord {
  id: string
  returnNo: string
  orderNo?: string
  trackingNo?: string
  customerName: string
  returnType: ReturnType
  returnStage: ReturnStage
  status: ReturnStatus
  reason: string
  pieces: number
  weight: number
  volume?: number
  applicant: string
  applyTime: string
  approver?: string
  approveTime?: string
  currentLocation?: string
  estimatedArrival?: string
  remark?: string
}

const ReturnRecords = () => {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'returning' | 'completed'>('all')
  const [records, setRecords] = useState<ReturnRecord[]>([])

  // 从 API 加载退运记录
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res: any = await warehouseApi.listReturns()
        const data = Array.isArray(res) ? res : (res?.data || [])
        setRecords(data)
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '获取退运记录失败' })
      }
    }
    fetchRecords()
  }, [])

  // 获取退运类型文本
  const getReturnTypeText = (type: ReturnType) => {
    const typeMap = {
      CUSTOMER_CANCEL: '客户取消',
      DAMAGED: '货物破损',
      NO_ORDER: '无订单退运',
      CUSTOMS_REJECT: '报关退回',
      DELIVERY_FAILED: '配送失败',
      CUSTOMER_REJECT: '客户拒收',
      QUALITY_ISSUE: '质量问题'
    }
    return typeMap[type]
  }

  // 获取退运状态文本
  const getStatusText = (status: ReturnStatus) => {
    const statusMap = {
      REQUESTED: '待审批',
      APPROVED: '已批准',
      REJECTED: '已拒绝',
      RETURNING: '退运中',
      RETURNED: '已退回',
      COMPLETED: '已完成'
    }
    return statusMap[status]
  }

  // 获取状态颜色
  const getStatusColor = (status: ReturnStatus) => {
    const colorMap = {
      REQUESTED: { color: '#faad14', bg: '#fffbeb' },
      APPROVED: { color: '#1677ff', bg: '#e6f4ff' },
      REJECTED: { color: '#ff4d4f', bg: '#fff1f0' },
      RETURNING: { color: '#722ed1', bg: '#f9f0ff' },
      RETURNED: { color: '#52c41a', bg: '#f0fdf4' },
      COMPLETED: { color: '#999', bg: '#f5f5f5' }
    }
    return colorMap[status]
  }

  // 筛选和搜索
  const filteredRecords = records.filter(record => {
    // 状态筛选
    if (activeTab === 'pending' && record.status !== 'REQUESTED') return false
    if (activeTab === 'returning' && !['APPROVED', 'RETURNING'].includes(record.status)) return false
    if (activeTab === 'completed' && !['RETURNED', 'COMPLETED'].includes(record.status)) return false

    // 搜索过滤
    if (!searchText) return true
    const searchLower = searchText.toLowerCase()
    return (
      record.returnNo.toLowerCase().includes(searchLower) ||
      record.orderNo?.toLowerCase().includes(searchLower) ||
      record.trackingNo?.toLowerCase().includes(searchLower) ||
      record.customerName.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      <NavBar onBack={() => navigate(-1)}>退运记录</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 搜索框 */}
        <SearchBar
          placeholder="搜索退运单号、订单号、客户名称"
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
              cursor: 'pointer'
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
              cursor: 'pointer'
            }}
          >
            待审批
          </div>
          <div
            onClick={() => setActiveTab('returning')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '14px',
              textAlign: 'center',
              borderRadius: '6px',
              background: activeTab === 'returning' ? '#722ed1' : '#f5f5f5',
              color: activeTab === 'returning' ? '#fff' : '#666',
              fontWeight: activeTab === 'returning' ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            退运中
          </div>
          <div
            onClick={() => setActiveTab('completed')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '14px',
              textAlign: 'center',
              borderRadius: '6px',
              background: activeTab === 'completed' ? '#52c41a' : '#f5f5f5',
              color: activeTab === 'completed' ? '#fff' : '#666',
              fontWeight: activeTab === 'completed' ? 'bold' : 'normal',
              cursor: 'pointer'
            }}
          >
            已完成
          </div>
        </div>
      </div>

      {/* 退运记录列表 */}
      <div style={{ padding: '0 16px' }}>
        {filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <Card
              key={record.id}
              onClick={() => navigate(`/return/detail/${record.id}`)}
              style={{
                marginBottom: '12px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                cursor: 'pointer'
              }}
            >
              <div style={{ padding: '4px 0' }}>
                {/* 退运单号和状态 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
                    {record.returnNo}
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

                {/* 退运类型标签 */}
                <div style={{ marginBottom: '8px' }}>
                  <Tag color="danger" style={{ fontSize: '12px' }}>
                    {getReturnTypeText(record.returnType)}
                  </Tag>
                </div>

                {/* 订单/快递信息 */}
                {record.orderNo && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    订单号：{record.orderNo}
                  </div>
                )}
                {record.trackingNo && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    快递单号：{record.trackingNo}
                  </div>
                )}
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  客户：{record.customerName}
                </div>

                {/* 退运原因 */}
                <div style={{
                  padding: '8px',
                  background: '#fffbeb',
                  borderRadius: '6px',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontSize: '12px', color: '#faad14', marginBottom: '4px', fontWeight: 'bold' }}>
                    退运原因
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {record.reason}
                  </div>
                </div>

                {/* 货物信息 */}
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                  件数：{record.pieces} 件
                  {record.weight && ` · 重量：${record.weight} kg`}
                  {record.volume && ` · 体积：${record.volume} m³`}
                </div>

                {/* 当前位置和预计到达 */}
                {record.currentLocation && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    当前位置：{record.currentLocation}
                  </div>
                )}
                {record.estimatedArrival && (
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                    预计到达：{record.estimatedArrival}
                  </div>
                )}

                {/* 申请和审批信息 */}
                <div style={{
                  fontSize: '12px',
                  color: '#999',
                  paddingTop: '8px',
                  borderTop: '1px solid #f0f0f0'
                }}>
                  <div>申请人：{record.applicant} · {record.applyTime}</div>
                  {record.approver && record.approveTime && (
                    <div style={{ marginTop: '4px' }}>
                      审批人：{record.approver} · {record.approveTime}
                    </div>
                  )}
                </div>

                {/* 备注 */}
                {record.remark && (
                  <div style={{
                    marginTop: '8px',
                    padding: '6px 8px',
                    background: '#f0f0f0',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    <InformationCircleOutline style={{ fontSize: '14px' }} /> {record.remark}
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
            暂无退运记录
          </div>
        )}
      </div>
    </div>
  )
}

export default ReturnRecords