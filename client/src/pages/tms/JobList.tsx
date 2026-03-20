import React, { useState, useEffect } from 'react';
import {
  Table, Button, Input, Select, DatePicker,
  Tag, Progress, Space, Tooltip, Row, Col, message,
  Popover, Descriptions, Typography, Modal, Form, InputNumber
} from 'antd';
import {
  PlusOutlined, SearchOutlined, RocketOutlined, ContainerOutlined,
  EnvironmentOutlined, EditOutlined,
  DollarOutlined, NodeIndexOutlined, EyeOutlined
} from '@ant-design/icons';
import { NodeUpdateModal } from './NodeUpdateModal';
import { jobApi } from '../../api';
import type { Job, OriginPhaseStatus } from '../../types/core';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;

// 起运国阶段状态配置
const ORIGIN_STATUS_CONFIG: Record<OriginPhaseStatus, { label: string; color: string }> = {
  PLANNED: { label: '计划中', color: 'blue' },
  LOADING: { label: '装载中', color: 'processing' },
  CUSTOMS_EXPORT: { label: '出口报关', color: 'orange' },
  DEPARTED: { label: '已发运', color: 'success' }
};

interface JobListProps {
  onEdit: (jobId: string) => void;
  onCreate: () => void;
  onView: (jobId: string) => void;
}

export const JobList: React.FC<JobListProps> = ({ onEdit, onCreate, onView }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [nodeModalVisible, setNodeModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // 从 API 加载任务列表
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res: any = await jobApi.list();
      setJobs(res.data || []);
    } catch (error: any) {
      message.error(error.message || '加载任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // 费用Modal状态
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [feeForm] = Form.useForm();

  // 打开节点更新 Modal
  const handleNodeUpdate = (job: Job) => {
    setSelectedJob(job);
    setNodeModalVisible(true);
  };

  // 打开费用录入 Modal
  const handleOpenFeeModal = (job: Job) => {
    setSelectedJob(job);
    setFeeModalVisible(true);
  };

  // 提交费用
  const handleSubmitFee = async () => {
    try {
      const values = await feeForm.validateFields();
      console.log('提交费用:', {
        jobNo: selectedJob?.jobNo,
        ...values
      });
      message.success('费用添加成功');
      setFeeModalVisible(false);
      feeForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 确认更新节点
  const handleNodeUpdateConfirm = (jobNo: string, newNode: string, exceptionInfo?: { hasException: boolean; remark?: string }) => {
    setJobs(prevJobs =>
      prevJobs.map(job =>
        job.jobNo === jobNo ? { ...job, status: newNode as any } : job
      )
    );

    // 如果有异常信息，可以在这里记录或发送到后端
    if (exceptionInfo?.hasException) {
      console.log('节点异常信息:', {
        jobNo,
        newNode,
        exceptionRemark: exceptionInfo.remark
      });
      // TODO: 发送异常信息到后端
    }

    setNodeModalVisible(false);
    setSelectedJob(null);
  };

  const columns = [
    {
      title: '任务号',
      dataIndex: 'jobNo',
      width: 180,
      render: (t: string, r: Job) => (
        <div>
          <a onClick={() => onView(r.jobNo)} style={{ fontWeight: 'bold' }}>{t}</a>
          <div style={{ marginTop: 4 }}>
            {r.transportType === 'SEA' ? <ContainerOutlined style={{ color: '#1890ff' }} /> : <RocketOutlined style={{ color: '#722ed1' }} />}
            <span style={{ marginLeft: 8, color: '#666' }}>海运</span>
          </div>
        </div>
      )
    },
    {
      title: '起运 / 目的',
      width: 200,
      render: (r: Job) => (
        <div>
          <div><EnvironmentOutlined /> {r.route.split('→')[0]}</div>
          <div style={{ color: '#999', paddingLeft: 4 }}>↓</div>
          <div><EnvironmentOutlined /> {r.route.split('→')[1]}</div>
        </div>
      )
    },
    {
      title: '船名/航次',
      dataIndex: 'vessel',
      width: 150,
      render: () => 'CLX / 045W'
    },
    {
      title: '时间节点',
      width: 180,
      render: (r: Job) => (
        <div style={{ fontSize: 13 }}>
          <div>ETD: {r.etd}</div>
          <div style={{ color: '#999' }}>ETA: {r.eta}</div>
        </div>
      )
    },
    {
      title: '装载率',
      width: 180,
      render: (r: Job) => {
        if (!r.stats || !r.capacity || r.capacity.volume === 0) {
          return <Text type="secondary">无数据</Text>;
        }

        const volumeRate = (r.stats.volume / r.capacity.volume) * 100;
        const weightRate = (r.stats.weight / r.capacity.weight) * 100;

        return (
          <Popover
            content={
              <div style={{ width: 200 }}>
                <Descriptions column={1} size="small" colon={false}>
                  <Descriptions.Item label="集装箱">
                    {r.stats.containers} 个
                  </Descriptions.Item>
                  <Descriptions.Item label="体积">
                    {r.stats.volume.toFixed(1)} / {r.capacity.volume.toFixed(0)} m³
                  </Descriptions.Item>
                  <Descriptions.Item label="重量">
                    {(r.stats.weight / 1000).toFixed(1)} / {(r.capacity.weight / 1000).toFixed(0)} t
                  </Descriptions.Item>
                  <Descriptions.Item label="订单">
                    {r.stats.orders} 票 / {r.stats.pieces} 件
                  </Descriptions.Item>
                </Descriptions>
              </div>
            }
            title="装载详情"
            trigger="hover"
          >
            <div style={{ fontSize: 12, cursor: 'pointer' }}>
              {/* 体积利用率 */}
              <div style={{ marginBottom: 4 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 2
                }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>体积</Text>
                  <Text strong style={{ fontSize: 11 }}>
                    {volumeRate.toFixed(0)}%
                  </Text>
                </div>
                <Progress
                  percent={Number(volumeRate.toFixed(1))}
                  size="small"
                  strokeWidth={6}
                  status={volumeRate > 90 ? 'exception' : 'active'}
                  showInfo={false}
                />
              </div>

              {/* 重量利用率 */}
              <div style={{ marginBottom: 6 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 2
                }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>重量</Text>
                  <Text strong style={{ fontSize: 11 }}>
                    {weightRate.toFixed(0)}%
                  </Text>
                </div>
                <Progress
                  percent={Number(weightRate.toFixed(1))}
                  size="small"
                  strokeWidth={6}
                  status={weightRate > 90 ? 'exception' : 'active'}
                  showInfo={false}
                />
              </div>

              {/* 底部统计 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#999'
              }}>
                <span>{r.stats.containers}箱</span>
                <span>{r.stats.orders}票</span>
                <span>{r.stats.pieces}件</span>
              </div>
            </div>
          </Popover>
        );
      }
    },
    {
      title: '起运国状态',
      dataIndex: 'originPhaseStatus',
      width: 120,
      render: (status: OriginPhaseStatus) => {
        const config = ORIGIN_STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: '起运国操作员',
      dataIndex: 'originOperator',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '操作',
      width: 220,
      render: (r: Job) => (
        <Space>
          <Tooltip title="查看详情">
            <Button size="small" icon={<EyeOutlined />} onClick={() => onView(r.jobNo)} />
          </Tooltip>
          <Tooltip title="配载/装柜">
            <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => onEdit(r.jobNo)} />
          </Tooltip>
          <Tooltip title="节点更新">
            <Button size="small" icon={<NodeIndexOutlined />} onClick={() => handleNodeUpdate(r)} />
          </Tooltip>
          <Tooltip title="费用">
            <Button size="small" icon={<DollarOutlined />} onClick={() => handleOpenFeeModal(r)} />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100%' }}>
      {/* Toolbar */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Select defaultValue="ALL" style={{ width: 120 }}>
            <Option value="ALL">全部方式</Option>
            <Option value="SEA">海运</Option>
            <Option value="AIR">空运</Option>
          </Select>
          <Select defaultValue="ALL" style={{ width: 120 }}>
            <Option value="ALL">全部状态</Option>
            <Option value="PLANNED">计划中</Option>
            <Option value="DEPARTED">运输中</Option>
          </Select>
          <RangePicker placeholder={['截关开始', '截关结束']} style={{ width: 220 }} />
          <Input placeholder="搜索任务号/船名" prefix={<SearchOutlined />} style={{ width: 200 }} />
          <Button type="primary">查询</Button>
        </Space>
        
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新建任务
        </Button>
      </div>

      <Table
        rowKey="jobNo"
        columns={columns}
        dataSource={jobs}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 节点更新 Modal */}
      <NodeUpdateModal
        visible={nodeModalVisible}
        jobId={selectedJob?.jobNo || ''}
        currentStatus={selectedJob?.status || ''}
        onCancel={() => {
          setNodeModalVisible(false);
          setSelectedJob(null);
        }}
        onConfirm={handleNodeUpdateConfirm}
      />

      {/* 费用录入 Modal */}
      <Modal
        title="添加额外费用"
        open={feeModalVisible}
        onCancel={() => {
          setFeeModalVisible(false);
          feeForm.resetFields();
        }}
        onOk={handleSubmitFee}
        width={600}
        zIndex={2000}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">任务号: </Text>
          <Text strong>{selectedJob?.jobNo}</Text>
        </div>
        <Form form={feeForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="费用类别"
                rules={[{ required: true, message: '请选择费用类别' }]}
              >
                <Select placeholder="选择费用类别">
                  <Select.Option value="海运费">海运费</Select.Option>
                  <Select.Option value="空运费">空运费</Select.Option>
                  <Select.Option value="报关费">报关费</Select.Option>
                  <Select.Option value="仓储费">仓储费</Select.Option>
                  <Select.Option value="拖车费">拖车费</Select.Option>
                  <Select.Option value="文件费">文件费</Select.Option>
                  <Select.Option value="检验费">检验费</Select.Option>
                  <Select.Option value="滞港费">滞港费</Select.Option>
                  <Select.Option value="其他费用">其他费用</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="item"
                label="费用项目"
                rules={[{ required: true, message: '请输入费用项目' }]}
              >
                <Input placeholder="例如: 额外仓储3天" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="金额"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入金额"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="currency"
                label="币种"
                rules={[{ required: true, message: '请选择币种' }]}
                initialValue="CNY"
              >
                <Select>
                  <Select.Option value="CNY">CNY (人民币)</Select.Option>
                  <Select.Option value="USD">USD (美元)</Select.Option>
                  <Select.Option value="EUR">EUR (欧元)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="supplier"
            label="供应商/收款方"
          >
            <Input placeholder="例如: 深圳港务局" />
          </Form.Item>

          <Form.Item
            name="remark"
            label="备注说明"
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入费用产生原因、详细说明等"
            />
          </Form.Item>

          <Form.Item
            name="status"
            label="费用状态"
            rules={[{ required: true, message: '请选择费用状态' }]}
            initialValue="PENDING"
          >
            <Select>
              <Select.Option value="PENDING">待确认</Select.Option>
              <Select.Option value="CONFIRMED">已确认</Select.Option>
              <Select.Option value="PAID">已支付</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
