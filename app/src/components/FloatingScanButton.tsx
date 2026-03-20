import { FloatingBubble } from 'antd-mobile'
import { ScanningOutline } from 'antd-mobile-icons'
import { useNavigate, useLocation } from 'react-router-dom'

const FloatingScanButton = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const handleScan = () => {
    const isUS = location.pathname.startsWith('/warehouse-us')
    navigate(isUS ? '/warehouse-us/scan-order' : '/scan-order')
  }

  return (
    <FloatingBubble
      style={{
        '--initial-position-bottom': '80px',
        '--initial-position-right': '16px',
        '--edge-distance': '16px',
        '--background': '#1677ff',
        '--size': '56px'
      }}
      onClick={handleScan}
    >
      <ScanningOutline style={{ fontSize: '28px', color: '#fff' }} />
    </FloatingBubble>
  )
}

export default FloatingScanButton
