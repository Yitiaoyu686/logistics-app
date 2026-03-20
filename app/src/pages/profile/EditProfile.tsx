import { useState, useMemo } from 'react'
import { NavBar, Form, Input, Button, Toast, List, Dialog } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { UserSetOutline } from 'antd-mobile-icons'

const ROLE_NAMES: Record<string, string> = {
  WAREHOUSE_CN: '起运国仓管',
  WAREHOUSE_US: '到达国仓管',
  SALES: '销售人员'
}

const EditProfile = () => {
  const navigate = useNavigate()

  const userInfo = useMemo(() => {
    try {
      const stored = localStorage.getItem('user')
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return { id: '1', name: '仓管员', role: 'WAREHOUSE_CN', warehouseId: '', warehouseName: '' }
  }, [])

  const [name, setName] = useState(userInfo.name || '')
  const [phone, setPhone] = useState('138****5678')
  const [email, setEmail] = useState('')

  const handleSave = () => {
    if (!name.trim()) {
      Toast.show({ content: '请输入姓名', icon: 'fail' })
      return
    }

    Dialog.confirm({
      content: '确定保存修改吗？',
      onConfirm: () => {
        // 更新 localStorage
        const updated = { ...userInfo, name: name.trim() }
        localStorage.setItem('user', JSON.stringify(updated))
        Toast.show({ content: '资料已更新', icon: 'success' })
        setTimeout(() => { navigate(-1) }, 800)
      }
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>个人资料</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 头像区域 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 0',
          marginBottom: '16px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}>
            <UserSetOutline style={{ fontSize: '40px', color: '#fff' }} />
          </div>
          <span
            style={{ fontSize: '13px', color: '#1677ff', cursor: 'pointer' }}
            onClick={() => { Toast.show({ content: '头像修改功能开发中' }) }}
          >
            更换头像
          </span>
        </div>

        {/* 可编辑信息 */}
        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '16px',
          background: '#fff'
        }}>
          <Form layout="horizontal" style={{ '--prefix-width': '80px' }}>
            <Form.Item label="姓名" name="name">
              <Input
                value={name}
                onChange={setName}
                placeholder="请输入姓名"
                clearable
              />
            </Form.Item>
            <Form.Item label="手机号" name="phone">
              <Input
                value={phone}
                onChange={setPhone}
                placeholder="请输入手机号"
                clearable
              />
            </Form.Item>
            <Form.Item label="邮箱" name="email">
              <Input
                value={email}
                onChange={setEmail}
                placeholder="请输入邮箱（选填）"
                clearable
                type="email"
              />
            </Form.Item>
          </Form>
        </div>

        {/* 不可编辑信息 */}
        <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px', paddingLeft: '4px' }}>
          以下信息由管理员配置，如需修改请联系管理员
        </div>
        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          background: '#fff'
        }}>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
            <List.Item extra={<span style={{ color: '#999' }}>{userInfo.id}</span>}>
              工号
            </List.Item>
            <List.Item extra={<span style={{ color: '#999' }}>{ROLE_NAMES[userInfo.role] || userInfo.role}</span>}>
              角色
            </List.Item>
            {userInfo.warehouseName && (
              <List.Item extra={<span style={{ color: '#999' }}>{userInfo.warehouseName}</span>}>
                所属仓库
              </List.Item>
            )}
          </List>
        </div>
      </div>

      {/* 底部保存按钮 */}
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
          onClick={handleSave}
          style={{
            '--border-radius': '10px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          保存修改
        </Button>
      </div>
    </div>
  )
}

export default EditProfile
