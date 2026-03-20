import { useState, type ReactNode } from 'react'
import { Badge, Popup, NavBar, Toast, Tag, SwipeAction } from 'antd-mobile'
import {
  BellOutline,
  DownCircleOutline,
  TruckOutline,
  SendOutline,
  ExclamationCircleOutline,
  SoundOutline,
  AppstoreOutline,
  UndoOutline,
  UnorderedListOutline,
  FileOutline,
  BillOutline,
  ClockCircleOutline
} from 'antd-mobile-icons'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  useNotificationMessages,
  useUnreadCount,
  markRead,
  markAllRead,
  deleteMessage,
  type MessageType
} from '@/utils/notificationStore'

const MSG_TYPE_CONFIG_CN: Record<MessageType, { icon: ReactNode; color: string; label: string; route?: string }> = {
  inbound: { icon: <DownCircleOutline />, color: '#1677ff', label: '入库', route: '/task-hub?tab=inbound' },
  packing: { icon: <AppstoreOutline />, color: '#fa8c16', label: '装箱', route: '/task-hub?tab=packing' },
  delivery: { icon: <TruckOutline />, color: '#52c41a', label: '配送' },
  transfer: { icon: <SendOutline />, color: '#722ed1', label: '调拨', route: '/task-hub?tab=transfer' },
  alert: { icon: <ExclamationCircleOutline />, color: '#ff4d4f', label: '预警' },
  return: { icon: <UndoOutline />, color: '#eb2f96', label: '退运', route: '/task-hub?tab=return' },
  container: { icon: <UnorderedListOutline />, color: '#13c2c2', label: '集装箱' },
  system: { icon: <SoundOutline />, color: '#666', label: '系统' },
  order: { icon: <FileOutline />, color: '#1677ff', label: '订单' },
  payment: { icon: <BillOutline />, color: '#fa8c16', label: '收款' },
  task: { icon: <ClockCircleOutline />, color: '#52c41a', label: '任务' }
}

const MSG_TYPE_CONFIG_US: Record<MessageType, { icon: ReactNode; color: string; label: string; route?: string }> = {
  container: { icon: <UnorderedListOutline />, color: '#13c2c2', label: '集装箱', route: '/warehouse-us/container/list' },
  inbound: { icon: <DownCircleOutline />, color: '#1677ff', label: '入仓', route: '/warehouse-us/inbound/records' },
  delivery: { icon: <TruckOutline />, color: '#52c41a', label: '配送', route: '/warehouse-us/delivery/list' },
  transfer: { icon: <SendOutline />, color: '#722ed1', label: '调拨', route: '/warehouse-us/transfer/list' },
  alert: { icon: <ExclamationCircleOutline />, color: '#ff4d4f', label: '预警' },
  packing: { icon: <AppstoreOutline />, color: '#fa8c16', label: '装箱' },
  return: { icon: <UndoOutline />, color: '#eb2f96', label: '退运' },
  system: { icon: <SoundOutline />, color: '#666', label: '系统' },
  order: { icon: <FileOutline />, color: '#1677ff', label: '订单' },
  payment: { icon: <BillOutline />, color: '#fa8c16', label: '收款' },
  task: { icon: <ClockCircleOutline />, color: '#52c41a', label: '任务' }
}

const MSG_TYPE_CONFIG_SALES: Record<MessageType, { icon: ReactNode; color: string; label: string; route?: string }> = {
  order: { icon: <FileOutline />, color: '#1677ff', label: '订单', route: '/sales/task-hub?tab=orders' },
  payment: { icon: <BillOutline />, color: '#fa8c16', label: '收款', route: '/sales/task-hub?tab=collection' },
  task: { icon: <ClockCircleOutline />, color: '#52c41a', label: '任务', route: '/sales/task-hub?tab=tasks' },
  alert: { icon: <ExclamationCircleOutline />, color: '#ff4d4f', label: '预警' },
  inbound: { icon: <DownCircleOutline />, color: '#1677ff', label: '入库' },
  packing: { icon: <AppstoreOutline />, color: '#fa8c16', label: '装箱' },
  delivery: { icon: <TruckOutline />, color: '#52c41a', label: '配送' },
  transfer: { icon: <SendOutline />, color: '#722ed1', label: '调拨' },
  return: { icon: <UndoOutline />, color: '#eb2f96', label: '退运' },
  container: { icon: <UnorderedListOutline />, color: '#13c2c2', label: '集装箱' },
  system: { icon: <SoundOutline />, color: '#666', label: '系统' }
}

const HIDDEN_PATHS = ['/login', '/profile/notifications']

const GlobalNotification = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const messages = useNotificationMessages()
  const unreadCount = useUnreadCount()

  const isHidden = HIDDEN_PATHS.some(p => location.pathname === p)
  const isLoggedIn = !!localStorage.getItem('user')

  if (isHidden || !isLoggedIn) return null

  const isWarehouseUS = location.pathname.startsWith('/warehouse-us')
  const isSales = location.pathname.startsWith('/sales')
  const msgTypeConfig = isSales ? MSG_TYPE_CONFIG_SALES : isWarehouseUS ? MSG_TYPE_CONFIG_US : MSG_TYPE_CONFIG_CN

  const handleMarkAllRead = () => {
    markAllRead()
    Toast.show({ content: '已全部标记为已读', icon: 'success' })
  }

  const handleClickMessage = (id: string, type: MessageType) => {
    markRead(id)
    const typeConfig = msgTypeConfig[type]
    if (typeConfig?.route) {
      setVisible(false)
      navigate(typeConfig.route)
    }
  }

  return (
    <>
      <div
        onClick={() => { setVisible(true) }}
        style={{
          position: 'fixed',
          top: '12px',
          right: '12px',
          zIndex: 999,
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <Badge content={unreadCount > 0 ? unreadCount : null} style={{ '--right': '-2px', '--top': '-2px' }}>
          <BellOutline style={{ fontSize: '20px', color: '#333' }} />
        </Badge>
      </div>

      <Popup
        visible={visible}
        onMaskClick={() => { setVisible(false) }}
        position="right"
        bodyStyle={{ width: '85vw', maxWidth: '360px' }}
      >
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
          <NavBar
            onBack={() => { setVisible(false) }}
            right={
              <span
                style={{ fontSize: '13px', color: '#1677ff', cursor: 'pointer' }}
                onClick={() => {
                  setVisible(false)
                  navigate('/profile/notifications')
                }}
              >
                通知设置
              </span>
            }
          >
            消息中心
          </NavBar>

          {unreadCount > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 16px',
              background: '#fff',
              borderBottom: '1px solid #f0f0f0'
            }}>
              <span style={{ fontSize: '13px', color: '#666' }}>
                <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>{unreadCount}</span> 条未读
              </span>
              <span
                style={{ fontSize: '13px', color: '#1677ff', cursor: 'pointer' }}
                onClick={handleMarkAllRead}
              >
                全部已读
              </span>
            </div>
          )}

          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            {messages.map(msg => {
              const typeConfig = msgTypeConfig[msg.type]
              return (
                <SwipeAction
                  key={msg.id}
                  rightActions={[
                    {
                      key: 'delete',
                      text: '删除',
                      color: 'danger',
                      onClick: () => {
                        deleteMessage(msg.id)
                        Toast.show({ content: '已删除' })
                      }
                    }
                  ]}
                  style={{ marginBottom: '8px', borderRadius: '12px', overflow: 'hidden' }}
                >
                  <div
                    onClick={() => { handleClickMessage(msg.id, msg.type) }}
                    style={{
                      padding: '12px',
                      background: msg.read ? '#fff' : '#f0f9ff',
                      borderRadius: '12px',
                      border: msg.read ? '1px solid #f0f0f0' : '1px solid #bae0ff'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: `${typeConfig.color}12`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        color: typeConfig.color,
                        flexShrink: 0
                      }}>
                        {typeConfig.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '3px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {!msg.read && (
                              <div style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#ff4d4f',
                                flexShrink: 0
                              }} />
                            )}
                            <span style={{
                              fontSize: '14px',
                              fontWeight: msg.read ? 'normal' : '600',
                              color: msg.urgent ? '#ff4d4f' : '#333'
                            }}>
                              {msg.title}
                            </span>
                          </div>
                          <Tag
                            style={{
                              '--background-color': `${typeConfig.color}12`,
                              '--text-color': typeConfig.color,
                              '--border-color': 'transparent',
                              fontSize: '10px',
                              padding: '0 5px',
                              flexShrink: 0
                            }}
                          >
                            {typeConfig.label}
                          </Tag>
                        </div>
                        <div style={{
                          fontSize: '13px',
                          color: '#666',
                          lineHeight: 1.4,
                          marginBottom: '3px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {msg.content}
                        </div>
                        <div style={{ fontSize: '11px', color: '#bbb' }}>
                          {msg.time}
                        </div>
                      </div>
                    </div>
                  </div>
                </SwipeAction>
              )
            })}
          </div>

          <div style={{
            padding: '12px 16px',
            background: '#fff',
            borderTop: '1px solid #f0f0f0',
            textAlign: 'center'
          }}>
            <span
              style={{ fontSize: '14px', color: '#1677ff', cursor: 'pointer' }}
              onClick={() => {
                setVisible(false)
                navigate('/profile/notifications')
              }}
            >
              查看全部消息与设置
            </span>
          </div>
        </div>
      </Popup>
    </>
  )
}

export default GlobalNotification
