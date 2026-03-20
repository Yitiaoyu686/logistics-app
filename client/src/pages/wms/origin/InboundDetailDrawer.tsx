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

const { Text } = Typography;

const GOODS_CATEGORIES = [
  '日用百货', '机械/五金/仪表', '食品', '化妆品', '保健品',
  '药品', '电子产品', '服装/纺织品', '文件', '其他',
];

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
  const [feeItems, setFeeItems] = useState<{ project: string; unitPrice: number; quantity: number }[]>([]);

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
      setDimensions([{ weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, pieces: 1 }]);
      setPhotos([]);
      setFeeItems([]);
    }
  }, [visible, initCategory, initGoodsName, initRemark]);

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

        {/* 录入费用 — 内嵌表格 */}
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>录入费用</Text>
          <Table
            size="small"
            pagination={false}
            rowKey={(_, idx) => String(idx)}
            dataSource={feeItems}
            columns={[
              {
                title: '序号',
                key: 'index',
                width: 60,
                render: (_: unknown, __: unknown, idx: number) => idx + 1,
              },
              {
                title: '项目',
                key: 'project',
                width: 160,
                render: (_: unknown, record: any, idx: number) => (
                  <Select
                    size="small"
                    style={{ width: '100%' }}
                    value={record.project || undefined}
                    onChange={v => {
                      setFeeItems(prev => prev.map((r, i) => i === idx ? { ...r, project: v } : r));
                    }}
                    placeholder="选择项目"
                    options={[
                      '首重', '续重', '药品附加运费', '进口报关费', '到门费用',
                      '折扣', '包装费', '仓储费', '保险费', '其他',
                    ].map(p => ({ label: p, value: p }))}
                  />
                ),
              },
              {
                title: '单价USD',
                key: 'unitPrice',
                width: 120,
                render: (_: unknown, record: any, idx: number) => (
                  <InputNumber
                    size="small"
                    value={record.unitPrice}
                    onChange={v => {
                      setFeeItems(prev => prev.map((r, i) => i === idx ? { ...r, unitPrice: v ?? 0 } : r));
                    }}
                    style={{ width: '100%' }}
                  />
                ),
              },
              {
                title: '数量',
                key: 'quantity',
                width: 100,
                render: (_: unknown, record: any, idx: number) => (
                  <InputNumber
                    size="small"
                    min={0}
                    value={record.quantity}
                    onChange={v => {
                      setFeeItems(prev => prev.map((r, i) => i === idx ? { ...r, quantity: v ?? 0 } : r));
                    }}
                    style={{ width: '100%' }}
                  />
                ),
              },
              {
                title: '小计USD',
                key: 'subtotal',
                width: 100,
                render: (_: unknown, record: any) => (
                  <Text>{((record.unitPrice || 0) * (record.quantity || 0)).toFixed(2)}</Text>
                ),
              },
              {
                title: '操作',
                key: 'action',
                width: 60,
                render: (_: unknown, __: unknown, idx: number) => (
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
          />
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => setFeeItems(prev => [...prev, { project: '', unitPrice: 0, quantity: 1 }])}
            style={{ marginTop: 8 }}
          >
            添加
          </Button>
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
