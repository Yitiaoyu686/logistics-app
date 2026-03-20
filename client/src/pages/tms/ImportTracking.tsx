import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Input, Select, DatePicker, Tag, Space,
  Row, Col, Statistic, message, Drawer, Descriptions, Steps
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  ClockCircleOutlined, CheckCircleOutlined, WarningOutlined,
  SafetyCertificateOutlined, CarOutlined, InboxOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { jobApi } from '../../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

// Types
type ImportStatus = 'ARRIVED' | 'CUSTOMS' | 'INSPECTING' | 'RELEASED' | 'PICKUP' | 'COMPLETED';
type TransportType = 'SEA' | 'AIR';

interface ImportTrackingRecord {
  id: string;
  jobNo: string;
  transportType: TransportType;
  route: string;
  vesselFlight: string;
  eta: string;
  ata?: string;
  status: ImportStatus;
  containerCount: number;
  operator: string;
  clientName: string;
  pieces: number;
  weight: number;
  customsBroker?: string;
  remark?: string;
  createdAt: string;
  timeline: {
    arrived?: string;
    customsStart?: string;
    inspecting?: string;
    released?: string;
    pickup?: string;
  };
}

const STATUS_CONFIG: Record<ImportStatus, { text: string; color: string }> = {
  ARRIVED: { text: '已到港', color: 'blue' },
  CUSTOMS: { text: '清关中', color: 'orange' },
  INSPECTING: { text: '查验中', color: 'volcano' },
  RELEASED: { text: '已放行', color: 'green' },
  PICKUP: { text: '提货中', color: 'cyan' },
  COMPLETED: { text: '已完成', color: 'default' },
};

const TRANSPORT_CONFIG: Record<TransportType, { text: string; color: string }> = {
  SEA: { text: '海运', color: 'blue' },
  AIR: { text: '空运', color: 'purple' },
};

// Map destPhaseStatus to ImportStatus
const mapDestPhaseToImportStatus = (destPhaseStatus?: string): ImportStatus => {
  switch (destPhaseStatus) {
    case 'IN_TRANSIT': return 'ARRIVED';
    case 'CUSTOMS_CLEARANCE': return 'CUSTOMS';
    case 'CLEARED': return 'RELEASED';
    case 'RELEASED': return 'COMPLETED';
    default: return 'ARRIVED';
  }
};

// Generate timeline from destPhaseStatus and timestamps
const generateTimeline = (job: any): ImportTrackingRecord['timeline'] => {
  const timeline: ImportTrackingRecord['timeline'] = {};
  if (job.ata) timeline.arrived = job.ata;
  const status = mapDestPhaseToImportStatus(job.destPhaseStatus);
  if (['CUSTOMS', 'INSPECTING', 'RELEASED', 'PICKUP', 'COMPLETED'].includes(status)) {
    timeline.customsStart = job.ata || job.eta;
  }
  if (['RELEASED', 'PICKUP', 'COMPLETED'].includes(status)) {
    timeline.released = job.updatedAt || job.ata || job.eta;
  }
  if (status === 'COMPLETED') {
    timeline.pickup = job.updatedAt || job.ata || job.eta;
  }
  return timeline;
};

const mapJobToRecord = (job: any, index: number): ImportTrackingRecord => ({
  id: String(index + 1),
  jobNo: job.jobNo || '',
  transportType: (job.transportType === 'AIR' ? 'AIR' : 'SEA') as TransportType,
  route: job.route || `${job.pol || ''}-${job.pod || ''}`,
  vesselFlight: job.vesselVoyage || job.flightNo || '-',
  eta: job.eta || '',
  ata: job.ata,
  status: mapDestPhaseToImportStatus(job.destPhaseStatus),
  containerCount: job.stats?.containers || 0,
  operator: job.destOperator || '操作员',
  clientName: job.subOrders?.[0]?.customerName || '-',
  pieces: job.stats?.pieces || 0,
  weight: job.stats?.weight || 0,
  createdAt: job.createdAt || '',
  timeline: generateTimeline(job),
});

export const ImportTracking = () => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ImportTrackingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ImportTrackingRecord[]>([]);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterRoute, setFilterRoute] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<ImportStatus | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  // Drawer
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ImportTrackingRecord | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await jobApi.list({});
      const rows = ((res as any).data || res || []) as any[];
      const mapped = rows.map((job: any, i: number) => mapJobToRecord(job, i));
      setRecords(mapped);
      setFilteredRecords(mapped);
    } catch (err: any) {
      message.error('加载数据失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Stats
  const waitingCustoms = records.filter(r => r.status === 'ARRIVED').length;
  const inCustoms = records.filter(r => ['CUSTOMS', 'INSPECTING'].includes(r.status)).length;
  const cleared = records.filter(r => r.status === 'RELEASED' || r.status === 'PICKUP').length;
  const released = records.filter(r => r.status === 'COMPLETED').length;

  const routes = [...new Set(records.map(r => r.route))];

  const handleSearch = () => {
    let filtered = [...records];
    if (searchText) {
      const kw = searchText.toLowerCase();
      filtered = filtered.filter(r => r.jobNo.toLowerCase().includes(kw) || r.vesselFlight.toLowerCase().includes(kw));
    }
    if (filterRoute !== 'ALL') filtered = filtered.filter(r => r.route === filterRoute);
    if (filterStatus !== 'ALL') filtered = filtered.filter(r => r.status === filterStatus);
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(r => {
        const d = dayjs(r.eta);
        return d.isAfter(dateRange[0]) && d.isBefore(dateRange[1]);
      });
    }
    setFilteredRecords(filtered);
  };

  const handleReset = () => {
    setSearchText('');
    setFilterRoute('ALL');
    setFilterStatus('ALL');
    setDateRange([null, null]);
    setFilteredRecords(records);
  };

  const openDetail = (record: ImportTrackingRecord) => {
    setCurrentRecord(record);
    setDrawerVisible(true);
  };

  const getStepStatus = (record: ImportTrackingRecord) => {
    const steps = ['arrived', 'customsStart', 'inspecting', 'released', 'pickup'] as const;
    let current = 0;
    for (let i = 0; i < steps.length; i++) {
      if (record.timeline[steps[i]]) current = i + 1;
    }
    return current;
  };

  const columns = [
    {
      title: '任务号', dataIndex: 'jobNo', key: 'jobNo', width: 160,
      render: (text: string, record: ImportTrackingRecord) => (
        <a onClick={() => openDetail(record)}>{text}</a>
      ),
    },
    {
      title: '运输方式', dataIndex: 'transportType', key: 'transportType', width: 90,
      render: (t: TransportType) => <Tag color={TRANSPORT_CONFIG[t].color}>{TRANSPORT_CONFIG[t].text}</Tag>,
    },
    { title: '航线', dataIndex: 'route', key: 'route', width: 100 },
    { title: '船名/航班', dataIndex: 'vesselFlight', key: 'vesselFlight', width: 180 },
    {
      title: 'ETA', dataIndex: 'eta', key: 'eta', width: 110,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD'),
      sorter: (a: ImportTrackingRecord, b: ImportTrackingRecord) => dayjs(a.eta).unix() - dayjs(b.eta).unix(),
    },
    {
      title: 'ATA', dataIndex: 'ata', key: 'ata', width: 140,
      render: (t?: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: ImportStatus) => <Tag color={STATUS_CONFIG[s].color}>{STATUS_CONFIG[s].text}</Tag>,
    },
    {
      title: '柜量', dataIndex: 'containerCount', key: 'containerCount', width: 70, align: 'center' as const,
      render: (v: number) => v || '-',
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right' as const,
      render: (_: any, record: ImportTrackingRecord) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>详情</Button>
      ),
    },
  ];

  return (
    <div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="待清关" value={waitingCustoms} suffix="票" valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="清关中" value={inCustoms} suffix="票" valueStyle={{ color: '#fa8c16' }} prefix={<SafetyCertificateOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="已清关" value={cleared} suffix="票" valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="已完成" value={released} suffix="票" valueStyle={{ color: '#999' }} prefix={<InboxOutlined />} /></Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="搜索任务号/船名航班" value={searchText} onChange={e => setSearchText(e.target.value)} onPressEnter={handleSearch} style={{ width: 220 }} allowClear />
          <Select value={filterRoute} onChange={setFilterRoute} style={{ width: 130 }}>
            <Option value="ALL">全部航线</Option>
            {routes.map(r => <Option key={r} value={r}>{r}</Option>)}
          </Select>
          <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 120 }}>
            <Option value="ALL">全部状态</Option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <RangePicker value={dateRange} onChange={setDateRange as any} format="YYYY-MM-DD" placeholder={['ETA开始', 'ETA结束']} />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条记录` }}
        />
      </Card>

      <Drawer
        title="进口跟踪详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={640}
        destroyOnClose
      >
        {currentRecord && (
          <div>
            <Descriptions title="任务信息" column={2} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="任务号">{currentRecord.jobNo}</Descriptions.Item>
              <Descriptions.Item label="运输方式">
                <Tag color={TRANSPORT_CONFIG[currentRecord.transportType].color}>{TRANSPORT_CONFIG[currentRecord.transportType].text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="航线">{currentRecord.route}</Descriptions.Item>
              <Descriptions.Item label="船名/航班">{currentRecord.vesselFlight}</Descriptions.Item>
              <Descriptions.Item label="ETA">{dayjs(currentRecord.eta).format('YYYY-MM-DD')}</Descriptions.Item>
              <Descriptions.Item label="ATA">{currentRecord.ata ? dayjs(currentRecord.ata).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              <Descriptions.Item label="客户">{currentRecord.clientName}</Descriptions.Item>
              <Descriptions.Item label="柜量">{currentRecord.containerCount || '-'}</Descriptions.Item>
              <Descriptions.Item label="件数">{currentRecord.pieces}</Descriptions.Item>
              <Descriptions.Item label="重量">{currentRecord.weight} kg</Descriptions.Item>
              <Descriptions.Item label="清关行">{currentRecord.customsBroker || '-'}</Descriptions.Item>
              <Descriptions.Item label="操作人">{currentRecord.operator}</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                <Tag color={STATUS_CONFIG[currentRecord.status].color}>{STATUS_CONFIG[currentRecord.status].text}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Card title="进口阶段进度" size="small">
              <Steps
                current={getStepStatus(currentRecord)}
                size="small"
                direction="vertical"
                items={[
                  {
                    title: '到港',
                    description: currentRecord.timeline.arrived ? dayjs(currentRecord.timeline.arrived).format('YYYY-MM-DD HH:mm') : '等待中',
                    icon: <InboxOutlined />,
                  },
                  {
                    title: '清关',
                    description: currentRecord.timeline.customsStart ? dayjs(currentRecord.timeline.customsStart).format('YYYY-MM-DD HH:mm') : '等待中',
                    icon: <SafetyCertificateOutlined />,
                  },
                  {
                    title: '查验',
                    description: currentRecord.timeline.inspecting ? dayjs(currentRecord.timeline.inspecting).format('YYYY-MM-DD HH:mm') : '等待中',
                    icon: <WarningOutlined />,
                  },
                  {
                    title: '放行',
                    description: currentRecord.timeline.released ? dayjs(currentRecord.timeline.released).format('YYYY-MM-DD HH:mm') : '等待中',
                    icon: <CheckCircleOutlined />,
                  },
                  {
                    title: '提货',
                    description: currentRecord.timeline.pickup ? dayjs(currentRecord.timeline.pickup).format('YYYY-MM-DD HH:mm') : '等待中',
                    icon: <CarOutlined />,
                  },
                ]}
              />
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
};
