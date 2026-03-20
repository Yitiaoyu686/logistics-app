import React, { useState, useMemo } from 'react';
import {
  Table, Button, Checkbox, DatePicker, Space, Tag, message, theme, Input, Typography,
} from 'antd';
import { ArrowLeftOutlined, ScanOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

export interface InboundOperationItem {
  id: string;
  jobStation: string;
  jobNo: string;
  collNumber: string;
  collPieces: number;
  trackingNo: string;
  clearanceStatus: 'CLEARED' | 'NOT_CLEARED';
  salesPerson: string;
  description: string;
  pieces: number;
  weightKg: number;
  arrivedWarehouse: boolean;
  goodsDamaged: boolean;
  packageDamaged: boolean;
  goodsLost: boolean;
}

export const MOCK_INBOUND_ITEMS: InboundOperationItem[] = [
  { id: '1', jobStation: '海珠区站点    JOB100145', jobNo: 'JOB100145', collNumber: 'AK1', collPieces: 5, trackingNo: '191018000005 01', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '普货', pieces: 1, weightKg: 0.52, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '2', jobStation: '海珠区站点    JOB100145', jobNo: 'JOB100145', collNumber: 'AK1', collPieces: 5, trackingNo: '191018000005 14', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '普货', pieces: 1, weightKg: 0.92, arrivedWarehouse: false, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '3', jobStation: '海珠区站点    JOB100145', jobNo: 'JOB100145', collNumber: 'AK1', collPieces: 5, trackingNo: '191018000005 15', clearanceStatus: 'NOT_CLEARED', salesPerson: 'AkinGbolahan', description: '其它', pieces: 1, weightKg: 0.12, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '4', jobStation: '海珠区站点    JOB100145', jobNo: 'JOB100145', collNumber: 'AK1', collPieces: 5, trackingNo: '191018000005 16', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '普货', pieces: 1, weightKg: 2.2, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '5', jobStation: '海珠区站点    JOB100145', jobNo: 'JOB100145', collNumber: 'AK1', collPieces: 5, trackingNo: '191019000025 06', clearanceStatus: 'CLEARED', salesPerson: 'Andi MailMail', description: '普货', pieces: 1, weightKg: 7.1, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '6', jobStation: '海珠区站点    JOB100145', jobNo: 'JOB100145', collNumber: 'AK2', collPieces: 1, trackingNo: '191018000005 02', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '普货', pieces: 1, weightKg: 1.14, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '7', jobStation: '海珠区站点    JOB100137', jobNo: 'JOB100137', collNumber: 'AK3', collPieces: 1, trackingNo: '191018000005 14', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '普货', pieces: 1, weightKg: 0.92, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '8', jobStation: '福田区站点     JOB100158', jobNo: 'JOB100158', collNumber: 'AK2', collPieces: 2, trackingNo: '191018000005 15', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '其它', pieces: 1, weightKg: 0.12, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '9', jobStation: '海珠区站点    JOB100159', jobNo: 'JOB100159', collNumber: 'AK3', collPieces: 2, trackingNo: '191018000005 16', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '普货', pieces: 1, weightKg: 2.2, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '10', jobStation: '福田区站点     JOB100146', jobNo: 'JOB100146', collNumber: 'AK2', collPieces: 3, trackingNo: '191019000025 06', clearanceStatus: 'CLEARED', salesPerson: 'Andi MailMail', description: '普货', pieces: 1, weightKg: 7.1, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '11', jobStation: '海珠区站点    JOB100148', jobNo: 'JOB100148', collNumber: 'AK3', collPieces: 3, trackingNo: '191021000001 01', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '普货', pieces: 1, weightKg: 1.1, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '12', jobStation: '福田区站点     JOB100154', jobNo: 'JOB100154', collNumber: 'AK2', collPieces: 4, trackingNo: '191021000003 02', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '其它', pieces: 1, weightKg: 0.94, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '13', jobStation: '海珠区站点     JOB100153', jobNo: 'JOB100153', collNumber: 'AK3', collPieces: 4, trackingNo: '191021000013 03', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '普货', pieces: 1, weightKg: 93.5, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '14', jobStation: '福田区站点    JOB100156', jobNo: 'JOB100156', collNumber: 'AK2', collPieces: 5, trackingNo: '191021000033 08', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '普货', pieces: 1, weightKg: 18.58, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '15', jobStation: '海珠区站点    JOB100136', jobNo: 'JOB100136', collNumber: 'AK3', collPieces: 5, trackingNo: '191022000007 09', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '普货', pieces: 1, weightKg: 31.84, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '16', jobStation: '福田区站点    JOB100145', jobNo: 'JOB100145', collNumber: 'AK2', collPieces: 6, trackingNo: '191022000036 12', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '普货', pieces: 1, weightKg: 2.96, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '17', jobStation: '海珠区站点    JOB100137', jobNo: 'JOB100137', collNumber: 'AK3', collPieces: 6, trackingNo: '191023000006 02', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '普货', pieces: 1, weightKg: 5.18, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '18', jobStation: '福田区站点    JOB100115', jobNo: 'JOB100115', collNumber: 'AK2', collPieces: 7, trackingNo: '191023000010 04', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '其它', pieces: 1, weightKg: 433.8, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '19', jobStation: '海珠区站点    JOB100116', jobNo: 'JOB100116', collNumber: 'AK3', collPieces: 7, trackingNo: '191023000011 03', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '其它', pieces: 1, weightKg: 92, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '20', jobStation: '福田区站点          JOB100117', jobNo: 'JOB100117', collNumber: 'AK2', collPieces: 8, trackingNo: '191023000019 02', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '其它', pieces: 1, weightKg: 23.58, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '21', jobStation: '海珠区站点    JOB100117', jobNo: 'JOB100117', collNumber: 'AK3', collPieces: 8, trackingNo: '191023000026 01', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '其它', pieces: 1, weightKg: 25.12, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
  { id: '22', jobStation: '福田区站点         JOB100118', jobNo: 'JOB100118', collNumber: 'AK2', collPieces: 9, trackingNo: '191023000028 05', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '其它', pieces: 1, weightKg: 7.76, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false },
];

export function getInboundItemsByJob(jobNo: string): InboundOperationItem[] {
  const matched = MOCK_INBOUND_ITEMS.filter((item) => item.jobNo === jobNo);
  return matched.length > 0 ? matched : MOCK_INBOUND_ITEMS;
}

function syncInboundMockItem(id: string, patch: Partial<InboundOperationItem>) {
  const index = MOCK_INBOUND_ITEMS.findIndex((item) => item.id === id);
  if (index < 0) return;
  MOCK_INBOUND_ITEMS[index] = { ...MOCK_INBOUND_ITEMS[index], ...patch };
}

function calcRowSpan(data: InboundOperationItem[]): Map<string, { jobSpan: number; collSpan: number }> {
  const spanMap = new Map<string, { jobSpan: number; collSpan: number }>();
  const jobGroups = new Map<string, number>();
  const collGroups = new Map<string, number>();

  data.forEach((item) => {
    const jobKey = item.jobStation;
    const collKey = `${item.jobStation}|${item.collNumber}`;
    jobGroups.set(jobKey, (jobGroups.get(jobKey) || 0) + 1);
    collGroups.set(collKey, (collGroups.get(collKey) || 0) + 1);
  });

  const jobSeen = new Set<string>();
  const collSeen = new Set<string>();

  data.forEach((item) => {
    const jobKey = item.jobStation;
    const collKey = `${item.jobStation}|${item.collNumber}`;

    let jobSpan = 0;
    let collSpan = 0;

    if (!jobSeen.has(jobKey)) {
      jobSpan = jobGroups.get(jobKey) || 1;
      jobSeen.add(jobKey);
    }

    if (!collSeen.has(collKey)) {
      collSpan = collGroups.get(collKey) || 1;
      collSeen.add(collKey);
    }

    spanMap.set(item.id, { jobSpan, collSpan });
  });

  return spanMap;
}

interface DestInboundOperationProps {
  jobId: string;
  jobNo: string;
  onBack: () => void;
}

const { Text } = Typography;

export const DestInboundOperation: React.FC<DestInboundOperationProps> = ({ jobNo, onBack }) => {
  const { token } = theme.useToken();

  const [inboundDate, setInboundDate] = useState(dayjs());
  const [scanMode, setScanMode] = useState(false);
  const [scanKeyword, setScanKeyword] = useState('');
  const [lastMatchedId, setLastMatchedId] = useState<string | null>(null);
  const [items, setItems] = useState<InboundOperationItem[]>(() => getInboundItemsByJob(jobNo));

  const operatorAccount = 'CANSAMPAO';

  const normalizeCode = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();

  const markArrived = (id: string): boolean => {
    let changed = false;
    setItems((prev) => prev.map((item) => {
      if (item.id !== id || item.arrivedWarehouse) return item;
      changed = true;
      syncInboundMockItem(id, { arrivedWarehouse: true });
      return { ...item, arrivedWarehouse: true };
    }));
    return changed;
  };

  const handleScanInbound = (rawValue: string) => {
    const source = String(rawValue || '').trim();
    if (!source) return;
    const code = normalizeCode(source);

    const byTracking = items.find((item) => normalizeCode(item.trackingNo) === code);
    if (byTracking) {
      const changed = markArrived(byTracking.id);
      setLastMatchedId(byTracking.id);
      if (changed) {
        message.success(`单号 ${byTracking.trackingNo} 核对成功，已标记到达仓库`);
      } else {
        message.info(`单号 ${byTracking.trackingNo} 已核对过`);
      }
      return;
    }

    const byColl = items.filter((item) => normalizeCode(item.collNumber) === code);
    if (byColl.length > 0) {
      const pending = byColl.find((item) => !item.arrivedWarehouse);
      if (!pending) {
        message.info(`集装号 ${byColl[0].collNumber} 已全部核对完成`);
        return;
      }
      markArrived(pending.id);
      setLastMatchedId(pending.id);
      const checkedCount = byColl.filter((item) => item.arrivedWarehouse).length + 1;
      message.success(`集装号 ${pending.collNumber} 核对进度 ${checkedCount}/${byColl.length}`);
      return;
    }

    const byJob = items.filter((item) => normalizeCode(item.jobNo) === code);
    if (byJob.length > 0) {
      const pending = byJob.find((item) => !item.arrivedWarehouse);
      if (!pending) {
        message.info(`JOB ${byJob[0].jobNo} 已全部核对完成`);
        return;
      }
      markArrived(pending.id);
      setLastMatchedId(pending.id);
      const checkedCount = byJob.filter((item) => item.arrivedWarehouse).length + 1;
      message.success(`JOB ${pending.jobNo} 核对进度 ${checkedCount}/${byJob.length}`);
      return;
    }

    message.warning('未匹配到可核对记录，请检查集装号/订单号');
  };

  const handleCheckboxChange = (
    id: string,
    field: keyof Pick<InboundOperationItem, 'arrivedWarehouse' | 'goodsDamaged' | 'packageDamaged' | 'goodsLost'>,
    checked: boolean,
  ) => {
    setItems((prev) => prev.map((item) => (
      item.id === id
        ? (() => {
            syncInboundMockItem(id, { [field]: checked } as Partial<InboundOperationItem>);
            return { ...item, [field]: checked };
          })()
        : item
    )));
  };

  const summary = useMemo(() => ({
    totalPieces: items.reduce((sum, item) => sum + item.pieces, 0),
    totalWeight: items.reduce((sum, item) => sum + item.weightKg, 0),
    arrivedCount: items.filter((item) => item.arrivedWarehouse).length,
    abnormalCount: items.filter((item) => item.goodsDamaged || item.packageDamaged || item.goodsLost).length,
  }), [items]);

  const spanMap = useMemo(() => calcRowSpan(items), [items]);

  const abnormalSummary = useMemo(() => ({
    goodsDamaged: items.filter((item) => item.goodsDamaged).length,
    packageDamaged: items.filter((item) => item.packageDamaged).length,
    goodsLost: items.filter((item) => item.goodsLost).length,
  }), [items]);

  const handleSubmit = () => {
    const arrivedCount = items.filter((i) => i.arrivedWarehouse).length;
    const damagedCount = items.filter((i) => i.goodsDamaged || i.packageDamaged || i.goodsLost).length;
    message.success(`入库提交成功！共 ${arrivedCount} 件到库，${damagedCount} 件异常标记`);
    onBack();
  };

  const columns = [
    {
      title: 'JOB/站点',
      dataIndex: 'jobStation',
      key: 'jobStation',
      width: 200,
      onCell: (record: InboundOperationItem) => {
        const span = spanMap.get(record.id);
        return { rowSpan: span?.jobSpan ?? 1 };
      },
    },
    {
      title: '集装号',
      dataIndex: 'collNumber',
      key: 'collNumber',
      width: 90,
      onCell: (record: InboundOperationItem) => {
        const span = spanMap.get(record.id);
        return { rowSpan: span?.collSpan ?? 1 };
      },
      render: (value: string, record: InboundOperationItem) => (
        <Space direction="vertical" size={0}>
          <span>{value || '-'}</span>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.collPieces} 件</Text>
        </Space>
      ),
    },
    {
      title: '单号',
      dataIndex: 'trackingNo',
      key: 'trackingNo',
      width: 150,
      render: (value: string, record: InboundOperationItem) => (
        <span style={record.id === lastMatchedId ? { color: token.colorSuccess, fontWeight: 600 } : undefined}>
          {value}
        </span>
      ),
    },
    {
      title: '清关状态',
      dataIndex: 'clearanceStatus',
      key: 'clearanceStatus',
      width: 100,
      render: (status: InboundOperationItem['clearanceStatus']) => (
        <Tag color={status === 'CLEARED' ? 'green' : 'orange'}>
          {status === 'CLEARED' ? '已放行' : '待放行'}
        </Tag>
      ),
    },
    { title: '业务员', dataIndex: 'salesPerson', key: 'salesPerson', width: 100 },
    { title: '说明', dataIndex: 'description', key: 'description', width: 120 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 60, align: 'right' as const },
    {
      title: '重量kg',
      dataIndex: 'weightKg',
      key: 'weightKg',
      width: 90,
      align: 'right' as const,
      render: (value: number) => Number(value || 0).toFixed(2),
    },
    {
      title: '到达仓库',
      key: 'arrivedWarehouse',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: InboundOperationItem) => (
        <Checkbox
          checked={record.arrivedWarehouse}
          onChange={(e) => handleCheckboxChange(record.id, 'arrivedWarehouse', e.target.checked)}
        />
      ),
    },
    {
      title: '货损',
      key: 'goodsDamaged',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: InboundOperationItem) => (
        <Checkbox
          checked={record.goodsDamaged}
          onChange={(e) => handleCheckboxChange(record.id, 'goodsDamaged', e.target.checked)}
        />
      ),
    },
    {
      title: '包装损',
      key: 'packageDamaged',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: InboundOperationItem) => (
        <Checkbox
          checked={record.packageDamaged}
          onChange={(e) => handleCheckboxChange(record.id, 'packageDamaged', e.target.checked)}
        />
      ),
    },
    {
      title: '货物遗失',
      key: 'goodsLost',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: InboundOperationItem) => (
        <Checkbox
          checked={record.goodsLost}
          onChange={(e) => handleCheckboxChange(record.id, 'goodsLost', e.target.checked)}
        />
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>返回</Button>
          <Tag color="blue">JOB: {jobNo}</Tag>
          <Tag>件数 {summary.totalPieces}</Tag>
          <Tag color="processing">重量 {summary.totalWeight.toFixed(2)}kg</Tag>
          <Tag color="success">已到仓 {summary.arrivedCount}</Tag>
          <Tag color={summary.abnormalCount > 0 ? 'error' : 'default'}>异常 {summary.abnormalCount}</Tag>
        </Space>
        <Space>
          <DatePicker value={inboundDate} onChange={(d) => d && setInboundDate(d)} />
          <Checkbox checked={scanMode} onChange={(e) => setScanMode(e.target.checked)}>
            <ScanOutlined /> 扫描模式
          </Checkbox>
        </Space>
      </Space>

      {scanMode && (
        <div style={{ marginBottom: 12 }}>
          <Space>
            <Input
              value={scanKeyword}
              onChange={(e) => setScanKeyword(e.target.value)}
              placeholder="扫描/输入：子单号、集装号、JOB号"
              style={{ width: 360 }}
              onPressEnter={() => {
                handleScanInbound(scanKeyword);
                setScanKeyword('');
              }}
            />
            <Button
              type="primary"
              onClick={() => {
                handleScanInbound(scanKeyword);
                setScanKeyword('');
              }}
            >
              核对入库
            </Button>
          </Space>
        </div>
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        size="small"
        pagination={{ pageSize: 50 }}
        scroll={{ x: 1600, y: 'calc(100vh - 420px)' }}
        summary={() => (
          <Table.Summary>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={6}><strong>合计</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><strong>{summary.totalPieces}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><strong>{summary.totalWeight.toFixed(2)}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={3}><strong>{summary.arrivedCount}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={4}><strong>{abnormalSummary.goodsDamaged}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={5}><strong>{abnormalSummary.packageDamaged}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={6}><strong>{abnormalSummary.goodsLost}</strong></Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <Button type="primary" onClick={handleSubmit}>提交</Button>
      </div>
    </div>
  );
};
