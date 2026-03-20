import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, Tag,
  message, Row, Col, Statistic, Typography, Descriptions, Divider
} from 'antd';
import {
  CheckOutlined, CloseOutlined, EyeOutlined, DollarOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FeeRecord, FeeType, FeeDirection, FeeStatus, Currency } from '../../types/finance';
import { FEE_TYPE_CONFIG, FEE_STATUS_CONFIG, CURRENCY_CONFIG } from '../../types/finance';
import { feeApi } from '../../api';
import { FeeInputDetail } from './FeeInputDetail';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

export const FeeApproval: React.FC = () => {
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFees = async () => {
    setLoading(true);
    try {
      const res = await feeApi.list();
      setRecords(res.data || res || []);
    } catch (e) {
      message.error('获取费用数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFees();
  }, []);

  // 筛选条件
  const [searchText, setSearchText] = useState('');
  const [filterFeeType, setFilterFeeType] = useState<FeeType | 'ALL'>('ALL');
  const [filterDirection, setFilterDirection] = useState<FeeDirection | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<FeeStatus | 'ALL'>('ALL');
  const [filterCurrency, setFilterCurrency] = useState<Currency | 'ALL'>('ALL');

  // 详情
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetailId, setCurrentDetailId] = useState('');

  // 审批弹窗
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FeeRecord | null>(null);
  const [form] = Form.useForm();

  // --- 统计 ---
  const stats = useMemo(() => {
    const pendingCount = records.filter(r => r.status === 'PENDING').length;
    const pendingAmount = records.filter(r => r.status === 'PENDING')
      .reduce((sum, r) => sum + (r.amountCNY || r.amount), 0);
    const approvedCount = records.filter(r => r.status === 'APPROVED' || r.status === 'PAID').length;
    const rejectedCount = records.filter(r => r.status === 'REJECTED').length;
    return { pendingCount, pendingAmount, approvedCount, rejectedCount };
  }, [records]);

  // --- 筛选 ---
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (searchText) {
      const keyword = searchText.toLowerCase();
      result = result.filter(r =>
        r.feeNo.toLowerCase().includes(keyword) ||
        r.relatedNo.toLowerCase().includes(keyword) ||
        (r.supplierName && r.supplierName.toLowerCase().includes(keyword)) ||
        (r.customerName && r.customerName.toLowerCase().includes(keyword)) ||
        (r.createdByName && r.createdByName.toLowerCase().includes(keyword)) ||
        (r.description && r.description.toLowerCase().includes(keyword))
      );
    }
    if (filterFeeType !== 'ALL') result = result.filter(r => r.feeType === filterFeeType);
    if (filterDirection !== 'ALL') result = result.filter(r => r.feeDirection === filterDirection);
    if (filterStatus !== 'ALL') result = result.filter(r => r.status === filterStatus);
    if (filterCurrency !== 'ALL') result = result.filter(r => r.currency === filterCurrency);

    return result;
  }, [records, searchText, filterFeeType, filterDirection, filterStatus, filterCurrency]);

  const handleReset = () => {
    setSearchText('');
    setFilterFeeType('ALL');
    setFilterDirection('ALL');
    setFilterStatus('ALL');
    setFilterCurrency('ALL');
  };

  // --- 打开详情 ---
  const handleOpenDetail = (id: string) => {
    setCurrentDetailId(id);
    setDetailVisible(true);
  };

  // --- 打开审批弹窗 ---
  const handleOpenApproval = (record: FeeRecord) => {
    setSelectedRecord(record);
    form.resetFields();
    setApprovalModalVisible(true);
  };

  // --- 审批提交 ---
  const handleApproval = async () => {
    try {
      const values = await form.validateFields();
      const isApproved = values.approvalResult === 'APPROVED';
      if (!selectedRecord?.id) {
        message.error('未找到待审批费用');
        return;
      }
      const user = (() => {
        try {
          const raw = localStorage.getItem('user');
          const parsed = raw ? JSON.parse(raw) : {};
          return parsed?.username || parsed?.id || 'CURRENT_USER';
        } catch {
          return 'CURRENT_USER';
        }
      })();
      if (isApproved) {
        await feeApi.approve(selectedRecord.id, user);
      } else {
        await feeApi.reject(selectedRecord.id, user, values.approvalRemark);
      }

      await loadFees();
      message.success(isApproved ? '已审批通过' : '已驳回');
      setApprovalModalVisible(false);
      setSelectedRecord(null);
      form.resetFields();
    } catch (error) {
      const err = error as any;
      if (err?.errorFields) return;
      message.error(err?.message || '审批失败');
      console.error('审批失败:', error);
    }
  };

  // 监听审批结果变化
  const watchResult = Form.useWatch('approvalResult', form);

  // --- 列定义 ---
  const columns = [
    {
      title: '费用编号',
      dataIndex: 'feeNo',
      key: 'feeNo',
      width: 160,
      render: (text: string, record: FeeRecord) => (
        <a onClick={() => handleOpenDetail(record.id)}>{text}</a>
      )
    },
    {
      title: '关联单号',
      dataIndex: 'relatedNo',
      key: 'relatedNo',
      width: 160
    },
    {
      title: '费用类型',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 90,
      render: (type: FeeType) => {
        const config = FEE_TYPE_CONFIG[type];
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{type}</Tag>;
      }
    },
    {
      title: '方向',
      dataIndex: 'feeDirection',
      key: 'feeDirection',
      width: 60,
      render: (dir: FeeDirection) => (
        <Tag color={dir === 'PAYABLE' ? 'red' : 'green'}>{dir === 'PAYABLE' ? '应付' : '应收'}</Tag>
      )
    },
    {
      title: '金额',
      key: 'amount',
      width: 120,
      render: (record: FeeRecord) => {
        const currConfig = CURRENCY_CONFIG[record.currency];
        const symbol = currConfig ? currConfig.symbol : record.currency + ' ';
        return (
          <Text strong style={{ color: record.feeDirection === 'PAYABLE' ? '#cf1322' : '#3f8600' }}>
            {symbol}{record.amount.toFixed(2)}
          </Text>
        );
      }
    },
    {
      title: '供应商/客户',
      key: 'party',
      width: 120,
      render: (record: FeeRecord) => record.supplierName || record.customerName || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: FeeStatus) => {
        const config = FEE_STATUS_CONFIG[status];
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{status}</Tag>;
      }
    },
    {
      title: '申请人',
      dataIndex: 'createdByName',
      key: 'createdByName',
      width: 80
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (record: FeeRecord) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record.id)}>
            详情
          </Button>
          {record.status === 'PENDING' && (
            <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleOpenApproval(record)}>
              审批
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待审批" value={stats.pendingCount} suffix="笔" valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待审批金额(¥)" value={stats.pendingAmount} prefix="¥" precision={2} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已审批" value={stats.approvedCount} suffix="笔" valueStyle={{ color: '#52c41a' }} prefix={<CheckOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已驳回" value={stats.rejectedCount} suffix="笔" valueStyle={{ color: '#ff4d4f' }} prefix={<CloseOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col span={5}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>关键词</div>
            <Input
              placeholder="费用编号/关联单号/供应商/客户/申请人"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>费用类型</div>
            <Select value={filterFeeType} onChange={setFilterFeeType} style={{ width: '100%' }}>
              <Option value="ALL">全部类型</Option>
              {(Object.keys(FEE_TYPE_CONFIG) as FeeType[]).map(key => (
                <Option key={key} value={key}>{FEE_TYPE_CONFIG[key].label}</Option>
              ))}
            </Select>
          </Col>
          <Col span={3}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>费用方向</div>
            <Select value={filterDirection} onChange={setFilterDirection} style={{ width: '100%' }}>
              <Option value="ALL">全部</Option>
              <Option value="PAYABLE">应付</Option>
              <Option value="RECEIVABLE">应收</Option>
            </Select>
          </Col>
          <Col span={3}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>状态</div>
            <Select value={filterStatus} onChange={setFilterStatus} style={{ width: '100%' }}>
              <Option value="ALL">全部状态</Option>
              {(Object.keys(FEE_STATUS_CONFIG) as FeeStatus[]).map(key => (
                <Option key={key} value={key}>{FEE_STATUS_CONFIG[key].label}</Option>
              ))}
            </Select>
          </Col>
          <Col span={3}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>币种</div>
            <Select value={filterCurrency} onChange={setFilterCurrency} style={{ width: '100%' }}>
              <Option value="ALL">全部币种</Option>
              {(Object.keys(CURRENCY_CONFIG) as Currency[]).map(key => (
                <Option key={key} value={key}>{CURRENCY_CONFIG[key].label}</Option>
              ))}
            </Select>
          </Col>
          <Col span={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条记录` }}
        />
      </Card>

      {/* 详情 Drawer */}
      <FeeInputDetail
        visible={detailVisible}
        feeId={currentDetailId}
        onClose={() => setDetailVisible(false)}
      />

      {/* 审批弹窗 */}
      <Modal
        title="费用审批"
        open={approvalModalVisible}
        onCancel={() => { setApprovalModalVisible(false); form.resetFields(); }}
        onOk={handleApproval}
        okText={watchResult === 'REJECTED' ? '确认驳回' : '确认审批'}
        okButtonProps={{ danger: watchResult === 'REJECTED' }}
        width={650}
        destroyOnClose
      >
        {selectedRecord && (
          <>
            {/* 费用摘要信息 */}
            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>费用编号</Text>
                    <div><Text strong>{selectedRecord.feeNo}</Text></div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>关联单号</Text>
                    <div><Text strong>{selectedRecord.relatedNo}</Text></div>
                  </div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>费用类型</Text>
                    <div>{FEE_TYPE_CONFIG[selectedRecord.feeType] ? <Tag color={FEE_TYPE_CONFIG[selectedRecord.feeType].color}>{FEE_TYPE_CONFIG[selectedRecord.feeType].label}</Tag> : <Tag>{selectedRecord.feeType}</Tag>}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>费用方向</Text>
                    <div>
                      <Tag color={selectedRecord.feeDirection === 'PAYABLE' ? 'red' : 'green'}>
                        {selectedRecord.feeDirection === 'PAYABLE' ? '应付' : '应收'}
                      </Tag>
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>金额</Text>
                    <div>
                      <Text strong style={{ fontSize: 18, color: selectedRecord.feeDirection === 'PAYABLE' ? '#cf1322' : '#3f8600' }}>
                        {(CURRENCY_CONFIG[selectedRecord.currency]?.symbol || selectedRecord.currency + ' ')}{selectedRecord.amount.toFixed(2)}
                      </Text>
                      {selectedRecord.currency !== 'CNY' && selectedRecord.amountCNY && (
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                          ≈ ¥{selectedRecord.amountCNY.toFixed(2)}
                        </Text>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>{selectedRecord.feeDirection === 'PAYABLE' ? '供应商' : '客户'}</Text>
                    <div>{selectedRecord.supplierName || selectedRecord.customerName || '-'}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>申请人</Text>
                    <div>{selectedRecord.createdByName}</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>申请时间</Text>
                    <div>{dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm')}</div>
                  </div>
                </Col>
              </Row>
              {selectedRecord.description && (
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>费用说明</Text>
                  <div>{selectedRecord.description}</div>
                </div>
              )}
            </Card>

            <Divider style={{ margin: '12px 0' }} />

            <Form form={form} layout="vertical">
              <Form.Item
                name="approvalResult"
                label="审批结果"
                rules={[{ required: true, message: '请选择审批结果' }]}
              >
                <Select placeholder="请选择审批结果" size="large">
                  <Option value="APPROVED">
                    <Space><CheckOutlined style={{ color: '#52c41a' }} />审批通过</Space>
                  </Option>
                  <Option value="REJECTED">
                    <Space><CloseOutlined style={{ color: '#ff4d4f' }} />驳回</Space>
                  </Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="approvalRemark"
                label="审批意见"
                rules={[
                  { required: watchResult === 'REJECTED', message: '驳回时必须填写审批意见' }
                ]}
              >
                <TextArea
                  rows={3}
                  placeholder={watchResult === 'REJECTED' ? '请输入驳回原因（必填）' : '请输入审批意见（选填）'}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};
