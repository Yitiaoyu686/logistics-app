import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Select, Input, InputNumber,
  Space, Tag, Button, Alert, message, Typography
} from 'antd';
import {
  WarningOutlined, ReloadOutlined, MailOutlined, EyeOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { Option } = Select;

// ==================== 类型定义 ====================

interface AgingOrder {
  orderId: string;
  orderNo: string;
  amount: number;
  receivedAmount: number;
  outstanding: number;
  dueDate: string;
  overdueDays: number;
  salesPerson: string;
}

interface AgingCustomer {
  id: string;
  customerName: string;
  customerCode: string;
  salesPerson: string;
  totalReceivable: number;
  totalReceived: number;
  totalOutstanding: number;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91to180: number;
  days180plus: number;
  orders: AgingOrder[];
}

// ==================== 工具函数 ====================

const getAgingColor = (days: number): string => {
  if (days <= 0) return '#52c41a';
  if (days <= 30) return '#faad14';
  if (days <= 60) return '#fa8c16';
  if (days <= 90) return '#ff7a45';
  return '#cf1322';
};

const formatMoney = (val: number): string => {
  return `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ==================== 数据状态（待接入API） ====================

// ==================== 组件 ====================

export const ReceivableAging: React.FC = () => {
  const [agingCustomers] = useState<AgingCustomer[]>([]);
  const [searchText, setSearchText] = useState('');
  const [salesFilter, setSalesFilter] = useState<string>('ALL');
  const [minOverdueDays, setMinOverdueDays] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 获取所有业务员列表
  const salesPersons = useMemo(() => {
    const set = new Set<string>();
    agingCustomers.forEach((c) => set.add(c.salesPerson));
    return Array.from(set).sort();
  }, []);

  // 过滤客户
  const filteredCustomers = useMemo(() => {
    return agingCustomers.filter((c) => {
      // 搜索过滤
      if (searchText) {
        const keyword = searchText.toLowerCase();
        if (
          !c.customerName.toLowerCase().includes(keyword) &&
          !c.customerCode.toLowerCase().includes(keyword)
        ) {
          return false;
        }
      }
      // 业务员过滤
      if (salesFilter !== 'ALL' && c.salesPerson !== salesFilter) {
        return false;
      }
      // 最小逾期天数过滤
      if (minOverdueDays !== null && minOverdueDays > 0) {
        const maxOverdue = Math.max(...c.orders.map((o) => o.overdueDays));
        if (maxOverdue < minOverdueDays) {
          return false;
        }
      }
      return true;
    });
  }, [searchText, salesFilter, minOverdueDays]);

  // 统计汇总
  const summary = useMemo(() => {
    const all = agingCustomers;
    const totalOutstanding = all.reduce((s, c) => s + c.totalOutstanding, 0);
    const totalCurrent = all.reduce((s, c) => s + c.current, 0);
    const total1to30 = all.reduce((s, c) => s + c.days1to30, 0);
    const total31to60 = all.reduce((s, c) => s + c.days31to60, 0);
    const total61to90 = all.reduce((s, c) => s + c.days61to90, 0);
    const total91to180 = all.reduce((s, c) => s + c.days91to180, 0);
    const total180plus = all.reduce((s, c) => s + c.days180plus, 0);
    const total90plus = total91to180 + total180plus;

    return {
      totalOutstanding,
      totalCurrent,
      total1to30,
      total31to60,
      total61to90,
      total90plus,
      total91to180,
      total180plus,
      pctCurrent: totalOutstanding > 0 ? ((totalCurrent / totalOutstanding) * 100).toFixed(1) : '0.0',
      pct1to30: totalOutstanding > 0 ? ((total1to30 / totalOutstanding) * 100).toFixed(1) : '0.0',
      pct31to60: totalOutstanding > 0 ? ((total31to60 / totalOutstanding) * 100).toFixed(1) : '0.0',
      pct61to90: totalOutstanding > 0 ? ((total61to90 / totalOutstanding) * 100).toFixed(1) : '0.0',
      pct90plus: totalOutstanding > 0 ? ((total90plus / totalOutstanding) * 100).toFixed(1) : '0.0',
    };
  }, []);

  // 是否有90+天逾期客户
  const has90PlusOverdue = useMemo(() => {
    return agingCustomers.some((c) => c.days91to180 > 0 || c.days180plus > 0);
  }, []);

  // 重置筛选
  const handleReset = () => {
    setSearchText('');
    setSalesFilter('ALL');
    setMinOverdueDays(null);
    setSelectedRowKeys([]);
  };

  // 批量催收
  const handleBatchCollect = () => {
    message.success(`已向 ${selectedRowKeys.length} 个客户发送催收通知`);
    setSelectedRowKeys([]);
  };

  // 单个催收
  const handleCollect = (record: AgingCustomer) => {
    message.success(`已向 ${record.customerName} 发送催收通知`);
  };

  // 查看详情
  const handleViewDetail = (record: AgingCustomer) => {
    message.info(`查看客户 ${record.customerName} 的应收详情`);
  };

  // 渲染金额单元格（着色）
  const renderColoredAmount = (val: number, color: string) => {
    if (val === 0) {
      return <Text type="secondary">-</Text>;
    }
    return (
      <Text style={{ color, fontWeight: 500 }}>
        {formatMoney(val)}
      </Text>
    );
  };

  // 嵌套表格：客户订单
  const expandedRowRender = (customer: AgingCustomer) => {
    const orderColumns: ColumnsType<AgingOrder> = [
      {
        title: '运单号',
        dataIndex: 'orderNo',
        key: 'orderNo',
        width: 200,
        render: (val: string) => (
          <Text strong style={{ color: '#1677ff' }}>{val}</Text>
        ),
      },
      {
        title: '到期日',
        dataIndex: 'dueDate',
        key: 'dueDate',
        width: 120,
        render: (val: string) => dayjs(val).format('YYYY-MM-DD'),
      },
      {
        title: '逾期天数',
        dataIndex: 'overdueDays',
        key: 'overdueDays',
        width: 120,
        align: 'center' as const,
        render: (days: number) => {
          if (days <= 0) {
            return <Tag color="green">未逾期</Tag>;
          }
          let color = 'gold';
          if (days > 60) color = 'red';
          else if (days > 30) color = 'orange';
          return (
            <Tag color={color} icon={<ClockCircleOutlined />}>
              {days}天
            </Tag>
          );
        },
      },
      {
        title: '应收金额',
        dataIndex: 'amount',
        key: 'amount',
        width: 130,
        align: 'right' as const,
        render: (val: number) => formatMoney(val),
      },
      {
        title: '已收金额',
        dataIndex: 'receivedAmount',
        key: 'receivedAmount',
        width: 130,
        align: 'right' as const,
        render: (val: number) => (
          <Text style={{ color: '#52c41a' }}>{formatMoney(val)}</Text>
        ),
      },
      {
        title: '未收金额',
        dataIndex: 'outstanding',
        key: 'outstanding',
        width: 130,
        align: 'right' as const,
        render: (val: number, record: AgingOrder) => (
          <Text strong style={{ color: getAgingColor(record.overdueDays) }}>
            {formatMoney(val)}
          </Text>
        ),
      },
    ];

    return (
      <Table<AgingOrder>
        columns={orderColumns}
        dataSource={customer.orders}
        rowKey="orderId"
        pagination={false}
        size="small"
        style={{ margin: '0 0 0 16px' }}
      />
    );
  };

  // 主表格列
  const mainColumns: ColumnsType<AgingCustomer> = [
    {
      title: '客户名称',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 200,
      fixed: 'left' as const,
      render: (name: string, record: AgingCustomer) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.customerCode}</Text>
        </div>
      ),
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 90,
    },
    {
      title: '应收总额',
      dataIndex: 'totalOutstanding',
      key: 'totalOutstanding',
      width: 140,
      align: 'right' as const,
      sorter: (a: AgingCustomer, b: AgingCustomer) => a.totalOutstanding - b.totalOutstanding,
      render: (val: number) => (
        <Text strong>{formatMoney(val)}</Text>
      ),
    },
    {
      title: '未逾期',
      dataIndex: 'current',
      key: 'current',
      width: 130,
      align: 'right' as const,
      sorter: (a: AgingCustomer, b: AgingCustomer) => a.current - b.current,
      render: (val: number) => renderColoredAmount(val, '#52c41a'),
    },
    {
      title: '1-30天',
      dataIndex: 'days1to30',
      key: 'days1to30',
      width: 130,
      align: 'right' as const,
      sorter: (a: AgingCustomer, b: AgingCustomer) => a.days1to30 - b.days1to30,
      render: (val: number) => renderColoredAmount(val, '#faad14'),
    },
    {
      title: '31-60天',
      dataIndex: 'days31to60',
      key: 'days31to60',
      width: 130,
      align: 'right' as const,
      sorter: (a: AgingCustomer, b: AgingCustomer) => a.days31to60 - b.days31to60,
      render: (val: number) => renderColoredAmount(val, '#fa8c16'),
    },
    {
      title: '61-90天',
      dataIndex: 'days61to90',
      key: 'days61to90',
      width: 130,
      align: 'right' as const,
      sorter: (a: AgingCustomer, b: AgingCustomer) => a.days61to90 - b.days61to90,
      render: (val: number) => renderColoredAmount(val, '#ff7a45'),
    },
    {
      title: '91-180天',
      dataIndex: 'days91to180',
      key: 'days91to180',
      width: 130,
      align: 'right' as const,
      sorter: (a: AgingCustomer, b: AgingCustomer) => a.days91to180 - b.days91to180,
      render: (val: number) => renderColoredAmount(val, '#cf1322'),
    },
    {
      title: '180天以上',
      dataIndex: 'days180plus',
      key: 'days180plus',
      width: 130,
      align: 'right' as const,
      sorter: (a: AgingCustomer, b: AgingCustomer) => a.days180plus - b.days180plus,
      render: (val: number) => renderColoredAmount(val, '#820014'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, record: AgingCustomer) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<MailOutlined />}
            onClick={() => handleCollect(record)}
          >
            催收
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看详情
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: '3px solid #1677ff',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>应收总额</Text>}
              value={summary.totalOutstanding}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1677ff', fontSize: 20, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              全部未收金额
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: '3px solid #52c41a',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>未逾期</Text>}
              value={summary.totalCurrent}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#52c41a', fontSize: 20, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              占比 {summary.pctCurrent}%
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: '3px solid #faad14',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>1-30天</Text>}
              value={summary.total1to30}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14', fontSize: 20, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              占比 {summary.pct1to30}%
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: '3px solid #fa8c16',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>31-60天</Text>}
              value={summary.total31to60}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#fa8c16', fontSize: 20, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              占比 {summary.pct31to60}%
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: '3px solid #ff7a45',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>61-90天</Text>}
              value={summary.total61to90}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#ff7a45', fontSize: 20, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              占比 {summary.pct61to90}%
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: '3px solid #cf1322',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>90天以上</Text>}
              value={summary.total90plus}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#cf1322', fontSize: 20, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              占比 {summary.pct90plus}%
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 风险警告 */}
      {has90PlusOverdue && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          message="存在严重逾期客户"
          description="有客户应收账款逾期超过90天，请及时跟进催收，必要时启动法律催收程序。"
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      {/* 筛选栏 */}
      <Card
        size="small"
        style={{ marginBottom: 16, borderRadius: 8 }}
      >
        <Space size="middle" wrap>
          <Input
            placeholder="客户搜索（名称/编号）"
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
            prefix={<span style={{ color: '#bfbfbf' }}>搜索</span>}
          />
          <Select
            value={salesFilter}
            onChange={(val) => setSalesFilter(val)}
            style={{ width: 150 }}
            placeholder="业务员"
          >
            <Option value="ALL">全部业务员</Option>
            {salesPersons.map((sp) => (
              <Option key={sp} value={sp}>{sp}</Option>
            ))}
          </Select>
          <Space size="small">
            <Text type="secondary" style={{ fontSize: 13 }}>最小逾期天数:</Text>
            <InputNumber
              min={0}
              max={365}
              value={minOverdueDays}
              onChange={(val) => setMinOverdueDays(val)}
              placeholder="天数"
              style={{ width: 100 }}
            />
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
          >
            重置
          </Button>
        </Space>
      </Card>

      {/* 批量操作栏 + 表格 */}
      <Card
        size="small"
        style={{ borderRadius: 8 }}
        title={
          <Space>
            <ClockCircleOutlined />
            <span>应收账龄分析</span>
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
              （共 {filteredCustomers.length} 个客户）
            </Text>
          </Space>
        }
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>
              已选 {selectedRowKeys.length} 个客户
            </Text>
            <Button
              type="primary"
              icon={<MailOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleBatchCollect}
            >
              批量催收
            </Button>
          </Space>
        }
      >
        <Table<AgingCustomer>
          columns={mainColumns}
          dataSource={filteredCustomers}
          rowKey="id"
          rowSelection={rowSelection}
          expandable={{
            expandedRowRender,
            rowExpandable: (record) => record.orders.length > 0,
          }}
          scroll={{ x: 1500 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="middle"
          summary={() => {
            const totals = filteredCustomers.reduce(
              (acc, c) => ({
                totalOutstanding: acc.totalOutstanding + c.totalOutstanding,
                current: acc.current + c.current,
                days1to30: acc.days1to30 + c.days1to30,
                days31to60: acc.days31to60 + c.days31to60,
                days61to90: acc.days61to90 + c.days61to90,
                days91to180: acc.days91to180 + c.days91to180,
                days180plus: acc.days180plus + c.days180plus,
              }),
              {
                totalOutstanding: 0,
                current: 0,
                days1to30: 0,
                days31to60: 0,
                days61to90: 0,
                days91to180: 0,
                days180plus: 0,
              }
            );

            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa' }}>
                  <Table.Summary.Cell index={0} colSpan={1}>
                    {/* checkbox column placeholder */}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} colSpan={1}>
                    {/* expand column placeholder */}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <Text strong>合计</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>
                    {/* salesPerson placeholder */}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong>{formatMoney(totals.totalOutstanding)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong style={{ color: '#52c41a' }}>{formatMoney(totals.current)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong style={{ color: '#faad14' }}>{formatMoney(totals.days1to30)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    <Text strong style={{ color: '#fa8c16' }}>{formatMoney(totals.days31to60)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right">
                    <Text strong style={{ color: '#ff7a45' }}>{formatMoney(totals.days61to90)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={9} align="right">
                    <Text strong style={{ color: '#cf1322' }}>{formatMoney(totals.days91to180)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={10} align="right">
                    <Text strong style={{ color: '#820014' }}>{formatMoney(totals.days180plus)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={11}>
                    {/* action column placeholder */}
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>

      {/* 历史年度欠款汇总 */}
      <Card
        size="small"
        style={{ borderRadius: 8, marginTop: 16 }}
        title="历史年度欠款汇总"
      >
        <Table
          dataSource={[
            { key: '1', year: '18-19年', air: 12500.00, sea: 35800.00, total: 48300.00 },
            { key: '2', year: '20年', air: 8900.00, sea: 22400.00, total: 31300.00 },
            { key: '3', year: '21年', air: 15600.00, sea: 41200.00, total: 56800.00 },
            { key: '4', year: '22年', air: 21300.00, sea: 53700.00, total: 75000.00 },
            { key: '5', year: '23年', air: 18700.00, sea: 46500.00, total: 65200.00 },
            { key: '6', year: '24年', air: 25100.00, sea: 61800.00, total: 86900.00 },
            { key: '7', year: '合计', air: 102100.00, sea: 261400.00, total: 363500.00, isSummary: true },
          ]}
          columns={[
            {
              title: '年度',
              dataIndex: 'year',
              key: 'year',
              width: 150,
              render: (val: string, record: any) => (
                <span style={{ fontWeight: record.isSummary ? 'bold' : 'normal' }}>{val}</span>
              ),
            },
            {
              title: '空运欠款(¥)',
              dataIndex: 'air',
              key: 'air',
              width: 150,
              align: 'right' as const,
              render: (val: number, record: any) => (
                <span style={{ fontWeight: record.isSummary ? 'bold' : 'normal' }}>
                  {formatMoney(val)}
                </span>
              ),
            },
            {
              title: '海运欠款(¥)',
              dataIndex: 'sea',
              key: 'sea',
              width: 150,
              align: 'right' as const,
              render: (val: number, record: any) => (
                <span style={{ fontWeight: record.isSummary ? 'bold' : 'normal' }}>
                  {formatMoney(val)}
                </span>
              ),
            },
            {
              title: '合计(¥)',
              dataIndex: 'total',
              key: 'total',
              width: 150,
              align: 'right' as const,
              render: (val: number, record: any) => (
                <span style={{ fontWeight: record.isSummary ? 'bold' : 'normal' }}>
                  {formatMoney(val)}
                </span>
              ),
            },
          ]}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};
