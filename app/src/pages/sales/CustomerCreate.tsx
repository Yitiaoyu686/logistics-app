import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar, Form, Input, TextArea, Button, Toast } from 'antd-mobile'
import { clientApi } from '@/api'

const CustomerCreate = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      setSubmitting(true)

      const payload = {
        shortCode: values.shortCode?.trim() || undefined,
        name: values.name?.trim(),
        country: values.country?.trim(),
        address: values.address?.trim() || null,
        industry: values.industry?.trim() || null,
        contact: {
          name: values.contactName?.trim(),
          phone: values.contactPhone?.trim(),
          email: values.contactEmail?.trim() || undefined,
        },
        status: 'ACTIVE',
        poolType: 'PRIVATE',
        salesId: user?.id || null,
        source: 'APP_SALES',
        remark: values.remark?.trim() || null,
      }

      const res: any = await clientApi.create(payload)
      const created = res?.data || res
      Toast.show({ content: '客户创建成功', icon: 'success' })
      if (created?.id) {
        navigate(`/sales/customer/${created.id}`, { replace: true })
      } else {
        navigate('/sales/task-hub?tab=customers', { replace: true })
      }
    } catch (e: any) {
      if (e?.errorFields) return
      Toast.show({ content: e.message || '创建客户失败', icon: 'fail' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '88px' }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        新增客户
      </NavBar>

      <div style={{ padding: '12px 16px' }}>
        <Form
          form={form}
          layout="horizontal"
          style={{ '--border-top': 'none', '--border-bottom': 'none', borderRadius: '12px', background: '#fff' }}
        >
          <Form.Header>基础信息</Form.Header>
          <Form.Item
            name="name"
            label="客户名称"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input placeholder="请输入客户名称" clearable />
          </Form.Item>
          <Form.Item name="shortCode" label="客户编号">
            <Input placeholder="选填，不填将自动生成" clearable />
          </Form.Item>
          <Form.Item
            name="country"
            label="国家"
            initialValue="尼日利亚"
            rules={[{ required: true, message: '请输入国家' }]}
          >
            <Input placeholder="例如：尼日利亚" clearable />
          </Form.Item>
          <Form.Item name="industry" label="行业">
            <Input placeholder="例如：3C电子、服装" clearable />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="客户公司地址（选填）" clearable />
          </Form.Item>

          <Form.Header>联系人</Form.Header>
          <Form.Item
            name="contactName"
            label="联系人"
            rules={[{ required: true, message: '请输入联系人' }]}
          >
            <Input placeholder="请输入联系人姓名" clearable />
          </Form.Item>
          <Form.Item
            name="contactPhone"
            label="联系电话"
            rules={[{ required: true, message: '请输入联系电话' }]}
          >
            <Input placeholder="请输入联系电话" clearable />
          </Form.Item>
          <Form.Item name="contactEmail" label="邮箱">
            <Input placeholder="选填" clearable />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea placeholder="补充说明（选填）" rows={3} />
          </Form.Item>
        </Form>
      </div>

      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '12px 16px',
        background: '#fff',
        borderTop: '1px solid #f0f0f0',
      }}>
        <Button
          block
          color="primary"
          loading={submitting}
          onClick={handleSubmit}
          style={{ '--border-radius': '10px' }}
        >
          保存客户
        </Button>
      </div>
    </div>
  )
}

export default CustomerCreate
