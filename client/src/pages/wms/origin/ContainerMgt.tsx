import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Radio,
  QRCode,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  EyeOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { jobApi, supplierApi, systemApi, warehouseApi } from '../../../api';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../../components/ListPageToolbar';
import type { ShippingUnit } from '../../../types/core';

type BusinessMode = 'ALL' | 'SEA' | 'AIR';

interface RouteRemarkMeta {
  serviceType?: string;
  cargoType?: string;
  creator?: string;
  note?: string;
  taskExecution?: TaskExecutionMeta;
}

interface UnitRemarkMeta extends RouteRemarkMeta {
  routeId?: string;
  station?: string;
}

interface TaskExecutionMeta {
  jobNo?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  // 拖车公司信息
  deliveryCompany?: string;
  trackingNo?: string;          // 送货单号（拖车公司给的单号）
  queryPhone?: string;          // 拖车公司客服/查询电话
  // 司机与车辆
  driverName?: string;
  driverPhone?: string;
  plateNo?: string;
  // 发货时间和备注
  plannedDepartureTime?: string;
  remark?: string;
}

// 拖车公司 Mock 后备数据（当供应商管理中没有 TRUCKING 类型数据时使用）
// 实际数据统一由 基础设置 → 供应商管理 维护
const FALLBACK_TRUCKING_SUPPLIERS = [
  '广东广运拖车有限公司',
  '深圳华洋拖车服务',
  '佛山安达物流运输',
  '广州顺风拖车',
  '东莞快运拖车',
];

interface RouteConfigRow {
  id: string;
  originCountry: string;
  originCity: string;
  destCountry: string;
  destCity: string;
  transportType: 'SEA' | 'AIR';
  arrivalStation?: string;
  status?: string;
  remark?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface StockRow {
  id: string;
  subOrderNo?: string;
  displaySubOrderNo?: string;
  displayOrderNo?: string;
  trackingNo?: string;
  clientName?: string;
  salesPerson?: string;
  goodsDescription?: string;
  serviceType?: string;
  route?: string;
  pieces?: number;
  weight?: number;
  volume?: number;
  status?: string;
  shippingUnitId?: string | null;
}

interface GroupRow {
  id: string;
  routeText: string;
  serviceType: string;
  cargoType: string;
  station: string;
  creator: string;
  createdAt?: string;
  updatedAt?: string;
  units: ShippingUnit[];
  stockItems: StockRow[];
  totalVolume: number;
  volumeWeight: number;
  grossWeight: number;
  netWeight: number;
  totalPieces: number;
  statusLabel: string;
  statusTone: 'default' | 'processing' | 'success';
  taskExecution?: TaskExecutionMeta;
}

interface CreateRouteFormValues {
  routeText: string;
  serviceType: string;
  cargoType: string;
  creator: string;
  station: string;
}

interface BatchCreateRow {
  prefix: string;
  startNo: number;
  endNo: number;
  shouldPrint?: boolean;
}

interface BatchCreateFormValues {
  batches: BatchCreateRow[];
}

interface UnitDraftValues {
  length?: number;
  width?: number;
  height?: number;
  currentWeight?: number;
}

interface TaskExecutionFormValues {
  jobNo: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  driverName: string;
  driverPhone: string;
  plateNo: string;
}

const { Text } = Typography;
const SERVICE_OPTIONS = ['特快', '普快'] as const;
const CARGO_OPTIONS = ['普货', '非普货'] as const;
const DEFAULT_UNIT_TYPE: ShippingUnit['unitType'] = '40HQ';
const DEFAULT_MAX_WEIGHT = 26000;
const DEFAULT_MAX_VOLUME = 76;
const AUTO_BATCH_SIZE = 10;

const toNumber = (value: unknown) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

const formatNumber = (value: number, digits = 2) => toNumber(value).toFixed(digits);

const calcVolume = (length?: number, width?: number, height?: number) =>
  (toNumber(length) * toNumber(width) * toNumber(height)) / 1000000;

const calcVolumeWeight = (volume: number) => toNumber(volume) * 167;

const calcUnitMetrics = (draft: Pick<UnitDraftValues, 'length' | 'width' | 'height'>) => {
  const volume = calcVolume(draft.length, draft.width, draft.height);
  const volumeWeight = calcVolumeWeight(volume);
  return { volume, volumeWeight };
};

const toEditableNumber = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
};

// 将旧格式集装号（如 AK152）映射为真实集装号号格式
const toRealContainerNo = (unitNo: string): string => {
  const s = String(unitNo || '').trim();
  // 已经是真实格式（4字母+7数字）则直接返回
  if (/^[A-Z]{4}\d{7}$/.test(s)) return s;
  // 旧格式映射：取前缀哈希生成
  const prefixMap: Record<string, string> = {
    'AK': 'CSLU', 'BK': 'MSKU', 'CK': 'CMAU', 'DK': 'OOLU', 'EK': 'EGLV',
    'FK': 'HLXU', 'GK': 'MSCU', 'HK': 'TCLU', 'IK': 'APLU', 'JK': 'TRLU',
    'KK': 'BMOU', 'LK': 'FCIU', 'MK': 'GESU', 'NK': 'SEGU',
  };
  const match = s.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const ownerCode = prefixMap[match[1]] || 'XXLU';
    const serial = match[2].padStart(7, '0');
    return `${ownerCode}${serial}`;
  }
  return s;
};

const extractUnitPrefix = (unitNo?: string) => {
  const matched = String(unitNo || '').trim().toUpperCase().match(/^[A-Z]+/);
  return matched?.[0] || 'AK';
};

const parseUnitSerial = (unitNo: string, prefix: string) => {
  const normalizedNo = String(unitNo || '').trim().toUpperCase();
  const normalizedPrefix = String(prefix || '').trim().toUpperCase();
  if (!normalizedPrefix || !normalizedNo.startsWith(normalizedPrefix)) return null;
  const serialPart = normalizedNo.slice(normalizedPrefix.length);
  if (!/^\d+$/.test(serialPart)) return null;
  return Number(serialPart);
};

const normalizeRouteText = (value?: string | null) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/->/g, '→')
    .toUpperCase();

const parseJsonMeta = <T extends object>(value?: string | null): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') return parsed as T;
  } catch (_) {
    return {} as T;
  }
  return {} as T;
};

const buildMetaRemark = (meta: Record<string, unknown>) => JSON.stringify(meta);

const buildRouteText = (route: RouteConfigRow) =>
  `${String(route.originCity || '').trim().toUpperCase()}.${String(route.originCountry || '').trim().toUpperCase()}→${String(route.destCity || '').trim().toUpperCase()}.${String(route.destCountry || '').trim().toUpperCase()}`;

const parseRouteText = (value: string) => {
  const normalized = normalizeRouteText(value);
  const [originPart, destPart] = normalized.split('→');
  if (!originPart || !destPart) return null;
  const [originCity, originCountry] = originPart.split('.');
  const [destCity, destCountry] = destPart.split('.');
  if (!originCity || !originCountry || !destCity || !destCountry) return null;
  return {
    originCity,
    originCountry,
    destCity,
    destCountry,
  };
};

const getGroupStatus = (units: ShippingUnit[]) => {
  if (units.length === 0) return { label: '未生成集装号', tone: 'default' as const };
  const allExecuted = units.every((unit) => ['SEALED', 'SHIPPED', 'ARRIVED'].includes(String(unit.status)));
  if (allExecuted) return { label: '已执行', tone: 'success' as const };
  const hasLoading = units.some((unit) => unit.status === 'LOADING');
  if (hasLoading) return { label: '待执行', tone: 'processing' as const };
  return { label: '待执行', tone: 'default' as const };
};

const getUnitUtilization = (unit: ShippingUnit) => {
  const weightRatio = unit.maxWeight ? (toNumber(unit.currentWeight) / toNumber(unit.maxWeight)) * 100 : 0;
  const volumeRatio = unit.maxVolume ? (toNumber(unit.currentVolume) / toNumber(unit.maxVolume)) * 100 : 0;
  return Math.max(weightRatio, volumeRatio);
};

const isDepartedUnit = (unit: ShippingUnit) => ['SHIPPED', 'ARRIVED'].includes(String(unit.status));

// ==================== Mock 数据 ====================
// 前端 Demo 数据，不依赖后端接口
const buildMockTaskExecutionData = (transportMode: 'SEA' | 'AIR') => {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const prefix = transportMode === 'AIR' ? 'A' : 'S';

  // Mock Routes
  const mockRoutes: RouteConfigRow[] = [
    {
      id: 'ROUTE-MOCK-001',
      originCountry: 'CHN',
      originCity: 'CAN',
      destCountry: 'NGN',
      destCity: 'LOS',
      transportType: transportMode,
      arrivalStation: 'IKEJ STA',
      status: 'ACTIVE',
      remark: JSON.stringify({ serviceType: '特快', cargoType: '普货', creator: '张运营' }),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ROUTE-MOCK-002',
      originCountry: 'CHN',
      originCity: 'SZX',
      destCountry: 'NGN',
      destCity: 'LOS',
      transportType: transportMode,
      arrivalStation: 'IKEJ STA',
      status: 'ACTIVE',
      remark: JSON.stringify({ serviceType: '特快', cargoType: '普货', creator: '李运营' }),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'ROUTE-MOCK-003',
      originCountry: 'CHN',
      originCity: 'HKG',
      destCountry: 'GHA',
      destCity: 'ACC',
      transportType: transportMode,
      arrivalStation: 'ACC STA',
      status: 'ACTIVE',
      remark: JSON.stringify({ serviceType: '普快', cargoType: '普货', creator: 'SYSTEM' }),
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Mock ShippingUnits (2 条待执行 + 绑定集装号 + 绑定任务号)
  const mockUnits: ShippingUnit[] = [
    {
      id: 'UNIT-MOCK-001',
      unitNo: 'CSLU1234567',
      unitType: '40HQ',
      transportMode,
      route: 'CAN.CHN→LOS.NGN',
      maxWeight: 26000,
      maxVolume: 76,
      currentWeight: 12800,
      currentVolume: 38.5,
      orderIds: ['SUB-001', 'SUB-002', 'SUB-003'],
      loadedPieces: 156,
      loadedOrders: 3,
      status: 'LOADING',
      jobNo: `${prefix}-JOB26040001`,
      loadingStartTime: now,
      remark: JSON.stringify({
        routeId: 'ROUTE-MOCK-001',
        serviceType: '特快',
        cargoType: '普货',
        creator: '张运营',
        station: 'IKEJ STA',
      }),
      createdAt: now,
      updatedAt: now,
    } as ShippingUnit,
    {
      id: 'UNIT-MOCK-002',
      unitNo: 'MSKU7654321',
      unitType: '40HQ',
      transportMode,
      route: 'SZX.CHN→LOS.NGN',
      maxWeight: 26000,
      maxVolume: 76,
      currentWeight: 9600,
      currentVolume: 28.2,
      orderIds: ['SUB-004', 'SUB-005'],
      loadedPieces: 92,
      loadedOrders: 2,
      status: 'LOADING',
      jobNo: `${prefix}-JOB26040002`,
      loadingStartTime: now,
      remark: JSON.stringify({
        routeId: 'ROUTE-MOCK-002',
        serviceType: '特快',
        cargoType: '普货',
        creator: '李运营',
        station: 'IKEJ STA',
      }),
      createdAt: now,
      updatedAt: now,
    } as ShippingUnit,
  ];

  // Mock Stock (装载在这两个集装箱里的库存)
  const mockStocks: StockRow[] = [
    {
      id: 'STOCK-MOCK-001',
      subOrderNo: `${prefix}-2026040800001-01`,
      displayOrderNo: `${prefix}-2026040800001`,
      displaySubOrderNo: `${prefix}-2026040800001-01`,
      trackingNo: 'SF1234567890',
      clientName: '广州跨境客户A',
      salesPerson: '销售A',
      goodsDescription: '日用百货',
      serviceType: '特快',
      route: 'CAN.CHN→LOS.NGN',
      pieces: 80,
      weight: 6500,
      volume: 19.2,
      status: 'PACKED',
      shippingUnitId: 'UNIT-MOCK-001',
    },
    {
      id: 'STOCK-MOCK-002',
      subOrderNo: `${prefix}-2026040800002-01`,
      displayOrderNo: `${prefix}-2026040800002`,
      displaySubOrderNo: `${prefix}-2026040800002-01`,
      trackingNo: 'YT2099000888',
      clientName: '广州跨境客户B',
      salesPerson: '销售B',
      goodsDescription: '服装鞋包',
      serviceType: '特快',
      route: 'CAN.CHN→LOS.NGN',
      pieces: 76,
      weight: 6300,
      volume: 19.3,
      status: 'PACKED',
      shippingUnitId: 'UNIT-MOCK-001',
    },
    {
      id: 'STOCK-MOCK-003',
      subOrderNo: `${prefix}-2026040800003-01`,
      displayOrderNo: `${prefix}-2026040800003`,
      displaySubOrderNo: `${prefix}-2026040800003-01`,
      trackingNo: 'ZT2603270999',
      clientName: '深圳客户C',
      salesPerson: '销售C',
      goodsDescription: '电子配件',
      serviceType: '特快',
      route: 'SZX.CHN→LOS.NGN',
      pieces: 92,
      weight: 9600,
      volume: 28.2,
      status: 'PACKED',
      shippingUnitId: 'UNIT-MOCK-002',
    },
  ];

  // Mock Jobs (对应集装箱绑定的 jobNo)
  const mockJobs = [
    {
      id: 'JOB-MOCK-001',
      jobNo: `${prefix}-JOB26040001`,
      route: 'CAN.CHN→LOS.NGN',
      transportType: transportMode,
      status: 'PENDING',
      createdAt: now,
      createdDate: today,
    },
    {
      id: 'JOB-MOCK-002',
      jobNo: `${prefix}-JOB26040002`,
      route: 'SZX.CHN→LOS.NGN',
      transportType: transportMode,
      status: 'PENDING',
      createdAt: now,
      createdDate: today,
    },
  ];

  return { mockRoutes, mockUnits, mockStocks, mockJobs };
};

const isRouteDeparted = (route?: GroupRow | null) => Boolean(route?.units.some((unit) => isDepartedUnit(unit)));

const getGroupJobNos = (row: GroupRow) => {
  const jobNos = Array.from(new Set(
    [
      row.taskExecution?.jobNo,
      ...row.units.map((unit) => String(unit.jobNo || '').trim()),
    ].filter(Boolean).map((item) => String(item).trim()),
  ));

  return jobNos;
};

export const ContainerMgt = ({
  warehouseId,
  businessMode = 'SEA',
}: {
  warehouseId?: string;
  businessMode?: BusinessMode;
}) => {
  const isSea = businessMode !== 'AIR';
  const unitLabel = isSea ? '集装箱' : '集装号';
  const defaultUnitType: ShippingUnit['unitType'] = isSea ? '40HQ' : 'PALLET';
  const defaultMaxWeight = isSea ? 26000 : 1500;
  const defaultMaxVolume = isSea ? 76 : 5;
  const TXT = {
    scanPlaceholder: isSea ? '扫描/输入订单号' : '扫描/输入订单号',
    drawerTitle: isSea ? '添加订单' : '添加订单',
    notCreated: isSea ? '未创建集装箱' : '未创建集装号',
    pcs: '件',
    containerType: '柜型',
    weight: '毛重',
    volume: '体积',
    loaded: '已装订单',
    scanToAdd: isSea ? '扫描运单号添加到集装箱' : '扫描运单号添加到集装号',
  };
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteConfigRow[]>([]);
  const [units, setUnits] = useState<ShippingUnit[]>([]);
  const [stockItems, setStockItems] = useState<StockRow[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  const [keyword, setKeyword] = useState('');
  const [createRouteVisible, setCreateRouteVisible] = useState(false);
  const [unitDrawerVisible, setUnitDrawerVisible] = useState(false);
  const [batchCreateVisible, setBatchCreateVisible] = useState(false);
  const [printVisible, setPrintVisible] = useState(false);
  const [addOrderVisible, setAddOrderVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [executeTaskVisible, setExecuteTaskVisible] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState<GroupRow | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [selectedStockKeys, setSelectedStockKeys] = useState<React.Key[]>([]);
  const [availableKeyword, setAvailableKeyword] = useState('');
  const [addOrderMode, setAddOrderMode] = useState<'SCAN' | 'MANUAL'>('SCAN');
  const [printUnits, setPrintUnits] = useState<ShippingUnit[]>([]);
  const [unitDraftMap, setUnitDraftMap] = useState<Record<string, UnitDraftValues>>({});
  const [createRouteForm] = Form.useForm<CreateRouteFormValues>();
  const [batchCreateForm] = Form.useForm<BatchCreateFormValues>();
  const [executeTaskForm] = Form.useForm<TaskExecutionFormValues>();
  // 拖车公司列表（从 基础设置 → 供应商管理 的 TRUCKING 类型供应商中加载）
  const [truckingSuppliers, setTruckingSuppliers] = useState<string[]>(FALLBACK_TRUCKING_SUPPLIERS);

  const printRef = useRef<HTMLDivElement>(null);

  // 加载拖车公司列表：从供应商管理获取 TRUCKING 类型，失败/空则用 Mock 后备
  useEffect(() => {
    const loadTruckingSuppliers = async () => {
      try {
        const res: any = await supplierApi.list({ supplierType: 'TRUCKING', status: 'ACTIVE' });
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const truckingNames = list
          .filter((s: any) => s.supplierType === 'TRUCKING' && s.status !== 'INACTIVE')
          .map((s: any) => s.supplierName)
          .filter(Boolean);
        if (truckingNames.length > 0) {
          setTruckingSuppliers(truckingNames);
        }
      } catch (_) {
        // 加载失败则保留 Mock 后备数据
      }
    };
    loadTruckingSuppliers();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // 使用本地 Mock 数据（不依赖后端接口）
    const transportMode = isSea ? 'SEA' : 'AIR';
    const { mockRoutes, mockUnits, mockStocks, mockJobs } = buildMockTaskExecutionData(transportMode);
    setRoutes(mockRoutes);
    setUnits(mockUnits);
    setStockItems(mockStocks);
    setJobs(mockJobs);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [warehouseId]);

  const getTaskExecutionMeta = (routeMeta: RouteRemarkMeta, relatedUnits: ShippingUnit[]) => {
    if (routeMeta.taskExecution && typeof routeMeta.taskExecution === 'object') {
      return routeMeta.taskExecution;
    }

    for (const unit of relatedUnits) {
      const unitMeta = parseJsonMeta<UnitRemarkMeta>(unit.remark);
      if (unitMeta.taskExecution && typeof unitMeta.taskExecution === 'object') {
        return unitMeta.taskExecution;
      }
    }

    const jobNos = Array.from(new Set(
      relatedUnits
        .map((unit) => String(unit.jobNo || '').trim())
        .filter(Boolean),
    ));

    if (jobNos.length === 1) {
      return { jobNo: jobNos[0] };
    }

    return undefined;
  };

  const allGroupedRows = useMemo<GroupRow[]>(() => {
    const stockByUnitId = new Map<string, StockRow[]>();
    stockItems.forEach((item) => {
      if (!item.shippingUnitId) return;
      const list = stockByUnitId.get(String(item.shippingUnitId)) || [];
      list.push(item);
      stockByUnitId.set(String(item.shippingUnitId), list);
    });

    const matchedUnitIds = new Set<string>();

    const rowsFromRoutes = routes.map((route) => {
      const routeMeta = parseJsonMeta<RouteRemarkMeta>(route.remark);
      const routeText = buildRouteText(route);
      const normalizedRoute = normalizeRouteText(routeText);
      const relatedUnits = units.filter((unit) => {
        const meta = parseJsonMeta<UnitRemarkMeta>(unit.remark);
        const matched = meta.routeId === route.id || normalizeRouteText(unit.route) === normalizedRoute;
        if (matched) matchedUnitIds.add(unit.id);
        return matched;
      });
      const relatedStocks = relatedUnits.flatMap((unit) => stockByUnitId.get(unit.id) || []);
      const totalVolume = relatedUnits.reduce((sum, unit) => sum + toNumber(unit.currentVolume), 0);
      const grossWeight = relatedUnits.reduce((sum, unit) => sum + toNumber(unit.currentWeight), 0);
      const totalPieces = relatedUnits.reduce((sum, unit) => sum + toNumber(unit.loadedPieces), 0)
        || relatedStocks.reduce((sum, item) => sum + toNumber(item.pieces), 0);
      const status = getGroupStatus(relatedUnits);
      const updatedCandidates = [
        route.updatedAt,
        route.createdAt,
        ...relatedUnits.map((unit) => unit.updatedAt || unit.createdAt),
      ].filter(Boolean) as string[];

      return {
        id: route.id,
        routeText,
        serviceType: routeMeta.serviceType || '特快',
        cargoType: routeMeta.cargoType || '普货',
        station: route.arrivalStation || 'IKEJ STA',
        creator: routeMeta.creator || '-',
        createdAt: route.createdAt,
        updatedAt: updatedCandidates.sort().reverse()[0],
        units: relatedUnits,
        stockItems: relatedStocks,
        totalVolume,
        volumeWeight: calcVolumeWeight(totalVolume),
        grossWeight,
        netWeight: grossWeight,
        totalPieces,
        statusLabel: status.label,
        statusTone: status.tone,
        taskExecution: getTaskExecutionMeta(routeMeta, relatedUnits),
      };
    });

    const orphanRows = units
      .filter((unit) => !matchedUnitIds.has(unit.id))
      .reduce<GroupRow[]>((acc, unit) => {
        const meta = parseJsonMeta<UnitRemarkMeta>(unit.remark);
        const routeText = unit.route || '-';
        const key = `orphan:${normalizeRouteText(routeText)}:${meta.serviceType || ''}:${meta.cargoType || ''}`;
        const existing = acc.find((row) => row.id === key);
        const relatedStocks = stockByUnitId.get(unit.id) || [];
        if (existing) {
          existing.units.push(unit);
          existing.stockItems.push(...relatedStocks);
          existing.totalVolume += toNumber(unit.currentVolume);
          existing.volumeWeight = calcVolumeWeight(existing.totalVolume);
          existing.grossWeight += toNumber(unit.currentWeight);
          existing.netWeight = existing.grossWeight;
          existing.totalPieces += toNumber(unit.loadedPieces);
          existing.updatedAt = [existing.updatedAt, unit.updatedAt, unit.createdAt].filter(Boolean).sort().reverse()[0];
          const status = getGroupStatus(existing.units);
          existing.statusLabel = status.label;
          existing.statusTone = status.tone;
          existing.taskExecution = existing.taskExecution || getTaskExecutionMeta(meta, existing.units);
          return acc;
        }
        const status = getGroupStatus([unit]);
        acc.push({
          id: key,
          routeText,
          serviceType: meta.serviceType || '特快',
          cargoType: meta.cargoType || '普货',
          station: meta.station || 'IKEJ STA',
          creator: meta.creator || '-',
          createdAt: unit.createdAt,
          updatedAt: unit.updatedAt || unit.createdAt,
          units: [unit],
          stockItems: relatedStocks,
          totalVolume: toNumber(unit.currentVolume),
          volumeWeight: calcVolumeWeight(toNumber(unit.currentVolume)),
          grossWeight: toNumber(unit.currentWeight),
          netWeight: toNumber(unit.currentWeight),
          totalPieces: toNumber(unit.loadedPieces),
          statusLabel: status.label,
          statusTone: status.tone,
          taskExecution: getTaskExecutionMeta(meta, [unit]),
        });
        return acc;
      }, []);

    return [...rowsFromRoutes, ...orphanRows]
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [routes, units, stockItems]);

  const groupedRows = useMemo<GroupRow[]>(() => {
    const search = keyword.trim().toLowerCase();

    return allGroupedRows
      .filter((row) => {
        if (!search) return true;
        return [
          row.routeText,
          row.serviceType,
          row.cargoType,
          row.station,
          row.units.map((unit) => unit.unitNo).join(' '),
          row.stockItems.map((item) => `${item.displaySubOrderNo || ''} ${item.trackingNo || ''} ${item.clientName || ''}`).join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [allGroupedRows, keyword]);

  const stats = useMemo(() => ({
    pending: allGroupedRows.filter((row) => row.statusLabel === '待执行').length,
    executed: allGroupedRows.filter((row) => row.statusLabel === '已执行').length,
    unassigned: allGroupedRows.filter((row) => row.statusLabel === '未生成集装号').length,
    routeCount: allGroupedRows.length,
    unitCount: allGroupedRows.reduce((sum, row) => sum + row.units.length, 0),
  }), [allGroupedRows]);

  const handleQuery = () => {
    setKeyword((value) => value.trim());
  };

  const handleResetFilters = () => {
    setKeyword('');
  };

  const availableStockItems = useMemo(() => {
    const search = availableKeyword.trim().toLowerCase();
    return stockItems
      .filter((item) => !item.shippingUnitId)
      .filter((item) => !item.status || ['IN_STOCK', 'ALLOCATED'].includes(String(item.status)))
      .filter((item) => {
        if (!selectedRoute?.routeText || selectedRoute.routeText === '-') return true;
        return normalizeRouteText(item.route) === normalizeRouteText(selectedRoute.routeText);
      })
      .filter((item) => {
        if (!search) return true;
        return [
          item.displaySubOrderNo,
          item.displayOrderNo,
          item.trackingNo,
          item.clientName,
          item.goodsDescription,
        ].some((value) => String(value || '').toLowerCase().includes(search));
      });
  }, [stockItems, selectedRoute, availableKeyword]);

  const selectedAddOrderUnit = useMemo(
    () => selectedRoute?.units.find((unit) => unit.id === selectedUnitId) || null,
    [selectedRoute, selectedUnitId],
  );

  const selectedUnitOrders = useMemo(
    () => selectedRoute?.stockItems.filter((item) => item.shippingUnitId === selectedUnitId) || [],
    [selectedRoute, selectedUnitId],
  );

  const buildUnitDraft = (unit: ShippingUnit): UnitDraftValues => ({
    length: toEditableNumber((unit as any).length),
    width: toEditableNumber((unit as any).width),
    height: toEditableNumber((unit as any).height),
    currentWeight: toEditableNumber(unit.currentWeight),
  });

  const getUnitDraft = (unit: ShippingUnit): UnitDraftValues => ({
    ...buildUnitDraft(unit),
    ...(unitDraftMap[unit.id] || {}),
  });

  const updateUnitDraft = (unit: ShippingUnit, patch: Partial<UnitDraftValues>) => {
    setUnitDraftMap((prev) => ({
      ...prev,
      [unit.id]: {
        ...(prev[unit.id] || buildUnitDraft(unit)),
        ...patch,
      },
    }));
  };

  const watchedBatches = Form.useWatch('batches', batchCreateForm) as BatchCreateRow[] | undefined;

  const batchCreateTotalCount = useMemo(
    () => (watchedBatches || []).reduce((sum, batch) => {
      const startNo = Number(batch?.startNo);
      const endNo = Number(batch?.endNo);
      if (!Number.isFinite(startNo) || !Number.isFinite(endNo) || endNo < startNo) return sum;
      return sum + (endNo - startNo + 1);
    }, 0),
    [watchedBatches],
  );

  const getNextStartNoForPrefix = (prefix: string, seedRows: BatchCreateRow[] = []) => {
    const normalizedPrefix = String(prefix || '').trim().toUpperCase();
    if (!normalizedPrefix) return 1;

    const routeMax = (selectedRoute?.units || []).reduce((max, unit) => {
      const serial = parseUnitSerial(unit.unitNo, normalizedPrefix);
      if (serial == null) return max;
      return Math.max(max, serial);
    }, 0);

    const seedMax = seedRows.reduce((max, row) => {
      const rowPrefix = String(row.prefix || '').trim().toUpperCase();
      if (rowPrefix !== normalizedPrefix) return max;
      return Math.max(max, Number(row.endNo) || 0);
    }, 0);

    return Math.max(routeMax, seedMax) + 1;
  };

  useEffect(() => {
    if (!selectedRoute) return;
    const latestRoute = groupedRows.find((item) => item.id === selectedRoute.id);
    if (!latestRoute) {
      setSelectedRoute(null);
      setUnitDraftMap({});
      return;
    }
    if (latestRoute !== selectedRoute) {
      setSelectedRoute(latestRoute);
    }
    setUnitDraftMap((prev) => {
      const next: Record<string, UnitDraftValues> = {};
      latestRoute.units.forEach((unit) => {
        next[unit.id] = { ...buildUnitDraft(unit), ...(prev[unit.id] || {}) };
      });
      return next;
    });
    if (selectedUnitId && !latestRoute.units.some((unit) => unit.id === selectedUnitId)) {
      const nextUnit = latestRoute.units.find((unit) => !isDepartedUnit(unit)) || latestRoute.units[0];
      setSelectedUnitId(nextUnit?.id || '');
    }
  }, [groupedRows, selectedRoute, selectedUnitId]);

  const openUnitDrawer = (row: GroupRow) => {
    setSelectedRoute(row);
    setUnitDrawerVisible(true);
  };

  const openAddOrderDrawer = (row: GroupRow) => {
    setSelectedRoute(row);
    const firstUnit = row.units.find((unit) => !['SHIPPED', 'ARRIVED'].includes(String(unit.status))) || row.units[0];
    setSelectedUnitId(firstUnit?.id || '');
    setSelectedStockKeys([]);
    setAvailableKeyword('');
    setAddOrderMode('SCAN');
    setAddOrderVisible(true);
  };

  const openDetailDrawer = (row: GroupRow) => {
    setSelectedRoute(row);
    setDetailVisible(true);
  };

  const openExecuteTaskModal = (row: GroupRow) => {
    const currentTask = row.taskExecution;
    setSelectedRoute(row);
    executeTaskForm.setFieldsValue({
      jobNo: currentTask?.jobNo || '',
      recipientName: currentTask?.recipientName || '',
      recipientPhone: currentTask?.recipientPhone || '',
      recipientAddress: currentTask?.recipientAddress || '',
      driverName: currentTask?.driverName || '',
      driverPhone: currentTask?.driverPhone || '',
      plateNo: currentTask?.plateNo || '',
    });
    setExecuteTaskVisible(true);
  };

  const handleCreateRoute = async () => {
    try {
      const values = await createRouteForm.validateFields();
      const parsed = parseRouteText(values.routeText);
      if (!parsed) {
        message.error('线路格式不正确，请使用 CAN.CHN→LOS.NGN 这种格式');
        return;
      }
      await systemApi.createRoute({
        originCountry: parsed.originCountry,
        originCity: parsed.originCity,
        destCountry: parsed.destCountry,
        destCity: parsed.destCity,
        transportType: 'SEA',
        arrivalStation: values.station,
        status: 'ACTIVE',
        remark: buildMetaRemark({
          serviceType: values.serviceType,
          cargoType: values.cargoType,
          creator: values.creator,
        }),
      });
      message.success('线路已创建');
      setCreateRouteVisible(false);
      createRouteForm.resetFields();
      fetchData();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '创建线路失败');
    }
  };

  const handleOpenBatchCreate = () => {
    if (!selectedRoute) return;
    const defaultPrefix = extractUnitPrefix(selectedRoute.units[0]?.unitNo);
    const startNo = getNextStartNoForPrefix(defaultPrefix);
    batchCreateForm.setFieldsValue({
      batches: [{
        prefix: defaultPrefix,
        startNo,
        endNo: startNo + AUTO_BATCH_SIZE - 1,
        shouldPrint: true,
      }],
    });
    setBatchCreateVisible(true);
  };

  const handleBatchCreate = async () => {
    if (!selectedRoute) return;
    try {
      const values = await batchCreateForm.validateFields();
      const createdUnits: ShippingUnit[] = [];
      const existingUnitNos = new Set(units.map((unit) => String(unit.unitNo || '').toUpperCase()));
      const incomingUnitNos = new Set<string>();
      for (const batch of values.batches || []) {
        const prefix = String(batch.prefix || '').trim();
        const startNo = Number(batch.startNo);
        const endNo = Number(batch.endNo);
        if (!prefix || !Number.isFinite(startNo) || !Number.isFinite(endNo) || startNo > endNo) {
          throw new Error('请检查集装号段设置');
        }
        for (let current = startNo; current <= endNo; current += 1) {
          const unitNo = `${prefix}${String(current).padStart(2, '0')}`;
          const unitNoKey = unitNo.toUpperCase();
          if (existingUnitNos.has(unitNoKey) || incomingUnitNos.has(unitNoKey)) {
            throw new Error(`集装号 ${unitNo} 已存在，请调整段号`);
          }
          incomingUnitNos.add(unitNoKey);
        }
      }
      for (const batch of values.batches || []) {
        const prefix = String(batch.prefix || '').trim();
        const startNo = Number(batch.startNo);
        const endNo = Number(batch.endNo);
        for (let current = startNo; current <= endNo; current += 1) {
          const unitNo = `${prefix}${String(current).padStart(2, '0')}`;
          const res: any = await warehouseApi.createUnit({
            unitNo,
            unitType: defaultUnitType,
            transportMode: isSea ? 'SEA' : 'AIR',
            maxWeight: defaultMaxWeight,
            maxVolume: defaultMaxVolume,
            warehouse: 'CN',
            warehouseId: warehouseId || null,
            route: selectedRoute.routeText,
            remark: buildMetaRemark({
              routeId: selectedRoute.id.startsWith('orphan:') ? null : selectedRoute.id,
              serviceType: selectedRoute.serviceType,
              cargoType: selectedRoute.cargoType,
              creator: selectedRoute.creator,
              station: selectedRoute.station,
            }),
          });
          if (res?.data) createdUnits.push(res.data);
        }
      }
      message.success(`已新增 ${createdUnits.length} 个集装号`);
      setBatchCreateVisible(false);
      fetchData();
      if ((values.batches || []).some((item) => item.shouldPrint) && createdUnits.length > 0) {
        setPrintUnits(createdUnits);
        setPrintVisible(true);
      }
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '新增集装号失败');
    }
  };

  const handleSaveAllUnitsInline = async () => {
    if (!selectedRoute) return;
    const editableUnits = selectedRoute.units.filter((unit) => !isDepartedUnit(unit));
    if (editableUnits.length === 0) {
      message.warning('货物离境后不可编辑集装号数据');
      return;
    }
    try {
      let changedCount = 0;
      for (const unit of editableUnits) {
        const draft = getUnitDraft(unit);
        const nextLength = toNumber(draft.length);
        const nextWidth = toNumber(draft.width);
        const nextHeight = toNumber(draft.height);
        const nextWeight = toNumber(draft.currentWeight);
        const { volume: nextVolume } = calcUnitMetrics(draft);
        const hasChanged = toNumber((unit as any).length) !== nextLength
          || toNumber((unit as any).width) !== nextWidth
          || toNumber((unit as any).height) !== nextHeight
          || toNumber(unit.currentWeight) !== nextWeight
          || toNumber(unit.currentVolume) !== nextVolume;
        if (!hasChanged) continue;
        await warehouseApi.updateUnit(unit.id, {
          length: nextLength,
          width: nextWidth,
          height: nextHeight,
          currentWeight: nextWeight,
          currentVolume: nextVolume,
        });
        changedCount += 1;
      }
      if (changedCount === 0) {
        message.info('没有需要保存的变更');
        return;
      }
      message.success(`已保存 ${changedCount} 个集装号`);
      fetchData();
    } catch (error: any) {
      message.error(error?.message || '保存失败');
    }
  };

  const handleDeleteUnit = async (unit: ShippingUnit) => {
    if (isDepartedUnit(unit)) {
      message.warning('货物离境后不可删除集装号');
      return;
    }
    try {
      await warehouseApi.deleteUnit(unit.id);
      message.success(`集装号 ${unit.unitNo} 已删除`);
      fetchData();
    } catch (error: any) {
      message.error(error?.message || '删除失败');
    }
  };

  const confirmDeleteUnit = (unit: ShippingUnit) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除集装号 ${unit.unitNo} 吗？`,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => handleDeleteUnit(unit),
    });
  };

  const handleLoadOrders = async () => {
    if (!selectedUnitId) {
      message.warning('请先创建并选择集装号');
      return;
    }
    if (selectedAddOrderUnit && isDepartedUnit(selectedAddOrderUnit)) {
      message.warning('货物离境后不可继续添加订单');
      return;
    }
    if (selectedStockKeys.length === 0) {
      message.warning('请选择要装箱的订单');
      return;
    }
    try {
      await warehouseApi.loadUnit(selectedUnitId, selectedStockKeys.map((item) => String(item)));
      message.success('订单已加入集装号');
      setAddOrderVisible(false);
      setSelectedStockKeys([]);
      fetchData();
    } catch (error: any) {
      message.error(error?.message || '添加订单失败');
    }
  };

  const handleOpenPrint = (targetUnits: ShippingUnit[]) => {
    setPrintUnits(targetUnits);
    setPrintVisible(true);
  };

  const handleSubmitExecuteTask = async () => {
    if (!selectedRoute) return;
    try {
      const values = await executeTaskForm.validateFields();
      const executableUnits = selectedRoute.units.filter((unit) => !isDepartedUnit(unit));
      if (executableUnits.length === 0) {
        message.warning('货物离境后不可执行任务');
        return;
      }

      const taskExecution: TaskExecutionMeta = {
        jobNo: values.jobNo,
        recipientName: values.recipientName.trim(),
        recipientPhone: values.recipientPhone.trim(),
        recipientAddress: values.recipientAddress.trim(),
        deliveryCompany: values.deliveryCompany || '',
        trackingNo: (values.trackingNo || '').trim(),
        queryPhone: (values.queryPhone || '').trim(),
        driverName: values.driverName.trim(),
        driverPhone: values.driverPhone.trim(),
        plateNo: values.plateNo.trim(),
        plannedDepartureTime: values.plannedDepartureTime
          ? dayjs(values.plannedDepartureTime).format('YYYY-MM-DD HH:mm')
          : '',
        remark: (values.remark || '').trim(),
      };

      if (!selectedRoute.id.startsWith('orphan:')) {
        const targetRoute = routes.find((item) => item.id === selectedRoute.id);
        const routeMeta = parseJsonMeta<RouteRemarkMeta>(targetRoute?.remark);
        await systemApi.updateRoute(selectedRoute.id, {
          remark: buildMetaRemark({
            ...routeMeta,
            taskExecution,
          }),
        });
      } else {
        await Promise.all(executableUnits.map((unit) => {
          const unitMeta = parseJsonMeta<UnitRemarkMeta>(unit.remark);
          return warehouseApi.updateUnit(unit.id, {
            remark: buildMetaRemark({
              ...unitMeta,
              taskExecution,
            }),
          });
        }));
      }

      await jobApi.bindUnits(values.jobNo, executableUnits.map((unit) => unit.id));
      message.success(`任务 ${values.jobNo} 已绑定 ${executableUnits.length} 个集装号`);
      setExecuteTaskVisible(false);
      executeTaskForm.resetFields();
      fetchData();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error?.message || '执行任务失败');
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>打印集装号标签</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 16px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
            .label { border: 2px solid #111; min-height: 300px; padding: 18px; box-sizing: border-box; page-break-inside: avoid; }
            .code { font-size: 96px; font-weight: 800; line-height: 1; margin-bottom: 24px; }
            .footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
            .service { font-size: 40px; font-weight: 700; line-height: 1.1; }
            .route { font-size: 28px; font-weight: 700; margin-top: 8px; }
            .time { font-size: 18px; margin-top: 8px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const selectedExecuteJobNo = Form.useWatch('jobNo', executeTaskForm);
  const selectedExecuteJob = useMemo(
    () => jobs.find((job) => job.jobNo === selectedExecuteJobNo) || null,
    [jobs, selectedExecuteJobNo],
  );

  const taskOptions = useMemo(
    () => jobs
      .filter((job) => {
        const transportType = String(job.transportType || '').toUpperCase();
        return transportType === (isSea ? 'SEA' : 'AIR');
      })
      .filter((job) => String(job.status || '').toUpperCase() !== 'CANCELLED')
      .map((job) => ({
        label: `${job.jobNo} ${job.route ? `| ${job.route}` : ''}`,
        value: job.jobNo,
      })),
    [jobs],
  );

  const mainColumns = [
    {
      title: '序号',
      key: 'index',
      width: 70,
      fixed: 'left' as const,
      render: (_: unknown, __: GroupRow, index: number) => index + 1,
    },
    {
      title: '任务编号',
      width: 180,
      render: (_: unknown, row: GroupRow) => {
        const jobNos = getGroupJobNos(row);
        if (jobNos.length === 0) return <Tag color="orange">待绑定</Tag>;
        return jobNos[0];
      },
    },
    {
      title: '线路',
      dataIndex: 'routeText',
      width: 280,
      render: (value: string, row: GroupRow) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.creator} {row.createdAt ? dayjs(row.createdAt).format('YYYY/MM/DD HH:mm:ss') : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: isSea ? '集装箱号' : '集装号',
      width: 180,
      render: (_: unknown, row: GroupRow) => {
        if (isSea) {
          const unit = row.units[0];
          return unit ? (
            <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>{toRealContainerNo(unit.unitNo)}</Text>
          ) : <Text type="secondary">未创建</Text>;
        }
        // 空运：展示多个集装号
        const unitNos = row.units.map(u => u.unitNo).filter(Boolean);
        if (unitNos.length === 0) return <Text type="secondary">未创建</Text>;
        return (
          <Space size={4} wrap>
            {unitNos.slice(0, 4).map(no => <Tag key={no}>{no}</Tag>)}
            {unitNos.length > 4 && <Tag>+{unitNos.length - 4}</Tag>}
          </Space>
        );
      },
    },
    {
      title: '服务类型',
      dataIndex: 'serviceType',
      width: 120,
      render: (value: string) => <Tag color="red">{value}</Tag>,
    },
    {
      title: '说明',
      dataIndex: 'cargoType',
      width: 100,
    },
    {
      title: '体积CBM',
      dataIndex: 'totalVolume',
      width: 110,
      align: 'right' as const,
      render: (value: number) => formatNumber(value, 2),
    },
    {
      title: '体积重KGS',
      dataIndex: 'volumeWeight',
      width: 120,
      align: 'right' as const,
      render: (value: number) => formatNumber(value, 2),
    },
    {
      title: '毛重KGS',
      dataIndex: 'grossWeight',
      width: 110,
      align: 'right' as const,
      render: (value: number) => formatNumber(value, 2),
    },
    {
      title: '净重KGS',
      dataIndex: 'netWeight',
      width: 110,
      align: 'right' as const,
      render: (value: number) => formatNumber(value, 2),
    },
    {
      title: '件数',
      dataIndex: 'totalPieces',
      width: 90,
      align: 'right' as const,
      render: (value: number) => formatNumber(value, 0),
    },
    {
      title: '状态',
      width: 180,
      render: (_: unknown, row: GroupRow) => (
        <Space direction="vertical" size={0}>
          <Tag color={row.statusTone === 'success' ? 'success' : row.statusTone === 'processing' ? 'processing' : 'default'}>
            {row.statusLabel}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.station}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      render: (_: unknown, row: GroupRow) => {
        const jobNos = getGroupJobNos(row);
        const hasTask = jobNos.length > 0;
        const departed = isRouteDeparted(row);
        return (
          <Space size="small">
            {!isSea && (
              <Button type="link" size="small" onClick={() => openUnitDrawer(row)}>集装号</Button>
            )}
            {!hasTask && (
              <Button
                type="link"
                size="small"
                onClick={() => openExecuteTaskModal(row)}
                disabled={departed}
              >
                绑定任务
              </Button>
            )}
            <Button
              type="link"
              size="small"
              onClick={() => openAddOrderDrawer(row)}
              disabled={row.units.length === 0 || row.units.every((unit) => isDepartedUnit(unit))}
            >
              添加订单
            </Button>
            {hasTask && (
              <Button
                type="link"
                size="small"
                onClick={() => openExecuteTaskModal(row)}
                disabled={row.units.length === 0 || departed}
              >
                执行出库
              </Button>
            )}
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetailDrawer(row)}>详情</Button>
          </Space>
        );
      },
    },
    {
      title: '更新日期',
      dataIndex: 'updatedAt',
      width: 170,
      render: (value: string) => value ? dayjs(value).format('YYYY/MM/DD HH:mm') : '-',
    },
  ];

  const unitColumns = [
    {
      title: '集装号',
      dataIndex: 'unitNo',
      width: 150,
      render: (value: string, row: ShippingUnit) => (
        <Space>
          <span>{value}</span>
          {!isDepartedUnit(row) && (
            <Button
              type="link"
              danger
              size="small"
              style={{ paddingInline: 0 }}
              onClick={() => confirmDeleteUnit(row)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
    {
      title: '长CM',
      width: 130,
      render: (_: unknown, row: ShippingUnit) => {
        const draft = getUnitDraft(row);
        return (
          <InputNumber
            min={0}
            controls={false}
            value={draft.length}
            placeholder="录入"
            disabled={isDepartedUnit(row)}
            style={{ width: '100%', border: 'none', background: 'transparent', boxShadow: 'none' }}
            onChange={(value) => updateUnitDraft(row, { length: value == null ? undefined : Number(value) })}
          />
        );
      },
    },
    {
      title: '宽CM',
      width: 130,
      render: (_: unknown, row: ShippingUnit) => {
        const draft = getUnitDraft(row);
        return (
          <InputNumber
            min={0}
            controls={false}
            value={draft.width}
            placeholder="录入"
            disabled={isDepartedUnit(row)}
            style={{ width: '100%', border: 'none', background: 'transparent', boxShadow: 'none' }}
            onChange={(value) => updateUnitDraft(row, { width: value == null ? undefined : Number(value) })}
          />
        );
      },
    },
    {
      title: '高CM',
      width: 130,
      render: (_: unknown, row: ShippingUnit) => {
        const draft = getUnitDraft(row);
        return (
          <InputNumber
            min={0}
            controls={false}
            value={draft.height}
            placeholder="录入"
            disabled={isDepartedUnit(row)}
            style={{ width: '100%', border: 'none', background: 'transparent', boxShadow: 'none' }}
            onChange={(value) => updateUnitDraft(row, { height: value == null ? undefined : Number(value) })}
          />
        );
      },
    },
    {
      title: '毛重KGS',
      width: 140,
      render: (_: unknown, row: ShippingUnit) => {
        const draft = getUnitDraft(row);
        return (
          <InputNumber
            min={0}
            controls={false}
            value={draft.currentWeight}
            placeholder="录入"
            disabled={isDepartedUnit(row)}
            style={{ width: '100%', border: 'none', background: 'transparent', boxShadow: 'none' }}
            onChange={(value) => updateUnitDraft(row, { currentWeight: value == null ? undefined : Number(value) })}
          />
        );
      },
    },
    {
      title: '体积CBM',
      width: 130,
      align: 'right' as const,
      render: (_: unknown, row: ShippingUnit) => {
        const draft = getUnitDraft(row);
        const { volume } = calcUnitMetrics(draft);
        return formatNumber(volume, 2);
      },
    },
    {
      title: '体积重KGS',
      width: 130,
      align: 'right' as const,
      render: (_: unknown, row: ShippingUnit) => {
        const draft = getUnitDraft(row);
        const { volumeWeight } = calcUnitMetrics(draft);
        return formatNumber(volumeWeight, 2);
      },
    },
  ];

  const stockColumns = [
    {
      title: '单号',
      dataIndex: 'displaySubOrderNo',
      width: 180,
      render: (value: string, row: StockRow) => value || row.subOrderNo || '-',
    },
    {
      title: '客户',
      dataIndex: 'clientName',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '品名',
      dataIndex: 'goodsDescription',
      width: 130,
      render: (value: string) => value || '-',
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      width: 70,
      align: 'right' as const,
      render: (value: number) => formatNumber(value || 0, 0),
    },
    {
      title: '重量KG',
      dataIndex: 'weight',
      width: 90,
      align: 'right' as const,
      render: (value: number) => formatNumber(value || 0, 2),
    },
    {
      title: '体积CBM',
      dataIndex: 'volume',
      width: 100,
      align: 'right' as const,
      render: (value: number) => formatNumber(value || 0, 2),
    },
  ];

  return (
    <div>
      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="gold">待执行 {stats.pending}</Tag>
        <Tag color="success">已执行 {stats.executed}</Tag>
        <Tag>未生成集装号 {stats.unassigned}</Tag>
        <Tag color="processing">总线路 {stats.routeCount}</Tag>
        <Tag color="blue">总集装号 {stats.unitCount}</Tag>
      </div>

      <ListPageToolbarCard style={{ marginBottom: 10 }}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 320px" minWidth={260}>
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onPressEnter={handleQuery}
                placeholder="搜索线路/集装号/订单号"
                prefix={<SearchOutlined />}
                allowClear
              />
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Text type="secondary">共 {groupedRows.length} 条记录</Text>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleQuery}>查询</Button>
            <Button onClick={handleResetFilters}>重置</Button>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createRouteForm.setFieldsValue({
                  routeText: '',
                  serviceType: '特快',
                  cargoType: '普货',
                  creator: 'SYSTEM',
                  station: 'IKEJ STA',
                });
                setCreateRouteVisible(true);
              }}
            >
              创建线路
            </Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      <Card>
        <Table
          rowKey="id"
          columns={mainColumns}
          dataSource={groupedRows}
          loading={loading}
          size="small"
          scroll={{ x: 1900, y: 'calc(100vh - 420px)' }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title="创建线路"
        open={createRouteVisible}
        onOk={handleCreateRoute}
        onCancel={() => {
          setCreateRouteVisible(false);
          createRouteForm.resetFields();
        }}
        okText="确认"
        cancelText="返回"
        destroyOnClose
      >
        <Form form={createRouteForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="routeText"
                label="线路"
                rules={[{ required: true, message: '请输入线路' }]}
                extra="如：CAN.CHN→LOS.NGN"
              >
                <Input placeholder="请输入线路编码" />
              </Form.Item>
            </Col>
            {isSea && <Col span={12}>
              <Form.Item
                name="containerNo"
                label="集装箱号"
                rules={[{ required: true, message: '请输入集装箱号' }]}
              >
                <Input placeholder="如 MSKU1234567" style={{ fontFamily: 'monospace', fontWeight: 600 }} />
              </Form.Item>
            </Col>}
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="serviceType" label="服务类型" rules={[{ required: true, message: '请选择服务类型' }]}>
                <Select options={SERVICE_OPTIONS.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cargoType" label="货物类型" rules={[{ required: true, message: '请选择货物类型' }]}>
                <Select options={CARGO_OPTIONS.map((item) => ({ label: item, value: item }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="station" label="站点" rules={[{ required: true, message: '请输入站点' }]}>
                <Input placeholder="如：IKEJ STA" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="creator" label="创建人" rules={[{ required: true, message: '请输入创建人' }]}>
                <Input placeholder="如：SAMPAO" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title={selectedRoute ? `${selectedRoute.routeText} · 集装号` : '集装号'}
        width={1180}
        styles={{ body: { display: 'flex', flexDirection: 'column', minHeight: 0, paddingBottom: 12 } }}
        open={unitDrawerVisible}
        onClose={() => {
          setUnitDrawerVisible(false);
          setSelectedRoute(null);
          setUnitDraftMap({});
        }}
        destroyOnClose
        extra={
          selectedRoute ? (
            <Space>
              <Button icon={<PrinterOutlined />} onClick={() => handleOpenPrint(selectedRoute.units)} disabled={selectedRoute.units.length === 0}>
                批量打印
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenBatchCreate}
                disabled={isRouteDeparted(selectedRoute)}
              >
                新增集装号
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedRoute && (
          <>
            <Descriptions bordered size="small" column={4} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="线路">{selectedRoute.routeText}</Descriptions.Item>
              <Descriptions.Item label="服务类型">{selectedRoute.serviceType}</Descriptions.Item>
              <Descriptions.Item label="说明">{selectedRoute.cargoType}</Descriptions.Item>
              <Descriptions.Item label="站点">{selectedRoute.station}</Descriptions.Item>
            </Descriptions>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Table
                rowKey="id"
                columns={unitColumns}
                dataSource={selectedRoute.units}
                size="small"
                scroll={{ x: 980, y: 'calc(100vh - 355px)' }}
                onRow={(_: ShippingUnit, index) => ({
                  style: { background: (index || 0) % 2 === 0 ? '#f5f5f5' : '#e9e9e9' },
                })}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 个集装号`,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
              <Button
                type="primary"
                onClick={handleSaveAllUnitsInline}
                disabled={selectedRoute.units.length === 0 || selectedRoute.units.every((unit) => isDepartedUnit(unit))}
              >
                保存
              </Button>
            </div>
          </>
        )}
      </Drawer>

      <Modal
        title={isSea ? '创建集装箱' : '创建集装号'}
        open={batchCreateVisible}
        onOk={handleBatchCreate}
        onCancel={() => setBatchCreateVisible(false)}
        width={isSea ? 640 : 900}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={batchCreateForm} layout="vertical">
          {isSea ? (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="containerNo" label="集装箱号" rules={[{ required: true, message: '请输入集装箱号' }]}>
                    <Input placeholder="如 MSKU1234567" style={{ fontFamily: 'monospace', fontWeight: 600 }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="containerType" label="柜型" rules={[{ required: true, message: '请选择柜型' }]}>
                    <Select placeholder="选择柜型">
                      <Option value="20GP">20GP（20尺普柜）</Option>
                      <Option value="40GP">40GP（40尺普柜）</Option>
                      <Option value="40HQ">40HQ（40尺高柜）</Option>
                      <Option value="45HQ">45HQ（45尺高柜）</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="jobNo" label="关联任务">
                    <Select placeholder="选择任务（选填）" allowClear>
                      {(jobs || []).map((j: any) => (
                        <Option key={j.jobNo || j.id} value={j.jobNo || j.id}>{j.jobNo || j.id} - {j.routeName || j.route || ''}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="sealNo" label="铅封号">
                    <Input placeholder="选填" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          ) : (
            <>
              <div style={{ background: '#f5f5f5', padding: '14px 24px', fontWeight: 600 }}>
                <Row gutter={12}>
                  <Col span={6}>前缀</Col>
                  <Col span={10}>段号</Col>
                  <Col span={8} style={{ textAlign: 'right' }}>
                    <Button type="link" icon={<PlusOutlined />} onClick={() => {
                      const currentRows = (batchCreateForm.getFieldValue('batches') || []) as BatchCreateRow[];
                      const defaultPrefix = extractUnitPrefix(selectedRoute?.units[0]?.unitNo);
                      const nextPrefix = String(currentRows[currentRows.length - 1]?.prefix || defaultPrefix).trim().toUpperCase() || 'AK';
                      const nextStart = getNextStartNoForPrefix(nextPrefix, currentRows);
                      batchCreateForm.setFieldValue('batches', [
                        ...currentRows,
                        { prefix: nextPrefix, startNo: nextStart, endNo: nextStart + AUTO_BATCH_SIZE - 1, shouldPrint: false },
                      ]);
                    }}>添加</Button>
                  </Col>
                </Row>
              </div>
              <div style={{ padding: '12px 24px 0' }}>
                <Form.List name="batches">
                  {(fields, { remove }) => fields.map((field) => {
                    const shouldPrint = batchCreateForm.getFieldValue(['batches', field.name, 'shouldPrint']);
                    return (
                      <div key={field.key} style={{ padding: '18px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <Row gutter={12} align="middle">
                          <Col span={6}>
                            <Form.Item {...field} name={[field.name, 'prefix']} rules={[{ required: true, message: '请输入前缀' }]} style={{ marginBottom: 0 }}>
                              <Input style={{ textAlign: 'center' }} />
                            </Form.Item>
                          </Col>
                          <Col span={10}>
                            <Space style={{ width: '100%', justifyContent: 'center' }}>
                              <Form.Item {...field} name={[field.name, 'startNo']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                <InputNumber min={0} controls={false} formatter={(v) => String(v || '').padStart(2, '0')} parser={(v) => Number(String(v || '').replace(/\D/g, '') || 0)} />
                              </Form.Item>
                              <span>至</span>
                              <Form.Item {...field} name={[field.name, 'endNo']} rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                <InputNumber min={0} controls={false} formatter={(v) => String(v || '').padStart(2, '0')} parser={(v) => Number(String(v || '').replace(/\D/g, '') || 0)} />
                              </Form.Item>
                            </Space>
                          </Col>
                          <Col span={8} style={{ textAlign: 'right' }}>
                            <Text style={{ color: shouldPrint ? '#1677ff' : '#262626', cursor: 'pointer', marginRight: 12 }} onClick={() => batchCreateForm.setFieldValue(['batches', field.name, 'shouldPrint'], !shouldPrint)}>打印</Text>
                            <Text style={{ color: '#ff4d4f', cursor: 'pointer' }} onClick={() => remove(field.name)}>X</Text>
                          </Col>
                        </Row>
                      </div>
                    );
                  })}
                </Form.List>
              </div>
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Text type="secondary">本次将新增 {batchCreateTotalCount} 个集装号</Text>
              </div>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title="打印标签"
        open={printVisible}
        onCancel={() => setPrintVisible(false)}
        width={920}
        styles={{ body: { maxHeight: '68vh', overflow: 'auto' } }}
        footer={[
          <Button key="cancel" onClick={() => setPrintVisible(false)}>关闭</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>打印</Button>,
        ]}
      >
        <div ref={printRef}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 24 }}>
            {printUnits.map((unit) => (
              <div key={unit.id} style={{ border: '2px solid #111', minHeight: 300, padding: 18 }}>
                <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1, marginBottom: 24 }}>
                  {unit.unitNo}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.1 }}>
                      {selectedRoute?.serviceType === '特快' ? 'EXPRES' : isSea ? 'SEA FREIGHT' : 'AIR CARGO'}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>
                      {String(selectedRoute?.routeText || unit.route || '').replace(/→/g, '-')}
                    </div>
                    <div style={{ fontSize: 16, marginTop: 8 }}>
                      {dayjs(unit.updatedAt || unit.createdAt).format('YYYY/MM/DD HH:mm:ss')}
                    </div>
                  </div>
                  <QRCode value={unit.unitNo} size={110} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Drawer
        title={selectedRoute ? (selectedRoute.routeText + ' - ' + TXT.drawerTitle) : TXT.drawerTitle}
        width={1180}
        open={addOrderVisible}
        onClose={() => {
          setAddOrderVisible(false);
          setSelectedRoute(null);
          setSelectedUnitId('');
          setSelectedStockKeys([]);
          setAddOrderMode('SCAN');
        }}
        destroyOnClose
        extra={<Button type="primary" onClick={handleLoadOrders} disabled={!selectedAddOrderUnit || isDepartedUnit(selectedAddOrderUnit)}>提交</Button>}
      >
        {selectedRoute && (() => {
          const displayUnits = isSea ? selectedRoute.units.slice(0, 1) : selectedRoute.units;
          if (displayUnits.length === 0) {
            return <div style={{ padding: 16, background: '#fffbe6', borderRadius: 4 }}>{TXT.notCreated}</div>;
          }
          return (
            <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 140px)' }}>
              <div style={{ width: isSea ? 200 : 140, flexShrink: 0, borderRight: '1px solid #f0f0f0', paddingRight: 12, overflowY: 'auto' }}>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>{unitLabel}</Text>
                {displayUnits.map(function(unit) {
                  const active = selectedUnitId === unit.id;
                  return (
                    <div key={unit.id} onClick={function() { if (!isDepartedUnit(unit)) setSelectedUnitId(unit.id); }}
                      style={{ padding: '10px 12px', marginBottom: 6, borderRadius: 6, cursor: isDepartedUnit(unit) ? 'not-allowed' : 'pointer', opacity: isDepartedUnit(unit) ? 0.4 : 1, background: active ? '#e6f4ff' : '#fafafa', border: active ? '1px solid #1677ff' : '1px solid transparent' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{isSea ? toRealContainerNo(unit.unitNo) : unit.unitNo}</div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{formatNumber(toNumber(unit.loadedPieces), 0) + TXT.pcs}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Input value={availableKeyword} onChange={function(e) { setAvailableKeyword(e.target.value); }} placeholder={TXT.scanPlaceholder} allowClear prefix={<SearchOutlined />} style={{ marginBottom: 12 }} />
                {selectedAddOrderUnit ? (
                  <Descriptions size={'small'} column={isSea ? 4 : 3} style={{ marginBottom: 12 }}>
                    <Descriptions.Item label={unitLabel}>{isSea ? toRealContainerNo(selectedAddOrderUnit.unitNo) : selectedAddOrderUnit.unitNo}</Descriptions.Item>
                    {isSea ? <Descriptions.Item label={TXT.containerType}>{selectedAddOrderUnit.unitType}</Descriptions.Item> : null}
                    <Descriptions.Item label={TXT.weight}>{formatNumber(toNumber(selectedAddOrderUnit.currentWeight), 2) + ' KGS'}</Descriptions.Item>
                    <Descriptions.Item label={TXT.volume}>{formatNumber(toNumber(selectedAddOrderUnit.currentVolume), 2) + ' CBM'}</Descriptions.Item>
                  </Descriptions>
                ) : null}
                <Text strong style={{ display: 'block', marginBottom: 6 }}>{TXT.loaded + ' (' + selectedUnitOrders.length + ')'}</Text>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <Table rowKey={function(row) { return row.id; }} columns={stockColumns} dataSource={selectedUnitOrders} size={'small'} pagination={false} locale={{ emptyText: TXT.scanToAdd }} />
                </div>
              </div>
            </div>
          );
        })()}
      </Drawer>

      <Drawer
        title={selectedRoute ? `${selectedRoute.routeText} · 详情` : '详情'}
        width={1280}
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedRoute(null);
        }}
        destroyOnClose
      >
        {selectedRoute && (
          <>
            <Descriptions bordered size="small" column={4} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="线路">{selectedRoute.routeText}</Descriptions.Item>
              <Descriptions.Item label="服务类型">{selectedRoute.serviceType}</Descriptions.Item>
              <Descriptions.Item label="说明">{selectedRoute.cargoType}</Descriptions.Item>
              <Descriptions.Item label="站点">{selectedRoute.station}</Descriptions.Item>
              <Descriptions.Item label="体积CBM">{formatNumber(selectedRoute.totalVolume, 2)}</Descriptions.Item>
              <Descriptions.Item label="体积重KGS">{formatNumber(selectedRoute.volumeWeight, 2)}</Descriptions.Item>
              <Descriptions.Item label="毛重KGS">{formatNumber(selectedRoute.grossWeight, 2)}</Descriptions.Item>
              <Descriptions.Item label="件数">{formatNumber(selectedRoute.totalPieces, 0)}</Descriptions.Item>
            </Descriptions>

            {selectedRoute.taskExecution?.jobNo && (
              <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="任务号">{selectedRoute.taskExecution.jobNo}</Descriptions.Item>
                <Descriptions.Item label="发往姓名">{selectedRoute.taskExecution.recipientName || '-'}</Descriptions.Item>
                <Descriptions.Item label="发往电话">{selectedRoute.taskExecution.recipientPhone || '-'}</Descriptions.Item>
                <Descriptions.Item label="详细地址" span={3}>{selectedRoute.taskExecution.recipientAddress || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机名字">{selectedRoute.taskExecution.driverName || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机电话">{selectedRoute.taskExecution.driverPhone || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌号码">{selectedRoute.taskExecution.plateNo || '-'}</Descriptions.Item>
              </Descriptions>
            )}

            {isSea ? (
              <>
                {(() => {
                  const unit = selectedRoute.units[0];
                  if (!unit) return <Alert type="warning" showIcon message="暂无集装箱" />;
                  return (
                    <>
                      <Descriptions bordered size="small" column={4} style={{ marginBottom: 16 }}>
                        <Descriptions.Item label="集装箱号"><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{toRealContainerNo(unit.unitNo)}</span></Descriptions.Item>
                        <Descriptions.Item label="柜型">{unit.unitType}</Descriptions.Item>
                        <Descriptions.Item label="已装件数">{formatNumber(toNumber(unit.loadedPieces), 0)}</Descriptions.Item>
                        <Descriptions.Item label="毛重KGS">{formatNumber(toNumber(unit.currentWeight), 2)}</Descriptions.Item>
                      </Descriptions>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>已装订单（{selectedRoute.stockItems.filter((item) => item.shippingUnitId === unit.id).length}）</Text>
                      <Table
                        rowKey={(row) => row.id}
                        columns={stockColumns}
                        dataSource={selectedRoute.stockItems.filter((item) => item.shippingUnitId === unit.id)}
                        pagination={false}
                        size="small"
                        scroll={{ x: 1500 }}
                      />
                    </>
                  );
                })()}
              </>
            ) : (
              <Table
                rowKey="id"
                columns={[
                  {
                    title: '序号',
                    key: 'index',
                    width: 70,
                    render: (_: unknown, __: ShippingUnit, index: number) => index + 1,
                  },
                  {
                    title: '集装号',
                    dataIndex: 'unitNo',
                    width: 150,
                  },
                  {
                    title: '类型',
                    dataIndex: 'unitType',
                    width: 100,
                  },
                  {
                    title: '内件数',
                    width: 90,
                    align: 'right' as const,
                    render: (_: unknown, row: ShippingUnit) => formatNumber(toNumber(row.loadedPieces), 0),
                  },
                  {
                    title: '体积CBM',
                    width: 110,
                    align: 'right' as const,
                    render: (_: unknown, row: ShippingUnit) => formatNumber(toNumber(row.currentVolume), 2),
                  },
                  {
                    title: '体积重KGS',
                    width: 120,
                    align: 'right' as const,
                    render: (_: unknown, row: ShippingUnit) => formatNumber(calcVolumeWeight(toNumber(row.currentVolume)), 2),
                  },
                  {
                    title: '毛重KGS',
                    width: 110,
                    align: 'right' as const,
                    render: (_: unknown, row: ShippingUnit) => formatNumber(toNumber(row.currentWeight), 2),
                  },
                  {
                    title: '利用率',
                    width: 180,
                    render: (_: unknown, row: ShippingUnit) => (
                      <Progress
                        percent={Math.min(100, Number(getUnitUtilization(row).toFixed(0)))}
                        size="small"
                        status={getUnitUtilization(row) > 90 ? 'exception' : 'normal'}
                      />
                    ),
                  },
                ]}
                dataSource={selectedRoute.units}
                size="small"
                scroll={{ x: 1100 }}
                expandable={{
                  expandedRowRender: (unit: ShippingUnit) => (
                    <Table
                      rowKey={(row) => row.id}
                      columns={stockColumns}
                      dataSource={selectedRoute.stockItems.filter((item) => item.shippingUnitId === unit.id)}
                      pagination={false}
                      size="small"
                      scroll={{ x: 1500 }}
                    />
                  ),
                }}
              />
            )}
          </>
        )}
      </Drawer>

      <Modal
        title={selectedRoute ? `${selectedRoute.routeText} · 执行任务` : '执行任务'}
        open={executeTaskVisible}
        onOk={handleSubmitExecuteTask}
        onCancel={() => {
          setExecuteTaskVisible(false);
          executeTaskForm.resetFields();
        }}
        width={860}
        okText="确认"
        cancelText="返回"
        destroyOnClose
      >
        <Form form={executeTaskForm} layout="vertical">
          <Form.Item
            name="jobNo"
            label="选择任务"
            rules={[{ required: true, message: '请选择任务' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="请选择要执行的任务"
              options={taskOptions}
            />
          </Form.Item>

          {selectedExecuteJob && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions size="small" column={4}>
                <Descriptions.Item label="任务号">{selectedExecuteJob.jobNo}</Descriptions.Item>
                <Descriptions.Item label="线路">{selectedExecuteJob.route || '-'}</Descriptions.Item>
                <Descriptions.Item label="承运人">{selectedExecuteJob.carrier || '-'}</Descriptions.Item>
                <Descriptions.Item label="ETD">
                  {selectedExecuteJob.etd ? dayjs(selectedExecuteJob.etd).format('YYYY-MM-DD') : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="recipientName"
                label="发往地址姓名"
                rules={[{ required: true, message: '请输入发往地址姓名' }]}
              >
                <Input placeholder="如：刘生" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="recipientPhone"
                label="发往地址电话"
                rules={[{ required: true, message: '请输入发往地址电话' }]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="recipientAddress"
            label="发往详细地址"
            rules={[{ required: true, message: '请输入发往详细地址' }]}
          >
            <Input placeholder="请输入详细地址（港口/承运人仓库）" />
          </Form.Item>

          {/* 拖车公司信息 */}
          <div style={{ marginBottom: 8, color: '#595959', fontWeight: 500, fontSize: 13, borderLeft: '3px solid #1677ff', paddingLeft: 8 }}>
            拖车公司信息
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="deliveryCompany"
                label="拖车公司"
                tooltip="数据来源：基础设置 → 供应商管理（供应商类型 = 拖车公司）"
                rules={[{ required: true, message: '请选择拖车公司' }]}
              >
                <Select
                  placeholder="请选择拖车公司"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={truckingSuppliers.map((name) => ({ label: name, value: name }))}
                  notFoundContent={<span style={{ color: '#8c8c8c' }}>暂无拖车公司，请到基础设置 → 供应商管理新增</span>}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="trackingNo"
                label="送货单号"
              >
                <Input placeholder="拖车公司提供的送货单号（选填）" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="queryPhone"
            label="查询电话"
          >
            <Input placeholder="拖车公司客服/查询电话（选填）" />
          </Form.Item>

          {/* 司机与车辆信息 */}
          <div style={{ marginBottom: 8, color: '#595959', fontWeight: 500, fontSize: 13, borderLeft: '3px solid #1677ff', paddingLeft: 8 }}>
            司机与车辆
          </div>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="driverName"
                label="司机名字"
                rules={[{ required: true, message: '请输入司机名字' }]}
              >
                <Input placeholder="请输入司机名字" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="driverPhone"
                label="司机电话"
                rules={[{ required: true, message: '请输入司机电话' }]}
              >
                <Input placeholder="请输入司机电话" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="plateNo"
                label="车牌号码"
                rules={[{ required: true, message: '请输入车牌号码' }]}
              >
                <Input placeholder="请输入车牌号码" />
              </Form.Item>
            </Col>
          </Row>

          {/* 发货时间与备注 */}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="plannedDepartureTime"
                label="预计发货时间"
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                  placeholder="选择预计发货时间"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="发货备注（选填）" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
