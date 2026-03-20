import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Toast, NavBar, ImageUploader, Dialog } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { ScanningOutline, DeleteOutline, ContentOutline, GiftOutline } from 'antd-mobile-icons'
import { warehouseApi, orderApi, deliveryApi } from '@/api'
import type { ImageUploadItem } from 'antd-mobile/es/components/image-uploader'

// 订单信息类型
interface OrderInfo {
  subOrderId: string
  masterOrderId: string
  orderNo: string
  customerName: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  city: string
  pieces: number
  weight: number
}

const DeliveryCreate = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  // deliveryMethod 暂时默认为 DELIVERY，后续可扩展
  const [selectedOrders, setSelectedOrders] = useState<OrderInfo[]>([])
  const [fileList, setFileList] = useState<ImageUploadItem[]>([])
  const [showScanDialog, setShowScanDialog] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [stockOrders, setStockOrders] = useState<OrderInfo[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await warehouseApi.listStock()
        const data = (res as any)?.data || []
        const mapped: OrderInfo[] = (data as any[]).map((r: any) => ({
          subOrderId: r.id || r.subOrderNo || '',
          masterOrderId: r.masterOrderId || '',
          orderNo: r.subOrderNo || r.id,
          customerName: r.clientName || '-',
          recipientName: r.consignee || '-',
          recipientPhone: '',
          recipientAddress: r.destination || '',
          city: r.destination || '',
          pieces: r.pieces || 0,
          weight: r.weight || 0,
        }))
        setStockOrders(mapped)
      } catch (err: any) {
        Toast.show({ icon: 'fail', content: err.message || '获取库存数据失败' })
      }
    }
    fetchData()
  }, [])

  const applyDefaultRecipient = (order: OrderInfo) => {
    const current = form.getFieldsValue(['recipientName', 'recipientPhone', 'recipientAddress', 'city'])
    form.setFieldsValue({
      recipientName: current.recipientName || order.recipientName || '',
      recipientPhone: current.recipientPhone || order.recipientPhone || '',
      recipientAddress: current.recipientAddress || order.recipientAddress || '',
      city: current.city || order.city || '',
    })
  }

  const mapSubToOrder = (sub: any): OrderInfo => ({
    subOrderId: sub.id,
    masterOrderId: sub.masterOrderId,
    orderNo: sub.subOrderNo || sub.id,
    customerName: sub.customerName || sub.clientName || '-',
    recipientName: sub.consignee || '-',
    recipientPhone: sub.consigneePhone || '',
    recipientAddress: sub.destAddress || '',
    city: sub.destCity || '',
    pieces: Number(sub.pieces || 0),
    weight: Number(sub.weight || 0),
  })

  // 扫码添加订单
  const handleScanOrder = async () => {
    const keyword = scanInput.trim()
    if (!keyword) {
      Toast.show({ content: '请输入订单号', icon: 'fail' })
      return
    }

    // 检查是否已添加
    if (selectedOrders.some(o => o.orderNo === keyword)) {
      Toast.show({ content: '订单已添加', icon: 'fail' })
      return
    }

    try {
      const res = await orderApi.search(keyword)
      const data = (res as any)?.data || res || {}
      let subOrders = Array.isArray(data.subOrders) ? data.subOrders : []

      if (subOrders.length === 0 && Array.isArray(data.masterOrders) && data.masterOrders.length > 0) {
        const master = data.masterOrders[0]
        const subRes = await orderApi.listSub({ masterOrderId: master.id })
        const fromMaster = (subRes as any)?.data || []
        subOrders = Array.isArray(fromMaster) ? fromMaster : []
      }

      const foundSub = subOrders.find((s: any) =>
        s.subOrderNo === keyword || s.expressTrackingNo === keyword || s.id === keyword
      ) || subOrders[0]

      if (!foundSub) {
        Toast.show({ content: '订单不存在', icon: 'fail' })
        return
      }

      if (selectedOrders.some(o => o.subOrderId === foundSub.id)) {
        Toast.show({ content: '订单已添加', icon: 'fail' })
        return
      }

      const order = mapSubToOrder(foundSub)
      const nextOrders = [...selectedOrders, order]
      setSelectedOrders(nextOrders)
      applyDefaultRecipient(order)
      setScanInput('')
      setShowScanDialog(false)
      Toast.show({ content: '订单添加成功', icon: 'success' })
    } catch (err: any) {
      Toast.show({ icon: 'fail', content: err.message || '查询订单失败' })
    }
  }

  // 移除订单
  const handleRemoveOrder = (subOrderId: string) => {
    if (!window.confirm('确定要移除这个订单吗？')) return
    setSelectedOrders(selectedOrders.filter(o => o.subOrderId !== subOrderId))
    Toast.show({ content: '订单已移除', icon: 'success' })
  }

  // 计算总计
  const getTotalPieces = () => selectedOrders.reduce((sum, o) => sum + o.pieces, 0)
  const getTotalWeight = () => selectedOrders.reduce((sum, o) => sum + o.weight, 0)

  // 提交创建配送单
  const handleSubmit = async () => {
    // 验证订单
    if (selectedOrders.length === 0) {
      Toast.show({ content: '请至少添加一个订单', icon: 'fail' })
      return
    }

    try {
      const values = await form.validateFields()
      const user = JSON.parse(localStorage.getItem('user') || '{}')

      const createdRes: any = await deliveryApi.create({
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone,
        recipientAddress: values.recipientAddress,
        city: values.city,
        country: 'Nigeria',
        deliveryMethod: 'DELIVERY',
        totalPieces: getTotalPieces(),
        totalWeight: getTotalWeight(),
        deliveryFee: Number(values.deliveryFee || 0),
        currency: values.currency || 'NGN',
        remark: values.remark || null,
        createdBy: user.name || 'warehouse-us',
        subOrderIds: selectedOrders.map(o => o.subOrderId),
        photos: fileList.map(item => item.url).filter(Boolean),
      })
      const created = createdRes?.data || createdRes

      // 若录入了司机，则创建后直接执行分配
      if (created?.id && values.driverId) {
        await deliveryApi.assign(created.id, {
          driverId: values.driverId,
          driverName: values.driverName || null,
          driverPhone: values.driverPhone || null,
        })
      }

      Toast.show({ content: '配送单创建成功', icon: 'success' })
      setTimeout(() => navigate('/warehouse-us/delivery/list'), 800)
    } catch (error: any) {
      if (error?.errorFields) {
        Toast.show({ content: '请完整填写配送信息', icon: 'fail' })
      } else {
        Toast.show({ content: error?.message || '创建配送单失败', icon: 'fail' })
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
      <NavBar onBack={() => navigate(-1)}>创建配送单</NavBar>

      <div style={{ padding: '16px' }}>
        {/* 订单列表卡片 */}
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><ContentOutline style={{ fontSize: '16px' }} /> 订单列表</span>
              <Button
                size="small"
                color="primary"
                fill="outline"
                onClick={() => setShowScanDialog(true)}
              >
                <ScanningOutline /> 扫码添加
              </Button>
            </div>
          }
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          {selectedOrders.length > 0 ? (
            <>
              {selectedOrders.map((order, index) => (
                <div
                  key={order.orderNo}
                  style={{
                    padding: '12px',
                    marginBottom: index < selectedOrders.length - 1 ? '8px' : 0,
                    background: '#fafafa',
                    borderRadius: '8px',
                    border: '1px solid #f0f0f0'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                        {order.orderNo}
                      </div>
                      <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                        收件人：{order.recipientName} · {order.city}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {order.pieces}件 · {order.weight}kg
                      </div>
                    </div>
                    <Button
                      size="mini"
                      color="danger"
                      fill="none"
                      onClick={() => handleRemoveOrder(order.subOrderId)}
                    >
                      <DeleteOutline />
                    </Button>
                  </div>
                </div>
              ))}

              {/* 统计信息 */}
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: '#e6f4ff',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-around'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1677ff' }}>
                    {selectedOrders.length}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>订单数</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
                    {getTotalPieces()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>总件数</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#faad14' }}>
                    {getTotalWeight().toFixed(1)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>总重量(kg)</div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}><GiftOutline style={{ fontSize: '48px', color: '#ccc' }} /></div>
              <div style={{ fontSize: '14px' }}>暂无订单，请扫码添加</div>
            </div>
          )}
        </Card>

        {/* 司机和费用信息 */}
        <Card
          title="司机和费用"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <Form form={form}>
            <Form.Item
              name="recipientName"
              label="收件人"
              rules={[{ required: true, message: '请输入收件人' }]}
            >
              <Input placeholder="请输入收件人姓名" />
            </Form.Item>

            <Form.Item
              name="recipientPhone"
              label="收件电话"
              rules={[{ required: true, message: '请输入收件电话' }]}
            >
              <Input placeholder="请输入收件电话" />
            </Form.Item>

            <Form.Item
              name="recipientAddress"
              label="收件地址"
              rules={[{ required: true, message: '请输入收件地址' }]}
            >
              <Input placeholder="请输入收件地址" />
            </Form.Item>

            <Form.Item
              name="city"
              label="城市"
              rules={[{ required: true, message: '请输入城市' }]}
            >
              <Input placeholder="请输入城市" />
            </Form.Item>

            <Form.Item
              name="driverId"
              label="司机ID"
            >
              <Input placeholder="选填：创建后自动分配司机" />
            </Form.Item>

            <Form.Item
              name="driverName"
              label="司机姓名"
            >
              <Input placeholder="选填" />
            </Form.Item>

            <Form.Item
              name="driverPhone"
              label="司机电话"
            >
              <Input placeholder="选填" />
            </Form.Item>

            <Form.Item
              name="deliveryFee"
              label="配送费用 (NGN)"
              rules={[{ required: true, message: '请输入配送费用' }]}
            >
              <Input type="number" placeholder="请输入配送费用" />
            </Form.Item>

            <Form.Item
              name="remark"
              label="备注"
            >
              <Input placeholder="选填" />
            </Form.Item>
          </Form>
        </Card>

        {/* 单据拍摄 */}
        <Card
          title="单据拍摄"
          style={{
            marginBottom: '16px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
          }}
        >
          <ImageUploader
            value={fileList}
            onChange={setFileList}
            upload={async (file) => {
              // 模拟上传
              return {
                url: URL.createObjectURL(file)
              }
            }}
            maxCount={5}
          >
            <div style={{
              width: '100px',
              height: '100px',
              border: '1px dashed #d9d9d9',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>+</div>
              <div style={{ fontSize: '12px' }}>拍摄单据</div>
            </div>
          </ImageUploader>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
            最多上传5张照片
          </div>
        </Card>

        {/* 提交按钮 */}
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
          创建配送单
        </Button>
      </div>

      {/* 扫码对话框 */}
      <Dialog
        visible={showScanDialog}
        title="扫码添加订单"
        content={
          <div style={{ padding: '12px 0' }}>
            <Input
              placeholder="请输入或扫描订单号"
              value={scanInput}
              onChange={setScanInput}
              onEnterPress={handleScanOrder}
              style={{ marginBottom: '12px' }}
            />
            <div style={{ fontSize: '12px', color: '#999' }}>
              请输入订单号进行查询{stockOrders.length > 0 ? `（当前在库 ${stockOrders.length} 个订单）` : ''}
            </div>
          </div>
        }
        closeOnAction
        onClose={() => {
          setShowScanDialog(false)
          setScanInput('')
        }}
        actions={[
          {
            key: 'cancel',
            text: '取消'
          },
          {
            key: 'confirm',
            text: '确定',
            bold: true,
            onClick: handleScanOrder
          }
        ]}
      />
    </div>
  )
}

export default DeliveryCreate
