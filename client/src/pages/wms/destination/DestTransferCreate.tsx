import React, { useState, useEffect } from 'react';
import {
  Form, Input, Select, Button, Space, Table, Tag, message,
  InputNumber, Row, Col, Radio
} from 'antd';
import { SearchOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { warehouseApi } from '../../../api';

const { Option } = Select;
const { TextArea } = Input;

// 仓库选项
const WAREHOUSES = [
  { value: 'US总仓', label: 'US总仓（洛杉矶）' },
  { value: 'US分仓A', label: 'US分仓A（纽约）' },
  { value: 'US分仓B', label: 'US分仓B（芝加哥）' },
  { value: 'US分仓C', label: 'US分仓C（休斯顿）' }
];

// 承运商
const FALLBACK_CARRIERS = ['UPS', 'FedEx', 'USPS', 'DHL', 'Amazon Logistics', 'OnTrac'];

interface AvailableOrderItem {
  id: string;
  trackingNo: string;
  clientName: string;
  pieces: number;
  weight: number;
  warehouseLocation: string;
}

export interface TransferFormData {
  id?: string;
  transferNo?: string;
  direction: 'BRANCH_TO_MAIN' | 'MAIN_TO_BRANCH';
  fromWarehouse: string;
  toWarehouse: string;
  shippingMethod: 'VIA_MAIN' | 'DIRECT';
  shippingUnitNo?: string;
  logisticsType: 'THIRD_PARTY' | 'SELF_DELIVERY';
  carrier?: string;
  logisticsTrackingNo?: string;
  driverName?: string;
  driverPhone?: string;
  driverPlate?: string;
  orderIds: string[];
  remark?: string;
}

interface DestTransferCreateProps {
  onSuccess: (data: any) => void;
  onCancel: () => void;
  editData?: TransferFormData;
  carrierOptions?: string[];
}

export const DestTransferCreate: React.FC<DestTransferCreateProps> = ({ onSuccess, onCancel, editData, carrierOptions }) => {
  const [form] = Form.useForm();
  const isEdit = !!editData;
  const [availableOrders, setAvailableOrders] = useState<AvailableOrderItem[]>([]);
  const activeCarrierOptions = (carrierOptions || []).filter(Boolean).length > 0
    ? (carrierOptions || []).filter(Boolean)
    : FALLBACK_CARRIERS;

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(editData?.orderIds || []);
  const [searchText, setSearchText] = useState('');
  const [direction, setDirection] = useState<string | undefined>(editData?.direction);
  const [shippingMethod, setShippingMethod] = useState<string | undefined>(editData?.shippingMethod);
  const [logisticsType, setLogisticsType] = useState<string>(editData?.logisticsType || 'THIRD_PARTY');

  // 加载可用订单
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await warehouseApi.listStock({ warehouse: 'US' });
        const raw = (res as any)?.data || [];
        const mapped: AvailableOrderItem[] = (raw as any[]).map((r: any) => ({
          id: r.subOrderNo || r.id,
          trackingNo: r.trackingNo || '-',
          clientName: r.clientName || '-',
          pieces: r.pieces || 0,
          weight: r.weight || r.actualWeight || 0,
          warehouseLocation: r.storageLocation || r.warehouseLocation || '-',
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
        direction: editData.direction,
        fromWarehouse: editData.fromWarehouse,
        toWarehouse: editData.toWarehouse,
        shippingMethod: editData.shippingMethod,
        shippingUnitNo: editData.shippingUnitNo,
        logisticsType: editData.logisticsType,
        carrier: editData.carrier,
        logisticsTrackingNo: editData.logisticsTrackingNo,
        driverName: editData.driverName,
        driverPhone: editData.driverPhone,
        driverPlate: editData.driverPlate,
        remark: editData.remark
      });
      setDirection(editData.direction);
      setShippingMethod(editData.shippingMethod);
      setLogisticsType(editData.logisticsType);
    }
  }, [editData, form]);

  // 筛选订单
  const filteredOrders = availableOrders.filter(order => {
    if (!searchText) return true;
    const keyword = searchText.toLowerCase();
    return (
      order.id.toLowerCase().includes(keyword) ||
      order.trackingNo.toLowerCase().includes(keyword) ||
      order.clientName.toLowerCase().includes(keyword)
    );
  });

  // 选中订单统计
  const selectedOrders = availableOrders.filter(o => selectedOrderIds.includes(o.id));
  const totalPieces = selectedOrders.reduce((sum, o) => sum + o.pieces, 0);
  const totalWeight = selectedOrders.reduce((sum, o) => sum + o.weight, 0);

  // 方向变更
  const handleDirectionChange = (val: string) => {
    setDirection(val);
    form.setFieldsValue({ fromWarehouse: undefined, toWarehouse: undefined });
  };

  // 提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (selectedOrderIds.length === 0) {
        message.warning('请至少选择一个订单');
        return;
      }

      const result = {
        id: editData?.id || `TF${Date.now()}`,
        transferNo: editData?.transferNo || `TRF-US-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        direction: values.direction,
        fromWarehouse: values.fromWarehouse,
        toWarehouse: values.toWarehouse,
        shippingMethod: values.shippingMethod,
        shippingUnitNo: values.shippingUnitNo,
        logisticsType: values.logisticsType,
        carrier: values.logisticsType === 'THIRD_PARTY' ? values.carrier : undefined,
        logisticsTrackingNo: values.logisticsType === 'THIRD_PARTY' ? values.logisticsTrackingNo : undefined,
        driverName: values.logisticsType === 'SELF_DELIVERY' ? values.driverName : undefined,
        driverPhone: values.logisticsType === 'SELF_DELIVERY' ? values.driverPhone : undefined,
        driverPlate: values.logisticsType === 'SELF_DELIVERY' ? values.driverPlate : undefined,
        orderIds: selectedOrderIds,
        orderCount: selectedOrderIds.length,
        totalPieces,
        totalWeight,
        status: 'PENDING',
        operator: '当前用户',
        remark: values.remark,
        createdAt: editData?.transferNo ? undefined : dayjs().format('YYYY-MM-DD HH:mm:ss')
      };

      onSuccess(result);
      onCancel();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 订单列表列
  const orderColumns = [
    { title: '运单号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '第三方运单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 100 },
    { title: '客户', dataIndex: 'clientName', key: 'clientName', width: 80 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 60, align: 'center' as const },
    { title: '重量(kg)', dataIndex: 'weight', key: 'weight', width: 80 }
  ];

  return (
    <div>
      {/* 调拨信息 */}
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="direction" label="调拨方向" rules={[{ required: true, message: '请选择调拨方向' }]}>
              <Select placeholder="选择调拨方向" onChange={handleDirectionChange}>
                <Option value="BRANCH_TO_MAIN"><SwapOutlined /> 分仓 → 总仓</Option>
                <Option value="MAIN_TO_BRANCH"><SwapOutlined /> 总仓 → 分仓</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="fromWarehouse" label="来源仓库" rules={[{ required: true, message: '请选择来源仓库' }]}>
              <Select placeholder="选择来源仓库" disabled={!direction}>
                {direction === 'BRANCH_TO_MAIN' && WAREHOUSES.filter(w => w.value !== 'US总仓').map(w => (
                  <Option key={w.value} value={w.value}>{w.label}</Option>
                ))}
                {direction === 'MAIN_TO_BRANCH' && WAREHOUSES.filter(w => w.value === 'US总仓').map(w => (
                  <Option key={w.value} value={w.value}>{w.label}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="toWarehouse" label="去向仓库" rules={[{ required: true, message: '请选择去向仓库' }]}>
              <Select placeholder="选择去向仓库" disabled={!direction}>
                {direction === 'BRANCH_TO_MAIN' && WAREHOUSES.filter(w => w.value === 'US总仓').map(w => (
                  <Option key={w.value} value={w.value}>{w.label}</Option>
                ))}
                {direction === 'MAIN_TO_BRANCH' && WAREHOUSES.filter(w => w.value !== 'US总仓').map(w => (
                  <Option key={w.value} value={w.value}>{w.label}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="shippingMethod" label="运输方式" rules={[{ required: true, message: '请选择运输方式' }]}>
              <Select placeholder="选择运输方式" onChange={(val: string) => setShippingMethod(val)}>
                <Option value="VIA_MAIN">经总仓中转</Option>
                <Option value="DIRECT">集装箱直达</Option>
              </Select>
            </Form.Item>
          </Col>
          {shippingMethod === 'DIRECT' && (
            <Col span={8}>
              <Form.Item name="shippingUnitNo" label="集装箱/运输单元号" rules={[{ required: true, message: '请输入集装箱号' }]}>
                <Input placeholder="例如: MSKU1234567" />
              </Form.Item>
            </Col>
          )}
        </Row>

        {/* 物流/司机信息 */}
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 4 }}>
          <Form.Item name="logisticsType" label="配送方式" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
            <Radio.Group onChange={e => setLogisticsType(e.target.value)}>
              <Radio value="THIRD_PARTY">第三方物流</Radio>
              <Radio value="SELF_DELIVERY">自有司机</Radio>
            </Radio.Group>
          </Form.Item>

          {logisticsType === 'THIRD_PARTY' ? (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="carrier" label="物流公司" rules={[{ required: true, message: '请选择物流公司' }]}>
                  <Select placeholder="选择物流公司">
                    {activeCarrierOptions.map(c => <Option key={c} value={c}>{c}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="logisticsTrackingNo" label="物流追踪号">
                  <Input placeholder="追踪号（可后续补填）" />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="driverName" label="司机姓名" rules={[{ required: true, message: '请输入司机姓名' }]}>
                  <Input placeholder="司机姓名" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="driverPhone" label="司机电话" rules={[{ required: true, message: '请输入司机电话' }]}>
                  <Input placeholder="司机电话" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="driverPlate" label="车牌号" rules={[{ required: true, message: '请输入车牌号' }]}>
                  <Input placeholder="车牌号" />
                </Form.Item>
              </Col>
            </Row>
          )}
        </div>

        <Form.Item name="remark" label="备注">
          <Input placeholder="如有特殊说明请填写" />
        </Form.Item>
      </Form>

      {/* 选择订单 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ margin: 0 }}>选择调拨订单</h4>
          <Space>
            <Input
              placeholder="搜索运单号/客户"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
              allowClear
            />
            <Tag color="blue">已选: {selectedOrderIds.length} 票</Tag>
            <Tag color="green">总件数: {totalPieces} 件</Tag>
            <Tag color="orange">总重量: {totalWeight.toFixed(1)} kg</Tag>
          </Space>
        </div>
        <Table
          rowKey="id"
          columns={orderColumns}
          dataSource={filteredOrders}
          rowSelection={{
            selectedRowKeys: selectedOrderIds,
            onChange: (keys) => setSelectedOrderIds(keys as string[])
          }}
          pagination={false}
          size="small"
          scroll={{ y: 220 }}
        />
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={handleSubmit}>
          {isEdit ? '保存修改' : '创建调拨单'}
        </Button>
      </div>
    </div>
  );
};
