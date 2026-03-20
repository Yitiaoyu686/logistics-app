import React, { useMemo, useState } from 'react';
import {
  Card,
  Descriptions,
  Drawer,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import {
  CHANGE_REQUEST_STATUS_CONFIG,
  UI_STATUS_CONFIG,
} from './feeWorkflowDemo';
import type { ChangeRequestStatus, UiFeeStatus } from './feeWorkflowDemo';

const { Text } = Typography;

export interface FeeDetailInfoItem {
  label: string;
  value: React.ReactNode;
}

export interface FeeLedgerEntry {
  id: string;
  feeNo: string;
  relatedNo: string;
  feeType: string;
  feeDirection?: string;
  amount: number;
  currency: string;
  uiStatus: UiFeeStatus;
  changeRequestStatus?: ChangeRequestStatus;
  changeItemsCount?: number;
  createdBy?: string;
  createdAt?: string;
  description?: string;
}

export interface FeeLedgerReceipt {
  id: string;
  amount: number;
  receivedAt: string;
  voucherNames: string[];
  operator?: string;
  remark?: string;
}

interface FeeLedgerDetailDrawerProps {
  open: boolean;
  title: string;
  loading?: boolean;
  infoItems: FeeDetailInfoItem[];
  entries: FeeLedgerEntry[];
  receipts?: FeeLedgerReceipt[];
  onClose: () => void;
}

type EntryFilter = 'ALL' | UiFeeStatus | 'CHANGE_PENDING';

export const FeeLedgerDetailDrawer: React.FC<FeeLedgerDetailDrawerProps> = ({
  open,
  title,
  loading = false,
  infoItems,
  entries,
  receipts = [],
  onClose,
}) => {
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('ALL');

  const filteredEntries = useMemo(() => {
    if (entryFilter === 'ALL') {
      return entries;
    }
    if (entryFilter === 'CHANGE_PENDING') {
      return entries.filter((item) => item.changeRequestStatus === 'PENDING');
    }
    return entries.filter((item) => item.uiStatus === entryFilter);
  }, [entries, entryFilter]);

  const stats = useMemo(() => {
    return {
      total: entries.length,
      pending: entries.filter((item) => item.uiStatus === 'PENDING').length,
      approved: entries.filter((item) => item.uiStatus === 'APPROVED').length,
      changePending: entries.filter((item) => item.changeRequestStatus === 'PENDING').length,
    };
  }, [entries]);

  const receiptSummary = useMemo(() => {
    const totalReceived = receipts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      count: receipts.length,
      totalReceived,
    };
  }, [receipts]);

  const columns = [
    { title: '费用编号', dataIndex: 'feeNo', key: 'feeNo', width: 130 },
    { title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo', width: 140 },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 110,
      render: (value: string) => <Tag>{value || '-'}</Tag>,
    },
    {
      title: '方向',
      dataIndex: 'feeDirection',
      key: 'feeDirection',
      width: 90,
      render: (value?: string) => {
        if (!value) return '-';
        return <Tag color={value === 'RECEIVABLE' ? 'green' : 'red'}>{value === 'RECEIVABLE' ? '应收' : '应付'}</Tag>;
      },
    },
    {
      title: '金额',
      key: 'amount',
      width: 140,
      align: 'right' as const,
      render: (_: unknown, record: FeeLedgerEntry) => `${record.currency} ${record.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
    },
    {
      title: '审核状态',
      dataIndex: 'uiStatus',
      key: 'uiStatus',
      width: 100,
      render: (value: UiFeeStatus) => <Tag color={UI_STATUS_CONFIG[value].color}>{UI_STATUS_CONFIG[value].text}</Tag>,
    },
    {
      title: '更改状态',
      dataIndex: 'changeRequestStatus',
      key: 'changeRequestStatus',
      width: 120,
      render: (value?: ChangeRequestStatus) => {
        if (!value) return '-';
        const cfg = CHANGE_REQUEST_STATUS_CONFIG[value];
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '变更条目',
      dataIndex: 'changeItemsCount',
      key: 'changeItemsCount',
      width: 90,
      align: 'right' as const,
      render: (value?: number) => (value ? `${value} 条` : '-'),
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 90,
      render: (value?: string) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      width="92vw"
      destroyOnClose
    >
      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">费用条目 {stats.total}</Tag>
        <Tag color="orange">待审核 {stats.pending}</Tag>
        <Tag color="green">已审核 {stats.approved}</Tag>
        <Tag color={stats.changePending > 0 ? 'orange' : 'default'}>待更改 {stats.changePending}</Tag>
      </div>

      <Card size="small" title="基础信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered size="small" column={2}>
          {infoItems.map((item) => (
            <Descriptions.Item key={item.label} label={item.label}>
              <Text>{item.value as any}</Text>
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Card>

      <Card
        size="small"
        title="费用列表（已审核 / 待审核 / 待更改）"
        extra={(
          <Space>
            <span>状态筛选</span>
            <Select<EntryFilter>
              value={entryFilter}
              onChange={setEntryFilter}
              style={{ width: 180 }}
              options={[
                { value: 'ALL', label: '全部条目' },
                { value: 'DRAFT', label: '草稿' },
                { value: 'PENDING', label: '待审核' },
                { value: 'APPROVED', label: '已审核' },
                { value: 'REJECTED', label: '已驳回' },
                { value: 'PAID', label: '已支付' },
                { value: 'CHANGE_PENDING', label: '待更改' },
              ]}
            />
          </Space>
        )}
      >
        <Table<FeeLedgerEntry>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredEntries}
          pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Card
        size="small"
        title={`收款记录（${receiptSummary.count} 次）`}
        style={{ marginTop: 16 }}
      >
        <Table<FeeLedgerReceipt>
          rowKey="id"
          size="small"
          dataSource={receipts}
          pagination={{ pageSize: 6, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: '暂无收款记录' }}
          columns={[
            {
              title: '收款时间',
              dataIndex: 'receivedAt',
              key: 'receivedAt',
              width: 170,
              render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
            },
            {
              title: '收款金额(CNY)',
              dataIndex: 'amount',
              key: 'amount',
              width: 160,
              align: 'right',
              render: (value: number) => (
                <Text strong style={{ color: '#3f8600' }}>
                  {Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </Text>
              ),
            },
            {
              title: '收款凭证',
              dataIndex: 'voucherNames',
              key: 'voucherNames',
              width: 280,
              render: (value: string[] = []) => {
                if (!value.length) return '-';
                return (
                  <Space size={[4, 4]} wrap>
                    {value.map((name) => (
                      <Tag key={name}>{name}</Tag>
                    ))}
                  </Space>
                );
              },
            },
            {
              title: '操作人',
              dataIndex: 'operator',
              key: 'operator',
              width: 100,
              render: (value?: string) => value || '-',
            },
            {
              title: '备注',
              dataIndex: 'remark',
              key: 'remark',
              ellipsis: true,
              render: (value?: string) => value || '-',
            },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={1}>
                <Text strong>合计</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text strong style={{ color: '#3f8600' }}>
                  {receiptSummary.totalReceived.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} colSpan={3} />
            </Table.Summary.Row>
          )}
        />
      </Card>
    </Drawer>
  );
};

export default FeeLedgerDetailDrawer;
