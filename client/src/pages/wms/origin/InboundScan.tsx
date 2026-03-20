import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, Space, message, Descriptions, Tag, Table, Modal
} from 'antd';
import {
  ScanOutlined, SaveOutlined, CameraOutlined, PlusOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderApi, warehouseApi } from '../../../api';

// 入库记录类型
interface InboundRecord {
  id: string;
  expressNo: string;
  orderNo?: string;
  customerName?: string;
  pieces: number;
  weight: number;
  volume?: number;
  goodsName?: string;
  status: 'PENDING' | 'CONFIRMED';
  photos?: string[];
  operator: string;
  operatorName: string;
  inboundTime: string;
}

export const InboundScan: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const [inboundRecords, setInboundRecords] = useState<InboundRecord[]>([]);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  // 加载今日入库记录
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await warehouseApi.listInbound();
        const raw = (res as any)?.data || [];
        const mapped: InboundRecord[] = (raw as any[]).map((r: any) => ({
          id: r.id,
          expressNo: r.trackingNo || '-',
          orderNo: r.subOrderId || '-',
          customerName: r.clientName || '-',
          pieces: r.pieces || 0,
          weight: r.actualWeight || 0,
          volume: r.actualVolume || 0,
          goodsName: r.remark || '-',
          status: r.status === 'COMPLETED' ? 'CONFIRMED' : 'PENDING',
          operator: r.operator || '-',
          operatorName: r.operator || '-',
          inboundTime: r.inboundTime ? r.inboundTime.replace('T', ' ').slice(0, 19) : '-',
        }));
        setInboundRecords(mapped);
      } catch (err: any) {
        console.error('加载入库记录失败:', err);
      }
    };
    fetchRecords();
  }, []);

  // 扫码/输入快递单号
  const handleScan = async () => {
    const expressNo = form.getFieldValue('expressNo');
    if (!expressNo) {
      message.warning('请输入快递单号');
      return;
    }

    try {
      setLoading(true);
      const res = await orderApi.search(expressNo.trim());
      const data = (res as any)?.data;
      const subOrders = data?.subOrders || [];
      const masterOrders = data?.masterOrders || [];

      if (subOrders.length > 0) {
        const sub = subOrders[0];
        const master = masterOrders.find((m: any) => m.id === sub.masterOrderId) || masterOrders[0];
        setScannedData({
          orderNo: sub.id || sub.subOrderNo,
          subOrderId: sub.id,
          masterOrderId: sub.masterOrderId || master?.id,
          customerName: master?.clientName || sub.clientName || '-',
          clientCode: master?.clientCode || sub.clientCode || '-',
          recipient: sub.recipientName || master?.recipientName || '-',
          phone: sub.recipientPhone || master?.recipientPhone || '-',
          address: sub.recipientAddress || master?.destAddress || '-',
          goodsName: sub.productName || master?.goodsType || '-',
          expressCompany: sub.expressCompany || sub.courier || '-',
          trackingNo: expressNo.trim(),
        });
        message.success('查询成功');
      } else {
        setScannedData(null);
        message.warning('未找到关联订单，请手动录入信息');
      }
    } catch (error) {
      setScannedData(null);
      message.warning('未找到关联订单，请手动录入信息');
    } finally {
      setLoading(false);
    }
  };

  // 确认入库
  const handleConfirm = async (values: any) => {
    try {
      setLoading(true);
      const inboundData: any = {
        subOrderId: scannedData?.subOrderId || values.expressNo,
        masterOrderId: scannedData?.masterOrderId || values.expressNo,
        trackingNo: values.expressNo,
        expressCompany: scannedData?.expressCompany || '未知',
        clientCode: scannedData?.clientCode || '-',
        clientName: scannedData?.customerName || '-',
        pieces: Number(values.pieces),
        actualWeight: values.weight ? Number(values.weight) : undefined,
        actualVolume: values.volume ? Number(values.volume) : undefined,
        packageCondition: 'GOOD',
        inboundMethod: 'SCAN',
        warehouse: 'CN',
        remark: values.goodsName || scannedData?.goodsName || '',
      };

      const res = await warehouseApi.createInbound(inboundData);
      const record = (res as any)?.data;

      const newRecord: InboundRecord = {
        id: record?.id || `INB${Date.now()}`,
        expressNo: values.expressNo,
        orderNo: scannedData?.orderNo,
        customerName: scannedData?.customerName,
        pieces: Number(values.pieces),
        weight: Number(values.weight) || 0,
        volume: values.volume ? Number(values.volume) : undefined,
        goodsName: values.goodsName || scannedData?.goodsName,
        status: 'CONFIRMED',
        operator: 'CURRENT_USER',
        operatorName: '当前用户',
        inboundTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      };

      setInboundRecords([newRecord, ...inboundRecords]);
      message.success('入库成功');

      // 重置表单
      form.resetFields();
      setScannedData(null);
    } catch (error: any) {
      message.error(error.message || '入库失败');
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '快递单号',
      dataIndex: 'expressNo',
      key: 'expressNo',
      width: 150,
    },
    {
      title: '运单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 180,
      render: (text: string) => text || '-',
    },
    {
      title: '客户名称',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 80,
    },
    {
      title: '重量(kg)',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
    },
    {
      title: '货物名称',
      dataIndex: 'goodsName',
      key: 'goodsName',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'CONFIRMED' ? 'success' : 'default'}>
          {status === 'CONFIRMED' ? '已确认' : '待确认'}
        </Tag>
      ),
    },
    {
      title: '入库时间',
      dataIndex: 'inboundTime',
      key: 'inboundTime',
      width: 160,
    },
  ];

  return (
    <div>
      {/* 扫码入库表单 */}
      <Card title="扫码入库" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleConfirm}
        >
          <Form.Item
            name="expressNo"
            label="快递单号"
            rules={[{ required: true, message: '请输入快递单号' }]}
          >
            <Input
              placeholder="请扫描或输入快递单号"
              suffix={
                <Button
                  type="link"
                  icon={<ScanOutlined />}
                  onClick={handleScan}
                  loading={loading}
                >
                  查询
                </Button>
              }
              onPressEnter={handleScan}
            />
          </Form.Item>

          {/* 运单信息展示 */}
          {scannedData && (
            <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f0f9ff' }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="运单号">{scannedData.orderNo}</Descriptions.Item>
                <Descriptions.Item label="客户名称">{scannedData.customerName}</Descriptions.Item>
                <Descriptions.Item label="收货人">{scannedData.recipient}</Descriptions.Item>
                <Descriptions.Item label="联系电话">{scannedData.phone}</Descriptions.Item>
                <Descriptions.Item label="货物名称" span={2}>{scannedData.goodsName}</Descriptions.Item>
                <Descriptions.Item label="收货地址" span={2}>{scannedData.address}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          <Space size="large" style={{ width: '100%' }}>
            <Form.Item
              name="pieces"
              label="件数"
              rules={[{ required: true, message: '请输入件数' }]}
              style={{ marginBottom: 0, width: 150 }}
            >
              <Input type="number" placeholder="件数" suffix="件" />
            </Form.Item>

            <Form.Item
              name="weight"
              label="重量"
              rules={[{ required: true, message: '请输入重量' }]}
              style={{ marginBottom: 0, width: 150 }}
            >
              <Input type="number" step="0.01" placeholder="重量" suffix="kg" />
            </Form.Item>

            <Form.Item
              name="volume"
              label="体积"
              style={{ marginBottom: 0, width: 150 }}
            >
              <Input type="number" step="0.001" placeholder="体积" suffix="m³" />
            </Form.Item>
          </Space>

          <Form.Item
            name="goodsName"
            label="货物名称"
            style={{ marginTop: 16 }}
          >
            <Input placeholder="如未自动识别，请手动输入货物名称" />
          </Form.Item>

          <Form.Item
            name="remark"
            label="备注"
          >
            <Input.TextArea rows={2} placeholder="备注信息" />
          </Form.Item>

          <Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={loading}
            >
              确认入库
            </Button>
            <Button
              icon={<CameraOutlined />}
              onClick={() => setPhotoModalVisible(true)}
            >
              拍照上传
            </Button>
          </Space>
        </Form>
      </Card>

      {/* 今日入库记录 */}
      <Card title="今日入库记录">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={inboundRecords}
          pagination={{
            pageSize: 10,
            showTotal: total => `共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 拍照上传弹窗 */}
      <Modal
        title="拍照上传"
        open={photoModalVisible}
        onCancel={() => setPhotoModalVisible(false)}
        footer={null}
      >
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CameraOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          <p style={{ marginTop: 16 }}>调用摄像头拍照功能</p>
          <p style={{ color: '#999' }}>（需要在移动端或支持摄像头的设备上使用）</p>
        </div>
      </Modal>
    </div>
  );
};
