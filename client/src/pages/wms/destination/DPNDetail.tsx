import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ScanOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface DpnRecordLite {
  id: string;
  dpnNo: string;
  originStation: string;
  toStation: string;
  carrierCompany: string;
  thirdPartyNo: string;
  waybillNos: string[];
}

interface DpnDetailProps {
  dpn: DpnRecordLite;
  onWaybillChange?: (dpnId: string, trackingNos: string[], totalWeight: number, totalPieces: number) => void;
}

type PaymentStatus = 'PAID' | 'UNPAID';

interface WaybillRecord {
  id: string;
  trackingNo: string;
  orderNo: string;
  customerCode: string;
  customerName: string;
  jobNo: string;
  station: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail: string;
  recipientPostalCode: string;
  recipientCountry: string;
  recipientCity: string;
  recipientDistrict: string;
  recipientAddress: string;
  pieces: number;
  weightKg: number;
  paymentMethod: 'COD' | 'PREPAID';
  paymentStatus: PaymentStatus;
  paymentAmount: number;
  currency: string;
  inboundAt: string;
}

const WAYBILL_POOL: WaybillRecord[] = Array.from({ length: 32 }, (_, idx) => ({
  id: `WB-${idx + 1}`,
  trackingNo: `19102${String(1000 + idx).padStart(4, '0')}${String((idx % 9) + 1).padStart(2, '0')}`,
  orderNo: `S-202603${String((idx % 28) + 1).padStart(2, '0')}${String(100 + idx).padStart(6, '0')}`,
  customerCode: `C${String(2000 + idx).slice(-4)}`,
  customerName: ['联调A客户', '联调B客户', '联调C客户', '联调D客户'][idx % 4],
  jobNo: `S-JOB26030${String(Math.floor(idx / 3)).padStart(4, '0')}`,
  station: idx % 2 === 0 ? 'IKEJ STA' : 'ABUJ STA',
  recipientName: ['Karena', 'Tom', 'Smile', 'Kwame', 'Ada', 'Chidi'][idx % 6],
  recipientPhone: `+234-800-100-${String(1000 + idx).slice(-4)}`,
  recipientEmail: `receiver${idx + 1}@mail.test`,
  recipientPostalCode: `LAG-${String(1000 + idx).slice(-4)}`,
  recipientCountry: '尼日利亚',
  recipientCity: idx % 2 === 0 ? '拉各斯' : '阿布贾',
  recipientDistrict: idx % 2 === 0 ? 'IKEJA' : 'WUSE',
  recipientAddress: `No.${10 + idx} Allen Avenue, ${idx % 2 === 0 ? 'Ikeja' : 'Wuse'}, Nigeria`,
  pieces: 1 + (idx % 3),
  weightKg: Number((2.6 + idx * 0.75).toFixed(2)),
  paymentMethod: idx % 2 === 0 ? 'COD' : 'PREPAID',
  paymentStatus: idx % 2 === 0 ? 'UNPAID' : 'PAID',
  paymentAmount: idx % 2 === 0 ? 12000 + idx * 320 : 0,
  currency: 'USD',
  inboundAt: dayjs().subtract(idx % 7, 'day').format('YYYY/MM/DD HH:mm:ss'),
}));

const normalizeWaybillNo = (value: string) => value.replace(/\s/g, '').toUpperCase();

export const DPNDetail: React.FC<DpnDetailProps> = ({ dpn, onWaybillChange }) => {
  const [scanInput, setScanInput] = useState('');
  const [boundIds, setBoundIds] = useState<string[]>([]);

  useEffect(() => {
    const initialNos = new Set(dpn.waybillNos.map(normalizeWaybillNo));
    const matchedIds = WAYBILL_POOL.filter((row) => initialNos.has(normalizeWaybillNo(row.trackingNo))).map((row) => row.id);
    setBoundIds(matchedIds);
  }, [dpn.id, dpn.waybillNos]);

  const boundWaybills = useMemo(
    () => WAYBILL_POOL.filter((row) => boundIds.includes(row.id)),
    [boundIds],
  );

  const summary = useMemo(() => ({
    count: boundWaybills.length,
    pieces: boundWaybills.reduce((sum, row) => sum + row.pieces, 0),
    weight: boundWaybills.reduce((sum, row) => sum + row.weightKg, 0),
    unpaidCount: boundWaybills.filter((row) => row.paymentStatus !== 'PAID').length,
  }), [boundWaybills]);

  const syncParentByIds = (ids: string[]) => {
    if (!onWaybillChange) return;
    const rows = WAYBILL_POOL.filter((row) => ids.includes(row.id));
    const totalWeight = rows.reduce((sum, row) => sum + row.weightKg, 0);
    const totalPieces = rows.reduce((sum, row) => sum + row.pieces, 0);
    onWaybillChange(
      dpn.id,
      rows.map((row) => row.trackingNo),
      totalWeight,
      totalPieces,
    );
  };

  const bindFromInput = () => {
    const tokens = scanInput
      .split(/[,，\s]+/)
      .map((v) => normalizeWaybillNo(v.trim()))
      .filter(Boolean);
    if (tokens.length === 0) {
      message.warning('请先扫码或输入运单号');
      return;
    }

    const current = new Set(boundIds);
    const matchedRows = WAYBILL_POOL.filter((row) => tokens.includes(normalizeWaybillNo(row.trackingNo)));
    const matchedIds = matchedRows.map((row) => row.id);
    const addedIds = matchedIds.filter((id) => !current.has(id));
    const missingCount = tokens.length - matchedRows.length;

    if (addedIds.length === 0 && missingCount === 0) {
      message.info('运单已在清单中');
      return;
    }

    if (addedIds.length > 0) {
      setBoundIds((prev) => {
        const next = Array.from(new Set([...prev, ...addedIds]));
        syncParentByIds(next);
        return next;
      });
    }
    setScanInput('');
    if (missingCount > 0) {
      message.warning(`已添加 ${addedIds.length} 条，${missingCount} 条未匹配`);
      return;
    }
    message.success(`已添加 ${addedIds.length} 条运单`);
  };

  const handleUnbind = (id: string) => {
    setBoundIds((prev) => {
      const next = prev.filter((rowId) => rowId !== id);
      syncParentByIds(next);
      return next;
    });
    message.success('已移除运单');
  };

  const columns: ColumnsType<WaybillRecord> = [
    { title: '运单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 170 },
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 180 },
    {
      title: '客户',
      key: 'customer',
      width: 170,
      render: (_: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.customerName}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{record.customerCode}</Typography.Text>
        </Space>
      ),
    },
    {
      title: '收件信息',
      key: 'recipientInfo',
      width: 420,
      render: (_: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.recipientName} / {record.recipientPhone}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.recipientEmail} / {record.recipientPostalCode}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.recipientCountry} {record.recipientCity} {record.recipientDistrict}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.recipientAddress}
          </Typography.Text>
        </Space>
      ),
    },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 70, align: 'right' },
    { title: '重量Kg', dataIndex: 'weightKg', key: 'weightKg', width: 90, align: 'right' },
    {
      title: '付款',
      key: 'payment',
      width: 180,
      render: (_: unknown, record) => (
        <Space direction="vertical" size={0}>
          <span>
            {record.paymentMethod === 'COD' ? '到付' : '预付'}
            <Tag color={record.paymentStatus === 'PAID' ? 'green' : 'orange'} style={{ marginLeft: 6 }}>
              {record.paymentStatus === 'PAID' ? '已付' : '未付'}
            </Tag>
          </span>
          {record.paymentStatus !== 'PAID' && (
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
              {record.currency} {record.paymentAmount.toLocaleString()}
            </span>
          )}
        </Space>
      ),
    },
    { title: '入库时间', dataIndex: 'inboundAt', key: 'inboundAt', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_: unknown, record) => (
        <Button type="link" size="small" onClick={() => handleUnbind(record.id)}>
          移除
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Space size={[8, 8]} wrap>
        <Typography.Text strong style={{ fontSize: 16 }}>{dpn.dpnNo}</Typography.Text>
        <Tag color="blue">配送DPN</Tag>
        <Typography.Text type="secondary">
          路线 {dpn.originStation} {'->'} {dpn.toStation}
        </Typography.Text>
        <Typography.Text type="secondary">
          三方运输 {dpn.carrierCompany} / {dpn.thirdPartyNo || '-'}
        </Typography.Text>
      </Space>

      <Space size={[8, 8]} wrap>
        <Tag>已绑 {summary.count} 单</Tag>
        <Tag>件数 {summary.pieces}</Tag>
        <Tag color="processing">重量 {summary.weight.toFixed(2)} Kg</Tag>
        <Tag color={summary.unpaidCount > 0 ? 'orange' : 'green'}>
          未付 {summary.unpaidCount} 单
        </Tag>
      </Space>

      <div style={{ background: '#fafafa', padding: 10, borderRadius: 8 }}>
        <Space wrap>
          <Input
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="扫码枪输入或手动录入运单号（可逗号分隔）"
            onPressEnter={bindFromInput}
            style={{ width: 420 }}
            suffix={<ScanOutlined />}
          />
          <Button type="primary" size="small" onClick={bindFromInput}>添加运单</Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={boundWaybills}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        locale={{ emptyText: '暂无已绑定运单，请扫码或手动输入运单号添加' }}
        scroll={{ x: 1700, y: 'calc(100vh - 420px)' }}
      />
    </div>
  );
};
