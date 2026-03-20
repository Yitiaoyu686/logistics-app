import { useState } from 'react'
import { Button, Card, Toast, NavBar, Input } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { ScanningOutline, InformationCircleOutline, SearchOutline } from 'antd-mobile-icons'
import { orderApi } from '@/api'

const InboundScan = () => {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [searching, setSearching] = useState(false)

  const handleStartScan = () => {
    setScanning(true)
    // 实际扫码功能需要 html5-qrcode 库支持
    Toast.show({ icon: 'fail', content: '扫码功能开发中，请使用手动输入' })
    setScanning(false)
  }

  // 手动输入后搜索订单
  const handleManualSearch = async () => {
    const code = manualCode.trim()
    if (!code) {
      Toast.show({ icon: 'fail', content: '请输入快递单号或订单号' })
      return
    }

    setSearching(true)
    try {
      // 通过搜索 API 查找订单
      const res: any = await orderApi.search(code)
      const data = res?.data || res
      const subOrders = data?.subOrders || []
      const masterOrders = data?.masterOrders || []

      if (subOrders.length > 0) {
        // 找到子订单，直接跳转入库表单
        navigate(`/inbound/form?code=${encodeURIComponent(code)}&subId=${subOrders[0].id}`)
      } else if (masterOrders.length > 0) {
        // 找到主订单，跳转入库表单
        navigate(`/inbound/form?code=${encodeURIComponent(code)}&masterId=${masterOrders[0].id}`)
      } else {
        Toast.show({ icon: 'fail', content: '未找到匹配的订单，请检查单号' })
      }
    } catch (e: any) {
      Toast.show({ icon: 'fail', content: e.message || '查询失败' })
    } finally {
      setSearching(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>扫码入库</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 扫码区域 */}
        <Card
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            textAlign: 'center',
            padding: '40px 20px'
          }}
        >
          {!scanning ? (
            <>
              <ScanningOutline style={{ fontSize: '80px', color: '#1677ff', marginBottom: '20px' }} />
              <div style={{ fontSize: '16px', color: '#333', marginBottom: '8px' }}>
                点击下方按钮开始扫码
              </div>
              <div style={{ fontSize: '13px', color: '#999' }}>
                支持扫描快递单号或订单号
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '60px', marginBottom: '20px' }}><ScanningOutline style={{ fontSize: '60px', color: '#1677ff' }} /></div>
              <div style={{ fontSize: '16px', color: '#1677ff' }}>
                扫描中...
              </div>
            </>
          )}
        </Card>

        {/* 操作按钮 */}
        <Button
          block
          color="primary"
          size="large"
          onClick={handleStartScan}
          disabled={scanning}
          style={{
            '--border-radius': '8px',
            marginBottom: '16px'
          }}
        >
          {scanning ? '扫描中...' : '开始扫码'}
        </Button>

        {/* 手动输入区域 */}
        <Card
          style={{
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            marginBottom: '16px'
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
            <SearchOutline style={{ fontSize: '16px' }} /> 手动输入
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <Input
                placeholder="输入快递单号或订单号"
                value={manualCode}
                onChange={setManualCode}
                clearable
                style={{ '--font-size': '15px' }}
                onEnterPress={handleManualSearch}
              />
            </div>
            <Button
              color="primary"
              onClick={handleManualSearch}
              loading={searching}
              style={{ '--border-radius': '8px' }}
            >
              查询
            </Button>
          </div>
        </Card>

        {/* 提示信息 */}
        <Card
          style={{
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
            <InformationCircleOutline style={{ fontSize: '16px' }} /> 扫码提示
          </div>
          <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
            • 请对准快递单号或订单号进行扫描<br />
            • 确保光线充足，条码清晰<br />
            • 支持顺丰、圆通、中通等主流快递<br />
            • 也可手动输入单号后点击查询
          </div>
        </Card>
      </div>
    </div>
  )
}

export default InboundScan
