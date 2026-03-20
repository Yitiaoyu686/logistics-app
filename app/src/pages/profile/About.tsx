import { NavBar, List, Toast } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { RightOutline, GlobalOutline } from 'antd-mobile-icons'

const About = () => {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>关于</NavBar>

      <div style={{ padding: '16px' }}>
        {/* Logo */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '40px 0 32px',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '16px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
          }}>
            <GlobalOutline style={{ fontSize: '40px', color: '#fff' }} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
            喵喵国际物流
          </div>
          <div style={{ fontSize: '14px', color: '#999', marginBottom: '16px' }}>
            移动仓管端
          </div>
          <div style={{
            padding: '4px 16px',
            background: '#f0f9ff',
            borderRadius: '20px',
            fontSize: '13px',
            color: '#1677ff'
          }}>
            v1.0.0
          </div>
        </div>

        {/* 功能信息 */}
        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '16px',
          background: '#fff'
        }}>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
            <List.Item
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => { Toast.show({ content: '当前已是最新版本' }) }}
              clickable
              extra={<span style={{ fontSize: '13px', color: '#52c41a' }}>已是最新</span>}
            >
              检查更新
            </List.Item>
            <List.Item
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => { Toast.show({ content: '功能开发中' }) }}
              clickable
            >
              功能介绍
            </List.Item>
            <List.Item
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => { Toast.show({ content: '功能开发中' }) }}
              clickable
            >
              用户协议
            </List.Item>
            <List.Item
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => { Toast.show({ content: '功能开发中' }) }}
              clickable
            >
              隐私政策
            </List.Item>
          </List>
        </div>

        {/* 技术信息 */}
        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '16px',
          background: '#fff'
        }}>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
            <List.Item extra={<span style={{ fontSize: '13px', color: '#999' }}>v1.0.0 (build 20260209)</span>}>
              版本号
            </List.Item>
            <List.Item extra={<span style={{ fontSize: '13px', color: '#999' }}>React 19 + TypeScript</span>}>
              技术框架
            </List.Item>
            <List.Item extra={<span style={{ fontSize: '13px', color: '#999' }}>Ant Design Mobile</span>}>
              UI 框架
            </List.Item>
          </List>
        </div>

        {/* 联系方式 */}
        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '16px',
          background: '#fff'
        }}>
          <div style={{ padding: '16px', fontSize: '13px', color: '#999', lineHeight: 1.8 }}>
            <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '8px', fontSize: '14px' }}>
              联系我们
            </div>
            <div>客服邮箱：support@miaomiao-logistics.com</div>
            <div>客服电话：400-888-8888</div>
            <div>工作时间：周一至周六 9:00-18:00</div>
          </div>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '24px 0',
          fontSize: '12px',
          color: '#ccc'
        }}>
          &copy; 2026 喵喵国际物流科技有限公司
          <br />
          All Rights Reserved
        </div>
      </div>
    </div>
  )
}

export default About
