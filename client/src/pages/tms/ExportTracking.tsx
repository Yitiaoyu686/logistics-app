import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, Table, Button, Input, Select, DatePicker, Tag, Space,
  Row, Col, Statistic, message, Drawer, Descriptions, Steps
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  ClockCircleOutlined, CheckCircleOutlined, SendOutlined,
  ContainerOutlined, CarOutlined, RocketOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { theme } from 'antd';
import { jobApi } from '../../api';

const { RangePicker } = DatePicker;

// ============ Types ============

type ExportStatus = 'BOOKING_PENDING' | 'BOOKED' | 'CUSTOMS_CLEARED' | 'SHIPPED';
type TransportType = 'SEA' | 'AIR';

interface ExportPhase {
  step: string;
  time?: string;
  operator?: string;
  remark?: string;
  completed: boolean;
}

interface ExportRecord {
  id: string;
  jobNo: string;
  transportType: TransportType;
  route: string;
  vesselFlight: string;
  etd: string;
  atd?: string;
  status: ExportStatus;
  containerCount: number;
  operator: string;
  clientName: string;
  originPort: string;
  destPort: string;
  pieces: number;
  weight: number;
  remark?: string;
  exportPhases: ExportPhase[];
  createdAt: string;
}

// ============ Status Config ============

const STATUS_CONFIG: Record<ExportStatus, { text: string; color: string }> = {
  BOOKING_PENDING: { text: '待订舱', color: 'default' },
  BOOKED: { text: '已订舱', color: 'processing' },
  CUSTOMS_CLEARED: { text: '已报关', color: 'warning' },
  SHIPPED: { text: '已发运', color: 'success' },
};

const TRANSPORT_CONFIG: Record<TransportType, { text: string; color: string }> = {
  SEA: { text: '海运', color: 'blue' },
  AIR: { text: '空运', color: 'cyan' },
};

// ============ Data Mapping ============

const ORIGIN_STATUS_MAP: Record<string, ExportStatus> = {
  PLANNED: 'BOOKING_PENDING',
  BOOKED: 'BOOKED',
  CUSTOMS_CLEARED: 'CUSTOMS_CLEARED',
  DEPARTED: 'SHIPPED',
};

const PHASE_STEPS_SEA = ['订舱', '报关', '装船', '发运'];
const PHASE_STEPS_AIR = ['订舱', '报关', '装机', '发运'];
const PHASE_ORDER: ExportStatus[] = ['BOOKING_PENDING', 'BOOKED', 'CUSTOMS_CLEARED', 'SHIPPED'];

function generateExportPhases(status: ExportStatus, transportType: TransportType): ExportPhase[] {
  const steps = transportType === 'SEA' ? PHASE_STEPS_SEA : PHASE_STEPS_AIR;
  const statusIndex = PHASE_ORDER.indexOf(status);
  return steps.map((step, i) => ({
    step,
    completed: i <= statusIndex,
  }));
}

function mapJobToExportRecord(job: any): ExportRecord {
  const status = ORIGIN_STATUS_MAP[job.originPhaseStatus] || 'BOOKING_PENDING';
  const transportType: TransportType = job.transportType === 'AIR' ? 'AIR' : 'SEA';
  return {
    id: job.jobNo,
    jobNo: job.jobNo,
    transportType,
    route: job.route || '',
    vesselFlight: job.vesselVoyage || job.flightNo || '',
    etd: job.etd || '',
    atd: job.atd,
    status,
    containerCount: job.stats?.containers || 0,
    operator: job.originOperator || '操作员',
    clientName: job.subOrders?.[0]?.clientName || '',
    originPort: job.pol || '',
    destPort: job.pod || '',
    pieces: job.stats?.pieces || 0,
    weight: job.stats?.weight || 0,
    remark: job.remark,
    exportPhases: generateExportPhases(status, transportType),
    createdAt: job.createdAt || '',
  };
}

// ============ Component ============

export const ExportTracking: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const { token } = theme.useToken();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExportRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ExportRecord | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Filters
  const [filterJobNo, setFilterJobNo] = useState('');
  const [filterRoute, setFilterRoute] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<any>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await jobApi.list(businessMode === 'ALL' ? {} : { transportType: businessMode });
        const rows = ((res as any).data || res || []) as any[];
        setData(rows.map(mapJobToExportRecord));
      } catch (err: any) {
        message.error(err.message || '加载数据失败');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [businessMode]);

  // Filtered data
  const filteredData = useMemo(() => {
    let result = businessMode === 'ALL' ? [...data] : data.filter(r => r.transportType === businessMode);
    if (filterJobNo) {
      result = result.filter(r => r.jobNo.toLowerCase().includes(filterJobNo.toLowerCase()));
    }
    if (filterRoute) {
      result = result.filter(r => r.route.includes(filterRoute));
    }
    if (filterStatus) {
      result = result.filter(r => r.status === filterStatus);
    }
    if (filterDateRange && filterDateRange[0] && filterDateRange[1]) {
      const start = filterDateRange[0].startOf('day');
      const end = filterDateRange[1].endOf('day');
      result = result.filter(r => {
        const d = dayjs(r.etd);
        return d.isAfter(start) && d.isBefore(end);
      });
    }
    return result;
  }, [data, businessMode, filterJobNo, filterRoute, filterStatus, filterDateRange]);

  // Stats
  const stats = useMemo(() => {
    const modeData = businessMode === 'ALL' ? data : data.filter(r => r.transportType === businessMode);
    return {
      bookingPending: modeData.filter(r => r.status === 'BOOKING_PENDING').length,
      booked: modeData.filter(r => r.status === 'BOOKED').length,
      customsCleared: modeData.filter(r => r.status === 'CUSTOMS_CLEARED').length,
      shipped: modeData.filter(r => r.status === 'SHIPPED').length,
    };
  }, [data, businessMode]);

  const handleReset = () => {
    setFilterJobNo('');
    setFilterRoute('');
    setFilterStatus('');
    setFilterDateRange(null);
  };

  const handleViewDetail = (record: ExportRecord) => {
    setSelectedRecord(record);
    setDrawerVisible(true);
  };

  const getStepStatus = (phase: ExportPhase, index: number, phases: ExportPhase[]) => {
    if (phase.completed) return 'finish' as const;
    const prevCompleted = index === 0 || phases[index - 1].completed;
    if (prevCompleted && !phase.completed) return 'process' as const;
    return 'wait' as const;
  };

  const getCurrentStep = (phases: ExportPhase[]) => {
    const lastCompleted = phases.reduce((acc, p, i) => (p.completed ? i : acc), -1);
    return lastCompleted + 1;
  };

  const columns = [
    {
      title: '任务编号', dataIndex: 'jobNo', key: 'jobNo', width: 160,
      render: (text: string) => <a>{text}</a>,
    },
    {
      title: '运输方式', dataIndex: 'transportType', key: 'transportType', width: 90,
      render: (val: TransportType) => (
        <Tag color={TRANSPORT_CONFIG[val].color}>{TRANSPORT_CONFIG[val].text}</Tag>
      ),
    },
    { title: '航线', dataIndex: 'route', key: 'route', width: 160 },
    {
      title: businessMode === 'SEA' ? '船名/航次' : '航班号',
      dataIndex: 'vesselFlight', key: 'vesselFlight', width: 180,
    },
    {
      title: 'ETD', dataIndex: 'etd', key: 'etd', width: 110,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD'),
    },
    {
      title: 'ATD', dataIndex: 'atd', key: 'atd', width: 110,
      render: (val?: string) => val ? dayjs(val).format('YYYY-MM-DD') : '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (val: ExportStatus) => (
        <Tag color={STATUS_CONFIG[val].color}>{STATUS_CONFIG[val].text}</Tag>
      ),
    },
    {
      title: businessMode === 'SEA' ? '柜量' : '件数',
      key: 'count', width: 80,
      render: (_: any, record: ExportRecord) =>
        record.transportType === 'SEA' ? record.containerCount : record.pieces,
    },
    { title: '操作员', dataIndex: 'operator', key: 'operator', width: 80 },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right' as const,
      render: (_: any, record: ExportRecord) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>

      {/* Stats Row */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待订舱" value={stats.bookingPending} valueStyle={{ color: token.colorTextSecondary }} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已订舱" value={stats.booked} valueStyle={{ color: token.colorPrimary }} prefix={<ContainerOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已报关" value={stats.customsCleared} valueStyle={{ color: token.colorWarning }} prefix={<SendOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已发运" value={stats.shipped} valueStyle={{ color: token.colorSuccess }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Filter Card */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="任务编号" value={filterJobNo} onChange={e => setFilterJobNo(e.target.value)}
            prefix={<SearchOutlined />} style={{ width: 180 }} allowClear
          />
          <Input
            placeholder="航线" value={filterRoute} onChange={e => setFilterRoute(e.target.value)}
            style={{ width: 160 }} allowClear
          />
          <Select
            placeholder="状态" value={filterStatus || undefined} onChange={setFilterStatus}
            style={{ width: 120 }} allowClear
          >
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v.text}</Select.Option>
            ))}
          </Select>
          <RangePicker value={filterDateRange} onChange={setFilterDateRange} />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      {/* Table Card */}
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          onRow={record => ({ onClick: () => handleViewDetail(record), style: { cursor: 'pointer' } })}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={`出口跟踪详情 - ${selectedRecord?.jobNo || ''}`}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={640}
        destroyOnClose
      >
        {selectedRecord && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="任务编号">{selectedRecord.jobNo}</Descriptions.Item>
              <Descriptions.Item label="运输方式">
                <Tag color={TRANSPORT_CONFIG[selectedRecord.transportType].color}>
                  {TRANSPORT_CONFIG[selectedRecord.transportType].text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="客户">{selectedRecord.clientName}</Descriptions.Item>
              <Descriptions.Item label="操作员">{selectedRecord.operator}</Descriptions.Item>
              <Descriptions.Item label="航线">{selectedRecord.route}</Descriptions.Item>
              <Descriptions.Item label={selectedRecord.transportType === 'SEA' ? '船名/航次' : '航班号'}>
                {selectedRecord.vesselFlight}
              </Descriptions.Item>
              <Descriptions.Item label="起运港">{selectedRecord.originPort}</Descriptions.Item>
              <Descriptions.Item label="目的港">{selectedRecord.destPort}</Descriptions.Item>
              <Descriptions.Item label="ETD">{selectedRecord.etd}</Descriptions.Item>
              <Descriptions.Item label="ATD">{selectedRecord.atd || '-'}</Descriptions.Item>
              <Descriptions.Item label="件数">{selectedRecord.pieces}</Descriptions.Item>
              <Descriptions.Item label="重量(kg)">{selectedRecord.weight.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                <Tag color={STATUS_CONFIG[selectedRecord.status].color}>
                  {STATUS_CONFIG[selectedRecord.status].text}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Card title="出口阶段时间线" size="small">
              <Steps
                current={getCurrentStep(selectedRecord.exportPhases)}
                direction="vertical"
                size="small"
                items={selectedRecord.exportPhases.map((phase, index) => ({
                  title: phase.step,
                  status: getStepStatus(phase, index, selectedRecord.exportPhases),
                  description: phase.completed ? (
                    <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                      <div>{phase.time}</div>
                      <div>操作人: {phase.operator}</div>
                      {phase.remark && <div>备注: {phase.remark}</div>}
                    </div>
                  ) : (
                    <span style={{ color: token.colorTextQuaternary, fontSize: 12 }}>待处理</span>
                  ),
                  icon: index === 0 ? <ContainerOutlined /> :
                        index === 1 ? <SendOutlined /> :
                        index === 2 ? (selectedRecord.transportType === 'SEA' ? <CarOutlined /> : <RocketOutlined />) :
                        <CheckCircleOutlined />,
                }))}
              />
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
};
