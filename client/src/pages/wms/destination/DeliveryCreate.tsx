import React, { useState, useEffect } from 'react';
import {
  Form, Input, Select, Button, Space, Table, Tag, message, DatePicker, InputNumber, Row, Col
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { warehouseApi } from '../../../api';

const { Option } = Select;
const { TextArea } = Input;

interface AvailableOrder {
  id: string;
  trackingNo: string;
  clientName: string;
  pieces: number;
  weight: number;
  receiverName: string;
  receiverAddress: string;
  receiverPhone: string;
}

interface DeliveryCreateProps {
  onSuccess: (delivery: any) => void;
  onCancel: () => void;
  carrierOptions?: string[];
  preSelectedOrderIds?: string[];
  editData?: {
    id: string;
    deliveryNo: string;
    orderIds: string[];
    carrier: string;
    trackingNo: string;
    deliveryFee: number;
    estimatedDeliveryTime?: string;
    driverName?: string;
    driverPhone?: string;
    driverPlate?: string;
    remark?: string;
  };
}

export const DeliveryCreate: React.FC<DeliveryCreateProps> = ({
  onSuccess,
  onCancel,
  carrierOptions = [],
  preSelectedOrderIds,
  editData,
}) => {
  const [form] = Form.useForm();
  const isEdit = !!editData;
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);

  // 加载可用订单
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await warehouseApi.listStock({ warehouse: 'US', status: 'IN_STOCK' });
        const raw = (res as any)?.data || [];
        const mapped: AvailableOrder[] = (raw as any[]).map((r: any) => ({
          id: r.subOrderNo || r.id,
          trackingNo: r.trackingNo || '-',
          clientName: r.clientName || '-',
          pieces: r.pieces || 0,
          weight: r.weight || r.actualWeight || 0,
          receiverName: r.receiverName || '-',
          receiverAddress: r.receiverAddress || '-',
          receiverPhone: r.receiverPhone || '-',
        }));
        setAvailableOrders(mapped);
      } catch (err) {
        console.error('加载可用订单失败:', err);
      }
    };
    fetchOrders();
  }, []);

  // 编辑模式：预填表单
  useEffect(() => {
    if (editData) {
      form.setFieldsValue({
        carrier: editData.carrier,
        trackingNo: editData.trackingNo,
        deliveryFee: editData.deliveryFee,
        estimatedDeliveryTime: editData.estimatedDeliveryTime ? dayjs(editData.estimatedDeliveryTime) : undefined,
        driverName: editData.driverName,
        driverPhone: editData.driverPhone,
        driverPlate: editData.driverPlate,
        remark: editData.remark
      });
    }
  }, [editData, form]);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(editData?.orderIds || preSelectedOrderIds || []);
  const [searchText, setSearchText] = useState('');

  // 筛选可用订单
  const filteredOrders = availableOrders.filter(order => {
    if (!searchText) return true;
    const keyword = searchText.toLowerCase();
    return (
      order.id.toLowerCase().includes(keyword) ||
      order.trackingNo.toLowerCase().includes(keyword) ||
      order.clientName.toLowerCase().includes(keyword) ||
      order.receiverName.toLowerCase().includes(keyword)
    );
  });

  // 选中的订单
  const selectedOrders = availableOrders.filter(order => selectedOrderIds.includes(order.id));
  const totalPieces = selectedOrders.reduce((sum, order) => sum + order.pieces, 0);
  const totalWeight = selectedOrders.reduce((sum, order) => sum + order.weight, 0);

  // 订单列表列定义
  const orderColumns = [
    { title: '运单号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '第三方运单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 120 },
    { title: '客户', dataIndex: 'clientName', key: 'clientName', width: 100 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 70, align: 'center' as const },
    { title: '重量(kg)', dataIndex: 'weight', key: 'weight', width: 90 },
    { title: '收货人', dataIndex: 'receiverName', key: 'receiverName', width: 110 },
    { title: '电话', dataIndex: 'receiverPhone', key: 'receiverPhone', width: 140 },
    { title: '收货地址', dataIndex: 'receiverAddress', key: 'receiverAddress', ellipsis: true }
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys: selectedOrderIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedOrderIds(selectedRowKeys as string[]);
    }
  };

  // 提交配送单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (selectedOrderIds.length === 0) {
        message.warning('请至少选择一个订单');
        return;
      }

      // 收货信息取第一个选中订单
      const firstOrder = selectedOrders[0];

      const newDelivery = {
        id: `DELV${Date.now()}`,
        deliveryNo: `DLV-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        orderIds: selectedOrderIds,
        orderCount: selectedOrderIds.length,
        totalPieces,
        carrier: values.carrier,
        trackingNo: values.trackingNo || '',
        status: 'PENDING',
        receiverName: firstOrder.receiverName,
        receiverPhone: firstOrder.receiverPhone,
        receiverAddress: firstOrder.receiverAddress,
        deliveryFee: values.deliveryFee || 0,
        estimatedDeliveryTime: values.estimatedDeliveryTime ? values.estimatedDeliveryTime.format('YYYY-MM-DD HH:mm:ss') : undefined,
        driverName: values.driverName,
        driverPhone: values.driverPhone,
        driverPlate: values.driverPlate,
        operator: '当前用户',
        remark: values.remark,
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      };

      onSuccess(newDelivery);
      onCancel();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <div>
      {/* 选择订单区域 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ margin: 0 }}>选择订单</h4>
          <Space>
            <Input
              placeholder="搜索订单/客户/收货人"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 250 }}
              prefix={<SearchOutlined />}
              allowClear
            />
            <Tag color="blue">已选: {selectedOrderIds.length} 票</Tag>
            <Tag color="green">总件数: {totalPieces} 件</Tag>
            <Tag color="orange">总重量: {totalWeight.toFixed(2)} kg</Tag>
          </Space>
        </div>
        <Table
          rowKey="id"
          columns={orderColumns}
          dataSource={filteredOrders}
          rowSelection={rowSelection}
          pagination={false}
          size="small"
          scroll={{ y: 300 }}
        />
      </div>

      {/* 配送方式 */}
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="carrier"
              label="配送公司"
              rules={[{ required: true, message: '请选择配送公司' }]}
            >
              <Select placeholder="选择配送公司">
                {carrierOptions.map((carrier) => (
                  <Option key={carrier} value={carrier}>{carrier}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="trackingNo" label="配送追踪号">
              <Input placeholder="追踪号（可后续补填）" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="deliveryFee" label="配送费用 (USD)">
              <InputNumber
                style={{ width: '100%' }}
                placeholder="0.00"
                min={0}
                precision={2}
                prefix="$"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="driverName" label="司机姓名">
              <Input placeholder="配送司机姓名" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="driverPhone" label="司机电话">
              <Input placeholder="配送司机电话" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="driverPlate" label="车牌号">
              <Input placeholder="配送车辆车牌号" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="estimatedDeliveryTime" label="预计送达时间">
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
                placeholder="选择预计送达时间"
              />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="remark" label="备注">
              <Input placeholder="如有特殊说明请填写" />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={handleSubmit}>
          {isEdit ? '保存修改' : '创建配送单'}
        </Button>
      </div>
    </div>
  );
};
