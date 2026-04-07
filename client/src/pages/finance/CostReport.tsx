import React, { useState, useMemo } from 'react';
import {
  Card, Table, DatePicker, Select, Space, Button, Statistic, Row, Col, Segmented
} from 'antd';
import {
  FileTextOutlined, DownloadOutlined, SwapOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;

// ===== 毛利表类型定义 =====
interface GrossProfitRow {
  id: string;
  jobNo: string;
  collNo: string;
  orderNo: string;
  date: string;
  salesPerson: string;
  shipper: string;
  consignee: string;
  chargeVolume?: number;
  chargeWeight: number;
  receivableRMB: number;
  receivedNGN?: number;
  receivedUSD?: number;
  rateNGN?: number;
  dueUSD: number;
  rateUSD: number;
  dueRMB: number;
  totalReceivable: number;
  agent: string;
  freightCost: number;
  pickupCost: number;
  deliveryCost: number;
  packagingCost: number;
  advancedFreight: number;
  originCostTotal: number;
  importCustomsFee: number;
  doorDeliveryFee: number;
  transhipmentFee: number;
  destCostUSD: number;
  destRate: number;
  destCostRMB: number;
  totalCost: number;
  profit: number;
  transportMode: 'AIR' | 'SEA';
  destination: string;
}

const DESTINATIONS = [
  { value: 'ALL', label: '全部' },
  { value: 'LOS', label: '拉各斯(LOS)' },
  { value: 'NBO', label: '贝宁科托努(NBO)' },
  { value: 'JNB', label: '南非(JNB)' },
  { value: 'ACC', label: '加纳(ACC)' },
  { value: 'VN', label: '越南' },
];

const SALES_PERSONS = ['黄颖', '三凤', '吕沛霖', '朱小飞', '罗伟健', '苏慧琪', '罗珮文', '曾永平', '陆梓龙', '谭小瑜', '吴敏琪', '浦海森'];

// ===== Mock 毛利数据生成 =====
const generateMockGrossProfit = (): GrossProfitRow[] => {
  const agents = ['广州顶派', '广州通达', '华茂青松', '智托', '上海旨福', '欧翔国际'];
  const shippers = ['ying', 'Sam.Pao', 'Bella Chan', 'Isabel Zhu', 'Kaylee', 'Shirley'];
  const consignees = ['yanjian', 'SEGUN', 'felix', 'james', 'Nick Wang', 'chuks'];
  const rows: GrossProfitRow[] = [];

  for (let mi = 0; mi < 12; mi++) {
    const mStr = String(mi + 1).padStart(2, '0');
    const month = `2024-${mStr}`;
    const jobCount = 3 + Math.floor(Math.random() * 5);
    for (let j = 0; j < jobCount; j++) {
      const isAir = Math.random() > 0.3;
      const isLOS = Math.random() > 0.25;
      const dest = isLOS ? 'LOS' : ['NBO', 'JNB', 'ACC', 'VN'][Math.floor(Math.random() * 4)];
      const sp = SALES_PERSONS[Math.floor(Math.random() * SALES_PERSONS.length)];
      const orderCount = 1 + Math.floor(Math.random() * 3);
      for (let o = 0; o < orderCount; o++) {
        const weight = Math.round(50 + Math.random() * 500);
        const volume = isAir ? undefined : +(1 + Math.random() * 30).toFixed(4);
        const receivableRMB = Math.round(1000 + Math.random() * 30000);
        const dueUSD = Math.round(50 + Math.random() * 2000);
        const rate = +(7.1 + Math.random() * 0.2).toFixed(2);
        const dueRMB = +(dueUSD * rate).toFixed(2);
        const totalReceivable = +(receivableRMB + dueRMB).toFixed(2);
        const freightCost = Math.round(receivableRMB * (0.3 + Math.random() * 0.3));
        const pickupCost = Math.round(20 + Math.random() * 100);
        const deliveryCost = Math.round(Math.random() * 50);
        const packagingCost = Math.round(Math.random() * 40);
        const advancedFreight = Math.round(Math.random() * 200);
        const originCostTotal = freightCost + pickupCost + deliveryCost + packagingCost + advancedFreight;
        const importCustomsFee = +(Math.random() * 50).toFixed(2);
        const doorDeliveryFee = +(Math.random() * 30).toFixed(2);
        const transhipmentFee = +(Math.random() * 10).toFixed(2);
        const destCostUSD = +(importCustomsFee + doorDeliveryFee + transhipmentFee).toFixed(2);
        const destCostRMB = +(destCostUSD * rate).toFixed(2);
        const totalCostVal = +(originCostTotal + destCostRMB).toFixed(2);

        rows.push({
          id: `GP-${mStr}-${j}-${o}`,
          jobNo: `JOB${mStr}0${300 + j + mi * 10}`,
          collNo: `COLL00${3700 + mi * 30 + j}`,
          orderNo: `24${mStr}${String(Math.floor(Math.random() * 50)).padStart(2, '0')}000${String(10 + o + j * 3)}`,
          date: `${month}-${String(5 + Math.floor(Math.random() * 20)).padStart(2, '0')}`,
          salesPerson: sp,
          shipper: shippers[Math.floor(Math.random() * shippers.length)],
          consignee: consignees[Math.floor(Math.random() * consignees.length)],
          chargeVolume: volume,
          chargeWeight: weight,
          receivableRMB,
          receivedNGN: isLOS ? Math.round(Math.random() * 500000) : undefined,
          receivedUSD: isLOS ? +(Math.random() * 1500).toFixed(2) : undefined,
          rateNGN: isLOS ? +(1500 + Math.random() * 200).toFixed(2) : undefined,
          dueUSD, rateUSD: rate, dueRMB, totalReceivable,
          agent: agents[Math.floor(Math.random() * agents.length)],
          freightCost, pickupCost, deliveryCost, packagingCost, advancedFreight, originCostTotal,
          importCustomsFee, doorDeliveryFee, transhipmentFee, destCostUSD, destRate: rate, destCostRMB,
          totalCost: totalCostVal,
          profit: +(totalReceivable - totalCostVal).toFixed(2),
          transportMode: isAir ? 'AIR' : 'SEA',
          destination: dest,
        });
      }
    }
  }
  return rows;
};

const fmt = (v: number, prefix = '¥') =>
  `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ==================== 毛利表（主组件） ====================
export const CostReport: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [month, setMonth] = useState<dayjs.Dayjs | null>(dayjs('2024-06'));
  const [transportMode, setTransportMode] = useState<string>(businessMode === 'SEA' ? 'SEA' : 'AIR');
  const [destination, setDestination] = useState('ALL');
  const [salesPerson, setSalesPerson] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'detail' | 'job'>('detail');

  const allData = useMemo(() => generateMockGrossProfit(), []);

  const filtered = useMemo(() =>
    allData.filter(r => {
      if (month && !r.date.startsWith(month.format('YYYY-MM'))) return false;
      if (r.transportMode !== transportMode) return false;
      if (destination !== 'ALL' && r.destination !== destination) return false;
      if (salesPerson && r.salesPerson !== salesPerson) return false;
      return true;
    }), [allData, month, transportMode, destination, salesPerson]);

  const stats = useMemo(() => {
    const totalRev = filtered.reduce((s, r) => s + r.totalReceivable, 0);
    const totalCostVal = filtered.reduce((s, r) => s + r.totalCost, 0);
    const totalProfit = filtered.reduce((s, r) => s + r.profit, 0);
    return { totalRev, totalCost: totalCostVal, totalProfit, profitRate: totalRev ? (totalProfit / totalRev * 100) : 0 };
  }, [filtered]);

  const jobSummary = useMemo(() => {
    const map = new Map<string, { jobNo: string; collNo: string; orderCount: number; totalReceivable: number; totalCost: number; profit: number }>();
    filtered.forEach(r => {
      const ex = map.get(r.jobNo) || { jobNo: r.jobNo, collNo: r.collNo, orderCount: 0, totalReceivable: 0, totalCost: 0, profit: 0 };
      ex.orderCount++;
      ex.totalReceivable += r.totalReceivable;
      ex.totalCost += r.totalCost;
      ex.profit += r.profit;
      map.set(r.jobNo, ex);
    });
    return Array.from(map.values()).map((r, i) => ({
      ...r, id: `JOB-${i}`,
      profitRate: r.totalReceivable ? (r.profit / r.totalReceivable * 100) : 0,
    }));
  }, [filtered]);

  const isLOS = destination === 'LOS' || destination === 'ALL';
  const isSea = transportMode === 'SEA';

  const buildDetailColumns = (): any[] => {
    const cols: any[] = [
      { title: 'JOB', dataIndex: 'jobNo', width: 130, fixed: 'left' as const, render: (v: string) => <span style={{ color: '#1677ff', cursor: 'pointer' }}>{v}</span> },
      { title: '集装编号', dataIndex: 'collNo', width: 130, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
      { title: '运单编号', dataIndex: 'orderNo', width: 140, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
      { title: '日期', dataIndex: 'date', width: 100, align: 'center' as const },
      { title: '业务员', dataIndex: 'salesPerson', width: 75, align: 'center' as const },
      { title: '发货人', dataIndex: 'shipper', width: 100 },
      { title: '收货人', dataIndex: 'consignee', width: 100 },
    ];
    if (isSea) cols.push({ title: '计费体积(m³)', dataIndex: 'chargeVolume', width: 110, align: 'right' as const, render: (v?: number) => v?.toFixed(4) ?? '-' });
    cols.push({ title: '计费重量(kg)', dataIndex: 'chargeWeight', width: 110, align: 'right' as const, render: (v: number) => v.toLocaleString() });

    // 应收列组
    const recvCols: any[] = [
      { title: '应收RMB', dataIndex: 'receivableRMB', width: 110, align: 'right' as const, render: (v: number) => fmt(v) },
    ];
    if (isLOS) {
      recvCols.push(
        { title: '收到NGN', dataIndex: 'receivedNGN', width: 100, align: 'right' as const, render: (v?: number) => v != null ? v.toLocaleString() : '-' },
        { title: '收到USD', dataIndex: 'receivedUSD', width: 100, align: 'right' as const, render: (v?: number) => v != null ? `$${v.toFixed(2)}` : '-' },
        { title: '汇率(NGN)', dataIndex: 'rateNGN', width: 85, align: 'right' as const, render: (v?: number) => v?.toFixed(2) ?? '-' },
      );
    }
    recvCols.push(
      { title: '到付USD', dataIndex: 'dueUSD', width: 100, align: 'right' as const, render: (v: number) => `$${v.toFixed(2)}` },
      { title: '汇率', dataIndex: 'rateUSD', width: 70, align: 'right' as const, render: (v: number) => v.toFixed(2) },
      { title: '到付折算¥', dataIndex: 'dueRMB', width: 110, align: 'right' as const, render: (v: number) => fmt(v) },
      { title: '总应收', dataIndex: 'totalReceivable', width: 120, align: 'right' as const, render: (v: number) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{fmt(v)}</span> },
    );
    cols.push({ title: '应收', children: recvCols });

    // 起运港成本列组
    cols.push({
      title: '起运港成本', children: [
        { title: '代理商', dataIndex: 'agent', width: 110 },
        { title: isSea ? '运费+报关费' : '运费', dataIndex: 'freightCost', width: 100, align: 'right' as const, render: (v: number) => fmt(v) },
        { title: '提货费', dataIndex: 'pickupCost', width: 85, align: 'right' as const, render: (v: number) => fmt(v) },
        { title: isSea ? '装卸费' : '送货费', dataIndex: 'deliveryCost', width: 85, align: 'right' as const, render: (v: number) => fmt(v) },
        { title: '包装费', dataIndex: 'packagingCost', width: 85, align: 'right' as const, render: (v: number) => fmt(v) },
        { title: '代垫运费', dataIndex: 'advancedFreight', width: 90, align: 'right' as const, render: (v: number) => fmt(v) },
        { title: '合计', dataIndex: 'originCostTotal', width: 110, align: 'right' as const, render: (v: number) => <b>{fmt(v)}</b> },
      ]
    });

    // 目的港成本列组
    cols.push({
      title: '目的港成本', children: [
        { title: '进口报关费', dataIndex: 'importCustomsFee', width: 100, align: 'right' as const, render: (v: number) => v.toFixed(2) },
        { title: '到门配送费', dataIndex: 'doorDeliveryFee', width: 100, align: 'right' as const, render: (v: number) => v.toFixed(2) },
        { title: '转运费', dataIndex: 'transhipmentFee', width: 85, align: 'right' as const, render: (v: number) => v.toFixed(2) },
        { title: '支出(USD)', dataIndex: 'destCostUSD', width: 100, align: 'right' as const, render: (v: number) => `$${v.toFixed(2)}` },
        { title: '汇率', dataIndex: 'destRate', width: 70, align: 'right' as const, render: (v: number) => v.toFixed(2) },
        { title: '成本(¥)', dataIndex: 'destCostRMB', width: 110, align: 'right' as const, render: (v: number) => fmt(v) },
      ]
    });

    // 汇总列组
    cols.push({
      title: '汇总', children: [
        { title: '总支出', dataIndex: 'totalCost', width: 120, align: 'right' as const, fixed: 'right' as const, render: (v: number) => <span style={{ color: '#fa8c16', fontWeight: 'bold' }}>{fmt(v)}</span> },
        { title: '利润', dataIndex: 'profit', width: 120, align: 'right' as const, fixed: 'right' as const, render: (v: number) => <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>{fmt(v)}</span> },
      ]
    });

    return cols;
  };

  const jobColumns = [
    { title: 'JOB', dataIndex: 'jobNo', width: 150, render: (v: string) => <span style={{ color: '#1677ff' }}>{v}</span> },
    { title: '集装编号', dataIndex: 'collNo', width: 150, render: (v: string) => <code>{v}</code> },
    { title: '运单数', dataIndex: 'orderCount', width: 80, align: 'right' as const },
    { title: '总应收(¥)', dataIndex: 'totalReceivable', width: 140, align: 'right' as const, render: (v: number) => <span style={{ color: '#52c41a' }}>{fmt(v)}</span> },
    { title: '总成本(¥)', dataIndex: 'totalCost', width: 140, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '利润(¥)', dataIndex: 'profit', width: 140, align: 'right' as const, render: (v: number) => <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>{fmt(v)}</span> },
    { title: '毛利率', dataIndex: 'profitRate', width: 90, align: 'right' as const, render: (v: number) => <span style={{ color: v >= 20 ? '#52c41a' : v >= 10 ? '#faad14' : '#ff4d4f' }}>{v.toFixed(1)}%</span> },
  ];

  const detailColumns = buildDetailColumns();

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总应收" value={stats.totalRev} prefix="¥" precision={2} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="总成本" value={stats.totalCost} prefix="¥" precision={2} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="总利润" value={stats.totalProfit} prefix="¥" precision={2} valueStyle={{ color: stats.totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="毛利率" value={stats.profitRate} suffix="%" precision={1} valueStyle={{ color: stats.profitRate >= 15 ? '#52c41a' : '#ff4d4f' }} /></Card></Col>
      </Row>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <DatePicker picker="month" value={month} onChange={setMonth} placeholder="选择月份" allowClear />
          <Segmented options={[{ label: '空运', value: 'AIR' }, { label: '海运', value: 'SEA' }]} value={transportMode} onChange={v => setTransportMode(v as string)} />
          <Select style={{ width: 160 }} value={destination} onChange={setDestination}>
            {DESTINATIONS.map(d => <Option key={d.value} value={d.value}>{d.label}</Option>)}
          </Select>
          <Select style={{ width: 120 }} value={salesPerson} onChange={setSalesPerson} placeholder="业务员" allowClear>
            {SALES_PERSONS.map(s => <Option key={s} value={s}>{s}</Option>)}
          </Select>
          <Segmented
            options={[
              { label: '运单明细', value: 'detail', icon: <FileTextOutlined /> },
              { label: 'JOB汇总', value: 'job', icon: <SwapOutlined /> },
            ]}
            value={viewMode} onChange={v => setViewMode(v as 'detail' | 'job')}
          />
          <Button icon={<DownloadOutlined />}>导出Excel</Button>
        </Space>
      </Card>
      <Card>
        {viewMode === 'detail' ? (
          <Table
            rowKey="id" columns={detailColumns} dataSource={filtered}
            scroll={{ x: isSea ? 3200 : 3000 }} bordered size="small"
            pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
            summary={() => {
              const sumWeight = filtered.reduce((s, r) => s + r.chargeWeight, 0);
              const sumVolume = filtered.reduce((s, r) => s + (r.chargeVolume || 0), 0);
              // 逐列输出 summary，避免 colSpan 导致 fixed 列错位
              // 基本信息列：JOB, 集装, 运单, 日期, 业务员, 发货人, 收货人 = 7列
              // 海运多1列(体积), 然后重量1列
              // 应收: LOS=8列(应收RMB,NGN,USD,汇率NGN,到付USD,汇率,折算¥,总应收), 非LOS=5列
              // 起运港成本: 7列(代理商,运费,提货费,送货/装卸,包装费,代垫,合计)
              // 目的港成本: 6列(报关费,配送费,转运费,支出USD,汇率,成本¥)
              // 汇总: 2列(总支出,利润) - fixed right
              const recvCount = isLOS ? 8 : 5;
              const cells: React.ReactNode[] = [];
              let idx = 0;
              // 基本信息7列 - 第一列显示合计文字
              cells.push(<Table.Summary.Cell key={idx} index={idx}><b>合计（{filtered.length}条）</b></Table.Summary.Cell>);
              idx++;
              for (let i = 1; i < 7; i++) { cells.push(<Table.Summary.Cell key={idx} index={idx} />); idx++; }
              // 海运体积列
              if (isSea) { cells.push(<Table.Summary.Cell key={idx} index={idx} align="right"><b>{sumVolume.toFixed(2)}</b></Table.Summary.Cell>); idx++; }
              // 重量列
              cells.push(<Table.Summary.Cell key={idx} index={idx} align="right"><b>{sumWeight.toLocaleString()}</b></Table.Summary.Cell>); idx++;
              // 应收列 - 最后一列(总应收)显示数值，其余留空
              for (let i = 0; i < recvCount - 1; i++) { cells.push(<Table.Summary.Cell key={idx} index={idx} />); idx++; }
              cells.push(<Table.Summary.Cell key={idx} index={idx} align="right"><b style={{ color: '#52c41a' }}>{fmt(stats.totalRev)}</b></Table.Summary.Cell>); idx++;
              // 起运港成本7列 - 最后一列(合计)显示数值
              for (let i = 0; i < 6; i++) { cells.push(<Table.Summary.Cell key={idx} index={idx} />); idx++; }
              cells.push(<Table.Summary.Cell key={idx} index={idx} align="right"><b>{fmt(filtered.reduce((s, r) => s + r.originCostTotal, 0))}</b></Table.Summary.Cell>); idx++;
              // 目的港成本6列 - 最后一列(成本¥)显示数值
              for (let i = 0; i < 5; i++) { cells.push(<Table.Summary.Cell key={idx} index={idx} />); idx++; }
              cells.push(<Table.Summary.Cell key={idx} index={idx} align="right"><b>{fmt(filtered.reduce((s, r) => s + r.destCostRMB, 0))}</b></Table.Summary.Cell>); idx++;
              // 汇总2列 - fixed right
              cells.push(<Table.Summary.Cell key={idx} index={idx} align="right"><b style={{ color: '#fa8c16' }}>{fmt(stats.totalCost)}</b></Table.Summary.Cell>); idx++;
              cells.push(<Table.Summary.Cell key={idx} index={idx} align="right"><b style={{ color: stats.totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}>{fmt(stats.totalProfit)}</b></Table.Summary.Cell>);
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>{cells}</Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        ) : (
          <Table
            rowKey="id" columns={jobColumns} dataSource={jobSummary}
            scroll={{ x: 900 }} bordered size="small"
            pagination={{ pageSize: 50, showTotal: t => `共 ${t} 个JOB` }}
            expandable={{
              expandedRowRender: (record) => {
                const orders = filtered.filter(r => r.jobNo === record.jobNo);
                return <Table rowKey="id" columns={detailColumns} dataSource={orders} scroll={{ x: 3000 }} size="small" pagination={false} bordered />;
              }
            }}
            summary={() => (
              <Table.Summary>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}><b>合计</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right"><b>{jobSummary.reduce((s, r) => s + r.orderCount, 0)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right"><b style={{ color: '#52c41a' }}>{fmt(stats.totalRev)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right"><b>{fmt(stats.totalCost)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right"><b style={{ color: stats.totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}>{fmt(stats.totalProfit)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right"><b>{stats.profitRate.toFixed(1)}%</b></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        )}
      </Card>
    </div>
  );
};
