import { useState } from 'react'
import { NavBar, Card, Button, Toast, Tag, Dialog } from 'antd-mobile'
import { useNavigate, useLocation } from 'react-router-dom'

const InboundPrint = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as any
  const [printing, setPrinting] = useState(false)
  const [printed, setPrinted] = useState(false)

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
  })()

  // 从导航状态获取数据
  const printData = {
    orderNo: state?.orderNo || '-',
    trackingNo: state?.trackingNo || '-',
    customerName: state?.customerName || '-',
    destination: state?.destination || '-',
    productName: state?.productName || '-',
    pieces: state?.pieces || 0,
    weight: state?.weight || 0,
    inboundTime: new Date().toLocaleString('zh-CN'),
    operator: user.name || '仓管员',
    warehouseNo: user.warehouseId || 'WH-CN',
    shelfLocation: state?.shelfLocation || '-',
    barcode: state?.barcode || state?.inboundId || '-'
  }

  const handlePrint = () => {
    setPrinting(true)
    setTimeout(() => {
      setPrinting(false)
      setPrinted(true)
      Toast.show({ content: '面单已发送至打印机', icon: 'success' })
    }, 1500)
  }

  const handleReprint = () => {
    Dialog.confirm({
      content: '确定重新打印面单？',
      confirmText: '重新打印',
      onConfirm: () => {
        handlePrint()
      }
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>打印面单</NavBar>

      <div style={{ padding: '12px 16px' }}>
        {/* 面单预览 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{
            border: '2px dashed #d9d9d9', borderRadius: '8px', padding: '20px 16px',
            background: '#fff'
          }}>
            {/* 面单头部 */}
            <div style={{ textAlign: 'center', marginBottom: '16px', borderBottom: '1px solid #f0f0f0', paddingBottom: '12px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                仓库入库面单
              </div>
              <div style={{ fontSize: '11px', color: '#999' }}>WAREHOUSE INBOUND LABEL</div>
            </div>

            {/* 条码区域 */}
            <div style={{
              textAlign: 'center', padding: '12px',
              background: '#fafafa', borderRadius: '6px', marginBottom: '12px'
            }}>
              <div style={{
                fontFamily: 'monospace', fontSize: '20px', fontWeight: 'bold',
                letterSpacing: '2px', color: '#333', marginBottom: '4px'
              }}>
                ||||| {printData.barcode} |||||
              </div>
              <div style={{ fontSize: '11px', color: '#999' }}>{printData.barcode}</div>
            </div>

            {/* 面单内容 */}
            <div style={{ fontSize: '13px', lineHeight: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#999' }}>订单号</span>
                <span style={{ fontWeight: 'bold', color: '#333' }}>{printData.orderNo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#999' }}>快递单号</span>
                <span style={{ color: '#333' }}>{printData.trackingNo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#999' }}>客户</span>
                <span style={{ color: '#333' }}>{printData.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#999' }}>目的地</span>
                <span style={{ color: '#333' }}>{printData.destination}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#999' }}>品名</span>
                <span style={{ color: '#333' }}>{printData.productName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#999' }}>件数/重量</span>
                <span style={{ fontWeight: 'bold', color: '#333' }}>{printData.pieces}件 / {printData.weight}kg</span>
              </div>

              <div style={{ borderTop: '1px dashed #e5e5e5', marginTop: '8px', paddingTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>库位</span>
                  <Tag style={{
                    '--background-color': '#e6f4ff',
                    '--text-color': '#1677ff',
                    '--border-color': 'transparent',
                    fontSize: '12px', fontWeight: 'bold'
                  }}>
                    {printData.shelfLocation}
                  </Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>入库时间</span>
                  <span style={{ color: '#333' }}>{printData.inboundTime}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999' }}>操作员</span>
                  <span style={{ color: '#333' }}>{printData.operator}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 打印设置 */}
        <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
            打印信息
          </div>
          <div style={{ fontSize: '13px', color: '#666', lineHeight: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>打印机</span>
              <span style={{ color: '#333' }}>仓库标签打印机 (默认)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>纸张规格</span>
              <span style={{ color: '#333' }}>100mm x 150mm</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>打印份数</span>
              <span style={{ color: '#333' }}>1 份</span>
            </div>
          </div>
        </Card>

        {/* 打印状态 */}
        {printed && (
          <Card style={{ borderRadius: '12px', marginBottom: '12px', background: '#f6ffed' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px', color: '#52c41a' }}>&#10004;</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#52c41a' }}>打印完成</div>
                <div style={{ fontSize: '12px', color: '#666' }}>面单已发送至打印机，请取走贴标</div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* 底部按钮 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px', background: '#fff',
        borderTop: '1px solid #f0f0f0', zIndex: 100,
        display: 'flex', gap: '12px'
      }}>
        {!printed ? (
          <Button
            block
            color="primary"
            size="large"
            loading={printing}
            onClick={handlePrint}
            style={{ '--border-radius': '8px', fontSize: '16px', fontWeight: 'bold' }}
          >
            {printing ? '打印中...' : '打印面单'}
          </Button>
        ) : (
          <>
            <Button
              block
              fill="outline"
              size="large"
              onClick={handleReprint}
              style={{ '--border-radius': '8px', flex: 1 }}
            >
              重新打印
            </Button>
            <Button
              block
              color="primary"
              size="large"
              onClick={() => navigate('/inbound/scan')}
              style={{ '--border-radius': '8px', flex: 1 }}
            >
              继续扫码
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default InboundPrint
