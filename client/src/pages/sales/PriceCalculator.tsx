import React, { useState } from 'react';
import { Card, Form, Input, Select, Button, Row, Col, Table, Tag, message, Typography } from 'antd';
import { SearchOutlined, CopyOutlined, RocketOutlined, FieldTimeOutlined, CalculatorOutlined } from '@ant-design/icons';
import { salesApi } from '../../api';

const { Option } = Select;

interface PriceResult {
  key: string;
  channel: string;
  type: string;
  etd: string;
  pricePerKg: number;
  totalPrice: number;
  tags: string[];
}

export const PriceCalculator: React.FC = () => {
  const [form] = Form.useForm();
  const [results, setResults] = useState<PriceResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (values: any) => {
    setLoading(true);
    try {
      const res = await salesApi.quotes({
        country: values.country,
        weight: values.weight,
        volume: values.volume,
        type: values.type,
        transportType: values.transportType === 'ALL' ? undefined : values.transportType,
      });
      const data = (res as any)?.data || res;
      if (data && Array.isArray(data)) {
        const mapped: PriceResult[] = data.map((item: any, idx: number) => ({
          key: item.key || String(idx + 1),
          channel: item.channel || '',
          type: item.type || '',
          etd: item.etd || '',
          pricePerKg: item.pricePerKg ?? 0,
          totalPrice: item.totalPrice ?? 0,
          tags: item.tags || [],
        }));
        setResults(mapped);
      } else {
        setResults([]);
      }
    } catch (e) {
      message.error('获取报价失败');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (record: PriceResult) => {
    const text = `【报价】${record.channel}\n时效：${record.etd}\n单价：¥${record.pricePerKg}/kg\n预估总价：¥${record.totalPrice.toFixed(2)}`;
    navigator.clipboard.writeText(text);
    message.success('报价文案已复制');
  };

  const columns = [
    {
      title: '渠道名称', dataIndex: 'channel',
      render: (t: string, r: PriceResult) => (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: 15 }}>{t}</div>
          <div>
            {r.tags.map(tag => <Tag key={tag} color="blue" style={{ fontSize: 10 }}>{tag}</Tag>)}
          </div>
        </div>
      )
    },
    {
      title: '时效', dataIndex: 'etd',
      render: (t: string) => <span><FieldTimeOutlined /> {t}</span>
    },
    {
      title: '单价', dataIndex: 'pricePerKg',
      render: (t: number) => `¥${t}/kg`
    },
    {
      title: '预估总价', dataIndex: 'totalPrice',
      render: (t: number) => <span style={{ color: '#cf1322', fontWeight: 'bold', fontSize: 16 }}>¥{t.toFixed(2)}</span>
    },
    {
      title: '操作',
      render: (_: any, r: PriceResult) => (
        <Button icon={<CopyOutlined />} size="small" onClick={() => handleCopy(r)}>复制</Button>
      )
    }
  ];

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100%' }}>
      <Row gutter={24}>
        {/* Left: Input Panel */}
        <Col span={8} style={{ borderRight: '1px solid #f0f0f0' }}>
          <div style={{ marginBottom: 24 }}>
            <h3><CalculatorOutlined /> 运费试算</h3>
            <p style={{ color: '#999' }}>输入货物信息，快速获取多渠道报价。</p>
          </div>
          <Form form={form} layout="vertical" onFinish={handleSearch}>
            <Form.Item name="country" label="目的国家" rules={[{ required: true }]}>
              <Select placeholder="请选择" showSearch>
                <Option value="USA">USA - 美国</Option>
                <Option value="GB">UK - 英国</Option>
                <Option value="DE">DE - 德国</Option>
              </Select>
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="weight" label="实重 (kg)" rules={[{ required: true }]}>
                  <Input type="number" suffix="kg" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="volume" label="体积 (cbm)">
                  <Input type="number" suffix="m³" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="type" label="货物属性" initialValue="NORMAL">
              <Select>
                <Option value="NORMAL">普货</Option>
                <Option value="SENSITIVE">敏感货 (带电/磁)</Option>
              </Select>
            </Form.Item>

            <Form.Item name="transportType" label="运输方式" initialValue="ALL">
              <Select>
                <Option value="ALL">全部</Option>
                <Option value="AIR">空运</Option>
                <Option value="SEA">海运</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block icon={<SearchOutlined />} loading={loading} size="large">
                立即查询
              </Button>
              <Button type="text" block style={{ marginTop: 8 }} onClick={() => { form.resetFields(); setResults([]); }}>
                重置条件
              </Button>
            </Form.Item>
          </Form>
        </Col>

        {/* Right: Result List */}
        <Col span={16}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>报价结果 ({results.length})</h3>
            <Select defaultValue="PRICE_ASC" style={{ width: 120 }} size="small">
              <Option value="PRICE_ASC">价格从低到高</Option>
              <Option value="TIME_ASC">时效从快到慢</Option>
            </Select>
          </div>

          <Table
            dataSource={results}
            columns={columns}
            pagination={false}
            loading={loading}
            locale={{ emptyText: <div style={{ padding: 40, color: '#999' }}><RocketOutlined style={{ fontSize: 32 }} /><p>请输入条件进行查询</p></div> }}
          />
        </Col>
      </Row>
    </div>
  );
};
