import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Input,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ScanOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

export type TaskDeliveryStatus = 'WAREHOUSE' | 'DIRECT_DELIVERY';
export type TaskCargoCondition = 'GOOD' | 'DAMAGED' | 'PACKING_DAMAGED' | 'LOST';

export interface InboundOperationItem {
  id: string;
  jobNo: string;
  collNumber: string;
  collPieces: number;
  trackingNo: string;
  clearanceStatus: 'CLEARED' | 'NOT_CLEARED';
  salesPerson: string;
  description: string;
  pieces: number;
  weightKg: number;
  deliveryStatus: TaskDeliveryStatus;
  cargoCondition: TaskCargoCondition;
  handled: boolean;
  lastHandledAt?: string;
}

const { Text } = Typography;

const TEMPLATE_ITEMS: Omit<InboundOperationItem, 'id' | 'jobNo' | 'handled' | 'lastHandledAt'>[] = [
  { collNumber: 'AK1', collPieces: 5, trackingNo: '191018000005 01', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '普货', pieces: 1, weightKg: 0.52, deliveryStatus: 'WAREHOUSE', cargoCondition: 'GOOD' },
  { collNumber: 'AK1', collPieces: 5, trackingNo: '191018000005 14', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '普货', pieces: 1, weightKg: 0.92, deliveryStatus: 'WAREHOUSE', cargoCondition: 'GOOD' },
  { collNumber: 'AK1', collPieces: 5, trackingNo: '191018000005 15', clearanceStatus: 'NOT_CLEARED', salesPerson: 'AkinGbolahan', description: '其它', pieces: 1, weightKg: 0.12, deliveryStatus: 'DIRECT_DELIVERY', cargoCondition: 'GOOD' },
  { collNumber: 'AK2', collPieces: 3, trackingNo: '191018000005 16', clearanceStatus: 'CLEARED', salesPerson: 'AkinGbolahan', description: '普货', pieces: 1, weightKg: 2.2, deliveryStatus: 'WAREHOUSE', cargoCondition: 'GOOD' },
  { collNumber: 'AK2', collPieces: 3, trackingNo: '191019000025 06', clearanceStatus: 'CLEARED', salesPerson: 'Andi MailMail', description: '普货', pieces: 1, weightKg: 7.1, deliveryStatus: 'DIRECT_DELIVERY', cargoCondition: 'GOOD' },
  { collNumber: 'AK3', collPieces: 4, trackingNo: '191021000001 01', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '普货', pieces: 1, weightKg: 1.1, deliveryStatus: 'WAREHOUSE', cargoCondition: 'GOOD' },
  { collNumber: 'AK3', collPieces: 4, trackingNo: '191021000003 02', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '电子配件', pieces: 1, weightKg: 0.94, deliveryStatus: 'WAREHOUSE', cargoCondition: 'GOOD' },
  { collNumber: 'AK4', collPieces: 2, trackingNo: '191021000013 03', clearanceStatus: 'CLEARED', salesPerson: 'Smile', description: '服饰箱包', pieces: 1, weightKg: 3.5, deliveryStatus: 'WAREHOUSE', cargoCondition: 'GOOD' },
];

export const buildInboundItemsByJob = (jobNo: string): InboundOperationItem[] => {
  return TEMPLATE_ITEMS.map((item, index) => ({
    ...item,
    id: `${jobNo}-${index + 1}`,
    jobNo,
    trackingNo: `${jobNo.slice(-6)} ${String(index + 1).padStart(2, '0')}`,
    handled: false,
  }));
};

function calcRowSpan(data: InboundOperationItem[]): Map<string, { collSpan: number }> {
  const spanMap = new Map<string, { collSpan: number }>();
  const collGroups = new Map<string, number>();

  data.forEach((item) => {
    const collKey = item.collNumber;
    collGroups.set(collKey, (collGroups.get(collKey) || 0) + 1);
  });

  const collSeen = new Set<string>();

  data.forEach((item) => {
    const collKey = item.collNumber;
    spanMap.set(item.id, {
      collSpan: collSeen.has(collKey) ? 0 : (collGroups.get(collKey) || 1),
    });
    collSeen.add(collKey);
  });

  return spanMap;
}

interface DestInboundOperationProps {
  jobId: string;
  jobNo: string;
  initialItems: InboundOperationItem[];
  onSaveBatch: (nextItems: InboundOperationItem[]) => void;
  onFinalConfirm: (nextItems: InboundOperationItem[]) => void;
  onBack: () => void;
}

const DELIVERY_LABEL: Record<TaskDeliveryStatus, string> = {
  WAREHOUSE: '到达仓库',
  DIRECT_DELIVERY: '直送客户',
};

const CONDITION_LABEL: Record<TaskCargoCondition, string> = {
  GOOD: '完好',
  DAMAGED: '货损',
  PACKING_DAMAGED: '包装损',
  LOST: '遗失',
};

export const DestInboundOperation: React.FC<DestInboundOperationProps> = ({
  jobNo,
  initialItems,
  onSaveBatch,
  onFinalConfirm,
  onBack,
}) => {
  const { token } = theme.useToken();

  const [inboundDate, setInboundDate] = useState(dayjs());
  const [scanMode, setScanMode] = useState(false);
  const [scanKeyword, setScanKeyword] = useState('');
  const [selectedColl, setSelectedColl] = useState<string>('ALL');
  const [selectedTrackingNo, setSelectedTrackingNo] = useState<string | null>(null);
  const [lastMatchedId, setLastMatchedId] = useState<string | null>(null);
  const [items, setItems] = useState<InboundOperationItem[]>(() => initialItems.map((item) => ({ ...item })));

  const normalizeCode = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();

  const updateItems = (matcher: (item: InboundOperationItem) => boolean, patch: Partial<InboundOperationItem>) => {
    setItems((prev) => prev.map((item) => (matcher(item) ? { ...item, ...patch } : item)));
  };

  const collOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.collNumber))).map((value) => ({ label: value, value })),
    [items],
  );

  const visibleItems = useMemo(() => (
    items.filter((item) => {
      if (selectedColl !== 'ALL' && item.collNumber !== selectedColl) return false;
      if (selectedTrackingNo && item.trackingNo !== selectedTrackingNo) return false;
      return true;
    })
  ), [items, selectedColl, selectedTrackingNo]);

  const summary = useMemo(() => ({
    totalPieces: items.reduce((sum, item) => sum + item.pieces, 0),
    totalWeight: items.reduce((sum, item) => sum + item.weightKg, 0),
    handledCount: items.filter((item) => item.handled).length,
    warehouseCount: items.filter((item) => item.handled && item.deliveryStatus === 'WAREHOUSE').length,
    directCount: items.filter((item) => item.handled && item.deliveryStatus === 'DIRECT_DELIVERY').length,
    abnormalCount: items.filter((item) => item.handled && item.cargoCondition !== 'GOOD').length,
  }), [items]);

  const currentBatchCount = visibleItems.filter((item) => !item.handled).length;
  const pendingCount = items.filter((item) => !item.handled).length;
  const spanMap = useMemo(() => calcRowSpan(visibleItems), [visibleItems]);

  const handleScanInbound = (rawValue: string) => {
    const source = String(rawValue || '').trim();
    if (!source) return;
    const code = normalizeCode(source);

    const matchedCollItems = items.filter((item) => normalizeCode(item.collNumber) === code);
    if (matchedCollItems.length > 0) {
      setSelectedColl(matchedCollItems[0].collNumber);
      setSelectedTrackingNo(null);
      setLastMatchedId(matchedCollItems[0].id);
      message.success(`已定位集装号 ${matchedCollItems[0].collNumber}，请确认本批次需要处理的运单`);
      return;
    }

    const matchedTracking = items.find((item) => normalizeCode(item.trackingNo) === code);
    if (!matchedTracking) {
      message.warning('未匹配到集装号或运单号，请检查后重试');
      return;
    }
    setSelectedColl(matchedTracking.collNumber);
    setSelectedTrackingNo(matchedTracking.trackingNo);
    setLastMatchedId(matchedTracking.id);
    message.success(`已定位运单 ${matchedTracking.trackingNo}`);
  };

  const handleSaveBatch = (finalConfirm: boolean) => {
    const currentBatchItems = visibleItems.filter((item) => !item.handled);
    if (!currentBatchItems.length) {
      message.warning('当前结果没有待入库运单');
      return;
    }

    const now = inboundDate.format('YYYY-MM-DD HH:mm:ss');
    const nextItems = items.map((item) => (
      currentBatchItems.some((current) => current.id === item.id)
        ? {
            ...item,
            handled: true,
            lastHandledAt: now,
          }
        : item
    ));

    if (finalConfirm && nextItems.some((item) => !item.handled)) {
      message.warning('还有未处理运单，请完成全部批次后再最终确认');
      return;
    }

    if (finalConfirm) {
      onFinalConfirm(nextItems);
      return;
    }

    onSaveBatch(nextItems);
    setItems(nextItems);
    setSelectedTrackingNo(null);
    message.success('已保存当前批次入库处理');
  };

  const detailColumns: ColumnsType<InboundOperationItem> = [
    {
      title: '集装号',
      dataIndex: 'collNumber',
      key: 'collNumber',
      width: 88,
      onCell: (record) => ({ rowSpan: spanMap.get(record.id)?.collSpan ?? 1 }),
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <span>{value}</span>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.collPieces} 件</Text>
        </Space>
      ),
    },
    {
      title: '运单号',
      dataIndex: 'trackingNo',
      key: 'trackingNo',
      width: 126,
      render: (value, record) => (
        <span style={record.id === lastMatchedId ? { color: token.colorSuccess, fontWeight: 600 } : undefined}>{value}</span>
      ),
    },
    {
      title: '清关状态',
      dataIndex: 'clearanceStatus',
      key: 'clearanceStatus',
      width: 92,
      render: (value) => <Tag color={value === 'CLEARED' ? 'green' : 'orange'}>{value === 'CLEARED' ? '已放行' : '待放行'}</Tag>,
    },
    { title: '业务员', dataIndex: 'salesPerson', key: 'salesPerson', width: 96, ellipsis: true },
    { title: '说明', dataIndex: 'description', key: 'description', width: 104, ellipsis: true },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 64, align: 'right' },
    { title: '重量kg', dataIndex: 'weightKg', key: 'weightKg', width: 86, align: 'right', render: (value) => Number(value || 0).toFixed(2) },
    {
      title: '送货状态',
      dataIndex: 'deliveryStatus',
      key: 'deliveryStatus',
      width: 122,
      render: (value: TaskDeliveryStatus, record) => (
        <Select
          value={value}
          style={{ width: 110 }}
          disabled={record.handled}
          onChange={(next) => updateItems((item) => item.id === record.id, { deliveryStatus: next })}
          options={[
            { value: 'WAREHOUSE', label: '到达仓库' },
            { value: 'DIRECT_DELIVERY', label: '直送客户' },
          ]}
        />
      ),
    },
    {
      title: '货物完整状态',
      dataIndex: 'cargoCondition',
      key: 'cargoCondition',
      width: 280,
      render: (value: TaskCargoCondition, record) => (
        <Radio.Group
          value={value}
          size="small"
          disabled={record.handled}
          onChange={(event) => updateItems((item) => item.id === record.id, { cargoCondition: event.target.value })}
          optionType="button"
          buttonStyle="solid"
          options={[
            { value: 'GOOD', label: '完好' },
            { value: 'DAMAGED', label: '货损' },
            { value: 'PACKING_DAMAGED', label: '包装损' },
            { value: 'LOST', label: '遗失' },
          ]}
        />
      ),
    },
    {
      title: '处理状态',
      key: 'handled',
      width: 104,
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.handled ? 'success' : 'default'}>{record.handled ? '已入库' : '待入库'}</Tag>
          {record.lastHandledAt ? <Text type="secondary" style={{ fontSize: 11 }}>{record.lastHandledAt}</Text> : null}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }} wrap>
        <Space wrap>
          <Tag color="blue">任务: {jobNo}</Tag>
          <Tag>总件数 {summary.totalPieces}</Tag>
          <Tag color="processing">总重量 {summary.totalWeight.toFixed(2)}kg</Tag>
          <Tag color="success">已处理 {summary.handledCount}</Tag>
          <Tag color="cyan">已入仓 {summary.warehouseCount}</Tag>
          <Tag color="gold">直送客户 {summary.directCount}</Tag>
          <Tag color={summary.abnormalCount > 0 ? 'error' : 'default'}>异常 {summary.abnormalCount}</Tag>
        </Space>
        <DatePicker value={inboundDate} onChange={(date) => date && setInboundDate(date)} />
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="任务入库按批次执行。先扫描集装号定位本箱运单，再逐票勾选本批次处理；送货状态和货物完整状态分开登记，未处理完的任务可多次打开继续入库，全部处理后再做最终确认。"
      />

      <Card size="small" bordered={false} style={{ marginBottom: 12, background: token.colorFillAlter }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Checkbox checked={scanMode} onChange={(event) => setScanMode(event.target.checked)}>
              <ScanOutlined /> 扫码定位
            </Checkbox>
            <Tag color="blue">当前结果 {selectedTrackingNo || (selectedColl === 'ALL' ? '全部集装号' : selectedColl)}</Tag>
            <Tag>本批次待提交 {currentBatchCount}</Tag>
            <Tag color="warning">剩余未处理 {pendingCount}</Tag>
          </Space>

          {scanMode && (
            <Space wrap>
              <Input
                value={scanKeyword}
                onChange={(event) => setScanKeyword(event.target.value)}
                placeholder="扫描/输入集装号或运单号"
                style={{ width: 320 }}
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
                定位结果
              </Button>
            </Space>
          )}

          <Space wrap>
            <span style={{ color: token.colorTextSecondary }}>集装号筛选</span>
            <Button type={selectedColl === 'ALL' && !selectedTrackingNo ? 'primary' : 'default'} onClick={() => { setSelectedColl('ALL'); setSelectedTrackingNo(null); }}>
              全部集装号
            </Button>
            {collOptions.map((option) => (
              <Button
                key={option.value}
                type={selectedColl === option.value && !selectedTrackingNo ? 'primary' : 'default'}
                onClick={() => { setSelectedColl(option.value); setSelectedTrackingNo(null); }}
              >
                {option.value}
              </Button>
            ))}
          </Space>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={detailColumns}
        dataSource={visibleItems}
        size="small"
        pagination={{ pageSize: 50 }}
        scroll={{ y: 'calc(100vh - 560px)' }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <Space wrap>
          <Tag>已处理 {summary.handledCount} / {items.length}</Tag>
          <Tag color={pendingCount === 0 ? 'success' : 'warning'}>{pendingCount === 0 ? '可最终确认' : '仍有待处理运单'}</Tag>
        </Space>
        <Space>
          <Button onClick={() => handleSaveBatch(false)}>保存本批次</Button>
          <Button type="primary" disabled={items.some((item) => !item.handled && !visibleItems.some((visible) => visible.id === item.id))} onClick={() => handleSaveBatch(true)}>
            最终确认
          </Button>
        </Space>
      </div>
    </div>
  );
};
