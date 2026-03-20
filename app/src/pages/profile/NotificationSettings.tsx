import { useState, useMemo } from 'react'
import { NavBar, List, Switch, Card, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import {
  MailOutline,
  MessageOutline,
  FileOutline,
  ExclamationCircleOutline,
  SoundOutline,
  ClockCircleOutline,
  BellOutline,
  AppstoreOutline,
  UndoOutline,
  UnorderedListOutline,
  BillOutline,
  UserOutline,
  TruckOutline
} from 'antd-mobile-icons'

interface NotifyConfig {
  inboundNotify: boolean
  packingNotify: boolean
  deliveryNotify: boolean
  transferNotify: boolean
  returnNotify: boolean
  alertNotify: boolean
  // 销售专属
  orderNotify: boolean
  paymentNotify: boolean
  taskNotify: boolean
  customerNotify: boolean
  // 通用
  soundEnabled: boolean
  vibrateEnabled: boolean
  quietHoursEnabled: boolean
  quietStart: string
  quietEnd: string
}

const NotificationSettings = () => {
  const navigate = useNavigate()

  const [config, setConfig] = useState<NotifyConfig>({
    inboundNotify: true,
    packingNotify: true,
    deliveryNotify: true,
    transferNotify: true,
    returnNotify: true,
    alertNotify: true,
    orderNotify: true,
    paymentNotify: true,
    taskNotify: true,
    customerNotify: true,
    soundEnabled: true,
    vibrateEnabled: false,
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '08:00'
  })

  const userRole = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      return user.role || 'WAREHOUSE_CN'
    } catch { return 'WAREHOUSE_CN' }
  }, [])

  const isWarehouseUS = userRole === 'WAREHOUSE_US'
  const isSales = userRole === 'SALES'

  const updateConfig = (key: keyof NotifyConfig, value: boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    Toast.show({ content: '设置已保存' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>通知设置</NavBar>

      <div style={{ padding: '12px 16px' }}>
        <Card style={{
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
            业务通知
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
            选择需要接收的业务通知类型
          </div>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none', '--border-inner': 'none' }}>
            {isSales ? (
              <>
                <List.Item
                  prefix={<FileOutline style={{ fontSize: '18px', color: '#1677ff' }} />}
                  extra={
                    <Switch
                      checked={config.orderNotify}
                      onChange={(val) => { updateConfig('orderNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="订单创建确认、入库完成、发运通知、签收确认"
                >
                  订单通知
                </List.Item>

                <List.Item
                  prefix={<BillOutline style={{ fontSize: '18px', color: '#fa8c16' }} />}
                  extra={
                    <Switch
                      checked={config.paymentNotify}
                      onChange={(val) => { updateConfig('paymentNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="收款到账、付款逾期提醒、催款反馈"
                >
                  收款通知
                </List.Item>

                <List.Item
                  prefix={<TruckOutline style={{ fontSize: '18px', color: '#52c41a' }} />}
                  extra={
                    <Switch
                      checked={config.taskNotify}
                      onChange={(val) => { updateConfig('taskNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="运输任务发运、到港、装载率变化"
                >
                  任务通知
                </List.Item>

                <List.Item
                  prefix={<UserOutline style={{ fontSize: '18px', color: '#722ed1' }} />}
                  extra={
                    <Switch
                      checked={config.customerNotify}
                      onChange={(val) => { updateConfig('customerNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="客户跟进提醒、客户长期未下单预警"
                >
                  客户跟进
                </List.Item>

                <List.Item
                  prefix={<ExclamationCircleOutline style={{ fontSize: '18px', color: '#ff4d4f' }} />}
                  extra={
                    <Switch
                      checked={config.alertNotify}
                      onChange={(val) => { updateConfig('alertNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="价格变动、报价过期、异常订单"
                >
                  预警通知
                </List.Item>
              </>
            ) : isWarehouseUS ? (
              <>
                <List.Item
                  prefix={<UnorderedListOutline style={{ fontSize: '18px', color: '#13c2c2' }} />}
                  extra={
                    <Switch
                      checked={config.inboundNotify}
                      onChange={(val) => { updateConfig('inboundNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="集装箱到港、清关完成、提柜通知"
                >
                  集装箱通知
                </List.Item>

                <List.Item
                  prefix={<MailOutline style={{ fontSize: '18px', color: '#1677ff' }} />}
                  extra={
                    <Switch
                      checked={config.packingNotify}
                      onChange={(val) => { updateConfig('packingNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="拆箱入仓任务、分拣完成"
                >
                  入仓通知
                </List.Item>

                <List.Item
                  prefix={<MessageOutline style={{ fontSize: '18px', color: '#52c41a' }} />}
                  extra={
                    <Switch
                      checked={config.deliveryNotify}
                      onChange={(val) => { updateConfig('deliveryNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="配送任务分配、客户催单、签收确认"
                >
                  配送通知
                </List.Item>

                <List.Item
                  prefix={<FileOutline style={{ fontSize: '18px', color: '#722ed1' }} />}
                  extra={
                    <Switch
                      checked={config.transferNotify}
                      onChange={(val) => { updateConfig('transferNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="调拨请求、到达签收"
                >
                  调拨通知
                </List.Item>

                <List.Item
                  prefix={<ExclamationCircleOutline style={{ fontSize: '18px', color: '#ff4d4f' }} />}
                  extra={
                    <Switch
                      checked={config.alertNotify}
                      onChange={(val) => { updateConfig('alertNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="配送超时、清关延误、库存积压"
                >
                  预警通知
                </List.Item>
              </>
            ) : (
              <>
                <List.Item
                  prefix={<MailOutline style={{ fontSize: '18px', color: '#1677ff' }} />}
                  extra={
                    <Switch
                      checked={config.inboundNotify}
                      onChange={(val) => { updateConfig('inboundNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="包裹到达、入库完成、异常件"
                >
                  入库通知
                </List.Item>

                <List.Item
                  prefix={<AppstoreOutline style={{ fontSize: '18px', color: '#fa8c16' }} />}
                  extra={
                    <Switch
                      checked={config.packingNotify}
                      onChange={(val) => { updateConfig('packingNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="装箱任务、装载率预警、ETD提醒"
                >
                  装箱通知
                </List.Item>

                <List.Item
                  prefix={<FileOutline style={{ fontSize: '18px', color: '#722ed1' }} />}
                  extra={
                    <Switch
                      checked={config.transferNotify}
                      onChange={(val) => { updateConfig('transferNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="调拨发起、到达、签收"
                >
                  调拨通知
                </List.Item>

                <List.Item
                  prefix={<UndoOutline style={{ fontSize: '18px', color: '#eb2f96' }} />}
                  extra={
                    <Switch
                      checked={config.returnNotify}
                      onChange={(val) => { updateConfig('returnNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="退运申请、退运处理进度"
                >
                  退运通知
                </List.Item>

                <List.Item
                  prefix={<ExclamationCircleOutline style={{ fontSize: '18px', color: '#ff4d4f' }} />}
                  extra={
                    <Switch
                      checked={config.alertNotify}
                      onChange={(val) => { updateConfig('alertNotify', val) }}
                      style={{ '--height': '24px', '--width': '40px' }}
                    />
                  }
                  description="库存超时、集装箱超重、紧急事项"
                >
                  预警通知
                </List.Item>
              </>
            )}
          </List>
        </Card>

        <Card style={{
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
            提醒方式
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
            设置消息到达时的提醒方式
          </div>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none', '--border-inner': 'none' }}>
            <List.Item
              prefix={<SoundOutline style={{ fontSize: '18px', color: '#faad14' }} />}
              extra={
                <Switch
                  checked={config.soundEnabled}
                  onChange={(val) => { updateConfig('soundEnabled', val) }}
                  style={{ '--height': '24px', '--width': '40px' }}
                />
              }
            >
              声音提醒
            </List.Item>
            <List.Item
              prefix={<BellOutline style={{ fontSize: '18px', color: '#13c2c2' }} />}
              extra={
                <Switch
                  checked={config.vibrateEnabled}
                  onChange={(val) => { updateConfig('vibrateEnabled', val) }}
                  style={{ '--height': '24px', '--width': '40px' }}
                />
              }
            >
              震动提醒
            </List.Item>
          </List>
        </Card>

        <Card style={{
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '12px'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
            免打扰
          </div>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
            在指定时间段内不接收通知提醒
          </div>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none', '--border-inner': 'none' }}>
            <List.Item
              prefix={<ClockCircleOutline style={{ fontSize: '18px', color: '#999' }} />}
              extra={
                <Switch
                  checked={config.quietHoursEnabled}
                  onChange={(val) => { updateConfig('quietHoursEnabled', val) }}
                  style={{ '--height': '24px', '--width': '40px' }}
                />
              }
              description={config.quietHoursEnabled ? `${config.quietStart} - ${config.quietEnd}` : undefined}
            >
              免打扰时段
            </List.Item>
          </List>
        </Card>
      </div>
    </div>
  )
}

export default NotificationSettings
