import dayjs from 'dayjs';

export type BusinessMode = 'ALL' | 'SEA' | 'AIR';
export type DpnStatus = 'DRAFT' | 'PENDING_ASSIGN' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED' | 'CANCELLED';
export type DeliveryTaskStatus = 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED' | 'FAILED' | 'CANCELLED';
export type DeliveryMethod = 'SELF_PICKUP' | 'DELIVERY' | 'SATELLITE_STATION';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface DeliveryTaskRow {
  id: string;
  taskNo: string;
  taskStatus: DeliveryTaskStatus;
  dpnId: string;
  dpnNo: string;
  waybillNo: string;
  masterWaybillNo: string;
  dpnStatus: DpnStatus;
  businessLine: 'SEA' | 'AIR';
  deliveryMethod: DeliveryMethod;
  warehouseName: string;
  customerName: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  cityName: string;
  countryName: string;
  driverName: string;
  driverPhone: string;
  totalPieces: number;
  totalWeightKg: number;
  totalReceivableAmount: number;
  currencyCode: string;
  paymentStatus: PaymentStatus;
  itemCount: number;
  acceptedAt: string;
  signedAt: string;
  updatedAt: string;
  remark?: string;
  failureReasonCode?: string;
  failureReasonLabel?: string;
  failureRemark?: string;
  sourceType?: 'API' | 'MOCK';
}

export interface PickupRecord {
  id: string;
  pickupNo: string;
  trackingNo: string;
  recipientName: string;
  recipientPhone: string;
  pickupStation: string;
  pickupCode: string;
  paymentMethod: 'PREPAID' | 'COD';
  paymentStatus: 'PAID' | 'UNPAID';
  paymentAmount: number;
  currency: string;
  notifyStatus: 'PENDING' | 'NOTIFIED' | 'PICKED_UP';
  notifyTime: string | null;
  pickedUpTime: string | null;
  updatedAt: string;
  sourceType?: 'MOCK' | 'CONVERTED';
  sourceTaskNo?: string;
  dpnNo?: string;
  pickupRemark?: string;
}

export interface DeliveryTaskFilters {
  warehouseId?: string;
  businessLine?: 'SEA' | 'AIR';
  deliveryMethod?: DeliveryMethod | 'ALL';
  paymentStatus?: PaymentStatus | 'ALL';
  taskStatus?: DeliveryTaskStatus | 'ALL';
  keyword?: string;
}

interface DeliveryTaskOverride {
  hidden?: boolean;
  taskStatus?: DeliveryTaskStatus;
  dpnStatus?: DpnStatus;
  deliveryMethod?: DeliveryMethod;
  updatedAt?: string;
  failureReasonCode?: string;
  failureReasonLabel?: string;
  failureRemark?: string;
}

interface PodUiMockState {
  mockTasks: DeliveryTaskRow[];
  pickupRecords: PickupRecord[];
  overrides: Record<string, DeliveryTaskOverride>;
}

interface FailureReasonOption {
  value: string;
  label: string;
}

const STORAGE_KEY = 'mm-logistics-pod-ui-mock-state-v2';

export const DELIVERY_FAILURE_REASONS: FailureReasonOption[] = [
  { value: 'PHONE_UNREACHABLE', label: '收件人电话无法接通' },
  { value: 'ADDRESS_NOT_FOUND', label: '地址不详或无法定位' },
  { value: 'CUSTOMER_NOT_HOME', label: '收件人不在家/无人签收' },
  { value: 'CUSTOMER_RESCHEDULE', label: '客户要求改约时间' },
  { value: 'REFUSED_BY_CUSTOMER', label: '客户拒收' },
  { value: 'PAYMENT_NOT_READY', label: '到付金额未准备好' },
  { value: 'SECURITY_RESTRICTION', label: '园区/社区门禁限制' },
  { value: 'PACKAGE_DAMAGED', label: '包裹异常需回仓处理' },
];

export const PICKUP_STATION_OPTIONS = [
  'IKEJ STA',
  'ABUJ STA',
  'LEKKI STA',
  'YABA STA',
];

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const nowStamp = () => dayjs().format('YYYY-MM-DD HH:mm:ss');

const createMockDeliveryTasks = (): DeliveryTaskRow[] => {
  const now = dayjs();
  return [
    {
      id: 'MOCK-DTK-001',
      taskNo: 'S-D-20260320-9001',
      taskStatus: 'ACCEPTED',
      dpnId: 'MOCK-DPN-001',
      dpnNo: 'DPN-20260320-9001',
      waybillNo: 'S-20260320990001-01',
      masterWaybillNo: 'S-20260320990001',
      dpnStatus: 'ASSIGNED',
      businessLine: 'SEA',
      deliveryMethod: 'DELIVERY',
      warehouseName: '拉各斯到达仓',
      customerName: 'Lagos Fashion Hub',
      recipientName: 'Amina Yusuf',
      recipientPhone: '+234 803 555 2001',
      recipientAddress: 'No.16 Allen Avenue, Ikeja, Lagos',
      cityName: '拉各斯',
      countryName: 'Nigeria',
      driverName: 'Moses',
      driverPhone: '+234 802 100 8891',
      totalPieces: 2,
      totalWeightKg: 23.6,
      totalReceivableAmount: 18500,
      currencyCode: 'NGN',
      paymentStatus: 'UNPAID',
      itemCount: 2,
      acceptedAt: now.subtract(4, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      signedAt: '',
      updatedAt: now.subtract(35, 'minute').format('YYYY-MM-DD HH:mm:ss'),
      remark: 'Mock 配送任务，可演示配送完成/失败/转自提',
      sourceType: 'MOCK',
    },
    {
      id: 'MOCK-DTK-002',
      taskNo: 'A-D-20260320-9002',
      taskStatus: 'IN_TRANSIT',
      dpnId: 'MOCK-DPN-002',
      dpnNo: 'DPN-20260320-9002',
      waybillNo: 'S-20260320990001-02',
      masterWaybillNo: 'S-20260320990001',
      dpnStatus: 'IN_TRANSIT',
      businessLine: 'AIR',
      deliveryMethod: 'DELIVERY',
      warehouseName: '阿布贾到达仓',
      customerName: 'Abuja Electronics',
      recipientName: 'Chinedu Okafor',
      recipientPhone: '+234 809 200 4451',
      recipientAddress: 'Plot 8 Aminu Kano Crescent, Wuse 2, Abuja',
      cityName: '阿布贾',
      countryName: 'Nigeria',
      driverName: 'Ibrahim',
      driverPhone: '+234 806 728 3320',
      totalPieces: 1,
      totalWeightKg: 12.4,
      totalReceivableAmount: 300,
      currencyCode: 'CNY',
      paymentStatus: 'PAID',
      itemCount: 1,
      acceptedAt: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      signedAt: '',
      updatedAt: now.subtract(2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      remark: 'Mock 在途任务',
      sourceType: 'MOCK',
    },
    {
      id: 'MOCK-DTK-003',
      taskNo: 'S-D-20260320-9003',
      taskStatus: 'FAILED',
      dpnId: 'MOCK-DPN-003',
      dpnNo: 'DPN-20260320-9003',
      waybillNo: 'S-20260321990001-01',
      masterWaybillNo: 'S-20260321990001',
      dpnStatus: 'IN_TRANSIT',
      businessLine: 'SEA',
      deliveryMethod: 'DELIVERY',
      warehouseName: '拉各斯到达仓',
      customerName: 'Lekki Home Mall',
      recipientName: 'Temi Balogun',
      recipientPhone: '+234 805 330 1120',
      recipientAddress: 'House 24 Admiralty Way, Lekki Phase 1, Lagos',
      cityName: '拉各斯',
      countryName: 'Nigeria',
      driverName: 'Sola',
      driverPhone: '+234 813 991 7752',
      totalPieces: 3,
      totalWeightKg: 31.2,
      totalReceivableAmount: 26000,
      currencyCode: 'NGN',
      paymentStatus: 'PARTIAL',
      itemCount: 3,
      acceptedAt: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
      signedAt: '',
      updatedAt: now.subtract(5, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      remark: 'FAILED:收件人电话无法接通 | 备注:司机到场两次无人接听',
      failureReasonCode: 'PHONE_UNREACHABLE',
      failureReasonLabel: '收件人电话无法接通',
      failureRemark: '司机到场两次无人接听',
      sourceType: 'MOCK',
    },
  ];
};

const createMockPickupRecords = (): PickupRecord[] => {
  const now = dayjs();
  return [
    {
      id: 'MOCK-PUP-001',
      pickupNo: `P-${now.format('YYYYMMDD')}-0901`,
      trackingNo: 'S-202603190041-01',
      recipientName: 'Ada Nwosu',
      recipientPhone: '+234 903 832 1727',
      pickupStation: 'IKEJ STA',
      pickupCode: 'PK6901',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
      paymentAmount: 12000,
      currency: 'NGN',
      notifyStatus: 'NOTIFIED',
      notifyTime: now.subtract(3, 'hour').format('YYYY/MM/DD HH:mm:ss'),
      pickedUpTime: null,
      updatedAt: now.subtract(3, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      sourceType: 'MOCK',
      dpnNo: 'DPN-20260319-8801',
      pickupRemark: '客户已确认周五到站自提',
    },
    {
      id: 'MOCK-PUP-002',
      pickupNo: `P-${now.subtract(1, 'day').format('YYYYMMDD')}-0902`,
      trackingNo: 'A-202603190042-01',
      recipientName: 'Emeka Eze',
      recipientPhone: '+234 810 554 7820',
      pickupStation: 'ABUJ STA',
      pickupCode: 'PK6902',
      paymentMethod: 'PREPAID',
      paymentStatus: 'PAID',
      paymentAmount: 0,
      currency: 'CNY',
      notifyStatus: 'PICKED_UP',
      notifyTime: now.subtract(1, 'day').format('YYYY/MM/DD HH:mm:ss'),
      pickedUpTime: now.subtract(18, 'hour').format('YYYY/MM/DD HH:mm:ss'),
      updatedAt: now.subtract(18, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      sourceType: 'MOCK',
      dpnNo: 'DPN-20260319-8802',
      pickupRemark: '已完成自提核销',
    },
  ];
};

const defaultState = (): PodUiMockState => ({
  mockTasks: createMockDeliveryTasks(),
  pickupRecords: createMockPickupRecords(),
  overrides: {},
});

const normalizeState = (raw: unknown): PodUiMockState => {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;
  const value = raw as Partial<PodUiMockState>;

  const mockTaskFallbackMap = new Map(base.mockTasks.map((item) => [item.id, item]));
  const pickupFallbackMap = new Map(base.pickupRecords.map((item) => [item.id, item]));

  const normalizedMockTasks = Array.isArray(value.mockTasks)
    ? (value.mockTasks as DeliveryTaskRow[]).map((item) => {
      const fallback = mockTaskFallbackMap.get(item.id);
      return fallback ? { ...fallback, ...item } : item;
    })
    : base.mockTasks;

  const normalizedPickupRecords = Array.isArray(value.pickupRecords)
    ? (value.pickupRecords as PickupRecord[]).map((item) => {
      const fallback = pickupFallbackMap.get(item.id);
      return fallback ? { ...fallback, ...item } : item;
    })
    : base.pickupRecords;

  return {
    mockTasks: normalizedMockTasks,
    pickupRecords: normalizedPickupRecords,
    overrides: value.overrides && typeof value.overrides === 'object' ? value.overrides as Record<string, DeliveryTaskOverride> : {},
  };
};

const loadState = (): PodUiMockState => {
  if (!canUseStorage()) return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = defaultState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return normalizeState(JSON.parse(raw));
  } catch (_error) {
    return defaultState();
  }
};

const saveState = (state: PodUiMockState) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const updateState = (updater: (draft: PodUiMockState) => PodUiMockState): PodUiMockState => {
  const next = updater(loadState());
  saveState(next);
  return next;
};

const parseFailureFromRemark = (remark?: string) => {
  const text = String(remark || '');
  const reasonMatch = text.match(/FAILED:([^|]+)/);
  const detailMatch = text.match(/备注:([^|]+)/);
  return {
    failureReasonLabel: reasonMatch?.[1]?.trim(),
    failureRemark: detailMatch?.[1]?.trim(),
  };
};

const applyOverride = (row: DeliveryTaskRow, override?: DeliveryTaskOverride): DeliveryTaskRow => {
  const parsed = parseFailureFromRemark(row.remark);
  return {
    ...row,
    failureReasonLabel: override?.failureReasonLabel || row.failureReasonLabel || parsed.failureReasonLabel,
    failureRemark: override?.failureRemark || row.failureRemark || parsed.failureRemark,
    failureReasonCode: override?.failureReasonCode || row.failureReasonCode,
    taskStatus: override?.taskStatus || row.taskStatus,
    dpnStatus: override?.dpnStatus || row.dpnStatus,
    deliveryMethod: override?.deliveryMethod || row.deliveryMethod,
    updatedAt: override?.updatedAt || row.updatedAt,
  };
};

const matchesDeliveryTaskFilters = (row: DeliveryTaskRow, filters?: DeliveryTaskFilters) => {
  if (!filters) return true;
  if (filters.businessLine && row.businessLine !== filters.businessLine) return false;
  if (filters.deliveryMethod && filters.deliveryMethod !== 'ALL' && row.deliveryMethod !== filters.deliveryMethod) return false;
  if (filters.paymentStatus && filters.paymentStatus !== 'ALL' && row.paymentStatus !== filters.paymentStatus) return false;
  if (filters.taskStatus && filters.taskStatus !== 'ALL' && row.taskStatus !== filters.taskStatus) return false;
  if (filters.warehouseId) {
    const rawWarehouse = String(row.warehouseName || '').toLowerCase();
    if (!rawWarehouse.includes(String(filters.warehouseId).toLowerCase())) return false;
  }
  const kw = String(filters.keyword || '').trim().toLowerCase();
  if (!kw) return true;
  return [
    row.taskNo,
    row.dpnNo,
    row.waybillNo,
    row.masterWaybillNo,
    row.customerName,
    row.recipientName,
    row.recipientPhone,
    row.recipientAddress,
    row.cityName,
    row.countryName,
    row.failureReasonLabel,
    row.failureRemark,
  ].some((field) => String(field || '').toLowerCase().includes(kw));
};

export const buildDeliveryTaskRows = (apiRows: DeliveryTaskRow[], filters?: DeliveryTaskFilters): DeliveryTaskRow[] => {
  const state = loadState();

  const mergedMockRows = state.mockTasks
    .map((row) => applyOverride(row, state.overrides[row.id]))
    .filter((row) => !state.overrides[row.id]?.hidden)
    .filter((row) => matchesDeliveryTaskFilters(row, filters))
    .map((row) => ({ ...row, sourceType: row.sourceType || 'MOCK' as const }));

  const mergedApiRows = apiRows
    .map((row) => applyOverride({ ...row, sourceType: row.sourceType || 'API' }, state.overrides[row.id]))
    .filter((row) => !state.overrides[row.id]?.hidden);

  const seen = new Set<string>();
  return [...mergedMockRows, ...mergedApiRows]
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf());
};

export const listPickupRecords = (): PickupRecord[] => {
  const state = loadState();
  return [...state.pickupRecords].sort((a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf());
};

export const markPickupNotified = (id: string): PickupRecord[] => {
  const next = updateState((state) => ({
    ...state,
    pickupRecords: state.pickupRecords.map((item) => (
      item.id === id
        ? {
          ...item,
          notifyStatus: 'NOTIFIED',
          notifyTime: dayjs().format('YYYY/MM/DD HH:mm:ss'),
          updatedAt: nowStamp(),
        }
        : item
    )),
  }));
  return [...next.pickupRecords];
};

export const markPickupCompleted = (id: string): PickupRecord[] => {
  const next = updateState((state) => ({
    ...state,
    pickupRecords: state.pickupRecords.map((item) => (
      item.id === id
        ? {
          ...item,
          notifyStatus: 'PICKED_UP',
          pickedUpTime: dayjs().format('YYYY/MM/DD HH:mm:ss'),
          updatedAt: nowStamp(),
        }
        : item
    )),
  }));
  return [...next.pickupRecords];
};

export const markDeliveryTaskFailed = (
  row: DeliveryTaskRow,
  reason: FailureReasonOption,
  remark?: string,
) => {
  updateState((state) => ({
    ...state,
    overrides: {
      ...state.overrides,
      [row.id]: {
        ...state.overrides[row.id],
        taskStatus: 'FAILED',
        dpnStatus: 'IN_TRANSIT',
        updatedAt: nowStamp(),
        failureReasonCode: reason.value,
        failureReasonLabel: reason.label,
        failureRemark: String(remark || '').trim() || undefined,
      },
    },
    mockTasks: state.mockTasks.map((item) => (
      item.id === row.id
        ? {
          ...item,
          taskStatus: 'FAILED',
          dpnStatus: 'IN_TRANSIT',
          updatedAt: nowStamp(),
          failureReasonCode: reason.value,
          failureReasonLabel: reason.label,
          failureRemark: String(remark || '').trim() || undefined,
          remark: [
            `FAILED:${reason.label}`,
            String(remark || '').trim() ? `备注:${String(remark || '').trim()}` : '',
          ].filter(Boolean).join(' | '),
        }
        : item
    )),
  }));
};

export const markDeliveryTaskCompleted = (row: DeliveryTaskRow) => {
  updateState((state) => ({
    ...state,
    overrides: {
      ...state.overrides,
      [row.id]: {
        ...state.overrides[row.id],
        taskStatus: 'SIGNED',
        dpnStatus: 'SIGNED',
        updatedAt: nowStamp(),
      },
    },
    mockTasks: state.mockTasks.map((item) => (
      item.id === row.id
        ? {
          ...item,
          taskStatus: 'SIGNED',
          dpnStatus: 'SIGNED',
          signedAt: nowStamp(),
          updatedAt: nowStamp(),
        }
        : item
    )),
  }));
};

export const convertDeliveryTaskToPickup = (
  row: DeliveryTaskRow,
  pickupStation: string,
  pickupRemark?: string,
) => {
  const now = dayjs();
  const pickupId = `CONVERTED-${row.id}`;
  const pickupNo = `P-${now.format('YYYYMMDD')}-${row.taskNo.slice(-4).padStart(4, '0')}`;
  const pickupCode = `PK${row.taskNo.slice(-4).padStart(4, '0')}`;

  updateState((state) => {
    const nextPickup: PickupRecord = {
      id: pickupId,
      pickupNo,
      trackingNo: row.taskNo,
      recipientName: row.recipientName,
      recipientPhone: row.recipientPhone,
      pickupStation,
      pickupCode,
      paymentMethod: row.paymentStatus === 'UNPAID' ? 'COD' : 'PREPAID',
      paymentStatus: row.paymentStatus === 'UNPAID' ? 'UNPAID' : 'PAID',
      paymentAmount: row.paymentStatus === 'UNPAID' ? row.totalReceivableAmount : 0,
      currency: row.currencyCode,
      notifyStatus: 'NOTIFIED',
      notifyTime: now.format('YYYY/MM/DD HH:mm:ss'),
      pickedUpTime: null,
      updatedAt: now.format('YYYY-MM-DD HH:mm:ss'),
      sourceType: 'CONVERTED',
      sourceTaskNo: row.taskNo,
      dpnNo: row.dpnNo,
      pickupRemark: String(pickupRemark || '').trim() || `由配送任务 ${row.taskNo} 转为自提`,
    };

    const pickupRecords = [
      nextPickup,
      ...state.pickupRecords.filter((item) => item.id !== pickupId),
    ];

    return {
      ...state,
      pickupRecords,
      overrides: {
        ...state.overrides,
        [row.id]: {
          ...state.overrides[row.id],
          hidden: true,
          deliveryMethod: 'SELF_PICKUP',
          updatedAt: now.format('YYYY-MM-DD HH:mm:ss'),
        },
      },
      mockTasks: state.mockTasks.map((item) => (
        item.id === row.id
          ? {
            ...item,
            deliveryMethod: 'SELF_PICKUP',
            updatedAt: now.format('YYYY-MM-DD HH:mm:ss'),
          }
          : item
      )),
    };
  });
};
