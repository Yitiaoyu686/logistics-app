import React, { useState, useMemo } from 'react';
import { Card, Table, Button, Checkbox, Space, message, theme } from 'antd';
import { ArrowLeftOutlined, ScanOutlined } from '@ant-design/icons';

interface DPNInboundItem {
  id: string;
  dpnNo: string;
  dpnRoute: string;
  dpnCreatedAt: string;
  jobStation: string;
  jobNo: string;
  trackingNo: string;
  salesPerson: string;
  userName: string;
  route: string;
  pieces: number;
  weightKg: number;
  arrivedWarehouse: boolean;
  goodsDamaged: boolean;
  packageDamaged: boolean;
  goodsLost: boolean;
}

const initialMockData: DPNInboundItem[] = [
  // JOB123458 IKEJ STA — group 1 (5 records)
  {
    id: '1', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123458 IKEJ STA', jobNo: 'JOB123458', trackingNo: '191018000005 01',
    salesPerson: 'AkinGbolahan', userName: 'AkinGbolahan', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 0.52, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  {
    id: '2', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123458 IKEJ STA', jobNo: 'JOB123458', trackingNo: '191018000005 14',
    salesPerson: 'AkinGbolahan', userName: 'AkinGbolahan', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 0.92, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  {
    id: '3', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123458 IKEJ STA', jobNo: 'JOB123458', trackingNo: '191018000005 15',
    salesPerson: 'AkinGbolahan', userName: 'AkinGbolahan', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 0.12, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  {
    id: '4', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123458 IKEJ STA', jobNo: 'JOB123458', trackingNo: '191018000005 16',
    salesPerson: 'AkinGbolahan', userName: 'AkinGbolahan', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 2.2, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  {
    id: '5', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123458 IKEJ STA', jobNo: 'JOB123458', trackingNo: '191019000025 06',
    salesPerson: 'Andi MailMail', userName: 'Andi MailMail', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 7.1, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  // JOB123458 IKEJ STA — group 2 (3 records)
  {
    id: '6', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123458 IKEJ STA', jobNo: 'JOB123458', trackingNo: '191018000005 02',
    salesPerson: 'AkinGbolahan', userName: 'AkinGbolahan', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 1.14, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  {
    id: '7', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123458 IKEJ STA', jobNo: 'JOB123458', trackingNo: '191018000005 14',
    salesPerson: 'AkinGbolahan', userName: 'AkinGbolahan', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 0.92, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  {
    id: '8', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123458 IKEJ STA', jobNo: 'JOB123458', trackingNo: '191018000005 15',
    salesPerson: 'AkinGbolahan', userName: 'AkinGbolahan', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 0.12, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  // JOB123461 IKEJ STA (4 records)
  {
    id: '9', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123461 IKEJ STA', jobNo: 'JOB123461', trackingNo: '191018000005 16',
    salesPerson: 'AkinGbolahan', userName: 'AkinGbolahan', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 2.2, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  {
    id: '10', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123461 IKEJ STA', jobNo: 'JOB123461', trackingNo: '191019000025 06',
    salesPerson: 'Andi MailMail', userName: 'Andi MailMail', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 7.1, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  {
    id: '11', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123461 IKEJ STA', jobNo: 'JOB123461', trackingNo: '191021000001 01',
    salesPerson: 'AkinGbolahan', userName: 'AkinGbolahan', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 1.1, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
  {
    id: '12', dpnNo: 'DPN123456', dpnRoute: 'IKEJ STA-ABUJ STA', dpnCreatedAt: '2019/10/25 11:55:36',
    jobStation: 'JOB123461 IKEJ STA', jobNo: 'JOB123461', trackingNo: '191021000003 02',
    salesPerson: 'Andi MailMail', userName: 'Andi MailMail', route: 'CAN.CHN→ABV.NGN',
    pieces: 1, weightKg: 0.94, arrivedWarehouse: true, goodsDamaged: false, packageDamaged: false, goodsLost: false,
  },
];

/**
 * Calculate rowSpan for consecutive groups of the same key value.
 * Returns an array of rowSpan values: first item in each group gets group size, others get 0.
 */
const calcRowSpan = (data: DPNInboundItem[], key: keyof DPNInboundItem): number[] => {
  const spans: number[] = new Array(data.length).fill(0);
  let i = 0;
  while (i < data.length) {
    let j = i + 1;
    while (j < data.length && data[j][key] === data[i][key]) {
      j++;
    }
    spans[i] = j - i;
    // others in the group remain 0
    i = j;
  }
  return spans;
};

export const DPNInbound: React.FC<{ businessMode?: string }> = ({ businessMode: _businessMode }) => {
  const { token } = theme.useToken();
  const [items, setItems] = useState<DPNInboundItem[]>(initialMockData);
  const [scanMode, setScanMode] = useState(false);

  const jobStationSpans = useMemo(() => calcRowSpan(items, 'jobStation'), [items]);
  const dpnSpans = useMemo(() => {
    // DPN column: first item spans all rows, rest 0
    const spans: number[] = new Array(items.length).fill(0);
    if (items.length > 0) spans[0] = items.length;
    return spans;
  }, [items]);

  const totalPieces = useMemo(() => items.reduce((sum, it) => sum + it.pieces, 0), [items]);
  const totalWeight = useMemo(() => items.reduce((sum, it) => sum + it.weightKg, 0), [items]);

  const handleCheckboxChange = (id: string, field: 'arrivedWarehouse' | 'goodsDamaged' | 'packageDamaged' | 'goodsLost', checked: boolean) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: checked } : item));
  };

  const handleBack = () => {
    message.info('返回上级页面');
  };

  const handleSubmit = () => {
    message.success('DPN入库确认成功');
  };

  const columns = [
    {
      title: 'DPN',
      dataIndex: 'dpnNo',
      key: 'dpn',
      width: 200,
      onCell: (_: DPNInboundItem, index?: number) => ({
        rowSpan: index !== undefined ? dpnSpans[index] : 1,
      }),
      render: (_: string, record: DPNInboundItem) => (
        <div>
          <div style={{ fontWeight: 600, color: token.colorPrimary }}>{record.dpnNo}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.dpnRoute}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.dpnCreatedAt}</div>
        </div>
      ),
    },
    {
      title: 'JOB/站点',
      dataIndex: 'jobStation',
      key: 'jobStation',
      width: 180,
      onCell: (_: DPNInboundItem, index?: number) => ({
        rowSpan: index !== undefined ? jobStationSpans[index] : 1,
      }),
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '单号',
      dataIndex: 'trackingNo',
      key: 'trackingNo',
      width: 160,
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 130,
    },
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      width: 130,
    },
    {
      title: '线路',
      dataIndex: 'route',
      key: 'route',
      width: 160,
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 70,
      align: 'center' as const,
    },
    {
      title: '重量Kg',
      dataIndex: 'weightKg',
      key: 'weightKg',
      width: 90,
      align: 'center' as const,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: '到达仓库',
      dataIndex: 'arrivedWarehouse',
      key: 'arrivedWarehouse',
      width: 90,
      align: 'center' as const,
      render: (val: boolean, record: DPNInboundItem) => (
        <Checkbox checked={val} onChange={e => handleCheckboxChange(record.id, 'arrivedWarehouse', e.target.checked)} />
      ),
    },
    {
      title: '货物损坏',
      dataIndex: 'goodsDamaged',
      key: 'goodsDamaged',
      width: 90,
      align: 'center' as const,
      render: (val: boolean, record: DPNInboundItem) => (
        <Checkbox checked={val} onChange={e => handleCheckboxChange(record.id, 'goodsDamaged', e.target.checked)} />
      ),
    },
    {
      title: '包装损坏',
      dataIndex: 'packageDamaged',
      key: 'packageDamaged',
      width: 90,
      align: 'center' as const,
      render: (val: boolean, record: DPNInboundItem) => (
        <Checkbox checked={val} onChange={e => handleCheckboxChange(record.id, 'packageDamaged', e.target.checked)} />
      ),
    },
    {
      title: '货物丢失',
      dataIndex: 'goodsLost',
      key: 'goodsLost',
      width: 90,
      align: 'center' as const,
      render: (val: boolean, record: DPNInboundItem) => (
        <Checkbox checked={val} onChange={e => handleCheckboxChange(record.id, 'goodsLost', e.target.checked)} />
      ),
    },
  ];

  return (
    <div style={{ padding: token.padding }}>
      {/* Top bar */}
      <Card
        style={{ marginBottom: token.marginMD }}
        bodyStyle={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: token.colorText }}>DPN入库</span>
        <Checkbox
          checked={scanMode}
          onChange={e => setScanMode(e.target.checked)}
        >
          <Space size={4}>
            <ScanOutlined style={{ color: token.colorPrimary }} />
            <span>{scanMode ? '扫码入库' : '手动入库'}</span>
          </Space>
        </Checkbox>
      </Card>

      {/* Table */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          bordered
          pagination={false}
          scroll={{ x: 1500 }}
          size="small"
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={6} align="right">
                  <span style={{ fontWeight: 600 }}>合计</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="center">
                  <span style={{ fontWeight: 600, color: token.colorPrimary }}>{totalPieces}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="center">
                  <span style={{ fontWeight: 600, color: token.colorPrimary }}>{totalWeight.toFixed(2)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} colSpan={4} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* Bottom buttons */}
      <div style={{ marginTop: token.marginMD, display: 'flex', justifyContent: 'flex-end', gap: token.marginSM }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
          返回
        </Button>
        <Button type="primary" onClick={handleSubmit}>
          提交
        </Button>
      </div>
    </div>
  );
};
