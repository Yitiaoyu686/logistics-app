import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Input, Select, DatePicker, Tag, Space,
  Row, Col, message, theme
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, BellOutlined,
  PrinterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface StockWaybillRecord {
  id: string;
  trackingNo: string;
  orderNo: string;
  country: string;
  city: string;
  salesPerson: string;
  userName: string;
  route: string;
  serviceType: 'EXPRESS' | 'STANDARD';
  description: string;
  weightKg: number;
  pieces: number;
  paymentMethod: 'PREPAID' | 'COD';
  paymentStatus: 'PAID' | 'UNPAID';
  fulfillmentMethod: 'DELIVERY' | 'SELF_PICKUP';
  deliveryStatus: 'IN_STOCK' | 'DPN_BOUND' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'PICKUP_PENDING' | 'PICKED_UP' | 'DELIVERY_EXCEPTION';
  dpnNo: string | null;
  pickupNo: string | null;
  logisticsStatus: string;
  logisticsStation: string;
  notified: boolean;
  updatedAt: string;
}

// ---- Cascading location data ----
const LOCATION_DATA: Record<string, Record<string, string[]>> = {
  '尼日利亚': {
    '拉各斯': ['IKEJ STA', 'HAIZ STA'],
    '卡诺': ['KANO STA'],
    '阿布贾': ['ABUJ STA'],
    '奥尼查': ['ONIT STA'],
  },
  '加纳': {
    '阿克拉': ['ACCRA STA'],
  },
  '几内亚': {
    '科纳克里': ['CONK STA'],
  },
  '中国': {
    '广州': ['GZ STA'],
    '深圳': ['SZ STA'],
  },
};

// ---- Mock data ----
const TRACKING_NOS = [
  '190828000021', '191025000041', '191025000040', '191012000003', '191013000009',
  '191021000039', '191023000002', '191025000039', '191025000038', '190922000006',
];
const USER_NAMES = ['Karena', '箴媄子', 'Tom', 'Karena', '敏敏lena', 'Smile', '良大大', '光明', '小莫', 'Karena'];
const WEIGHTS = [13.5, 1, 7, 22.5, 4, 1, 31, 16, 1, 8];
const PIECES = [1, 1, 1, 18, 1, 1, 1, 1, 1, 1];
const DESCRIPTIONS = ['普货', '其它', '普货', '其它', '普货', '其它', '普货', '其它', '普货', '其它'];

const buildMockData = (): StockWaybillRecord[] => {
  const locationEntries = Object.entries(LOCATION_DATA);
  const records: StockWaybillRecord[] = [];
  for (let i = 0; i < 20; i++) {
    const idx = i % 10;
    const salesPerson = i < 10 ? 'Smile' : 'Andi';
    const [countryLabel, cities] = locationEntries[i % locationEntries.length];
    const cityNames = Object.keys(cities);
    const cityLabel = cityNames[(i + idx) % cityNames.length];
    const stationList = cities[cityLabel];
    const stationName = stationList[i % stationList.length];
    records.push({
      id: `stock-${i + 1}`,
      trackingNo: TRACKING_NOS[idx],
      orderNo: `ORD-${20260310 + (i % 7)}-${String(100 + i).padStart(3, '0')}`,
      country: countryLabel,
      city: cityLabel,
      salesPerson,
      userName: USER_NAMES[idx],
      route: 'CAN.CHN-LOS.NGN',
      serviceType: i % 2 === 0 ? 'EXPRESS' : 'STANDARD',
      description: DESCRIPTIONS[idx],
      weightKg: WEIGHTS[idx],
      pieces: PIECES[idx],
      paymentMethod: i % 2 === 0 ? 'COD' : 'PREPAID',
      paymentStatus: i % 2 === 0 ? 'PAID' : 'UNPAID',
      fulfillmentMethod: i % 4 === 0 ? 'SELF_PICKUP' : 'DELIVERY',
      deliveryStatus: (['IN_STOCK', 'DPN_BOUND', 'OUT_FOR_DELIVERY', 'PICKUP_PENDING', 'DELIVERED', 'PICKED_UP', 'DELIVERY_EXCEPTION'] as const)[i % 7],
      dpnNo: i % 4 === 0 ? null : `DPN202603${String(100 + (i % 12)).padStart(3, '0')}`,
      pickupNo: i % 4 === 0 ? `PUP-${dayjs().format('YYYYMMDD')}-${String(50 + i).padStart(3, '0')}` : null,
      logisticsStatus: '在库',
      logisticsStation: stationName,
      notified: false,
      updatedAt: dayjs().subtract(i, 'day').format('YYYY-MM-DD HH:mm'),
    });
  }
  return records;
};

export const DestStockList: React.FC<{ warehouseId?: string; businessMode?: string }> = () => {
  const { token } = theme.useToken();

  const [records, setRecords] = useState<StockWaybillRecord[]>(buildMockData);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Filters
  const [country, setCountry] = useState<string | undefined>(undefined);
  const [city, setCity] = useState<string | undefined>(undefined);
  const [station, setStation] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<string>('ALL');
  const [logisticsStatus, setLogisticsStatus] = useState<string>('ALL');
  const [paymentMethod, setPaymentMethod] = useState<string>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<string>('ALL');
  const [salesPerson, setSalesPerson] = useState<string>('ALL');
  const [keyword, setKeyword] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Cascading helpers
  const cityOptions = useMemo(() => {
    if (!country || !LOCATION_DATA[country]) return [];
    return Object.keys(LOCATION_DATA[country]);
  }, [country]);

  const stationOptions = useMemo(() => {
    if (!country || !city || !LOCATION_DATA[country]?.[city]) return [];
    return LOCATION_DATA[country][city];
  }, [country, city]);

  // Filtered data
  const filteredRecords = useMemo(() => {
    let list = [...records];

    if (country) {
      list = list.filter(r => r.country === country);
    }

    if (city) {
      list = list.filter(r => r.city === city);
    }

    if (station) {
      list = list.filter(r => r.logisticsStation === station);
    }

    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day');
      const end = dateRange[1].endOf('day');
      list = list.filter(r => {
        const d = dayjs(r.updatedAt);
        return !d.isBefore(start) && !d.isAfter(end);
      });
    }

    if (fulfillmentMethod !== 'ALL') {
      list = list.filter(r => r.fulfillmentMethod === fulfillmentMethod);
    }

    if (logisticsStatus !== 'ALL') {
      list = list.filter(r => r.deliveryStatus === logisticsStatus);
    }

    if (paymentMethod !== 'ALL') {
      list = list.filter(r => r.paymentMethod === paymentMethod);
    }

    if (paymentStatus !== 'ALL') {
      list = list.filter(r => r.paymentStatus === paymentStatus);
    }

    if (salesPerson !== 'ALL') {
      list = list.filter(r => r.salesPerson === salesPerson);
    }

    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(
        r =>
          r.trackingNo.toLowerCase().includes(kw) ||
          r.orderNo.toLowerCase().includes(kw) ||
          r.userName.toLowerCase().includes(kw) ||
          r.salesPerson.toLowerCase().includes(kw) ||
          r.route.toLowerCase().includes(kw) ||
          String(r.dpnNo || '').toLowerCase().includes(kw) ||
          String(r.pickupNo || '').toLowerCase().includes(kw)
      );
    }

    return list;
  }, [records, country, city, station, dateRange, fulfillmentMethod, logisticsStatus, paymentMethod, paymentStatus, salesPerson, keyword]);

  // Stats
  const totalRecords = filteredRecords.length;
  const totalPieces = filteredRecords.reduce((sum, r) => sum + r.pieces, 0);
  const totalWeight = filteredRecords.reduce((sum, r) => sum + r.weightKg, 0);

  // Reset
  const handleReset = () => {
    setCountry(undefined);
    setCity(undefined);
    setStation(undefined);
    setDateRange(null);
    setFulfillmentMethod('ALL');
    setLogisticsStatus('ALL');
    setPaymentMethod('ALL');
    setPaymentStatus('ALL');
    setSalesPerson('ALL');
    setKeyword('');
    setShowAdvancedFilters(false);
  };

  // Notify single
  const handleNotify = (id: string) => {
    setRecords(prev => prev.map(r => (r.id === id ? { ...r, notified: true } : r)));
    message.success('通知已发送');
  };

  // Batch notify
  const handleBatchNotify = () => {
    setRecords(prev =>
      prev.map(r => (selectedRowKeys.includes(r.id) ? { ...r, notified: true } : r))
    );
    message.success(`已批量通知 ${selectedRowKeys.length} 条记录`);
    setSelectedRowKeys([]);
  };

  // Print
  const handlePrint = () => {
    message.success('打印任务已发送');
  };

  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: StockWaybillRecord, index: number) => index + 1,
    },
    {
      title: '运单号',
      dataIndex: 'trackingNo',
      key: 'trackingNo',
      width: 140,
    },
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 170,
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 80,
    },
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      width: 90,
    },
    {
      title: '线路',
      dataIndex: 'route',
      key: 'route',
      width: 150,
    },
    {
      title: '服务类型',
      dataIndex: 'serviceType',
      key: 'serviceType',
      width: 90,
      render: (val: string) =>
        val === 'EXPRESS' ? (
          <Tag color="red">特快</Tag>
        ) : (
          <Tag color="blue">普快</Tag>
        ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      width: 70,
    },
    {
      title: '重量Kg',
      dataIndex: 'weightKg',
      key: 'weightKg',
      width: 80,
      align: 'right' as const,
      render: (val: number) => val.toFixed(1),
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 60,
      align: 'center' as const,
    },
    {
      title: '支付方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 80,
      render: (val: string) => (val === 'COD' ? '到付' : '预付'),
    },
    {
      title: '支付状态',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 80,
      render: (val: string) =>
        val === 'PAID' ? (
          <Tag color="green">已付</Tag>
        ) : (
          <Tag color="orange">未付</Tag>
        ),
    },
    {
      title: '履约方式',
      dataIndex: 'fulfillmentMethod',
      key: 'fulfillmentMethod',
      width: 90,
      render: (value: StockWaybillRecord['fulfillmentMethod']) => (
        <Tag color={value === 'DELIVERY' ? 'blue' : 'purple'}>
          {value === 'DELIVERY' ? '配送' : '自提'}
        </Tag>
      ),
    },
    {
      title: 'DPN/自提单',
      key: 'dispatchNo',
      width: 170,
      render: (_: unknown, record: StockWaybillRecord) => record.dpnNo || record.pickupNo || '-',
    },
    {
      title: '末端状态',
      key: 'deliveryStatus',
      width: 180,
      render: (_: unknown, record: StockWaybillRecord) => (
        <Space size={4}>
          <Tag color={
            record.deliveryStatus === 'DELIVERED' || record.deliveryStatus === 'PICKED_UP'
              ? 'green'
              : record.deliveryStatus === 'DELIVERY_EXCEPTION'
                ? 'red'
                : record.deliveryStatus === 'OUT_FOR_DELIVERY'
                  ? 'processing'
                  : 'default'
          }>
            {{
              IN_STOCK: '在库待分配',
              DPN_BOUND: '已分配DPN',
              OUT_FOR_DELIVERY: '配送中',
              DELIVERED: '已签收',
              PICKUP_PENDING: '待自提',
              PICKED_UP: '已自提',
              DELIVERY_EXCEPTION: '配送异常',
            }[record.deliveryStatus]}
          </Tag>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.logisticsStation}</span>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: StockWaybillRecord) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<BellOutlined />}
            disabled={record.notified}
            onClick={() => handleNotify(record.id)}
          >
            {record.notified ? '已通知' : '通知'}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            打印
          </Button>
        </Space>
      ),
    },
    {
      title: '更新日期',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
    },
  ];

  return (
    <div>
      <Space size={[8, 8]} wrap style={{ marginBottom: 10 }}>
        <Tag color="blue">总记录 {totalRecords}</Tag>
        <Tag>总件数 {totalPieces}</Tag>
        <Tag color="processing">总重量 {totalWeight.toFixed(1)} Kg</Tag>
      </Space>

      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Row gutter={[8, 8]} align="middle">
          <Col span={4}>
            <Select
              value={country}
              onChange={(val) => { setCountry(val); setCity(undefined); setStation(undefined); }}
              placeholder="选择国家"
              allowClear
              style={{ width: '100%' }}
            >
              {Object.keys(LOCATION_DATA).map(c => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              value={city}
              onChange={(val) => { setCity(val); setStation(undefined); }}
              placeholder="选择城市"
              allowClear
              disabled={!country}
              style={{ width: '100%' }}
            >
              {cityOptions.map(c => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              value={station}
              onChange={setStation}
              placeholder="选择站点"
              allowClear
              disabled={!city}
              style={{ width: '100%' }}
            >
              {stationOptions.map(s => (
                <Select.Option key={s} value={s}>{s}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col flex="auto">
            <Input
              placeholder="运单号/订单号/DPN号/自提单号"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
              <Button type="link" onClick={() => setShowAdvancedFilters(v => !v)}>
                {showAdvancedFilters ? '收起筛选' : '高级筛选'}
              </Button>
            </Space>
          </Col>
        </Row>
        {showAdvancedFilters && (
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            <Col span={6}>
              <RangePicker
                value={dateRange as any}
                onChange={(vals) => setDateRange(vals as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={4}>
              <Select value={fulfillmentMethod} onChange={setFulfillmentMethod} style={{ width: '100%' }}>
                <Select.Option value="ALL">全部履约方式</Select.Option>
                <Select.Option value="DELIVERY">配送</Select.Option>
                <Select.Option value="SELF_PICKUP">自提</Select.Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select value={logisticsStatus} onChange={setLogisticsStatus} style={{ width: '100%' }}>
                <Select.Option value="ALL">全部末端状态</Select.Option>
                <Select.Option value="IN_STOCK">在库待分配</Select.Option>
                <Select.Option value="DPN_BOUND">已分配DPN</Select.Option>
                <Select.Option value="OUT_FOR_DELIVERY">配送中</Select.Option>
                <Select.Option value="DELIVERED">已签收</Select.Option>
                <Select.Option value="PICKUP_PENDING">待自提</Select.Option>
                <Select.Option value="PICKED_UP">已自提</Select.Option>
                <Select.Option value="DELIVERY_EXCEPTION">配送异常</Select.Option>
              </Select>
            </Col>
            <Col span={3}>
              <Select value={paymentMethod} onChange={setPaymentMethod} style={{ width: '100%' }}>
                <Select.Option value="ALL">全部支付方式</Select.Option>
                <Select.Option value="PREPAID">预付</Select.Option>
                <Select.Option value="COD">到付</Select.Option>
              </Select>
            </Col>
            <Col span={3}>
              <Select value={paymentStatus} onChange={setPaymentStatus} style={{ width: '100%' }}>
                <Select.Option value="ALL">全部支付状态</Select.Option>
                <Select.Option value="PAID">已付</Select.Option>
                <Select.Option value="UNPAID">未付</Select.Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select value={salesPerson} onChange={setSalesPerson} style={{ width: '100%' }}>
                <Select.Option value="ALL">全部业务员</Select.Option>
                <Select.Option value="Smile">Smile</Select.Option>
                <Select.Option value="Andi">Andi</Select.Option>
              </Select>
            </Col>
          </Row>
        )}
      </Card>

      {selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <Space>
            <span style={{ color: token.colorTextSecondary }}>
              已选择 <span style={{ color: token.colorPrimary, fontWeight: 600 }}>{selectedRowKeys.length}</span> 项
            </span>
            <Button
              type="primary"
              size="small"
              icon={<BellOutlined />}
              onClick={handleBatchNotify}
            >
              批量完成通知
            </Button>
          </Space>
        </div>
      )}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredRecords}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        scroll={{ x: 1800, y: showAdvancedFilters ? 'calc(100vh - 510px)' : 'calc(100vh - 460px)' }}
        size="small"
      />
    </div>
  );
};
