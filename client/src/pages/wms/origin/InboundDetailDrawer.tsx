import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Descriptions,
  Select,
  Input,
  InputNumber,
  Button,
  Tag,
  Divider,
  Space,
  Table,
  Typography,
  Upload,
  Image,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import FeeEntryDrawer, { type FeeItem } from '../../../components/warehouse/FeeEntryDrawer';
import { systemApi } from '../../../api';

const { Text } = Typography;

const GOODS_CATEGORIES = [
  '日用百货', '机械/五金/仪表', '食品', '化妆品', '保健品',
  '药品', '电子产品', '服装/纺织品', '文件', '其他',
];

// 费用类型选项
const FEE_TYPE_OPTIONS = [
  { value: 'FREIGHT', label: '运费' },
  { value: 'SURCHARGE_DRUG', label: '药品附加运费' },
  { value: 'CUSTOMS', label: '报关费' },
  { value: 'DOOR_DELIVERY', label: '到门费用' },
  { value: 'PACKAGING', label: '包装费' },
  { value: 'WAREHOUSE', label: '仓储费' },
  { value: 'INSURANCE', label: '保险费' },
  { value: 'DISCOUNT', label: '折扣' },
  { value: 'OTHER', label: '其他' },
];
const FEE_TYPE_LABEL: Record<string, string> = Object.fromEntries(FEE_TYPE_OPTIONS.map(o => [o.value, o.label]));

const CURRENCY_OPTIONS = [
  { value: 'CNY', label: '¥ CNY' },
  { value: 'USD', label: '$ USD' },
  { value: 'NGN', label: '₦ NGN' },
];

// 运费自动计算：根据重量/体积 + 运输方式
const VOLUME_DIVISOR_SEA = 6000; // 海运体积系数
const VOLUME_DIVISOR_AIR = 5000; // 空运体积系数

interface InboundFeeItem {
  id: string;
  feeType: string;
  currency: string;
  unitPrice: number;
  quantity: number;
  exchangeRate: number;
  amount: number;
  remark: string;
  isAutoFreight?: boolean;
}

// 尺寸行
interface DimensionRow {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  pieces: number;
}

// 同一主订单下的子运单信息
export interface SiblingSubOrder {
  id: string;
  trackingNo: string;
  expressCompany?: string;
  signStatus?: string;
  signTime?: string;
  inboundStatus?: 'PENDING' | 'COMPLETED' | 'ABNORMAL';
  subOrderNo?: string;  // 入库后生成的子运单号，待入库时为空
  inboundTime?: string;
}

export interface InboundDetailDrawerProps {
  visible: boolean;
  mode: 'inbound' | 'edit';
  orderId: string;
  orderNo?: string;
  routeCode?: string;
  serviceType?: string;
  salesPerson?: string;
  customerName?: string;
  orderDate?: string;
  // 当前子运单信息
  trackingNo?: string;
  expressCompany?: string;
  signStatus?: string;
  signTime?: string;
  category?: string;
  goodsName?: string;
  remark?: string;
  // 客户在订单创建时申报的三方快递原始信息（用于入库核对）
  declaredWeight?: number;
  declaredPieces?: number;
  declaredLength?: number;
  declaredWidth?: number;
  declaredHeight?: number;
  // 同一主订单下的所有子运单（含当前）
  siblingSubOrders?: SiblingSubOrder[];
  onSubmit: (data: {
    category?: string;
    goodsName?: string;
    remark?: string;
    dimensions: DimensionRow[];
  }) => void;
  onClose: () => void;
}

const TRACKING_STATUS_COLOR: Record<string, string> = {
  已签收: 'success',
  未签收: 'default',
  已取消: 'warning',
  异常: 'error',
};

const InboundDetailDrawer: React.FC<InboundDetailDrawerProps> = ({
  visible,
  mode,
  orderId,
  orderNo,
  routeCode,
  serviceType,
  salesPerson,
  customerName,
  orderDate,
  trackingNo,
  expressCompany,
  signStatus,
  signTime,
  category: initCategory,
  goodsName: initGoodsName,
  remark: initRemark,
  declaredWeight,
  declaredPieces,
  declaredLength,
  declaredWidth,
  declaredHeight,
  siblingSubOrders,
  onSubmit,
  onClose,
}) => {
  const [category, setCategory] = useState<string | undefined>();
  const [goodsName, setGoodsName] = useState<string>('');
  const [remarkText, setRemarkText] = useState<string>('');
  const [dimensions, setDimensions] = useState<DimensionRow[]>([
    { weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, pieces: 1 },
  ]);
  const [feeDrawerVisible, setFeeDrawerVisible] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [feeItems, setFeeItems] = useState<InboundFeeItem[]>([]);
  const [exchangeRateMap, setExchangeRateMap] = useState<Record<string, number>>({ USD: 1, CNY: 1, NGN: 1 });

  const siblings: SiblingSubOrder[] = siblingSubOrders && siblingSubOrders.length > 0
    ? siblingSubOrders
    : [{
      id: orderId || 'CURRENT',
      trackingNo: trackingNo || '-',
      expressCompany: expressCompany || '',
      signStatus: signStatus || '-',
      signTime: signTime || '-',
      inboundStatus: mode === 'edit' ? 'COMPLETED' : 'PENDING',
      subOrderNo: orderNo,
      inboundTime: orderDate || '-',
    }];

  useEffect(() => {
    if (visible) {
      setCategory(initCategory);
      setGoodsName(initGoodsName || '');
      setRemarkText(initRemark || '');
      // 以客户申报值作为初始默认值，运营可按实际测量覆盖
      setDimensions([{
        weightKg: declaredWeight || 0,
        lengthCm: declaredLength || 0,
        widthCm: declaredWidth || 0,
        heightCm: declaredHeight || 0,
        pieces: declaredPieces || 1,
      }]);
      setPhotos([]);
      setFeeItems([]);
      // 加载汇率
      (async () => {
        try {
          const res: any = await systemApi.exchangeRates();
          const rates: Record<string, number> = { USD: 1 };
          (Array.isArray(res?.data) ? res.data : []).forEach((r: any) => {
            if (r.fromCurrency && r.rate) rates[r.fromCurrency] = Number(r.rate);
            if (r.currency && r.rate) rates[r.currency] = Number(r.rate);
          });
          if (!rates.CNY) rates.CNY = 7.25;
          if (!rates.NGN) rates.NGN = 1650;
          setExchangeRateMap(rates);
        } catch {
          setExchangeRateMap({ USD: 1, CNY: 7.25, NGN: 1650 });
        }
      })();
    }
  }, [visible, initCategory, initGoodsName, initRemark, declaredWeight, declaredPieces, declaredLength, declaredWidth, declaredHeight]);

  // 自动计算运费 — 根据尺寸变化实时更新
  useEffect(() => {
    const dim = dimensions[0];
    if (!dim) return;
    const actualWeight = dim.weightKg || 0;
    const volumeM3 = (dim.lengthCm * dim.widthCm * dim.heightCm) / 1000000;
    const divisor = serviceType === 'EXPRESS' ? VOLUME_DIVISOR_AIR : VOLUME_DIVISOR_SEA;
    const volumeWeight = (dim.lengthCm * dim.widthCm * dim.heightCm) / divisor;
    const chargeWeight = Math.max(actualWeight, volumeWeight);
    // Mock 单价：海运 12 USD/kg，空运 55 USD/kg
    const unitRate = serviceType === 'EXPRESS' ? 55 : 12;
    const minCharge = serviceType === 'EXPRESS' ? 150 : 50;
    const freightAmount = Math.max(chargeWeight * unitRate, minCharge);

    setFeeItems(prev => {
      const manualItems = prev.filter(f => !f.isAutoFreight);
      if (chargeWeight <= 0) return manualItems;
      const autoRow: InboundFeeItem = {
        id: 'AUTO_FREIGHT',
        feeType: 'FREIGHT',
        currency: 'USD',
        unitPrice: unitRate,
        quantity: Number(chargeWeight.toFixed(2)),
        exchangeRate: 1,
        amount: Number(freightAmount.toFixed(2)),
        remark: `实重${actualWeight.toFixed(2)}kg｜体积重${volumeWeight.toFixed(2)}kg｜计费重${chargeWeight.toFixed(2)}kg`,
        isAutoFreight: true,
      };
      return [autoRow, ...manualItems];
    });
  }, [dimensions, serviceType]);

  const handleClose = () => {
    setFeeDrawerVisible(false);
    onClose();
  };

  const handleSubmit = () => {
    onSubmit({ category, goodsName, remark: remarkText, dimensions });
    message.success('入库成功');
    handleClose();
  };

  const updateDimension = (index: number, field: keyof DimensionRow, value: number | null) => {
    setDimensions(prev => prev.map((row, i) =>
      i === index ? { ...row, [field]: value ?? 0 } : row
    ));
  };

  const addDimensionRow = () => {
    setDimensions(prev => [...prev, { weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, pieces: 1 }]);
  };

  const removeDimensionRow = (index: number) => {
    setDimensions(prev => prev.filter((_, i) => i !== index));
  };

  const handleFeeSubmit = (newFees: FeeItem[]) => {
    message.success(`已录入 ${newFees.length} 条费用`);
    setFeeDrawerVisible(false);
  };

  const footer = (
    <Space>
      <Button onClick={handleClose}>返回</Button>
      <Button type="primary" onClick={handleSubmit}>提交</Button>
    </Space>
  );

  return (
    <>
      <Drawer
        title={mode === 'inbound' ? '入库' : '编辑'}
        open={visible}
        onClose={handleClose}
        width={1200}
        placement="right"
        footer={footer}
        destroyOnClose
        styles={{ body: { overflowY: 'auto' } }}
      >
        {/* 主订单信息 */}
        <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="运单号">{orderNo ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="线路">
            {routeCode ? <Tag color="blue">{routeCode}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="服务类型">
            {serviceType ? <Tag>{serviceType}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="业务员">{salesPerson ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="用户">{customerName ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="订单日期">{orderDate ?? '-'}</Descriptions.Item>
        </Descriptions>

        {/* 同一主订单下所有子运单状态 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>第三方快递状态</Text>
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={siblings}
            rowClassName={(record) => record.trackingNo === trackingNo ? '' : ''}
            columns={[
              {
                title: '第三方运单',
                key: 'tracking',
                width: 240,
                render: (_: unknown, record: SiblingSubOrder) => (
                  <span style={{ fontWeight: record.trackingNo === trackingNo ? 600 : 400 }}>
                    {record.expressCompany} {record.trackingNo}
                    {record.trackingNo === trackingNo && <Tag color="blue" style={{ marginLeft: 8 }}>当前</Tag>}
                  </span>
                ),
              },
              {
                title: '子运单号',
                key: 'subOrderNo',
                width: 150,
                render: (_: unknown, record: SiblingSubOrder) =>
                  record.inboundStatus === 'COMPLETED' && record.subOrderNo
                    ? <Text style={{ color: '#52c41a' }}>{record.subOrderNo}</Text>
                    : <Text type="secondary">-</Text>,
              },
              {
                title: '物流状态',
                key: 'status',
                width: 120,
                render: (_: unknown, record: SiblingSubOrder) => {
                  const text = record.signStatus || '-';
                  const color = TRACKING_STATUS_COLOR[text] || 'processing';
                  return <Tag color={color}>{text}</Tag>;
                },
              },
              {
                title: '状态时间',
                dataIndex: 'signTime',
                width: 160,
                render: (text: string) => text || '-',
              },
            ]}
          />
        </div>

        {/* 客户申报的原始快递信息（用于入库核对） */}
        <div style={{
          background: '#e6f4ff',
          border: '1px solid #91caff',
          borderRadius: 6,
          padding: '12px 16px',
          marginBottom: 16,
        }}>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14, color: '#0958d9' }}>
            客户申报信息（订单创建时填报，仅供核对参考）
          </Text>
          <Descriptions size="small" column={5} styles={{ label: { color: '#595959' } }}>
            <Descriptions.Item label="申报重量">
              {declaredWeight !== undefined && declaredWeight > 0
                ? <span style={{ fontWeight: 600 }}>{declaredWeight.toFixed(2)} kg</span>
                : <Text type="secondary">未申报</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="申报件数">
              {declaredPieces !== undefined && declaredPieces > 0
                ? <span style={{ fontWeight: 600 }}>{declaredPieces} 件</span>
                : <Text type="secondary">未申报</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="申报尺寸">
              {(declaredLength || declaredWidth || declaredHeight)
                ? <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {declaredLength || '-'}×{declaredWidth || '-'}×{declaredHeight || '-'} cm
                  </span>
                : <Text type="secondary">未申报</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="申报体积重">
              {(declaredLength && declaredWidth && declaredHeight)
                ? (() => {
                    const vol = (declaredLength * declaredWidth * declaredHeight) / 6000;
                    const isHigher = vol > (declaredWeight || 0);
                    return (
                      <span style={{
                        fontWeight: 600,
                        color: isHigher ? '#fa8c16' : '#52c41a',
                      }}>
                        {vol.toFixed(2)} kg
                        {isHigher && <Text type="warning" style={{ marginLeft: 4, fontSize: 11 }}>(偏大)</Text>}
                      </span>
                    );
                  })()
                : <Text type="secondary">-</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="申报品类">
              {initCategory || <Text type="secondary">-</Text>}
            </Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
            💡 下方入库录入区已预填申报值，请按实际测量调整；如实际与申报差异过大，请勾选异常或备注说明。
          </div>
        </div>

        <Divider />

        {/* 入库录入区 — 突出显示 */}
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: 16, marginBottom: 0 }}>
        <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>入库信息录入</Text>
        <Table
          size="small"
          pagination={false}
          rowKey="id"
          dataSource={[{
            id: '1',
            tracking: `${expressCompany || ''} ${trackingNo || ''}`,
          }]}
          columns={[
            {
              title: '第三方运单',
              key: 'tracking',
              width: 200,
              render: () => (
                <span style={{ whiteSpace: 'nowrap' }}>
                  {expressCompany} {trackingNo}
                  {signStatus && <Text type="secondary" style={{ marginLeft: 4, fontSize: 11 }}>{signStatus}</Text>}
                </span>
              ),
            },
            {
              title: '类别',
              key: 'category',
              width: 140,
              render: () => (
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  value={category}
                  onChange={setCategory}
                  options={GOODS_CATEGORIES.map(c => ({ label: c, value: c }))}
                  allowClear
                  placeholder="选择类别"
                />
              ),
            },
            {
              title: '说明/品名',
              key: 'goodsName',
              width: 120,
              render: () => (
                <Input
                  size="small"
                  value={goodsName}
                  onChange={e => setGoodsName(e.target.value)}
                  placeholder="品名"
                />
              ),
            },
            {
              title: '重量KG',
              key: 'weightKg',
              width: 90,
              render: () => <InputNumber size="small" min={0} value={dimensions[0]?.weightKg} onChange={v => updateDimension(0, 'weightKg', v)} style={{ width: '100%' }} />,
            },
            {
              title: '长CM',
              key: 'lengthCm',
              width: 80,
              render: () => <InputNumber size="small" min={0} value={dimensions[0]?.lengthCm} onChange={v => updateDimension(0, 'lengthCm', v)} style={{ width: '100%' }} />,
            },
            {
              title: '宽CM',
              key: 'widthCm',
              width: 80,
              render: () => <InputNumber size="small" min={0} value={dimensions[0]?.widthCm} onChange={v => updateDimension(0, 'widthCm', v)} style={{ width: '100%' }} />,
            },
            {
              title: '高CM',
              key: 'heightCm',
              width: 80,
              render: () => <InputNumber size="small" min={0} value={dimensions[0]?.heightCm} onChange={v => updateDimension(0, 'heightCm', v)} style={{ width: '100%' }} />,
            },
            {
              title: '件数',
              key: 'pieces',
              width: 70,
              render: () => <InputNumber size="small" min={1} precision={0} value={dimensions[0]?.pieces} onChange={v => updateDimension(0, 'pieces', v)} style={{ width: '100%' }} />,
            },
            {
              title: '备注',
              key: 'remark',
              render: () => (
                <Input
                  size="small"
                  value={remarkText}
                  onChange={e => setRemarkText(e.target.value)}
                  placeholder="备注"
                />
              ),
            },
          ]}
        />

        {/* 图片上传留痕 */}
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>入库照片</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Image.PreviewGroup>
              {photos.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: 104, height: 104 }}>
                  <Image
                    src={url}
                    alt={`入库照片${idx + 1}`}
                    width={104}
                    height={104}
                    style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid #d9d9d9' }}
                  />
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(255,255,255,0.8)' }}
                  />
                </div>
              ))}
            </Image.PreviewGroup>
            <Upload
              showUploadList={false}
              accept="image/*"
              beforeUpload={(file) => {
                // Demo: 用本地 URL 预览，不实际上传
                const url = URL.createObjectURL(file);
                setPhotos(prev => [...prev, url]);
                message.success(`${file.name} 已添加`);
                return false;
              }}
            >
              <div style={{
                width: 104,
                height: 104,
                border: '1px dashed #d9d9d9',
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#999',
              }}>
                <PlusOutlined style={{ fontSize: 24, marginBottom: 4 }} />
                <span style={{ fontSize: 12 }}>上传照片</span>
              </div>
            </Upload>
          </div>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            拍摄货物照片留存，支持多张
          </Text>
        </div>
        </div>{/* 入库录入区结束 */}

        {/* 费用明细 — 第一行自动计算运费（只读），其余手动添加 */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong style={{ fontSize: 14 }}>费用明细</Text>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setFeeItems(prev => [...prev, {
                id: `FEE-${Date.now()}`,
                feeType: '',
                currency: 'USD',
                unitPrice: 0,
                quantity: 1,
                exchangeRate: 1,
                amount: 0,
                remark: '',
              }])}
            >
              添加费用
            </Button>
          </div>
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={feeItems}
            rowClassName={(record: InboundFeeItem) => record.isAutoFreight ? 'auto-freight-row' : ''}
            columns={[
              {
                title: '费用类型',
                dataIndex: 'feeType',
                width: 140,
                render: (v: string, record: InboundFeeItem, idx: number) => record.isAutoFreight
                  ? <Tag color="blue">{FEE_TYPE_LABEL[v] || v}（自动）</Tag>
                  : (
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={v || undefined}
                      onChange={val => setFeeItems(prev => prev.map((r, i) => i === idx ? { ...r, feeType: val } : r))}
                      placeholder="选择类型"
                      options={FEE_TYPE_OPTIONS.filter(o => o.value !== 'FREIGHT')}
                    />
                  ),
              },
              {
                title: '币种',
                dataIndex: 'currency',
                width: 100,
                render: (v: string, record: InboundFeeItem, idx: number) => record.isAutoFreight
                  ? <Text>{v}</Text>
                  : (
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={v}
                      onChange={val => setFeeItems(prev => prev.map((r, i) => i === idx ? { ...r, currency: val, exchangeRate: exchangeRateMap[val] ?? 1 } : r))}
                      options={CURRENCY_OPTIONS}
                    />
                  ),
              },
              {
                title: '单价',
                dataIndex: 'unitPrice',
                width: 100,
                render: (v: number, record: InboundFeeItem, idx: number) => record.isAutoFreight
                  ? <Text>{v.toFixed(2)}</Text>
                  : (
                    <InputNumber
                      size="small"
                      value={v}
                      onChange={val => {
                        const up = val ?? 0;
                        setFeeItems(prev => prev.map((r, i) => i === idx ? { ...r, unitPrice: up, amount: Number((up * r.quantity).toFixed(2)) } : r));
                      }}
                      style={{ width: '100%' }}
                    />
                  ),
              },
              {
                title: '数量',
                dataIndex: 'quantity',
                width: 90,
                render: (v: number, record: InboundFeeItem, idx: number) => record.isAutoFreight
                  ? <Text>{v}</Text>
                  : (
                    <InputNumber
                      size="small"
                      min={0}
                      value={v}
                      onChange={val => {
                        const q = val ?? 0;
                        setFeeItems(prev => prev.map((r, i) => i === idx ? { ...r, quantity: q, amount: Number((r.unitPrice * q).toFixed(2)) } : r));
                      }}
                      style={{ width: '100%' }}
                    />
                  ),
              },
              {
                title: '汇率',
                dataIndex: 'exchangeRate',
                width: 80,
                render: (v: number) => <Text>{v}</Text>,
              },
              {
                title: '金额',
                dataIndex: 'amount',
                width: 100,
                align: 'right' as const,
                render: (v: number, record: InboundFeeItem) => (
                  <Text strong style={record.isAutoFreight ? { color: '#1677ff' } : undefined}>
                    {v.toFixed(2)}
                  </Text>
                ),
              },
              {
                title: '备注',
                dataIndex: 'remark',
                ellipsis: true,
                render: (v: string, record: InboundFeeItem, idx: number) => record.isAutoFreight
                  ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>
                  : (
                    <Input
                      size="small"
                      value={v}
                      onChange={e => setFeeItems(prev => prev.map((r, i) => i === idx ? { ...r, remark: e.target.value } : r))}
                      placeholder="备注"
                    />
                  ),
              },
              {
                title: '',
                key: 'action',
                width: 40,
                render: (_: unknown, record: InboundFeeItem, idx: number) => record.isAutoFreight
                  ? null
                  : (
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => setFeeItems(prev => prev.filter((_, i) => i !== idx))}
                    />
                  ),
              },
            ]}
            summary={() => {
              const total = feeItems.reduce((sum, f) => sum + (f.amount || 0), 0);
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5} align="right"><Text strong>合计</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right"><Text strong style={{ color: '#1677ff' }}>USD {total.toFixed(2)}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} colSpan={2} />
                </Table.Summary.Row>
              );
            }}
          />
        </div>
      </Drawer>

      <FeeEntryDrawer
        visible={feeDrawerVisible}
        orderId={orderId}
        routeCode={routeCode ?? ''}
        serviceType={(serviceType as 'EXPRESS' | 'STANDARD') ?? 'STANDARD'}
        salesPerson={salesPerson}
        customerName={customerName}
        orderDate={orderDate}
        onSubmit={handleFeeSubmit}
        onClose={() => setFeeDrawerVisible(false)}
      />
    </>
  );
};

export default InboundDetailDrawer;
