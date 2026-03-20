import { useState, useEffect, useRef } from 'react'
import {
  NavBar, Card, Form, Input, Picker, Button, Toast, Steps,
  Popup, Stepper, TextArea, Tag, Dialog, Selector
} from 'antd-mobile'
import {
  ScanCodeOutline, AddOutline, CloseOutline
} from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { clientApi, orderApi } from '@/api'
import type { SalesCustomer } from '@/types/sales'
import { DESTINATIONS, EXPRESS_COMPANIES, CARGO_CATEGORIES } from '@/data/destinations'

const { Step } = Steps

interface PackageItem {
  courier: string
  trackingNo: string
  itemName: string
  pieces: number
  weight: number
  declaredValue: number
}

const emptyPackage: PackageItem = {
  courier: '',
  trackingNo: '',
  itemName: '',
  pieces: 1,
  weight: 0,
  declaredValue: 0,
}

const SalesOrderCreate = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [customerVisible, setCustomerVisible] = useState(false)
  const [countryVisible, setCountryVisible] = useState(false)
  const [cityVisible, setCityVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [customers, setCustomers] = useState<SalesCustomer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [packages, setPackages] = useState<PackageItem[]>([])
  const [addVisible, setAddVisible] = useState(false)
  const [newPackage, setNewPackage] = useState<PackageItem>({ ...emptyPackage })
  const [scannerVisible, setScannerVisible] = useState(false)
  const [courierPickerVisible, setCourierPickerVisible] = useState(false)
  const scannerRef = useRef<any>(null)

  const [formData, setFormData] = useState({
    customerName: '',
    customerId: '',
    destCountry: '',
    destCountryLabel: '',
    destCity: '',
    destCityLabel: '',
    shippingType: '' as string,
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    remark: '',
  })

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true)
        const res = await clientApi.list()
        setCustomers((res as any)?.data || [])
      } catch (e: any) {
        Toast.show({ content: e.message || '加载客户列表失败', icon: 'fail' })
      } finally {
        setLoadingCustomers(false)
      }
    }
    fetchCustomers()
  }, [])

  // 当前国家下的城市选项
  const cityColumns = (() => {
    const country = DESTINATIONS.find(d => d.value === formData.destCountry)
    if (!country) return [[]]
    return [country.cities.map(c => ({ label: c.label, value: c.value }))]
  })()

  // 统计
  const totalPieces = packages.reduce((s, p) => s + p.pieces, 0)
  const totalWeight = packages.reduce((s, p) => s + p.weight, 0)

  // 扫码
  const startScan = async () => {
    setScannerVisible(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      // 等待 DOM 渲染
      await new Promise(r => setTimeout(r, 300))
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (text: string) => {
          scanner.stop().catch(() => {})
          scannerRef.current = null
          setScannerVisible(false)
          setNewPackage({ ...emptyPackage, trackingNo: text })
          setAddVisible(true)
        },
        () => {}
      )
    } catch (err: any) {
      setScannerVisible(false)
      Toast.show({ content: '无法启动摄像头: ' + (err.message || err), icon: 'fail' })
    }
  }

  const stopScan = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    setScannerVisible(false)
  }

  // 添加包裹
  const handleAddPackage = () => {
    if (!newPackage.trackingNo) {
      Toast.show({ content: '请输入运单号', icon: 'fail' })
      return
    }
    if (packages.some(p => p.trackingNo === newPackage.trackingNo)) {
      Toast.show({ content: '运单号已存在', icon: 'fail' })
      return
    }
    setPackages([...packages, { ...newPackage }])
    setNewPackage({ ...emptyPackage })
    setAddVisible(false)
    Toast.show({ content: '已添加', icon: 'success' })
  }

  // 删除包裹
  const handleDeletePackage = (index: number) => {
    Dialog.confirm({
      content: '确定删除此包裹？',
      onConfirm: () => {
        setPackages(packages.filter((_, i) => i !== index))
      },
    })
  }

  // 步骤验证
  const handleNext = () => {
    if (currentStep === 0) {
      if (!formData.customerName || !formData.destCountry || !formData.destCity || !formData.shippingType) {
        Toast.show({ content: '请填写必填项', icon: 'fail' })
        return
      }
      if (!formData.recipientName || !formData.recipientPhone) {
        Toast.show({ content: '请填写收件人信息', icon: 'fail' })
        return
      }
    }
    if (currentStep === 1) {
      if (packages.length === 0) {
        Toast.show({ content: '请至少添加一个快递包裹', icon: 'fail' })
        return
      }
    }
    setCurrentStep(currentStep + 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      await orderApi.createMaster({
        customerId: formData.customerId,
        customerName: formData.customerName,
        sender: user.name || '发件人',
        consignee: formData.recipientName,
        consigneePhone: formData.recipientPhone,
        destCountry: formData.destCountry,
        destCity: formData.destCity,
        destAddress: formData.recipientAddress,
        transportType: formData.shippingType === '海运' ? 'SEA' : 'AIR',
        totalPieces,
        totalWeight,
        salesPerson: user.name,
        remark: formData.remark,
        expressPackages: packages.map(p => ({
          courier: p.courier,
          trackingNo: p.trackingNo,
          itemName: p.itemName,
          pieces: p.pieces,
          weight: p.weight,
          declaredValue: p.declaredValue,
        })),
      })
      Toast.show({ content: '订单创建成功', icon: 'success' })
      navigate('/sales/task-hub?tab=orders')
    } catch (e: any) {
      Toast.show({ content: e.message || '创建订单失败', icon: 'fail' })
    } finally {
      setSubmitting(false)
    }
  }

  // Step 0: 基本信息+收件人
  const renderStep0 = () => (
    <>
      <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>基本信息</div>
        <Form layout="vertical">
          <Form.Item label="客户" required onClick={() => setCustomerVisible(true)}>
            <Input
              placeholder={loadingCustomers ? '加载客户列表中...' : '请选择客户'}
              value={formData.customerName}
              readOnly
            />
          </Form.Item>
          <Picker
            columns={[customers.map(c => ({ label: `${c.name} (${c.shortCode})`, value: c.id }))]}
            visible={customerVisible}
            onClose={() => setCustomerVisible(false)}
            onConfirm={v => {
              const cust = customers.find(c => c.id === v[0])
              if (cust) setFormData(d => ({ ...d, customerName: cust.name, customerId: cust.id }))
            }}
          />

          <Form.Item label="运输方式" required>
            <Selector
              options={[
                { label: '海运', value: '海运' },
                { label: '空运', value: '空运' },
              ]}
              value={formData.shippingType ? [formData.shippingType] : []}
              onChange={v => {
                if (v.length > 0) setFormData(d => ({ ...d, shippingType: v[0] }))
              }}
              style={{ '--border-radius': '8px' }}
            />
          </Form.Item>

          <Form.Item label="目的国家" required onClick={() => setCountryVisible(true)}>
            <Input
              placeholder="请选择目的国家"
              value={formData.destCountryLabel}
              readOnly
            />
          </Form.Item>
          <Picker
            columns={[DESTINATIONS.map(d => ({ label: d.label, value: d.value }))]}
            visible={countryVisible}
            onClose={() => setCountryVisible(false)}
            onConfirm={v => {
              const country = DESTINATIONS.find(d => d.value === v[0])
              if (country) {
                setFormData(d => ({
                  ...d,
                  destCountry: country.value,
                  destCountryLabel: country.label,
                  destCity: '',
                  destCityLabel: '',
                }))
              }
            }}
          />

          <Form.Item label="目的城市" required onClick={() => {
            if (!formData.destCountry) {
              Toast.show({ content: '请先选择国家', icon: 'fail' })
              return
            }
            setCityVisible(true)
          }}>
            <Input
              placeholder={formData.destCountry ? '请选择城市' : '请先选择国家'}
              value={formData.destCityLabel}
              readOnly
            />
          </Form.Item>
          <Picker
            columns={cityColumns}
            visible={cityVisible}
            onClose={() => setCityVisible(false)}
            onConfirm={v => {
              const country = DESTINATIONS.find(d => d.value === formData.destCountry)
              const city = country?.cities.find(c => c.value === v[0])
              if (city) {
                setFormData(d => ({ ...d, destCity: city.value, destCityLabel: city.label }))
              }
            }}
          />

          <Form.Item label="备注">
            <TextArea
              placeholder="订单备注（选填）"
              value={formData.remark}
              onChange={v => setFormData(d => ({ ...d, remark: v }))}
              rows={2}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>收件人信息</div>
        <Form layout="vertical">
          <Form.Item label="收件人姓名" required>
            <Input
              placeholder="请输入收件人姓名"
              value={formData.recipientName}
              onChange={v => setFormData(d => ({ ...d, recipientName: v }))}
            />
          </Form.Item>
          <Form.Item label="收件人电话" required>
            <Input
              placeholder="请输入收件人电话"
              value={formData.recipientPhone}
              onChange={v => setFormData(d => ({ ...d, recipientPhone: v }))}
            />
          </Form.Item>
          <Form.Item label="收件地址">
            <TextArea
              placeholder="请输入详细收件地址"
              value={formData.recipientAddress}
              onChange={v => setFormData(d => ({ ...d, recipientAddress: v }))}
              rows={2}
            />
          </Form.Item>
        </Form>
      </Card>
    </>
  )

  // Step 1: 快递包裹
  const renderStep1 = () => (
    <>
      {/* 统计 */}
      <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#11998e' }}>{packages.length}</div>
            <div style={{ fontSize: '12px', color: '#999' }}>包裹数</div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#11998e' }}>{totalPieces}</div>
            <div style={{ fontSize: '12px', color: '#999' }}>总件数</div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#11998e' }}>{totalWeight.toFixed(1)}</div>
            <div style={{ fontSize: '12px', color: '#999' }}>总重量(kg)</div>
          </div>
        </div>
      </Card>

      {/* 扫码 + 手动添加按钮 */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <Button
          block
          color="primary"
          size="large"
          style={{
            '--border-radius': '12px',
            '--background-color': '#11998e',
            '--border-color': '#11998e',
            flex: 1,
          }}
          onClick={startScan}
        >
          <ScanCodeOutline style={{ marginRight: 4 }} /> 扫码添加
        </Button>
        <Button
          block
          size="large"
          style={{ '--border-radius': '12px', flex: 1 }}
          onClick={() => {
            setNewPackage({ ...emptyPackage })
            setAddVisible(true)
          }}
        >
          <AddOutline style={{ marginRight: 4 }} /> 手动添加
        </Button>
      </div>

      {/* 已添加包裹列表 */}
      {packages.length === 0 ? (
        <Card style={{ borderRadius: '12px', textAlign: 'center', padding: '32px 0', color: '#999' }}>
          暂无包裹，请扫码或手动添加
        </Card>
      ) : (
        packages.map((pkg, index) => (
          <Card
            key={index}
            style={{ borderRadius: '12px', marginBottom: '8px' }}
            onClick={() => {}}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                  {pkg.trackingNo}
                </div>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  {pkg.courier && <Tag color="primary" fill="outline" style={{ marginRight: 4, fontSize: '11px' }}>{pkg.courier}</Tag>}
                  {pkg.itemName || '未命名'}
                  {' | '}
                  {pkg.pieces}件
                  {' | '}
                  {pkg.weight}kg
                </div>
              </div>
              <Button
                size="mini"
                fill="none"
                style={{ color: '#ff4d4f' }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeletePackage(index)
                }}
              >
                <CloseOutline />
              </Button>
            </div>
          </Card>
        ))
      )}

      {/* 扫码弹窗 */}
      <Popup
        visible={scannerVisible}
        onMaskClick={stopScan}
        bodyStyle={{ height: '60vh', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}
      >
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '12px' }}>扫描条形码/二维码</div>
          <div id="qr-reader" style={{ width: '100%' }} />
          <Button
            style={{ marginTop: '12px' }}
            onClick={stopScan}
          >
            取消扫码
          </Button>
        </div>
      </Popup>

      {/* 添加包裹弹窗 */}
      <Popup
        visible={addVisible}
        onMaskClick={() => setAddVisible(false)}
        bodyStyle={{
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          padding: '16px',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '16px', textAlign: 'center' }}>
          添加快递包裹
        </div>
        <Form layout="vertical">
          <Form.Item label="快递公司" onClick={() => setCourierPickerVisible(true)}>
            <Input
              placeholder="请选择快递公司"
              value={newPackage.courier}
              readOnly
            />
          </Form.Item>
          <Picker
            columns={[EXPRESS_COMPANIES.map(c => ({ label: c, value: c }))]}
            visible={courierPickerVisible}
            onClose={() => setCourierPickerVisible(false)}
            onConfirm={v => {
              if (v[0]) setNewPackage(p => ({ ...p, courier: v[0] as string }))
            }}
          />
          <Form.Item label="运单号" required>
            <Input
              placeholder="请输入运单号"
              value={newPackage.trackingNo}
              onChange={v => setNewPackage(p => ({ ...p, trackingNo: v }))}
            />
          </Form.Item>
          <Form.Item label="品名">
            <Input
              placeholder="请输入品名"
              value={newPackage.itemName}
              onChange={v => setNewPackage(p => ({ ...p, itemName: v }))}
            />
          </Form.Item>
          <Form.Item label="件数">
            <Stepper
              min={1}
              max={999}
              value={newPackage.pieces}
              onChange={v => setNewPackage(p => ({ ...p, pieces: v }))}
            />
          </Form.Item>
          <Form.Item label="重量(kg)">
            <Input
              type="number"
              placeholder="请输入重量"
              value={newPackage.weight ? String(newPackage.weight) : ''}
              onChange={v => setNewPackage(p => ({ ...p, weight: Number(v) || 0 }))}
            />
          </Form.Item>
          <Form.Item label="货值($)">
            <Input
              type="number"
              placeholder="选填"
              value={newPackage.declaredValue ? String(newPackage.declaredValue) : ''}
              onChange={v => setNewPackage(p => ({ ...p, declaredValue: Number(v) || 0 }))}
            />
          </Form.Item>
        </Form>
        <Button
          block
          color="primary"
          size="large"
          style={{ '--border-radius': '10px', '--background-color': '#11998e', '--border-color': '#11998e', marginTop: '8px' }}
          onClick={handleAddPackage}
        >
          确认添加
        </Button>
      </Popup>
    </>
  )

  // Step 2: 确认提交
  const renderStep2 = () => (
    <>
      <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>订单信息确认</div>
        <div style={{ fontSize: '13px', lineHeight: 2, color: '#333' }}>
          <div><span style={{ color: '#999' }}>客户：</span>{formData.customerName}</div>
          <div><span style={{ color: '#999' }}>运输方式：</span>{formData.shippingType}</div>
          <div><span style={{ color: '#999' }}>目的地：</span>{formData.destCountryLabel} - {formData.destCityLabel}</div>
          <div><span style={{ color: '#999' }}>收件人：</span>{formData.recipientName} {formData.recipientPhone}</div>
          {formData.recipientAddress && <div><span style={{ color: '#999' }}>地址：</span>{formData.recipientAddress}</div>}
          {formData.remark && <div><span style={{ color: '#999' }}>备注：</span>{formData.remark}</div>}
        </div>
      </Card>

      <Card style={{ borderRadius: '12px', marginBottom: '12px' }}>
        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
          快递包裹 ({packages.length}个)
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginBottom: '12px', padding: '8px', background: '#f5f5f5', borderRadius: '8px' }}>
          <div>
            <div style={{ fontWeight: 'bold', color: '#11998e' }}>{packages.length}</div>
            <div style={{ fontSize: '11px', color: '#999' }}>包裹</div>
          </div>
          <div>
            <div style={{ fontWeight: 'bold', color: '#11998e' }}>{totalPieces}</div>
            <div style={{ fontSize: '11px', color: '#999' }}>总件数</div>
          </div>
          <div>
            <div style={{ fontWeight: 'bold', color: '#11998e' }}>{totalWeight.toFixed(1)}</div>
            <div style={{ fontSize: '11px', color: '#999' }}>总重量(kg)</div>
          </div>
        </div>
        {packages.map((pkg, i) => (
          <div key={i} style={{ fontSize: '13px', color: '#666', padding: '4px 0', borderBottom: i < packages.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
            {pkg.courier} | {pkg.trackingNo} | {pkg.itemName || '-'} | {pkg.pieces}件 | {pkg.weight}kg
          </div>
        ))}
      </Card>
    </>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar
        onBack={() => {
          if (scannerVisible) {
            stopScan()
            return
          }
          if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
          } else {
            navigate(-1)
          }
        }}
        style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}
      >
        创建订单
      </NavBar>

      <div style={{ padding: '12px 16px' }}>
        <Steps current={currentStep} style={{ marginBottom: '16px' }}>
          <Step title="基本信息" />
          <Step title="快递包裹" />
          <Step title="确认提交" />
        </Steps>

        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
      </div>

      {/* 底部按钮 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 16px', background: '#fff',
        borderTop: '1px solid #f0f0f0', zIndex: 100,
      }}>
        {currentStep < 2 ? (
          <Button
            block
            color="primary"
            size="large"
            style={{ '--border-radius': '10px', '--background-color': '#11998e', '--border-color': '#11998e' }}
            onClick={handleNext}
          >
            下一步
          </Button>
        ) : (
          <Button
            block
            color="primary"
            size="large"
            loading={submitting}
            style={{ '--border-radius': '10px', '--background-color': '#11998e', '--border-color': '#11998e' }}
            onClick={handleSubmit}
          >
            提交订单
          </Button>
        )}
      </div>
    </div>
  )
}

export default SalesOrderCreate
