import React, { useState, useMemo } from 'react';
import { Card, Table, Button, Statistic, Row, Col, Modal, Form, Input, InputNumber, DatePicker, Space, message, Popconfirm } from 'antd';
import { PlusOutlined, DownloadOutlined, DeleteOutlined, EditOutlined, ToolOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface AssetItem {
  id: string;
  purchaseDate: string;
  assetName: string;
  qty: number;
  unitPrice: number;
  bookValue: number;
  residualRate: number;
  residualValue: number;
  annualDepr: number;
  depr: number[];  // 12 months
  yearTotal: number;
}

const fmt = (v: number) => `¥${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const generateMockAssets = (): AssetItem[] => {
  const items = [
    { date: '2017-11-25', name: '办公桌', qty: 1, price: 2950 },
    { date: '2017-11-25', name: '电脑', qty: 7, price: 2399 },
    { date: '2017-11-25', name: '文件矮柜', qty: 1, price: 1478 },
    { date: '2017-11-25', name: '快递打印机', qty: 2, price: 474 },
    { date: '2017-11-25', name: '带称地牛（海运仓）', qty: 1, price: 1980 },
    { date: '2017-11-25', name: '台称', qty: 1, price: 520 },
    { date: '2017-11-25', name: '碎纸机', qty: 1, price: 288 },
    { date: '2017-11-25', name: '茶吧', qty: 1, price: 299 },
    { date: '2017-11-25', name: '物流托盘', qty: 5, price: 80 },
    { date: '2017-11-25', name: '打印机', qty: 1, price: 1699 },
    { date: '2017-11-25', name: '手推车', qty: 1, price: 255 },
    { date: '2020-06-15', name: '空调', qty: 2, price: 3500 },
    { date: '2021-03-10', name: '货架', qty: 10, price: 450 },
    { date: '2024-01-15', name: '托盘堆垛车/手动搬动车', qty: 1, price: 26500 },
    { date: '2024-07-31', name: '柴油平衡重式叉车', qty: 1, price: 65300 },
    { date: '2024-10-17', name: '惠普星14笔记本电脑', qty: 1, price: 5496 },
    { date: '2024-12-05', name: '海运仓采购一地牛', qty: 1, price: 8850 },
  ];

  return items.map((item, idx) => {
    const bookValue = item.qty * item.price;
    const residualRate = 0.05;
    const residualValue = +(bookValue * residualRate).toFixed(2);
    const annualDepr = +(bookValue - residualValue).toFixed(2);
    const monthlyDepr = +(annualDepr / 12).toFixed(2);
    const purchaseMonth = dayjs(item.date).month(); // 0-indexed
    const purchaseYear = dayjs(item.date).year();
    const depr: number[] = [];
    for (let m = 0; m < 12; m++) {
      if (purchaseYear > 2024 || (purchaseYear === 2024 && m < purchaseMonth)) {
        depr.push(0);
      } else {
        depr.push(monthlyDepr);
      }
    }
    const yearTotal = depr.reduce((s, v) => s + v, 0);

    return {
      id: `ASSET-${idx}`,
      purchaseDate: item.date,
      assetName: item.name,
      qty: item.qty,
      unitPrice: item.price,
      bookValue,
      residualRate,
      residualValue,
      annualDepr,
      depr,
      yearTotal: +yearTotal.toFixed(2),
    };
  });
};

export const AssetDepreciation: React.FC = () => {
  const [assets, setAssets] = useState<AssetItem[]>(() => generateMockAssets());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const stats = useMemo(() => ({
    totalBook: assets.reduce((s, a) => s + a.bookValue, 0),
    totalYearDepr: assets.reduce((s, a) => s + a.yearTotal, 0),
    count: assets.length,
  }), [assets]);

  const handleAdd = () => { setEditingId(null); form.resetFields(); form.setFieldsValue({ residualRate: 5 }); setModalOpen(true); };
  const handleEdit = (record: AssetItem) => {
    setEditingId(record.id);
    form.setFieldsValue({ assetName: record.assetName, qty: record.qty, unitPrice: record.unitPrice, purchaseDate: dayjs(record.purchaseDate), residualRate: record.residualRate * 100 });
    setModalOpen(true);
  };
  const handleDelete = (id: string) => { setAssets(prev => prev.filter(a => a.id !== id)); message.success('已删除'); };

  const handleSave = () => {
    form.validateFields().then(values => {
      const bookValue = values.qty * values.unitPrice;
      const rr = values.residualRate / 100;
      const residualValue = +(bookValue * rr).toFixed(2);
      const annualDepr = +(bookValue - residualValue).toFixed(2);
      const monthlyDepr = +(annualDepr / 12).toFixed(2);
      const pDate = values.purchaseDate.format('YYYY-MM-DD');
      const pMonth = values.purchaseDate.month();
      const pYear = values.purchaseDate.year();
      const depr: number[] = [];
      for (let m = 0; m < 12; m++) {
        depr.push(pYear > 2024 || (pYear === 2024 && m < pMonth) ? 0 : monthlyDepr);
      }
      const item: AssetItem = {
        id: editingId || `ASSET-${Date.now()}`,
        purchaseDate: pDate, assetName: values.assetName, qty: values.qty, unitPrice: values.unitPrice,
        bookValue, residualRate: rr, residualValue, annualDepr, depr, yearTotal: +depr.reduce((s, v) => s + v, 0).toFixed(2),
      };
      if (editingId) {
        setAssets(prev => prev.map(a => a.id === editingId ? item : a));
      } else {
        setAssets(prev => [...prev, item]);
      }
      setModalOpen(false);
      message.success(editingId ? '已更新' : '已添加');
    });
  };

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const columns: any[] = [
    { title: '购入时间', dataIndex: 'purchaseDate', width: 110, fixed: 'left' as const },
    { title: '品名', dataIndex: 'assetName', width: 160, fixed: 'left' as const },
    { title: '数量', dataIndex: 'qty', width: 60, align: 'right' as const },
    { title: '单价(¥)', dataIndex: 'unitPrice', width: 100, align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: '账面金额(¥)', dataIndex: 'bookValue', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '残值(5%)', dataIndex: 'residualValue', width: 100, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '年折旧额(¥)', dataIndex: 'annualDepr', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
    ...months.map((label, i) => ({
      title: label, key: `depr_${i}`, width: 95, align: 'right' as const,
      render: (_: unknown, record: AssetItem) => record.depr[i] > 0 ? record.depr[i].toFixed(2) : '—',
    })),
    { title: '年合计(¥)', dataIndex: 'yearTotal', width: 120, align: 'right' as const, fixed: 'right' as const, render: (v: number) => <b>{fmt(v)}</b> },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: (_: unknown, record: AssetItem) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card><Statistic title="资产总额" value={stats.totalBook} prefix="¥" precision={2} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={8}><Card><Statistic title="本年折旧" value={stats.totalYearDepr} prefix="¥" precision={2} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={8}><Card><Statistic title="资产项目数" value={stats.count} prefix={<ToolOutlined />} suffix="项" /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增资产</Button>
          <Button icon={<DownloadOutlined />}>导出Excel</Button>
        </Space>
      </Card>

      <Card>
        <Table rowKey="id" columns={columns} dataSource={assets} bordered size="small"
          scroll={{ x: 2400 }} pagination={false}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={4}><b>合计</b></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><b>{fmt(stats.totalBook)}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={2} colSpan={2} />
                {months.map((_, i) => (
                  <Table.Summary.Cell key={i} index={3 + i} align="right">
                    <b>{assets.reduce((s, a) => s + a.depr[i], 0).toFixed(2)}</b>
                  </Table.Summary.Cell>
                ))}
                <Table.Summary.Cell index={20} align="right"><b>{fmt(stats.totalYearDepr)}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={21} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      <Modal title={editingId ? '编辑资产' : '新增资产'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="assetName" label="品名" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="qty" label="数量" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="unitPrice" label="单价(¥)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="purchaseDate" label="购入时间" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="residualRate" label="残值率(%)" rules={[{ required: true }]}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
