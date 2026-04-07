import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select,
  Upload, message, DatePicker, Row, Col, Statistic, Typography,
  Alert, InputNumber
} from 'antd';
import {
  DollarOutlined, UploadOutlined, ClockCircleOutlined,
  WarningOutlined, ReloadOutlined, EyeOutlined, BankOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FeeType, Currency } from '../../types/finance';
import { FEE_TYPE_CONFIG, CURRENCY_CONFIG } from '../../types/finance';
import { feeApi } from '../../api';
import { PayableDetail } from './PayableDetail';
import type { PayableRecord, PaymentStatus } from './PayableDetail';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ==================== 常量 ====================

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { text: string; color: string }> = {
  PENDING: { text: '待支付', color: 'orange' },
  PROCESSING: { text: '处理中', color: 'blue' },
  PAID: { text: '已支付', color: 'green' }
};

// ==================== 辅助 ====================

const toCNY = (r: PayableRecord) => r.amountCNY || r.amount;

const normalizeCurrency = (currency?: string): Currency => {
  if (!currency) return 'CNY';
  if (currency === 'USD' || currency === 'NGN' || currency === 'EUR') return currency;
  return 'CNY';
};

const normalizeFeeType = (feeType?: string): FeeType => {
  if (!feeType) return 'OTHER';
  return (feeType in FEE_TYPE_CONFIG ? feeType : 'OTHER') as FeeType;
};

const mapFeeStatusToPaymentStatus = (status?: string): PaymentStatus => {
  if (status === 'PAID') return 'PAID';
  if (status === 'APPROVED') return 'PENDING';
  return 'PENDING';
};

const mapToPayableRecords = (rows: any[]): PayableRecord[] => {
  return rows.map((row, index) => {
    const createdAt = row.createdAt || dayjs().toISOString();
    const dueDate = dayjs(createdAt).add(30, 'day').format('YYYY-MM-DD');
    const relatedType: PayableRecord['relatedType'] =
      row.relatedType === 'JOB' || row.relatedType === 'UNIT' || row.relatedType === 'TRANSFER' ? row.relatedType : 'ORDER';
    const transportType: PayableRecord['transportType'] =
      row.transportType === 'SEA' || row.transportType === 'AIR' ? row.transportType : undefined;
    return {
      id: row.id || `PAYABLE-${index}`,
      feeNo: row.feeNo || '-',
      relatedType,
      relatedNo: row.relatedNo || row.relatedId || '-',
      jobNo: relatedType === 'JOB' ? (row.relatedNo || row.relatedId || '-') : '-',
      route: row.route || '-',
      transportType,
      feeType: normalizeFeeType(row.feeType),
      amount: Number(row.amount || 0),
      currency: normalizeCurrency(row.currency),
      exchangeRate: Number(row.exchangeRate || 1),
      amountCNY: Number(row.amountCNY || row.amount || 0),
      description: row.description || '',
      remark: row.remark || '',
      supplierName: row.supplierName || '未设置供应商',
      supplierBank: row.supplierBank,
      supplierAccount: row.supplierAccount,
      supplierContact: row.supplierContact,
      invoiceNo: row.invoiceNo,
      approverName: row.approver || '-',
      approvedAt: row.approvedAt || row.updatedAt || createdAt,
      paymentStatus: mapFeeStatusToPaymentStatus(row.status),
      dueDate: row.dueDate || dueDate,
      paymentMethod: row.paymentMethod,
      transactionNo: row.transactionNo,
      paidAt: row.paidAt,
      paidBy: row.paidBy,
      paymentVoucher: row.paymentVoucher,
      paymentRemark: row.paymentRemark,
      createdByName: row.createdBy || 'system',
      createdAt,
      logs: row.logs || [],
    };
  });
};

// ==================== 运费对账 Mock 数据 ====================

interface FreightReconRow {
  key: string;
  date: string;
  pieces: number;
  destination: string;
  chargeWeight: number;
  chargeVolume: number;
  payable: number;
  payment: number;
  balance: number;
  jobNo: string;
  blNo: string;
}

const generateFreightMockData = (supplier: string): FreightReconRow[] => {
  const baseData: Record<string, Omit<FreightReconRow, 'key' | 'balance'>[]> = {
    '广州顶派': [
      { date: '2026-03-02', pieces: 45, destination: 'LAX', chargeWeight: 1280, chargeVolume: 3.2, payable: 8500, payment: 5000, jobNo: 'S-JOB260300201', blNo: 'COSU6284730' },
      { date: '2026-03-05', pieces: 32, destination: 'JFK', chargeWeight: 960, chargeVolume: 2.4, payable: 7200, payment: 7200, jobNo: 'S-JOB260300501', blNo: 'COSU6284835' },
      { date: '2026-03-08', pieces: 58, destination: 'ORD', chargeWeight: 1650, chargeVolume: 4.1, payable: 11200, payment: 0, jobNo: 'S-JOB260300801', blNo: 'COSU6284912' },
      { date: '2026-03-12', pieces: 27, destination: 'LAX', chargeWeight: 810, chargeVolume: 2.0, payable: 5400, payment: 5400, jobNo: 'S-JOB260301201', blNo: 'COSU6285001' },
      { date: '2026-03-15', pieces: 40, destination: 'SFO', chargeWeight: 1120, chargeVolume: 2.8, payable: 7800, payment: 0, jobNo: 'S-JOB260301501', blNo: 'COSU6285115' },
      { date: '2026-03-20', pieces: 65, destination: 'JFK', chargeWeight: 1850, chargeVolume: 4.6, payable: 13500, payment: 10000, jobNo: 'S-JOB260302001', blNo: 'COSU6285230' },
      { date: '2026-03-25', pieces: 38, destination: 'ATL', chargeWeight: 1050, chargeVolume: 2.6, payable: 7300, payment: 0, jobNo: 'S-JOB260302501', blNo: 'COSU6285348' },
    ],
    '广州通达': [
      { date: '2026-03-03', pieces: 50, destination: 'LAX', chargeWeight: 1400, chargeVolume: 3.5, payable: 9200, payment: 9200, jobNo: 'S-JOB260300301', blNo: 'OOLU7341002' },
      { date: '2026-03-10', pieces: 35, destination: 'SEA', chargeWeight: 980, chargeVolume: 2.5, payable: 6800, payment: 3000, jobNo: 'S-JOB260301001', blNo: 'OOLU7341108' },
      { date: '2026-03-18', pieces: 42, destination: 'JFK', chargeWeight: 1200, chargeVolume: 3.0, payable: 8600, payment: 0, jobNo: 'S-JOB260301801', blNo: 'OOLU7341215' },
      { date: '2026-03-22', pieces: 28, destination: 'ORD', chargeWeight: 790, chargeVolume: 2.0, payable: 5500, payment: 5500, jobNo: 'S-JOB260302201', blNo: 'OOLU7341320' },
      { date: '2026-03-28', pieces: 55, destination: 'LAX', chargeWeight: 1550, chargeVolume: 3.9, payable: 10800, payment: 0, jobNo: 'S-JOB260302801', blNo: 'OOLU7341428' },
    ],
    '富姐': [
      { date: '2026-03-04', pieces: 30, destination: 'SFO', chargeWeight: 850, chargeVolume: 2.1, payable: 5800, payment: 5800, jobNo: 'S-JOB260300401', blNo: 'YMLU8820015' },
      { date: '2026-03-11', pieces: 22, destination: 'LAX', chargeWeight: 620, chargeVolume: 1.6, payable: 4200, payment: 0, jobNo: 'S-JOB260301101', blNo: 'YMLU8820128' },
      { date: '2026-03-19', pieces: 48, destination: 'JFK', chargeWeight: 1360, chargeVolume: 3.4, payable: 9500, payment: 5000, jobNo: 'S-JOB260301901', blNo: 'YMLU8820235' },
      { date: '2026-03-26', pieces: 36, destination: 'ORD', chargeWeight: 1010, chargeVolume: 2.5, payable: 7000, payment: 0, jobNo: 'S-JOB260302601', blNo: 'YMLU8820342' },
    ],
    '陆总': [
      { date: '2026-03-06', pieces: 60, destination: 'LAX', chargeWeight: 1700, chargeVolume: 4.3, payable: 12000, payment: 12000, jobNo: 'S-JOB260300601', blNo: 'EGLV9910045' },
      { date: '2026-03-13', pieces: 25, destination: 'ATL', chargeWeight: 710, chargeVolume: 1.8, payable: 4800, payment: 2000, jobNo: 'S-JOB260301301', blNo: 'EGLV9910152' },
      { date: '2026-03-21', pieces: 44, destination: 'JFK', chargeWeight: 1250, chargeVolume: 3.1, payable: 8900, payment: 0, jobNo: 'S-JOB260302101', blNo: 'EGLV9910268' },
      { date: '2026-03-27', pieces: 33, destination: 'SEA', chargeWeight: 930, chargeVolume: 2.3, payable: 6500, payment: 6500, jobNo: 'S-JOB260302701', blNo: 'EGLV9910375' },
    ],
  };

  const rows = baseData[supplier] || baseData['广州顶派'];
  let runningBalance = 0;
  return rows.map((r, i) => {
    runningBalance = runningBalance + r.payable - r.payment;
    return { ...r, key: `freight-${i}`, balance: runningBalance };
  });
};

// ==================== 报关费对账 Mock 数据 ====================

interface CustomsReconRow {
  key: string;
  seq: number;
  blNo: string;
  containerNo: string;
  jobNo: string;
  portOfLoading: string;
  portOfDischarge: string;
  total: number;
}

const generateCustomsMockData = (supplier: string): CustomsReconRow[] => {
  const baseData: Record<string, Omit<CustomsReconRow, 'key'>[]> = {
    '德海': [
      { seq: 1, blNo: 'COSU6284730', containerNo: 'TCNU8834521', jobNo: 'S-JOB260300201', portOfLoading: '广州南沙', portOfDischarge: 'Los Angeles', total: 2800 },
      { seq: 2, blNo: 'COSU6284835', containerNo: 'MSKU9912345', jobNo: 'S-JOB260300501', portOfLoading: '深圳蛇口', portOfDischarge: 'New York', total: 3200 },
      { seq: 3, blNo: 'OOLU7341002', containerNo: 'CMAU7765432', jobNo: 'S-JOB260300301', portOfLoading: '广州南沙', portOfDischarge: 'Los Angeles', total: 2800 },
      { seq: 4, blNo: 'OOLU7341108', containerNo: 'HLXU6612389', jobNo: 'S-JOB260301001', portOfLoading: '深圳盐田', portOfDischarge: 'Seattle', total: 3500 },
      { seq: 5, blNo: 'YMLU8820015', containerNo: 'TCLU9943210', jobNo: 'S-JOB260300401', portOfLoading: '广州南沙', portOfDischarge: 'San Francisco', total: 2600 },
      { seq: 6, blNo: 'EGLV9910045', containerNo: 'FCIU8821456', jobNo: 'S-JOB260300601', portOfLoading: '广州黄埔', portOfDischarge: 'Los Angeles', total: 3100 },
    ],
    '耀阳': [
      { seq: 1, blNo: 'COSU6284912', containerNo: 'APLU7789012', jobNo: 'S-JOB260300801', portOfLoading: '广州南沙', portOfDischarge: 'Chicago', total: 3400 },
      { seq: 2, blNo: 'COSU6285001', containerNo: 'CMAU6654321', jobNo: 'S-JOB260301201', portOfLoading: '深圳蛇口', portOfDischarge: 'Los Angeles', total: 2900 },
      { seq: 3, blNo: 'COSU6285115', containerNo: 'TCNU7745678', jobNo: 'S-JOB260301501', portOfLoading: '广州南沙', portOfDischarge: 'San Francisco', total: 2700 },
      { seq: 4, blNo: 'OOLU7341215', containerNo: 'MSKU8834567', jobNo: 'S-JOB260301801', portOfLoading: '深圳盐田', portOfDischarge: 'New York', total: 3600 },
      { seq: 5, blNo: 'YMLU8820235', containerNo: 'HLXU5523456', jobNo: 'S-JOB260301901', portOfLoading: '广州南沙', portOfDischarge: 'New York', total: 3200 },
      { seq: 6, blNo: 'EGLV9910268', containerNo: 'FCIU7712345', jobNo: 'S-JOB260302101', portOfLoading: '广州黄埔', portOfDischarge: 'New York', total: 3000 },
    ],
  };

  const rows = baseData[supplier] || baseData['德海'];
  return rows.map((r, i) => ({ ...r, key: `customs-${i}` }));
};

// ==================== 拖车费对账 Mock 数据 ====================

interface TruckReconRow {
  key: string;
  date: string;
  deliveryAddress: string;
  containerType: string;
  waybillNo: string;
  containerNo: string;
  freight: number;
  docFee: number;
  pickupFee: number;
  specialPickupFee: number;
  total: number;
}

const truckMockData: TruckReconRow[] = [
  { key: 'truck-0', date: '2026-03-03', deliveryAddress: '广州南沙港 → 白云仓库', containerType: '40HQ', waybillNo: 'TK-20260303-001', containerNo: 'TCNU8834521', freight: 2800, docFee: 150, pickupFee: 300, specialPickupFee: 0, total: 3250 },
  { key: 'truck-1', date: '2026-03-08', deliveryAddress: '深圳蛇口港 → 龙华仓', containerType: '20GP', waybillNo: 'TK-20260308-001', containerNo: 'MSKU9912345', freight: 1800, docFee: 150, pickupFee: 250, specialPickupFee: 200, total: 2400 },
  { key: 'truck-2', date: '2026-03-14', deliveryAddress: '广州黄埔港 → 番禺仓', containerType: '40GP', waybillNo: 'TK-20260314-001', containerNo: 'CMAU7765432', freight: 2500, docFee: 150, pickupFee: 300, specialPickupFee: 0, total: 2950 },
  { key: 'truck-3', date: '2026-03-20', deliveryAddress: '深圳盐田港 → 宝安仓', containerType: '40HQ', waybillNo: 'TK-20260320-001', containerNo: 'HLXU6612389', freight: 3200, docFee: 150, pickupFee: 300, specialPickupFee: 500, total: 4150 },
  { key: 'truck-4', date: '2026-03-26', deliveryAddress: '广州南沙港 → 花都仓', containerType: '20GP', waybillNo: 'TK-20260326-001', containerNo: 'APLU7789012', freight: 1600, docFee: 150, pickupFee: 250, specialPickupFee: 0, total: 2000 },
];

// ==================== 运费对账 Tab ====================

export const FreightReconciliation: React.FC = () => {
  const [supplier, setSupplier] = useState('广州顶派');
  const [month, setMonth] = useState<dayjs.Dayjs | null>(dayjs('2026-03'));

  const data = useMemo(() => generateFreightMockData(supplier), [supplier]);

  const totalPayable = useMemo(() => data.reduce((s, r) => s + r.payable, 0), [data]);
  const totalPaid = useMemo(() => data.reduce((s, r) => s + r.payment, 0), [data]);
  const totalBalance = totalPayable - totalPaid;

  const columns = [
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '件数', dataIndex: 'pieces', width: 70, align: 'right' as const },
    { title: '目的地', dataIndex: 'destination', width: 80 },
    {
      title: '计费重量/体积',
      key: 'chargeInfo',
      width: 140,
      render: (_: unknown, r: FreightReconRow) => `${r.chargeWeight}kg / ${r.chargeVolume}m³`,
    },
    {
      title: '应付费用(¥)',
      dataIndex: 'payable',
      width: 120,
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: '#cf1322' }}>¥{v.toLocaleString()}</Text>,
    },
    {
      title: '支付(¥)',
      dataIndex: 'payment',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Text style={{ color: v > 0 ? '#52c41a' : '#999' }}>¥{v.toLocaleString()}</Text>,
    },
    {
      title: '余额(¥)',
      dataIndex: 'balance',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: v > 0 ? '#cf1322' : '#52c41a' }}>¥{v.toLocaleString()}</Text>,
    },
    { title: 'JOB/明细', dataIndex: 'jobNo', width: 160 },
    { title: '提单号', dataIndex: 'blNo', width: 150 },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <span style={{ marginRight: 8, color: '#666' }}>供应商：</span>
            <Select value={supplier} onChange={setSupplier} style={{ width: 160 }}>
              <Option value="广州顶派">广州顶派</Option>
              <Option value="广州通达">广州通达</Option>
              <Option value="富姐">富姐</Option>
              <Option value="陆总">陆总</Option>
            </Select>
          </Col>
          <Col>
            <span style={{ marginRight: 8, color: '#666' }}>月份：</span>
            <DatePicker picker="month" value={month} onChange={setMonth} />
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="应付合计" value={totalPayable} precision={2} prefix="¥" valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已付合计" value={totalPaid} precision={2} prefix="¥" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="欠款余额" value={totalBalance} precision={2} prefix="¥" valueStyle={{ color: totalBalance > 0 ? '#fa8c16' : '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={data}
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">{data.reduce((s, r) => s + r.pieces, 0)}</Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} align="right">
                  <Text style={{ color: '#cf1322' }}>¥{totalPayable.toLocaleString()}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text style={{ color: '#52c41a' }}>¥{totalPaid.toLocaleString()}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Text strong style={{ color: totalBalance > 0 ? '#cf1322' : '#52c41a' }}>¥{totalBalance.toLocaleString()}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} />
                <Table.Summary.Cell index={8} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
};

// ==================== 报关费对账 Tab ====================

export const CustomsReconciliation: React.FC = () => {
  const [supplier, setSupplier] = useState('德海');
  const [month, setMonth] = useState<dayjs.Dayjs | null>(dayjs('2026-03'));

  const data = useMemo(() => generateCustomsMockData(supplier), [supplier]);
  const totalAmount = useMemo(() => data.reduce((s, r) => s + r.total, 0), [data]);

  const columns = [
    { title: '序号', dataIndex: 'seq', width: 60, align: 'center' as const },
    { title: '提单号', dataIndex: 'blNo', width: 150 },
    { title: '柜号', dataIndex: 'containerNo', width: 140 },
    { title: 'JOB', dataIndex: 'jobNo', width: 160 },
    { title: '起运港', dataIndex: 'portOfLoading', width: 120 },
    { title: '目的港', dataIndex: 'portOfDischarge', width: 130 },
    {
      title: '合计(¥)',
      dataIndex: 'total',
      width: 120,
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#cf1322' }}>¥{v.toLocaleString()}</Text>,
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <span style={{ marginRight: 8, color: '#666' }}>报关行：</span>
            <Select value={supplier} onChange={setSupplier} style={{ width: 160 }}>
              <Option value="德海">德海</Option>
              <Option value="耀阳">耀阳</Option>
            </Select>
          </Col>
          <Col>
            <span style={{ marginRight: 8, color: '#666' }}>月份：</span>
            <DatePicker picker="month" value={month} onChange={setMonth} />
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={data}
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                <Table.Summary.Cell index={0} colSpan={6} align="right">
                  <Text strong>合计</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <Text strong style={{ color: '#cf1322' }}>¥{totalAmount.toLocaleString()}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
};

// ==================== 拖车费对账 Tab ====================

export const TruckReconciliation: React.FC = () => {
  const [month, setMonth] = useState<dayjs.Dayjs | null>(dayjs('2026-03'));

  const columns = [
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '送货地址', dataIndex: 'deliveryAddress', width: 220 },
    { title: '柜型', dataIndex: 'containerType', width: 70, align: 'center' as const },
    { title: '运单号', dataIndex: 'waybillNo', width: 160 },
    { title: '箱号', dataIndex: 'containerNo', width: 140 },
    {
      title: '运费(¥)',
      dataIndex: 'freight',
      width: 100,
      align: 'right' as const,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '办单费(¥)',
      dataIndex: 'docFee',
      width: 100,
      align: 'right' as const,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '提柜费(¥)',
      dataIndex: 'pickupFee',
      width: 100,
      align: 'right' as const,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '异提费(¥)',
      dataIndex: 'specialPickupFee',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#fa8c16' }}>¥{v.toLocaleString()}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '合计(¥)',
      dataIndex: 'total',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: '#cf1322' }}>¥{v.toLocaleString()}</Text>,
    },
  ];

  const totalFreight = truckMockData.reduce((s, r) => s + r.freight, 0);
  const totalDocFee = truckMockData.reduce((s, r) => s + r.docFee, 0);
  const totalPickupFee = truckMockData.reduce((s, r) => s + r.pickupFee, 0);
  const totalSpecialFee = truckMockData.reduce((s, r) => s + r.specialPickupFee, 0);
  const totalAll = truckMockData.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <span style={{ marginRight: 8, color: '#666' }}>月份：</span>
            <DatePicker picker="month" value={month} onChange={setMonth} />
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={truckMockData}
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                <Table.Summary.Cell index={0} colSpan={5} align="right">
                  <Text strong>合计</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">¥{totalFreight.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">¥{totalDocFee.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">¥{totalPickupFee.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">¥{totalSpecialFee.toLocaleString()}</Table.Summary.Cell>
                <Table.Summary.Cell index={9} align="right">
                  <Text strong style={{ color: '#cf1322' }}>¥{totalAll.toLocaleString()}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
};

// ==================== 主组件 ====================

export const PayableManagement: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [records, setRecords] = useState<PayableRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await feeApi.list({ feeDirection: 'PAYABLE' });
        const rows = ((res as any).data || res || []) as any[];
        setRecords(mapToPayableRecords(rows));
      } catch (e) {
        message.error('获取应付费用失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 筛选
  const [searchText, setSearchText] = useState('');
  const [filterFeeType, setFilterFeeType] = useState<FeeType | 'ALL'>('ALL');
  const [filterPayStatus, setFilterPayStatus] = useState<PaymentStatus | 'ALL'>('ALL');
  const [filterCurrency, setFilterCurrency] = useState<Currency | 'ALL'>('ALL');
  const [filterSupplier, setFilterSupplier] = useState<string>('ALL');

  // 详情
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<PayableRecord | null>(null);

  // 支付弹窗
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [payingRecord, setPayingRecord] = useState<PayableRecord | null>(null);
  const [paymentForm] = Form.useForm();

  // --- 供应商列表 ---
  const supplierList = useMemo(() => {
    const set = new Set(records.map(r => r.supplierName));
    return Array.from(set).sort();
  }, [records]);

  // --- 全局统计 ---
  const stats = useMemo(() => {
    const pendingItems = records.filter(r => r.paymentStatus === 'PENDING');
    const paidItems = records.filter(r => r.paymentStatus === 'PAID');
    const overdueItems = pendingItems.filter(r => dayjs(r.dueDate).isBefore(dayjs()));
    const pendingAmount = pendingItems.reduce((sum, r) => sum + toCNY(r), 0);
    const overdueAmount = overdueItems.reduce((sum, r) => sum + toCNY(r), 0);
    return {
      pendingCount: pendingItems.length,
      pendingAmount,
      paidCount: paidItems.length,
      overdueCount: overdueItems.length,
      overdueAmount
    };
  }, [records]);

  // --- 筛选 ---
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (searchText) {
      const keyword = searchText.toLowerCase();
      result = result.filter(r =>
        r.feeNo.toLowerCase().includes(keyword) ||
        r.jobNo.toLowerCase().includes(keyword) ||
        r.relatedNo.toLowerCase().includes(keyword) ||
        r.supplierName.toLowerCase().includes(keyword) ||
        (r.description && r.description.toLowerCase().includes(keyword)) ||
        (r.invoiceNo && r.invoiceNo.toLowerCase().includes(keyword))
      );
    }
    if (filterFeeType !== 'ALL') result = result.filter(r => r.feeType === filterFeeType);
    if (filterPayStatus !== 'ALL') result = result.filter(r => r.paymentStatus === filterPayStatus);
    if (filterCurrency !== 'ALL') result = result.filter(r => r.currency === filterCurrency);
    if (filterSupplier !== 'ALL') result = result.filter(r => r.supplierName === filterSupplier);

    return result;
  }, [records, searchText, filterFeeType, filterPayStatus, filterCurrency, filterSupplier]);

  const handleReset = () => {
    setSearchText('');
    setFilterFeeType('ALL');
    setFilterPayStatus('ALL');
    setFilterCurrency('ALL');
    setFilterSupplier('ALL');
  };

  // --- 打开详情 ---
  const handleOpenDetail = (record: PayableRecord) => {
    setCurrentRecord(record);
    setDetailVisible(true);
  };

  // --- 打开支付弹窗 ---
  const handleOpenPay = (record: PayableRecord) => {
    setPayingRecord(record);
    paymentForm.resetFields();
    paymentForm.setFieldsValue({ paymentDate: dayjs(), paymentAmount: record.amount });
    setPaymentModalVisible(true);
    // 如果详情正在展示，先关掉
    setDetailVisible(false);
  };

  // --- 提交支付 ---
  const handleSubmitPayment = async () => {
    try {
      const values = await paymentForm.validateFields();
      if (!payingRecord) return;

      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const nowShort = dayjs().format('YYYY-MM-DD HH:mm');
      const txnNo = `TXN-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
      const symbol = CURRENCY_CONFIG[payingRecord.currency].symbol;

      setRecords(prev => prev.map(r => r.id !== payingRecord.id ? r : {
        ...r,
        paymentStatus: 'PAID' as PaymentStatus,
        paymentMethod: values.paymentMethod,
        transactionNo: values.transactionNo || txnNo,
        paidAt: now,
        paidBy: '当前用户',
        paymentVoucher: values.voucher?.fileList?.[0]?.name || undefined,
        paymentRemark: values.remark,
        logs: [
          { time: nowShort, operator: '当前用户', action: '支付完成', detail: `${values.paymentMethod} ${symbol}${payingRecord.amount.toLocaleString()}，流水号 ${values.transactionNo || txnNo}` },
          ...(r.logs || [])
        ]
      }));

      message.success('支付成功');
      setPaymentModalVisible(false);
      setPayingRecord(null);
      paymentForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // --- 列定义 ---
  const columns = [
    {
      title: '费用编号',
      dataIndex: 'feeNo',
      width: 140,
      render: (text: string, record: PayableRecord) => (
        <a onClick={() => handleOpenDetail(record)}>{text}</a>
      )
    },
    {
      title: '关联任务',
      dataIndex: 'jobNo',
      width: 170,
      render: (text: string) => <Text strong style={{ fontSize: 12 }}>{text}</Text>
    },
    {
      title: '航线',
      dataIndex: 'route',
      width: 100
    },
    {
      title: '费用类型',
      dataIndex: 'feeType',
      width: 90,
      render: (type: FeeType) => <Tag color={FEE_TYPE_CONFIG[type]?.color}>{FEE_TYPE_CONFIG[type]?.label}</Tag>
    },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      width: 140,
      ellipsis: true
    },
    {
      title: '金额',
      key: 'amount',
      width: 130,
      align: 'right' as const,
      render: (_: unknown, record: PayableRecord) => (
        <div>
          <Text strong style={{ color: '#cf1322' }}>
            {CURRENCY_CONFIG[record.currency].symbol}{record.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
          {record.currency !== 'CNY' && record.amountCNY && (
            <div style={{ fontSize: 11, color: '#999' }}>≈ ¥{record.amountCNY.toLocaleString()}</div>
          )}
        </div>
      )
    },
    {
      title: '应付日期',
      dataIndex: 'dueDate',
      width: 110,
      sorter: (a: PayableRecord, b: PayableRecord) => dayjs(a.dueDate).unix() - dayjs(b.dueDate).unix(),
      render: (val: string, record: PayableRecord) => {
        const isOverdue = record.paymentStatus === 'PENDING' && dayjs(val).isBefore(dayjs());
        const daysLeft = dayjs(val).diff(dayjs(), 'day');
        return (
          <Space direction="vertical" size={0}>
            <Text type={isOverdue ? 'danger' : undefined}>{dayjs(val).format('YYYY-MM-DD')}</Text>
            {record.paymentStatus === 'PENDING' && (
              isOverdue
                ? <Tag color="error" style={{ fontSize: 11 }}>逾期 {Math.abs(daysLeft)} 天</Tag>
                : daysLeft <= 3
                  ? <Tag color="warning" style={{ fontSize: 11 }}>剩余 {daysLeft} 天</Tag>
                  : null
            )}
          </Space>
        );
      }
    },
    {
      title: '发票号',
      dataIndex: 'invoiceNo',
      width: 140,
      ellipsis: true,
      render: (val: string) => val ? <Text code style={{ fontSize: 12 }}>{val}</Text> : <Text type="secondary">-</Text>
    },
    {
      title: '状态',
      dataIndex: 'paymentStatus',
      width: 80,
      render: (status: PaymentStatus) => (
        <Tag color={PAYMENT_STATUS_CONFIG[status].color}>{PAYMENT_STATUS_CONFIG[status].text}</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: PayableRecord) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record)}>
            详情
          </Button>
          {record.paymentStatus === 'PENDING' && (
            <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => handleOpenPay(record)}>
              付款
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
            <Statistic
              title="待支付"
              value={stats.pendingCount}
              suffix="笔"
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待支付总额(¥)"
              value={stats.pendingAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#cf1322', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已支付"
              value={stats.paidCount}
              suffix="笔"
              valueStyle={{ color: '#52c41a' }}
              prefix={<BankOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="逾期未付"
              value={stats.overdueCount}
              suffix="笔"
              valueStyle={{ color: '#cf1322' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 逾期提醒 */}
      {stats.overdueCount > 0 && (
        <Alert
          message="逾期提醒"
          description={`有 ${stats.overdueCount} 笔费用已逾期，涉及金额 ¥${stats.overdueAmount.toLocaleString()}，可能导致货物滞留，请尽快处理`}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col span={5}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>关键词</div>
            <Input
              placeholder="费用编号/任务号/供应商/发票号"
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
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>支付状态</div>
            <Select value={filterPayStatus} onChange={setFilterPayStatus} style={{ width: '100%' }}>
              <Option value="ALL">全部</Option>
              {(Object.keys(PAYMENT_STATUS_CONFIG) as PaymentStatus[]).map(key => (
                <Option key={key} value={key}>{PAYMENT_STATUS_CONFIG[key].text}</Option>
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
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>供应商</div>
            <Select value={filterSupplier} onChange={setFilterSupplier} style={{ width: '100%' }} showSearch optionFilterProp="children">
              <Option value="ALL">全部供应商</Option>
              {supplierList.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Col>
          <Col span={5} style={{ display: 'flex', alignItems: 'flex-end' }}>
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
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
        />
      </Card>

      {/* 详情 Drawer */}
      <PayableDetail
        visible={detailVisible}
        data={currentRecord}
        onClose={() => setDetailVisible(false)}
        onPay={handleOpenPay}
      />

      {/* 支付弹窗 */}
      <Modal
        title="支付确认"
        open={paymentModalVisible}
        onCancel={() => { setPaymentModalVisible(false); setPayingRecord(null); paymentForm.resetFields(); }}
        onOk={handleSubmitPayment}
        okText="确认支付"
        width={640}
        destroyOnClose
      >
        {payingRecord && (
          <div>
            <Alert
              message="支付后将自动解锁提单释放流程"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Text type="secondary">费用编号：</Text>
                  <Text strong>{payingRecord.feeNo}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">关联任务：</Text>
                  <Text strong>{payingRecord.jobNo}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">供应商：</Text>
                  <Text strong>{payingRecord.supplierName}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">应付金额：</Text>
                  <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                    {CURRENCY_CONFIG[payingRecord.currency].symbol}{payingRecord.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">费用类型：</Text>
                  <Tag color={FEE_TYPE_CONFIG[payingRecord.feeType]?.color}>{FEE_TYPE_CONFIG[payingRecord.feeType]?.label}</Tag>
                </Col>
                <Col span={12}>
                  <Text type="secondary">应付日期：</Text>
                  <Text>{dayjs(payingRecord.dueDate).format('YYYY-MM-DD')}</Text>
                </Col>
                {payingRecord.supplierBank && (
                  <Col span={24}>
                    <Text type="secondary">收款账号：</Text>
                    <Text>{payingRecord.supplierBank} {payingRecord.supplierAccount}</Text>
                  </Col>
                )}
              </Row>
            </Card>

            <Form form={paymentForm} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="paymentMethod"
                    label="支付方式"
                    rules={[{ required: true, message: '请选择支付方式' }]}
                  >
                    <Select placeholder="选择支付方式">
                      <Option value="银行转账">银行转账</Option>
                      <Option value="支票">支票</Option>
                      <Option value="线上支付">线上支付</Option>
                      <Option value="信用证">信用证</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="paymentDate"
                    label="支付时间"
                    rules={[{ required: true, message: '请选择支付时间' }]}
                  >
                    <DatePicker
                      showTime
                      format="YYYY-MM-DD HH:mm"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="transactionNo"
                    label="交易流水号"
                    rules={[{ required: true, message: '请输入交易流水号' }]}
                  >
                    <Input placeholder="输入银行或支付平台的交易流水号" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="paymentAmount"
                    label="实付金额"
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      precision={2}
                      disabled
                      addonBefore={CURRENCY_CONFIG[payingRecord.currency].symbol}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="voucher"
                label="上传支付凭证"
              >
                <Upload
                  accept=".pdf,.jpg,.png"
                  maxCount={3}
                  beforeUpload={() => false}
                >
                  <Button icon={<UploadOutlined />}>上传水单/支付截图（最多3个）</Button>
                </Upload>
              </Form.Item>

              <Form.Item name="remark" label="备注">
                <TextArea rows={2} placeholder="输入备注信息（选填）" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};
