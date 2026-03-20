import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Select, Tag, Space, Row, Col,
  Modal, Form, Input, Radio, Upload, message
} from 'antd';
import {
  RollbackOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  ClockCircleOutlined, UploadOutlined, PlusOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { warehouseApi } from '../../../api';

const { Option } = Select;
const { TextArea } = Input;

// 退运类型
type ReturnType = 'CUSTOMS' | 'CLIENT';

// 退运状态：待处理 / 已处理
type ReturnStatus = 'PENDING' | 'COMPLETED';

// 退运记录
interface ReturnRecord {
  id: string;
  masterOrderNo: string; // 主运单号
  subOrderNo: string; // 子运单号（退运维度）
  trackingNo: string; // 快递运单号
  businessLine?: 'SEA' | 'AIR';
  warehouse?: string;
  warehouseId?: string;
  clientCode: string;
  clientName: string;

  // 订单关联信息
  batchNo?: number;
  batchName?: string;
  transportType?: 'SEA' | 'AIR';
  route?: string;
  recipient?: string;
  destination?: string;

  returnType?: ReturnType;
  returnStatus: ReturnStatus;
  shippingUnitNo?: string; // 箱号/集装箱号
  pieces: number;
  weight: number;
  volume: number;
  returnReason?: string;
  returnTime?: string;
  processor?: string;
  remark?: string;
  attachments?: string[];
  createdAt: string;
}

interface ManualReturnFormValues {
  orderNo?: string;
  trackingNo?: string;
  customerName: string;
  returnType: ReturnType;
  reason: string;
  pieces: number;
  weight: number;
  volume?: number;
  route?: string;
  serviceType?: string;
  salesPerson?: string;
  remark?: string;
}

// 映射服务端状态到组件状态
const mapReturnStatus = (status: string): ReturnStatus => {
  if (status === 'RETURNED' || status === 'COMPLETED') return 'COMPLETED';
  return 'PENDING';
};

// 状态配置
const STATUS_CONFIG: Record<ReturnStatus, { text: string; color: string; icon: React.ReactNode }> = {
  PENDING: { text: '待处理', color: 'warning', icon: <ClockCircleOutlined /> },
  COMPLETED: { text: '已处理', color: 'success', icon: <CheckCircleOutlined /> },
};

// 退运类型配置
const RETURN_TYPE_CONFIG: Record<string, { text: string; color: string }> = {
  CUSTOMS: { text: '海关退运', color: 'error' },
  CLIENT: { text: '客户退单', color: 'warning' },
  CUSTOMER_CANCEL: { text: '客户取消', color: 'warning' },
  GOODS_ISSUE: { text: '货物问题', color: 'error' },
  ADDRESS_ERROR: { text: '地址错误', color: 'orange' },
  OTHER: { text: '其他', color: 'default' },
};

export const ReturnProcess = ({
  warehouseId,
  businessMode = 'ALL',
}: {
  warehouseId?: string;
  businessMode?: 'ALL' | 'SEA' | 'AIR';
}) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ReturnRecord[]>([]);

  // 筛选条件
  const [filterStatus, setFilterStatus] = useState<ReturnStatus | 'ALL'>('ALL');
  const [filterType, setFilterType] = useState<ReturnType | 'ALL'>('ALL');
  const [keyword, setKeyword] = useState('');

  // 处理Modal
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ReturnRecord | null>(null);
  const [form] = Form.useForm();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm<ManualReturnFormValues>();

  // 加载退运数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.listReturns({
        warehouseId,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
      });
      const raw = (res as any)?.data || [];
      const mapped: ReturnRecord[] = (raw as any[]).map((r: any) => ({
        id: r.id,
        masterOrderNo: r.orderNo || '-',
        subOrderNo: r.returnNo || '-',
        trackingNo: r.trackingNo || '-',
        businessLine: r.businessLine,
        warehouse: r.warehouse,
        warehouseId: r.warehouseId,
        clientCode: '-',
        clientName: r.customerName || '-',
        route: r.route || '-',
        transportType: r.businessLine || undefined,
        returnType: r.returnType as ReturnType | undefined,
        returnStatus: mapReturnStatus(r.status),
        shippingUnitNo: r.currentLocation,
        pieces: r.pieces || 0,
        weight: r.weight || 0,
        volume: r.volume || 0,
        returnReason: r.reason || '-',
        returnTime: r.approveTime ? r.approveTime.replace('T', ' ').slice(0, 16) : undefined,
        processor: r.approver || r.applicant || '-',
        remark: r.remark,
        createdAt: r.createdAt ? r.createdAt.replace('T', ' ').slice(0, 16) : '-',
      }));
      setRecords(mapped);
      setFilteredRecords(mapped);
    } catch (err: any) {
      message.error(err.message || '加载退运数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [warehouseId, businessMode]);

  // 统计数据
  const pendingCount = records.filter(r => r.returnStatus === 'PENDING').length;
  const completedCount = records.filter(r => r.returnStatus === 'COMPLETED').length;

  // 筛选逻辑
  const handleFilter = () => {
    let filtered = [...records];

    const kw = keyword.trim().toLowerCase();
    if (kw) {
      filtered = filtered.filter((r) => (
        `${r.subOrderNo} ${r.masterOrderNo} ${r.trackingNo} ${r.clientName} ${r.route || ''} ${r.returnReason || ''}`
      ).toLowerCase().includes(kw));
    }

    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(r => r.returnStatus === filterStatus);
    }

    if (filterType !== 'ALL') {
      filtered = filtered.filter(r => r.returnType === filterType);
    }

    setFilteredRecords(filtered);
  };

  useEffect(() => {
    handleFilter();
  }, [records, filterStatus, filterType, keyword]);

  // 打开处理Modal
  const handleProcess = (record: ReturnRecord) => {
    setSelectedRecord(record);
    form.resetFields();
    setProcessModalVisible(true);
  };

  // 提交处理 — 仓管填写退运快递信息，状态变为已处理
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await warehouseApi.updateReturn(selectedRecord!.id, {
        returnType: selectedRecord!.returnType,
        status: 'RETURNED',
        reason: selectedRecord!.returnReason,
        remark: `退运快递: ${values.expressCompany || ''} ${values.returnTrackingNo || ''}\n地址: ${values.returnAddress || ''}\n联系人: ${values.returnContact || ''} ${values.returnPhone || ''}\n备注: ${values.remark || ''}`,
      });

      setProcessModalVisible(false);
      form.resetFields();
      message.success('退运处理完成，快递已寄出');
      await fetchData();
      setLoading(false);
    } catch (error: any) {
      message.error(error.message || '处理失败');
      setLoading(false);
    }
  };

  // 取消处理
  const handleCancel = (record: ReturnRecord) => {
    Modal.confirm({
      title: '确认取消',
      content: `确定要取消订单 ${record.trackingNo} 的退运处理吗？`,
      onOk: async () => {
        try {
          await warehouseApi.updateReturn(record.id, { status: 'REJECTED' });
          setRecords(prevRecords =>
            prevRecords.map(r =>
              r.id === record.id ? { ...r, returnStatus: 'CANCELLED' as ReturnStatus } : r
            )
          );
          setFilteredRecords(prevRecords =>
            prevRecords.map(r =>
              r.id === record.id ? { ...r, returnStatus: 'CANCELLED' as ReturnStatus } : r
            )
          );
          message.success('已取消退运处理');
          await fetchData();
        } catch (err: any) {
          message.error(err.message || '取消失败');
        }
      }
    });
  };

  const handleCreateReturn = async () => {
    try {
      const values = await createForm.validateFields();
      await warehouseApi.createReturn({
        orderNo: values.orderNo || null,
        trackingNo: values.trackingNo || null,
        customerName: values.customerName,
        returnType: values.returnType,
        reason: values.reason,
        pieces: Number(values.pieces || 0),
        weight: Number(values.weight || 0),
        volume: Number(values.volume || 0),
        applicant: 'warehouse_cn',
        businessLine: businessMode === 'ALL' ? 'SEA' : businessMode,
        warehouse: 'CN',
        warehouseId,
        route: values.route || null,
        serviceType: values.serviceType || null,
        salesPerson: values.salesPerson || null,
        remark: values.remark || null,
      });
      message.success('退运记录创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      await fetchData();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || '创建失败');
    }
  };

  const handleDeleteReturn = (record: ReturnRecord) => {
    Modal.confirm({
      title: '确认删除退运记录',
      content: `确认删除 ${record.subOrderNo} 吗？`,
      okText: '确认删除',
      cancelText: '返回',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await warehouseApi.deleteReturn(record.id);
          message.success('退运记录已删除');
          await fetchData();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  // 表格列定义
  const columns = [
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '订单信息',
      key: 'orderInfo',
      width: 200,
      render: (_: unknown, record: ReturnRecord) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.subOrderNo}</div>
          <div style={{ fontSize: 12, color: '#999' }}>主订单: {record.masterOrderNo}</div>
          <div style={{ fontSize: 12, color: '#999' }}>快递: {record.trackingNo}</div>
        </div>
      )
    },
    {
      title: '业务线',
      dataIndex: 'businessLine',
      key: 'businessLine',
      width: 90,
      render: (line?: string) => <Tag color={line === 'AIR' ? 'gold' : 'blue'}>{line || '-'}</Tag>
    },
    {
      title: '客户',
      dataIndex: 'clientName',
      key: 'clientName',
      width: 150,
      render: (text: string, record: ReturnRecord) => (
        <div>
          <div>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.clientCode}</div>
        </div>
      )
    },
    {
      title: '路线/目的地',
      key: 'route',
      width: 150,
      render: (_: unknown, record: ReturnRecord) => (
        <div>
          <div style={{ fontSize: 12 }}>{record.route || '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.warehouse || '-'}</div>
        </div>
      )
    },
    {
      title: '箱号/集装箱号',
      dataIndex: 'shippingUnitNo',
      key: 'shippingUnitNo',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '货物信息',
      key: 'cargo',
      width: 180,
      render: (_: unknown, record: ReturnRecord) => (
        <div>
          <div>{record.pieces} 件</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {record.weight.toFixed(2)} kg / {record.volume.toFixed(3)} m³
          </div>
        </div>
      )
    },
    {
      title: '退运类型',
      dataIndex: 'returnType',
      key: 'returnType',
      width: 120,
      render: (type: string) => {
        if (!type) return <Tag color="default">未分类</Tag>;
        const config = RETURN_TYPE_CONFIG[type];
        if (!config) return <Tag color="default">{type}</Tag>;
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'returnStatus',
      key: 'returnStatus',
      width: 120,
      render: (status: ReturnStatus) => {
        const config = STATUS_CONFIG[status];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      }
    },
    {
      title: '退运原因',
      dataIndex: 'returnReason',
      key: 'returnReason',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || '-'
    },
    {
      title: '处理人',
      dataIndex: 'processor',
      key: 'processor',
      width: 100,
      render: (text: string) => text || '-'
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, record: ReturnRecord) => (
        <Space>
          {record.returnStatus === 'PENDING' && (
            <>
              <Button
                type="link"
                size="small"
                onClick={() => handleProcess(record)}
              >
                处理
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={() => handleCancel(record)}
              >
                取消
              </Button>
            </>
          )}
          {record.returnStatus === 'COMPLETED' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleProcess(record)}
            >
              查看
            </Button>
          )}
          {['PENDING', 'CANCELLED'].includes(record.returnStatus) && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteReturn(record)}
            >
              删除
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="orange">待处理 {pendingCount}</Tag>
        <Tag color="green">已处理 {completedCount}</Tag>
        <Tag color="blue">总计 {records.length}</Tag>
      </div>

      {/* 筛选区域 */}
      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新建退运
          </Button>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索退运单号/主单号/运单号/客户"
            style={{ width: 260 }}
            allowClear
            onPressEnter={handleFilter}
          />
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 120 }}
          >
            <Option value="ALL">全部状态</Option>
            <Option value="PENDING">待处理</Option>
            <Option value="COMPLETED">已处理</Option>
          </Select>
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: 120 }}
          >
            <Option value="ALL">全部类型</Option>
            <Option value="CUSTOMS">海关退运</Option>
            <Option value="CLIENT">客户退单</Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleFilter}>查询</Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setKeyword('');
              setFilterStatus('ALL');
              setFilterType('ALL');
              fetchData();
            }}
          >
            重置
          </Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredRecords}
        loading={loading}
        scroll={{ x: 1600, y: 'calc(100vh - 430px)' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条记录`
        }}
        size="small"
      />

      <Modal
        title="新建退运"
        open={createModalVisible}
        onOk={handleCreateReturn}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        width={680}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="orderNo" label="主运单号">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trackingNo" label="第三方运单号">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customerName" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="returnType" label="退运类型" rules={[{ required: true, message: '请选择退运类型' }]}>
                <Select>
                  <Option value="CUSTOMS">海关退运</Option>
                  <Option value="CLIENT">客户退单</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pieces" label="件数" rules={[{ required: true, message: '请输入件数' }]}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="weight" label="重量(kg)" rules={[{ required: true, message: '请输入重量' }]}>
                <Input type="number" min={0} step="0.01" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="volume" label="体积(m³)">
                <Input type="number" min={0} step="0.001" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="reason" label="退运原因" rules={[{ required: true, message: '请输入退运原因' }]}>
                <TextArea rows={3} maxLength={300} showCount />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="route" label="线路">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="salesPerson" label="业务员">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <TextArea rows={2} maxLength={200} showCount />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 处理Modal */}
      <Modal
        title={
          <Space>
            <RollbackOutlined />
            <span>退运处理</span>
          </Space>
        }
        open={processModalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setProcessModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={loading}
        width={640}
        okText="确认已退运"
        cancelText="返回"
      >
        {/* 退运单信息 */}
        {selectedRecord && (
          <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ marginBottom: 4 }}><span style={{ color: '#999' }}>运单号：</span><strong>{selectedRecord.trackingNo}</strong></div>
                <div><span style={{ color: '#999' }}>客户：</span>{selectedRecord.clientName}</div>
              </Col>
              <Col span={8}>
                <div style={{ marginBottom: 4 }}><span style={{ color: '#999' }}>退运原因：</span>{selectedRecord.returnReason}</div>
                <div><span style={{ color: '#999' }}>退运类型：</span>{RETURN_TYPE_CONFIG[selectedRecord.returnType || '']?.text || '-'}</div>
              </Col>
              <Col span={8}>
                <div style={{ marginBottom: 4 }}><span style={{ color: '#999' }}>件数：</span>{selectedRecord.pieces} 件</div>
                <div><span style={{ color: '#999' }}>重量：</span>{selectedRecord.weight.toFixed(2)} kg</div>
              </Col>
            </Row>
          </Card>
        )}

        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="退运快递公司" name="expressCompany" rules={[{ required: true, message: '请选择快递公司' }]}>
                <Select placeholder="选择快递公司">
                  <Option value="顺丰速运">顺丰速运</Option>
                  <Option value="韵达快递">韵达快递</Option>
                  <Option value="圆通速递">圆通速递</Option>
                  <Option value="中通速运">中通速运</Option>
                  <Option value="申通快递">申通快递</Option>
                  <Option value="京东物流">京东物流</Option>
                  <Option value="德邦物流">德邦物流</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="退运快递单号" name="returnTrackingNo" rules={[{ required: true, message: '请填写快递单号' }]}>
                <Input placeholder="填写退运快递单号" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="退运地址" name="returnAddress" rules={[{ required: true, message: '请填写退运地址' }]}>
            <Input placeholder="客户退运地址" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="联系人" name="returnContact">
                <Input placeholder="收件人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="联系电话" name="returnPhone">
                <Input placeholder="收件人电话" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="备注" name="remark">
            <TextArea rows={2} maxLength={200} showCount placeholder="补充说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
