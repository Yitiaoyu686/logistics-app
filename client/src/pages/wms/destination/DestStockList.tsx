import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Input, Select, DatePicker, Tag, Space,
  Row, Col, message, theme, Modal, Form
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
  deliveryStatus: 'IN_STOCK' | 'DPN_BOUND' | 'PICKUP_PENDING';
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
const USER_NAMES = ['Karena', '箴媄子', 'Tom', 'Karena', '敏敏lena', 'Smile', '良大大', '光明', '小莫', 'Karena'];
const WEIGHTS = [13.5, 1, 7, 22.5, 4, 1, 31, 16, 1, 8];
const PIECES = [1, 1, 1, 18, 1, 1, 1, 1, 1, 1];
const DESCRIPTIONS = ['普货', '其它', '普货', '其它', '普货', '其它', '普货', '其它', '普货', '其它'];
const MOCK_MASTER_GROUP_SIZES = [4, 3, 2, 3, 2, 4, 2];

const formatMockMasterOrderNo = (index: number) => {
  const day = 20 + (index % 9);
  return `S-202603${String(day).padStart(2, '0')}990001`;
};

const formatMockSubOrderNo = (masterOrderNo: string, lineNo: number) => {
  return `${masterOrderNo}-${String(lineNo).padStart(2, '0')}`;
};

const buildMockData = (): StockWaybillRecord[] => {
  const locationEntries = Object.entries(LOCATION_DATA);
  const records: StockWaybillRecord[] = [];
  let globalIndex = 0;

  MOCK_MASTER_GROUP_SIZES.forEach((groupSize, groupIndex) => {
    const masterOrderNo = formatMockMasterOrderNo(groupIndex);
    const idx = groupIndex % 10;
    const salesPerson = groupIndex % 2 === 0 ? 'Smile' : 'Andi';
    const [countryLabel, cities] = locationEntries[groupIndex % locationEntries.length];
    const cityNames = Object.keys(cities);
    const cityLabel = cityNames[(groupIndex + idx) % cityNames.length];
    const stationList = cities[cityLabel];
    const route = groupIndex % 3 === 0 ? 'CAN.CHN-LOS.NGN' : groupIndex % 3 === 1 ? 'CAN.CHN-ACC.GHA' : 'SZX.CHN-ABV.NGN';
    const paymentMethod = groupIndex % 2 === 0 ? 'COD' : 'PREPAID';
    const paymentStatus = groupIndex % 2 === 0 ? 'PAID' : 'UNPAID';
    const fulfillmentMethod = groupIndex % 3 === 0 ? 'SELF_PICKUP' : 'DELIVERY';

    for (let lineIndex = 0; lineIndex < groupSize; lineIndex++) {
      const recordIndex = globalIndex % 10;
      const stationName = stationList[lineIndex % stationList.length];
      const subOrderNo = formatMockSubOrderNo(masterOrderNo, lineIndex + 1);

      records.push({
        id: `stock-${globalIndex + 1}`,
        trackingNo: subOrderNo,
        orderNo: masterOrderNo,
        country: countryLabel,
        city: cityLabel,
        salesPerson,
        userName: USER_NAMES[idx],
        route,
        serviceType: lineIndex % 2 === 0 ? 'EXPRESS' : 'STANDARD',
        description: DESCRIPTIONS[recordIndex],
        weightKg: WEIGHTS[recordIndex],
        pieces: PIECES[recordIndex],
        paymentMethod,
        paymentStatus,
        fulfillmentMethod,
        deliveryStatus: fulfillmentMethod === 'SELF_PICKUP'
          ? 'PICKUP_PENDING'
          : globalIndex % 2 === 0
            ? 'IN_STOCK'
            : 'DPN_BOUND',
        logisticsStatus: fulfillmentMethod === 'SELF_PICKUP'
          ? '待自提'
          : globalIndex % 2 === 0
            ? '在库待分配'
            : '待配送',
        logisticsStation: stationName,
        notified: false,
        updatedAt: dayjs().subtract(globalIndex, 'day').format('YYYY-MM-DD HH:mm'),
      });

      globalIndex += 1;
    }
  });

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
    let list = records.filter(r => ['IN_STOCK', 'DPN_BOUND', 'PICKUP_PENDING'].includes(r.deliveryStatus));

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
          r.route.toLowerCase().includes(kw)
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

  // 安排配送
  const handleArrangeDelivery = (id: string) => {
    Modal.confirm({
      title: '安排配送',
      content: (
        <Form layout="vertical" id="deliveryForm" style={{ marginTop: 16 }}>
          <Form.Item label="配送员姓名" required><Input placeholder="请输入配送员姓名" id="driverName" /></Form.Item>
          <Form.Item label="配送员电话" required><Input placeholder="请输入配送员电话" id="driverPhone" /></Form.Item>
        </Form>
      ),
      okText: '确认安排',
      onOk: () => {
        setRecords(prev => prev.map(r => r.id === id ? {
          ...r, fulfillmentMethod: 'DELIVERY' as const, deliveryStatus: 'DPN_BOUND' as const, logisticsStatus: '待配送',
        } : r));
        message.success('已安排配送');
      },
    });
  };

  // 安排自提
  const handleArrangePickup = (id: string) => {
    setRecords(prev => prev.map(r => r.id === id ? {
      ...r, fulfillmentMethod: 'SELF_PICKUP' as const, deliveryStatus: 'PICKUP_PENDING' as const, logisticsStatus: '待自提',
    } : r));
    message.success('已安排自提');
  };

  // 转为配送
  const handleSwitchToDelivery = (id: string) => {
    handleArrangeDelivery(id);
  };

  // 转为自提
  const handleSwitchToPickup = (id: string) => {
    setRecords(prev => prev.map(r => r.id === id ? {
      ...r, fulfillmentMethod: 'SELF_PICKUP' as const, deliveryStatus: 'PICKUP_PENDING' as const, logisticsStatus: '待自提',
    } : r));
    message.success('已转为自提');
  };

  const columns = [
    {
      title: '运单号',
      key: 'waybillNo',
      width: 220,
      render: (_: unknown, record: StockWaybillRecord) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 600, color: token.colorText }}>{record.trackingNo}</span>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.orderNo}</span>
        </Space>
      ),
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
      title: '末端状态',
      key: 'deliveryStatus',
      width: 180,
      render: (_: unknown, record: StockWaybillRecord) => (
        <Space size={4}>
          <Tag color={
            record.deliveryStatus === 'PICKUP_PENDING'
              ? 'purple'
              : record.deliveryStatus === 'DPN_BOUND'
                ? 'blue'
                : 'processing'
          }>
            {{
              IN_STOCK: '在库待分配',
              DPN_BOUND: '待配送',
              PICKUP_PENDING: '待自提',
            }[record.deliveryStatus]}
          </Tag>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.logisticsStation}</span>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: unknown, record: StockWaybillRecord) => (
        <Space size={4} wrap>
          {record.deliveryStatus === 'IN_STOCK' && (
            <>
              <Button type="link" size="small" onClick={() => handleArrangeDelivery(record.id)}>安排配送</Button>
              <Button type="link" size="small" onClick={() => handleArrangePickup(record.id)}>安排自提</Button>
            </>
          )}
          {record.deliveryStatus === 'DPN_BOUND' && (
            <Button type="link" size="small" onClick={() => handleSwitchToPickup(record.id)}>转为自提</Button>
          )}
          {record.deliveryStatus === 'PICKUP_PENDING' && (
            <Button type="link" size="small" onClick={() => handleSwitchToDelivery(record.id)}>转为配送</Button>
          )}
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
              placeholder="子运单号/运单号/业务员/线路"
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
                <Select.Option value="DPN_BOUND">待配送</Select.Option>
                <Select.Option value="PICKUP_PENDING">待自提</Select.Option>
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
