import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Input, Select, Tag, Space, Drawer,
  Row, Col, Tooltip, theme
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, InboxOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { DestInboundOperation } from './DestInboundOperation';
import { JobDetail } from './JobDetail';

const { Option } = Select;

// ==================== 类型定义 ====================

type ServiceType = 'EXPRESS' | 'STANDARD';

interface DestInboundJobRecord {
  id: string;
  stationName: string;
  jobNo: string;
  serviceType: ServiceType;
  carrier: string;
  billOfLading: string;
  originPort: string;
  destPort: string;
  collNumbers: string[];
  totalWeight: number;
  totalPieces: number;
  logisticsStatus: string;
  logisticsStatusTime: string;
  logisticsStation: string;
  operatorAccount: string;
  operatorTime: string;
  updatedAt: string;
  children?: DestInboundJobRecord[];
}

const flattenJobs = (rows: DestInboundJobRecord[]): DestInboundJobRecord[] => {
  const result: DestInboundJobRecord[] = [];

  const walk = (row: DestInboundJobRecord) => {
    const { children, ...rest } = row;
    result.push(rest as DestInboundJobRecord);
    if (Array.isArray(children) && children.length > 0) {
      children.forEach(walk);
    }
  };

  rows.forEach(walk);
  return result;
};

// ==================== 三级级联数据 ====================

const COUNTRY_CITY_STATION = [
  {
    label: '尼日利亚', value: 'NGA',
    cities: [
      { label: '拉各斯', value: 'LOS', stations: [
        { label: '伊科贾站点', value: 'IKEJ_STA' },
        { label: '电脑村站点', value: 'CV_STA' },
        { label: '维岛站点', value: 'VI_STA' },
        { label: '贸易展会站点', value: 'TF_STA' },
      ]},
      { label: '卡诺', value: 'KAN', stations: [{ label: '卡诺站点', value: 'KAN_STA' }] },
      { label: '阿布贾', value: 'ABV', stations: [{ label: '阿布贾站点', value: 'ABUJ_STA' }] },
      { label: '奥尼查', value: 'ONI', stations: [{ label: '奥尼查站点', value: 'ONI_STA' }] },
    ]
  },
  {
    label: '加纳', value: 'GHA',
    cities: [{ label: '阿克拉', value: 'ACC', stations: [{ label: '阿克拉站点', value: 'ACC_STA' }] }]
  },
  {
    label: '几内亚', value: 'GIN',
    cities: [{ label: '科纳克里', value: 'CKY', stations: [{ label: '科纳克里站点', value: 'CKY_STA' }] }]
  },
  {
    label: '中国', value: 'CHN',
    cities: [
      { label: '广州', value: 'CAN', stations: [
        { label: '海珠区站点', value: 'HAIZ_STA' },
        { label: '白云区站点', value: 'BY_STA' },
      ]},
      { label: '深圳', value: 'SZX', stations: [{ label: '福田区站点', value: 'FT_STA' }] },
    ]
  },
];

const YEARS = Array.from({ length: 12 }, (_, i) => ({ label: `${2019 + i}年`, value: `${2019 + i}` }));
const MONTHS = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}月`, value: `${i + 1}` }));

// ==================== Mock 数据 ====================

const MOCK_INBOUND_JOBS: DestInboundJobRecord[] = [
  {
    id: '1', stationName: '海珠区站点', jobNo: 'JOB100156', serviceType: 'STANDARD',
    carrier: 'ET', billOfLading: '071-35539265', originPort: 'CAN', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK14'],
    totalWeight: 1500, totalPieces: 27,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'HAIZ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-10-30 23:51:17',
    children: [
      {
        id: '1-1', stationName: '海珠区站点', jobNo: 'JOB100157', serviceType: 'STANDARD',
        carrier: 'ET', billOfLading: '071-35539265', originPort: 'CAN', destPort: 'ACC',
        collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
        totalWeight: 800, totalPieces: 15,
        logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'HAIZ STA',
        operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-10-30 23:51:17',
      },
      {
        id: '1-2', stationName: '福田区站点', jobNo: 'JOB100158', serviceType: 'STANDARD',
        carrier: 'ET', billOfLading: '071-35539265', originPort: 'CAN', destPort: 'ACC',
        collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK13'],
        totalWeight: 700, totalPieces: 12,
        logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'HAIZ STA',
        operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-10-30 23:51:17',
      },
    ]
  },
  {
    id: '2', stationName: '海珠区站点', jobNo: 'JOB100145', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35539265', originPort: 'CAN', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 1000, totalPieces: 11,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-10-31 23:51:17',
  },
  {
    id: '3', stationName: '海珠区站点', jobNo: 'JOB100137', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35618004', originPort: 'CAN', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 50, totalPieces: 2,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-10-30 23:51:17',
  },
  {
    id: '4', stationName: '福田区站点', jobNo: 'JOB100159', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35545580', originPort: 'HKG', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 5690, totalPieces: 100,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-10-31 23:51:17',
  },
  {
    id: '5', stationName: '海珠区站点', jobNo: 'JOB100148', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35545580', originPort: 'CAN', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8'],
    totalWeight: 300, totalPieces: 10,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-01 23:51:17',
  },
  {
    id: '6', stationName: '福田区站点', jobNo: 'JOB100146', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35539265', originPort: 'HKG', destPort: 'LOS',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 1000, totalPieces: 11,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-02 23:51:17',
  },
  {
    id: '7', stationName: '海珠区站点', jobNo: 'JOB100153', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35618004', originPort: 'HKG', destPort: 'LOS',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 50, totalPieces: 2,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-03 23:51:17',
  },
  {
    id: '8', stationName: '福田区站点', jobNo: 'JOB100154', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35545580', originPort: 'HKG', destPort: 'LOS',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 1000, totalPieces: 11,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-04 23:51:17',
  },
  {
    id: '9', stationName: '海珠区站点', jobNo: 'JOB100136', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35545580', originPort: 'HKG', destPort: 'LOS',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6'],
    totalWeight: 50, totalPieces: 2,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-05 23:51:17',
  },
  {
    id: '10', stationName: '福田区站点', jobNo: 'JOB100115', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35539265', originPort: 'HKG', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 1000, totalPieces: 11,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-06 23:51:17',
  },
  {
    id: '11', stationName: '海珠区站点', jobNo: 'JOB100116', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35618004', originPort: 'HKG', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 50, totalPieces: 2,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-07 23:51:17',
  },
  {
    id: '12', stationName: '福田区站点', jobNo: 'JOB100117', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35545580', originPort: 'HKG', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 5690, totalPieces: 100,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-08 23:51:17',
  },
  {
    id: '13', stationName: '海珠区站点', jobNo: 'JOB100118', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35545580', originPort: 'HKG', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 300, totalPieces: 10,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-09 23:51:17',
  },
  {
    id: '14', stationName: '福田区站点', jobNo: 'JOB100119', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35545580', originPort: 'HKG', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 1000, totalPieces: 11,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-10 23:51:17',
  },
  {
    id: '15', stationName: '海珠区站点', jobNo: 'JOB100120', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35545580', originPort: 'HKG', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9','AK10','AK11','AK12'],
    totalWeight: 50, totalPieces: 2,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/18 20:30:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/18 20:30:01', updatedAt: '2019-11-11 23:51:17',
  },
  {
    id: '16', stationName: '海珠区站点', jobNo: 'JOB100121', serviceType: 'STANDARD',
    carrier: 'ET', billOfLading: '071-35539265', originPort: 'CAN', destPort: 'LOS',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5'],
    totalWeight: 2500, totalPieces: 45,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/20 10:00:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/20 10:00:01', updatedAt: '2019-11-12 23:51:17',
  },
  {
    id: '17', stationName: '福田区站点', jobNo: 'JOB100122', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35618004', originPort: 'HKG', destPort: 'LOS',
    collNumbers: ['AK1','AK2','AK3'],
    totalWeight: 180, totalPieces: 5,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/21 14:00:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/21 14:00:01', updatedAt: '2019-11-13 23:51:17',
  },
  {
    id: '18', stationName: '海珠区站点', jobNo: 'JOB100123', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35545580', originPort: 'CAN', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7'],
    totalWeight: 3200, totalPieces: 65,
    logisticsStatus: '已入库', logisticsStatusTime: '2019/10/22 09:00:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/22 09:00:01', updatedAt: '2019-11-14 23:51:17',
  },
  {
    id: '19', stationName: '福田区站点', jobNo: 'JOB100124', serviceType: 'STANDARD',
    carrier: 'ET', billOfLading: '071-35539265', originPort: 'HKG', destPort: 'LOS',
    collNumbers: ['AK1','AK2','AK3','AK4','AK5','AK6','AK7','AK8','AK9'],
    totalWeight: 4100, totalPieces: 80,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/23 16:00:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/23 16:00:01', updatedAt: '2019-11-15 23:51:17',
  },
  {
    id: '20', stationName: '海珠区站点', jobNo: 'JOB100125', serviceType: 'EXPRESS',
    carrier: 'ET', billOfLading: '071-35618004', originPort: 'CAN', destPort: 'ACC',
    collNumbers: ['AK1','AK2','AK3','AK4'],
    totalWeight: 220, totalPieces: 8,
    logisticsStatus: '已放行', logisticsStatusTime: '2019/10/24 11:00:00', logisticsStation: 'IKEJ STA',
    operatorAccount: 'CANPOYSION', operatorTime: '2019/10/24 11:00:01', updatedAt: '2019-11-16 23:51:17',
  },
];

// ==================== 集装号标签渲染 ====================

const MAX_COLL_TAGS = 8;

const CollTags: React.FC<{ collNumbers: string[] }> = ({ collNumbers }) => {
  const visible = collNumbers.slice(0, MAX_COLL_TAGS);
  const hidden = collNumbers.slice(MAX_COLL_TAGS);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {visible.map(c => (
        <Tag key={c} style={{ margin: 0, fontSize: 11 }}>{c}</Tag>
      ))}
      {hidden.length > 0 && (
        <Tooltip title={hidden.join(', ')}>
          <Tag style={{ margin: 0, fontSize: 11, cursor: 'pointer' }} color="default">
            ......More
          </Tag>
        </Tooltip>
      )}
    </div>
  );
};

// ==================== 主组件 ====================

interface DestInboundListProps {
  warehouseId?: string;
  businessMode?: 'ALL' | 'SEA' | 'AIR';
}

export const DestInboundList: React.FC<DestInboundListProps> = ({ businessMode = 'ALL' }) => {
  const { token } = theme.useToken();
  const carrierLabel = businessMode === 'SEA'
    ? '船公司'
    : businessMode === 'AIR'
      ? '航空公司'
      : '承运商';

  // 视图切换
  const [currentView, setCurrentView] = useState<'list' | 'inbound-operation' | 'job-detail'>('list');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobNo, setSelectedJobNo] = useState<string | null>(null);

  // 入库操作
  const handleInbound = (record: DestInboundJobRecord) => {
    setSelectedJobId(record.id);
    setSelectedJobNo(record.jobNo);
    setCurrentView('inbound-operation');
  };

  // 查看清单
  const handleViewManifest = (record: DestInboundJobRecord) => {
    setSelectedJobId(record.id);
    setSelectedJobNo(record.jobNo);
    setCurrentView('job-detail');
  };

  // 返回列表
  const handleBack = () => {
    setCurrentView('list');
    setSelectedJobId(null);
    setSelectedJobNo(null);
  };

  // 筛选状态
  const [filterCountry, setFilterCountry] = useState('ALL');
  const [filterCity, setFilterCity] = useState('ALL');
  const [filterStation, setFilterStation] = useState('ALL');
  const [filterYear, setFilterYear] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterExecutionStatus, setFilterExecutionStatus] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 级联联动
  const cityOptions = useMemo(() => {
    if (filterCountry === 'ALL') return [];
    const country = COUNTRY_CITY_STATION.find(c => c.value === filterCountry);
    return country?.cities || [];
  }, [filterCountry]);

  const stationOptions = useMemo(() => {
    if (filterCity === 'ALL') return [];
    for (const country of COUNTRY_CITY_STATION) {
      const city = country.cities.find(c => c.value === filterCity);
      if (city) return city.stations;
    }
    return [];
  }, [filterCity]);

  // 筛选数据
  const filteredData = useMemo(() => {
    let data = flattenJobs(MOCK_INBOUND_JOBS);

    if (filterCountry !== 'ALL') {
      const country = COUNTRY_CITY_STATION.find(c => c.value === filterCountry);
      const cityValues = (country?.cities || []).map(c => c.value);
      data = data.filter(r => cityValues.includes(r.destPort));
    }

    if (filterCity !== 'ALL') {
      data = data.filter(r => r.destPort === filterCity);
    }

    if (filterStation !== 'ALL') {
      const stationCode = filterStation.replace(/_/g, ' ');
      data = data.filter(r => r.logisticsStation === stationCode);
    }

    if (keyword) {
      const kw = keyword.toLowerCase();
      data = data.filter(r =>
        r.jobNo.toLowerCase().includes(kw) ||
        r.billOfLading.toLowerCase().includes(kw) ||
        r.carrier.toLowerCase().includes(kw)
      );
    }

    if (filterExecutionStatus !== 'ALL') {
      data = data.filter(r => r.logisticsStatus === filterExecutionStatus);
    }

    if (filterYear !== 'ALL') {
      data = data.filter(r => dayjs(r.updatedAt).year().toString() === filterYear);
    }

    if (filterMonth !== 'ALL') {
      data = data.filter(r => (dayjs(r.updatedAt).month() + 1).toString() === filterMonth);
    }

    return data;
  }, [filterCountry, filterCity, filterStation, keyword, filterExecutionStatus, filterYear, filterMonth]);

  // 统计
  const totalJobs = filteredData.length;
  const totalPieces = filteredData.reduce((sum, r) => sum + r.totalPieces, 0);
  const totalWeight = filteredData.reduce((sum, r) => sum + r.totalWeight, 0);

  // 重置
  const handleReset = () => {
    setFilterCountry('ALL');
    setFilterCity('ALL');
    setFilterStation('ALL');
    setFilterYear('ALL');
    setFilterMonth('ALL');
    setFilterExecutionStatus('ALL');
    setKeyword('');
    setShowAdvancedFilters(false);
  };

  // 表格列
  const columns = [
    {
      title: '任务编号',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 140,
      fixed: 'left' as const,
      render: (_: unknown, record: DestInboundJobRecord) => (
        <a style={{ fontWeight: 500 }}>{record.jobNo}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'serviceType',
      key: 'serviceType',
      width: 80,
      render: (type: ServiceType) => (
        <Tag color={type === 'EXPRESS' ? 'red' : 'blue'}>
          {type === 'EXPRESS' ? '特快' : '普快'}
        </Tag>
      ),
    },
    {
      title: `${carrierLabel}/提单号`,
      key: 'carrierBol',
      width: 160,
      render: (_: unknown, record: DestInboundJobRecord) => (
        <div>
          <div>{record.carrier}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.billOfLading}</div>
        </div>
      ),
    },
    {
      title: '起运港',
      dataIndex: 'originPort',
      key: 'originPort',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '目的港',
      dataIndex: 'destPort',
      key: 'destPort',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '集装号',
      key: 'collNumbers',
      width: 260,
      render: (_: unknown, record: DestInboundJobRecord) => (
        <CollTags collNumbers={record.collNumbers} />
      ),
    },
    {
      title: '重量',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      width: 90,
      align: 'right' as const,
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: '件数',
      dataIndex: 'totalPieces',
      key: 'totalPieces',
      width: 70,
      align: 'center' as const,
    },
    {
      title: '物流状态',
      key: 'logisticsStatus',
      width: 180,
      render: (_: unknown, record: DestInboundJobRecord) => (
        <div>
          <Tag color={record.logisticsStatus === '已放行' ? 'green' : record.logisticsStatus === '已入库' ? 'blue' : 'default'}>
            {record.logisticsStatus}
          </Tag>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
            {record.logisticsStation}
          </div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
            {record.logisticsStatusTime}
          </div>
        </div>
      ),
    },
    {
      title: '操作账户',
      key: 'operator',
      width: 150,
      render: (_: unknown, record: DestInboundJobRecord) => (
        <div>
          <div>{record.operatorAccount}</div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{record.operatorTime}</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: unknown, record: DestInboundJobRecord) => (
        <Space size="small">
          <Button type="link" size="small" icon={<InboxOutlined />} onClick={() => handleInbound(record)}>
            入库
          </Button>
          <Button type="link" size="small" icon={<FileTextOutlined />} onClick={() => handleViewManifest(record)}>
            清单
          </Button>
        </Space>
      ),
    },
    {
      title: '更新日期',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      sorter: (a: DestInboundJobRecord, b: DestInboundJobRecord) =>
        dayjs(a.updatedAt).unix() - dayjs(b.updatedAt).unix(),
    },
  ];

  return (
    <div>
      <Space size={[8, 8]} wrap style={{ marginBottom: 10 }}>
        <Tag color="blue">任务总数 {totalJobs}</Tag>
        <Tag>总件数 {totalPieces}</Tag>
        <Tag color="processing">总重量 {totalWeight} Kg</Tag>
      </Space>

      {/* 筛选区域 */}
      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Row gutter={[8, 8]} align="middle">
          <Col>
            <Select value={filterCountry} onChange={(v) => { setFilterCountry(v); setFilterCity('ALL'); setFilterStation('ALL'); }} style={{ width: 120 }}>
              <Option value="ALL">全部国家</Option>
              {COUNTRY_CITY_STATION.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
            </Select>
          </Col>
          <Col>
            <Select value={filterCity} onChange={(v) => { setFilterCity(v); setFilterStation('ALL'); }} style={{ width: 120 }} disabled={filterCountry === 'ALL'}>
              <Option value="ALL">全部城市</Option>
              {cityOptions.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
            </Select>
          </Col>
          <Col>
            <Select value={filterStation} onChange={setFilterStation} style={{ width: 140 }} disabled={filterCity === 'ALL'}>
              <Option value="ALL">全部站点</Option>
              {stationOptions.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
            </Select>
          </Col>
          <Col flex="auto">
            <Input
              placeholder={`输入任务编号、提单号、${carrierLabel}`}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              allowClear
              prefix={<SearchOutlined />}
              style={{ width: 280 }}
            />
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
              <Button type="link" onClick={() => setShowAdvancedFilters(v => !v)}>
                {showAdvancedFilters ? '收起筛选' : '高级筛选'}
              </Button>
            </Space>
          </Col>
        </Row>
        {showAdvancedFilters && (
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            <Col>
              <Select value={filterYear} onChange={setFilterYear} style={{ width: 100 }}>
                <Option value="ALL">全部年份</Option>
                {YEARS.map(y => <Option key={y.value} value={y.value}>{y.label}</Option>)}
              </Select>
            </Col>
            <Col>
              <Select value={filterMonth} onChange={setFilterMonth} style={{ width: 90 }}>
                <Option value="ALL">全部月</Option>
                {MONTHS.map(m => <Option key={m.value} value={m.value}>{m.label}</Option>)}
              </Select>
            </Col>
            <Col>
              <Select value={filterExecutionStatus} onChange={setFilterExecutionStatus} style={{ width: 130 }}>
                <Option value="ALL">全部状态</Option>
                <Option value="已放行">已放行</Option>
                <Option value="已入库">已入库</Option>
              </Select>
            </Col>
          </Row>
        )}
      </Card>

      {/* 数据表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredData}
        scroll={{ x: 1800, y: showAdvancedFilters ? 'calc(100vh - 510px)' : 'calc(100vh - 460px)' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条记录`,
        }}
        size="small"
      />

      <Drawer
        title={currentView === 'job-detail' ? '清单详情' : '货物入库'}
        width="90%"
        open={currentView !== 'list' && !!selectedJobNo}
        onClose={handleBack}
        destroyOnClose
      >
        {currentView === 'inbound-operation' && selectedJobId && selectedJobNo && (
          <DestInboundOperation
            jobId={selectedJobId}
            jobNo={selectedJobNo}
            onBack={handleBack}
          />
        )}
        {currentView === 'job-detail' && selectedJobNo && (
          <JobDetail
            jobNo={selectedJobNo}
          />
        )}
      </Drawer>
    </div>
  );
};
