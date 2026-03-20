import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Table, DatePicker, Select, Space, Button, Tag, Statistic, Row, Col, message
} from 'antd';
import {
  ShoppingOutlined, DownloadOutlined, FilterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { feeApi, orderApi } from '../../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 订单明细类型定义
interface OrderDetail {
  id: string;
  orderNo: string;
  customerName: string;
  route: string;
  pieces: number;
  weight: number;
  volume: number;
  revenue: number;
  cost: number;
  profit: number;
  profitRate: number;
  paymentStatus: 'UNPAID' | 'PARTIAL_PAID' | 'PAID';
  status: string;
  salesPerson: string;
  createdAt: string;
  completedAt?: string;
}

// 支付状态配置
const PAYMENT_STATUS_CONFIG = {
  UNPAID: { label: '未支付', color: 'default' },
  PARTIAL_PAID: { label: '部分支付', color: 'warning' },
  PAID: { label: '已支付', color: 'success' }
};

const mapPaymentStatus = (status?: string): OrderDetail['paymentStatus'] => {
  if (status === 'PAID') return 'PAID';
  if (status === 'PARTIAL') return 'PARTIAL_PAID';
  return 'UNPAID';
};

export const OrderReport: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedSales, setSelectedSales] = useState<string>('ALL');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [orderRes, feeRes] = await Promise.all([
          orderApi.listMaster({ pageSize: 200 }),
          feeApi.list(),
        ]);

        const masters = ((orderRes as any)?.data || orderRes || []) as any[];
        const feeRows = ((feeRes as any)?.data || feeRes || []) as any[];

        const orderFeeMap = new Map<string, { receivable: number; payable: number }>();
        for (const fee of feeRows) {
          if (fee.relatedType !== 'ORDER') continue;
          const key = String(fee.relatedId || fee.relatedNo || '');
          if (!key) continue;
          const current = orderFeeMap.get(key) || { receivable: 0, payable: 0 };
          const amount = Number(fee.amount || 0);
          if (fee.feeDirection === 'RECEIVABLE') current.receivable += amount;
          if (fee.feeDirection === 'PAYABLE') current.payable += amount;
          orderFeeMap.set(key, current);
          if (fee.relatedNo) {
            const byNo = orderFeeMap.get(String(fee.relatedNo)) || { receivable: 0, payable: 0 };
            byNo.receivable += fee.feeDirection === 'RECEIVABLE' ? amount : 0;
            byNo.payable += fee.feeDirection === 'PAYABLE' ? amount : 0;
            orderFeeMap.set(String(fee.relatedNo), byNo);
          }
        }

        const mapped: OrderDetail[] = masters.map((m: any) => {
          const feeAgg = orderFeeMap.get(String(m.id)) || orderFeeMap.get(String(m.orderNo)) || { receivable: 0, payable: 0 };
          const revenue = feeAgg.receivable > 0 ? feeAgg.receivable : Number(m.totalFreight || 0);
          const cost = feeAgg.payable;
          const profit = revenue - cost;
          const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0;
          return {
            id: String(m.id),
            orderNo: String(m.orderNo || '-'),
            customerName: String(m.customerName || '-'),
            route: `${m.destCountry || ''}-${m.destCity || ''}`.replace(/^-|-$/g, '') || '-',
            pieces: Number(m.totalPieces || 0),
            weight: Number(m.totalWeight || 0),
            volume: Number(m.totalVolume || 0),
            revenue,
            cost,
            profit,
            profitRate,
            paymentStatus: mapPaymentStatus(m.paymentStatus),
            status: String(m.status || '-'),
            salesPerson: String(m.salesPerson || '-'),
            createdAt: String(m.createdAt || ''),
            completedAt: m.status === 'COMPLETED' ? String(m.updatedAt || '') : undefined,
          };
        });

        setOrders(mapped);
      } catch (err: any) {
        console.error('加载订单报表失败:', err);
        message.error('加载订单报表失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((row) => {
      if (selectedSales !== 'ALL' && row.salesPerson !== selectedSales) return false;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const created = dayjs(row.createdAt);
        if (created.isBefore(dateRange[0], 'day') || created.isAfter(dateRange[1], 'day')) return false;
      }
      return true;
    });
  }, [orders, selectedSales, dateRange]);

  const salesOptions = useMemo(() => {
    const set = new Set(orders.map((o) => o.salesPerson).filter((v) => v && v !== '-'));
    return Array.from(set).sort();
  }, [orders]);

  // 统计数据
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.revenue, 0);
  const totalCost = filteredOrders.reduce((sum, order) => sum + order.cost, 0);
  const totalProfit = filteredOrders.reduce((sum, order) => sum + order.profit, 0);
  const orderCount = filteredOrders.length;

  // 导出功能
  const handleExport = () => {
    console.log('导出订单明细报表');
  };

  // 表格列定义
  const columns = [
    {
      title: '运单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 180,
    },
    {
      title: '客户名称',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
    },
    {
      title: '路线',
      dataIndex: 'route',
      key: 'route',
      width: 150,
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 80,
      render: (val: number) => `${val}件`,
    },
    {
      title: '重量(kg)',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
      render: (val: number) => `${val}kg`,
    },
    {
      title: '收入',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 120,
      render: (val: number) => `¥${val.toLocaleString()}`,
    },
    {
      title: '成本',
      dataIndex: 'cost',
      key: 'cost',
      width: 120,
      render: (val: number) => `¥${val.toLocaleString()}`,
    },
    {
      title: '利润',
      dataIndex: 'profit',
      key: 'profit',
      width: 120,
      render: (val: number) => (
        <span style={{ color: val > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
          ¥{val.toLocaleString()}
        </span>
      ),
    },
    {
      title: '利润率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      width: 100,
      render: (val: number) => (
        <span style={{ color: val > 15 ? '#52c41a' : val > 10 ? '#faad14' : '#ff4d4f' }}>
          {val.toFixed(1)}%
        </span>
      ),
    },
    {
      title: '支付状态',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 100,
      render: (status: keyof typeof PAYMENT_STATUS_CONFIG) => (
        <Tag color={PAYMENT_STATUS_CONFIG[status].color}>
          {PAYMENT_STATUS_CONFIG[status].label}
        </Tag>
      ),
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
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
              title="订单总数"
              value={orderCount}
              suffix="单"
              valueStyle={{ color: '#1890ff' }}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总收入"
              value={totalRevenue}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总成本"
              value={totalCost}
              prefix="¥"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总利润"
              value={totalProfit}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
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
            value={selectedSales}
            onChange={setSelectedSales}
            placeholder="业务员"
          >
            <Option value="ALL">全部业务员</Option>
            {salesOptions.map((name) => (
              <Option value={name} key={name}>{name}</Option>
            ))}
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
          dataSource={filteredOrders}
          loading={loading}
          scroll={{ x: 1600 }}
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
