import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, Table, Button, Input, Select, DatePicker, Tag, Space,
  Row, Col, Statistic, Tooltip, message, Drawer, Descriptions,
  Timeline, Badge, Divider, List, Segmented, Image, Form, Upload, InputNumber, Tabs, Modal
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, PlusOutlined, EyeOutlined,
  EditOutlined, FileImageOutlined, CarOutlined, ClockCircleOutlined,
  CheckCircleOutlined, WarningOutlined, InboxOutlined, ArrowLeftOutlined,
  PrinterOutlined, UploadOutlined, DollarOutlined, DeleteOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { jobApi } from '../../api';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../components/ListPageToolbar';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 任务状态枚举
type JobStatus =
  | 'PENDING'      // 待发货
  | 'IN_TRANSIT'   // 运输中
  | 'ARRIVED'      // 已到达
  | 'COMPLETED'    // 已完成
  | 'EXCEPTION';   // 异常

// 运输方式枚举
type TransportType = 'SEA' | 'AIR';

// 物流节点接口
interface TrackingNode {
  nodeName: string;
  time?: string;
  location?: string;
  remark?: string;
  operator?: string;
  completed: boolean;
  images?: string[];  // 图片URL数组
}

// 费用接口
interface JobFee {
  id: string;
  feeType: string;        // 费用类型：清关费、报关费、仓储费等
  amount: number;         // 金额
  currency: string;       // 币种
  level: 'JOB' | 'CONTAINER';  // 费用级别：任务级别或单元级别
  containerId?: string;   // 如果是单元级别，关联的集装箱ID
  containerNo?: string;   // 单元编号
  description?: string;   // 费用说明
  createdAt: string;      // 创建时间
  createdBy: string;      // 创建人
}

// 集装箱接口
interface Container {
  id: string;
  containerNo: string;
  type: string;
  orderCount: number;
  pieces: number;
  weight: number;
  volume: number;
  status: string;
  trackingNodes: TrackingNode[];  // 每个运输单元有自己的物流节点
  currentNodeIndex: number;
  documents: Document[];  // 每个运输单元有自己的单据
}

// 任务订单接口
interface JobOrder {
  id: string;
  subOrderNo: string;
  masterOrderNo: string;
  clientName: string;
  containerNo: string;
  pieces: number;
  weight: number;
  volume: number;
  status: string;
}

// 单据接口
interface Document {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadTime: string;
  uploader: string;
}

// 操作日志接口
interface OperationLog {
  id: string;
  action: string;
  detail: string;
  operator: string;
  time: string;
}

// 任务接口
interface Job {
  id: string;
  jobNo: string;
  transportType: TransportType;
  status: JobStatus;
  originPort: string;
  destinationPort: string;
  originWarehouse: string;
  destinationWarehouse: string;
  carrier: string;
  vesselName?: string;
  flightNo?: string;
  estimatedDeparture: string;
  estimatedArrival: string;
  actualDeparture?: string;
  actualArrival?: string;
  containers: Container[];
  orders: JobOrder[];
  orderCount: number;
  totalPieces: number;
  totalWeight: number;
  totalVolume: number;
  currentNode: string;
  currentNodeIndex: number;
  currentNodeTime?: string;
  trackingNodes: TrackingNode[];
  documents: Document[];
  fees: JobFee[];  // 费用列表
  operationLogs: OperationLog[];
  isUrgent: boolean;
  operator: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

// 状态配置
const STATUS_CONFIG: Record<JobStatus, { text: string; color: string; icon: React.ReactNode }> = {
  PENDING: { text: '待发货', color: 'warning', icon: <ClockCircleOutlined /> },
  IN_TRANSIT: { text: '运输中', color: 'processing', icon: <CarOutlined /> },
  ARRIVED: { text: '已到达', color: 'success', icon: <InboxOutlined /> },
  COMPLETED: { text: '已完成', color: 'success', icon: <CheckCircleOutlined /> },
  EXCEPTION: { text: '异常', color: 'error', icon: <WarningOutlined /> }
};

// 运输方式配置
const TRANSPORT_TYPE_CONFIG: Record<TransportType, string> = {
  SEA: '海运',
  AIR: '空运'
};

// Server Job → Local Job 状态映射
function mapServerStatus(status: string): JobStatus {
  switch (status) {
    case 'PLANNED': return 'PENDING';
    case 'IN_PROGRESS':
    case 'DEPARTED':
    case 'IN_TRANSIT': return 'IN_TRANSIT';
    case 'ARRIVED':
    case 'CLEARED': return 'ARRIVED';
    case 'COMPLETED': return 'COMPLETED';
    case 'CANCELLED': return 'EXCEPTION';
    default: return 'PENDING';
  }
}

// Server Job → Local Job 字段映射
function mapServerJobToLocal(s: any): Job {
  const routeParts = (s.route || '').split('→').map((p: string) => p.trim());
  return {
    id: s.jobNo || s.id,
    jobNo: s.jobNo || '',
    transportType: (s.transportType === 'AIR' ? 'AIR' : 'SEA') as TransportType,
    status: mapServerStatus(s.status),
    originPort: s.pol || routeParts[0] || '',
    destinationPort: s.pod || routeParts[1] || '',
    originWarehouse: routeParts[0] || s.pol || '',
    destinationWarehouse: routeParts[1] || s.pod || '',
    carrier: s.carrier || '',
    vesselName: s.vesselVoyage || undefined,
    flightNo: s.flightNo || undefined,
    estimatedDeparture: s.etd || '',
    estimatedArrival: s.eta || '',
    actualDeparture: s.atd || undefined,
    actualArrival: s.ata || undefined,
    containers: (s.shippingUnits || s.shippingUnitIds || []).map((unit: any) => {
      const isFullUnit = typeof unit === 'object';
      const unitId = isFullUnit ? unit.id : unit;
      const unitOrders = (s.subOrders || []).filter((so: any) => so.shippingUnitId === unitId);
      return {
        id: unitId,
        containerNo: isFullUnit ? (unit.unitNo || unit.id) : unit,
        type: isFullUnit ? (unit.unitType || (s.transportType === 'AIR' ? 'ULD' : '40HQ')) : (s.transportType === 'AIR' ? 'ULD' : '40HQ'),
        orderCount: unitOrders.length,
        pieces: isFullUnit ? (unit.loadedPieces || unitOrders.reduce((sum: number, o: any) => sum + (o.pieces || 0), 0)) : 0,
        weight: isFullUnit ? (unit.currentWeight || 0) : 0,
        volume: isFullUnit ? (unit.currentVolume || 0) : 0,
        status: isFullUnit ? (unit.status || '已装箱') : '已装箱',
        currentNodeIndex: 0,
        trackingNodes: [],
        documents: [],
      };
    }),
    orders: [],
    orderCount: s.stats?.orders || 0,
    totalPieces: s.stats?.pieces || 0,
    totalWeight: s.stats?.weight || 0,
    totalVolume: s.stats?.volume || 0,
    currentNode: '',
    currentNodeIndex: 0,
    trackingNodes: [],
    documents: [],
    fees: [],
    operationLogs: [],
    isUrgent: false,
    operator: s.originOperator || '',
    remark: s.remark || undefined,
    createdAt: s.createdAt || '',
    updatedAt: s.updatedAt || '',
  };
}


export const OriginJobList: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);

  // 从API获取数据
  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const res: any = await jobApi.list({ currentPhase: 'ORIGIN' });
        const data = (res.data || []).map(mapServerJobToLocal);
        setJobs(data);
        setFilteredJobs(data);
      } catch (e: any) {
        message.error(e.message || '加载任务列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  // 筛选条件
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<JobStatus | 'ALL'>('ALL');
  const [filterTransportType, setFilterTransportType] = useState<TransportType | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  // 详情Drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedContainerId, setSelectedContainerId] = useState<string>('ALL');

  // Modal状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [nodeUpdateDrawerVisible, setNodeUpdateDrawerVisible] = useState(false);
  const [uploadDrawerVisible, setUploadDrawerVisible] = useState(false);
  const [uploadScope, setUploadScope] = useState<string>('ALL'); // 上传范围
  const [selectedNodeName, setSelectedNodeName] = useState<string>(''); // 选中的节点
  const [isNodeException, setIsNodeException] = useState<boolean>(false); // 是否异常

  // 费用录入相关状态
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [feeLevel, setFeeLevel] = useState<'JOB' | 'CONTAINER'>('JOB');
  const [selectedContainerForFee, setSelectedContainerForFee] = useState<string>('');

  // Form实例
  const [createForm] = Form.useForm();
  const [nodeUpdateForm] = Form.useForm();
  const [feeForm] = Form.useForm();

  // 统计数据
  const inTransitCount = jobs.filter(j => j.status === 'IN_TRANSIT').length;
  const pendingCount = jobs.filter(j => j.status === 'PENDING').length;
  const completedThisMonth = jobs.filter(j => {
    const created = dayjs(j.createdAt);
    return j.status === 'COMPLETED' && created.month() === dayjs().month();
  }).length;
  const exceptionCount = jobs.filter(j => j.status === 'EXCEPTION').length;

  // 搜索和筛选
  const handleSearch = () => {
    let filtered = [...jobs];

    if (searchText) {
      filtered = filtered.filter(j =>
        j.jobNo.toLowerCase().includes(searchText.toLowerCase()) ||
        j.containers.some(c => c.containerNo.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(j => j.status === filterStatus);
    }

    if (filterTransportType !== 'ALL') {
      filtered = filtered.filter(j => j.transportType === filterTransportType);
    }

    if (dateRange) {
      filtered = filtered.filter(j => {
        const created = dayjs(j.createdAt);
        return created.isAfter(dateRange[0]) && created.isBefore(dateRange[1]);
      });
    }

    setFilteredJobs(filtered);
  };

  // 重置筛选
  const handleReset = () => {
    setSearchText('');
    setFilterStatus('ALL');
    setFilterTransportType('ALL');
    setDateRange(null);
    setFilteredJobs(jobs);
  };

  // 查看详情 - 从API获取完整数据（包含子订单）
  const handleViewDetail = async (job: Job) => {
    setSelectedJob(job); // 先显示列表数据
    setDetailDrawerVisible(true);
    try {
      const res: any = await jobApi.get(job.jobNo);
      const detail = res.data;
      if (detail) {
        const fullJob = mapServerJobToLocal(detail);
        // 映射子订单数据
        fullJob.orders = (detail.subOrders || []).map((s: any) => ({
          id: s.id,
          subOrderNo: s.id,
          masterOrderNo: s.masterOrderNo || s.masterOrderId || '',
          clientName: s.clientName || '',
          containerNo: (() => {
            const unit = (detail.shippingUnits || []).find((u: any) => u.id === s.shippingUnitId);
            return unit?.unitNo || s.shippingUnitId || '';
          })(),
          pieces: s.pieces || 0,
          weight: s.weight || 0,
          volume: s.volume || 0,
          status: s.status || '',
        }));
        fullJob.orderCount = fullJob.orders.length;
        // 更新集装箱的订单数和重量信息
        fullJob.containers = fullJob.containers.map(c => {
          const unitOrders = fullJob.orders.filter(o => o.containerNo === c.containerNo);
          return {
            ...c,
            orderCount: unitOrders.length,
            pieces: unitOrders.reduce((sum, o) => sum + o.pieces, 0),
            weight: unitOrders.reduce((sum, o) => sum + o.weight, 0),
            volume: unitOrders.reduce((sum, o) => sum + o.volume, 0),
          };
        });
        setSelectedJob(fullJob);
      }
    } catch (e: any) {
      console.error('获取任务详情失败:', e);
    }
  };

  // 创建任务
  const handleCreateJob = () => {
    setCreateModalVisible(true);
  };

  // 提交创建任务
  const handleSubmitCreate = async () => {
    try {
      const values = await createForm.validateFields();

      const jobData = {
        route: `${values.originPort} → ${values.destinationPort}`,
        pol: values.originPort,
        pod: values.destinationPort,
        transportType: values.transportType,
        carrier: values.carrier,
        vesselVoyage: values.transportType === 'SEA' ? values.vesselOrFlight : undefined,
        flightNo: values.transportType === 'AIR' ? values.vesselOrFlight : undefined,
        etd: values.estimatedDeparture ? dayjs(values.estimatedDeparture).format('YYYY-MM-DD') : undefined,
        eta: values.estimatedArrival ? dayjs(values.estimatedArrival).format('YYYY-MM-DD') : undefined,
        remark: values.remark,
      };

      await jobApi.create(jobData);
      message.success('任务创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      refreshJobs();
    } catch (error: any) {
      if (error.errorFields) return; // 表单验证错误
      message.error(error.message || '创建任务失败');
    }
  };

  // 更新节点
  const handleNodeUpdate = (job: Job) => {
    setSelectedJob(job);
    setSelectedNodeName('');
    setIsNodeException(false);
    nodeUpdateForm.resetFields();
    setNodeUpdateDrawerVisible(true);
  };

  // 提交节点更新
  const handleSubmitNodeUpdate = async () => {
    try {
      if (!selectedNodeName) {
        message.error('请选择要更新的节点');
        return;
      }

      const values = await nodeUpdateForm.validateFields();
      const { updateScope, remark } = values;

      const statusText = isNodeException ? '（异常）' : '';
      if (updateScope === 'ALL') {
        message.success(`已更新整个任务到节点：${selectedNodeName}${statusText}`);
      } else {
        const container = selectedJob?.containers.find(c => c.id === updateScope);
        message.success(`已更新运输单元 ${container?.containerNo} 到节点：${selectedNodeName}${statusText}`);
      }

      setNodeUpdateDrawerVisible(false);
      setSelectedNodeName('');
      setIsNodeException(false);
      nodeUpdateForm.resetFields();
      // TODO: 调用API更新节点
      // API参数: { jobId, containerId: updateScope, nodeName: selectedNodeName, isException: isNodeException, remark }
    } catch (error) {
      console.error('节点更新失败:', error);
    }
  };

  // 打开费用录入Modal
  const handleOpenFeeModal = (level: 'JOB' | 'CONTAINER', containerId?: string) => {
    setFeeLevel(level);
    setSelectedContainerForFee(containerId || '');
    feeForm.resetFields();
    setFeeModalVisible(true);
  };

  // 提交费用录入
  const handleSubmitFee = async () => {
    try {
      const values = await feeForm.validateFields();
      if (!selectedJob) return;

      // 验证单元级别时必须选择运输单元
      if (feeLevel === 'CONTAINER' && !selectedContainerForFee) {
        message.error('请选择要关联的运输单元');
        return;
      }

      const newFee: JobFee = {
        id: `F-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        feeType: values.feeType,
        amount: values.amount,
        currency: values.currency,
        level: feeLevel,
        containerId: feeLevel === 'CONTAINER' ? selectedContainerForFee : undefined,
        containerNo: feeLevel === 'CONTAINER'
          ? selectedJob.containers.find(c => c.id === selectedContainerForFee)?.containerNo
          : undefined,
        description: values.description,
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        createdBy: '当前用户'
      };

      // 更新任务的费用列表
      setJobs(prevJobs =>
        prevJobs.map(j =>
          j.id === selectedJob.id
            ? { ...j, fees: [...(j.fees || []), newFee] }
            : j
        )
      );

      // 同时更新 selectedJob
      setSelectedJob(prev =>
        prev ? { ...prev, fees: [...(prev.fees || []), newFee] } : null
      );

      const levelText = feeLevel === 'JOB' ? '任务级' : `单元级(${newFee.containerNo})`;
      message.success(`${levelText}费用录入成功`);
      setFeeModalVisible(false);
      feeForm.resetFields();
      setFeeLevel('JOB');
      setSelectedContainerForFee('');
    } catch (error) {
      console.error('费用录入失败:', error);
    }
  };

  // 刷新任务列表
  const refreshJobs = async () => {
    setLoading(true);
    try {
      const res: any = await jobApi.list({ currentPhase: 'ORIGIN' });
      const data = (res.data || []).map(mapServerJobToLocal);
      setJobs(data);
      setFilteredJobs(data);
    } catch (e: any) {
      message.error(e.message || '加载任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除任务
  const handleDeleteJob = (job: Job) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除任务 ${job.jobNo} 吗？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await jobApi.delete(job.jobNo);
          message.success('任务删除成功');
          refreshJobs();
        } catch (e: any) {
          message.error(e.message || '删除失败');
        }
      }
    });
  };

  // 上传单据
  const handleUploadDocument = (job: Job) => {
    console.log('点击上传单据按钮', job);
    setSelectedJob(job);
    setUploadScope('ALL'); // 重置为默认值
    setUploadDrawerVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: '任务号',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 180,
      fixed: 'left' as const,
      render: (text: string, record: Job) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => handleViewDetail(record)}>{text}</a>
          <div style={{ fontSize: 11, color: '#999' }}>
            {TRANSPORT_TYPE_CONFIG[record.transportType]}
          </div>
        </Space>
      )
    },
    {
      title: '运输单元',
      key: 'containers',
      width: 200,
      render: (record: Job) => (
        <Space direction="vertical" size={0}>
          <div>{record.containers.length}个运输单元</div>
          <div style={{ fontSize: 11, color: '#999' }}>
            {record.containers.map(c => c.containerNo).slice(0, 2).join(', ')}
            {record.containers.length > 2 && '...'}
          </div>
        </Space>
      )
    },
    {
      title: '订单信息',
      key: 'orders',
      width: 150,
      render: (record: Job) => (
        <Space direction="vertical" size={0}>
          <div>{record.orderCount}个订单</div>
          <div style={{ fontSize: 11, color: '#999' }}>
            {record.totalPieces}件 / {record.totalWeight.toFixed(0)}kg
          </div>
        </Space>
      )
    },
    {
      title: '路线',
      key: 'route',
      width: 200,
      render: (record: Job) => (
        <Space direction="vertical" size={0}>
          <div>{record.originPort} → {record.destinationPort}</div>
          <div style={{ fontSize: 11, color: '#999' }}>
            {record.originWarehouse} → {record.destinationWarehouse}
          </div>
        </Space>
      )
    },
    {
      title: '当前节点',
      dataIndex: 'currentNode',
      key: 'currentNode',
      width: 150,
      render: (node: string, record: Job) => (
        <Space direction="vertical" size={0}>
          <Badge status="processing" text={node} />
          {record.currentNodeTime && (
            <div style={{ fontSize: 11, color: '#999' }}>
              {dayjs(record.currentNodeTime).format('MM-DD HH:mm')}
            </div>
          )}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: JobStatus) => {
        const config = STATUS_CONFIG[status];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      }
    },
    {
      title: '预计到达',
      dataIndex: 'estimatedArrival',
      key: 'estimatedArrival',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right' as const,
      render: (record: Job) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            disabled={record.status === 'COMPLETED'}
            onClick={() => handleNodeUpdate(record)}
          >
            更新节点
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FileImageOutlined />}
            onClick={() => handleUploadDocument(record)}
          >
            上传单据
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DollarOutlined />}
            onClick={() => {
              setSelectedJob(record);
              handleOpenFeeModal('JOB');
            }}
          >
            费用录入
          </Button>
          {record.containers.length === 0 && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteJob(record)}
            >
              删除
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计数据区 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中任务"
              value={inTransitCount}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待发货任务"
              value={pendingCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月完成"
              value={completedThisMonth}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="异常任务"
              value={exceptionCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选条件区 */}
      <ListPageToolbarCard>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 260px" minWidth={240}>
              <Input
                placeholder="搜索任务号/单元编号"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onPressEnter={handleSearch}
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={120}>
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                style={{ width: '100%' }}
              >
                <Option value="ALL">全部状态</Option>
                <Option value="PENDING">待发货</Option>
                <Option value="IN_TRANSIT">运输中</Option>
                <Option value="ARRIVED">已到达</Option>
                <Option value="COMPLETED">已完成</Option>
                <Option value="EXCEPTION">异常</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={120}>
              <Select
                value={filterTransportType}
                onChange={setFilterTransportType}
                style={{ width: '100%' }}
              >
                <Option value="ALL">全部方式</Option>
                <Option value="SEA">海运</Option>
                <Option value="AIR">空运</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={260}>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
              />
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateJob}>
              创建任务
            </Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      {/* 任务列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredJobs}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 任务详情Drawer */}
      <Drawer
        title={null}
        placement="right"
        width="80%"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        destroyOnClose
      >
        {selectedJob && (
          <div>
            {/* 粘性头部 */}
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 1000,
              background: '#fff',
              padding: '16px 24px',
              borderBottom: '1px solid #f0f0f0',
              marginBottom: 16,
              marginTop: -24,
              marginLeft: -24,
              marginRight: -24
            }}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space size="large">
                    <h2 style={{ margin: 0 }}>{selectedJob.jobNo}</h2>
                    <Tag color={STATUS_CONFIG[selectedJob.status].color} icon={STATUS_CONFIG[selectedJob.status].icon}>
                      {STATUS_CONFIG[selectedJob.status].text}
                    </Tag>
                    <Tag color="blue">{TRANSPORT_TYPE_CONFIG[selectedJob.transportType]}</Tag>
                    {selectedJob.isUrgent && <Tag color="red">加急</Tag>}
                  </Space>
                  <Space>
                    <Button icon={<EditOutlined />}>编辑</Button>
                    <Button icon={<PrinterOutlined />}>打印</Button>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={() => setUploadDrawerVisible(true)}
                    >
                      上传单据
                    </Button>
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => setNodeUpdateDrawerVisible(true)}
                    >
                      更新节点
                    </Button>
                  </Space>
                </Space>
                <Space size="large" style={{ color: '#666', fontSize: 13 }}>
                  <span>承运人：{selectedJob.carrier}</span>
                  {selectedJob.vesselName && <span>船名：{selectedJob.vesselName}</span>}
                  {selectedJob.flightNo && <span>航班号：{selectedJob.flightNo}</span>}
                  <span>操作人：{selectedJob.operator}</span>
                  <span>创建时间：{dayjs(selectedJob.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                </Space>
              </Space>
            </div>

            {/* 主体内容 - 左侧导航+右侧单列布局 */}
            <Row gutter={16}>
              {/* 左侧锚点导航 */}
              <Col span={3}>
                <div style={{ position: 'sticky', top: 100 }}>
                  <div style={{
                    background: '#fff',
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                    padding: '8px 0'
                  }}>
                    {[
                      { key: 'basic', title: '基本信息' },
                      { key: 'containers', title: '运输单元' },
                      { key: 'tracking', title: '物流进度' },
                      { key: 'orders', title: '订单信息' },
                      { key: 'documents', title: '相关单据' },
                      { key: 'fees', title: '费用信息' },
                      { key: 'logs', title: '操作日志' }
                    ].map(item => (
                      <div
                        key={item.key}
                        onClick={() => {
                          const element = document.getElementById(item.key);
                          if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          cursor: 'pointer',
                          fontSize: 14,
                          color: '#666',
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f5f5f5';
                          e.currentTarget.style.color = '#1890ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#666';
                        }}
                      >
                        {item.title}
                      </div>
                    ))}
                  </div>
                </div>
              </Col>

              {/* 右侧主要内容 */}
              <Col span={21}>
                {/* 基本信息卡片 */}
                <Card id="basic" title="基本信息" style={{ marginBottom: 16 }}>
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="任务号">{selectedJob.jobNo}</Descriptions.Item>
                    <Descriptions.Item label="运输方式">{TRANSPORT_TYPE_CONFIG[selectedJob.transportType]}</Descriptions.Item>
                    <Descriptions.Item label="起运港">{selectedJob.originPort}</Descriptions.Item>
                    <Descriptions.Item label="目的港">{selectedJob.destinationPort}</Descriptions.Item>
                    <Descriptions.Item label="起运仓库">{selectedJob.originWarehouse}</Descriptions.Item>
                    <Descriptions.Item label="目的仓库">{selectedJob.destinationWarehouse}</Descriptions.Item>
                    <Descriptions.Item label="承运人">{selectedJob.carrier}</Descriptions.Item>
                    <Descriptions.Item label="船名/航班">
                      {selectedJob.vesselName || selectedJob.flightNo || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="预计发货">{dayjs(selectedJob.estimatedDeparture).format('YYYY-MM-DD')}</Descriptions.Item>
                    <Descriptions.Item label="预计到达">{dayjs(selectedJob.estimatedArrival).format('YYYY-MM-DD')}</Descriptions.Item>
                    <Descriptions.Item label="实际发货">
                      {selectedJob.actualDeparture ? dayjs(selectedJob.actualDeparture).format('YYYY-MM-DD') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="实际到达">
                      {selectedJob.actualArrival ? dayjs(selectedJob.actualArrival).format('YYYY-MM-DD') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="备注" span={2}>{selectedJob.remark || '-'}</Descriptions.Item>
                  </Descriptions>

                  <Divider style={{ margin: '16px 0' }}>关键指标</Divider>

                  <Row gutter={16}>
                    <Col span={4}>
                      <Statistic title="运输单元数量" value={selectedJob.containers.length} suffix="个" />
                    </Col>
                    <Col span={4}>
                      <Statistic title="订单数量" value={selectedJob.orderCount} suffix="个" />
                    </Col>
                    <Col span={4}>
                      <Statistic title="总件数" value={selectedJob.totalPieces} suffix="件" />
                    </Col>
                    <Col span={6}>
                      <Statistic title="总重量" value={selectedJob.totalWeight.toFixed(2)} suffix="kg" />
                    </Col>
                    <Col span={6}>
                      <Statistic title="总体积" value={selectedJob.totalVolume.toFixed(2)} suffix="m³" />
                    </Col>
                  </Row>
                </Card>

                {/* 运输单元 */}
                <Card id="containers" title="运输单元" style={{ marginBottom: 16 }}>
                  <Table
                    dataSource={selectedJob.containers}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: '单元编号', dataIndex: 'containerNo', key: 'containerNo', width: 180 },
                      { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
                      { title: '订单数', dataIndex: 'orderCount', key: 'orderCount', width: 80 },
                      { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80 },
                      {
                        title: '重量(kg)',
                        dataIndex: 'weight',
                        key: 'weight',
                        width: 100,
                        render: (val: number) => val.toFixed(2)
                      },
                      {
                        title: '体积(m³)',
                        dataIndex: 'volume',
                        key: 'volume',
                        width: 100,
                        render: (val: number) => val.toFixed(2)
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        key: 'status',
                        width: 100,
                        render: (status: string) => <Tag color="blue">{status}</Tag>
                      }
                    ]}
                  />
                </Card>

                {/* 物流进度表格 */}
                <Card id="tracking" title="物流进度" style={{ marginBottom: 16 }}>
                  {/* 集装箱筛选器 */}
                  <div style={{ marginBottom: 16 }}>
                    <Segmented
                      value={selectedContainerId}
                      onChange={(value) => setSelectedContainerId(value as string)}
                      options={[
                        { label: '全部', value: 'ALL' },
                        ...selectedJob.containers.map(c => ({
                          label: c.containerNo,
                          value: c.id
                        }))
                      ]}
                    />
                  </div>

                  <Table
                    dataSource={
                      selectedContainerId === 'ALL'
                        ? selectedJob.containers
                        : selectedJob.containers.filter(c => c.id === selectedContainerId)
                    }
                    rowKey="id"
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                    columns={[
                      {
                        title: '单元编号',
                        dataIndex: 'containerNo',
                        key: 'containerNo',
                        width: 180,
                        fixed: 'left' as const,
                        render: (text: string, record: Container) => (
                          <div>
                            <div style={{ fontWeight: 500 }}>{text}</div>
                            <div style={{ fontSize: 12, color: '#999' }}>{record.type}</div>
                          </div>
                        )
                      },
                      ...selectedJob.trackingNodes.map((node, nodeIndex) => ({
                        title: node.nodeName,
                        key: `node_${nodeIndex}`,
                        width: 140,
                        render: (_: any, container: Container) => {
                          const containerNode = container.trackingNodes[nodeIndex];
                          if (!containerNode) return '-';

                          const isCompleted = containerNode.completed;
                          const isCurrent = nodeIndex === container.currentNodeIndex;

                          return (
                            <div style={{
                              padding: '4px 0',
                              borderLeft: isCurrent ? '3px solid #1890ff' : 'none',
                              paddingLeft: isCurrent ? 8 : 0
                            }}>
                              <div style={{ marginBottom: 4 }}>
                                {isCompleted ? (
                                  <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>
                                ) : isCurrent ? (
                                  <Tag color="processing" icon={<ClockCircleOutlined />}>进行中</Tag>
                                ) : (
                                  <Tag color="default">待处理</Tag>
                                )}
                              </div>
                              {containerNode.time && (
                                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                  {dayjs(containerNode.time).format('MM-DD HH:mm')}
                                </div>
                              )}
                              {(containerNode.location || containerNode.operator) && (
                                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                                  {containerNode.location}
                                  {containerNode.location && containerNode.operator && ' · '}
                                  {containerNode.operator}
                                </div>
                              )}
                              {containerNode.images && containerNode.images.length > 0 && (
                                <div style={{ marginTop: 4 }}>
                                  <Image.PreviewGroup>
                                    {containerNode.images.map((img, idx) => (
                                      <Image
                                        key={idx}
                                        width={40}
                                        height={30}
                                        src={img}
                                        style={{
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                          display: idx === 0 ? 'inline-block' : 'none'
                                        }}
                                      />
                                    ))}
                                  </Image.PreviewGroup>
                                  {containerNode.images.length > 1 && (
                                    <span style={{ fontSize: 11, color: '#1890ff', marginLeft: 4 }}>
                                      +{containerNode.images.length - 1}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                      }))
                    ]}
                  />
                </Card>

                {/* 订单信息 */}
                <Card id="orders" title={`订单信息 (${selectedJob.orderCount}个订单)`} style={{ marginBottom: 16 }}>
                  <Table
                    dataSource={selectedJob.orders}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: '子运单号', dataIndex: 'subOrderNo', key: 'subOrderNo', width: 150 },
                      { title: '主运单号', dataIndex: 'masterOrderNo', key: 'masterOrderNo', width: 150 },
                      { title: '客户', dataIndex: 'clientName', key: 'clientName', width: 120 },
                      { title: '单元编号', dataIndex: 'containerNo', key: 'containerNo', width: 150 },
                      { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80 },
                      {
                        title: '重量(kg)',
                        dataIndex: 'weight',
                        key: 'weight',
                        width: 100,
                        render: (val: number) => val.toFixed(2)
                      },
                      {
                        title: '体积(m³)',
                        dataIndex: 'volume',
                        key: 'volume',
                        width: 100,
                        render: (val: number) => val.toFixed(2)
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        key: 'status',
                        width: 100,
                        render: (status: string) => <Tag>{status}</Tag>
                      }
                    ]}
                  />
                </Card>

                {/* 相关单据 - Tabs切换 */}
                <Card id="documents" title="相关单据" style={{ marginBottom: 16 }}>
                  <Tabs
                    defaultActiveKey="all"
                    items={[
                      {
                        key: 'all',
                        label: '全部',
                        children: (
                          <List
                            size="small"
                            dataSource={selectedJob.documents}
                            renderItem={(doc) => (
                              <List.Item
                                actions={[
                                  <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
                                ]}
                              >
                                <List.Item.Meta
                                  title={doc.name}
                                  description={`${doc.uploader} · ${dayjs(doc.uploadTime).format('MM-DD HH:mm')}`}
                                />
                              </List.Item>
                            )}
                          />
                        )
                      },
                      ...selectedJob.containers.map(container => ({
                        key: container.id,
                        label: container.containerNo,
                        children: (
                          <List
                            size="small"
                            dataSource={container.documents}
                            renderItem={(doc) => (
                              <List.Item
                                actions={[
                                  <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
                                ]}
                              >
                                <List.Item.Meta
                                  title={doc.name}
                                  description={`${doc.uploader} · ${dayjs(doc.uploadTime).format('MM-DD HH:mm')}`}
                                />
                              </List.Item>
                            )}
                          />
                        )
                      }))
                    ]}
                  />
                </Card>

                {/* 费用信息 */}
                <Card
                  id="fees"
                  title="费用信息"
                  style={{ marginBottom: 16 }}
                  extra={
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleOpenFeeModal('JOB')}
                    >
                      添加费用
                    </Button>
                  }
                >
                  <Table
                    size="small"
                    dataSource={selectedJob.fees || []}
                    rowKey="id"
                    pagination={false}
                    columns={[
                      {
                        title: '费用类型',
                        dataIndex: 'feeType',
                        width: 120
                      },
                      {
                        title: '金额',
                        dataIndex: 'amount',
                        width: 120,
                        render: (amount: number, record: JobFee) => (
                          <span style={{ color: '#f5222d', fontWeight: 500 }}>
                            {record.currency} {amount.toFixed(2)}
                          </span>
                        )
                      },
                      {
                        title: '费用级别',
                        dataIndex: 'level',
                        width: 120,
                        render: (level: string, record: JobFee) => (
                          <Tag color={level === 'JOB' ? 'blue' : 'green'}>
                            {level === 'JOB' ? '任务级' : record.containerNo}
                          </Tag>
                        )
                      },
                      {
                        title: '说明',
                        dataIndex: 'description',
                        ellipsis: true
                      },
                      {
                        title: '录入时间',
                        dataIndex: 'createdAt',
                        width: 150,
                        render: (text: string) => dayjs(text).format('MM-DD HH:mm')
                      },
                      {
                        title: '录入人',
                        dataIndex: 'createdBy',
                        width: 100
                      }
                    ]}
                  />
                </Card>

                {/* 操作日志 */}
                <Card id="logs" title="操作日志">
                  <Timeline>
                    {selectedJob.operationLogs.map((log) => (
                      <Timeline.Item key={log.id}>
                        <div style={{ fontSize: 13 }}>
                          <strong>{log.action}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                          {log.detail}
                        </div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                          {log.operator} · {dayjs(log.time).format('MM-DD HH:mm')}
                        </div>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Drawer>

      {/* 创建任务Modal */}
      <Modal
        title="创建运输任务"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        onOk={handleSubmitCreate}
        width={900}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Divider titlePlacement="left">基本信息</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="transportType" label="运输方式" rules={[{ required: true }]}>
                <Select placeholder="请选择运输方式">
                  <Select.Option value="SEA">海运</Select.Option>
                  <Select.Option value="AIR">空运</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="carrier" label="承运人" rules={[{ required: true }]}>
                <Input placeholder="船公司/航空公司" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="vesselOrFlight" label="船名/航班号" rules={[{ required: true }]}>
                <Input placeholder="请输入船名或航班号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="originPort" label="起运港/机场" rules={[{ required: true }]}>
                <Input placeholder="请输入起运港或机场" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="destinationPort" label="目的港/机场" rules={[{ required: true }]}>
                <Input placeholder="请输入目的港或机场" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="originWarehouse" label="起运仓库" rules={[{ required: true }]}>
                <Input placeholder="请输入起运仓库" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="destinationWarehouse" label="目的仓库" rules={[{ required: true }]}>
                <Input placeholder="请输入目的仓库" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="estimatedDeparture" label="预计发货日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="estimatedArrival" label="预计到达日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left">集装器预订</Divider>
          <Form.List name="containers">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={16} style={{ marginBottom: 8 }}>
                    <Col span={10}>
                      <Form.Item
                        {...restField}
                        name={[name, 'type']}
                        rules={[{ required: true, message: '请选择集装器类型' }]}
                      >
                        <Select placeholder="集装器类型">
                          <Select.Option value="20GP">20GP 标准集装箱</Select.Option>
                          <Select.Option value="40GP">40GP 标准集装箱</Select.Option>
                          <Select.Option value="40HQ">40HQ 高柜集装箱</Select.Option>
                          <Select.Option value="45HQ">45HQ 超高柜</Select.Option>
                          <Select.Option value="ULD">ULD 空运单元</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'quantity']}
                        rules={[{ required: true, message: '请输入数量' }]}>
                        <InputNumber placeholder="数量" min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item {...restField} name={[name, 'containerNo']}>
                        <Input placeholder="单元编号（可选）" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button type="link" danger onClick={() => remove(name)}>删除</Button>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加集装器
                </Button>
              </>
            )}
          </Form.List>

          <Divider titlePlacement="left">其他信息</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="isUrgent" label="是否加急" valuePropName="checked">
                <Select>
                  <Select.Option value={false}>否</Select.Option>
                  <Select.Option value={true}>是</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 节点更新弹窗 - 使用自定义实现避免 Ant Design bug */}
      {nodeUpdateDrawerVisible && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} onClick={() => {
          setNodeUpdateDrawerVisible(false);
          nodeUpdateForm.resetFields();
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 8,
            width: 600,
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08), 0 9px 28px 8px rgba(0,0,0,.05)'
          }} onClick={(e) => e.stopPropagation()}>
            {/* 标题栏 */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #f0f0f0',
              fontSize: 16,
              fontWeight: 500
            }}>
              更新物流节点
            </div>

            {/* 内容区 */}
            <div style={{ padding: 24 }}>
              <Form form={nodeUpdateForm} layout="vertical">
                <Form.Item name="updateScope" initialValue="ALL" hidden>
                  <Input />
                </Form.Item>

                {/* 集装箱选择 */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 500 }}>
                    选择要更新的运输单元
                  </div>
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {/* 全选选项 */}
                    <div
                      onClick={() => nodeUpdateForm.setFieldsValue({ updateScope: 'ALL' })}
                      style={{
                        padding: '12px 16px',
                        border: '2px solid',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: nodeUpdateForm.getFieldValue('updateScope') === 'ALL' ? '#e6f4ff' : '#fff',
                        borderColor: nodeUpdateForm.getFieldValue('updateScope') === 'ALL' ? '#1890ff' : '#d9d9d9',
                        transition: 'all 0.3s'
                      }}
                    >
                      <Space>
                        <CheckCircleOutlined style={{
                          color: nodeUpdateForm.getFieldValue('updateScope') === 'ALL' ? '#1890ff' : '#d9d9d9',
                          fontSize: 18
                        }} />
                        <div>
                          <div style={{ fontWeight: 500 }}>全部运输单元</div>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            同时更新 {selectedJob?.containers.length} 个运输单元
                          </div>
                        </div>
                      </Space>
                    </div>

                    {/* 单个运输单元选项 */}
                    {selectedJob?.containers.map(container => (
                      <div
                        key={container.id}
                        onClick={() => nodeUpdateForm.setFieldsValue({ updateScope: container.id })}
                        style={{
                          padding: '12px 16px',
                          border: '2px solid',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: nodeUpdateForm.getFieldValue('updateScope') === container.id ? '#e6f4ff' : '#fff',
                          borderColor: nodeUpdateForm.getFieldValue('updateScope') === container.id ? '#1890ff' : '#d9d9d9',
                          transition: 'all 0.3s'
                        }}
                      >
                        <Space>
                          <CheckCircleOutlined style={{
                            color: nodeUpdateForm.getFieldValue('updateScope') === container.id ? '#1890ff' : '#d9d9d9',
                            fontSize: 18
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{container.containerNo}</div>
                            <div style={{ fontSize: 12, color: '#999' }}>
                              {container.type} · {container.orderCount}个订单 · 当前: {container.trackingNodes[container.currentNodeIndex]?.nodeName || '未知'}
                            </div>
                          </div>
                        </Space>
                      </div>
                    ))}
                  </Space>
                </div>

                <Divider style={{ margin: '20px 0' }} />

                {/* 节点选择 - 下拉选择器 */}
                <Form.Item
                  label="选择物流节点"
                  required
                  style={{ marginBottom: 20 }}
                >
                  <Select
                    size="large"
                    placeholder="请选择要更新到的物流节点"
                    value={selectedNodeName || undefined}
                    onChange={(value) => setSelectedNodeName(value)}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="仓库收货">仓库收货</Select.Option>
                    <Select.Option value="装箱">装箱</Select.Option>
                    <Select.Option value="报关">报关</Select.Option>
                    <Select.Option value="海关放行">海关放行</Select.Option>
                    <Select.Option value="装船/装机">装船/装机</Select.Option>
                    <Select.Option value="起飞/开船">起飞/开船</Select.Option>
                    <Select.Option value="到达目的港">到达目的港</Select.Option>
                    <Select.Option value="清关">清关</Select.Option>
                    <Select.Option value="入仓">入仓</Select.Option>
                    <Select.Option value="派送">派送</Select.Option>
                    <Select.Option value="签收">签收</Select.Option>
                  </Select>
                </Form.Item>

                {/* 异常标记和备注 */}
                {selectedNodeName && (
                  <div style={{
                    padding: 16,
                    background: '#f5f5f5',
                    borderRadius: 6,
                    marginBottom: 20
                  }}>
                    <div style={{ marginBottom: 12 }}>
                      <Space>
                        <WarningOutlined style={{ color: '#faad14' }} />
                        <span style={{ fontWeight: 500 }}>节点状态</span>
                      </Space>
                    </div>

                    {/* 异常开关 */}
                    <div style={{ marginBottom: 12 }}>
                      <Space>
                        <span>标记为异常：</span>
                        <Button
                          size="small"
                          type={isNodeException ? 'primary' : 'default'}
                          danger={isNodeException}
                          onClick={() => setIsNodeException(!isNodeException)}
                        >
                          {isNodeException ? '是（异常）' : '否（正常）'}
                        </Button>
                      </Space>
                    </div>

                    {/* 备注输入 */}
                    <Form.Item name="remark" label="备注信息" style={{ marginBottom: 0 }}>
                      <Input.TextArea
                        rows={3}
                        placeholder={isNodeException ? '请描述异常情况...' : '可选填写备注信息...'}
                      />
                    </Form.Item>
                  </div>
                )}
              </Form>
            </div>

            {/* 底部按钮 */}
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid #f0f0f0',
              textAlign: 'right'
            }}>
              <Space>
                <Button onClick={() => {
                  setNodeUpdateDrawerVisible(false);
                  setSelectedNodeName('');
                  setIsNodeException(false);
                  nodeUpdateForm.resetFields();
                }}>
                  取消
                </Button>
                <Button type="primary" onClick={handleSubmitNodeUpdate}>
                  确定更新
                </Button>
              </Space>
            </div>
          </div>
        </div>
      )}

      {/* 单据上传弹窗 - 使用自定义实现避免 Ant Design bug */}
      {uploadDrawerVisible && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} onClick={() => setUploadDrawerVisible(false)}>
          <div style={{
            background: '#fff',
            borderRadius: 8,
            width: 600,
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 3px 6px -4px rgba(0,0,0,.12), 0 6px 16px 0 rgba(0,0,0,.08), 0 9px 28px 8px rgba(0,0,0,.05)'
          }} onClick={(e) => e.stopPropagation()}>
            {/* 标题栏 */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #f0f0f0',
              fontSize: 16,
              fontWeight: 500
            }}>
              上传单据
            </div>

            {/* 内容区 */}
            <div style={{ padding: 24 }}>
              {/* 集装箱选择 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 500 }}>
                  选择上传范围
                </div>
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {/* 全选选项 */}
                  <div
                    onClick={() => setUploadScope('ALL')}
                    style={{
                      padding: '12px 16px',
                      border: '2px solid',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: uploadScope === 'ALL' ? '#e6f4ff' : '#fff',
                      borderColor: uploadScope === 'ALL' ? '#1890ff' : '#d9d9d9',
                      transition: 'all 0.3s'
                    }}
                  >
                    <Space>
                      <CheckCircleOutlined style={{
                        color: uploadScope === 'ALL' ? '#1890ff' : '#d9d9d9',
                        fontSize: 18
                      }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>全部运输单元</div>
                        <div style={{ fontSize: 12, color: '#999' }}>
                          为 {selectedJob?.containers.length} 个运输单元上传单据
                        </div>
                      </div>
                    </Space>
                  </div>

                  {/* 单个运输单元选项 */}
                  {selectedJob?.containers.map(container => (
                    <div
                      key={container.id}
                      onClick={() => setUploadScope(container.id)}
                      style={{
                        padding: '12px 16px',
                        border: '2px solid',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: uploadScope === container.id ? '#e6f4ff' : '#fff',
                        borderColor: uploadScope === container.id ? '#1890ff' : '#d9d9d9',
                        transition: 'all 0.3s'
                      }}
                    >
                      <Space>
                        <CheckCircleOutlined style={{
                          color: uploadScope === container.id ? '#1890ff' : '#d9d9d9',
                          fontSize: 18
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{container.containerNo}</div>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            {container.type} · {container.documents?.length || 0}个已上传单据
                          </div>
                        </div>
                      </Space>
                    </div>
                  ))}
                </Space>
              </div>

              <Divider style={{ margin: '20px 0' }} />

              {/* 文件上传 */}
              <Upload.Dragger
                multiple
                beforeUpload={() => false}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">
                  支持单个或批量上传，支持 PDF、图片等格式
                </p>
              </Upload.Dragger>
            </div>

            {/* 底部按钮 */}
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid #f0f0f0',
              textAlign: 'right'
            }}>
              <Space>
                <Button onClick={() => setUploadDrawerVisible(false)}>
                  取消
                </Button>
                <Button type="primary" onClick={() => {
                  if (uploadScope === 'ALL') {
                    message.success('已为整个任务上传单据');
                  } else {
                    const container = selectedJob?.containers.find(c => c.id === uploadScope);
                    message.success(`已为运输单元 ${container?.containerNo} 上传单据`);
                  }
                  setUploadDrawerVisible(false);
                  // TODO: 调用API上传单据
                  // API参数: { jobId, containerId: uploadScope, files }
                }}>
                  确定
                </Button>
              </Space>
            </div>
          </div>
        </div>
      )}

      {/* 费用录入Modal */}
      <Modal
        title="费用录入"
        open={feeModalVisible}
        onOk={handleSubmitFee}
        onCancel={() => {
          setFeeModalVisible(false);
          feeForm.resetFields();
          setFeeLevel('JOB');
          setSelectedContainerForFee('');
        }}
        width={600}
      >
        <Form form={feeForm} layout="vertical">
          {/* 费用级别选择 */}
          <Form.Item label="费用级别" required>
            <Select
              value={feeLevel}
              onChange={(value) => {
                setFeeLevel(value);
                setSelectedContainerForFee('');
              }}
              style={{ width: '100%' }}
            >
              <Option value="JOB">
                <Space>
                  <Tag color="blue">任务级</Tag>
                  <span>适用于整个运输任务的费用</span>
                </Space>
              </Option>
              <Option value="CONTAINER">
                <Space>
                  <Tag color="green">单元级</Tag>
                  <span>适用于单个运输单元的费用</span>
                </Space>
              </Option>
            </Select>
          </Form.Item>

          {/* 集装箱选择 - 仅在单元级别时显示 */}
          {feeLevel === 'CONTAINER' && (
            <Form.Item
              label="选择运输单元"
              required
              help="请选择要关联的运输单元"
            >
              <Select
                value={selectedContainerForFee}
                onChange={setSelectedContainerForFee}
                placeholder="请选择运输单元"
              >
                {selectedJob?.containers.map(c => (
                  <Option key={c.id} value={c.id}>
                    <Space>
                      <span style={{ fontWeight: 500 }}>{c.containerNo}</span>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        {c.type} · {c.orderCount}个订单
                      </span>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            name="feeType"
            label="费用类型"
            rules={[{ required: true, message: '请选择费用类型' }]}
          >
            <Select placeholder="请选择费用类型">
              <Option value="报关费">报关费</Option>
              <Option value="清关费">清关费</Option>
              <Option value="仓储费">仓储费</Option>
              <Option value="装卸费">装卸费</Option>
              <Option value="运输费">运输费</Option>
              <Option value="检验检疫费">检验检疫费</Option>
              <Option value="其他费用">其他费用</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="amount"
                label="金额"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber
                  min={0}
                  precision={2}
                  style={{ width: '100%' }}
                  placeholder="请输入金额"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="currency"
                label="币种"
                initialValue="CNY"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="CNY">CNY</Option>
                  <Option value="USD">USD</Option>
                  <Option value="EUR">EUR</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="费用说明">
            <Input.TextArea rows={3} placeholder="请输入费用说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
