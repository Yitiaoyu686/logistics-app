import { useState } from 'react'
import { NavBar, Card, Button, Form, Input, Toast, Tabs } from 'antd-mobile'
import { useNavigate, useLocation } from 'react-router-dom'
import { ScanningOutline, ContentOutline } from 'antd-mobile-icons'
import { orderApi } from '@/api'

const ExpressMatchOrder = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const expressInfo = location.state
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState<'bind' | 'create'>('bind')
  const [submitting, setSubmitting] = useState(false)

  // 处理绑定现有订单
  const handleBindOrder = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      // 搜索订单号
      const res: any = await orderApi.search(values.orderNo)
      const data = res?.data || res
      const subs = data?.subOrders || []
      const masters = data?.masterOrders || []

      if (subs.length === 0 && masters.length === 0) {
        Toast.show({ content: '未找到匹配的订单', icon: 'fail' })
        return
      }

      // 如果找到子订单，更新其快递单号信息
      if (subs.length > 0) {
        await orderApi.updateSub(subs[0].id, {
          expressTrackingNo: expressInfo?.trackingNo,
          expressCompany: expressInfo?.companyName,
        })
      }

      Toast.show({ content: '订单绑定成功', icon: 'success' })
      setTimeout(() => {
        navigate('/no-order-express')
      }, 1000)
    } catch (error: any) {
      if (error?.errorFields) return
      Toast.show({ content: error.message || '绑定失败', icon: 'fail' })
    } finally {
      setSubmitting(false)
    }
  }

  // 处理创建新订单
  const handleCreateOrder = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const user = JSON.parse(localStorage.getItem('user') || '{}')

      // 创建新主订单
      await orderApi.createMaster({
        customerId: 'WALK-IN',
        customerName: values.customerName,
        sender: values.customerName,
        consignee: values.customerName,
        consigneePhone: values.customerPhone,
        destCountry: 'Nigeria',
        destCity: 'Lagos',
        destAddress: values.storageLocation || '-',
        transportType: 'SEA',
        salesPerson: user.name,
        remark: `无订单快递绑定 - 快递单号: ${expressInfo?.trackingNo || ''} ${values.remark || ''}`
      })

      Toast.show({ content: '订单创建成功并已绑定', icon: 'success' })
      setTimeout(() => {
        navigate('/no-order-express')
      }, 1000)
    } catch (error: any) {
      if (error?.errorFields) return
      Toast.show({ content: error.message || '创建失败', icon: 'fail' })
    } finally {
      setSubmitting(false)
    }
  }

  // 扫码订单号
  const handleScanOrderNo = () => {
    Toast.show({ content: '扫码功能开发中', icon: 'fail' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>匹配订单</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 快递信息卡片 */}
        {expressInfo && (
          <Card
            title={<><ContentOutline style={{ fontSize: '16px' }} /> 快递信息</>}
            style={{
              marginBottom: '16px',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}
          >
            <div style={{ fontSize: '13px', color: '#666', lineHeight: '24px' }}>
              <div>快递单号：{expressInfo.trackingNo}</div>
              <div>快递公司：{expressInfo.companyName}</div>
              <div>
                件数：{expressInfo.pieces} 件
                {expressInfo.weight && ` · 重量：${expressInfo.weight} kg`}
              </div>
            </div>
          </Card>
        )}

        {/* 标签页切换 */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as 'bind' | 'create')
            form.resetFields()
          }}
          style={{ marginBottom: '16px' }}
        >
          <Tabs.Tab title="绑定现有订单" key="bind" />
          <Tabs.Tab title="创建新订单" key="create" />
        </Tabs>

        {/* 绑定现有订单表单 */}
        {activeTab === 'bind' && (
          <Card
            style={{
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
                name="orderNo"
                label="订单号"
                rules={[{ required: true, message: '请输入订单号' }]}
                extra={
                  <Button
                    size="small"
                    color="primary"
                    fill="outline"
                    onClick={handleScanOrderNo}
                    style={{ marginTop: '8px' }}
                  >
                    <ScanningOutline /> 扫码
                  </Button>
                }
              >
                <Input placeholder="请输入订单号" />
              </Form.Item>

              <Form.Item
                name="storageLocation"
                label="存放位置"
                rules={[{ required: true, message: '请输入存放位置' }]}
              >
                <Input placeholder="例如：A区1排3层" />
              </Form.Item>

              <Form.Item
                name="remark"
                label="备注"
              >
                <Input placeholder="选填" />
              </Form.Item>
            </Form>
          </Card>
        )}

        {/* 创建新订单表单 */}
        {activeTab === 'create' && (
          <Card
            style={{
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
                name="customerName"
                label="客户名称"
                rules={[{ required: true, message: '请输入客户名称' }]}
              >
                <Input placeholder="请输入客户名称" />
              </Form.Item>

              <Form.Item
                name="customerPhone"
                label="联系电话"
                rules={[{ required: true, message: '请输入联系电话' }]}
              >
                <Input placeholder="请输入联系电话" type="tel" />
              </Form.Item>

              <Form.Item
                name="storageLocation"
                label="存放位置"
                rules={[{ required: true, message: '请输入存放位置' }]}
              >
                <Input placeholder="例如：A区1排3层" />
              </Form.Item>

              <Form.Item
                name="remark"
                label="备注"
              >
                <Input placeholder="选填" />
              </Form.Item>
            </Form>
          </Card>
        )}
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
          loading={submitting}
          onClick={activeTab === 'bind' ? handleBindOrder : handleCreateOrder}
          style={{
            '--border-radius': '8px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {activeTab === 'bind' ? '确认绑定' : '创建并绑定'}
        </Button>
      </div>
    </div>
  )
}

export default ExpressMatchOrder
