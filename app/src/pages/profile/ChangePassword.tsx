import { useState } from 'react'
import { NavBar, Form, Input, Button, Toast, Dialog } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { EyeInvisibleOutline, EyeOutline } from 'antd-mobile-icons'

const ChangePassword = () => {
  const navigate = useNavigate()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // 密码强度
  const getStrength = (pwd: string): { level: number; text: string; color: string } => {
    if (!pwd) return { level: 0, text: '', color: '#e5e5e5' }
    let score = 0
    if (pwd.length >= 6) score++
    if (pwd.length >= 10) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++

    if (score <= 1) return { level: 1, text: '弱', color: '#ff4d4f' }
    if (score <= 3) return { level: 2, text: '中', color: '#faad14' }
    return { level: 3, text: '强', color: '#52c41a' }
  }

  const strength = getStrength(newPwd)

  const handleSubmit = () => {
    if (!oldPwd) {
      Toast.show({ content: '请输入当前密码', icon: 'fail' })
      return
    }
    if (!newPwd) {
      Toast.show({ content: '请输入新密码', icon: 'fail' })
      return
    }
    if (newPwd.length < 6) {
      Toast.show({ content: '新密码至少6位', icon: 'fail' })
      return
    }
    if (newPwd !== confirmPwd) {
      Toast.show({ content: '两次输入的新密码不一致', icon: 'fail' })
      return
    }
    if (oldPwd === newPwd) {
      Toast.show({ content: '新密码不能与当前密码相同', icon: 'fail' })
      return
    }

    Dialog.confirm({
      content: '确定修改密码吗？修改后需要重新登录。',
      onConfirm: () => {
        Toast.show({ content: '密码修改成功，请重新登录', icon: 'success' })
        setTimeout(() => {
          localStorage.removeItem('user')
          navigate('/login', { replace: true })
        }, 1500)
      }
    })
  }

  const PwdToggle = ({ visible, onToggle }: { visible: boolean; onToggle: () => void }) => (
    <div onClick={onToggle} style={{ padding: '4px', cursor: 'pointer' }}>
      {visible
        ? <EyeOutline style={{ fontSize: '18px', color: '#999' }} />
        : <EyeInvisibleOutline style={{ fontSize: '18px', color: '#999' }} />
      }
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>修改密码</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 提示信息 */}
        <div style={{
          padding: '12px 14px',
          background: '#fffbe6',
          border: '1px solid #ffe58f',
          borderRadius: '10px',
          marginBottom: '16px',
          fontSize: '13px',
          color: '#d48806',
          lineHeight: 1.6
        }}>
          密码要求：至少6位，建议包含大小写字母、数字和特殊字符
        </div>

        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          background: '#fff'
        }}>
          <Form layout="vertical" style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
            <Form.Item label="当前密码">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Input
                  value={oldPwd}
                  onChange={setOldPwd}
                  placeholder="请输入当前密码"
                  type={showOld ? 'text' : 'password'}
                  clearable
                  style={{ flex: 1 }}
                />
                <PwdToggle visible={showOld} onToggle={() => setShowOld(!showOld)} />
              </div>
            </Form.Item>

            <Form.Item label="新密码">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Input
                  value={newPwd}
                  onChange={setNewPwd}
                  placeholder="请输入新密码（至少6位）"
                  type={showNew ? 'text' : 'password'}
                  clearable
                  style={{ flex: 1 }}
                />
                <PwdToggle visible={showNew} onToggle={() => setShowNew(!showNew)} />
              </div>
              {/* 密码强度指示器 */}
              {newPwd && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    {[1, 2, 3].map(l => (
                      <div
                        key={l}
                        style={{
                          flex: 1,
                          height: '4px',
                          borderRadius: '2px',
                          background: l <= strength.level ? strength.color : '#e5e5e5',
                          transition: 'background 0.3s'
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ fontSize: '12px', color: strength.color, textAlign: 'right' }}>
                    密码强度：{strength.text}
                  </div>
                </div>
              )}
            </Form.Item>

            <Form.Item label="确认新密码">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Input
                  value={confirmPwd}
                  onChange={setConfirmPwd}
                  placeholder="请再次输入新密码"
                  type={showConfirm ? 'text' : 'password'}
                  clearable
                  style={{ flex: 1 }}
                />
                <PwdToggle visible={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
              </div>
              {confirmPwd && newPwd !== confirmPwd && (
                <div style={{ fontSize: '12px', color: '#ff4d4f', marginTop: '4px' }}>
                  两次输入的密码不一致
                </div>
              )}
              {confirmPwd && newPwd === confirmPwd && confirmPwd.length > 0 && (
                <div style={{ fontSize: '12px', color: '#52c41a', marginTop: '4px' }}>
                  密码一致
                </div>
              )}
            </Form.Item>
          </Form>
        </div>
      </div>

      {/* 底部按钮 */}
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
          onClick={handleSubmit}
          style={{
            '--border-radius': '10px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          确认修改
        </Button>
      </div>
    </div>
  )
}

export default ChangePassword
