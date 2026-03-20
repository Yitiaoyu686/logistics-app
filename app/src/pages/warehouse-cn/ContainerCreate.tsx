import { useState, useEffect } from 'react'
import { Form, Input, Button, NavBar, Selector, Toast, Modal } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircleOutline } from 'antd-mobile-icons'
import { warehouseApi } from '../../api'

// 运输方式
type TransportMode = 'SEA' | 'AIR'

// 集装箱类型
type ContainerType = '20GP' | '40GP' | '40HQ' | '45HQ'

// 集装箱数据
interface ContainerData {
  id?: string
  jobNo: string
  transportMode: TransportMode
  containerNo: string
  containerType: ContainerType
  route: string
  etd: string
  maxWeight: number
  maxVolume: number
}

const ContainerCreate = () => {
  const navigate = useNavigate()
  const { containerId } = useParams()
  const [form] = Form.useForm()
  const [transportMode, setTransportMode] = useState<TransportMode>('SEA')
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [createdContainerId, setCreatedContainerId] = useState<string>('')

  // 如果是编辑模式，从API加载现有数据
  useEffect(() => {
    if (containerId) {
      const fetchUnit = async () => {
        try {
          const res: any = await warehouseApi.listUnits({ id: containerId })
          const list = Array.isArray(res) ? res : (res?.data || [])
          const found = list.find((u: any) => String(u.id) === String(containerId))
          if (found) {
            form.setFieldsValue(found)
            setTransportMode(found.transportMode || 'SEA')
          } else {
            Toast.show({ icon: 'fail', content: '未找到运输单元' })
          }
        } catch (err) {
          Toast.show({ icon: 'fail', content: '获取运输单元失败' })
        }
      }
      fetchUnit()
    }
  }, [containerId])

  const [submitting, setSubmitting] = useState(false)

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (containerId) {
        // 编辑模式
        await warehouseApi.updateUnit(containerId, {
          unitNo: values.containerNo,
          unitType: values.containerType || 'LOOSE',
          transportMode,
          maxWeight: Number(values.maxWeight),
          maxVolume: Number(values.maxVolume),
          jobNo: values.jobNo,
          remark: values.route ? `路线:${values.route} ETD:${values.etd}` : null,
        })
        Toast.show({ icon: 'success', content: '运输单元已更新' })
        setTimeout(() => navigate(-1), 1000)
      } else {
        // 创建模式
        const res: any = await warehouseApi.createUnit({
          unitNo: values.containerNo,
          unitType: values.containerType || (transportMode === 'AIR' ? 'LOOSE' : '20GP'),
          transportMode,
          maxWeight: Number(values.maxWeight),
          maxVolume: Number(values.maxVolume),
          warehouse: 'CN',
          jobNo: values.jobNo,
          remark: values.route ? `路线:${values.route} ETD:${values.etd}` : null,
        })
        const created = res?.data || res
        Toast.show({ icon: 'success', content: '运输单元已创建' })
        setCreatedContainerId(created?.id || 'new')
        setShowSuccessModal(true)
      }
    } catch (error: any) {
      if (error?.errorFields) return
      Toast.show({ icon: 'fail', content: error.message || '操作失败' })
    } finally {
      setSubmitting(false)
    }
  }

  // 删除运输单元
  const handleDelete = async () => {
    const result = window.confirm('确定要删除这个运输单元吗？删除后将无法恢复。')
    if (result && containerId) {
      try {
        await warehouseApi.deleteUnit(containerId)
        Toast.show({ content: '运输单元已删除', icon: 'success' })
        setTimeout(() => navigate(-1), 1000)
      } catch (e: any) {
        Toast.show({ content: e.message || '删除失败', icon: 'fail' })
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>
        {containerId ? '编辑运输单元' : '创建运输单元'}
      </NavBar>

      <div style={{ padding: '16px' }}>
        <Form
          form={form}
          layout="horizontal"
          style={{ '--border-top': 'none' }}
        >
          {/* 运输方式选择 */}
          <Form.Header>运输方式</Form.Header>
          <Selector
            value={[transportMode]}
            onChange={(val) => setTransportMode(val[0] as TransportMode)}
            options={[
              { label: '海运', value: 'SEA' },
              { label: '空运', value: 'AIR' }
            ]}
            style={{ marginBottom: '16px' }}
          />

          {/* 基本信息 */}
          <Form.Header>基本信息</Form.Header>
          <Form.Item
            name="jobNo"
            label="任务号"
            rules={[{ required: true, message: '请输入任务号' }]}
          >
            <Input placeholder="请输入任务号" />
          </Form.Item>

          <Form.Item
            name="containerNo"
            label={transportMode === 'SEA' ? '集装箱号' : '航班号'}
            rules={[{ required: true, message: `请输入${transportMode === 'SEA' ? '集装箱号' : '航班号'}` }]}
          >
            <Input placeholder={`请输入${transportMode === 'SEA' ? '集装箱号' : '航班号'}`} />
          </Form.Item>

          {transportMode === 'SEA' && (
            <Form.Item
              name="containerType"
              label="集装箱类型"
              rules={[{ required: true, message: '请选择集装箱类型' }]}
            >
              <Selector
                options={[
                  { label: '20GP', value: '20GP' },
                  { label: '40GP', value: '40GP' },
                  { label: '40HQ', value: '40HQ' },
                  { label: '45HQ', value: '45HQ' }
                ]}
              />
            </Form.Item>
          )}

          <Form.Item
            name="route"
            label="路线"
            rules={[{ required: true, message: '请输入路线' }]}
          >
            <Input placeholder="例如：广州 → 拉各斯" />
          </Form.Item>

          <Form.Item
            name="etd"
            label="预计发运日期"
            rules={[{ required: true, message: '请输入预计发运日期' }]}
          >
            <Input placeholder="例如：2026-02-15" type="date" />
          </Form.Item>

          {/* 容量限制 */}
          <Form.Header>容量限制</Form.Header>
          <Form.Item
            name="maxWeight"
            label="最大重量(kg)"
            rules={[{ required: true, message: '请输入最大重量' }]}
          >
            <Input placeholder="请输入最大重量" type="number" />
          </Form.Item>

          <Form.Item
            name="maxVolume"
            label="最大体积(m³)"
            rules={[{ required: true, message: '请输入最大体积' }]}
          >
            <Input placeholder="请输入最大体积" type="number" />
          </Form.Item>
        </Form>
      </div>

      {/* 底部操作按钮 */}
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
        {containerId ? (
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              color="danger"
              size="large"
              onClick={handleDelete}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                flex: 1
              }}
            >
              删除
            </Button>
            <Button
              color="primary"
              size="large"
              onClick={handleSubmit}
              style={{
                '--border-radius': '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                flex: 1
              }}
            >
              保存
            </Button>
          </div>
        ) : (
          <Button
            block
            color="primary"
            size="large"
            loading={submitting}
            onClick={handleSubmit}
            style={{
              '--border-radius': '8px',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            创建运输单元
          </Button>
        )}
      </div>

      {/* 创建成功弹窗 */}
      <Modal
        visible={showSuccessModal}
        content={
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}><CheckCircleOutline style={{ fontSize: '48px', color: '#52c41a' }} /></div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
              创建成功
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              运输单元已创建成功，是否立即前往装箱？
            </div>
          </div>
        }
        closeOnAction
        actions={[
          {
            key: 'cancel',
            text: '稍后再说',
            onClick: () => {
              setShowSuccessModal(false)
              navigate(-1)
            }
          },
          {
            key: 'confirm',
            text: '去装箱',
            primary: true,
            onClick: () => {
              setShowSuccessModal(false)
              navigate(`/packing/task/${createdContainerId}`)
            }
          }
        ]}
      />
    </div>
  )
}

export default ContainerCreate
