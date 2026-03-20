import { useState, useEffect } from 'react'
import { NavBar, Card, Form, Input, Button, Toast, ImageUploader, TextArea } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { ContentOutline, TruckOutline, FileOutline, EditSOutline } from 'antd-mobile-icons'
import { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import { warehouseApi } from '../../api'

// 退运原因类型
type ReturnReason =
  | 'CUSTOMER_CANCEL'
  | 'DAMAGED'
  | 'CUSTOMS_REJECT'
  | 'DELIVERY_FAILED'
  | 'CUSTOMER_REJECT'
  | 'QUALITY_ISSUE'
  | 'ADDRESS_ERROR'

// 退运任务详情
interface ReturnTaskDetail {
  id: string
  orderNo: string
  customerName: string
  returnReason: ReturnReason
  reasonDetail: string
  pieces: number
  weight: number
  volume?: number
  currentLocation: string
  applyTime: string
  applicant: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED'
  priority: 'high' | 'normal'
  // 退运信息（待填写）
  expressCompany?: string
  expressNo?: string
  recipientName?: string
  recipientPhone?: string
  recipientAddress?: string
  photos?: string[]
  documents?: string[]
  remark?: string
}

const ReturnDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [form] = Form.useForm()
  const [taskDetail, setTaskDetail] = useState<ReturnTaskDetail | null>(null)
  const [photoList, setPhotoList] = useState<ImageUploadItem[]>([])
  const [documentList, setDocumentList] = useState<ImageUploadItem[]>([])

  // 从 API 加载退运详情
  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return
      try {
        const res: any = await warehouseApi.listReturns()
        const all = Array.isArray(res) ? res : (res?.data || [])
        const found = all.find((item: any) => item.id === id)
        if (found) {
          setTaskDetail(found)
        } else {
          Toast.show({ icon: 'fail', content: '未找到退运详情' })
        }
      } catch (e: any) {
        Toast.show({ icon: 'fail', content: '获取退运详情失败' })
      }
    }
    fetchDetail()
  }, [id])

  const getReturnReasonText = (reason: ReturnReason) => {
    const reasonMap = {
      CUSTOMER_CANCEL: '客户取消',
      DAMAGED: '货物破损',
      CUSTOMS_REJECT: '报关退回',
      DELIVERY_FAILED: '配送失败',
      CUSTOMER_REJECT: '客户拒收',
      QUALITY_ISSUE: '质量问题',
      ADDRESS_ERROR: '地址错误'
    }
    return reasonMap[reason]
  }

  const getReturnReasonColor = (reason: ReturnReason) => {
    const colorMap = {
      CUSTOMER_CANCEL: { color: '#faad14', bg: '#fffbeb' },
      DAMAGED: { color: '#ff4d4f', bg: '#fff1f0' },
      CUSTOMS_REJECT: { color: '#722ed1', bg: '#f9f0ff' },
      DELIVERY_FAILED: { color: '#ff4d4f', bg: '#fff1f0' },
      CUSTOMER_REJECT: { color: '#faad14', bg: '#fffbeb' },
      QUALITY_ISSUE: { color: '#ff4d4f', bg: '#fff1f0' },
      ADDRESS_ERROR: { color: '#faad14', bg: '#fffbeb' }
    }
    return colorMap[reason]
  }

  // 模拟图片上传
  const mockUpload = async (file: File) => {
    return {
      url: URL.createObjectURL(file)
    }
  }

  // 提交退运信息
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (!id) return

      const photos = [
        ...photoList.map(f => f.url),
        ...documentList.map(f => f.url)
      ].filter(Boolean)

      await warehouseApi.updateReturn(id, {
        expressCompany: values.expressCompany,
        trackingNo: values.expressNo,
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone,
        recipientAddress: values.recipientAddress,
        photos,
        remark: values.remark || null,
        status: 'PROCESSING'
      })

      Toast.show({ content: '退运信息已提交', icon: 'success' })
      setTimeout(() => {
        navigate('/task-hub?tab=return')
      }, 1000)
    } catch (error: any) {
      if (error?.errorFields) return
      Toast.show({ content: error.message || '提交失败', icon: 'fail' })
    }
  }

  if (!taskDetail) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)}>退运详情</NavBar>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>加载中...</div>
      </div>
    )
  }

  const reasonColor = getReturnReasonColor(taskDetail.returnReason)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>退运详情</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 订单基本信息 */}
        <Card
          title={<><ContentOutline style={{ fontSize: '16px' }} /> 订单信息</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ fontSize: '13px', lineHeight: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{taskDetail.orderNo}</span>
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: reasonColor.color,
                background: reasonColor.bg
              }}>
                {getReturnReasonText(taskDetail.returnReason)}
              </span>
            </div>
            <div style={{ color: '#666' }}>客户：{taskDetail.customerName}</div>
            <div style={{ color: '#666' }}>
              件数：{taskDetail.pieces} 件 · 重量：{taskDetail.weight} kg
              {taskDetail.volume && ` · 体积：${taskDetail.volume} m³`}
            </div>
            <div style={{ color: '#666' }}>当前位置：{taskDetail.currentLocation}</div>

            {/* 退运原因 */}
            <div style={{
              marginTop: '12px',
              padding: '8px',
              background: '#fffbeb',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '12px', color: '#faad14', marginBottom: '4px', fontWeight: 'bold' }}>
                退运原因
              </div>
              <div style={{ color: '#666' }}>
                {taskDetail.reasonDetail}
              </div>
            </div>

            <div style={{ marginTop: '12px', fontSize: '12px', color: '#999', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
              申请人：{taskDetail.applicant} · {taskDetail.applyTime}
            </div>
          </div>
        </Card>

        {/* 退运信息表单 */}
        <Card
          title={<><TruckOutline style={{ fontSize: '16px' }} /> 退运信息</>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Form
            form={form}
            layout="horizontal"
            style={{ '--border-top': 'none' }}
          >
            <Form.Item
              name="expressCompany"
              label="快递公司"
              rules={[{ required: true, message: '请输入快递公司' }]}
            >
              <Input placeholder="例如：顺丰速运" />
            </Form.Item>

            <Form.Item
              name="expressNo"
              label="快递单号"
              rules={[{ required: true, message: '请输入快递单号' }]}
            >
              <Input placeholder="请输入快递单号" />
            </Form.Item>
          </Form>
        </Card>

        {/* 收货信息 */}
        <Card
          title="收货信息"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Form
            form={form}
            layout="horizontal"
            style={{ '--border-top': 'none' }}
          >
            <Form.Item
              name="recipientName"
              label="收货人"
              rules={[{ required: true, message: '请输入收货人姓名' }]}
            >
              <Input placeholder="请输入收货人姓名" />
            </Form.Item>

            <Form.Item
              name="recipientPhone"
              label="联系电话"
              rules={[{ required: true, message: '请输入联系电话' }]}
            >
              <Input placeholder="请输入联系电话" type="tel" />
            </Form.Item>

            <Form.Item
              name="recipientAddress"
              label="收货地址"
              rules={[{ required: true, message: '请输入收货地址' }]}
            >
              <TextArea
                placeholder="请输入详细收货地址"
                rows={3}
                maxLength={200}
                showCount
              />
            </Form.Item>
          </Form>
        </Card>

        {/* 照片上传 */}
        <Card
          title="货物照片"
          extra={<span style={{ fontSize: '12px', color: '#999' }}>选填</span>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
            上传货物照片，便于记录货物状态
          </div>
          <ImageUploader
            value={photoList}
            onChange={setPhotoList}
            upload={mockUpload}
            maxCount={9}
          />
        </Card>

        {/* 单据上传 */}
        <Card
          title={<><FileOutline style={{ fontSize: '16px' }} /> 相关单据</>}
          extra={<span style={{ fontSize: '12px', color: '#999' }}>选填</span>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '12px' }}>
            上传退运相关单据（如退货单、签收单等）
          </div>
          <ImageUploader
            value={documentList}
            onChange={setDocumentList}
            upload={mockUpload}
            maxCount={5}
          />
        </Card>

        {/* 备注 */}
        <Card
          title={<><EditSOutline style={{ fontSize: '16px' }} /> 备注信息</>}
          extra={<span style={{ fontSize: '12px', color: '#999' }}>选填</span>}
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Form
            form={form}
            layout="horizontal"
            style={{ '--border-top': 'none' }}
          >
            <Form.Item name="remark">
              <TextArea
                placeholder="请输入备注信息"
                rows={3}
                maxLength={200}
                showCount
              />
            </Form.Item>
          </Form>
        </Card>
      </div>

      {/* 底部固定按钮 */}
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
            '--border-radius': '8px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          提交退运信息
        </Button>
      </div>
    </div>
  )
}

export default ReturnDetail
