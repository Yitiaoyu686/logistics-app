import { useState } from 'react'
import { Modal, Form, Input, Button, ImageUploader, Radio, Toast } from 'antd-mobile'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'
import type { ContainerOrder } from '@/types/warehouse-us'

interface InboundModalProps {
  visible: boolean
  order: ContainerOrder | null
  onClose: () => void
  onConfirm: (data: InboundData) => void
}

export interface InboundData {
  orderId: string
  actualPieces: number
  condition: 'GOOD' | 'DAMAGED' | 'SHORT'
  photos: string[]
  remark?: string
}

const InboundModal = ({ visible, order, onClose, onConfirm }: InboundModalProps) => {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<ImageUploadItem[]>([])

  if (!order) return null

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields()

      const data: InboundData = {
        orderId: order.id,
        actualPieces: values.actualPieces,
        condition: values.condition,
        photos: fileList.map(item => item.url),
        remark: values.remark
      }

      onConfirm(data)
      form.resetFields()
      setFileList([])
    } catch (error) {
      console.error('表单验证失败:', error)
    }
  }

  const handleClose = () => {
    form.resetFields()
    setFileList([])
    onClose()
  }

  return (
    <Modal
      visible={visible}
      title="扫码入库"
      content={
        <div style={{ padding: '16px 0' }}>
          {/* 订单信息 */}
          <div style={{
            padding: '12px',
            background: '#f5f5f5',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            lineHeight: '1.8'
          }}>
            <div><strong>订单号：</strong>{order.subOrderNo}</div>
            <div><strong>客户：</strong>{order.customerName}</div>
            <div><strong>预计件数：</strong>{order.pieces}件</div>
            <div><strong>重量：</strong>{order.weight}kg</div>
          </div>

          <Form
            form={form}
            layout="vertical"
            initialValues={{
              actualPieces: order.pieces,
              condition: 'GOOD'
            }}
          >
            {/* 实际件数 */}
            <Form.Item
              name="actualPieces"
              label="实际件数"
              rules={[
                { required: true, message: '请输入实际件数' },
                { type: 'number', min: 0, message: '件数不能小于0' }
              ]}
            >
              <Input type="number" placeholder="请输入实际件数" />
            </Form.Item>

            {/* 货物状态 */}
            <Form.Item
              name="condition"
              label="货物状态"
              rules={[{ required: true, message: '请选择货物状态' }]}
            >
              <Radio.Group>
                <Radio value="GOOD">完好</Radio>
                <Radio value="DAMAGED">破损</Radio>
                <Radio value="SHORT">短少</Radio>
              </Radio.Group>
            </Form.Item>

            {/* 照片上传 */}
            <Form.Item label="货物照片">
              <ImageUploader
                value={fileList}
                onChange={setFileList}
                upload={async (file) => {
                  // 模拟上传，实际应该调用上传接口
                  return {
                    url: URL.createObjectURL(file)
                  }
                }}
                maxCount={5}
              />
            </Form.Item>

            {/* 备注 */}
            <Form.Item name="remark" label="备注">
              <Input.TextArea
                placeholder="请输入备注信息"
                rows={3}
                maxLength={200}
                showCount
              />
            </Form.Item>
          </Form>
        </div>
      }
      closeOnAction
      onClose={handleClose}
      actions={[
        {
          key: 'cancel',
          text: '取消',
          onClick: handleClose
        },
        {
          key: 'confirm',
          text: '确认入库',
          primary: true,
          onClick: handleConfirm
        }
      ]}
    />
  )
}

export default InboundModal
