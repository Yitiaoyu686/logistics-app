import { useMemo, useState } from 'react'
import { List, Card, Dialog, Tag } from 'antd-mobile'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  RightOutline,
  SetOutline,
  InformationCircleOutline,
  ClockCircleOutline,
  BellOutline,
  UserSetOutline,
  AppstoreOutline
} from 'antd-mobile-icons'

interface Warehouse {
  id: string
  code: string
  name: string
  nameEn?: string
  type: string
  country: string
  city: string
}

interface UserInfo {
  id: string
  name: string
  role: 'WAREHOUSE_CN' | 'WAREHOUSE_US' | 'SALES' | 'OPS_CN' | 'OPS_US' | 'DRIVER' | 'ADMIN' | 'BOSS' | 'FINANCE'
  warehouseId: string
  warehouseName: string
  warehouses?: Warehouse[]
}

const ROLE_NAMES: Record<string, string> = {
  WAREHOUSE_CN: '起运国仓管',
  WAREHOUSE_US: '到达国仓管',
  SALES: '销售人员'
}

const Profile = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isWarehouseUS = location.pathname.startsWith('/warehouse-us')
  const isSales = location.pathname.startsWith('/sales')
  const profilePrefix = isWarehouseUS ? '/warehouse-us' : isSales ? '/sales' : ''

  const userInfo = useMemo<UserInfo>(() => {
    try {
      const stored = localStorage.getItem('user')
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return {
      id: '1',
      name: '仓管员',
      role: isWarehouseUS ? 'WAREHOUSE_US' : 'WAREHOUSE_CN',
      warehouseId: isWarehouseUS ? 'WH-LAG-001' : 'WH-GZ-001',
      warehouseName: isWarehouseUS ? '拉各斯仓库' : '广州仓库'
    }
  }, [isWarehouseUS])

  // Mock 统计
  const todayStats = useMemo(() => {
    if (userInfo.role === 'WAREHOUSE_US') {
      return [
        { label: '今日入库', value: 12, color: '#1677ff' },
        { label: '今日配送', value: 5, color: '#52c41a' },
        { label: '今日调拨', value: 2, color: '#722ed1' }
      ]
    }
    if (userInfo.role === 'SALES') {
      return [
        { label: '今日订单', value: 8, color: '#1677ff' },
        { label: '待跟进', value: 3, color: '#faad14' },
        { label: '已成交', value: 2, color: '#52c41a' }
      ]
    }
    return [
      { label: '今日入库', value: 18, color: '#1677ff' },
      { label: '今日装箱', value: 6, color: '#52c41a' },
      { label: '今日出库', value: 3, color: '#722ed1' }
    ]
  }, [userInfo.role])

  const monthStats = useMemo(() => ({
    totalOps: 356,
    workDays: 22,
    avgDaily: 16.2
  }), [])

  // 获取当前选中的仓库
  const currentWarehouse = useMemo(() => {
    try {
      const stored = localStorage.getItem('currentWarehouse')
      if (stored) return JSON.parse(stored) as Warehouse
    } catch { /* ignore */ }
    return null
  }, [])

  // 是否显示切换仓库入口（有多个仓库的用户才显示）
  const showWarehouseSwitch = useMemo(() => {
    return (userInfo.warehouses && userInfo.warehouses.length > 0)
  }, [userInfo.warehouses])

  const [showLogout, setShowLogout] = useState(false)

  const handleLogout = () => {
    setShowLogout(true)
  }

  const confirmLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('currentWarehouse')
    localStorage.removeItem('currentWarehouseId')
    setShowLogout(false)
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '60px' }}>
      {/* 顶部渐变背景 */}
      <div style={{
        background: userInfo.role === 'SALES'
          ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '48px 0 44px'
      }}>
        {/* 用户信息 */}
        <div
          style={{
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer'
          }}
          onClick={() => navigate(`${profilePrefix}/profile/edit`)}
        >
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px solid rgba(255,255,255,0.35)',
            flexShrink: 0
          }}>
            <UserSetOutline style={{ fontSize: '32px', color: '#fff' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#fff',
              marginBottom: '8px'
            }}>
              {userInfo.name}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Tag
                style={{
                  '--background-color': 'rgba(255,255,255,0.2)',
                  '--text-color': '#fff',
                  '--border-color': 'rgba(255,255,255,0.3)',
                  fontSize: '12px',
                  padding: '2px 8px'
                }}
              >
                {ROLE_NAMES[userInfo.role] || userInfo.role}
              </Tag>
              {userInfo.warehouseName && (
                <Tag
                  style={{
                    '--background-color': 'rgba(255,255,255,0.2)',
                    '--text-color': '#fff',
                    '--border-color': 'rgba(255,255,255,0.3)',
                    fontSize: '12px',
                    padding: '2px 8px'
                  }}
                >
                  {userInfo.warehouseName}
                </Tag>
              )}
            </div>
          </div>
          <RightOutline style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)' }} />
        </div>
      </div>

      <div style={{ padding: '0 16px', marginTop: '-24px' }}>
        {/* 今日工作统计 */}
        <Card style={{
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          marginBottom: '16px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>今日工作</div>
            <div style={{ fontSize: '12px', color: '#999' }}>本月 {monthStats.totalOps} 次操作</div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {todayStats.map((stat, index) => (
              <div
                key={index}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '12px 4px',
                  background: `${stat.color}08`,
                  borderRadius: '10px'
                }}
              >
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: stat.color,
                  marginBottom: '4px',
                  lineHeight: 1.2
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* 月度概览 */}
          <div style={{
            marginTop: '12px',
            padding: '10px 12px',
            background: '#f8f9fa',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{monthStats.workDays}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>出勤天数</div>
            </div>
            <div style={{ width: '1px', height: '24px', background: '#e5e5e5' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{monthStats.totalOps}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>总操作数</div>
            </div>
            <div style={{ width: '1px', height: '24px', background: '#e5e5e5' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>{monthStats.avgDaily}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>日均操作</div>
            </div>
          </div>
        </Card>

        {/* 功能列表 */}
        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '16px',
          background: '#fff'
        }}>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
            {showWarehouseSwitch && (
              <List.Item
                prefix={<AppstoreOutline style={{ fontSize: '20px', color: '#722ed1' }} />}
                arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
                onClick={() => navigate('/warehouse-select')}
                clickable
                extra={
                  currentWarehouse ? (
                    <span style={{ fontSize: '13px', color: '#999' }}>{currentWarehouse.name}</span>
                  ) : undefined
                }
              >
                切换仓库
              </List.Item>
            )}
            <List.Item
              prefix={<BellOutline style={{ fontSize: '20px', color: '#faad14' }} />}
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => navigate(`${profilePrefix}/profile/notifications`)}
              clickable
            >
              通知设置
            </List.Item>
            <List.Item
              prefix={<ClockCircleOutline style={{ fontSize: '20px', color: '#1677ff' }} />}
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => navigate(`${profilePrefix}/profile/history`)}
              clickable
            >
              操作历史
            </List.Item>
            <List.Item
              prefix={<SetOutline style={{ fontSize: '20px', color: '#666' }} />}
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => navigate(`${profilePrefix}/profile/settings`)}
              clickable
            >
              通用设置
            </List.Item>
            <List.Item
              prefix={<InformationCircleOutline style={{ fontSize: '20px', color: '#999' }} />}
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => navigate(`${profilePrefix}/profile/about`)}
              clickable
              extra={<span style={{ fontSize: '13px', color: '#999' }}>v1.0.0</span>}
            >
              关于
            </List.Item>
          </List>
        </div>

        {/* 退出登录 */}
        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '16px',
          background: '#fff'
        }}>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
            <List.Item
              onClick={handleLogout}
              clickable
              style={{ textAlign: 'center' }}
            >
              <span style={{ color: '#ff4d4f', fontWeight: '500' }}>退出登录</span>
            </List.Item>
          </List>
        </div>
      </div>

      <Dialog
        visible={showLogout}
        content="确定要退出登录吗？"
        closeOnAction
        onClose={() => setShowLogout(false)}
        actions={[
          [
            { key: 'cancel', text: '取消', onClick: () => setShowLogout(false) },
            { key: 'confirm', text: '退出', danger: true, onClick: confirmLogout }
          ]
        ]}
      />
    </div>
  )
}

export default Profile
