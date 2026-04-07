import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, InputNumber,
  Space, Tag, message, Row, Col, Statistic, Typography, Alert
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DownloadOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type {
  FeeRecord, FeeType, FeeDirection, Currency, FeeStatus
} from '../../types/finance';
import {
  FEE_TYPE_CONFIG, FEE_STATUS_CONFIG, CURRENCY_CONFIG
} from '../../types/finance';
import { feeApi, orderApi, jobApi, warehouseApi } from '../../api';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../components/ListPageToolbar';
import { FeeInputDetail } from './FeeInputDetail';
import { useOrderBaseOptions } from '../../hooks/useOrderBaseOptions';

const { Option } = Select;
const { Text } = Typography;

// 关联类型配置
const RELATED_TYPE_OPTIONS = [
  { value: 'ORDER', label: '订单' },
  { value: 'UNIT', label: '集装单元' },
  { value: 'JOB', label: '任务' },
  { value: 'TRANSFER', label: '调拨单' }
];

type RelatedType = 'ORDER' | 'UNIT' | 'JOB' | 'TRANSFER';
type RelatedOption = { value: string; relatedNo: string; label: string };
type MasterOrderRef = { id: string; orderNo?: string; customerName?: string };
type SubOrderRef = { id: string; subOrderNo?: string; expressTrackingNo?: string };
type OrderSearchPayload = { masterOrders?: MasterOrderRef[]; subOrders?: SubOrderRef[] };
type UnitRef = { id: string; unitNo?: string; unitType?: string; status?: string };
type JobRef = { jobNo: string; route?: string; status?: string };
type TransferRef = { id: string; transferNo?: string; fromWarehouse?: string; toWarehouse?: string };

const getData = <T,>(raw: unknown): T | undefined => {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as { data?: T }).data;
  }
  return undefined;
};

const toArray = <T,>(raw: unknown): T[] => (Array.isArray(raw) ? (raw as T[]) : []);

export const FeeInput: React.FC = () => {
  const { baseOptions, currencyOptions } = useOrderBaseOptions();
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [coverage, setCoverage] = useState<{ ORDER: number; UNIT: number; JOB: number } | null>(null);

  const loadFees = async () => {
    setLoading(true);
    try {
      const res = await feeApi.list();
      setRecords(res.data || res || []);
    } catch {
      message.error('获取费用数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCoverage = async () => {
    try {
      const raw = await feeApi.coverage();
      const payload = getData<{ ORDER?: number; UNIT?: number; JOB?: number }>(raw) || {};
      setCoverage({
        ORDER: Number(payload.ORDER || 0),
        UNIT: Number(payload.UNIT || 0),
        JOB: Number(payload.JOB || 0),
      });
    } catch {
      setCoverage(null);
    }
  };

  useEffect(() => {
    loadFees();
    void loadCoverage();
  }, []);

  // 筛选条件
  const [searchText, setSearchText] = useState('');
  const [filterFeeType, setFilterFeeType] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<FeeDirection | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<FeeStatus | 'ALL'>('ALL');
  const [filterCurrency, setFilterCurrency] = useState<string>('ALL');

  // 创建/编辑
  const [createVisible, setCreateVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FeeRecord | null>(null);
  const [form] = Form.useForm();
  const [relatedOptions, setRelatedOptions] = useState<RelatedOption[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const searchTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }
  }, []);

  // 详情
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetailId, setCurrentDetailId] = useState('');

  const feeTypeOptions = useMemo(() => {
    if ((baseOptions.FEE_TYPE || []).length > 0) {
      return baseOptions.FEE_TYPE.map((item) => ({ value: item.code, label: item.label }));
    }
    return (Object.keys(FEE_TYPE_CONFIG) as FeeType[]).map((key) => ({
      value: key,
      label: FEE_TYPE_CONFIG[key].label,
    }));
  }, [baseOptions.FEE_TYPE]);

  const feeTypeLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    feeTypeOptions.forEach((item) => {
      map[item.value] = item.label;
    });
    return map;
  }, [feeTypeOptions]);

  const currencySelectOptions = useMemo(() => {
    if (currencyOptions.length > 0) {
      return currencyOptions.map((item) => ({ value: item.code, label: item.label }));
    }
    return (Object.keys(CURRENCY_CONFIG) as Currency[]).map((key) => ({
      value: key,
      label: CURRENCY_CONFIG[key].label,
    }));
  }, [currencyOptions]);

  // --- 统计 ---
  const stats = useMemo(() => {
    const pendingCount = records.filter(r => r.status === 'PENDING').length;
    const approvedCount = records.filter(r => r.status === 'APPROVED').length;
    const payableTotal = records.filter(r => r.feeDirection === 'PAYABLE' && r.status !== 'CANCELLED')
      .reduce((sum, r) => sum + (r.amountCNY || r.amount), 0);
    const receivableTotal = records.filter(r => r.feeDirection === 'RECEIVABLE' && r.status !== 'CANCELLED')
      .reduce((sum, r) => sum + (r.amountCNY || r.amount), 0);
    return { pendingCount, approvedCount, payableTotal, receivableTotal };
  }, [records]);

  // --- 筛选 ---
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (searchText) {
      const keyword = searchText.toLowerCase();
      result = result.filter(r =>
        r.feeNo.toLowerCase().includes(keyword) ||
        r.relatedNo.toLowerCase().includes(keyword) ||
        (r.supplierName && r.supplierName.toLowerCase().includes(keyword)) ||
        (r.customerName && r.customerName.toLowerCase().includes(keyword)) ||
        (r.description && r.description.toLowerCase().includes(keyword))
      );
    }
    if (filterFeeType !== 'ALL') result = result.filter(r => r.feeType === filterFeeType);
    if (filterDirection !== 'ALL') result = result.filter(r => r.feeDirection === filterDirection);
    if (filterStatus !== 'ALL') result = result.filter(r => r.status === filterStatus);
    if (filterCurrency !== 'ALL') result = result.filter(r => r.currency === filterCurrency);

    return result;
  }, [records, searchText, filterFeeType, filterDirection, filterStatus, filterCurrency]);

  const handleReset = () => {
    setSearchText('');
    setFilterFeeType('ALL');
    setFilterDirection('ALL');
    setFilterStatus('ALL');
    setFilterCurrency('ALL');
  };

  const handleAutoBootstrap = async () => {
    const user = (() => {
      try {
        const raw = localStorage.getItem('user');
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed?.username || parsed?.id || 'CURRENT_USER';
      } catch {
        return 'CURRENT_USER';
      }
    })();

    setAutoLoading(true);
    try {
      const raw = await feeApi.bootstrap({
        createdBy: user,
        types: ['ORDER', 'UNIT', 'JOB']
      });
      const data = getData<Record<string, { created?: number; skipped?: number }>>(raw) || {};
      const orderCreated = Number(data.ORDER?.created || 0);
      const unitCreated = Number(data.UNIT?.created || 0);
      const jobCreated = Number(data.JOB?.created || 0);
      message.success(`自动获取完成：订单 ${orderCreated}，集装单元 ${unitCreated}，任务 ${jobCreated}`);
      await loadFees();
      await loadCoverage();
    } catch (err) {
      const e = err as { message?: string };
      message.error(e?.message || '自动获取费用失败');
    } finally {
      setAutoLoading(false);
    }
  };

  // --- 打开详情 ---
  const handleOpenDetail = (id: string) => {
    setCurrentDetailId(id);
    setDetailVisible(true);
  };

  // --- 打开创建 ---
  const handleOpenCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ currency: 'CNY', feeDirection: 'PAYABLE', relatedType: 'ORDER' });
    setRelatedOptions([]);
    void loadRelatedOptions('ORDER');
    setCreateVisible(true);
  };

  // --- 编辑 ---
  const handleEdit = (record: FeeRecord) => {
    setEditingRecord(record);
    const selected: RelatedOption = {
      value: record.relatedId || record.relatedNo,
      relatedNo: record.relatedNo,
      label: record.relatedNo
    };
    setRelatedOptions([selected]);
    form.setFieldsValue({
      relatedType: record.relatedType,
      relatedId: record.relatedId || record.relatedNo,
      relatedNo: record.relatedNo,
      feeType: record.feeType,
      feeDirection: record.feeDirection,
      amount: record.amount,
      currency: record.currency,
      exchangeRate: record.exchangeRate,
      supplierName: record.supplierName,
      customerName: record.customerName,
      description: record.description,
      remark: record.remark,
      invoiceNo: record.invoiceNo
    });
    void loadRelatedOptions((record.relatedType || 'ORDER') as RelatedType, '', selected);
    setCreateVisible(true);
  };

  const loadRelatedOptions = async (relatedType: RelatedType, keyword = '', preserve?: RelatedOption) => {
    setRelatedLoading(true);
    try {
      const kw = keyword.trim();
      let options: RelatedOption[] = [];

      if (relatedType === 'ORDER') {
        if (kw) {
          const raw = await orderApi.search(kw);
          const payload = getData<OrderSearchPayload>(raw) ?? (raw as OrderSearchPayload);
          const masters = toArray<MasterOrderRef>(payload?.masterOrders);
          const subs = toArray<SubOrderRef>(payload?.subOrders);
          options = [
            ...masters.map((o) => ({
              value: o.id,
              relatedNo: o.orderNo || o.id,
              label: `${o.orderNo || o.id} · 主单 · ${o.customerName || '-'}`
            })),
            ...subs.map((o) => ({
              value: o.id,
              relatedNo: o.subOrderNo || o.id,
              label: `${o.subOrderNo || o.id} · 子单 · ${o.expressTrackingNo || '-'}`
            }))
          ];
        } else {
          const raw = await orderApi.listMaster({ page: 1, pageSize: 20 });
          const rows = toArray<MasterOrderRef>(getData<unknown>(raw));
          options = rows.map((o) => ({
            value: o.id,
            relatedNo: o.orderNo || o.id,
            label: `${o.orderNo || o.id} · 主单 · ${o.customerName || '-'}`
          }));
        }
      } else if (relatedType === 'UNIT') {
        const raw = await warehouseApi.listUnits({ keyword: kw || undefined });
        const rows = toArray<UnitRef>(getData<unknown>(raw) ?? raw);
        options = rows.map((u) => ({
          value: u.id,
          relatedNo: u.unitNo || u.id,
          label: `${u.unitNo || u.id} · ${u.unitType || '-'} · ${u.status || '-'}`
        }));
      } else if (relatedType === 'JOB') {
        const raw = await jobApi.list({ keyword: kw || undefined });
        const rows = toArray<JobRef>(getData<unknown>(raw) ?? raw);
        options = rows.map((j) => ({
          value: j.jobNo,
          relatedNo: j.jobNo,
          label: `${j.jobNo} · ${j.route || '-'} · ${j.status || '-'}`
        }));
      } else {
        const raw = await warehouseApi.listTransfers({ keyword: kw || undefined });
        const rows = toArray<TransferRef>(getData<unknown>(raw) ?? raw);
        options = rows.map((t) => ({
          value: t.id,
          relatedNo: t.transferNo || t.id,
          label: `${t.transferNo || t.id} · ${t.fromWarehouse || '-'} -> ${t.toWarehouse || '-'}`
        }));
      }

      const merged = [...(preserve ? [preserve] : []), ...options].filter(Boolean);
      const deduped = merged.filter((item, idx) => merged.findIndex(x => x.value === item.value) === idx);
      setRelatedOptions(deduped);
    } catch {
      setRelatedOptions(preserve ? [preserve] : []);
      message.error('加载关联对象失败');
    } finally {
      setRelatedLoading(false);
    }
  };

  const handleRelatedTypeChange = (value: RelatedType) => {
    form.setFieldsValue({ relatedId: undefined, relatedNo: undefined });
    setRelatedOptions([]);
    void loadRelatedOptions(value);
  };

  const handleRelatedSearch = (keyword: string) => {
    const relatedType = form.getFieldValue('relatedType') as RelatedType;
    if (!relatedType) return;

    if (searchTimerRef.current) {
      window.clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = window.setTimeout(() => {
      const currentRelatedId = form.getFieldValue('relatedId');
      const currentOption = relatedOptions.find(o => o.value === currentRelatedId);
      void loadRelatedOptions(relatedType, keyword, currentOption);
    }, 250);
  };

  const handleRelatedChange = (value?: string) => {
    const selected = relatedOptions.find(o => o.value === value);
    form.setFieldsValue({ relatedNo: selected?.relatedNo || undefined });
  };

  const handleEditFromDetail = (id: string) => {
    const record = records.find(r => r.id === id);
    if (record) {
      setDetailVisible(false);
      handleEdit(record);
    }
  };

  // --- 提交表单 ---
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const selectedRelation = relatedOptions.find(o => o.value === values.relatedId);
      const normalizedRelatedNo = values.relatedNo || selectedRelation?.relatedNo;
      if (!normalizedRelatedNo) {
        message.error('请先选择有效的关联编号');
        return;
      }
      const user = (() => {
        try {
          const raw = localStorage.getItem('user');
          const parsed = raw ? JSON.parse(raw) : {};
          return parsed?.username || parsed?.id || 'CURRENT_USER';
        } catch {
          return 'CURRENT_USER';
        }
      })();

      if (editingRecord) {
        await feeApi.update(editingRecord.id, {
          relatedType: values.relatedType,
          relatedNo: normalizedRelatedNo,
          relatedId: values.relatedId,
          feeType: values.feeType,
          feeDirection: values.feeDirection,
          amount: values.amount,
          currency: values.currency,
          exchangeRate: values.exchangeRate || 1,
          supplierName: values.feeDirection === 'PAYABLE' ? values.supplierName : null,
          customerName: values.feeDirection === 'RECEIVABLE' ? values.customerName : null,
          description: values.description,
          remark: values.remark,
          invoiceNo: values.invoiceNo,
          createdBy: user,
        });
        message.success('费用编辑成功');
      } else {
        await feeApi.create({
          relatedType: values.relatedType,
          relatedId: values.relatedId,
          relatedNo: normalizedRelatedNo,
          feeType: values.feeType,
          feeDirection: values.feeDirection,
          amount: values.amount,
          currency: values.currency,
          exchangeRate: values.exchangeRate || 1,
          supplierName: values.feeDirection === 'PAYABLE' ? values.supplierName : null,
          customerName: values.feeDirection === 'RECEIVABLE' ? values.customerName : null,
          description: values.description,
          remark: values.remark,
          createdBy: user,
        });
        message.success('费用录入成功');
      }

      await loadFees();
      setCreateVisible(false);
      setEditingRecord(null);
      setRelatedOptions([]);
      form.resetFields();
    } catch (error) {
      const err = error as { message?: string; errorFields?: unknown };
      if (err?.errorFields) return;
      message.error(err?.message || '费用提交失败');
      console.error('费用提交失败:', error);
    }
  };

  // --- 删除 ---
  const handleDelete = (record: FeeRecord) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除费用 ${record.feeNo}？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      onOk: () => {
        setRecords(records.filter(r => r.id !== record.id));
        message.success('费用已删除');
      }
    });
  };

  const handleDeleteFromDetail = (id: string) => {
    setRecords(records.filter(r => r.id !== id));
    setDetailVisible(false);
  };

  // 监听币种变化
  const watchCurrency = Form.useWatch('currency', form);
  const watchDirection = Form.useWatch('feeDirection', form);

  // --- 列定义 ---
  const columns = [
    {
      title: '费用编号',
      dataIndex: 'feeNo',
      key: 'feeNo',
      width: 160,
      render: (text: string, record: FeeRecord) => (
        <a onClick={() => handleOpenDetail(record.id)}>{text}</a>
      )
    },
    {
      title: '关联单号',
      dataIndex: 'relatedNo',
      key: 'relatedNo',
      width: 160
    },
    {
      title: '费用类型',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 90,
      render: (type: string) => {
        const config = FEE_TYPE_CONFIG[type as FeeType];
        return config
          ? <Tag color={config.color}>{config.label}</Tag>
          : <Tag>{feeTypeLabelMap[type] || type}</Tag>;
      }
    },
    {
      title: '方向',
      dataIndex: 'feeDirection',
      key: 'feeDirection',
      width: 60,
      render: (dir: FeeDirection) => (
        <Tag color={dir === 'PAYABLE' ? 'red' : 'green'}>{dir === 'PAYABLE' ? '应付' : '应收'}</Tag>
      )
    },
    {
      title: '金额',
      key: 'amount',
      width: 120,
      render: (record: FeeRecord) => {
        const currConfig = CURRENCY_CONFIG[record.currency];
        const symbol = currConfig ? currConfig.symbol : record.currency + ' ';
        return (
          <Text strong style={{ color: record.feeDirection === 'PAYABLE' ? '#cf1322' : '#3f8600' }}>
            {symbol}{record.amount.toFixed(2)}
          </Text>
        );
      }
    },
    {
      title: '汇率',
      key: 'exchangeRate',
      width: 70,
      render: (record: FeeRecord) => record.currency === 'CNY' ? '-' : (record.exchangeRate || '-'),
    },
    {
      title: '折合CNY',
      key: 'amountCNY',
      width: 100,
      render: (record: FeeRecord) => {
        if (record.currency === 'CNY') return '-';
        const rate = record.exchangeRate || 1;
        return <Text style={{ color: '#8c8c8c' }}>¥{(record.amount * rate).toFixed(2)}</Text>;
      },
    },
    {
      title: '供应商/客户',
      key: 'party',
      width: 120,
      render: (record: FeeRecord) => record.supplierName || record.customerName || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: FeeStatus) => {
        const config = FEE_STATUS_CONFIG[status];
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{status}</Tag>;
      }
    },
    {
      title: '创建人',
      dataIndex: 'createdByName',
      key: 'createdByName',
      width: 80
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (record: FeeRecord) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record.id)}>
            详情
          </Button>
          {(record.status === 'PENDING' || record.status === 'REJECTED') && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {record.status === 'PENDING' && (
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
              删除
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待审批" value={stats.pendingCount} suffix="笔" valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已审批" value={stats.approvedCount} suffix="笔" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="应付总额(¥)" value={stats.payableTotal} prefix="¥" precision={2} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="应收总额(¥)" value={stats.receivableTotal} prefix="¥" precision={2} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
      </Row>

      {/* 筛选区域 */}
      <ListPageToolbarCard>
        {coverage && (
          <Alert
            style={{ marginBottom: 12 }}
            type="info"
            showIcon
            message={`待自动补全：订单 ${coverage.ORDER}，集装单元 ${coverage.UNIT}，任务 ${coverage.JOB}`}
            description="系统会自动从订单/集装单元/任务生成费用草稿；缺失金额可在列表中手动编辑补录。"
          />
        )}
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 260px" minWidth={240}>
              <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>关键词</div>
              <Input
                placeholder="费用编号/关联单号/供应商/客户"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={180}>
              <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>费用类型</div>
              <Select value={filterFeeType} onChange={setFilterFeeType} style={{ width: '100%' }}>
                <Option value="ALL">全部类型</Option>
                {feeTypeOptions.map((item) => (
                  <Option key={item.value} value={item.value}>{item.label}</Option>
                ))}
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={140}>
              <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>费用方向</div>
              <Select value={filterDirection} onChange={setFilterDirection} style={{ width: '100%' }}>
                <Option value="ALL">全部</Option>
                <Option value="PAYABLE">应付</Option>
                <Option value="RECEIVABLE">应收</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={140}>
              <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>状态</div>
              <Select value={filterStatus} onChange={setFilterStatus} style={{ width: '100%' }}>
                <Option value="ALL">全部状态</Option>
                {(Object.keys(FEE_STATUS_CONFIG) as FeeStatus[]).map(key => (
                  <Option key={key} value={key}>{FEE_STATUS_CONFIG[key].label}</Option>
                ))}
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={140}>
              <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>币种</div>
              <Select value={filterCurrency} onChange={setFilterCurrency} style={{ width: '100%' }}>
                <Option value="ALL">全部币种</Option>
                {currencySelectOptions.map((item) => (
                  <Option key={item.value} value={item.value}>{item.label}</Option>
                ))}
              </Select>
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions style={{ alignSelf: 'flex-end' }}>
            <Button type="primary" onClick={() => setSearchText((value) => value.trim())}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
            <Button
              icon={<DownloadOutlined />}
              loading={autoLoading}
              onClick={handleAutoBootstrap}
            >
              自动获取费用
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              录入费用
            </Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      {/* 数据表格 */}
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条记录` }}
        />
      </Card>

      {/* 创建/编辑 Modal */}
      <Modal
        title={editingRecord ? `编辑费用: ${editingRecord.feeNo}` : '录入费用'}
        open={createVisible}
        onCancel={() => { setCreateVisible(false); setEditingRecord(null); setRelatedOptions([]); form.resetFields(); }}
        onOk={handleSubmit}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="relatedType" label="关联类型" rules={[{ required: true, message: '请选择关联类型' }]}>
                <Select placeholder="选择关联类型" onChange={handleRelatedTypeChange}>
                  {RELATED_TYPE_OPTIONS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="relatedId" label="关联编号" rules={[{ required: true, message: '请选择关联编号' }]}>
                <Select
                  showSearch
                  allowClear
                  placeholder="输入关键词搜索并选择"
                  loading={relatedLoading}
                  filterOption={false}
                  onSearch={handleRelatedSearch}
                  onChange={handleRelatedChange}
                  notFoundContent={relatedLoading ? '搜索中...' : '无匹配数据'}
                >
                  {relatedOptions.map(opt => (
                    <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="relatedNo" hidden>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="feeType" label="费用类型" rules={[{ required: true, message: '请选择费用类型' }]}>
                <Select placeholder="选择费用类型">
                  {feeTypeOptions.map((item) => (
                    <Option key={item.value} value={item.value}>{item.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="feeDirection" label="费用方向" rules={[{ required: true, message: '请选择费用方向' }]}>
                <Select placeholder="选择费用方向">
                  <Option value="PAYABLE">应付（付给供应商）</Option>
                  <Option value="RECEIVABLE">应收（向客户收取）</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
                <Select placeholder="选择币种">
                  {currencySelectOptions.map((item) => (
                    <Option key={item.value} value={item.value}>{item.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {watchCurrency && watchCurrency !== 'CNY' && (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="exchangeRate" label="汇率（→ CNY）">
                  <InputNumber style={{ width: '100%' }} min={0} precision={4} placeholder="例如: 7.2500" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={16}>
            <Col span={12}>
              {watchDirection === 'RECEIVABLE' ? (
                <Form.Item name="customerName" label="客户名称">
                  <Input placeholder="收取费用的客户名称" />
                </Form.Item>
              ) : (
                <Form.Item name="supplierName" label="供应商名称">
                  <Input placeholder="付费的供应商名称" />
                </Form.Item>
              )}
            </Col>
            <Col span={12}>
              <Form.Item name="invoiceNo" label="发票号">
                <Input placeholder="发票号（选填）" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="费用说明">
            <Input placeholder="简要描述费用内容" />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input placeholder="如有特殊说明请填写" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <FeeInputDetail
        visible={detailVisible}
        feeId={currentDetailId}
        onClose={() => setDetailVisible(false)}
        onDelete={handleDeleteFromDetail}
        onEdit={handleEditFromDetail}
      />
    </div>
  );
};
