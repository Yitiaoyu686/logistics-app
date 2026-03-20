import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Modal,
  Form,
  message,
  Popconfirm,
  Row,
  Col,
  InputNumber,
  Tag,
  Tooltip,
  Statistic,
  Alert,
  Drawer
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  DollarOutlined,
  LineChartOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { systemApi } from '../../api';

const { TextArea } = Input;

// ========== 类型定义 ==========

interface Currency {
  id: string;
  currencyCode: string;        // 币种代码（USD, EUR, GBP等）
  currencyName: string;         // 币种名称
  currencyNameEn: string;       // 英文名称
  symbol: string;               // 货币符号（$, €, £等）
  manualRate?: number;          // 手动录入汇率
  liveRate?: number;            // 实时汇率
  rateDate?: string;            // 汇率日期
  remark?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

interface RateHistory {
  id: string;
  currencyCode: string;
  rate: number;
  rateType: 'MANUAL' | 'LIVE';  // 手动录入或实时获取
  recordDate: string;
  operator?: string;
  createdAt: string;
}


// ========== 主组件 ==========

export const ExchangeRateManagement: React.FC = () => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [currencyForm] = Form.useForm();
  const [rateForm] = Form.useForm();

  const normalizeDateTime = (value?: string) => {
    if (!value) return new Date().toISOString().replace('T', ' ').slice(0, 19);
    return value.replace('T', ' ').slice(0, 19);
  };

  const loadData = async (withLoading = true) => {
    if (withLoading) setLoading(true);
    try {
      const res = await systemApi.exchangeRates();
      const raw = res.data || res || {};

      if (raw.currencies && Array.isArray(raw.currencies)) {
        setCurrencies(raw.currencies.map((row: any) => ({
          ...row,
          createdAt: normalizeDateTime(row.createdAt),
          updatedAt: normalizeDateTime(row.updatedAt),
          rateDate: row.rateDate ? String(row.rateDate).slice(0, 10) : undefined,
        })));
        if (Array.isArray(raw.rateHistory)) {
          setRateHistory(raw.rateHistory.map((row: any) => ({
            ...row,
            createdAt: normalizeDateTime(row.createdAt),
            recordDate: String(row.recordDate || '').slice(0, 10)
          })));
        } else {
          setRateHistory([]);
        }
        return;
      }

      if (Array.isArray(raw)) {
        setCurrencies(raw.map((row: any) => ({
          ...row,
          createdAt: normalizeDateTime(row.createdAt),
          updatedAt: normalizeDateTime(row.updatedAt),
        })));
        setRateHistory([]);
        return;
      }

      if (raw.rates && typeof raw.rates === 'object' && !Array.isArray(raw.rates)) {
        const updatedAt = raw.updatedAt
          ? normalizeDateTime(raw.updatedAt)
          : normalizeDateTime();
        const rateDate = updatedAt.slice(0, 10);
        const currencyList: Currency[] = Object.entries(raw.rates)
          .filter(([code]) => code !== 'CNY')
          .map(([code, rate], index) => {
            const info = CURRENCY_NAME_MAP[code] || { name: code, nameEn: code, symbol: code };
            const cnyRate = typeof rate === 'number' && rate > 0 ? 1 / rate : undefined;
            return {
              id: `CUR-${String(index + 1).padStart(3, '0')}`,
              currencyCode: code,
              currencyName: info.name,
              currencyNameEn: info.nameEn,
              symbol: info.symbol,
              manualRate: cnyRate ? Number(cnyRate.toFixed(4)) : undefined,
              liveRate: cnyRate ? Number((cnyRate + (Math.random() - 0.5) * 0.01).toFixed(4)) : undefined,
              rateDate,
              status: 'ACTIVE' as const,
              createdAt: updatedAt,
              updatedAt,
            };
          });
        setCurrencies(currencyList);
        setRateHistory([]);
        return;
      }

      setCurrencies([]);
      setRateHistory([]);
    } catch (e) {
      message.error('获取数据失败');
    } finally {
      if (withLoading) setLoading(false);
    }
  };

  // 币种名称映射
  const CURRENCY_NAME_MAP: Record<string, { name: string; nameEn: string; symbol: string }> = {
    USD: { name: '美元', nameEn: 'US Dollar', symbol: '$' },
    EUR: { name: '欧元', nameEn: 'Euro', symbol: '€' },
    GBP: { name: '英镑', nameEn: 'British Pound', symbol: '£' },
    JPY: { name: '日元', nameEn: 'Japanese Yen', symbol: '¥' },
    HKD: { name: '港币', nameEn: 'Hong Kong Dollar', symbol: 'HK$' },
    AUD: { name: '澳元', nameEn: 'Australian Dollar', symbol: 'A$' },
    CAD: { name: '加元', nameEn: 'Canadian Dollar', symbol: 'C$' },
    SGD: { name: '新加坡元', nameEn: 'Singapore Dollar', symbol: 'S$' },
    NGN: { name: '尼日利亚奈拉', nameEn: 'Nigerian Naira', symbol: '₦' },
    GHS: { name: '加纳塞地', nameEn: 'Ghanaian Cedi', symbol: '₵' },
    CNY: { name: '人民币', nameEn: 'Chinese Yuan', symbol: '¥' },
  };

  useEffect(() => {
    loadData();
  }, []);

  // 模拟实时汇率刷新
  const handleRefreshLiveRates = async () => {
    setRefreshing(true);
    try {
      await systemApi.refreshLiveRates();
      await loadData(false);
      message.success('实时汇率已更新');
    } catch (_) {
      message.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  // 搜索过滤
  const filteredCurrencies = useMemo(() => {
    if (!searchText) return currencies;
    return currencies.filter(c =>
      c.currencyCode.toLowerCase().includes(searchText.toLowerCase()) ||
      c.currencyName.toLowerCase().includes(searchText.toLowerCase()) ||
      c.currencyNameEn.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [currencies, searchText]);

  // 打开新建币种弹窗
  const handleAddCurrency = () => {
    setEditingCurrency(null);
    currencyForm.resetFields();
    setCurrencyModalVisible(true);
  };

  // 打开编辑币种弹窗
  const handleEditCurrency = (record: Currency) => {
    setEditingCurrency(record);
    currencyForm.setFieldsValue(record);
    setCurrencyModalVisible(true);
  };

  // 保存币种
  const handleSaveCurrency = async () => {
    try {
      const values = await currencyForm.validateFields();

      if (editingCurrency) {
        await systemApi.updateExchangeCurrency(editingCurrency.id, values);
        message.success('币种信息已更新');
      } else {
        await systemApi.createExchangeCurrency(values);
        message.success('币种已添加');
      }

      setCurrencyModalVisible(false);
      await loadData(false);
    } catch (error) {
      message.error((error as Error)?.message || '保存失败');
    }
  };

  // 删除币种
  const handleDeleteCurrency = async (id: string) => {
    try {
      await systemApi.deleteExchangeCurrency(id);
      message.success('币种已删除');
      await loadData(false);
    } catch (error) {
      message.error((error as Error)?.message || '删除失败');
    }
  };

  // 打开汇率录入弹窗
  const handleAddRate = (record: Currency) => {
    setSelectedCurrency(record);
    rateForm.setFieldsValue({
      currencyCode: record.currencyCode,
      rate: record.manualRate,
      rateDate: dayjs().format('YYYY-MM-DD')
    });
    setRateModalVisible(true);
  };

  // 打开历史汇率抽屉
  const handleViewHistory = (record: Currency) => {
    setSelectedCurrency(record);
    setHistoryDrawerVisible(true);
  };

  // 保存汇率
  const handleSaveRate = async () => {
    try {
      const values = await rateForm.validateFields();
      if (!selectedCurrency?.currencyCode) {
        message.error('未选择币种');
        return;
      }
      await systemApi.saveExchangeRate(selectedCurrency.currencyCode, {
        rate: values.rate,
        rateType: 'MANUAL',
        recordDate: values.rateDate,
        operator: 'WEB_USER'
      });
      message.success('汇率已更新');
      setRateModalVisible(false);
      await loadData(false);
    } catch (error) {
      message.error((error as Error)?.message || '保存失败');
    }
  };

  // 获取当前币种的历史汇率
  const getCurrentHistory = useMemo(() => {
    if (!selectedCurrency) return [];
    return rateHistory.filter(h => h.currencyCode === selectedCurrency.currencyCode);
  }, [selectedCurrency, rateHistory]);

  // 计算汇率差异
  const getRateDiff = (manualRate?: number, liveRate?: number) => {
    if (!manualRate || !liveRate) return null;
    const diff = ((manualRate - liveRate) / liveRate * 100);
    return diff;
  };

  // 表格列定义
  const columns: ColumnsType<Currency> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: '币种代码',
      dataIndex: 'currencyCode',
      width: 100,
      render: (text: string, record: Currency) => (
        <Space>
          <Tag color="blue">{text}</Tag>
          <span>{record.symbol}</span>
        </Space>
      )
    },
    {
      title: '币种名称',
      dataIndex: 'currencyName',
      width: 120,
      render: (text: string, record: Currency) => (
        <div>
          <div>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.currencyNameEn}</div>
        </div>
      )
    },
    {
      title: '今日汇率',
      dataIndex: 'manualRate',
      width: 120,
      align: 'right',
      render: (value?: number, record?: Currency) => (
        <div>
          {value ? (
            <>
              <div style={{ fontWeight: 'bold', color: '#1890ff' }}>
                {value.toFixed(4)}
              </div>
              {record?.rateDate && (
                <div style={{ fontSize: 11, color: '#999' }}>
                  {record.rateDate}
                </div>
              )}
            </>
          ) : (
            <span style={{ color: '#999' }}>未设置</span>
          )}
        </div>
      )
    },
    {
      title: '实时汇率',
      dataIndex: 'liveRate',
      width: 120,
      align: 'right',
      render: (value?: number) => (
        value ? (
          <Tooltip title="实时国际汇率">
            <div style={{ color: '#52c41a' }}>
              <LineChartOutlined style={{ marginRight: 4 }} />
              {value.toFixed(4)}
            </div>
          </Tooltip>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        )
      )
    },
    {
      title: '汇率差异',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const diff = getRateDiff(record.manualRate, record.liveRate);
        if (diff === null) return '-';

        const color = diff > 0 ? '#ff4d4f' : diff < 0 ? '#52c41a' : '#999';
        return (
          <Tooltip title="今日汇率与实时汇率的差异百分比">
            <Tag color={diff > 0 ? 'red' : diff < 0 ? 'green' : 'default'}>
              {diff > 0 ? '+' : ''}{diff.toFixed(2)}%
            </Tag>
          </Tooltip>
        );
      }
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      sorter: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      defaultSortOrder: 'descend'
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 150,
      ellipsis: true,
      render: (text?: string) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<DollarOutlined />}
            onClick={() => handleAddRate(record)}
          >
            录入汇率
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewHistory(record)}
          >
            历史汇率
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditCurrency(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除币种「${record.currencyName}」吗？`}
            onConfirm={() => handleDeleteCurrency(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 提示信息 */}
      <Alert
        message="汇率说明"
        description="今日汇率用于业务计算，实时汇率仅供参考。建议每日更新今日汇率以保持准确性。"
        type="info"
        showIcon
        closable
        style={{ marginBottom: 16 }}
      />

      {/* 搜索栏 */}
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space size="middle">
          <Input
            placeholder="币种代码或名称"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            查询
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddCurrency}
          >
            添加币种
          </Button>
          <Button
            icon={<SyncOutlined spin={refreshing} />}
            onClick={handleRefreshLiveRates}
            loading={refreshing}
          >
            刷新实时汇率
          </Button>
        </Space>
      </Card>

      {/* 汇率统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="币种总数"
              value={currencies.length}
              suffix="种"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="已设置汇率"
              value={currencies.filter(c => c.manualRate).length}
              suffix="种"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="今日更新"
              value={currencies.filter(c => c.rateDate === dayjs().format('YYYY-MM-DD')).length}
              suffix="种"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="最后更新"
              value={currencies.length > 0 ? dayjs(currencies[0].updatedAt).format('HH:mm') : '-'}
              valueStyle={{ color: '#999' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 汇率列表表格 */}
      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={filteredCurrencies}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 新建/编辑币种弹窗 */}
      <Modal
        title={editingCurrency ? '编辑币种' : '添加币种'}
        open={currencyModalVisible}
        onOk={handleSaveCurrency}
        onCancel={() => setCurrencyModalVisible(false)}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form form={currencyForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="currencyCode"
                label="币种代码"
                rules={[
                  { required: true, message: '请输入币种代码' },
                  { pattern: /^[A-Z]{3}$/, message: '请输入3位大写字母' }
                ]}
              >
                <Input placeholder="如：USD" maxLength={3} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="symbol"
                label="货币符号"
                rules={[{ required: true, message: '请输入货币符号' }]}
              >
                <Input placeholder="如：$" maxLength={3} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="manualRate"
                label="初始汇率"
              >
                <InputNumber
                  placeholder="7.25"
                  style={{ width: '100%' }}
                  min={0}
                  precision={4}
                  step={0.0001}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="currencyName"
                label="币种名称（中文）"
                rules={[{ required: true, message: '请输入币种名称' }]}
              >
                <Input placeholder="如：美元" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="currencyNameEn"
                label="币种名称（英文）"
                rules={[{ required: true, message: '请输入英文名称' }]}
              >
                <Input placeholder="如：US Dollar" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="输入备注信息..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 录入汇率弹窗 */}
      <Modal
        title={`录入今日汇率 - ${selectedCurrency?.currencyName} (${selectedCurrency?.currencyCode})`}
        open={rateModalVisible}
        onOk={handleSaveRate}
        onCancel={() => setRateModalVisible(false)}
        width={500}
        okText="保存"
        cancelText="取消"
      >
        <Form form={rateForm} layout="vertical">
          <Form.Item label="当前实时汇率（参考）">
            {selectedCurrency?.liveRate ? (
              <div style={{
                padding: '12px',
                background: '#f0f9ff',
                borderRadius: 4,
                fontSize: 16,
                color: '#1890ff',
                fontWeight: 'bold'
              }}>
                <LineChartOutlined style={{ marginRight: 8 }} />
                1 {selectedCurrency.currencyCode} = {selectedCurrency.liveRate.toFixed(4)} CNY
              </div>
            ) : (
              <div style={{ color: '#999' }}>暂无实时汇率</div>
            )}
          </Form.Item>

          <Form.Item
            name="rate"
            label="今日汇率（对人民币）"
            rules={[{ required: true, message: '请输入汇率' }]}
            extra="1单位外币兑换人民币的金额"
          >
            <InputNumber
              placeholder="7.2500"
              style={{ width: '100%' }}
              min={0}
              precision={4}
              step={0.0001}
              addonBefore="1 ="
              addonAfter="CNY"
            />
          </Form.Item>

          <Form.Item
            name="rateDate"
            label="汇率日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <Input type="date" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 历史汇率抽屉 */}
      <Drawer
        title={
          <Space>
            <HistoryOutlined />
            <span>历史汇率 - {selectedCurrency?.currencyName} ({selectedCurrency?.currencyCode})</span>
          </Space>
        }
        open={historyDrawerVisible}
        onClose={() => setHistoryDrawerVisible(false)}
        width={700}
      >
        <Alert
          message="查看历史汇率记录"
          description="以下是该币种的历史汇率变动记录，按时间倒序排列。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          dataSource={getCurrentHistory}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          columns={[
            {
              title: '序号',
              width: 60,
              render: (_, __, index) => index + 1
            },
            {
              title: '汇率日期',
              dataIndex: 'recordDate',
              width: 120,
              sorter: (a, b) => a.recordDate.localeCompare(b.recordDate),
              defaultSortOrder: 'descend'
            },
            {
              title: '汇率（对CNY）',
              dataIndex: 'rate',
              width: 120,
              align: 'right',
              render: (value: number) => (
                <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                  {value.toFixed(4)}
                </span>
              )
            },
            {
              title: '类型',
              dataIndex: 'rateType',
              width: 100,
              render: (type: string) => (
                <Tag color={type === 'MANUAL' ? 'blue' : 'green'}>
                  {type === 'MANUAL' ? '手动录入' : '实时获取'}
                </Tag>
              )
            },
            {
              title: '操作员',
              dataIndex: 'operator',
              width: 100,
              render: (text?: string) => text || '-'
            },
            {
              title: '录入时间',
              dataIndex: 'createdAt',
              width: 160
            }
          ]}
        />
      </Drawer>
    </div>
  );
};
