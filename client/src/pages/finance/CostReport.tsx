import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Table, DatePicker, Select, Space, Button, Tag, Statistic, Row, Col, message
} from 'antd';
import {
  FileTextOutlined, DownloadOutlined, FilterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { feeApi } from '../../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 费用明细类型定义
interface CostDetail {
  id: string;
  feeNo: string;
  jobNo: string;
  feeType: string;
  feeCategory: 'TRANSPORT' | 'CUSTOMS' | 'WAREHOUSE' | 'DELIVERY' | 'OTHER';
  amount: number;
  currency: string;
  supplier: string;
  paymentStatus: 'UNPAID' | 'PARTIAL_PAID' | 'PAID';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdBy: string;
  createdAt: string;
  paidAt?: string;
  remark?: string;
}

const mapFeeCategory = (feeType?: string): CostDetail['feeCategory'] => {
  if (feeType === 'FREIGHT') return 'TRANSPORT';
  if (feeType === 'CUSTOMS') return 'CUSTOMS';
  if (feeType === 'WAREHOUSE') return 'WAREHOUSE';
  if (feeType === 'DELIVERY') return 'DELIVERY';
  return 'OTHER';
};

const mapPaymentStatus = (status?: string): CostDetail['paymentStatus'] => {
  if (status === 'PAID') return 'PAID';
  if (status === 'APPROVED') return 'PARTIAL_PAID';
  return 'UNPAID';
};

const mapApprovalStatus = (status?: string): CostDetail['approvalStatus'] => {
  if (status === 'APPROVED' || status === 'PAID') return 'APPROVED';
  if (status === 'REJECTED') return 'REJECTED';
  return 'PENDING';
};

const normalizeCostDetails = (rows: any[]): CostDetail[] => {
  return rows.map((row, idx) => ({
    id: row.id || `COST-${idx}`,
    feeNo: row.feeNo || '-',
    jobNo: row.relatedType === 'JOB' ? (row.relatedNo || row.relatedId || '-') : '-',
    feeType: row.feeType || 'OTHER',
    feeCategory: mapFeeCategory(row.feeType),
    amount: Number(row.amount || 0),
    currency: row.currency || 'CNY',
    supplier: row.supplierName || row.customerName || '-',
    paymentStatus: mapPaymentStatus(row.status),
    approvalStatus: mapApprovalStatus(row.status),
    createdBy: row.createdBy || '-',
    createdAt: row.createdAt || new Date().toISOString(),
    paidAt: row.paidAt || undefined,
    remark: row.remark || undefined,
  }));
};

// 费用类别配置
const FEE_CATEGORY_CONFIG = {
  TRANSPORT: { label: '运输费用', color: 'blue' },
  CUSTOMS: { label: '报关费用', color: 'orange' },
  WAREHOUSE: { label: '仓储费用', color: 'green' },
  DELIVERY: { label: '配送费用', color: 'purple' },
  OTHER: { label: '其他费用', color: 'default' }
};

// 支付状态配置
const PAYMENT_STATUS_CONFIG = {
  UNPAID: { label: '未支付', color: 'default' },
  PARTIAL_PAID: { label: '部分支付', color: 'warning' },
  PAID: { label: '已支付', color: 'success' }
};

// 审批状态配置
const APPROVAL_STATUS_CONFIG = {
  PENDING: { label: '待审批', color: 'processing' },
  APPROVED: { label: '已审批', color: 'success' },
  REJECTED: { label: '已驳回', color: 'error' }
};

export const CostReport: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [loading, setLoading] = useState(false);
  const [costs, setCosts] = useState<CostDetail[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // 从 API 加载费用数据
  useEffect(() => {
    const fetchCosts = async () => {
      setLoading(true);
      try {
        const res: any = await feeApi.list();
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setCosts(normalizeCostDetails(rows));
      } catch (err: any) {
        console.error('加载成本明细失败:', err);
        message.error('加载成本明细失败');
      } finally {
        setLoading(false);
      }
    };
    fetchCosts();
  }, []);

  const filteredCosts = useMemo(() => {
    return costs.filter((row) => {
      if (selectedCategory !== 'ALL' && row.feeCategory !== selectedCategory) return false;
      if (selectedStatus !== 'ALL' && row.paymentStatus !== selectedStatus) return false;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const created = dayjs(row.createdAt);
        if (created.isBefore(dateRange[0], 'day') || created.isAfter(dateRange[1], 'day')) return false;
      }
      return true;
    });
  }, [costs, selectedCategory, selectedStatus, dateRange]);

  // 统计数据
  const totalAmount = filteredCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const paidAmount = filteredCosts.filter(c => c.paymentStatus === 'PAID').reduce((sum, c) => sum + c.amount, 0);
  const unpaidAmount = filteredCosts.filter(c => c.paymentStatus === 'UNPAID').reduce((sum, c) => sum + c.amount, 0);
  const costCount = filteredCosts.length;

  // 导出功能
  const handleExport = () => {
    console.log('导出成本明细报表');
  };

  // 表格列定义
  const columns = [
    {
      title: '费用编号',
      dataIndex: 'feeNo',
      key: 'feeNo',
      width: 180,
    },
    {
      title: '任务号',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 180,
    },
    {
      title: '费用类型',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 120,
    },
    {
      title: '费用类别',
      dataIndex: 'feeCategory',
      key: 'feeCategory',
      width: 120,
      render: (category: string) => {
        const config = FEE_CATEGORY_CONFIG[category as keyof typeof FEE_CATEGORY_CONFIG];
        return (
          <Tag color={config?.color ?? 'default'}>
            {config?.label ?? category}
          </Tag>
        );
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (val: number, record: CostDetail) => (
        <span style={{ fontWeight: 'bold' }}>
          {record.currency === 'CNY' ? '¥' : '$'}{val.toLocaleString()}
        </span>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 150,
    },
    {
      title: '支付状态',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 100,
      render: (status: string) => {
        const config = PAYMENT_STATUS_CONFIG[status as keyof typeof PAYMENT_STATUS_CONFIG];
        return (
          <Tag color={config?.color ?? 'default'}>
            {config?.label ?? status}
          </Tag>
        );
      },
    },
    {
      title: '审批状态',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 100,
      render: (status: string) => {
        const config = APPROVAL_STATUS_CONFIG[status as keyof typeof APPROVAL_STATUS_CONFIG];
        return (
          <Tag color={config?.color ?? 'default'}>
            {config?.label ?? status}
          </Tag>
        );
      },
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总成本"
              value={totalAmount}
              prefix="¥"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已支付"
              value={paidAmount}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="未支付"
              value={unpaidAmount}
              prefix="¥"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="费用笔数"
              value={costCount}
              suffix="笔"
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选和操作区 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            placeholder={['开始日期', '结束日期']}
          />
          <Select
            style={{ width: 150 }}
            value={selectedCategory}
            onChange={setSelectedCategory}
            placeholder="费用类别"
          >
            <Option value="ALL">全部类别</Option>
            <Option value="TRANSPORT">运输费用</Option>
            <Option value="CUSTOMS">报关费用</Option>
            <Option value="WAREHOUSE">仓储费用</Option>
            <Option value="DELIVERY">配送费用</Option>
            <Option value="OTHER">其他费用</Option>
          </Select>
          <Select
            style={{ width: 150 }}
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder="支付状态"
          >
            <Option value="ALL">全部状态</Option>
            <Option value="UNPAID">未支付</Option>
            <Option value="PARTIAL_PAID">部分支付</Option>
            <Option value="PAID">已支付</Option>
          </Select>
          <Button type="primary" icon={<FilterOutlined />}>
            查询
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出报表
          </Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredCosts}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条记录`
          }}
        />
      </Card>
    </div>
  );
};
