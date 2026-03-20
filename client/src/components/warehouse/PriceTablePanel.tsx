import React, { useEffect, useMemo, useState } from 'react';
import { Collapse, Table, Tag, Typography, Button, message, Space, Spin } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { systemApi } from '../../api';

export interface PriceTablePanelProps {
  routeCode: string;
  serviceType: 'EXPRESS' | 'STANDARD';
}

interface FreightRateRow {
  id: string;
  name: string;
  transportMode: 'AIR' | 'SEA_LCL';
  currency: string;
  unitPrice: number;
  unitType: string;
  minCharge?: number;
  remark?: string;
  updatedAt?: string;
  createdAt?: string;
}

const columns = [
  { title: '规则名称', dataIndex: 'name', key: 'name', width: 220 },
  {
    title: '运输类型',
    dataIndex: 'transportMode',
    key: 'transportMode',
    width: 110,
    render: (value: string) => <Tag color={value === 'AIR' ? 'blue' : 'purple'}>{value}</Tag>,
  },
  {
    title: '单价',
    key: 'unitPrice',
    width: 140,
    align: 'right' as const,
    render: (_: unknown, row: FreightRateRow) => `${row.currency} ${Number(row.unitPrice || 0).toFixed(2)}${row.unitType || ''}`,
  },
  {
    title: '最低计费',
    dataIndex: 'minCharge',
    key: 'minCharge',
    width: 110,
    align: 'right' as const,
    render: (value: number) => (value ? value.toFixed(2) : '-'),
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 180,
    render: (_: unknown, row: FreightRateRow) => {
      const time = row.updatedAt || row.createdAt;
      return time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-';
    },
  },
];

const PriceTablePanel: React.FC<PriceTablePanelProps> = ({ routeCode, serviceType }) => {
  const [activeKey, setActiveKey] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FreightRateRow[]>([]);

  const transportMode: 'AIR' | 'SEA_LCL' = serviceType === 'EXPRESS' ? 'AIR' : 'SEA_LCL';

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res: any = await systemApi.listFreightRates({ status: 'ACTIVE' });
      const list = Array.isArray(res?.data) ? res.data : [];
      setRows(list);
    } catch (err: any) {
      message.error(err?.message || '加载运价规则失败');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => row.transportMode === transportMode);
  }, [rows, transportMode]);

  const latestUpdate = useMemo(() => {
    const sorted = [...filteredRows]
      .map((row) => row.updatedAt || row.createdAt)
      .filter(Boolean)
      .sort();
    return sorted.length ? sorted[sorted.length - 1] : null;
  }, [filteredRows]);

  const headerContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Typography.Text strong>{routeCode || '未识别线路'}</Typography.Text>
      <Tag color={serviceType === 'EXPRESS' ? 'red' : 'blue'}>{serviceType === 'EXPRESS' ? '特快' : '普快'}</Tag>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        <ClockCircleOutlined style={{ marginRight: 4 }} />
        数据来源：数据库运价规则
      </Typography.Text>
    </div>
  );

  const panelContent = (
    <Spin spinning={loading}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            更新时间：{latestUpdate ? dayjs(latestUpdate).format('YYYY-MM-DD HH:mm:ss') : '--'}
          </Typography.Text>
          <Space>
            <Tag>{transportMode}</Tag>
            <Button size="small" type="link" onClick={fetchRates}>刷新</Button>
          </Space>
        </div>

        <Table<FreightRateRow>
          columns={columns}
          dataSource={filteredRows}
          rowKey="id"
          pagination={false}
          size="small"
          bordered
          style={{ marginBottom: 16 }}
        />

        <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
          备注说明
        </Typography.Text>
        {filteredRows.length > 0 ? (
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {filteredRows.map((row) => (
              <li key={row.id} style={{ marginBottom: 4 }}>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {row.name}：{row.remark || '无'}
                </Typography.Text>
              </li>
            ))}
          </ul>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            未匹配到数据库运价规则，请先到「系统设置-运费规则」维护。
          </Typography.Text>
        )}
      </div>
    </Spin>
  );

  return (
    <Collapse
      activeKey={activeKey}
      onChange={(keys) => setActiveKey(keys as string[])}
      items={[
        {
          key: 'price-panel',
          label: headerContent,
          children: panelContent,
        },
      ]}
      style={{ marginBottom: 12 }}
    />
  );
};

export default PriceTablePanel;
