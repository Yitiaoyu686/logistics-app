import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  InboxOutlined,
  ReloadOutlined,
  PrinterOutlined,
  RocketOutlined,
  SearchOutlined,
  UndoOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { StockItem, StockStatus } from '../../../types/core';
import { warehouseApi } from '../../../api';
import InboundDetailDrawer from './InboundDetailDrawer';
import CancelOrderModal from '../../../components/warehouse/CancelOrderModal';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../../components/ListPageToolbar';
import { buildOriginStockFallbackData, loadOriginFallbackOrders } from './derivedWarehouseData';

const { Option } = Select;
const { TextArea } = Input;

type BusinessMode = 'ALL' | 'SEA' | 'AIR';

interface StockListRow extends StockItem {
  serviceType?: string;
  goodsDescription?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  orderUpdatedAt?: string;
  orderCreatedAt?: string;
  shippingUnitNo?: string;
  returnReason?: string;
  returnTime?: string;
  displayOrderNo?: string;
  displaySubOrderNo?: string;
  legacyMasterOrderNo?: string;
  legacySubOrderNo?: string;
}

const STATUS_CONFIG: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
  IN_STOCK: { text: '已入库', color: 'success', icon: <InboxOutlined /> },
  ALLOCATED: { text: '已分配', color: 'cyan', icon: <CheckCircleOutlined /> },
  PACKED: { text: '已装箱', color: 'blue', icon: <CheckCircleOutlined /> },
  SHIPPED: { text: '已出库', color: 'default', icon: <RocketOutlined /> },
  RETURNED: { text: '退运中', color: 'warning', icon: <UndoOutlined /> },
};

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

// 把后端 snake_case 的 wms_stock 行映射成 StockListRow(camelCase)
function mapStockRow(row: Record<string, unknown>): StockListRow {
  const r = row as Record<string, any>;
  return {
    id: r.id,
    masterOrderNo: r.order_no || '-',
    subOrderNo: r.sub_order_no || '-',
    trackingNo: r.tracking_no || '-',
    clientCode: r.client_code || '',
    clientName: r.customer_name || '-',
    pieces: Number(r.pieces || 0),
    weight: Number(r.gross_weight_kg || 0),
    volume: Number(r.volume_cbm || 0),
    transportType: r.business_line,
    route: r.route_code || '-',
    recipient: r.consignee_name,
    destination: [r.consignee_country, r.consignee_city].filter(Boolean).join(' · '),
    status: r.stock_status,
    warehouseLocation: r.warehouse_id,
    warehouse: 'CN',
    location: r.location_code,
    inboundTime: r.created_at,
    shippingUnitId: r.shipping_unit_id,
    shippingUnitNo: r.shipping_unit_no,
    salesPerson: r.sales_person || r.sales_user_name,
    remark: r.remark,
    // StockListRow 附加字段
    serviceType: r.service_type,
    goodsDescription: r.goods_description,
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    displayOrderNo: r.order_no,
    displaySubOrderNo: r.sub_order_no,
  } as StockListRow;
}

export const StockList = ({
  warehouseId,
  businessMode = 'ALL',
}: {
  warehouseId?: string;
  businessMode?: BusinessMode;
}) => {
  const [loading, setLoading] = useState(false);
  const [stockItems, setStockItems] = useState<StockListRow[]>([]);

  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<StockStatus | 'ALL'>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string | 'ALL'>('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string | 'ALL'>('ALL');
  const [filterSales, setFilterSales] = useState<string>('');
  const [filterServiceType, setFilterServiceType] = useState<string | 'ALL'>('ALL');

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockListRow | null>(null);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [returnForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editDrawerVisible, setEditDrawerVisible] = useState(false);
  const [editRecord, setEditRecord] = useState<any>(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelRecord, setCancelRecord] = useState<any>(null);
  const [filterStation, setFilterStation] = useState<string>('ALL');

  const fetchStock = async () => {
    try {
      setLoading(true);
      const res: any = await warehouseApi.listStock({
        warehouse: 'CN',
        warehouseId,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
      });
      let rows = Array.isArray(res?.data) ? res.data : [];
      if (!rows.length) {
        const fallbackOrders = await loadOriginFallbackOrders(businessMode);
        rows = buildOriginStockFallbackData(fallbackOrders);
      } else {
        // Map snake_case backend rows → camelCase StockListRow
        rows = rows.map(mapStockRow);
      }
      setStockItems(rows as StockListRow[]);
    } catch (error: any) {
      try {
        const fallbackOrders = await loadOriginFallbackOrders(businessMode);
        setStockItems(buildOriginStockFallbackData(fallbackOrders) as StockListRow[]);
      } catch (_) {
        message.error(error.message || '加载库存数据失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [warehouseId, businessMode]);

  const salesOptions = useMemo(
    () => Array.from(new Set(stockItems.map((item) => item.salesPerson).filter(Boolean))) as string[],
    [stockItems]
  );

  const serviceTypeOptions = useMemo(
    () => Array.from(new Set(stockItems.map((item) => item.serviceType).filter(Boolean))) as string[],
    [stockItems]
  );

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return stockItems.filter((item) => {
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
      if (filterPaymentStatus !== 'ALL' && item.paymentStatus !== filterPaymentStatus) return false;
      if (filterPaymentMethod !== 'ALL' && item.paymentMethod !== filterPaymentMethod) return false;
      if (filterSales && item.salesPerson !== filterSales) return false;
      if (filterServiceType !== 'ALL' && item.serviceType !== filterServiceType) return false;
      if (!keyword) return true;
      return [
        item.displaySubOrderNo,
        item.displayOrderNo,
        item.subOrderNo,
        item.masterOrderNo,
        item.trackingNo,
        item.clientName,
        item.clientCode,
        item.route,
        item.destination,
        item.salesPerson,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [
    stockItems,
    searchText,
    filterStatus,
    filterPaymentStatus,
    filterPaymentMethod,
    filterSales,
    filterServiceType,
  ]);

  const inStockCount = stockItems.filter((item) => item.status === 'IN_STOCK').length;
  const packedCount = stockItems.filter((item) => item.status === 'PACKED').length;
  const totalWeight = stockItems
    .filter((item) => ['IN_STOCK', 'ALLOCATED', 'PACKED'].includes(item.status))
    .reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const totalVolume = stockItems
    .filter((item) => ['IN_STOCK', 'ALLOCATED', 'PACKED'].includes(item.status))
    .reduce((sum, item) => sum + Number(item.volume || 0), 0);

  const getDaysInStock = (inboundTime: string) => dayjs().diff(dayjs(inboundTime), 'day');

  const handleReset = () => {
    setSearchText('');
    setFilterStatus('ALL');
    setFilterPaymentStatus('ALL');
    setFilterPaymentMethod('ALL');
    setFilterSales('');
    setFilterServiceType('ALL');
    setFilterStation('ALL');
  };

  const handleQuery = () => {
    setSearchText((value) => value.trim());
  };

  const handleViewDetail = async (item: StockListRow) => {
    try {
      const res: any = await warehouseApi.getStockById(item.id);
      setSelectedItem((res?.data || item) as StockListRow);
      setDetailDrawerVisible(true);
    } catch (_) {
      setSelectedItem(item);
      setDetailDrawerVisible(true);
    }
  };

  const handleOpenReturn = (item: StockListRow) => {
    setSelectedItem(item);
    returnForm.setFieldsValue({
      returnType: 'CLIENT',
      returnReason: '',
      remark: '',
    });
    setReturnModalVisible(true);
  };

  const handleEdit = (item: StockListRow) => {
    setSelectedItem(item);
    editForm.setFieldsValue({
      trackingNo: item.trackingNo,
      pieces: item.pieces,
      weight: item.weight,
      volume: item.volume,
      warehouseLocation: item.warehouseLocation,
      status: item.status,
      remark: item.remark,
    });
    setEditModalVisible(true);
  };

  const handleSubmitEdit = async () => {
    try {
      if (!selectedItem) return;
      const values = await editForm.validateFields();
      await warehouseApi.updateStock(selectedItem.id, values);
      message.success('库存信息更新成功');
      setEditModalVisible(false);
      editForm.resetFields();
      setSelectedItem(null);
      await fetchStock();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || '更新库存失败');
    }
  };

  const handleDeleteStock = (item: StockListRow) => {
    Modal.confirm({
      title: '确认删除库存记录',
      content: `确认删除 ${item.displaySubOrderNo || item.subOrderNo || item.id} 吗？`,
      okText: '确认删除',
      cancelText: '返回',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await warehouseApi.deleteStock(item.id);
          message.success('库存记录已删除');
          await fetchStock();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  const handlePrint = (item: StockListRow) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      message.warning('无法打开打印窗口，请检查浏览器弹窗设置');
      return;
    }

    const title = item.displaySubOrderNo || item.subOrderNo || item.trackingNo || item.id;
    const html = `
      <html>
      <head>
        <title>库存打印-${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h2 { margin: 0 0 16px; }
          table { border-collapse: collapse; width: 100%; }
          td { border: 1px solid #ddd; padding: 8px 10px; font-size: 13px; }
          .k { width: 180px; background: #fafafa; }
        </style>
      </head>
      <body>
        <h2>库存单打印</h2>
        <table>
          <tr><td class="k">主运单号</td><td>${item.displayOrderNo || item.masterOrderNo || '-'}</td></tr>
          <tr><td class="k">子运单号</td><td>${item.displaySubOrderNo || item.subOrderNo || '-'}</td></tr>
          <tr><td class="k">第三方运单号</td><td>${item.trackingNo || '-'}</td></tr>
          <tr><td class="k">客户</td><td>${item.clientName || '-'} (${item.clientCode || '-'})</td></tr>
          <tr><td class="k">线路</td><td>${item.route || '-'}</td></tr>
          <tr><td class="k">服务类型</td><td>${item.serviceType || '-'}</td></tr>
          <tr><td class="k">件数/重量/体积</td><td>${item.pieces || 0} 件 / ${Number(item.weight || 0).toFixed(2)} kg / ${Number(item.volume || 0).toFixed(3)} m³</td></tr>
          <tr><td class="k">库位</td><td>${item.warehouseLocation || '-'}</td></tr>
          <tr><td class="k">状态</td><td>${STATUS_CONFIG[item.status]?.text || item.status}</td></tr>
          <tr><td class="k">备注</td><td>${item.remark || '-'}</td></tr>
          <tr><td class="k">入库时间</td><td>${dayjs(item.inboundTime).format('YYYY-MM-DD HH:mm')}</td></tr>
        </table>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleSubmitReturn = async () => {
    try {
      const values = await returnForm.validateFields();
      if (!selectedItem) return;
      await warehouseApi.returnStock(selectedItem.id, {
        returnType: values.returnType,
        returnReason: values.returnReason,
        remark: values.remark,
        applicant: 'warehouse_cn',
      });
      message.success('退运申请提交成功，等待办公室/财务审核');
      setReturnModalVisible(false);
      returnForm.resetFields();
      setSelectedItem(null);
      fetchStock();
    } catch (error: any) {
      message.error(error.message || '退运申请失败');
    }
  };

  const columns = [
    {
      title: '入库日期',
      key: 'inboundTime',
      width: 170,
      render: (_: unknown, record: StockListRow) => (
        <Space direction="vertical" size={0}>
          <span>{dayjs(record.inboundTime).format('YYYY-MM-DD HH:mm')}</span>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>在库 {getDaysInStock(record.inboundTime)} 天</span>
        </Space>
      ),
    },
    {
      title: '运单号',
      key: 'orderNo',
      width: 180,
      render: (_: unknown, record: StockListRow) => {
        const extra = record as StockListRow & { isRecycled?: boolean; isAbnormal?: boolean };
        return (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <span style={{ fontWeight: 500 }}>{record.displaySubOrderNo || record.subOrderNo || '-'}</span>
            {extra.isRecycled && <Tag color="green">&#9851;</Tag>}
            {extra.isAbnormal && <Tag color="red">X</Tag>}
          </Space>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>{record.displayOrderNo || record.masterOrderNo || '-'}</span>
        </Space>
      );},
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 110,
      render: (value: string) => value || '-',
    },
    {
      title: '用户',
      key: 'clientName',
      width: 170,
      render: (_: unknown, record: StockListRow) => (
        <Space direction="vertical" size={0}>
          <span>{record.clientName || '-'}</span>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>{record.clientCode || '-'}</span>
        </Space>
      ),
    },
    {
      title: '线路',
      dataIndex: 'route',
      key: 'route',
      width: 180,
      render: (value: string) => value || '-',
    },
    {
      title: '服务类型',
      dataIndex: 'serviceType',
      key: 'serviceType',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '说明',
      key: 'description',
      width: 130,
      render: (_: unknown, record: StockListRow) => record.goodsDescription || record.productName || '-',
    },
    {
      title: '重量Kg',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
      align: 'right' as const,
      render: (value: number) => Number(value || 0).toFixed(2),
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 80,
      align: 'right' as const,
    },
    {
      title: '支付方式/状态',
      key: 'payment',
      width: 130,
      render: (_: unknown, record: any) => {
        const methodLabel: Record<string, string> = { PREPAID: '预付', COD: '到付', CREDIT_CARD: '信用卡' };
        const statusLabel: Record<string, string> = { UNPAID: '未付', PARTIAL: '部分付', PAID: '已付' };
        const method = methodLabel[record.paymentMethod] || '到付';
        const status = statusLabel[record.paymentStatus] || '未付';
        return <span>{method}  {status}</span>;
      },
    },
    {
      title: '物流状态',
      key: 'status',
      width: 150,
      render: (_: unknown, record: StockListRow) => {
        const config = STATUS_CONFIG[record.status] || { text: record.status, color: 'default', icon: null };
        const warning = record.status === 'IN_STOCK' && getDaysInStock(record.inboundTime) > 7;
        return (
          <Space direction="vertical" size={2}>
            <Space>
              <Tag color={config.color} icon={config.icon}>{config.text}</Tag>
              {warning && (
                <Tooltip title={`在库已超过 ${getDaysInStock(record.inboundTime)} 天`}>
                  <WarningOutlined style={{ color: '#faad14' }} />
                </Tooltip>
              )}
            </Space>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>{record.warehouseLocation || '-'}</span>
          </Space>
        );
      },
    },
    {
      title: '更新日期',
      key: 'updatedAt',
      width: 170,
      render: (_: unknown, record: StockListRow) =>
        dayjs(record.orderUpdatedAt || record.inboundTime).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, record: any) => (
        <Space size={4} wrap>
          <Button type="link" size="small" onClick={() => {
            setEditRecord(record);
            setEditDrawerVisible(true);
          }}>编辑</Button>
          <Button type="link" size="small" onClick={() => message.info('打印功能开发中')}>打印</Button>
          <Button type="link" size="small" danger onClick={() => handleOpenReturn(record)}>退运</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">总数 {stockItems.length}</Tag>
        <Tag color="green">在库 {inStockCount}</Tag>
        <Tag color="processing">已装箱 {packedCount}</Tag>
        <Tag color="orange">总重 {totalWeight.toFixed(2)}kg</Tag>
        <Tag color="blue">总体积 {totalVolume.toFixed(3)}m³</Tag>
      </div>

      <ListPageToolbarCard style={{ marginBottom: 10 }}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 320px" minWidth={260}>
              <Input
                placeholder="搜索运单号/客户/线路"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onPressEnter={handleQuery}
                allowClear
                prefix={<SearchOutlined />}
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={120}>
              <Select value={filterStatus} onChange={setFilterStatus}>
                <Option value="ALL">全部状态</Option>
                <Option value="IN_STOCK">已入库</Option>
                <Option value="ALLOCATED">已分配</Option>
                <Option value="PACKED">已装箱</Option>
                <Option value="SHIPPED">已出库</Option>
                <Option value="RETURNED">退运中</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={120}>
              <Select value={filterPaymentMethod} onChange={setFilterPaymentMethod}>
                <Option value="ALL">全部支付方式</Option>
                <Option value="PREPAID">预付</Option>
                <Option value="COD">到付</Option>
                <Option value="CREDIT_CARD">信用卡</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={120}>
              <Select value={filterPaymentStatus} onChange={setFilterPaymentStatus}>
                <Option value="ALL">全部支付状态</Option>
                <Option value="UNPAID">未付</Option>
                <Option value="PARTIAL">部分付</Option>
                <Option value="PAID">已付</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={140}>
              <Select
                value={filterStation}
                onChange={setFilterStation}
                options={[
                  { label: '全部站点', value: 'ALL' },
                  { label: '伊科贾站点', value: 'IKEJA' },
                  { label: '电脑村站点', value: 'COMPUTER_VILLAGE' },
                  { label: '维岛站点', value: 'VICTORIA_ISLAND' },
                  { label: '贸易展会站点', value: 'TRADE_FAIR' },
                ]}
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={120}>
              <Select
                value={filterSales}
                onChange={setFilterSales}
                options={[
                  { label: '业务员', value: '' },
                  { label: 'Smile', value: 'Smile' },
                  { label: 'Andi', value: 'Andi' },
                  { label: 'Karena', value: 'Karena' },
                ]}
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={140}>
              <Select value={filterServiceType} onChange={setFilterServiceType}>
                <Option value="ALL">全部服务类型</Option>
                {serviceTypeOptions.map((serviceType) => (
                  <Option key={serviceType} value={serviceType}>{serviceType}</Option>
                ))}
              </Select>
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleQuery}>查询</Button>
            <Button onClick={handleReset}>重置</Button>
            <Button icon={<ReloadOutlined />} onClick={fetchStock}>刷新</Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredItems}
        loading={loading}
        scroll={{ x: 2200, y: 'calc(100vh - 430px)' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        size="small"
      />

      <Modal
        title="退运"
        open={returnModalVisible}
        onOk={handleSubmitReturn}
        okText="确认退运并创建退运单"
        okButtonProps={{ danger: true }}
        cancelText="返回"
        onCancel={() => {
          setReturnModalVisible(false);
          returnForm.resetFields();
          setSelectedItem(null);
        }}
        width={560}
      >
        {selectedItem && (
          <>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <Space direction="vertical" size={4}>
                <div><strong>运单号：</strong>{selectedItem.displayOrderNo || selectedItem.masterOrderNo || '-'}</div>
                <div><strong>客户：</strong>{selectedItem.clientName}</div>
                <div><strong>件重体：</strong>{selectedItem.pieces} 件 / {Number(selectedItem.weight || 0).toFixed(2)} kg / {Number(selectedItem.volume || 0).toFixed(3)} m³</div>
              </Space>
            </div>
            <Form form={returnForm} layout="vertical">
              <Form.Item name="returnType" label="退运类型" rules={[{ required: true, message: '请选择退运类型' }]}>
                <Select>
                  <Option value="CLIENT">客户退运</Option>
                  <Option value="CUSTOMS">海关退运</Option>
                </Select>
              </Form.Item>
              <Form.Item name="returnReason" label="退运原因" rules={[{ required: true, message: '请选择退运原因' }]}>
                <Select placeholder="请选择退运原因">
                  <Option value="客户取消">客户取消</Option>
                  <Option value="货物损坏">货物损坏</Option>
                  <Option value="禁运物品">禁运物品</Option>
                  <Option value="货物不符">货物不符</Option>
                  <Option value="客户拒收">客户拒收</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
              <Form.Item name="remark" label="补充说明">
                <TextArea rows={2} maxLength={200} showCount placeholder="可选补充说明" />
              </Form.Item>
            </Form>
            <div style={{ padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4 }}>
              确认后将自动创建退运单，您可以稍后在「退运处理」中补充退运快递信息和地址。
            </div>
          </>
        )}
      </Modal>

      <Modal
        title="编辑库存"
        open={editModalVisible}
        onOk={handleSubmitEdit}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setSelectedItem(null);
        }}
        width={600}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="trackingNo" label="第三方运单号" rules={[{ required: true, message: '请输入运单号' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label="库存状态" rules={[{ required: true, message: '请选择库存状态' }]}>
            <Select>
              <Option value="IN_STOCK">已入库</Option>
              <Option value="ALLOCATED">已分配</Option>
              <Option value="PACKED">已装箱</Option>
              <Option value="SHIPPED">已出库</Option>
              <Option value="RETURNED">退运中</Option>
            </Select>
          </Form.Item>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="pieces" label="件数" rules={[{ required: true, message: '请输入件数' }]}>
              <Input type="number" min={0} />
            </Form.Item>
            <Form.Item name="weight" label="重量(kg)" rules={[{ required: true, message: '请输入重量' }]}>
              <Input type="number" min={0} step="0.01" />
            </Form.Item>
            <Form.Item name="volume" label="体积(m³)" rules={[{ required: true, message: '请输入体积' }]}>
              <Input type="number" min={0} step="0.001" />
            </Form.Item>
          </Space>
          <Form.Item name="warehouseLocation" label="库位">
            <Input />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="库存详情"
        placement="right"
        width={680}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedItem(null);
        }}
      >
        {selectedItem && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="入库时间">{dayjs(selectedItem.inboundTime).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="主运单号">{selectedItem.displayOrderNo || selectedItem.masterOrderNo}</Descriptions.Item>
            <Descriptions.Item label="子运单号">{selectedItem.displaySubOrderNo || selectedItem.subOrderNo}</Descriptions.Item>
            <Descriptions.Item label="第三方运单号">{selectedItem.trackingNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="客户">{selectedItem.clientName}（{selectedItem.clientCode}）</Descriptions.Item>
            <Descriptions.Item label="线路">{selectedItem.route || '-'}</Descriptions.Item>
            <Descriptions.Item label="服务类型">{selectedItem.serviceType || '-'}</Descriptions.Item>
            <Descriptions.Item label="说明">{selectedItem.goodsDescription || selectedItem.productName || '-'}</Descriptions.Item>
            <Descriptions.Item label="件数">{selectedItem.pieces}</Descriptions.Item>
            <Descriptions.Item label="重量">{Number(selectedItem.weight || 0).toFixed(2)} kg</Descriptions.Item>
            <Descriptions.Item label="体积">{Number(selectedItem.volume || 0).toFixed(3)} m³</Descriptions.Item>
            <Descriptions.Item label="支付方式">{PAYMENT_METHOD_LABEL[selectedItem.paymentMethod || ''] || '-'}</Descriptions.Item>
            <Descriptions.Item label="支付状态">{PAYMENT_STATUS_LABEL[selectedItem.paymentStatus || ''] || '-'}</Descriptions.Item>
            <Descriptions.Item label="物流状态">
              <Tag color={(STATUS_CONFIG[selectedItem.status] || { color: 'default' }).color}>
                {(STATUS_CONFIG[selectedItem.status] || { text: selectedItem.status }).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="库位">{selectedItem.warehouseLocation || '-'}</Descriptions.Item>
            <Descriptions.Item label="集装号">{selectedItem.shippingUnitNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注">{selectedItem.remark || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <InboundDetailDrawer
        visible={editDrawerVisible}
        mode="edit"
        orderId={editRecord?.id || ''}
        orderNo={editRecord?.orderNo || editRecord?.subOrderNo}
        routeCode={editRecord?.routeCode || 'CAN.CHN-LOS.NGN'}
        serviceType={editRecord?.serviceType === 'EXPRESS' ? 'EXPRESS' : 'STANDARD'}
        salesPerson={editRecord?.salesPerson}
        customerName={editRecord?.customerName || editRecord?.clientName}
        orderDate={editRecord?.createdAt}
        trackingNo={editRecord?.trackingNo}
        expressCompany={editRecord?.expressCompany}
        category={editRecord?.category}
        goodsName={editRecord?.goodsName || editRecord?.productName}
        remark={editRecord?.remark}
        onSubmit={() => {
          message.success('编辑保存成功');
          setEditDrawerVisible(false);
          setEditRecord(null);
        }}
        onClose={() => {
          setEditDrawerVisible(false);
          setEditRecord(null);
        }}
      />

      <CancelOrderModal
        visible={cancelModalVisible}
        orderId={cancelRecord?.id || ''}
        orderNo={cancelRecord?.orderNo || cancelRecord?.subOrderNo}
        routeCode={cancelRecord?.routeCode}
        serviceType={cancelRecord?.serviceType}
        salesPerson={cancelRecord?.salesPerson}
        customerName={cancelRecord?.customerName || cancelRecord?.clientName}
        onSubmit={(cancelledSubOrders, reasons) => {
          message.success(`已取消 ${cancelledSubOrders.length} 个分单`);
          setCancelModalVisible(false);
          setCancelRecord(null);
        }}
        onCancel={() => {
          setCancelModalVisible(false);
          setCancelRecord(null);
        }}
      />
    </div>
  );
};
