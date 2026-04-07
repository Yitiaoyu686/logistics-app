import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Input,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileTextOutlined, InboxOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTableScrollY } from '../../../hooks/useTableScrollY';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../../components/ListPageToolbar';
import { buildInboundItemsByJob, DestInboundOperation, type InboundOperationItem } from './DestInboundOperation';

type BusinessLine = 'SEA' | 'AIR';
type InboundStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';
type ServiceType = 'EXPRESS' | 'STANDARD';
type DeliveryPreference = 'DELIVERY' | 'PICKUP' | 'PENDING' | 'MIXED';
type InboundResult = 'WAREHOUSE' | 'DAMAGED' | 'PACKING_DAMAGED' | 'LOST';
type InboundTabKey = 'JOB' | 'DPN';

interface InboundDetailRow {
  id: string;
  relatedJobNo: string;
  collNo?: string;
  orderNo: string;
  subOrderNo: string;
  customsStatus: string;
  salesName: string;
  cargoDesc: string;
  pieces: number;
  weightKg: number;
  inboundResult: InboundResult;
  handled?: boolean;
}

interface JobInboundRecord {
  id: string;
  businessLine: BusinessLine;
  jobNo: string;
  serviceType: ServiceType;
  inboundStatus: InboundStatus;
  defaultDelivery: DeliveryPreference;
  currentStation: string;
  totalPieces: number;
  totalWeight: number;
  updatedAt: string;
  customsStatus: string;
  releaseTime: string;
  carrier: string;
  billNo: string;
  originPort: string;
  destPort: string;
  collNumbers: string[];
  details: InboundDetailRow[];
}

interface DpnInboundRecord {
  id: string;
  businessLine: BusinessLine;
  dpnNo: string;
  inboundStatus: InboundStatus;
  defaultDelivery: DeliveryPreference;
  currentStation: string;
  totalPieces: number;
  totalWeight: number;
  updatedAt: string;
  routeName: string;
  transportMode: string;
  consigneeName: string;
  destinationStation: string;
  executeDate: string;
  consigneePhone: string;
  consigneeAddress: string;
  logisticsCompany: string;
  queryPhone: string;
  driverName: string;
  driverPhone: string;
  plateNo: string;
  remarks: string;
  relatedJobNos: string[];
  arrivalStatus: string;
  arrivalTime: string;
  details: InboundDetailRow[];
}

interface DestInboundListProps {
  warehouseId?: string;
  businessMode?: 'ALL' | 'SEA' | 'AIR';
  initialTab?: 'JOB' | 'DPN';
}

type DrawerState =
  | { type: 'JOB_OPERATION'; record: JobInboundRecord }
  | { type: 'JOB_MANIFEST'; record: JobInboundRecord }
  | { type: 'DPN_OPERATION'; record: DpnInboundRecord }
  | { type: 'DPN_MANIFEST'; record: DpnInboundRecord }
  | null;

const { Option } = Select;

const COUNTRY_CITY_STATION = [
  {
    label: '尼日利亚',
    value: 'NGA',
    cities: [
      {
        label: '拉各斯',
        value: 'LOS',
        stations: [
          { label: 'IKEJ STA', value: 'IKEJ STA' },
          { label: 'CV STA', value: 'CV STA' },
          { label: 'VI STA', value: 'VI STA' },
        ],
      },
      { label: '阿布贾', value: 'ABV', stations: [{ label: 'ABUJ STA', value: 'ABUJ STA' }] },
      { label: '卡诺', value: 'KAN', stations: [{ label: 'KAN STA', value: 'KAN STA' }] },
    ],
  },
  {
    label: '加纳',
    value: 'GHA',
    cities: [{ label: '阿克拉', value: 'ACC', stations: [{ label: 'ACC STA', value: 'ACC STA' }] }],
  },
];

const DELIVERY_LABEL: Record<DeliveryPreference, string> = {
  DELIVERY: '待配送',
  PICKUP: '待自提',
  PENDING: '待确认',
  MIXED: '混合',
};

const STATUS_LABEL: Record<InboundStatus, string> = {
  PENDING: '待入库',
  PARTIAL: '部分入库',
  COMPLETED: '已入库',
};

const STATUS_COLOR: Record<InboundStatus, string> = {
  PENDING: 'processing',
  PARTIAL: 'warning',
  COMPLETED: 'success',
};

const RESULT_LABEL: Record<InboundResult, string> = {
  WAREHOUSE: '到达仓库',
  DAMAGED: '货损',
  PACKING_DAMAGED: '包装损',
  LOST: '货物遗失',
};

const buildRowSpans = <T,>(rows: T[], getKey: (row: T) => string) => {
  const spans = new Array(rows.length).fill(1);
  let index = 0;
  while (index < rows.length) {
    const currentKey = getKey(rows[index]);
    let cursor = index + 1;
    while (cursor < rows.length && getKey(rows[cursor]) === currentKey) {
      cursor += 1;
    }
    spans[index] = cursor - index;
    for (let hiddenIndex = index + 1; hiddenIndex < cursor; hiddenIndex += 1) {
      spans[hiddenIndex] = 0;
    }
    index = cursor;
  }
  return spans;
};

const formatWeight = (value: number) => Number(value || 0).toLocaleString();
const formatTime = (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss');

const buildJobNo = (businessLine: BusinessLine, index: number) => `${businessLine === 'AIR' ? 'A' : 'S'}-JOB2603${String(index).padStart(4, '0')}`;
const buildDpnNo = (businessLine: BusinessLine, index: number) => `${businessLine === 'AIR' ? 'A' : 'S'}-DPN2603${String(index).padStart(4, '0')}`;
const buildMasterOrderNo = (businessLine: BusinessLine, index: number) => `${businessLine === 'AIR' ? 'A' : 'S'}-2026032${String(10000 + index).padStart(5, '0')}`;
const buildSubOrderNo = (masterOrderNo: string, packageIndex: number) => `${masterOrderNo}-${String(packageIndex).padStart(2, '0')}`;
const buildBillNo = (businessLine: BusinessLine, index: number) => (
  businessLine === 'AIR'
    ? `${String(200 + index).padStart(3, '0')}-${String(35618000 + index).padStart(8, '0')}`
    : `MBL2026032${String(10000 + index).padStart(5, '0')}`
);

const buildJobDetailRows = (
  seed: string,
  relatedJobNos: string[],
  defaultDelivery: DeliveryPreference,
  customsStatus: string,
): InboundDetailRow[] => [
  {
    id: `${seed}-1`,
    relatedJobNo: relatedJobNos[0] || '-',
    collNo: 'AK1',
    orderNo: `${seed}-O01`,
    subOrderNo: `${seed}-01`,
    customsStatus,
    salesName: 'AkinGbolahan',
    cargoDesc: '普货',
    pieces: 3,
    weightKg: 68.5,
    inboundResult: 'WAREHOUSE',
  },
  {
    id: `${seed}-2`,
    relatedJobNo: relatedJobNos[0] || '-',
    collNo: 'AK2',
    orderNo: `${seed}-O02`,
    subOrderNo: `${seed}-02`,
    customsStatus,
    salesName: 'AkinGbolahan',
    cargoDesc: '电子配件',
    pieces: 2,
    weightKg: 41.2,
    inboundResult: 'WAREHOUSE',
  },
  {
    id: `${seed}-3`,
    relatedJobNo: relatedJobNos[Math.min(1, relatedJobNos.length - 1)] || relatedJobNos[0] || '-',
    collNo: 'AK3',
    orderNo: `${seed}-O03`,
    subOrderNo: `${seed}-03`,
    customsStatus,
    salesName: 'Smile',
    cargoDesc: '服饰箱包',
    pieces: 4,
    weightKg: 92.6,
    inboundResult: 'WAREHOUSE',
  },
];

const buildDpnDetailRows = (
  businessLine: BusinessLine,
  relatedJobNos: string[],
  arrivalStatus: string,
  baseOrderIndex: number,
  handledCount = 0,
): InboundDetailRow[] => {
  const masterOrderNos = [
    buildMasterOrderNo(businessLine, baseOrderIndex),
    buildMasterOrderNo(businessLine, baseOrderIndex + 1),
    buildMasterOrderNo(businessLine, baseOrderIndex + 2),
  ];
  const rows: InboundDetailRow[] = [
    {
      id: `${relatedJobNos[0] || businessLine}-1`,
      relatedJobNo: relatedJobNos[0] || '-',
      orderNo: masterOrderNos[0],
      subOrderNo: buildSubOrderNo(masterOrderNos[0], 1),
      customsStatus: arrivalStatus,
      salesName: 'AkinGbolahan',
      cargoDesc: '普货',
      pieces: 3,
      weightKg: 68.5,
      inboundResult: 'WAREHOUSE',
    },
    {
      id: `${relatedJobNos[0] || businessLine}-2`,
      relatedJobNo: relatedJobNos[0] || '-',
      orderNo: masterOrderNos[1],
      subOrderNo: buildSubOrderNo(masterOrderNos[1], 1),
      customsStatus: arrivalStatus,
      salesName: 'AkinGbolahan',
      cargoDesc: '电子配件',
      pieces: 2,
      weightKg: 41.2,
      inboundResult: 'WAREHOUSE',
    },
    {
      id: `${relatedJobNos[Math.min(1, relatedJobNos.length - 1)] || businessLine}-3`,
      relatedJobNo: relatedJobNos[Math.min(1, relatedJobNos.length - 1)] || relatedJobNos[0] || '-',
      orderNo: masterOrderNos[2],
      subOrderNo: buildSubOrderNo(masterOrderNos[2], 1),
      customsStatus: arrivalStatus,
      salesName: 'Smile',
      cargoDesc: '服饰箱包',
      pieces: 4,
      weightKg: 92.6,
      inboundResult: 'WAREHOUSE',
    },
  ];

  return rows.map((row, index) => ({
    ...row,
    handled: index < handledCount,
  }));
};

const buildMockJobs = (businessLine: BusinessLine): JobInboundRecord[] => {
  const mainStation = businessLine === 'AIR' ? 'ABUJ STA' : 'IKEJ STA';
  const secondStation = businessLine === 'AIR' ? 'KAN STA' : 'ACC STA';
  return [
    {
      id: `${businessLine}-job-1`,
      businessLine,
      jobNo: buildJobNo(businessLine, 1),
      serviceType: 'STANDARD',
      inboundStatus: 'PENDING',
      defaultDelivery: 'DELIVERY',
      currentStation: mainStation,
      totalPieces: 27,
      totalWeight: 1500,
      updatedAt: '2026-03-24 09:10:00',
      customsStatus: '已放行',
      releaseTime: '2026-03-23 20:30:00',
      carrier: businessLine === 'AIR' ? '埃塞俄比亚航空' : '马士基',
      billNo: buildBillNo(businessLine, 1),
      originPort: 'CAN',
      destPort: businessLine === 'AIR' ? 'ABV' : 'ACC',
      collNumbers: ['AK1', 'AK2', 'AK3', 'AK4', 'AK5', 'AK6'],
      details: buildJobDetailRows(buildJobNo(businessLine, 1), [buildJobNo(businessLine, 1)], 'DELIVERY', '已放行'),
    },
    {
      id: `${businessLine}-job-2`,
      businessLine,
      jobNo: buildJobNo(businessLine, 2),
      serviceType: 'EXPRESS',
      inboundStatus: 'PENDING',
      defaultDelivery: 'PICKUP',
      currentStation: secondStation,
      totalPieces: 11,
      totalWeight: 320,
      updatedAt: '2026-03-24 08:40:00',
      customsStatus: '已放行',
      releaseTime: '2026-03-23 18:15:00',
      carrier: businessLine === 'AIR' ? '卡塔尔航空' : '中远海运',
      billNo: buildBillNo(businessLine, 2),
      originPort: 'HKG',
      destPort: businessLine === 'AIR' ? 'KAN' : 'LOS',
      collNumbers: ['AK7', 'AK8', 'AK9'],
      details: buildJobDetailRows(buildJobNo(businessLine, 2), [buildJobNo(businessLine, 2)], 'PICKUP', '已放行'),
    },
    {
      id: `${businessLine}-job-3`,
      businessLine,
      jobNo: buildJobNo(businessLine, 3),
      serviceType: 'STANDARD',
      inboundStatus: 'PARTIAL',
      defaultDelivery: 'DELIVERY',
      currentStation: mainStation,
      totalPieces: 18,
      totalWeight: 980,
      updatedAt: '2026-03-23 15:20:00',
      customsStatus: '已放行',
      releaseTime: '2026-03-22 09:00:00',
      carrier: businessLine === 'AIR' ? '阿联酋航空' : '达飞',
      billNo: buildBillNo(businessLine, 3),
      originPort: 'CAN',
      destPort: businessLine === 'AIR' ? 'ABV' : 'ACC',
      collNumbers: ['AK10', 'AK11'],
      details: buildJobDetailRows(buildJobNo(businessLine, 3), [buildJobNo(businessLine, 3)], 'DELIVERY', '已放行'),
    },
  ];
};

const buildMockDpns = (businessLine: BusinessLine): DpnInboundRecord[] => {
  const originStation = businessLine === 'AIR' ? 'ABUJ STA' : 'IKEJ STA';
  const secondOrigin = businessLine === 'AIR' ? 'KAN STA' : 'ACC STA';
  return [
    {
      id: `${businessLine}-dpn-1`,
      businessLine,
      dpnNo: buildDpnNo(businessLine, 1),
      inboundStatus: 'PENDING',
      defaultDelivery: 'MIXED',
      currentStation: 'ABUJ STA',
      totalPieces: 36,
      totalWeight: 1820,
      updatedAt: '2026-03-24 09:35:00',
      routeName: `${originStation} -> ABUJ STA`,
      transportMode: businessLine === 'AIR' ? '空运驳站' : '陆运调度',
      consigneeName: '拉各斯分拨中心',
      destinationStation: 'ABUJ STA',
      executeDate: '2026-03-24',
      consigneePhone: '0803-112-9001',
      consigneeAddress: 'Abuja Central Warehouse, Dock 1',
      logisticsCompany: businessLine === 'AIR' ? 'SkyNet Nigeria' : 'Lagos Inland Transit',
      queryPhone: '0700-556-2288',
      driverName: 'Musa Ibrahim',
      driverPhone: '0808-222-1101',
      plateNo: 'ABJ-3382',
      remarks: '到站后按运单核收入库，异常件单独登记。',
      relatedJobNos: [buildJobNo(businessLine, 4), buildJobNo(businessLine, 5), buildJobNo(businessLine, 6)],
      arrivalStatus: '已到站',
      arrivalTime: '2026-03-24 07:55:00',
      details: buildDpnDetailRows(businessLine, [buildJobNo(businessLine, 4), buildJobNo(businessLine, 5), buildJobNo(businessLine, 6)], '已到站', 41),
    },
    {
      id: `${businessLine}-dpn-2`,
      businessLine,
      dpnNo: buildDpnNo(businessLine, 2),
      inboundStatus: 'PENDING',
      defaultDelivery: 'PENDING',
      currentStation: businessLine === 'AIR' ? 'KAN STA' : 'CV STA',
      totalPieces: 24,
      totalWeight: 760,
      updatedAt: '2026-03-24 08:05:00',
      routeName: `${secondOrigin} -> ${businessLine === 'AIR' ? 'KAN STA' : 'CV STA'}`,
      transportMode: businessLine === 'AIR' ? '空运驳站' : '站点调拨',
      consigneeName: 'CV中转站',
      destinationStation: businessLine === 'AIR' ? 'KAN STA' : 'CV STA',
      executeDate: '2026-03-24',
      consigneePhone: '0803-446-5200',
      consigneeAddress: businessLine === 'AIR' ? 'Kano Airport Service Area' : 'CV Station Yard',
      logisticsCompany: businessLine === 'AIR' ? 'Aero Hub Transfer' : 'West Africa Shuttle',
      queryPhone: '0700-778-3002',
      driverName: 'Adewale Sanni',
      driverPhone: '0809-665-4002',
      plateNo: 'LOS-5541',
      remarks: '本站点需按运单拆件核对后入库。',
      relatedJobNos: [buildJobNo(businessLine, 7), buildJobNo(businessLine, 8)],
      arrivalStatus: '已到站',
      arrivalTime: '2026-03-24 06:45:00',
      details: buildDpnDetailRows(businessLine, [buildJobNo(businessLine, 7), buildJobNo(businessLine, 8)], '已到站', 51),
    },
    {
      id: `${businessLine}-dpn-3`,
      businessLine,
      dpnNo: buildDpnNo(businessLine, 3),
      inboundStatus: 'PARTIAL',
      defaultDelivery: 'DELIVERY',
      currentStation: 'ABUJ STA',
      totalPieces: 19,
      totalWeight: 610,
      updatedAt: '2026-03-23 19:15:00',
      routeName: `${originStation} -> ABUJ STA`,
      transportMode: businessLine === 'AIR' ? '空运驳站' : '陆运调度',
      consigneeName: '阿布贾到达站',
      destinationStation: 'ABUJ STA',
      executeDate: '2026-03-23',
      consigneePhone: '0803-225-8819',
      consigneeAddress: 'Abuja Transit Center, Bay 3',
      logisticsCompany: businessLine === 'AIR' ? 'SkyNet Nigeria' : 'Lagos Inland Transit',
      queryPhone: '0700-556-1199',
      driverName: 'Musa Ibrahim',
      driverPhone: '0808-222-1101',
      plateNo: 'ABJ-2266',
      remarks: '已完成首批入库，剩余运单继续核收。',
      relatedJobNos: [buildJobNo(businessLine, 9), buildJobNo(businessLine, 10)],
      arrivalStatus: '已到站',
      arrivalTime: '2026-03-23 15:20:00',
      details: buildDpnDetailRows(businessLine, [buildJobNo(businessLine, 9), buildJobNo(businessLine, 10)], '已到站', 61, 1),
    },
  ];
};

const CollTags: React.FC<{ values: string[] }> = ({ values }) => {
  const visible = values.slice(0, 5);
  const hidden = values.slice(5);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {visible.map((value) => (
        <Tag key={value} style={{ margin: 0 }}>{value}</Tag>
      ))}
      {hidden.length > 0 && (
        <Tooltip title={hidden.join('、')}>
          <Tag style={{ margin: 0, cursor: 'pointer' }}>+{hidden.length}</Tag>
        </Tooltip>
      )}
    </div>
  );
};

const DeliveryTag: React.FC<{ value: DeliveryPreference }> = ({ value }) => {
  const color = value === 'DELIVERY' ? 'processing' : value === 'PICKUP' ? 'purple' : value === 'MIXED' ? 'gold' : 'default';
  return <Tag color={color}>{DELIVERY_LABEL[value]}</Tag>;
};

const DpnInboundExecutionPanel: React.FC<{
  record: DpnInboundRecord;
  details: InboundDetailRow[];
  selectedRowKeys: React.Key[];
  onChangeSelectedRowKeys: (keys: React.Key[]) => void;
  onChangeDetail: (detailId: string, patch: Partial<InboundDetailRow>) => void;
}> = ({ record, details, selectedRowKeys, onChangeSelectedRowKeys, onChangeDetail }) => {
  const { token } = theme.useToken();
  const [scanMode, setScanMode] = useState(false);
  const [scanKeyword, setScanKeyword] = useState('');
  const [lastMatchedId, setLastMatchedId] = useState<string | null>(null);
  const detailJobSpans = useMemo(() => buildRowSpans(details, (item) => item.relatedJobNo), [details]);

  const detailStats = useMemo(() => ({
    totalPieces: details.reduce((sum, item) => sum + item.pieces, 0),
    totalWeight: details.reduce((sum, item) => sum + item.weightKg, 0),
    handledCount: details.filter((item) => item.handled).length,
    pendingCount: details.filter((item) => !item.handled).length,
    abnormalCount: details.filter((item) => item.inboundResult !== 'WAREHOUSE').length,
  }), [details]);

  const normalizeCode = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();

  const handleScan = () => {
    const source = String(scanKeyword || '').trim();
    if (!source) return;
    const code = normalizeCode(source);

    const matched = details.find((item) => normalizeCode(item.subOrderNo) === code);
    if (!matched) {
      message.warning('未匹配到运单号，请检查后重试');
      return;
    }
    onChangeSelectedRowKeys(selectedRowKeys.includes(matched.id) ? selectedRowKeys : [...selectedRowKeys, matched.id]);
    setLastMatchedId(matched.id);
    setScanKeyword('');
    message.success(`已定位运单 ${matched.subOrderNo}，可直接提交本次入库`);
  };

  const detailColumns: ColumnsType<InboundDetailRow> = [
    {
      title: '所属任务',
      dataIndex: 'relatedJobNo',
      key: 'relatedJobNo',
      width: 150,
      onCell: (_record, index) => ({ rowSpan: index === undefined ? 1 : detailJobSpans[index] }),
      render: (value: string) => <span style={{ fontWeight: 600 }}>{value}</span>,
    },
    {
      title: '运单号',
      dataIndex: 'subOrderNo',
      key: 'subOrderNo',
      width: 150,
      render: (value: string, record) => (
        <span style={record.id === lastMatchedId ? { color: token.colorSuccess, fontWeight: 600 } : undefined}>{value}</span>
      ),
    },
    { title: '到站状态', dataIndex: 'customsStatus', key: 'customsStatus', width: 100, render: (value: string) => <Tag color="success">{value}</Tag> },
    { title: '业务员', dataIndex: 'salesName', key: 'salesName', width: 110 },
    { title: '说明', dataIndex: 'cargoDesc', key: 'cargoDesc', width: 120 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'center' },
    { title: '重量kg', dataIndex: 'weightKg', key: 'weightKg', width: 100, align: 'right', render: (value: number) => value.toFixed(2) },
    {
      title: '入库结果',
      dataIndex: 'inboundResult',
      key: 'inboundResult',
      width: 320,
      render: (value: InboundResult, row) => (
        <Radio.Group
          value={value}
          optionType="button"
          buttonStyle="solid"
          size="small"
          onChange={(event) => onChangeDetail(row.id, { inboundResult: event.target.value })}
          options={[
            { value: 'WAREHOUSE', label: '到达仓库' },
            { value: 'DAMAGED', label: '货损' },
            { value: 'PACKING_DAMAGED', label: '包装损' },
            { value: 'LOST', label: '货物遗失' },
          ]}
        />
      ),
    },
    {
      title: '处理状态',
      dataIndex: 'handled',
      key: 'handled',
      width: 100,
      align: 'center',
      render: (value?: boolean) => <Tag color={value ? 'success' : 'default'}>{value ? '已入库' : '待入库'}</Tag>,
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="执行建议：DPN 入库按运单级核收，可扫描运单号快速定位，也可以直接勾选需要提交入库的运单；入库结果单独登记，不再维护后续去向。"
      />

      <Card size="small" bordered={false} style={{ background: token.colorFillAlter }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Button type={scanMode ? 'primary' : 'default'} onClick={() => setScanMode((current) => !current)}>
              {scanMode ? '关闭扫码' : '扫码入库'}
            </Button>
            <Tag color="blue">已选运单 {selectedRowKeys.length}</Tag>
            <Tag>待入库 {detailStats.pendingCount}</Tag>
            <Tag color="success">已入库 {detailStats.handledCount}</Tag>
          </Space>

          {scanMode && (
            <Space wrap>
              <Input
                value={scanKeyword}
                onChange={(event) => setScanKeyword(event.target.value)}
                placeholder="扫描/输入运单号"
                style={{ width: 320 }}
                onPressEnter={handleScan}
              />
              <Button type="primary" onClick={handleScan}>核对入库</Button>
            </Space>
          )}
        </Space>
      </Card>

      <Space size={[8, 8]} wrap>
        <Tag color="processing">运单 {details.length}</Tag>
        <Tag color="success">到仓 {details.filter((item) => item.inboundResult === 'WAREHOUSE').length}</Tag>
        <Tag color="warning">异常 {detailStats.abnormalCount}</Tag>
        <Tag>件数 {detailStats.totalPieces}</Tag>
        <Tag color="cyan">重量 {detailStats.totalWeight.toFixed(2)} kg</Tag>
      </Space>

      <Table
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: onChangeSelectedRowKeys,
          getCheckboxProps: (row) => ({ disabled: !!row.handled }),
        }}
        columns={detailColumns}
        dataSource={details}
        size="small"
        pagination={false}
        scroll={{ x: 1500, y: 'calc(100vh - 520px)' }}
      />
    </Space>
  );
};

export const DestInboundList: React.FC<DestInboundListProps> = ({ businessMode = 'ALL', initialTab }) => {
  const { token } = theme.useToken();
  const [messageApi, contextHolder] = message.useMessage();
  const effectiveBusinessLine: BusinessLine = businessMode === 'AIR' ? 'AIR' : 'SEA';

  const [jobRows, setJobRows] = useState<JobInboundRecord[]>([]);
  const [dpnRows, setDpnRows] = useState<DpnInboundRecord[]>([]);
  const [activeTab, setActiveTab] = useState<InboundTabKey>(initialTab || 'JOB');
  const [filterCountry, setFilterCountry] = useState('ALL');
  const [filterCity, setFilterCity] = useState('ALL');
  const [filterStation, setFilterStation] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<InboundStatus>('PENDING');
  const [keyword, setKeyword] = useState('');
  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [draftDpnDetails, setDraftDpnDetails] = useState<InboundDetailRow[]>([]);
  const [draftDpnSelectedKeys, setDraftDpnSelectedKeys] = useState<React.Key[]>([]);
  const [jobDrafts, setJobDrafts] = useState<Record<string, InboundOperationItem[]>>({});

  useEffect(() => {
    const nextJobRows = buildMockJobs(effectiveBusinessLine);
    setJobRows(nextJobRows);
    setDpnRows(buildMockDpns(effectiveBusinessLine));
    setJobDrafts(
      nextJobRows.reduce<Record<string, InboundOperationItem[]>>((acc, row) => {
        acc[row.id] = buildInboundItemsByJob(row.jobNo);
        return acc;
      }, {}),
    );
    setActiveTab(initialTab || 'JOB');
    setDrawerState(null);
    setDraftDpnDetails([]);
    setDraftDpnSelectedKeys([]);
  }, [effectiveBusinessLine]);

  const cityOptions = useMemo(() => {
    if (filterCountry === 'ALL') return [];
    return COUNTRY_CITY_STATION.find((item) => item.value === filterCountry)?.cities || [];
  }, [filterCountry]);

  const stationOptions = useMemo(() => {
    if (filterCity === 'ALL') return [];
    const country = COUNTRY_CITY_STATION.find((item) => item.cities.some((city) => city.value === filterCity));
    return country?.cities.find((city) => city.value === filterCity)?.stations || [];
  }, [filterCity]);

  const filteredJobRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return jobRows.filter((row) => {
      if (row.inboundStatus !== statusFilter) return false;
      if (filterCountry !== 'ALL') {
        const country = COUNTRY_CITY_STATION.find((item) => item.value === filterCountry);
        const cityValues = (country?.cities || []).map((item) => item.value);
        if (!cityValues.includes(row.destPort)) return false;
      }
      if (filterCity !== 'ALL' && row.destPort !== filterCity) return false;
      if (filterStation !== 'ALL' && row.currentStation !== filterStation) return false;
      if (!kw) return true;
      return [
        row.jobNo,
        row.billNo,
        row.carrier,
        ...row.collNumbers,
      ].join(' ').toLowerCase().includes(kw);
    });
  }, [jobRows, statusFilter, filterCountry, filterCity, filterStation, keyword]);

  const filteredDpnRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return dpnRows.filter((row) => {
      if (row.inboundStatus !== statusFilter) return false;
      if (filterCountry !== 'ALL') {
        const country = COUNTRY_CITY_STATION.find((item) => item.value === filterCountry);
        const stationValues = (country?.cities || []).flatMap((item) => item.stations.map((station) => station.value));
        if (!stationValues.includes(row.currentStation)) return false;
      }
      if (filterStation !== 'ALL' && row.currentStation !== filterStation) return false;
      if (!kw) return true;
      return [
        row.dpnNo,
        row.routeName,
        row.driverName,
        row.plateNo,
        ...row.relatedJobNos,
      ].join(' ').toLowerCase().includes(kw);
    });
  }, [dpnRows, statusFilter, filterCountry, filterStation, keyword]);

  const dpnManifestJobSpans = useMemo(
    () => buildRowSpans(draftDpnDetails, (item) => item.relatedJobNo),
    [draftDpnDetails],
  );

  const activeStats = useMemo(() => {
    if (activeTab === 'JOB') {
      return {
        total: filteredJobRows.length,
        totalPieces: filteredJobRows.reduce((sum, row) => sum + row.totalPieces, 0),
        totalWeight: filteredJobRows.reduce((sum, row) => sum + row.totalWeight, 0),
      };
    }
    return {
      total: filteredDpnRows.length,
      totalPieces: filteredDpnRows.reduce((sum, row) => sum + row.totalPieces, 0),
      totalWeight: filteredDpnRows.reduce((sum, row) => sum + row.totalWeight, 0),
    };
  }, [activeTab, filteredDpnRows, filteredJobRows]);

  const resetFilters = () => {
    setFilterCountry('ALL');
    setFilterCity('ALL');
    setFilterStation('ALL');
    setStatusFilter('PENDING');
    setKeyword('');
  };

  const openDrawer = (next: DrawerState) => {
    setDrawerState(next);
    if (next?.type === 'DPN_OPERATION' || next?.type === 'DPN_MANIFEST') {
      setDraftDpnDetails(next.record.details.map((detail) => ({ ...detail })));
      setDraftDpnSelectedKeys([]);
    } else {
      setDraftDpnDetails([]);
      setDraftDpnSelectedKeys([]);
    }
  };

  const closeDrawer = () => {
    setDrawerState(null);
    setDraftDpnDetails([]);
    setDraftDpnSelectedKeys([]);
  };

  const updateDpnDetail = (detailId: string, patch: Partial<InboundDetailRow>) => {
    setDraftDpnDetails((current) => current.map((item) => (item.id === detailId ? { ...item, ...patch } : item)));
  };

  const submitDpnInbound = () => {
    if (!drawerState || (drawerState.type !== 'DPN_OPERATION')) return;
    if (!draftDpnSelectedKeys.length) {
      messageApi.warning('请先勾选本次需要提交入库的运单');
      return;
    }
    const selectedIds = new Set(draftDpnSelectedKeys.map(String));
    const nextDetails = draftDpnDetails.map((item) => (
      selectedIds.has(item.id)
        ? { ...item, handled: true }
        : item
    ));
    const nextStatus: InboundStatus = nextDetails.every((item) => item.handled) ? 'COMPLETED' : 'PARTIAL';
    setDpnRows((current) => current.map((item) => (
      item.id === drawerState.record.id
        ? { ...item, inboundStatus: nextStatus, updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'), details: nextDetails.map((detail) => ({ ...detail })) }
        : item
    )));
    messageApi.success(`${drawerState.record.dpnNo} 已提交入库`);
    closeDrawer();
  };

  const updateJobDraft = (jobId: string, nextItems: InboundOperationItem[], finalize: boolean) => {
    setJobDrafts((current) => ({ ...current, [jobId]: nextItems.map((item) => ({ ...item })) }));
    setJobRows((current) => current.map((row) => {
      if (row.id !== jobId) return row;
      const handledCount = nextItems.filter((item) => item.handled).length;
      const nextStatus: InboundStatus = finalize
        ? 'COMPLETED'
        : handledCount > 0
          ? 'PARTIAL'
          : 'PENDING';
      return {
        ...row,
        inboundStatus: nextStatus,
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      };
    }));
  };

  const jobColumns: ColumnsType<JobInboundRecord> = [
    {
      title: '任务编号',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 150,
      fixed: 'left',
      render: (value, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{value}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.serviceType === 'EXPRESS' ? '特快' : '普快'} / {record.businessLine === 'AIR' ? '空运' : '海运'}</div>
        </div>
      ),
    },
    {
      title: '船公司/提单号',
      key: 'carrier',
      width: 180,
      render: (_value, record) => (
        <div>
          <div>{record.carrier}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.billNo}</div>
        </div>
      ),
    },
    { title: '起运港', dataIndex: 'originPort', key: 'originPort', width: 90, align: 'center' },
    { title: '目的港', dataIndex: 'destPort', key: 'destPort', width: 90, align: 'center' },
    {
      title: '集装号',
      dataIndex: 'collNumbers',
      key: 'collNumbers',
      width: 240,
      render: (values: string[]) => <CollTags values={values} />,
    },
    { title: '当前站点', dataIndex: 'currentStation', key: 'currentStation', width: 120 },
    {
      title: '默认交付',
      dataIndex: 'defaultDelivery',
      key: 'defaultDelivery',
      width: 110,
      render: (value: DeliveryPreference) => <DeliveryTag value={value} />,
    },
    { title: '件数', dataIndex: 'totalPieces', key: 'totalPieces', width: 80, align: 'center' },
    { title: '重量(kg)', dataIndex: 'totalWeight', key: 'totalWeight', width: 110, align: 'right', render: (value: number) => formatWeight(value) },
    {
      title: '物流状态',
      dataIndex: 'inboundStatus',
      key: 'inboundStatus',
      width: 160,
      render: (value: InboundStatus, record) => (
        <div>
          <Tag color={STATUS_COLOR[value]}>{STATUS_LABEL[value]}</Tag>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.customsStatus} / {record.currentStation}</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_value, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<InboxOutlined />} onClick={() => openDrawer({ type: 'JOB_OPERATION', record })}>
            {record.inboundStatus === 'COMPLETED' ? '查看' : '入库'}
          </Button>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => openDrawer({ type: 'JOB_MANIFEST', record })}>
            清单
          </Button>
        </Space>
      ),
    },
    { title: '更新日期', dataIndex: 'updatedAt', key: 'updatedAt', width: 170, render: (value: string) => formatTime(value), sorter: (a, b) => dayjs(a.updatedAt).unix() - dayjs(b.updatedAt).unix() },
  ];

  const dpnColumns: ColumnsType<DpnInboundRecord> = [
    {
      title: 'DPN号',
      dataIndex: 'dpnNo',
      key: 'dpnNo',
      width: 180,
      fixed: 'left',
      render: (value, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{value}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.relatedJobNos.length} 个任务 / {record.businessLine === 'AIR' ? '空运' : '海运'}</div>
        </div>
      ),
    },
    {
      title: '调度线路',
      dataIndex: 'routeName',
      key: 'routeName',
      width: 220,
    },
    {
      title: '运输信息',
      key: 'transport',
      width: 200,
      render: (_value, record) => (
        <div>
          <div>{record.transportMode}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>司机 {record.driverName}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>车牌 {record.plateNo}</div>
        </div>
      ),
    },
    {
      title: '关联任务',
      dataIndex: 'relatedJobNos',
      key: 'relatedJobNos',
      width: 260,
      render: (values: string[]) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {values.map((value) => <Tag key={value} style={{ margin: 0 }}>{value}</Tag>)}
        </div>
      ),
    },
    { title: '当前站点', dataIndex: 'currentStation', key: 'currentStation', width: 120 },
    { title: '件数', dataIndex: 'totalPieces', key: 'totalPieces', width: 80, align: 'center' },
    { title: '重量(kg)', dataIndex: 'totalWeight', key: 'totalWeight', width: 110, align: 'right', render: (value: number) => formatWeight(value) },
    {
      title: '到站/入库状态',
      dataIndex: 'inboundStatus',
      key: 'inboundStatus',
      width: 170,
      render: (value: InboundStatus, record) => (
        <div>
          <Tag color={STATUS_COLOR[value]}>{STATUS_LABEL[value]}</Tag>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.arrivalStatus} / {record.currentStation}</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_value, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<InboxOutlined />} onClick={() => openDrawer({ type: 'DPN_OPERATION', record })}>
            {record.inboundStatus === 'COMPLETED' ? '查看' : '入库'}
          </Button>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => openDrawer({ type: 'DPN_MANIFEST', record })}>
            清单
          </Button>
        </Space>
      ),
    },
    { title: '更新日期', dataIndex: 'updatedAt', key: 'updatedAt', width: 170, render: (value: string) => formatTime(value), sorter: (a, b) => dayjs(a.updatedAt).unix() - dayjs(b.updatedAt).unix() },
  ];

  const manifestColumns: ColumnsType<InboundDetailRow> = [
    { title: '所属任务', dataIndex: 'relatedJobNo', key: 'relatedJobNo', width: 150 },
    { title: '集装号', dataIndex: 'collNo', key: 'collNo', width: 90 },
    {
      title: '运单号',
      dataIndex: 'subOrderNo',
      key: 'subOrderNo',
      width: 140,
    },
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 160,
    },
    {
      title: '状态',
      dataIndex: 'customsStatus',
      key: 'customsStatus',
      width: 100,
      render: (value: string) => <Tag color="success">{value}</Tag>,
    },
    { title: '业务员', dataIndex: 'salesName', key: 'salesName', width: 110 },
    { title: '说明', dataIndex: 'cargoDesc', key: 'cargoDesc', width: 120 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'center' },
    { title: '重量kg', dataIndex: 'weightKg', key: 'weightKg', width: 100, align: 'right', render: (value: number) => value.toFixed(2) },
    {
      title: '入库结果',
      dataIndex: 'inboundResult',
      key: 'inboundResult',
      width: 110,
      render: (value: InboundResult) => <Tag>{RESULT_LABEL[value]}</Tag>,
    },
    {
      title: '处理状态',
      dataIndex: 'handled',
      key: 'handled',
      width: 100,
      render: (value?: boolean) => <Tag color={value ? 'success' : 'default'}>{value ? '已入库' : '待入库'}</Tag>,
    },
  ];

  const dpnManifestColumns: ColumnsType<InboundDetailRow> = [
    {
      title: '所属任务',
      dataIndex: 'relatedJobNo',
      key: 'relatedJobNo',
      width: 150,
      onCell: (_record, index) => ({ rowSpan: index === undefined ? 1 : dpnManifestJobSpans[index] }),
      render: (value: string) => <span style={{ fontWeight: 600 }}>{value}</span>,
    },
    { title: '运单号', dataIndex: 'subOrderNo', key: 'subOrderNo', width: 150 },
    {
      title: '到站状态',
      dataIndex: 'customsStatus',
      key: 'customsStatus',
      width: 100,
      render: (value: string) => <Tag color="success">{value}</Tag>,
    },
    { title: '业务员', dataIndex: 'salesName', key: 'salesName', width: 110 },
    { title: '说明', dataIndex: 'cargoDesc', key: 'cargoDesc', width: 120 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'center' },
    { title: '重量kg', dataIndex: 'weightKg', key: 'weightKg', width: 100, align: 'right', render: (value: number) => value.toFixed(2) },
    {
      title: '入库结果',
      dataIndex: 'inboundResult',
      key: 'inboundResult',
      width: 110,
      render: (value: InboundResult) => <Tag>{RESULT_LABEL[value]}</Tag>,
    },
    {
      title: '处理状态',
      dataIndex: 'handled',
      key: 'handled',
      width: 100,
      render: (value?: boolean) => <Tag color={value ? 'success' : 'default'}>{value ? '已入库' : '待入库'}</Tag>,
    },
  ];

  const drawerTitle = useMemo(() => {
    if (!drawerState) return '';
    if (drawerState.type === 'JOB_OPERATION') return '任务入库';
    if (drawerState.type === 'JOB_MANIFEST') return '任务清单';
    if (drawerState.type === 'DPN_OPERATION') return 'DPN入库';
    return 'DPN清单';
  }, [drawerState]);

  const drawerFooter = drawerState?.type === 'DPN_OPERATION' ? (
    <Space>
      <Button onClick={closeDrawer}>取消</Button>
      <Button type="primary" onClick={submitDpnInbound}>提交入库</Button>
    </Space>
  ) : undefined;
  const { tableContainerRef, tableScrollY } = useTableScrollY([activeTab], 104, 280);

  return (
    <>
      {contextHolder}
      {!initialTab && (
      <div style={{ marginBottom: 12 }}>
        <Segmented
          size="large"
          value={activeTab}
          onChange={(value) => setActiveTab(value as InboundTabKey)}
          options={[
            { value: 'JOB', label: `任务入库 ${filteredJobRows.length || jobRows.length}` },
            { value: 'DPN', label: `DPN入库 ${filteredDpnRows.length || dpnRows.length}` },
          ]}
        />
      </div>
      )}

      <Space size={[8, 8]} wrap style={{ marginBottom: 10 }}>
        <Tag color="processing">{activeTab === 'JOB' ? '待入库任务' : '待入库DPN'} {activeStats.total}</Tag>
        <Tag>总件数 {activeStats.totalPieces}</Tag>
        <Tag color="success">总重量 {formatWeight(activeStats.totalWeight)} Kg</Tag>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 10 }}
        message="货物入库已拆分为任务入库和 DPN 入库两个子页签。任务入库通过扫描集装号定位后在运单表里全选或勾选处理，DPN 入库按运单级执行。"
      />

      <ListPageToolbarCard style={{ marginBottom: 10 }}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField minWidth={120}>
              <Select
                value={filterCountry}
                onChange={(value) => {
                  setFilterCountry(value);
                  setFilterCity('ALL');
                  setFilterStation('ALL');
                }}
                style={{ width: '100%' }}
              >
                <Option value="ALL">全部国家</Option>
                {COUNTRY_CITY_STATION.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={120}>
              <Select
                value={filterCity}
                onChange={(value) => {
                  setFilterCity(value);
                  setFilterStation('ALL');
                }}
                style={{ width: '100%' }}
                disabled={filterCountry === 'ALL'}
              >
                <Option value="ALL">全部城市</Option>
                {cityOptions.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={140}>
              <Select
                value={filterStation}
                onChange={setFilterStation}
                style={{ width: '100%' }}
                disabled={filterCity === 'ALL'}
              >
                <Option value="ALL">全部站点</Option>
                {stationOptions.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={120}>
              <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }}>
                <Option value="PENDING">待入库</Option>
                <Option value="PARTIAL">部分入库</Option>
                <Option value="COMPLETED">已入库</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField flex="1 1 320px" minWidth={280}>
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                allowClear
                prefix={<SearchOutlined />}
                placeholder={activeTab === 'JOB' ? '输入任务号、提单号、承运商或集装号查询' : '输入 DPN号、线路、司机或关联任务查询'}
              />
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button type="primary" icon={<SearchOutlined />} onClick={() => setKeyword((value) => value.trim())}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      {activeTab === 'JOB' ? (
        <div ref={tableContainerRef} style={{ minHeight: 0 }}>
          <Table
            rowKey="id"
            columns={jobColumns}
            dataSource={filteredJobRows}
            size="small"
            scroll={{ x: 1700, y: tableScrollY }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        </div>
      ) : (
        <div ref={tableContainerRef} style={{ minHeight: 0 }}>
          <Table
            rowKey="id"
            columns={dpnColumns}
            dataSource={filteredDpnRows}
            size="small"
            scroll={{ x: 1750, y: tableScrollY }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        </div>
      )}

      <Drawer
        title={drawerTitle}
        width="96vw"
        open={!!drawerState}
        onClose={closeDrawer}
        destroyOnHidden
        footer={drawerFooter}
      >
        {drawerState?.type === 'JOB_OPERATION' && (
          <DestInboundOperation
            jobId={drawerState.record.id}
            jobNo={drawerState.record.jobNo}
            initialItems={jobDrafts[drawerState.record.id] || buildInboundItemsByJob(drawerState.record.jobNo)}
            onSaveBatch={(nextItems) => {
              updateJobDraft(drawerState.record.id, nextItems, false);
              messageApi.success(`${drawerState.record.jobNo} 已保存本批次入库`);
              closeDrawer();
            }}
            onFinalConfirm={(nextItems) => {
              updateJobDraft(drawerState.record.id, nextItems, true);
              messageApi.success(`${drawerState.record.jobNo} 已完成最终确认`);
              closeDrawer();
            }}
            onBack={closeDrawer}
          />
        )}

        {drawerState?.type === 'JOB_MANIFEST' && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" bordered={false} style={{ background: token.colorFillAlter }}>
              <Descriptions column={3} size="small">
                <Descriptions.Item label="任务号">{drawerState.record.jobNo}</Descriptions.Item>
                <Descriptions.Item label="船公司/提单号">{drawerState.record.carrier} / {drawerState.record.billNo}</Descriptions.Item>
                <Descriptions.Item label="起运港/目的港">{drawerState.record.originPort} → {drawerState.record.destPort}</Descriptions.Item>
                <Descriptions.Item label="当前站点">{drawerState.record.currentStation}</Descriptions.Item>
                <Descriptions.Item label="默认交付"><DeliveryTag value={drawerState.record.defaultDelivery} /></Descriptions.Item>
                <Descriptions.Item label="清关状态">{drawerState.record.customsStatus} / {drawerState.record.releaseTime}</Descriptions.Item>
              </Descriptions>
            </Card>
            <Table rowKey="id" columns={manifestColumns} dataSource={drawerState.record.details} pagination={false} size="small" />
          </Space>
        )}

        {drawerState?.type === 'DPN_OPERATION' && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" bordered={false} style={{ background: token.colorFillAlter }}>
              <Descriptions column={4} size="small">
                <Descriptions.Item label="DPN号">{drawerState.record.dpnNo}</Descriptions.Item>
                <Descriptions.Item label="发至名字">{drawerState.record.consigneeName}</Descriptions.Item>
                <Descriptions.Item label="发往站点">{drawerState.record.destinationStation}</Descriptions.Item>
                <Descriptions.Item label="执行日期">{drawerState.record.executeDate}</Descriptions.Item>
                <Descriptions.Item label="发至电话">{drawerState.record.consigneePhone}</Descriptions.Item>
                <Descriptions.Item label="发至地址">{drawerState.record.consigneeAddress}</Descriptions.Item>
                <Descriptions.Item label="运输方式">{drawerState.record.transportMode}</Descriptions.Item>
                <Descriptions.Item label="物流公司">{drawerState.record.logisticsCompany}</Descriptions.Item>
                <Descriptions.Item label="查询电话">{drawerState.record.queryPhone}</Descriptions.Item>
                <Descriptions.Item label="司机名称">{drawerState.record.driverName}</Descriptions.Item>
                <Descriptions.Item label="司机电话">{drawerState.record.driverPhone}</Descriptions.Item>
                <Descriptions.Item label="车牌">{drawerState.record.plateNo}</Descriptions.Item>
                <Descriptions.Item label="备注">{drawerState.record.remarks}</Descriptions.Item>
                <Descriptions.Item label="入库状态"><Tag color={STATUS_COLOR[drawerState.record.inboundStatus]}>{STATUS_LABEL[drawerState.record.inboundStatus]}</Tag></Descriptions.Item>
                <Descriptions.Item label="调度线路">{drawerState.record.routeName}</Descriptions.Item>
                <Descriptions.Item label="关联任务">{drawerState.record.relatedJobNos.join('、')}</Descriptions.Item>
                <Descriptions.Item label="到站状态">{drawerState.record.arrivalStatus} / {drawerState.record.arrivalTime}</Descriptions.Item>
                <Descriptions.Item label="总件数">{drawerState.record.totalPieces}</Descriptions.Item>
                <Descriptions.Item label="总重量">{formatWeight(drawerState.record.totalWeight)} kg</Descriptions.Item>
                <Descriptions.Item label="更新时间">{formatTime(drawerState.record.updatedAt)}</Descriptions.Item>
              </Descriptions>
            </Card>
            <DpnInboundExecutionPanel
              record={drawerState.record}
              details={draftDpnDetails}
              selectedRowKeys={draftDpnSelectedKeys}
              onChangeSelectedRowKeys={setDraftDpnSelectedKeys}
              onChangeDetail={updateDpnDetail}
            />
          </Space>
        )}

        {drawerState?.type === 'DPN_MANIFEST' && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" bordered={false} style={{ background: token.colorFillAlter }}>
              <Descriptions column={4} size="small">
                <Descriptions.Item label="DPN号">{drawerState.record.dpnNo}</Descriptions.Item>
                <Descriptions.Item label="发至名字">{drawerState.record.consigneeName}</Descriptions.Item>
                <Descriptions.Item label="发往站点">{drawerState.record.destinationStation}</Descriptions.Item>
                <Descriptions.Item label="执行日期">{drawerState.record.executeDate}</Descriptions.Item>
                <Descriptions.Item label="运输方式">{drawerState.record.transportMode}</Descriptions.Item>
                <Descriptions.Item label="司机名称">{drawerState.record.driverName}</Descriptions.Item>
                <Descriptions.Item label="车牌">{drawerState.record.plateNo}</Descriptions.Item>
                <Descriptions.Item label="发至电话">{drawerState.record.consigneePhone}</Descriptions.Item>
                <Descriptions.Item label="关联任务">{drawerState.record.relatedJobNos.join('、')}</Descriptions.Item>
              </Descriptions>
            </Card>
            <Table rowKey="id" columns={dpnManifestColumns} dataSource={draftDpnDetails} pagination={false} size="small" />
          </Space>
        )}
      </Drawer>
    </>
  );
};
