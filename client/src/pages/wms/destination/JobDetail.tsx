import React, { useMemo } from 'react';
import { Table, Tag, Space, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownOutlined } from '@ant-design/icons';
import { getInboundItemsByJob, type InboundOperationItem } from './DestInboundOperation';

interface JobDetailProps {
  jobNo: string;
}

interface CollRow {
  id: string;
  collNo: string;
  collPieces: number;
  station: string;
  innerPieces: number;
  totalWeightKg: number;
  arrivedCount: number;
  waybills: InboundOperationItem[];
}

const { Text } = Typography;

export const JobDetail: React.FC<JobDetailProps> = ({ jobNo }) => {
  const waybills = useMemo(() => getInboundItemsByJob(jobNo), [jobNo]);

  const collRows = useMemo<CollRow[]>(() => {
    const grouped = new Map<string, InboundOperationItem[]>();
    waybills.forEach((item) => {
      const list = grouped.get(item.collNumber) || [];
      list.push(item);
      grouped.set(item.collNumber, list);
    });

    return Array.from(grouped.entries()).map(([collNo, items]) => {
      const first = items[0];
      return {
        id: `${first.jobNo}-${collNo}`,
        collNo,
        collPieces: first.collPieces,
        station: first.jobStation.replace(first.jobNo, '').trim(),
        innerPieces: items.reduce((sum, item) => sum + item.pieces, 0),
        totalWeightKg: items.reduce((sum, item) => sum + item.weightKg, 0),
        arrivedCount: items.filter((item) => item.arrivedWarehouse).length,
        waybills: items,
      };
    });
  }, [waybills]);

  const summary = useMemo(() => ({
    collCount: collRows.length,
    waybillCount: waybills.length,
    arrivedWaybillCount: waybills.filter((item) => item.arrivedWarehouse).length,
    totalPieces: waybills.reduce((sum, item) => sum + item.pieces, 0),
    totalWeight: waybills.reduce((sum, item) => sum + item.weightKg, 0),
  }), [collRows, waybills]);

  const collColumns: ColumnsType<CollRow> = [
    {
      title: '集装号',
      dataIndex: 'collNo',
      key: 'collNo',
      width: 110,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: '站点',
      dataIndex: 'station',
      key: 'station',
      width: 140,
      render: (value: string) => value || '-',
    },
    {
      title: '集装计划件数',
      dataIndex: 'collPieces',
      key: 'collPieces',
      width: 120,
      align: 'right',
    },
    {
      title: '当前运单数',
      dataIndex: 'innerPieces',
      key: 'innerPieces',
      width: 120,
      align: 'right',
    },
    {
      title: '已入库/总运单',
      key: 'arrivedRate',
      width: 130,
      render: (_: unknown, record: CollRow) => (
        <Tag color={record.arrivedCount === record.waybills.length ? 'success' : 'processing'}>
          {record.arrivedCount}/{record.waybills.length}
        </Tag>
      ),
    },
    {
      title: '总重量Kg',
      dataIndex: 'totalWeightKg',
      key: 'totalWeightKg',
      width: 120,
      align: 'right',
      render: (value: number) => value.toFixed(2),
    },
  ];

  const waybillColumns: ColumnsType<InboundOperationItem> = [
    {
      title: '运单号',
      dataIndex: 'trackingNo',
      key: 'trackingNo',
      width: 180,
    },
    {
      title: '入库状态',
      key: 'arrivedWarehouse',
      width: 100,
      render: (_: unknown, record: InboundOperationItem) => (
        <Tag color={record.arrivedWarehouse ? 'green' : 'default'}>
          {record.arrivedWarehouse ? '已入库' : '待入库'}
        </Tag>
      ),
    },
    {
      title: '放行状态',
      key: 'clearanceStatus',
      width: 100,
      render: (_: unknown, record: InboundOperationItem) => (
        <Tag color={record.clearanceStatus === 'CLEARED' ? 'green' : 'orange'}>
          {record.clearanceStatus === 'CLEARED' ? '已放行' : '未放行'}
        </Tag>
      ),
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 80,
      align: 'right',
    },
    {
      title: '重量Kg',
      dataIndex: 'weightKg',
      key: 'weightKg',
      width: 100,
      align: 'right',
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 120,
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      render: (value: string) => value || '-',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Space size={[8, 8]} wrap>
        <Text strong style={{ fontSize: 16 }}>JOB {jobNo}</Text>
        <Tag color="blue">集装号 {summary.collCount}</Tag>
        <Text type="secondary">
          运单 {summary.waybillCount} | 已入库 {summary.arrivedWaybillCount}
        </Text>
        <Text type="secondary">
          总件数 {summary.totalPieces} | 总重量 {summary.totalWeight.toFixed(2)} Kg
        </Text>
      </Space>

      <Table
        rowKey="id"
        columns={collColumns}
        dataSource={collRows}
        pagination={false}
        bordered={false}
        size="middle"
        expandable={{
          expandedRowRender: (record) => (
            <Table<InboundOperationItem>
              rowKey="id"
              columns={waybillColumns}
              dataSource={record.waybills}
              pagination={false}
              bordered={false}
              size="small"
            />
          ),
          expandIcon: ({ expanded, onExpand, record }) => (
            <a
              onClick={(e) => onExpand(record, e)}
              style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <DownOutlined rotate={expanded ? 180 : 0} />
              {expanded ? '收起运单' : '展开运单'}
            </a>
          ),
          rowExpandable: (record) => record.waybills.length > 0,
        }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}>
                <strong>合计</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <strong>{summary.totalPieces}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4}>
                <Tag color={summary.arrivedWaybillCount === summary.waybillCount ? 'success' : 'processing'}>
                  {summary.arrivedWaybillCount}/{summary.waybillCount}
                </Tag>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <strong>{summary.totalWeight.toFixed(2)}</strong>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  );
};
