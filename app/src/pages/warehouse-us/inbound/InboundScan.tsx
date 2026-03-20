import { useState } from 'react'
import { Button, Card, Toast, NavBar, Form, Input, Radio, ImageUploader } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { ScanningOutline, InformationCircleOutline, ContentOutline } from 'antd-mobile-icons'
import { orderApi, warehouseApi } from '@/api'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'

interface MatchedOrder {
  subOrderId: string
  masterOrderId: string
  trackingNo: string
  expressCompany: string
  clientCode: string
  clientName: string
  expectedPieces: number
}

const mapConditionToPackage = (condition: 'GOOD' | 'DAMAGED' | 'SHORT') => {
  if (condition === 'DAMAGED') return 'DAMAGED'
  if (condition === 'SHORT') return 'INCOMPLETE'
  return 'GOOD'
}

const InboundScan = () => {
  const navigate = useNavigate()
  const [scannedCode, setScannedCode] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<ImageUploadItem[]>([])
  const [matchedOrder, setMatchedOrder] = useState<MatchedOrder | null>(null)

  const [manualInput, setManualInput] = useState('')

  const handleStartScan = async () => {
    // 扫码功能需要硬件支持，此处使用手动输入
    const keyword = manualInput.trim()
    if (!keyword) {
      Toast.show({ icon: 'fail', content: '请输入订单号或集装箱号' })
      return
    }

    try {
      const searchRes: any = await orderApi.search(keyword)
      const searchData = searchRes?.data || searchRes || {}
      let sub = Array.isArray(searchData.subOrders) ? searchData.subOrders[0] : null

      // 输入主单号时，搜索结果可能只有 masterOrders，需要再查一次子单
      if (!sub && Array.isArray(searchData.masterOrders) && searchData.masterOrders.length > 0) {
        const master = searchData.masterOrders[0]
        const subRes: any = await orderApi.listSub({ masterOrderId: master.id })
        const subList = subRes?.data || []
        sub = Array.isArray(subList) ? subList[0] : null
      }

      if (!sub) {
        Toast.show({ icon: 'fail', content: '未找到可入库子订单，请检查单号' })
        return
      }

      const masterRes: any = await orderApi.getMaster(sub.masterOrderId)
      const master = masterRes?.data || masterRes
      if (!master?.id) {
        Toast.show({ icon: 'fail', content: '未找到对应主订单' })
        return
      }

      const matched: MatchedOrder = {
        subOrderId: sub.id,
        masterOrderId: master.id,
        trackingNo: sub.expressTrackingNo || keyword,
        expressCompany: sub.expressCompany || 'UNKNOWN',
        clientCode: master.customerId || 'UNKNOWN',
        clientName: master.customerName || sub.consignee || '-',
        expectedPieces: Number(sub.pieces || 0),
      }

      setMatchedOrder(matched)
      setScannedCode(keyword)
      setShowForm(true)
      form.setFieldsValue({ actualPieces: matched.expectedPieces || 1, condition: 'GOOD' })
      Toast.show({ content: '查询成功', icon: 'success' })
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '查询失败' })
    }
  }

  const handleSubmit = async () => {
    if (!matchedOrder) {
      Toast.show({ icon: 'fail', content: '请先查询订单' })
      return
    }

    try {
      const values = await form.validateFields()
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const currentWarehouseId = localStorage.getItem('currentWarehouseId') || undefined
      try {
        await warehouseApi.createInbound({
          subOrderId: matchedOrder.subOrderId,
          masterOrderId: matchedOrder.masterOrderId,
          trackingNo: matchedOrder.trackingNo,
          expressCompany: matchedOrder.expressCompany,
          clientCode: matchedOrder.clientCode,
          clientName: matchedOrder.clientName,
          pieces: Number(values.actualPieces),
          actualWeight: 0,
          actualVolume: 0,
          packageCondition: mapConditionToPackage(values.condition),
          inboundMethod: 'SCAN',
          warehouseLocation: null,
          warehouse: 'US',
          warehouseId: currentWarehouseId,
          operator: user.name || '仓管员',
          photos: fileList.map(item => item.url).filter(Boolean),
          remark: values.remark || null,
        })
        Toast.show({ content: '入库成功', icon: 'success' })
        setTimeout(() => {
          navigate('/warehouse-us/task-hub?tab=stock')
        }, 1000)
      } catch (err: any) {
        Toast.show({ icon: 'fail', content: err.message || '入库失败' })
      }
    } catch (error) {
      console.error('表单验证失败：', error)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>扫码入库</NavBar>

      <div style={{ padding: '16px' }}>
        {!showForm ? (
          <>
            {/* 扫码区域 */}
            <Card
              style={{
                marginBottom: '16px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                textAlign: 'center',
                padding: '40px 20px'
              }}
            >
              <ScanningOutline style={{ fontSize: '80px', color: '#1677ff', marginBottom: '20px' }} />
              <div style={{ fontSize: '16px', color: '#333', marginBottom: '8px' }}>
                请输入订单号或集装箱号
              </div>
              <div style={{ fontSize: '13px', color: '#999' }}>
                支持订单号或集装箱号查询
              </div>
            </Card>

            {/* 输入框 */}
            <div style={{ marginBottom: '12px' }}>
              <Input
                placeholder="请输入订单号或集装箱号"
                value={manualInput}
                onChange={setManualInput}
                onEnterPress={handleStartScan}
                clearable
                style={{
                  '--font-size': '16px',
                  padding: '12px',
                  background: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #e5e5e5'
                }}
              />
            </div>

            {/* 操作按钮 */}
            <Button
              block
              color="primary"
              size="large"
              onClick={handleStartScan}
              style={{
                '--border-radius': '8px',
                marginBottom: '12px'
              }}
            >
              查询并入库
            </Button>

            {/* 提示信息 */}
            <Card
              style={{
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
                <InformationCircleOutline style={{ fontSize: '14px' }} /> 扫码提示
              </div>
              <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
                • 请对准订单号或集装箱号进行扫描<br />
                • 确保光线充足，条码清晰<br />
                • 扫码后需要填写实际到达信息<br />
                • 如有货物损坏或短少请及时拍照记录
              </div>
            </Card>
          </>
        ) : (
          <>
            {/* 入库信息表单 */}
            <Card
              style={{
                marginBottom: '16px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '16px' }}>
                <ContentOutline style={{ fontSize: '15px' }} /> {scannedCode}
              </div>

              <Form
                form={form}
                layout="horizontal"
                initialValues={{
                  condition: 'GOOD'
                }}
              >
                <Form.Item
                  name="actualPieces"
                  label="实际件数"
                  rules={[{ required: true, message: '请输入实际件数' }]}
                >
                  <Input type="number" placeholder="请输入实际到达件数" />
                </Form.Item>

                <Form.Item
                  name="condition"
                  label="货物状态"
                  rules={[{ required: true }]}
                >
                  <Radio.Group>
                    <Radio value="GOOD">完好</Radio>
                    <Radio value="DAMAGED">损坏</Radio>
                    <Radio value="SHORT">短少</Radio>
                  </Radio.Group>
                </Form.Item>

                <Form.Item
                  name="remark"
                  label="备注"
                >
                  <Input placeholder="选填，如有异常请说明" />
                </Form.Item>
              </Form>
            </Card>

            {/* 拍照上传 */}
            <Card
              style={{
                marginBottom: '16px',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>
                货物照片（选填）
              </div>
              <ImageUploader
                value={fileList}
                onChange={setFileList}
                upload={async (file) => {
                  // 模拟上传
                  return {
                    url: URL.createObjectURL(file)
                  }
                }}
                maxCount={3}
              />
              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                如有货物损坏或异常，请拍照记录
              </div>
            </Card>

            {/* 提交按钮 */}
            <Button
              block
              color="primary"
              size="large"
              onClick={handleSubmit}
              style={{
                '--border-radius': '8px'
              }}
            >
              确认入库
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default InboundScan
