import { useState, useEffect } from 'react'
import { Card, Button, NavBar, ProgressBar, List, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { ContentOutline, CheckCircleOutline, GlobalOutline, DownCircleOutline, ScanningOutline } from 'antd-mobile-icons'
import { warehouseApi } from '../../api'

// 任务类型
type TaskType = 'ORDER' | 'CUSTOMS_RETURN'

// 快递信息
interface ExpressInfo {
  trackingNo: string
  expressCompany: string
  pieces: number
  confirmed: boolean
}

// 客户下单任务详情
interface OrderTaskDetail {
  id: string
  type: 'ORDER'
  orderNo: string
  customerName: string
  customerPhone: string
  destination: string
  productName: string
  expectedPieces: number
  confirmedPieces: number
  pendingPieces: number
  expectedTime: string
  priority: 'high' | 'normal'
  expressList: ExpressInfo[]
}

// 报关退回任务详情
interface CustomsReturnTaskDetail {
  id: string
  type: 'CUSTOMS_RETURN'
  jobNo: string
  containerNo: string
  orderCount: number
  confirmedCount: number
  pendingCount: number
  returnDate: string
  reason: string
  customsPort: string
  orders: Array<{
    orderNo: string
    customerName: string
    pieces: number
    confirmed: boolean
  }>
}

type TaskDetail = OrderTaskDetail | CustomsReturnTaskDetail

const InboundTaskDetail = () => {
  const navigate = useNavigate()
  const { taskId } = useParams()
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null)

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res: any = await warehouseApi.listStock({ id: taskId })
        const list = Array.isArray(res) ? res : (res?.data || [])
        const found = list.find((t: any) => String(t.id) === String(taskId))
        if (found) {
          setTaskDetail(found)
        } else {
          Toast.show({ icon: 'fail', content: '未找到入库任务' })
        }
      } catch (err) {
        Toast.show({ icon: 'fail', content: '获取入库任务详情失败' })
      }
    }
    if (taskId) {
      fetchDetail()
    }
  }, [taskId])

  if (!taskDetail) {
    return <div>加载中...</div>
  }

  const handleScan = () => {
    if (taskDetail.type === 'ORDER') {
      navigate(`/inbound/scan?orderNo=${taskDetail.orderNo}`)
    } else {
      navigate(`/inbound/scan?jobNo=${taskDetail.jobNo}&containerNo=${taskDetail.containerNo}`)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>
        {taskDetail.type === 'ORDER' ? '客户下单详情' : '报关退回详情'}
      </NavBar>

      <div style={{ padding: '16px' }}>
        {/* 客户下单类型 */}
        {taskDetail.type === 'ORDER' && (
          <>
            {/* 基本信息卡片 */}
            <Card
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><ContentOutline style={{ fontSize: '16px' }} /> 订单信息</span>
                  <span style={{
                    fontSize: '12px',
                    color: '#fff',
                    background: taskDetail.priority === 'high' ? '#ff4d4f' : '#faad14',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}>
                    {taskDetail.priority === 'high' ? '紧急' : '普通'}
                  </span>
                </div>
              }
              style={{
                marginBottom: '16px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <List>
                <List.Item extra={taskDetail.orderNo}>订单号</List.Item>
                <List.Item extra={taskDetail.customerName}>客户名称</List.Item>
                <List.Item extra={taskDetail.customerPhone}>联系电话</List.Item>
                <List.Item extra={taskDetail.destination}>目的地</List.Item>
                <List.Item extra={taskDetail.productName}>货物名称</List.Item>
                <List.Item extra={taskDetail.expectedTime}>预计到达</List.Item>
              </List>
            </Card>

            {/* 确认进度卡片 */}
            <Card
              title={<><CheckCircleOutline style={{ fontSize: '16px' }} /> 确认进度</>}
              style={{
                marginBottom: '16px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>
                    已确认 {taskDetail.confirmedPieces} / {taskDetail.expectedPieces} 件
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff' }}>
                    {Math.round((taskDetail.confirmedPieces / taskDetail.expectedPieces) * 100)}%
                  </span>
                </div>
                <ProgressBar
                  percent={(taskDetail.confirmedPieces / taskDetail.expectedPieces) * 100}
                  style={{
                    '--fill-color': taskDetail.confirmedPieces === taskDetail.expectedPieces ? '#52c41a' : '#1677ff',
                    '--track-width': '8px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0f9ff', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1677ff', marginBottom: '4px' }}>
                    {taskDetail.expectedPieces}
                  </div>
                  <div style={{ color: '#666' }}>预计件数</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a', marginBottom: '4px' }}>
                    {taskDetail.confirmedPieces}
                  </div>
                  <div style={{ color: '#666' }}>已确认</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#fef2f2', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff4d4f', marginBottom: '4px' }}>
                    {taskDetail.pendingPieces}
                  </div>
                  <div style={{ color: '#666' }}>待确认</div>
                </div>
              </div>
            </Card>

            {/* 快递信息列表 */}
            <Card
              title={<><DownCircleOutline style={{ fontSize: '16px' }} /> 待入库快递</>}
              style={{
                marginBottom: '16px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              {taskDetail.expressList.map((express, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px',
                    marginBottom: index < taskDetail.expressList.length - 1 ? '8px' : 0,
                    background: express.confirmed ? '#f0fdf4' : '#fef2f2',
                    borderRadius: '8px',
                    border: `1px solid ${express.confirmed ? '#86efac' : '#fecaca'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                        {express.trackingNo}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {express.expressCompany} · {express.pieces} 件
                      </div>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: express.confirmed ? '#52c41a' : '#ff4d4f',
                      fontWeight: 'bold'
                    }}>
                      {express.confirmed ? '✓ 已入库' : '待入库'}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {/* 报关退回类型 */}
        {taskDetail.type === 'CUSTOMS_RETURN' && (
          <>
            {/* 基本信息卡片 */}
            <Card
              title={<><GlobalOutline style={{ fontSize: '16px' }} /> 退回信息</>}
              style={{
                marginBottom: '16px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <List>
                <List.Item extra={taskDetail.jobNo}>任务号</List.Item>
                <List.Item extra={taskDetail.containerNo}>集装箱号</List.Item>
                <List.Item extra={taskDetail.customsPort}>报关口岸</List.Item>
                <List.Item extra={taskDetail.returnDate}>退回时间</List.Item>
                <List.Item extra={<span style={{ color: '#ff4d4f' }}>{taskDetail.reason}</span>}>
                  退回原因
                </List.Item>
              </List>
            </Card>

            {/* 确认进度卡片 */}
            <Card
              title={<><CheckCircleOutline style={{ fontSize: '16px' }} /> 确认进度</>}
              style={{
                marginBottom: '16px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', color: '#666' }}>
                    已确认 {taskDetail.confirmedCount} / {taskDetail.orderCount} 单
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1677ff' }}>
                    {Math.round((taskDetail.confirmedCount / taskDetail.orderCount) * 100)}%
                  </span>
                </div>
                <ProgressBar
                  percent={(taskDetail.confirmedCount / taskDetail.orderCount) * 100}
                  style={{
                    '--fill-color': taskDetail.confirmedCount === taskDetail.orderCount ? '#52c41a' : '#1677ff',
                    '--track-width': '8px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0f9ff', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1677ff', marginBottom: '4px' }}>
                    {taskDetail.orderCount}
                  </div>
                  <div style={{ color: '#666' }}>订单总数</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a', marginBottom: '4px' }}>
                    {taskDetail.confirmedCount}
                  </div>
                  <div style={{ color: '#666' }}>已确认</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '12px', background: '#fef2f2', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff4d4f', marginBottom: '4px' }}>
                    {taskDetail.pendingCount}
                  </div>
                  <div style={{ color: '#666' }}>待确认</div>
                </div>
              </div>
            </Card>

            {/* 库内订单信息 */}
            <Card
              title={<><ContentOutline style={{ fontSize: '16px' }} /> 库内订单信息</>}
              style={{
                marginBottom: '16px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              {taskDetail.orders.map((order, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px',
                    marginBottom: index < taskDetail.orders.length - 1 ? '8px' : 0,
                    background: order.confirmed ? '#f0fdf4' : '#fef2f2',
                    borderRadius: '8px',
                    border: `1px solid ${order.confirmed ? '#86efac' : '#fecaca'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                        {order.orderNo}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {order.customerName} · {order.pieces} 件
                      </div>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: order.confirmed ? '#52c41a' : '#ff4d4f',
                      fontWeight: 'bold'
                    }}>
                      {order.confirmed ? '✓ 已确认' : '待确认'}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}
      </div>

      {/* 底部固定扫码按钮 */}
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
          onClick={handleScan}
          style={{
            '--border-radius': '8px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          <ScanningOutline style={{ fontSize: '16px' }} /> 开始扫码入库
        </Button>
      </div>
    </div>
  )
}

export default InboundTaskDetail
