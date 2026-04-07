/**
 * 订单列表 - 主订单管理
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Card, Table, Tag, Space, Button, Input, Select, DatePicker,
  message, Modal, Row, Col, Typography, Form, Divider
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  DeleteOutlined, EyeOutlined, AuditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

// 导入类型和数据
import type { MasterOrder } from '../../types/order';
import { MASTER_ORDER_STATUS_CONFIG } from '../../types/order';
import { v2OmsApi } from '../../api';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../components/ListPageToolbar';
import { mapV2OrderRowToMasterOrder } from './orderV2Mapper';
import MasterOrderDetailDrawer from './MasterOrderDetailDrawer';
import MasterOrderEditModal from './MasterOrderEditModal';
import { OrderCreate } from './OrderCreate';
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

// 目的地代码 → 中文名映射
const COUNTRY_NAME_MAP: Record<string, string> = {
  NGA: '尼日利亚', GHA: '加纳', CN: '中国', US: '美国', GB: '英国', JP: '日本',
  'CTRY-NG': '尼日利亚', 'CTRY-GH': '加纳', 'CTRY-CN': '中国',
  '尼日利亚': '尼日利亚', '加纳': '加纳', '中国': '中国', '美国': '美国', '英国': '英国',
};
const CITY_NAME_MAP: Record<string, string> = {
  LOS: '拉各斯', ABJ: '阿布贾', ACC: '阿克拉', SZX: '深圳', CAN: '广州', HKG: '香港',
  'CITY-LOS': '拉各斯', 'CITY-ABJ': '阿布贾', 'CITY-ACC': '阿克拉',
  'CITY-SZ': '深圳', 'CITY-GZ': '广州',
  '拉各斯': '拉各斯', '深圳': '深圳', '广州': '广州',
};
function resolveGeoName(code: string, map: Record<string, string>): string {
  if (!code || code === '-') return '-';
  return map[code] || map[code.toUpperCase()] || code;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PREPAID: '预付',
  COD: '到付',
  CREDIT_CARD: '信用卡',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: '未付',
  PARTIAL: '部分付',
  PAID: '已付',
};

const SUB_ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_INBOUND: '待入库',
  INBOUND: '已入库',
  PENDING_PACKING: '待集装',
  PACKED: '已集装',
  PENDING_DEPARTURE: '待发运',
  IN_TRANSIT: '运输中',
  CUSTOMS_CLEARANCE: '清关中',
  ARRIVED: '已到港',
  PENDING_DELIVERY: '待派送',
  DELIVERING: '派送中',
  DELIVERED: '已签收',
  EXCEPTION: '异常',
  RETURN_APPLIED: '退单申请中',
  CANCELLED: '已取消',
};

const SUB_ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING_INBOUND: 'warning',
  INBOUND: 'cyan',
  PENDING_PACKING: 'gold',
  PACKED: 'processing',
  PENDING_DEPARTURE: 'orange',
  IN_TRANSIT: 'geekblue',
  CUSTOMS_CLEARANCE: 'purple',
  ARRIVED: 'blue',
  PENDING_DELIVERY: 'lime',
  DELIVERING: 'green',
  DELIVERED: 'success',
  EXCEPTION: 'error',
  RETURN_APPLIED: 'volcano',
  CANCELLED: 'default',
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  STANDARD_AIR: '普快(空运)',
  EXPRESS_AIR: '特快(空运)',
  LCL_SEA: '拼柜(海运)',
  FCL_SEA: '整柜(海运)',
};

const parseRouteMeta = (routeCode?: string) => {
  const raw = String(routeCode || '').trim();
  if (!raw) {
    return { countryCode: '', cityCode: '', siteCode: '' };
  }
  const normalized = raw.replace('->', '→');
  const target = normalized.includes('→') ? normalized.split('→')[1] : normalized;
  const parts = target.split('.').map((part) => part.trim()).filter(Boolean);
  const cityCode = (parts[0] || '').toUpperCase();
  const countryCode = (parts[1] || '').toUpperCase();
  return {
    countryCode,
    cityCode,
    siteCode: cityCode ? `${cityCode}.STA` : '',
  };
};

export default function OrderListV2({ businessMode = 'ALL' }: { businessMode?: 'ALL' | 'AIR' | 'SEA' }) {
  type MasterOrderListItem = MasterOrder & { subOrderCount?: number };
  type ExpandedSubOrderRow = {
    id: string;
    subOrderNo: string;
    parentOrderNo: string;
    thirdPartyTracking: string;
    description: string;
    chargeableWeight: number;
    pieces: number;
    orderDate: string;
    updatedAt: string;
    status: string;
  };
  type MasterOrderRow = MasterOrderListItem & {
    calculatedStatus: MasterOrder['status'];
    subOrderCount: number;
    transportTypes: Array<'SEA' | 'AIR'>;
    routes: string[];
    serviceTypes: string[];
    primaryTransportType?: 'SEA' | 'AIR';
    destinationCountry: string;
    destinationCity: string;
    siteCode: string;
    searchCorpus: string;
  };

  // 状态管理
  const [orders, setOrders] = useState<MasterOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MasterOrder | null>(null);
  const [cancelForm] = Form.useForm();
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<MasterOrder | null>(null);
  const [reviewForm] = Form.useForm();
  const [reviewResult, setReviewResult] = useState('');

  // 筛选状态
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [paymentFilter, setPaymentFilter] = useState<string | undefined>(undefined);
  const [salesFilter, setSalesFilter] = useState<string | undefined>(undefined);
  const [currencyFilter, setCurrencyFilter] = useState<string | undefined>(undefined);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | undefined>(undefined);
  const [cityFilter, setCityFilter] = useState<string | undefined>(undefined);
  const [siteFilter, setSiteFilter] = useState<string | undefined>(undefined);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'COLLAPSED' | 'EXPANDED'>('COLLAPSED');
  const [expandedRowKeys, setExpandedRowKeys] = useState<Array<string | number>>([]);
  const [subOrdersByOrderId, setSubOrdersByOrderId] = useState<Record<string, ExpandedSubOrderRow[]>>({});
  const [subOrderLoadingByOrderId, setSubOrderLoadingByOrderId] = useState<Record<string, boolean>>({});
  const [billNoFilter, setBillNoFilter] = useState('');
  const [trackingNoFilter, setTrackingNoFilter] = useState('');
  const [contactPhoneFilter, setContactPhoneFilter] = useState('');

  // 加载数据
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const masterRes = await v2OmsApi.listOrders({
        page: 1,
        pageSize: 500,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
      }) as any;
      const rows = Array.isArray(masterRes.data) ? masterRes.data : [];
      const mapped = rows.map((row: any) => ({
        ...mapV2OrderRowToMasterOrder(row),
        subOrderCount: Number(row.sub_order_count || 0),
      })) as MasterOrderListItem[];
      setOrders(mapped);
    } catch (error: any) {
      message.error(error.message || '加载订单数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [businessMode]);

  // 计算主订单的实时状态和运输信息
  const ordersWithStatus = useMemo<MasterOrderRow[]>(() => {
    return orders.map(order => {
      const calculatedStatus = order.status;
      const transportTypes = order.transportType ? [order.transportType] as Array<'SEA' | 'AIR'> : [];
      const routes = [order.routeCode].filter(Boolean) as string[];
      const serviceTypes = [order.serviceType].filter(Boolean) as string[];
      const primaryTransportType = order.transportType || transportTypes[0];
      const routeMeta = parseRouteMeta(order.routeCode);
      const destinationCountry = routeMeta.countryCode || String(order.destCountry || '').toUpperCase();
      const destinationCity = routeMeta.cityCode || String(order.destCity || '').toUpperCase();
      const siteCode = routeMeta.siteCode || (destinationCity ? `${destinationCity}.STA` : '');
      const searchCorpus = [
        order.orderNo,
        order.customerName,
        order.customerId,
        order.consignee,
        order.consigneePhone,
        order.sender,
        order.senderPhone,
        order.salesPerson,
        order.routeCode,
        order.warehouseEntryNo,
        String((order as any).billNo || (order as any).bill_no || ''),
        String((order as any).trackingNo || (order as any).tracking_no || ''),
        destinationCountry,
        destinationCity,
        siteCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return {
        ...order,
        calculatedStatus,
        subOrderCount: Number((order as any).subOrderCount || 0),
        transportTypes,
        routes,
        serviceTypes,
        primaryTransportType,
        destinationCountry,
        destinationCity,
        siteCode,
        searchCorpus,
      };
    });
  }, [orders]);

  useEffect(() => {
    setCityFilter(undefined);
    setSiteFilter(undefined);
  }, [countryFilter]);

  useEffect(() => {
    setSiteFilter(undefined);
  }, [cityFilter]);

  useEffect(() => {
    if (viewMode === 'COLLAPSED') {
      setExpandedRowKeys([]);
    }
  }, [viewMode]);

  const salesOptions = useMemo(
    () => [...new Set(ordersWithStatus.map(order => order.salesPerson).filter(Boolean))] as string[],
    [ordersWithStatus]
  );
  const currencyOptions = useMemo(
    () => [...new Set(ordersWithStatus.map(order => order.currency).filter(Boolean))] as string[],
    [ordersWithStatus]
  );
  const serviceTypeOptions = useMemo(
    () => [...new Set(ordersWithStatus.flatMap(order => order.serviceTypes || []).filter(Boolean))] as string[],
    [ordersWithStatus]
  );
  const countryOptions = useMemo(() => {
    const map = new Map<string, string>();
    ordersWithStatus.forEach((order) => {
      const code = String(order.destinationCountry || '').trim();
      if (!code) return;
      map.set(code, code);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [ordersWithStatus]);

  const cityOptions = useMemo(() => {
    const map = new Map<string, string>();
    ordersWithStatus.forEach((order) => {
      if (countryFilter && order.destinationCountry !== countryFilter) return;
      const city = String(order.destinationCity || '').trim();
      if (!city) return;
      map.set(city, city);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [ordersWithStatus, countryFilter]);

  const siteOptions = useMemo(() => {
    const map = new Map<string, string>();
    ordersWithStatus.forEach((order) => {
      if (countryFilter && order.destinationCountry !== countryFilter) return;
      if (cityFilter && order.destinationCity !== cityFilter) return;
      const site = String(order.siteCode || '').trim();
      if (!site) return;
      map.set(site, site);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [ordersWithStatus, countryFilter, cityFilter]);

  const fetchSubOrdersForOrder = async (orderId: string, parentOrderNo: string) => {
    if (subOrdersByOrderId[orderId]) return;
    setSubOrderLoadingByOrderId((prev) => ({ ...prev, [orderId]: true }));
    try {
      const fullRes = await v2OmsApi.getOrderFull(orderId) as any;
      const payload = fullRes?.data || fullRes || {};
      const subOrders = Array.isArray(payload.subOrders) ? payload.subOrders : [];
      const initialPackages = Array.isArray(payload.initialPackages) ? payload.initialPackages : [];
      const actualPackages = Array.isArray(payload.actualPackages) ? payload.actualPackages : [];
      const packageSource = [...actualPackages, ...initialPackages];
      const pkgBySubOrderId = packageSource.reduce((acc: Record<string, any>, pkg: any) => {
        const key = String(pkg.sub_order_id || '').trim();
        if (!key || acc[key]) return acc;
        acc[key] = pkg;
        return acc;
      }, {});

      const mapped: ExpandedSubOrderRow[] = subOrders.map((sub: any, index: number) => {
        const subId = String(sub.id);
        const matchedPkg = pkgBySubOrderId[subId];
        const expressCompany = matchedPkg?.express_company ? `${matchedPkg.express_company} ` : '';
        const trackingNo = matchedPkg?.tracking_no || '-';
        const subOrderNo = String(sub.sub_order_no || '').trim() || '-';
        return {
          id: subId || `${orderId}-${index + 1}`,
          subOrderNo,
          parentOrderNo,
          thirdPartyTracking: `${expressCompany}${trackingNo}`.trim(),
          description: matchedPkg?.cargo_desc || '-',
          chargeableWeight: Number(sub.chargeable_weight_kg || sub.actual_weight_kg || matchedPkg?.declared_weight_kg || 0),
          pieces: Number(sub.pieces || matchedPkg?.pieces || 0),
          orderDate: sub.created_at || '',
          updatedAt: sub.updated_at || '',
          status: String(sub.sub_status || ''),
        };
      });

      setSubOrdersByOrderId((prev) => ({ ...prev, [orderId]: mapped }));
    } catch (error: any) {
      message.error(error.message || '加载子订单失败');
      setSubOrdersByOrderId((prev) => ({ ...prev, [orderId]: [] }));
    } finally {
      setSubOrderLoadingByOrderId((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // 筛选数据
  const filteredOrders = useMemo(() => {
    let result = ordersWithStatus;

    // 业务线过滤
    if (businessMode !== 'ALL') {
      result = result.filter(order => {
        if (order.primaryTransportType) return order.primaryTransportType === businessMode;
        return order.transportTypes.includes(businessMode);
      });
    }

    // 搜索过滤
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(order => order.searchCorpus.includes(search));
    }
    if (billNoFilter) {
      const search = billNoFilter.trim().toLowerCase();
      result = result.filter(order => order.searchCorpus.includes(search));
    }
    if (trackingNoFilter) {
      const search = trackingNoFilter.trim().toLowerCase();
      result = result.filter(order => order.searchCorpus.includes(search));
    }
    if (contactPhoneFilter) {
      const search = contactPhoneFilter.trim().toLowerCase();
      result = result.filter(order => order.searchCorpus.includes(search));
    }

    // 状态过滤
    if (statusFilter) {
      if (statusFilter === 'RETURN') {
        result = result.filter(order => ['RETURN_APPLIED', 'CANCELLED'].includes(order.calculatedStatus));
      } else {
        result = result.filter(order => order.calculatedStatus === statusFilter);
      }
    }

    // 支付状态过滤
    if (paymentFilter) {
      result = result.filter(order => order.paymentStatus === paymentFilter);
    }

    // 业务员过滤
    if (salesFilter) {
      result = result.filter(order => order.salesPerson === salesFilter);
    }

    // 币种过滤
    if (currencyFilter) {
      result = result.filter(order => order.currency === currencyFilter);
    }

    // 服务类型过滤
    if (serviceTypeFilter) {
      result = result.filter(order => (order.serviceTypes || []).includes(serviceTypeFilter));
    }

    // 国家/城市/站点过滤
    if (countryFilter) {
      result = result.filter(order => order.destinationCountry === countryFilter);
    }
    if (cityFilter) {
      result = result.filter(order => order.destinationCity === cityFilter);
    }
    if (siteFilter) {
      result = result.filter(order => order.siteCode === siteFilter);
    }

    // 日期范围过滤
    if (dateRange) {
      const [start, end] = dateRange;
      const startTime = start.startOf('day');
      const endTime = end.endOf('day');
      result = result.filter(order => {
        const orderDate = dayjs(order.createdAt);
        return !orderDate.isBefore(startTime) && !orderDate.isAfter(endTime);
      });
    }

    return result;
  }, [
    ordersWithStatus,
    businessMode,
    searchText,
    statusFilter,
    paymentFilter,
    salesFilter,
    currencyFilter,
    serviceTypeFilter,
    countryFilter,
    cityFilter,
    siteFilter,
    billNoFilter,
    trackingNoFilter,
    contactPhoneFilter,
    dateRange,
  ]);

  // 处理订单更新
  const handleOrderUpdate = async (orderId: string, updates: Partial<MasterOrder>) => {
    try {
      await v2OmsApi.updateOrder(orderId, updates);
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, ...updates } : order
        )
      );

      // 更新选中的订单
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, ...updates } : null);
      }

      message.success('订单更新成功');
    } catch (error: any) {
      message.error(error.message || '订单更新失败');
    }
  };

  // 处理新建订单
  const handleCreate = () => {
    setCreateModalOpen(true);
  };

  // 处理创建订单提交
  const handleCreateSubmit = async (values: any) => {
    try {
      if (!values.customerId) {
        message.error('请选择已有客户');
        return;
      }
      const reqPayload = {
        customerId: values.customerId,
        orderSource: 'SALES_ASSIST',
        businessLine: values.transportType,
        serviceTypeCode: values.serviceType,
        salesUserId: 'U-SALES-01',
        creatorUserId: 'U-SALES-01',
        routeId: values.routeId,
        routeCode: values.routeCode,
        warehouseEntryNo: values.warehouseEntryNo,
        exportMode: values.exportMode,
        currencyCode: values.currency,
        senderProfileId: values.senderProfileId,
        recipientAddressId: values.recipientAddressId,
        senderName: values.sender,
        senderPhone: values.senderPhone,
        senderAddress: values.senderAddress,
        senderCityId: values.senderCityId,
        senderCountryId: values.senderCountryId,
        consigneeName: values.consignee,
        consigneePhone: values.consigneePhone,
        consigneeEmail: values.consigneeEmail,
        consigneeAddress: values.destAddress,
        consigneeCityId: values.consigneeCityId,
        consigneeCountryId: values.consigneeCountryId,
        remark: values.remark,
        packages: (values.expressPackages || []).map((pkg: any) => ({
          expressCompany: pkg.courier,
          trackingNo: pkg.trackingNo,
          goodsName: pkg.itemName,
          goodsCategory: pkg.category,
          cargoDesc: pkg.cargoType,
          declaredWeightKg: Number(pkg.weight || 0),
          pieces: Number(pkg.pieces || 0),
          declaredValueUsd: Number(pkg.declaredValue || 0),
          remark: pkg.remark,
        })),
      };

      const res = await v2OmsApi.createOrder(reqPayload) as any;
      const orderRow = res?.data?.order;
      if (orderRow) {
        const newOrder = {
          ...mapV2OrderRowToMasterOrder(orderRow),
          subOrderCount: Number(res?.data?.subOrders?.length || 0),
        } as MasterOrderListItem;
        setOrders(prev => [newOrder, ...prev]);
      } else {
        // 如果API未返回完整数据，刷新列表
        fetchOrders();
      }
      setCreateModalOpen(false);
      message.success('订单创建成功');
    } catch (error: any) {
      message.error(error.message || '订单创建失败');
    }
  };

  // 处理编辑订单
  const handleEdit = (order: MasterOrder) => {
    setSelectedOrder(order);
    setEditModalOpen(true);
  };

  // 处理查看详情
  const handleView = (order: MasterOrder) => {
    setSelectedOrder(order);
    setDetailDrawerOpen(true);
  };

  // 打开取消订单 Modal
  const handleCancelClick = (order: MasterOrder) => {
    setSelectedOrder(order);
    setCancelModalOpen(true);
  };

  // 确认取消订单
  const handleCancelConfirm = () => {
    cancelForm.validateFields().then(async (values) => {
      if (selectedOrder) {
        try {
          await v2OmsApi.updateOrder(selectedOrder.id, {
            status: 'CANCELLED',
            remark: values.cancelReason,
          });
          setOrders(prevOrders =>
            prevOrders.map(order =>
              order.id === selectedOrder.id
                ? {
                    ...order,
                    status: 'CANCELLED' as any,
                    remark: values.cancelReason
                  }
                : order
            )
          );
          message.success('订单已取消');
          setCancelModalOpen(false);
          cancelForm.resetFields();
          setSelectedOrder(null);
        } catch (error: any) {
          message.error(error.message || '取消订单失败');
        }
      }
    });
  };

  // 重置筛选
  const handleReset = () => {
    setSearchText('');
    setStatusFilter(undefined);
    setPaymentFilter(undefined);
    setSalesFilter(undefined);
    setCurrencyFilter(undefined);
    setServiceTypeFilter(undefined);
    setCountryFilter(undefined);
    setCityFilter(undefined);
    setSiteFilter(undefined);
    setDateRange(null);
    setBillNoFilter('');
    setTrackingNoFilter('');
    setContactPhoneFilter('');
    setShowAdvancedFilters(false);
    setViewMode('COLLAPSED');
    setExpandedRowKeys([]);
  };

  const subOrderColumns: ColumnsType<ExpandedSubOrderRow> = [
    {
      title: '子运单号',
      dataIndex: 'subOrderNo',
      key: 'subOrderNo',
      width: 180,
      fixed: 'left',
    },
    {
      title: '主运单号',
      dataIndex: 'parentOrderNo',
      key: 'parentOrderNo',
      width: 180,
    },
    {
      title: '第三方运单',
      dataIndex: 'thirdPartyTracking',
      key: 'thirdPartyTracking',
      width: 200,
    },
    {
      title: '货物信息',
      dataIndex: 'description',
      key: 'description',
      width: 220,
      render: (value: string) => value || '-',
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 90,
      align: 'right',
    },
    {
      title: '计费重量(kg)',
      dataIndex: 'chargeableWeight',
      key: 'chargeableWeight',
      width: 130,
      align: 'right',
      render: (value: number) => Number(value || 0).toFixed(2),
    },
    {
      title: '子单状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: string) => (
        <Tag color={SUB_ORDER_STATUS_COLOR[value] || 'default'}>
          {SUB_ORDER_STATUS_LABEL[value] || value || '-'}
        </Tag>
      ),
    },
    {
      title: '下单日期',
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 170,
      render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '更新日期',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  // 表格列定义
  const columns: ColumnsType<MasterOrderRow> = [
    {
      title: '运单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 160,
      fixed: 'left',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <a
            onClick={() => handleView(record)}
            style={{ fontWeight: 500 }}
          >
            {text}
          </a>
          {record.subOrderCount > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.subOrderCount}个子单
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 120,
    },
    ...(viewMode === 'EXPANDED'
      ? [
          {
            title: '站点代码',
            dataIndex: 'siteCode',
            key: 'siteCode',
            width: 120,
            render: (value: string) => value || '-',
          },
          {
            title: '路线',
            key: 'routeCode',
            width: 220,
            render: (_: unknown, record: MasterOrderRow) => record.routeCode || record.routes?.[0] || '-',
          },
        ]
      : [
          {
            title: '目的地',
            key: 'destination',
            width: 180,
            render: (_: unknown, record: MasterOrderRow) => (
              <Text>{record.routeCode || record.routes?.[0] || '-'}</Text>
            ),
          },
        ]),
    {
      title: '运输方式',
      key: 'transportType',
      width: 90,
      render: (_: unknown, record: MasterOrderRow) => (
        <Space size={4}>
          {record.transportTypes.length > 0 ? (
            record.transportTypes.map((type: string, idx: number) => (
              <Tag key={idx} color={type === 'SEA' ? 'blue' : 'orange'}>
                {type === 'SEA' ? '海运' : '空运'}
              </Tag>
            ))
          ) : (
            <Text type="secondary">-</Text>
          )}
        </Space>
      ),
    },
    {
      title: '服务类型',
      key: 'serviceType',
      width: 120,
      render: (_: unknown, record: MasterOrderRow) => {
        return (
          <Space size={4} wrap>
            {(record.serviceTypes || []).length > 0 ? (
              (record.serviceTypes || [])
                .filter((service: unknown): service is string => typeof service === 'string' && service.length > 0)
                .map((service: string) => (
                <Tag key={service}>{SERVICE_TYPE_LABEL[service] || service}</Tag>
              ))
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Space>
        );
      },
    },
    {
      title: '货物信息',
      key: 'cargo',
      width: 120,
      render: (_: unknown, record: MasterOrderRow) => `${record.totalPieces}件 ${record.totalWeight}kg`,
    },
    {
      title: '收件人',
      dataIndex: 'consignee',
      key: 'consignee',
      width: 100,
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 80,
    },
    {
      title: '订单状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record: MasterOrderRow) => {
        const config = MASTER_ORDER_STATUS_CONFIG[record.calculatedStatus];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '支付信息',
      key: 'paymentStatus',
      width: 170,
      render: (_: unknown, record: MasterOrderRow) => {
        const colorMap: Record<string, string> = {
          UNPAID: 'error',
          PARTIAL: 'warning',
          PAID: 'success',
        };
        const paymentStatus = record.paymentStatus || 'UNPAID';
        return (
          <Space direction="vertical" size={0}>
            <Space size={6}>
              <Text>{PAYMENT_METHOD_LABEL[record.paymentMethod as string] || '-'}</Text>
              <Tag color={colorMap[paymentStatus] || 'default'}>
                {PAYMENT_STATUS_LABEL[paymentStatus] || paymentStatus}
              </Tag>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.paymentTime ? dayjs(record.paymentTime).format('YYYY-MM-DD HH:mm') : '-'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: 80,
      render: (currency: string) => currency || '-',
    },
    {
      title: '费用',
      key: 'fees',
      width: 100,
      render: (_: unknown, record: MasterOrderRow) => `${record.currency || 'CNY'} ${(record.totalFreight || 0).toFixed(2)}`,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_: unknown, record: MasterOrderRow) => {
        // 待入库/已入库/待发货阶段允许取消
        const canCancel = ['PENDING_INBOUND', 'INBOUND', 'PENDING_DEPARTURE'].includes(record.calculatedStatus);

        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            >
              详情
            </Button>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={record.status === 'CANCELLED'}
            >
              编辑
            </Button>
            {canCancel && (
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleCancelClick(record)}
              >
                取消订单
              </Button>
            )}
            {record.calculatedStatus === 'RETURN_APPLIED' && (
              <Button
                type="link"
                size="small"
                icon={<AuditOutlined />}
                style={{ color: '#fa541c' }}
                onClick={() => { setReviewOrder(record); setReviewModalOpen(true); }}
              >
                审核
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const handleMainOrderExpand = async (expanded: boolean, record: MasterOrderRow) => {
    setExpandedRowKeys((prev) => {
      if (expanded) {
        return prev.includes(record.id) ? prev : [...prev, record.id];
      }
      return prev.filter((key) => key !== record.id);
    });
    if (expanded) {
      await fetchSubOrdersForOrder(record.id, record.orderNo);
    }
  };

  return (
    <div>
      <ListPageToolbarCard style={{ marginBottom: 10 }}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 280px" minWidth={240}>
              <Input
                placeholder="搜索运单/JOB/集装箱号/快递单/电话"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={150}>
              <Select
                placeholder="订单状态"
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
                style={{ width: '100%' }}
              >
                {Object.entries(MASTER_ORDER_STATUS_CONFIG).map(([key, config]) => (
                  <Option key={key} value={key}>
                    {config.label}
                  </Option>
                ))}
                <Option key="RETURN" value="RETURN">退单（全部）</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={140}>
              <Select
                placeholder="支付状态"
                value={paymentFilter}
                onChange={setPaymentFilter}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="UNPAID">未付款</Option>
                <Option value="PARTIAL">部分付款</Option>
                <Option value="PAID">已付款</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={150}>
              <Select
                placeholder="业务员"
                value={salesFilter}
                onChange={setSalesFilter}
                allowClear
                showSearch
                optionFilterProp="children"
                style={{ width: '100%' }}
              >
                {salesOptions.map((sales) => (
                  <Option key={sales} value={sales}>
                    {sales}
                  </Option>
                ))}
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={140}>
              <Select
                placeholder="币种"
                value={currencyFilter}
                onChange={setCurrencyFilter}
                allowClear
                style={{ width: '100%' }}
              >
                {currencyOptions.map((currency) => (
                  <Option key={currency} value={currency}>
                    {currency}
                  </Option>
                ))}
              </Select>
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button type="primary" icon={<SearchOutlined />} onClick={() => setSearchText((value) => value.trim())}>
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
            <Button type="link" onClick={() => setShowAdvancedFilters(v => !v)}>
              {showAdvancedFilters ? '收起筛选' : '高级筛选'}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建订单
            </Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
        {showAdvancedFilters && (
          <>
            <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
              <Col span={5}>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col span={4}>
                <Select
                  placeholder="服务类型"
                  value={serviceTypeFilter}
                  onChange={setServiceTypeFilter}
                  allowClear
                  style={{ width: '100%' }}
                >
                  {serviceTypeOptions.map((serviceType) => (
                    <Option key={serviceType} value={serviceType}>
                      {serviceType}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={3}>
                <Select
                  placeholder="目的国家"
                  value={countryFilter}
                  onChange={setCountryFilter}
                  allowClear
                  style={{ width: '100%' }}
                >
                  {countryOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={3}>
                <Select
                  placeholder="目的城市"
                  value={cityFilter}
                  onChange={setCityFilter}
                  allowClear
                  disabled={cityOptions.length === 0}
                  style={{ width: '100%' }}
                >
                  {cityOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={3}>
                <Select
                  placeholder="站点代码"
                  value={siteFilter}
                  onChange={setSiteFilter}
                  allowClear
                  disabled={siteOptions.length === 0}
                  style={{ width: '100%' }}
                >
                  {siteOptions.map((option) => (
                    <Option key={option.value} value={option.value}>
                      {option.label}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={3}>
                <Select
                  value={viewMode}
                  onChange={(value) => setViewMode(value)}
                  style={{ width: '100%' }}
                >
                  <Option value="COLLAPSED">收起视图</Option>
                  <Option value="EXPANDED">展开主子单</Option>
                </Select>
              </Col>
              <Col span={3}>
                <Input
                  value={
                    businessMode === 'ALL'
                      ? '当前业务：全部'
                      : `当前业务：${businessMode === 'AIR' ? '空运' : '海运'}`
                  }
                  disabled
                />
              </Col>
            </Row>
            <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
              <Col span={8}>
                <Input
                  placeholder="提单号（Mock）"
                  value={billNoFilter}
                  onChange={(e) => setBillNoFilter(e.target.value)}
                  allowClear
                />
              </Col>
              <Col span={8}>
                <Input
                  placeholder="快递单号（Mock）"
                  value={trackingNoFilter}
                  onChange={(e) => setTrackingNoFilter(e.target.value)}
                  allowClear
                />
              </Col>
              <Col span={8}>
                <Input
                  placeholder="收发货电话（Mock）"
                  value={contactPhoneFilter}
                  onChange={(e) => setContactPhoneFilter(e.target.value)}
                  allowClear
                />
              </Col>
            </Row>
          </>
        )}
      </ListPageToolbarCard>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={filteredOrders}
        rowKey="id"
        loading={loading}
        expandable={
          viewMode === 'EXPANDED'
            ? {
                expandedRowKeys,
                onExpand: handleMainOrderExpand,
                onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as Array<string | number>),
                rowExpandable: (record) => Number(record.subOrderCount || 0) > 0,
                expandedRowRender: (record) => (
                  <Table<ExpandedSubOrderRow>
                    columns={subOrderColumns}
                    dataSource={subOrdersByOrderId[record.id] || []}
                    rowKey="id"
                    size="small"
                    loading={Boolean(subOrderLoadingByOrderId[record.id])}
                    pagination={false}
                    scroll={{ x: 1200 }}
                  />
                ),
              }
            : undefined
        }
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        size="small"
        scroll={{ x: 1900, y: showAdvancedFilters ? 'calc(100vh - 510px)' : 'calc(100vh - 460px)' }}
      />

      {/* 订单详情抽屉 */}
      <MasterOrderDetailDrawer
        open={detailDrawerOpen}
        order={selectedOrder}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedOrder(null);
        }}
        onOrderUpdate={handleOrderUpdate}
      />

      {/* 订单编辑弹窗 */}
      <MasterOrderEditModal
        open={editModalOpen}
        order={selectedOrder}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedOrder(null);
        }}
        onSave={handleOrderUpdate}
      />

      {/* 订单创建弹窗 */}
      <Modal
        title={<span style={{ color: '#d48806', fontWeight: 700 }}>创建订单</span>}
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        width={1400}
        destroyOnClose
      >
        <OrderCreate
          onCancel={() => setCreateModalOpen(false)}
          onSubmit={handleCreateSubmit}
          businessMode={businessMode}
        />
      </Modal>

      {/* 退单审核弹窗 */}
      <Modal
        title="退单审核"
        open={reviewModalOpen}
        onCancel={() => {
          setReviewModalOpen(false);
          setReviewOrder(null);
          reviewForm.resetFields();
          setReviewResult('');
        }}
        onOk={async () => {
          try {
            const values = await reviewForm.validateFields();
            if (!reviewOrder) return;
            if (values.result === 'APPROVE') {
              const result: any = await v2OmsApi.approveReturn(reviewOrder.id, { approver: '当前用户' });
              const summary = result?.data?.summary || result?.summary;
              setOrders(prev => prev.map(o => o.id === reviewOrder.id ? {
                ...o,
                status: 'CANCELLED',
                returnApprover: '当前用户',
                returnApprovedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              } as any : o));
              message.success('审核通过，订单已取消');
              if (summary) {
                const msgs: string[] = [];
                if (summary.subOrderCancelled > 0) msgs.push(`取消${summary.subOrderCancelled}个子订单`);
                if (summary.returnRecords > 0) msgs.push(`生成${summary.returnRecords}条退运记录`);
                if (summary.stockUpdated > 0) msgs.push(`更新${summary.stockUpdated}条库存为已退`);
                if (summary.containerUpdated > 0) msgs.push(`重算${summary.containerUpdated}个集装箱`);
                if (summary.feeCancelled > 0) msgs.push(`取消${summary.feeCancelled}条待审费用`);
                if (summary.deliveryDeleted > 0) msgs.push(`删除${summary.deliveryDeleted}个待配送单`);
                if (msgs.length > 0) message.info(`联动处理: ${msgs.join('，')}`);
              }
            } else {
              await v2OmsApi.rejectReturn(reviewOrder.id, {
                rejectReason: values.opinion,
                approver: '当前用户',
              });
              setOrders(prev => prev.map(o => o.id === reviewOrder.id ? {
                ...o,
                status: reviewOrder.previousStatus || 'PENDING_INBOUND',
              } as any : o));
              message.success('已驳回退单申请，订单恢复为原状态');
            }
            setReviewModalOpen(false);
            setReviewOrder(null);
            reviewForm.resetFields();
            setReviewResult('');
          } catch (error: any) {
            if (error.message) {
              message.error(error.message);
            } else {
              console.error('表单验证失败:', error);
            }
          }
        }}
        width={700}
        destroyOnClose
      >
        {reviewOrder && (
          <>
            <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 20 }}>
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <Text type="secondary">运单号：</Text>
                  <Text strong>{reviewOrder.orderNo}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">客户名称：</Text>
                  <Text strong>{reviewOrder.customerName}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">申请前状态：</Text>
                  <Tag color={MASTER_ORDER_STATUS_CONFIG[reviewOrder.previousStatus || 'PENDING_INBOUND']?.color}>
                    {MASTER_ORDER_STATUS_CONFIG[reviewOrder.previousStatus || 'PENDING_INBOUND']?.label}
                  </Tag>
                </Col>
                <Col span={12}>
                  <Text type="secondary">退单类型：</Text>
                  <Text>{
                    { CUSTOMER_CANCEL: '客户主动取消', GOODS_ISSUE: '货物问题', ADDRESS_ERROR: '地址错误', OTHER: '其他' }[reviewOrder.returnType || 'OTHER']
                  }</Text>
                </Col>
                <Col span={24}>
                  <Text type="secondary">退单原因：</Text>
                  <Text>{reviewOrder.returnReason}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">退费金额：</Text>
                  <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                    ¥{(reviewOrder.returnRefundAmount || 0).toFixed(2)}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">退费方式：</Text>
                  <Text>{
                    { ORIGINAL: '原路退回', BANK_TRANSFER: '银行转账', OFFLINE: '线下退款' }[reviewOrder.returnRefundMethod || 'ORIGINAL']
                  }</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">是否需要退运：</Text>
                  {reviewOrder.needReturn ? <Tag color="orange">是</Tag> : <Tag>否</Tag>}
                </Col>
                {reviewOrder.returnShippingNote && (
                  <Col span={12}>
                    <Text type="secondary">退运说明：</Text>
                    <Text>{reviewOrder.returnShippingNote}</Text>
                  </Col>
                )}
                <Col span={12}>
                  <Text type="secondary">申请人：</Text>
                  <Text>{reviewOrder.returnAppliedBy}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">申请时间：</Text>
                  <Text>{reviewOrder.returnAppliedAt ? dayjs(reviewOrder.returnAppliedAt).format('YYYY-MM-DD HH:mm') : '-'}</Text>
                </Col>
              </Row>
            </div>
            <Divider>审核意见</Divider>
            <Form form={reviewForm} layout="vertical">
              <Form.Item
                name="result"
                label="审核结果"
                rules={[{ required: true, message: '请选择审核结果' }]}
              >
                <Select placeholder="请选择审核结果" onChange={(v: string) => setReviewResult(v)}>
                  <Select.Option value="APPROVE">✓ 通过</Select.Option>
                  <Select.Option value="REJECT">✗ 驳回</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="opinion"
                label="审核意见"
                rules={[{ required: reviewResult === 'REJECT', message: '驳回时必须填写审核意见' }]}
              >
                <TextArea
                  rows={3}
                  placeholder={reviewResult === 'REJECT' ? '请填写驳回原因（必填）' : '请填写审核意见（选填）'}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* 取消订单弹窗 */}
      <Modal
        title="取消订单"
        open={cancelModalOpen}
        onCancel={() => {
          setCancelModalOpen(false);
          cancelForm.resetFields();
          setSelectedOrder(null);
        }}
        onOk={handleCancelConfirm}
        okText="确认取消"
        cancelText="返回"
        okButtonProps={{ danger: true }}
        width={500}
      >
        <Form form={cancelForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="订单信息">
            <Text>运单号：{selectedOrder?.orderNo}</Text>
          </Form.Item>
          <Form.Item
            name="cancelReason"
            label="取消原因"
            rules={[
              { required: true, message: '请输入取消原因' },
              { min: 5, message: '取消原因至少5个字符' }
            ]}
          >
            <TextArea
              rows={4}
              placeholder="请详细说明取消订单的原因，例如：客户要求取消、地址错误、价格调整等"
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}
