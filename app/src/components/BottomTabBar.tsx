import { TabBar, Badge } from 'antd-mobile'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppOutline, UnorderedListOutline, UserOutline } from 'antd-mobile-icons'

// 起运国仓待办总数（mock）
const TASK_COUNT = 13

const BottomTabBar = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const isWarehouseUS = location.pathname.startsWith('/warehouse-us')
  const isSales = location.pathname.startsWith('/sales')
  const prefix = isWarehouseUS ? '/warehouse-us' : isSales ? '/sales' : ''

  const tabs = [
    {
      key: `${prefix}/dashboard`,
      title: '工作台',
      icon: <AppOutline />,
      badge: null as (string | number | null)
    },
    {
      key: `${prefix}/task-hub`,
      title: isSales ? '工作中心' : '任务中心',
      icon: <UnorderedListOutline />,
      badge: TASK_COUNT > 0 ? TASK_COUNT : null
    },
    {
      key: `${prefix}/profile`,
      title: '我的',
      icon: <UserOutline />,
      badge: null as (string | number | null)
    }
  ]

  return (
    <TabBar
      activeKey={location.pathname}
      onChange={(key) => navigate(key)}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: '1px solid #f0f0f0',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.05)',
        paddingTop: '6px',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
      }}
    >
      {tabs.map((item) => (
        <TabBar.Item
          key={item.key}
          icon={item.badge != null ? (
            <Badge content={item.badge} style={{ '--right': '-6px', '--top': '-2px' }}>
              {item.icon}
            </Badge>
          ) : item.icon}
          title={item.title}
        />
      ))}
    </TabBar>
  )
}

export default BottomTabBar
