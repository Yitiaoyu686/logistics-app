import { useState, useMemo } from 'react'
import { NavBar, List, Dialog, Toast, Picker } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import {
  RightOutline,
  UserOutline,
  LockOutline,
  GlobalOutline,
  DeleteOutline,
  ContentOutline,
  EyeOutline,
  PayCircleOutline
} from 'antd-mobile-icons'

const LANGUAGE_OPTIONS = [
  [
    { label: '简体中文', value: 'zh-CN' },
    { label: 'English', value: 'en-US' },
    { label: 'Français', value: 'fr-FR' },
    { label: 'Português', value: 'pt-BR' }
  ]
]

const FONT_SIZE_OPTIONS = [
  [
    { label: '小', value: 'small' },
    { label: '标准', value: 'medium' },
    { label: '大', value: 'large' }
  ]
]

const CURRENCY_OPTIONS = [
  [
    { label: '人民币 (CNY)', value: 'CNY' },
    { label: '美元 (USD)', value: 'USD' },
    { label: '尼日利亚奈拉 (NGN)', value: 'NGN' },
    { label: '加纳塞地 (GHS)', value: 'GHS' }
  ]
]

const GeneralSettings = () => {
  const navigate = useNavigate()
  const [language, setLanguage] = useState('zh-CN')
  const [fontSize, setFontSize] = useState('medium')
  const [currency, setCurrency] = useState('NGN')
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)

  const langLabel = useMemo(() => {
    return LANGUAGE_OPTIONS[0].find(o => o.value === language)?.label || language
  }, [language])

  const fontLabel = useMemo(() => {
    return FONT_SIZE_OPTIONS[0].find(o => o.value === fontSize)?.label || fontSize
  }, [fontSize])

  const currencyLabel = useMemo(() => {
    return CURRENCY_OPTIONS[0].find(o => o.value === currency)?.label || currency
  }, [currency])

  const handleClearCache = () => {
    Dialog.confirm({
      content: '清除缓存会清空本地临时数据（图片缓存、搜索记录等），不影响账号信息和设置。确定清除吗？',
      onConfirm: () => {
        Toast.show({ content: '缓存已清除 (12.3 MB)', icon: 'success' })
      }
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)}>通用设置</NavBar>

      <div style={{ padding: '12px 16px' }}>
        {/* 账号安全 */}
        <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px', paddingLeft: '4px' }}>
          账号安全
        </div>
        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '20px',
          background: '#fff'
        }}>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
            <List.Item
              prefix={<UserOutline style={{ fontSize: '18px', color: '#1677ff' }} />}
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => navigate('/profile/edit')}
              clickable
            >
              个人资料
            </List.Item>
            <List.Item
              prefix={<LockOutline style={{ fontSize: '18px', color: '#ff4d4f' }} />}
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => navigate('/profile/password')}
              clickable
            >
              修改密码
            </List.Item>
          </List>
        </div>

        {/* 显示与语言 */}
        <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px', paddingLeft: '4px' }}>
          显示与语言
        </div>
        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '20px',
          background: '#fff'
        }}>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
            <List.Item
              prefix={<GlobalOutline style={{ fontSize: '18px', color: '#52c41a' }} />}
              extra={<span style={{ fontSize: '14px', color: '#999' }}>{langLabel}</span>}
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => { setShowLangPicker(true) }}
              clickable
            >
              语言
            </List.Item>
            <List.Item
              prefix={<EyeOutline style={{ fontSize: '18px', color: '#722ed1' }} />}
              extra={<span style={{ fontSize: '14px', color: '#999' }}>{fontLabel}</span>}
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => { setShowFontPicker(true) }}
              clickable
            >
              字体大小
            </List.Item>
            <List.Item
              prefix={<PayCircleOutline style={{ fontSize: '18px', color: '#faad14' }} />}
              extra={<span style={{ fontSize: '14px', color: '#999' }}>{currencyLabel}</span>}
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={() => { setShowCurrencyPicker(true) }}
              clickable
            >
              默认货币
            </List.Item>
          </List>
        </div>

        {/* 数据管理 */}
        <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px', paddingLeft: '4px' }}>
          数据管理
        </div>
        <div style={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '20px',
          background: '#fff'
        }}>
          <List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
            <List.Item
              prefix={<DeleteOutline style={{ fontSize: '18px', color: '#faad14' }} />}
              extra={<span style={{ fontSize: '14px', color: '#999' }}>12.3 MB</span>}
              arrow={<RightOutline style={{ fontSize: '14px', color: '#ccc' }} />}
              onClick={handleClearCache}
              clickable
            >
              清除缓存
            </List.Item>
            <List.Item
              prefix={<ContentOutline style={{ fontSize: '18px', color: '#999' }} />}
              extra={<span style={{ fontSize: '14px', color: '#999' }}>自动</span>}
              clickable
              onClick={() => { Toast.show({ content: '当前为自动同步模式' }) }}
            >
              数据同步
            </List.Item>
          </List>
        </div>
      </div>

      {/* Pickers */}
      <Picker
        columns={LANGUAGE_OPTIONS}
        visible={showLangPicker}
        onClose={() => { setShowLangPicker(false) }}
        value={[language]}
        onConfirm={(val) => {
          if (val[0]) {
            setLanguage(val[0] as string)
            Toast.show({ content: '语言已切换', icon: 'success' })
          }
        }}
      />
      <Picker
        columns={FONT_SIZE_OPTIONS}
        visible={showFontPicker}
        onClose={() => { setShowFontPicker(false) }}
        value={[fontSize]}
        onConfirm={(val) => {
          if (val[0]) {
            setFontSize(val[0] as string)
            Toast.show({ content: '字体大小已更新', icon: 'success' })
          }
        }}
      />
      <Picker
        columns={CURRENCY_OPTIONS}
        visible={showCurrencyPicker}
        onClose={() => { setShowCurrencyPicker(false) }}
        value={[currency]}
        onConfirm={(val) => {
          if (val[0]) {
            setCurrency(val[0] as string)
            Toast.show({ content: '默认货币已更新', icon: 'success' })
          }
        }}
      />
    </div>
  )
}

export default GeneralSettings
