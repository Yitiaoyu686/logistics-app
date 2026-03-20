import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Card } from 'antd-mobile'
import { CheckCircleFill, FileOutline, ScanningOutline } from 'antd-mobile-icons'

const InboundSuccess = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as any

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <Card style={{
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        textAlign: 'center',
        width: '100%'
      }}>
        <CheckCircleFill style={{ fontSize: '80px', color: '#52c41a', marginBottom: '20px' }} />

        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
          入库成功！
        </div>

        <div style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
          订单号：{state?.orderNo || '-'}<br />
          已入库：{state?.pieces || 0}件 / {state?.weight || 0}kg
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button
            block
            color="primary"
            onClick={() => navigate('/inbound/print', { state })}
            style={{ '--border-radius': '8px' }}
          >
            <FileOutline /> 打印面单
          </Button>

          <Button
            block
            color="primary"
            fill="outline"
            onClick={() => navigate('/inbound/scan')}
            style={{ '--border-radius': '8px' }}
          >
            <ScanningOutline /> 继续扫码
          </Button>

          <Button
            block
            fill="none"
            onClick={() => navigate('/dashboard')}
            style={{ '--border-radius': '8px' }}
          >
            返回工作台
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default InboundSuccess
