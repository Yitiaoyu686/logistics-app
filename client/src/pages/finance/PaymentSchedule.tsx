import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Select, Input, DatePicker,
  Space, Tag, Button, Alert, message, Typography, Modal, Form, Segmented
} from 'antd';
import {
  DollarOutlined, WarningOutlined, ReloadOutlined, CalendarOutlined,
  ClockCircleOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { Text } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// ==================== 类型定义 ====================

interface ScheduleItem {
  id: string;
  feeNo: string;
  supplierName: string;
  jobNo: string;
  route: string;
  feeType: string;
  amount: number;
  currency: 'CNY' | 'USD' | 'EUR';
  amountCNY: number;
  dueDate: string;
  overdueDays: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'SCHEDULED' | 'PAID';
  remark?: string;
}

// ==================== 辅助函数 ====================

const calcOverdueDays = (dueDate: string): number => {
  const today = dayjs('2026-02-09');
  const due = dayjs(dueDate);
  return today.diff(due, 'day');
};

const calcPriority = (overdueDays: number): 'HIGH' | 'MEDIUM' | 'LOW' => {
  if (overdueDays > 0) return 'HIGH';
  if (overdueDays >= -3) return 'HIGH';
  if (overdueDays >= -7) return 'MEDIUM';
  return 'LOW';
};

const formatCurrency = (amount: number, currency: string): string => {
  const symbols: Record<string, string> = { CNY: '¥', USD: '$', EUR: '€' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ==================== 数据状态（待接入API） ====================

// ==================== 常量 ====================

const PRIORITY_CONFIG: Record<string, { text: string; color: string }> = {
  HIGH: { text: '高', color: 'red' },
  MEDIUM: { text: '中', color: 'orange' },
  LOW: { text: '低', color: 'blue' },
};

const STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待付', color: 'orange' },
  SCHEDULED: { text: '已排期', color: 'blue' },
  PAID: { text: '已付', color: 'green' },
};

const FEE_TYPE_COLORS: Record<string, string> = {
  '海运费': 'blue',
  '空运费': 'cyan',
  '报关费': 'purple',
  '拖车费': 'geekblue',
  '仓储费': 'volcano',
  '派送费': 'green',
  '港杂费': 'magenta',
  '清关费': 'gold',
};

// ==================== 组件 ====================

export const PaymentSchedule: React.FC = () => {
  // 数据状态
  const [dataSource, setDataSource] = useState<ScheduleItem[]>([]);

  // 筛选状态
  const [searchSupplier, setSearchSupplier] = useState('');
  const [filterCurrency, setFilterCurrency] = useState<string>('ALL');
  const [filterFeeType, setFilterFeeType] = useState<string>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  // 视图状态
  const [viewMode, setViewMode] = useState<string>('list');

  // 选择状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 调整日期弹窗
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<ScheduleItem | null>(null);
  const [adjustForm] = Form.useForm();

  // 获取所有费用类型
  const feeTypes = useMemo(() => {
    const types = new Set(dataSource.map((item) => item.feeType));
    return Array.from(types).sort();
  }, [dataSource]);

  // 过滤后的数据
  const filteredData = useMemo(() => {
    return dataSource.filter((item) => {
      if (searchSupplier && !item.supplierName.toLowerCase().includes(searchSupplier.toLowerCase())) {
        return false;
      }
      if (filterCurrency !== 'ALL' && item.currency !== filterCurrency) {
        return false;
      }
      if (filterFeeType !== 'ALL' && item.feeType !== filterFeeType) {
        return false;
      }
      if (filterDateRange && filterDateRange[0] && filterDateRange[1]) {
        const due = dayjs(item.dueDate);
        if (due.isBefore(filterDateRange[0], 'day') || due.isAfter(filterDateRange[1], 'day')) {
          return false;
        }
      }
      return true;
    });
  }, [dataSource, searchSupplier, filterCurrency, filterFeeType, filterDateRange]);

  // 统计数据
  const stats = useMemo(() => {
    const today = dayjs('2026-02-09');
    const weekEnd = dayjs('2026-02-15');
    const nextWeekStart = dayjs('2026-02-16');
    const nextWeekEnd = dayjs('2026-02-22');
    const monthEnd = dayjs('2026-02-28');

    const unpaid = dataSource.filter((item) => item.status !== 'PAID');

    const overdue = unpaid.filter((item) => item.overdueDays > 0);
    const overdueAmount = overdue.reduce((sum, item) => sum + item.amountCNY, 0);
    const overdueCount = overdue.length;

    const thisWeek = unpaid.filter((item) => {
      const due = dayjs(item.dueDate);
      return due.isSameOrAfter(today, 'day') && due.isSameOrBefore(weekEnd, 'day');
    });
    const thisWeekAmount = thisWeek.reduce((sum, item) => sum + item.amountCNY, 0);

    const nextWeek = unpaid.filter((item) => {
      const due = dayjs(item.dueDate);
      return due.isSameOrAfter(nextWeekStart, 'day') && due.isSameOrBefore(nextWeekEnd, 'day');
    });
    const nextWeekAmount = nextWeek.reduce((sum, item) => sum + item.amountCNY, 0);

    const thisMonth = unpaid.filter((item) => {
      const due = dayjs(item.dueDate);
      return due.isSameOrBefore(monthEnd, 'day');
    });
    const thisMonthAmount = thisMonth.reduce((sum, item) => sum + item.amountCNY, 0);

    return { overdueAmount, overdueCount, thisWeekAmount, nextWeekAmount, thisMonthAmount };
  }, [dataSource]);

  // 按周分组
  const weeklyGroups = useMemo(() => {
    const groups: Record<string, { title: string; items: ScheduleItem[]; subtotal: number }> = {};

    const sorted = [...filteredData].sort((a, b) => dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf());

    sorted.forEach((item) => {
      const due = dayjs(item.dueDate);
      const weekNum = due.isoWeek();
      const year = due.isoWeekYear();
      const weekStart = due.startOf('isoWeek').format('MM/DD');
      const weekEnd = due.endOf('isoWeek').format('MM/DD');
      const key = `${year}-W${weekNum}`;

      if (!groups[key]) {
        groups[key] = {
          title: `第${weekNum}周 (${weekStart} - ${weekEnd})`,
          items: [],
          subtotal: 0,
        };
      }
      groups[key].items.push(item);
      groups[key].subtotal += item.amountCNY;
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredData]);

  // 重置筛选
  const handleReset = () => {
    setSearchSupplier('');
    setFilterCurrency('ALL');
    setFilterFeeType('ALL');
    setFilterDateRange(null);
    setSelectedRowKeys([]);
  };

  // 立即付款
  const handlePay = (item: ScheduleItem) => {
    Modal.confirm({
      title: '确认付款',
      icon: <DollarOutlined style={{ color: '#52c41a' }} />,
      content: (
        <div>
          <p><Text strong>费用编号：</Text>{item.feeNo}</p>
          <p><Text strong>供应商：</Text>{item.supplierName}</p>
          <p><Text strong>费用类型：</Text>{item.feeType}</p>
          <p><Text strong>金额：</Text>{formatCurrency(item.amount, item.currency)}
            {item.currency !== 'CNY' && <Text type="secondary"> (折合 ¥{item.amountCNY.toLocaleString()})</Text>}
          </p>
          <p><Text strong>到期日：</Text>{item.dueDate}</p>
        </div>
      ),
      okText: '确认付款',
      cancelText: '取消',
      onOk() {
        setDataSource((prev) =>
          prev.map((d) =>
            d.id === item.id
              ? { ...d, status: 'PAID' as const }
              : d
          )
        );
        setSelectedRowKeys((prev) => prev.filter((key) => key !== item.id));
        message.success(`费用 ${item.feeNo} 已完成付款`);
      },
    });
  };

  // 批量付款
  const handleBatchPay = () => {
    const selected = filteredData.filter((item) => selectedRowKeys.includes(item.id));
    const totalCNY = selected.reduce((sum, item) => sum + item.amountCNY, 0);

    Modal.confirm({
      title: '批量付款确认',
      icon: <DollarOutlined style={{ color: '#52c41a' }} />,
      content: (
        <div>
          <p>已选择 <Text strong>{selected.length}</Text> 笔费用</p>
          <p>总金额（折合CNY）：<Text strong style={{ color: '#f5222d' }}>¥{totalCNY.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</Text></p>
          <p>确认批量付款？</p>
        </div>
      ),
      okText: '确认付款',
      cancelText: '取消',
      onOk() {
        setDataSource((prev) =>
          prev.map((d) =>
            selectedRowKeys.includes(d.id)
              ? { ...d, status: 'PAID' as const }
              : d
          )
        );
        setSelectedRowKeys([]);
        message.success(`已成功付款 ${selected.length} 笔费用`);
      },
    });
  };

  // 调整日期
  const handleAdjustDate = (item: ScheduleItem) => {
    setAdjustingItem(item);
    adjustForm.resetFields();
    setAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async () => {
    try {
      const values = await adjustForm.validateFields();
      if (!adjustingItem) return;

      const newDueDate = (values.newDueDate as dayjs.Dayjs).format('YYYY-MM-DD');
      const newOverdueDays = calcOverdueDays(newDueDate);
      const newPriority = calcPriority(newOverdueDays);

      setDataSource((prev) =>
        prev.map((d) =>
          d.id === adjustingItem.id
            ? {
                ...d,
                dueDate: newDueDate,
                overdueDays: newOverdueDays,
                priority: newPriority,
                remark: values.reason,
              }
            : d
        )
      );

      setAdjustModalOpen(false);
      setAdjustingItem(null);
      message.success(`费用 ${adjustingItem.feeNo} 到期日已调整为 ${newDueDate}`);
    } catch {
      // 表单校验失败
    }
  };

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
    getCheckboxProps: (record: ScheduleItem) => ({
      disabled: record.status === 'PAID',
    }),
  };

  // 表格列定义
  const columns = [
    {
      title: '费用编号',
      dataIndex: 'feeNo',
      key: 'feeNo',
      width: 170,
      render: (text: string) => <Text copyable={{ text }} style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      key: 'supplierName',
      width: 130,
      ellipsis: true,
    },
    {
      title: '关联任务',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 180,
      render: (text: string, record: ScheduleItem) => (
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>{text}</div>
          <div style={{ fontSize: 11, color: '#999' }}>{record.route}</div>
        </div>
      ),
    },
    {
      title: '费用类型',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 100,
      render: (text: string) => (
        <Tag color={FEE_TYPE_COLORS[text] || 'default'}>{text}</Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 160,
      align: 'right' as const,
      sorter: (a: ScheduleItem, b: ScheduleItem) => a.amountCNY - b.amountCNY,
      render: (_: number, record: ScheduleItem) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatCurrency(record.amount, record.currency)}</div>
          {record.currency !== 'CNY' && (
            <div style={{ fontSize: 11, color: '#999' }}>≈ ¥{record.amountCNY.toLocaleString()}</div>
          )}
        </div>
      ),
    },
    {
      title: '到期日',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 160,
      sorter: (a: ScheduleItem, b: ScheduleItem) => dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf(),
      defaultSortOrder: 'ascend' as const,
      render: (text: string, record: ScheduleItem) => (
        <Space direction="vertical" size={0}>
          <Text>{text}</Text>
          {record.status !== 'PAID' && (
            record.overdueDays > 0
              ? <Tag color="red" style={{ fontSize: 11 }}>逾期{record.overdueDays}天</Tag>
              : record.overdueDays === 0
                ? <Tag color="orange" style={{ fontSize: 11 }}>今日到期</Tag>
                : <Tag color="green" style={{ fontSize: 11 }}>剩余{Math.abs(record.overdueDays)}天</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      filters: [
        { text: '高', value: 'HIGH' },
        { text: '中', value: 'MEDIUM' },
        { text: '低', value: 'LOW' },
      ],
      onFilter: (value: React.Key | boolean, record: ScheduleItem) => record.priority === value,
      render: (text: string) => {
        const config = PRIORITY_CONFIG[text];
        return config ? <Tag color={config.color}>{config.text}</Tag> : text;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      filters: [
        { text: '待付', value: 'PENDING' },
        { text: '已排期', value: 'SCHEDULED' },
        { text: '已付', value: 'PAID' },
      ],
      onFilter: (value: React.Key | boolean, record: ScheduleItem) => record.status === value,
      render: (text: string) => {
        const config = STATUS_CONFIG[text];
        return config ? <Tag color={config.color}>{config.text}</Tag> : text;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: ScheduleItem) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handlePay(record)}
            >
              立即付款
            </Button>
          )}
          {(record.status === 'PENDING' || record.status === 'SCHEDULED') && (
            <Button
              type="link"
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => handleAdjustDate(record)}
            >
              调整日期
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 分组视图的简化列
  const groupColumns = columns.filter((col) => col.key !== 'action').map((col) => {
    if (col.key === 'feeNo') return { ...col, width: 160 };
    return col;
  });

  return (
    <div style={{ padding: '0 4px' }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card
            style={{
              borderTop: '3px solid #f5222d',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 14 }}>已逾期</span>}
              value={stats.overdueAmount}
              precision={2}
              prefix={<span style={{ color: '#f5222d' }}>¥</span>}
              valueStyle={{ color: '#f5222d', fontSize: 22 }}
              suffix={
                <span style={{ fontSize: 13, color: '#999', fontWeight: 400 }}>
                  ({stats.overdueCount}笔)
                </span>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderTop: '3px solid #fa8c16',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 14 }}>本周待付</span>}
              value={stats.thisWeekAmount}
              precision={2}
              prefix={<span style={{ color: '#fa8c16' }}>¥</span>}
              valueStyle={{ color: '#fa8c16', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderTop: '3px solid #1890ff',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 14 }}>下周待付</span>}
              value={stats.nextWeekAmount}
              precision={2}
              prefix={<span style={{ color: '#1890ff' }}>¥</span>}
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderTop: '3px solid #52c41a',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<span style={{ fontSize: 14 }}>本月待付</span>}
              value={stats.thisMonthAmount}
              precision={2}
              prefix={<span style={{ color: '#52c41a' }}>¥</span>}
              valueStyle={{ color: '#52c41a', fontSize: 22 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 逾期预警 */}
      {stats.overdueCount > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          message={
            <span>
              有 <Text strong>{stats.overdueCount}</Text> 笔费用已逾期，总金额{' '}
              <Text strong style={{ color: '#f5222d' }}>
                ¥{stats.overdueAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </Text>
              ，请尽快处理
            </span>
          }
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="200px">
            <Input
              placeholder="供应商搜索"
              value={searchSupplier}
              onChange={(e) => setSearchSupplier(e.target.value)}
              allowClear
            />
          </Col>
          <Col flex="140px">
            <Select
              value={filterCurrency}
              onChange={setFilterCurrency}
              style={{ width: '100%' }}
            >
              <Select.Option value="ALL">全部币种</Select.Option>
              <Select.Option value="CNY">CNY</Select.Option>
              <Select.Option value="USD">USD</Select.Option>
              <Select.Option value="EUR">EUR</Select.Option>
            </Select>
          </Col>
          <Col flex="140px">
            <Select
              value={filterFeeType}
              onChange={setFilterFeeType}
              style={{ width: '100%' }}
            >
              <Select.Option value="ALL">全部费用类型</Select.Option>
              {feeTypes.map((type) => (
                <Select.Option key={type} value={type}>{type}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col flex="280px">
            <RangePicker
              value={filterDateRange as [dayjs.Dayjs, dayjs.Dayjs] | null}
              onChange={(dates) => setFilterDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
              placeholder={['到期开始日', '到期结束日']}
              style={{ width: '100%' }}
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          </Col>
        </Row>
      </Card>

      {/* 视图切换 & 批量操作 */}
      <Card style={{ borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space size="middle">
            <Segmented
              value={viewMode}
              onChange={(val) => setViewMode(val as string)}
              options={[
                { label: '列表视图', value: 'list', icon: <ClockCircleOutlined /> },
                { label: '按周分组', value: 'weekly', icon: <CalendarOutlined /> },
              ]}
            />
            {selectedRowKeys.length > 0 && (
              <Space>
                <Text type="secondary">已选 <Text strong>{selectedRowKeys.length}</Text> 笔</Text>
                <Button
                  type="primary"
                  icon={<DollarOutlined />}
                  onClick={handleBatchPay}
                >
                  批量付款
                </Button>
              </Space>
            )}
          </Space>
          <Text type="secondary">
            共 {filteredData.length} 条记录，合计 ¥
            {filteredData.reduce((sum, item) => sum + item.amountCNY, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
          </Text>
        </div>

        {/* 列表视图 */}
        {viewMode === 'list' && (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredData}
            rowSelection={rowSelection}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
            size="middle"
            scroll={{ x: 1200 }}
          />
        )}

        {/* 按周分组视图 */}
        {viewMode === 'weekly' && (
          <div>
            {weeklyGroups.map(([key, group]) => (
              <Card
                key={key}
                title={
                  <Space>
                    <CalendarOutlined />
                    <span>{group.title}</span>
                    <Tag color="blue">{group.items.length} 笔</Tag>
                  </Space>
                }
                extra={
                  <Text strong style={{ color: '#1890ff' }}>
                    小计：¥{group.subtotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </Text>
                }
                style={{ marginBottom: 12, borderRadius: 8 }}
                styles={{ body: { padding: 0 } }}
              >
                <Table
                  rowKey="id"
                  columns={groupColumns}
                  dataSource={group.items}
                  pagination={false}
                  size="small"
                  scroll={{ x: 1000 }}
                />
              </Card>
            ))}
            {weeklyGroups.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无数据
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 调整日期弹窗 */}
      <Modal
        title="调整付款日期"
        open={adjustModalOpen}
        onOk={handleAdjustSubmit}
        onCancel={() => {
          setAdjustModalOpen(false);
          setAdjustingItem(null);
        }}
        okText="确认调整"
        cancelText="取消"
        destroyOnClose
      >
        {adjustingItem && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 8 }}>
            <Row gutter={[16, 4]}>
              <Col span={12}><Text type="secondary">费用编号：</Text>{adjustingItem.feeNo}</Col>
              <Col span={12}><Text type="secondary">供应商：</Text>{adjustingItem.supplierName}</Col>
              <Col span={12}><Text type="secondary">金额：</Text>{formatCurrency(adjustingItem.amount, adjustingItem.currency)}</Col>
              <Col span={12}><Text type="secondary">当前到期日：</Text>{adjustingItem.dueDate}</Col>
            </Row>
          </div>
        )}
        <Form form={adjustForm} layout="vertical">
          <Form.Item
            name="newDueDate"
            label="新到期日"
            rules={[{ required: true, message: '请选择新到期日' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择新到期日" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="调整原因"
            rules={[{ required: true, message: '请输入调整原因' }]}
          >
            <TextArea rows={3} placeholder="请说明调整付款日期的原因" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
