import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Descriptions,
  Table,
  Select,
  InputNumber,
  Button,
  Divider,
  Space,
  message,
  Typography,
} from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PriceTablePanel from './PriceTablePanel';

const { Text } = Typography;

export interface FeeItem {
  id?: string;
  project: string;
  unitPriceUSD: number;
  quantity: number;
  subtotalUSD: number;
  recordDate?: string;
}

export interface FeeEntryDrawerProps {
  visible: boolean;
  orderId: string;
  routeCode: string;
  serviceType: 'EXPRESS' | 'STANDARD';
  salesPerson?: string;
  customerName?: string;
  orderDate?: string;
  existingFees?: FeeItem[];
  onSubmit: (newFees: FeeItem[]) => void;
  onClose: () => void;
}

const FEE_PROJECT_OPTIONS = [
  '首重', '续重', '药品附加运费', '进口报关费', '到门费用',
  '折扣', '包装费', '仓储费', '保险费', '其他',
];

const EXCHANGE_RATES: Record<string, { currency: string; rate: number }> = {
  'CAN.CHN-LOS.NGN': { currency: 'NGN', rate: 480 },
  'CAN.CHN-ACC.GHA': { currency: 'GHS', rate: 12.5 },
  'CAN.CHN-CKY.GIN': { currency: 'GNF', rate: 8600 },
};

const defaultExistingFees: FeeItem[] = [
  { id: '1', project: '首重', unitPriceUSD: 8.6, quantity: 1, subtotalUSD: 8.6, recordDate: '2024-10-27 13:14:04' },
  { id: '2', project: '续重', unitPriceUSD: 7.9, quantity: 20, subtotalUSD: 158, recordDate: '2024-10-27 13:14:05' },
  { id: '3', project: '药品附加运费', unitPriceUSD: 100, quantity: 1, subtotalUSD: 100, recordDate: '2024-10-27 13:14:06' },
  { id: '4', project: '进口报关费', unitPriceUSD: 300, quantity: 1, subtotalUSD: 300, recordDate: '2024-10-27 13:14:07' },
  { id: '5', project: '到门费用', unitPriceUSD: 39, quantity: 1, subtotalUSD: 39, recordDate: '2024-10-27 13:14:08' },
  { id: '6', project: '折扣', unitPriceUSD: 0, quantity: 0, subtotalUSD: 0, recordDate: '2024-10-27 13:14:09' },
];

export const FeeEntryDrawer: React.FC<FeeEntryDrawerProps> = ({
  visible,
  orderId,
  routeCode,
  serviceType,
  salesPerson,
  customerName,
  orderDate,
  existingFees,
  onSubmit,
  onClose,
}) => {
  const [newFees, setNewFees] = useState<FeeItem[]>([]);
  const [priceTableVisible, setPriceTableVisible] = useState(false);

  const displayFees = existingFees && existingFees.length > 0 ? existingFees : defaultExistingFees;

  const exchangeInfo = EXCHANGE_RATES[routeCode];

  const existingTotal = useMemo(
    () => displayFees.reduce((sum, f) => sum + f.subtotalUSD, 0),
    [displayFees],
  );

  const newTotal = useMemo(
    () => newFees.reduce((sum, f) => sum + f.subtotalUSD, 0),
    [newFees],
  );

  const handleClose = () => {
    setNewFees([]);
    setPriceTableVisible(false);
    onClose();
  };

  const handleSubmit = () => {
    onSubmit(newFees);
    message.success('费用录入成功');
  };

  const handleAddFee = () => {
    setNewFees((prev) => [
      ...prev,
      { project: '', unitPriceUSD: 0, quantity: 1, subtotalUSD: 0 },
    ]);
  };

  const handleRemoveFee = (index: number) => {
    setNewFees((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFeeChange = (index: number, field: keyof FeeItem, value: string | number | null) => {
    setNewFees((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'project') {
        item.project = value as string;
      } else if (field === 'unitPriceUSD') {
        item.unitPriceUSD = (value as number) ?? 0;
      } else if (field === 'quantity') {
        item.quantity = (value as number) ?? 0;
      }
      item.subtotalUSD = +(item.unitPriceUSD * item.quantity).toFixed(2);
      updated[index] = item;
      return updated;
    });
  };

  // Existing fees table columns
  const existingColumns: ColumnsType<FeeItem> = [
    {
      title: '序号',
      width: 60,
      align: 'center',
      render: (_: unknown, __: unknown, idx: number) => idx + 1,
    },
    { title: '项目', dataIndex: 'project', width: 140 },
    { title: '单价USD', dataIndex: 'unitPriceUSD', width: 100, align: 'right' },
    { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
    { title: '小计USD', dataIndex: 'subtotalUSD', width: 100, align: 'right' },
    { title: '录入日期', dataIndex: 'recordDate', width: 180 },
  ];

  // New fees table columns
  const newColumns: ColumnsType<FeeItem> = [
    {
      title: '序号',
      width: 60,
      align: 'center',
      render: (_: unknown, __: unknown, idx: number) => idx + 1,
    },
    {
      title: '项目',
      width: 140,
      render: (_: unknown, record: FeeItem, idx: number) => (
        <Select
          value={record.project || undefined}
          placeholder="选择项目"
          style={{ width: '100%' }}
          onChange={(v) => handleFeeChange(idx, 'project', v)}
          options={FEE_PROJECT_OPTIONS.map((o) => ({ label: o, value: o }))}
        />
      ),
    },
    {
      title: '单价USD',
      width: 120,
      render: (_: unknown, record: FeeItem, idx: number) => (
        <InputNumber
          value={record.unitPriceUSD}
          style={{ width: '100%' }}
          step={0.01}
          onChange={(v) => handleFeeChange(idx, 'unitPriceUSD', v)}
        />
      ),
    },
    {
      title: '数量',
      width: 100,
      render: (_: unknown, record: FeeItem, idx: number) => (
        <InputNumber
          value={record.quantity}
          style={{ width: '100%' }}
          min={0}
          onChange={(v) => handleFeeChange(idx, 'quantity', v)}
        />
      ),
    },
    {
      title: '小计USD',
      dataIndex: 'subtotalUSD',
      width: 100,
      align: 'right',
    },
    {
      title: '操作',
      width: 60,
      align: 'center',
      render: (_: unknown, __: unknown, idx: number) => (
        <Button
          type="text"
          danger
          icon={<CloseOutlined />}
          onClick={() => handleRemoveFee(idx)}
        />
      ),
    },
  ];

  const serviceLabel = serviceType === 'EXPRESS' ? '快线' : '普快';

  const existingSummary = () => (
    <>
      <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={4} align="right">
          <Text strong>合计USD</Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right">
          <Text strong>{existingTotal.toFixed(2)}</Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={2} />
      </Table.Summary.Row>
      {exchangeInfo && (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={4} align="right">
            <Text>汇率 USD1.00={exchangeInfo.currency}{exchangeInfo.rate}</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={1} align="right">
            <Text>折合{exchangeInfo.currency}</Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={2} align="right">
            <Text>{(existingTotal * exchangeInfo.rate).toFixed(2)}</Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    </>
  );

  const newSummary = () =>
    newFees.length > 0 ? (
      <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={4} align="right">
          <Text strong>合计USD</Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right">
          <Text strong>{newTotal.toFixed(2)}</Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={2} />
      </Table.Summary.Row>
    ) : null;

  return (
    <Drawer
      title="费用录入"
      width={720}
      placement="right"
      open={visible}
      onClose={handleClose}
      destroyOnClose
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={handleClose}>返回</Button>
            <Button type="primary" onClick={handleSubmit}>
              提交
            </Button>
          </Space>
        </div>
      }
    >
      {/* Order info */}
      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="订单号">{orderId}</Descriptions.Item>
        <Descriptions.Item label="线路">{routeCode}</Descriptions.Item>
        <Descriptions.Item label="服务类型">{serviceLabel}</Descriptions.Item>
        <Descriptions.Item label="业务员">{salesPerson ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="用户">{customerName ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="订单日期">{orderDate ?? '-'}</Descriptions.Item>
      </Descriptions>

      {/* Existing fees */}
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
        费用明细
      </Text>
      <Table<FeeItem>
        columns={existingColumns}
        dataSource={displayFees}
        rowKey={(_, idx) => String(idx)}
        size="small"
        bordered
        pagination={false}
        summary={existingSummary}
      />

      <Divider />

      {/* Price table toggle */}
      <Button
        type="link"
        onClick={() => setPriceTableVisible((v) => !v)}
        style={{ padding: 0, marginBottom: 8 }}
      >
        {priceTableVisible ? '收起运价列表' : '展开运价列表'}
      </Button>
      {priceTableVisible && (
        <div style={{ marginBottom: 8 }}>
          <PriceTablePanel routeCode={routeCode} serviceType={serviceType} />
        </div>
      )}

      <Divider />

      {/* New fee entry */}
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
        录入费用
      </Text>
      <Table<FeeItem>
        columns={newColumns}
        dataSource={newFees}
        rowKey={(_, idx) => `new-${idx}`}
        size="small"
        bordered
        pagination={false}
        summary={newSummary}
      />
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAddFee}
        style={{ width: '100%', marginTop: 8 }}
      >
        添加
      </Button>
    </Drawer>
  );
};

export default FeeEntryDrawer;
