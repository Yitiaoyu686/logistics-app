import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  NavBar,
  Form,
  Input,
  Radio,
  Button,
  Card,
  ImageUploader,
  TextArea,
  Toast,
  Space,
  SpinLoading
} from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import { orderApi, warehouseApi } from '@/api'

interface OrderInfo {
  subOrderId: string
  masterOrderId: string
  orderNo: string
  customerName: string
  clientCode: string
  trackingNo: string
  destination: string
  productName: string
  expectedPieces: number
}

const InboundForm = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const subId = searchParams.get('subId')
  const masterId = searchParams.get('masterId')

  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<ImageUploadItem[]>([])
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 加载订单信息
  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true)
      try {
        if (subId) {
          // 通过子订单 ID 获取
          const res: any = await orderApi.getSub(subId)
          const sub = res?.data || res
          if (sub) {
            setOrderInfo({
              subOrderId: sub.id,
              masterOrderId: sub.masterOrderId,
              orderNo: sub.subOrderNo || sub.id,
              customerName: sub.consignee || '-',
              clientCode: sub.masterOrderId?.slice(0, 8) || '',
              trackingNo: sub.expressTrackingNo || code || '',
              destination: `${sub.destCountry || ''}-${sub.destCity || ''}`,
              productName: sub.goodsDescription || '-',
              expectedPieces: sub.pieces || 0
            })
          }
        } else if (masterId) {
          // 通过主订单 ID 获取
          const res: any = await orderApi.getMaster(masterId)
          const master = res?.data || res
          if (master) {
            // 如果有子订单使用第一个，否则用主订单信息
            const firstSub = master.subOrders?.[0]
            setOrderInfo({
              subOrderId: firstSub?.id || master.id,
              masterOrderId: master.id,
              orderNo: master.orderNo || master.id,
              customerName: master.customerName || '-',
              clientCode: master.customerId?.slice(0, 8) || '',
              trackingNo: firstSub?.expressTrackingNo || code || '',
              destination: `${master.destCountry || ''}-${master.destCity || ''}`,
              productName: master.items?.[0]?.name || '-',
              expectedPieces: master.totalPieces || 0
            })
          }
        } else if (code) {
          // 通过搜索查找
          const res: any = await orderApi.search(code)
          const data = res?.data || res
          const subs = data?.subOrders || []
          const masters = data?.masterOrders || []

          if (subs.length > 0) {
            const sub = subs[0]
            setOrderInfo({
              subOrderId: sub.id,
              masterOrderId: sub.masterOrderId,
              orderNo: sub.subOrderNo || sub.id,
              customerName: sub.consignee || '-',
              clientCode: sub.masterOrderId?.slice(0, 8) || '',
              trackingNo: sub.expressTrackingNo || code,
              destination: `${sub.destCountry || ''}-${sub.destCity || ''}`,
              productName: sub.goodsDescription || '-',
              expectedPieces: sub.pieces || 0
            })
          } else if (masters.length > 0) {
            const master = masters[0]
            setOrderInfo({
              subOrderId: master.id,
              masterOrderId: master.id,
              orderNo: master.orderNo || master.id,
              customerName: master.customerName || '-',
              clientCode: master.customerId?.slice(0, 8) || '',
              trackingNo: code,
              destination: `${master.destCountry || ''}-${master.destCity || ''}`,
              productName: '-',
              expectedPieces: master.totalPieces || 0
            })
          } else {
            Toast.show({ icon: 'fail', content: '未找到匹配订单' })
          }
        }
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: e.message || '加载订单信息失败' })
      } finally {
        setLoading(false)
      }
    }
    fetchOrder()
  }, [code, subId, masterId])

  const handleSubmit = async () => {
    if (!orderInfo) {
      Toast.show({ icon: 'fail', content: '订单信息未加载' })
      return
    }

    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const photos = fileList.map(f => f.url).filter(Boolean) as string[]

      const inboundData = {
        subOrderId: orderInfo.subOrderId,
        masterOrderId: orderInfo.masterOrderId,
        trackingNo: orderInfo.trackingNo || code || '',
        expressCompany: '快递公司', // 可根据 tracking 号前缀自动识别
        clientCode: orderInfo.clientCode,
        clientName: orderInfo.customerName,
        pieces: Number(values.pieces) || orderInfo.expectedPieces,
        actualWeight: Number(values.weight) || 0,
        actualVolume: 0,
        packageCondition: values.status === 'good' ? 'GOOD' : values.status === 'damaged' ? 'DAMAGED' : values.status === 'wet' ? 'WET' : 'OPENED',
        inboundMethod: 'SCAN',
        warehouseLocation: values.dimensions || null,
        warehouse: 'CN',
        operator: user.name || '仓管员',
        photos: photos.length > 0 ? photos : null,
        remark: values.remark || null
      }

      const res: any = await warehouseApi.createInbound(inboundData)
      const record = res?.data || res

      Toast.show({ content: '入库成功！', icon: 'success' })

      // 跳转到成功页，传递实际数据
      setTimeout(() => {
        navigate('/inbound/success', {
          state: {
            orderNo: orderInfo.orderNo,
            trackingNo: orderInfo.trackingNo,
            customerName: orderInfo.customerName,
            destination: orderInfo.destination,
            productName: orderInfo.productName,
            pieces: Number(values.pieces) || orderInfo.expectedPieces,
            weight: Number(values.weight) || 0,
            inboundId: record?.id,
            barcode: record?.id || orderInfo.subOrderId
          }
        })
      }, 800)
    } catch (error: any) {
      if (error?.errorFields) {
        Toast.show({ content: '请完整填写表单', icon: 'fail' })
      } else {
        Toast.show({ content: error.message || '入库失败', icon: 'fail' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>入库信息</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <SpinLoading style={{ '--size': '32px' }} />
          <div style={{ marginTop: '12px', color: '#999' }}>加载订单信息...</div>
        </div>
      </div>
    )
  }

  if (!orderInfo) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>入库信息</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
          未找到订单信息
          <div style={{ marginTop: '16px' }}>
            <Button color="primary" onClick={() => navigate('/inbound/scan')}>返回扫码</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>入库信息</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 订单信息卡片 */}
        <Card
          title="订单信息"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>订单号</span>
              <span style={{ fontWeight: 'bold' }}>{orderInfo.orderNo}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>客户</span>
              <span>{orderInfo.customerName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>快递单号</span>
              <span>{orderInfo.trackingNo || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#999' }}>目的地</span>
              <span>{orderInfo.destination}</span>
            </div>
          </Space>
        </Card>

        {/* 入库表单 */}
        <Card
          title="入库信息"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Form
            form={form}
            layout="horizontal"
            footer={null}
          >
            <Form.Item
              name="weight"
              label="实际重量"
              rules={[{ required: true, message: '请输入重量' }]}
            >
              <Input placeholder="请输入重量(kg)" type="number" />
            </Form.Item>

            <Form.Item
              name="pieces"
              label="实际件数"
              rules={[{ required: true, message: '请输入件数' }]}
              initialValue={orderInfo.expectedPieces > 0 ? String(orderInfo.expectedPieces) : undefined}
            >
              <Input placeholder="请输入件数" type="number" />
            </Form.Item>

            <Form.Item
              name="status"
              label="货物状态"
              rules={[{ required: true, message: '请选择货物状态' }]}
              initialValue="good"
            >
              <Radio.Group>
                <Space direction="vertical">
                  <Radio value="good">完好</Radio>
                  <Radio value="damaged">损坏</Radio>
                  <Radio value="wet">潮湿</Radio>
                  <Radio value="opened">开箱</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              name="dimensions"
              label="库位"
              help="选填，例如 A区-03排-12架"
            >
              <Input placeholder="请输入库位位置" />
            </Form.Item>

            <Form.Item
              name="photos"
              label="拍照上传"
            >
              <ImageUploader
                value={fileList}
                onChange={setFileList}
                upload={async (file) => {
                  return {
                    url: URL.createObjectURL(file),
                  }
                }}
                maxCount={5}
              />
            </Form.Item>

            <Form.Item
              name="remark"
              label="备注说明"
            >
              <TextArea
                placeholder="请输入备注"
                rows={3}
                maxLength={200}
                showCount
              />
            </Form.Item>
          </Form>
        </Card>
      </div>

      {/* 底部按钮 */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        background: 'white',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)'
      }}>
        <Button
          block
          color="primary"
          size="large"
          loading={submitting}
          onClick={handleSubmit}
          style={{ '--border-radius': '8px' }}
        >
          确认入库
        </Button>
      </div>
    </div>
  )
}

export default InboundForm
