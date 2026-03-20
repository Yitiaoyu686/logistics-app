import { useState } from 'react'
import { Button, Form, Input, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { GlobalOutline } from 'antd-mobile-icons'
import { authApi } from '@/api'

const Login = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const res: any = await authApi.login(values.username, values.password)
      const { token, user } = res.data || res

      const warehouses = user.warehouses || []

      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify({
        id: user.id,
        name: user.realName || user.username,
        role: user.role,
        warehouseId: user.warehouseId || '',
        warehouseName: user.warehouseName || '',
        warehouses
      }))

      Toast.show({ content: '登录成功', icon: 'success' })

      // 如果有多个仓库，跳转到仓库选择页面
      if (warehouses.length > 1) {
        navigate('/warehouse-select', { replace: true })
      } else if (warehouses.length === 1) {
        // 只有一个仓库，自动选中
        localStorage.setItem('currentWarehouse', JSON.stringify(warehouses[0]))
        localStorage.setItem('currentWarehouseId', warehouses[0].id)
        // 根据角色跳转
        if (user.role === 'WAREHOUSE_US' || user.role === 'OPS_US' || user.role === 'DRIVER') {
          navigate('/warehouse-us/dashboard', { replace: true })
        } else if (user.role === 'SALES') {
          navigate('/sales/dashboard', { replace: true })
        } else {
          navigate('/dashboard', { replace: true })
        }
      } else {
        // 没有仓库（ADMIN/BOSS/SALES 等），直接根据角色跳转
        if (user.role === 'WAREHOUSE_US') {
          navigate('/warehouse-us/dashboard', { replace: true })
        } else if (user.role === 'SALES') {
          navigate('/sales/dashboard', { replace: true })
        } else {
          navigate('/dashboard', { replace: true })
        }
      }
    } catch (err: any) {
      Toast.show({ content: err.message || '登录失败', icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: '#fff',
        borderRadius: '16px',
        padding: '32px 24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Logo和标题 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '12px'
          }}><GlobalOutline style={{ fontSize: '48px', color: '#667eea' }} /></div>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#333',
            marginBottom: '8px'
          }}>跨境物流系统</h1>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#999'
          }}>移动端管理系统</p>
        </div>

        {/* 登录表单 */}
        <Form
          onFinish={onFinish}
          footer={
            <Button
              block
              type='submit'
              color='primary'
              size='large'
              loading={loading}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              登录
            </Button>
          }
        >
          <Form.Item
            name='username'
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              placeholder='请输入用户名'
              clearable
              style={{
                '--border-radius': '8px',
                '--font-size': '15px'
              }}
            />
          </Form.Item>

          <Form.Item
            name='password'
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input
              placeholder='请输入密码'
              clearable
              type='password'
              style={{
                '--border-radius': '8px',
                '--font-size': '15px'
              }}
            />
          </Form.Item>
        </Form>

        {/* 快捷登录 */}
        <div style={{ marginTop: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '13px', color: '#999' }}>
            快捷登录
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              block
              color='primary'
              fill='outline'
              loading={loading}
              style={{ '--border-radius': '8px', flex: 1 }}
              onClick={() => onFinish({ username: 'warehouse_cn1', password: 'wh123' })}
            >
              起运国仓管
            </Button>
            <Button
              block
              color='primary'
              fill='outline'
              loading={loading}
              style={{ '--border-radius': '8px', flex: 1 }}
              onClick={() => onFinish({ username: 'warehouse_us1', password: 'wh123' })}
            >
              到达国仓管
            </Button>
            <Button
              block
              color='primary'
              fill='outline'
              loading={loading}
              style={{ '--border-radius': '8px', flex: 1 }}
              onClick={() => onFinish({ username: 'sales1', password: 'sales123' })}
            >
              销售
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
