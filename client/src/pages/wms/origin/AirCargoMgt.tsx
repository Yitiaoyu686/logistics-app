import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { jobApi, warehouseApi } from '../../../api';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../../components/ListPageToolbar';
import type { ShippingUnit } from '../../../types/core';

const UNIT_STATUS_COLORS: Record<string, string> = {
  EMPTY: 'default',
  LOADING: 'processing',
  SEALED: 'success',
  SHIPPED: 'purple',
  ARRIVED: 'blue',
};

const AIR_UNIT_TYPES = ['PALLET', 'BOX'] as const;
const SEA_UNIT_TYPES = ['20GP', '40GP', '40HQ', '45HQ'] as const;

export const AirCargoMgt = ({
  warehouseId,
  businessMode = 'AIR',
}: {
  warehouseId?: string;
  businessMode?: 'ALL' | 'SEA' | 'AIR';
}) => {
  const transportMode: 'SEA' | 'AIR' = businessMode === 'SEA' ? 'SEA' : 'AIR';

  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<ShippingUnit[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | string>('ALL');

  const [createVisible, setCreateVisible] = useState(false);
  const [bindVisible, setBindVisible] = useState(false);
  const [currentUnit, setCurrentUnit] = useState<ShippingUnit | null>(null);

  const [createForm] = Form.useForm();
  const [bindForm] = Form.useForm();

  const fetchData = async (queryKeyword = keyword) => {
    setLoading(true);
    try {
      const [unitRes, jobRes]: any[] = await Promise.all([
        warehouseApi.listUnits({ transportMode, warehouseId, keyword: queryKeyword || undefined }),
        jobApi.list({ transportType: transportMode }),
      ]);
      const unitRows = Array.isArray(unitRes?.data) ? unitRes.data : [];
      setUnits(unitRows);
      setJobs(Array.isArray(jobRes?.data) ? jobRes.data : []);
    } catch (err: any) {
      message.error(err?.message || '加载装箱数据失败');
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [transportMode, warehouseId]);

  const filteredUnits = useMemo(() => {
    let rows = [...units];
    if (statusFilter !== 'ALL') {
      rows = rows.filter((row) => row.status === statusFilter);
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      rows = rows.filter((row) =>
        String(row.unitNo || '').toLowerCase().includes(kw)
        || String(row.jobNo || '').toLowerCase().includes(kw)
        || String(row.route || '').toLowerCase().includes(kw)
      );
    }
    return rows;
  }, [units, statusFilter, keyword]);

  const stats = useMemo(() => {
    return {
      total: filteredUnits.length,
      empty: filteredUnits.filter((row) => row.status === 'EMPTY').length,
      loading: filteredUnits.filter((row) => row.status === 'LOADING').length,
      sealed: filteredUnits.filter((row) => row.status === 'SEALED').length,
      boundJob: filteredUnits.filter((row) => !!row.jobNo).length,
    };
  }, [filteredUnits]);

  const unitTypeOptions = transportMode === 'SEA' ? SEA_UNIT_TYPES : AIR_UNIT_TYPES;

  const handleQuery = () => {
    const normalizedKeyword = keyword.trim();
    setKeyword(normalizedKeyword);
    void fetchData(normalizedKeyword);
  };

  const handleReset = () => {
    setKeyword('');
    setStatusFilter('ALL');
    void fetchData('');
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await warehouseApi.createUnit({
        unitNo: String(values.unitNo).trim(),
        unitType: values.unitType,
        transportMode,
        maxWeight: Number(values.maxWeight),
        maxVolume: Number(values.maxVolume),
        warehouse: values.warehouse || null,
        warehouseId: warehouseId || null,
        route: values.route || null,
        remark: values.remark || null,
      });
      message.success('集装号创建成功');
      setCreateVisible(false);
      createForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message || '创建失败');
    }
  };

  const handleOpenBind = (row: ShippingUnit) => {
    setCurrentUnit(row);
    bindForm.setFieldsValue({ jobNo: row.jobNo || undefined });
    setBindVisible(true);
  };

  const handleBind = async () => {
    if (!currentUnit) return;
    try {
      const values = await bindForm.validateFields();
      await warehouseApi.updateUnit(currentUnit.id, { jobNo: values.jobNo || null });
      message.success(values.jobNo ? '任务绑定成功' : '任务解绑成功');
      setBindVisible(false);
      setCurrentUnit(null);
      bindForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message || '绑定失败');
    }
  };

  const handleSeal = async (row: ShippingUnit) => {
    try {
      await warehouseApi.sealUnit(row.id, row.sealNo || undefined);
      message.success('封箱成功');
      fetchData();
    } catch (err: any) {
      message.error(err?.message || '封箱失败');
    }
  };

  const handleDelete = async (row: ShippingUnit) => {
    try {
      await warehouseApi.deleteUnit(row.id);
      message.success('已删除');
      fetchData();
    } catch (err: any) {
      message.error(err?.message || '删除失败');
    }
  };

  const columns = [
    {
      title: '集装号',
      dataIndex: 'unitNo',
      width: 160,
      render: (value: string, row: ShippingUnit) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{value}</span>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>{row.unitType}</span>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <Tag color={UNIT_STATUS_COLORS[value] || 'default'}>{value}</Tag>,
    },
    {
      title: '任务号',
      dataIndex: 'jobNo',
      width: 180,
      render: (value: string) => value || '-',
    },
    {
      title: '装载情况',
      width: 240,
      render: (_: unknown, row: ShippingUnit) => (
        <Space direction="vertical" size={0}>
          <span>
            重量 {Number(row.currentWeight || 0).toFixed(2)} / {Number(row.maxWeight || 0).toFixed(2)} kg
          </span>
          <span>
            体积 {Number(row.currentVolume || 0).toFixed(3)} / {Number(row.maxVolume || 0).toFixed(3)} m3
          </span>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
            订单 {Array.isArray(row.orderIds) ? row.orderIds.length : 0} / 件数 {Number(row.loadedPieces || 0)}
          </span>
        </Space>
      ),
    },
    {
      title: '线路',
      dataIndex: 'route',
      width: 220,
      render: (value: string) => value || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, row: ShippingUnit) => (
        <Space size="small">
          <Button size="small" onClick={() => handleOpenBind(row)}>绑定任务</Button>
          <Button
            size="small"
            onClick={() => handleSeal(row)}
            disabled={row.status !== 'LOADING' && row.status !== 'EMPTY'}
          >
            封箱
          </Button>
          <Popconfirm
            title="确认删除该集装号？"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(row)}
            okText="删除"
            cancelText="取消"
          >
            <Button size="small" danger disabled={Array.isArray(row.orderIds) && row.orderIds.length > 0}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col><Tag color="blue">总数 {stats.total}</Tag></Col>
        <Col><Tag>空闲 {stats.empty}</Tag></Col>
        <Col><Tag color="processing">装载中 {stats.loading}</Tag></Col>
        <Col><Tag color="success">已封箱 {stats.sealed}</Tag></Col>
        <Col><Tag color="purple">已绑任务 {stats.boundJob}</Tag></Col>
      </Row>

      <ListPageToolbarCard style={{ marginBottom: 12 }}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 320px" minWidth={260}>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onPressEnter={handleQuery}
                placeholder="搜索集装号/任务号/线路"
                allowClear
                prefix={<SearchOutlined />}
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={160}>
              <Select value={statusFilter} onChange={setStatusFilter}>
                <Select.Option value="ALL">全部状态</Select.Option>
                <Select.Option value="EMPTY">EMPTY</Select.Option>
                <Select.Option value="LOADING">LOADING</Select.Option>
                <Select.Option value="SEALED">SEALED</Select.Option>
                <Select.Option value="SHIPPED">SHIPPED</Select.Option>
                <Select.Option value="ARRIVED">ARRIVED</Select.Option>
              </Select>
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleQuery}>查询</Button>
            <Button onClick={handleReset}>重置</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void fetchData()}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>新增集装号</Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={filteredUnits}
        scroll={{ x: 1280, y: 'calc(100vh - 420px)' }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
      />

      <Modal
        title={`新增${transportMode === 'SEA' ? '海运' : '空运'}集装号`}
        open={createVisible}
        onCancel={() => {
          setCreateVisible(false);
          createForm.resetFields();
        }}
        onOk={handleCreate}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            unitType: unitTypeOptions[0],
            maxWeight: transportMode === 'SEA' ? 26000 : 1500,
            maxVolume: transportMode === 'SEA' ? 76 : 5,
            warehouse: transportMode === 'SEA' ? 'CN' : 'CN',
          }}
        >
          <Form.Item name="unitNo" label="集装号" rules={[{ required: true, message: '请输入集装号' }]}> 
            <Input placeholder="例如 AK001 / CNT-001" />
          </Form.Item>
          <Form.Item name="unitType" label="类型" rules={[{ required: true, message: '请选择类型' }]}> 
            <Select>
              {unitTypeOptions.map((item) => (
                <Select.Option key={item} value={item}>{item}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="maxWeight" label="最大承重(kg)" rules={[{ required: true, message: '请输入最大承重' }]}> 
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxVolume" label="最大体积(m3)" rules={[{ required: true, message: '请输入最大体积' }]}> 
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="warehouse" label="仓库代码">
            <Input placeholder="CN / US" />
          </Form.Item>
          <Form.Item name="route" label="线路">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="绑定任务"
        open={bindVisible}
        onCancel={() => {
          setBindVisible(false);
          setCurrentUnit(null);
          bindForm.resetFields();
        }}
        onOk={handleBind}
        okText="确认"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={bindForm} layout="vertical">
          <Form.Item name="jobNo" label="任务号（留空则解绑）">
            <Select allowClear showSearch optionFilterProp="label" placeholder="请选择任务号">
              {jobs.map((job: any) => (
                <Select.Option
                  key={job.jobNo}
                  value={job.jobNo}
                  label={`${job.jobNo} ${job.route ? `(${job.route})` : ''}`}
                >
                  {job.jobNo} {job.route ? `(${job.route})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
