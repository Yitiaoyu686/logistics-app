import React, { useMemo, useState } from 'react';
import { Card, Table, Button, Input, Select, Space, Tag, Row, Col, message, theme } from 'antd';
import { SearchOutlined, ReloadOutlined, BellOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface PickupRecord {
  id: string;
  pickupNo: string;
  trackingNo: string;
  recipientName: string;
  recipientPhone: string;
  pickupStation: string;
  pickupCode: string;
  paymentMethod: 'PREPAID' | 'COD';
  paymentStatus: 'PAID' | 'UNPAID';
  paymentAmount: number;
  currency: string;
  notifyStatus: 'PENDING' | 'NOTIFIED' | 'PICKED_UP';
  notifyTime: string | null;
  pickedUpTime: string | null;
  updatedAt: string;
}

const generatePickupData = (): PickupRecord[] => {
  const names = ['Karena', '箴媄子', 'Tom', 'Smile', 'Kwame', 'Ada', 'Chidi', 'Emeka'];
  return Array.from({ length: 16 }, (_, i) => {
    const notified = i % 3 !== 0;
    const picked = i % 5 === 0;
    return {
      id: `PU-${String(i + 1).padStart(3, '0')}`,
      pickupNo: `PUP-${dayjs().format('YYYYMMDD')}-${String(i + 1).padStart(3, '0')}`,
      trackingNo: `19102${String(1000 + i).padStart(4, '0')} ${String(i % 9).padStart(2, '0')}`,
      recipientName: names[i % names.length],
      recipientPhone: '+234 9038321727',
      pickupStation: i % 2 === 0 ? 'IKEJ STA' : 'ABUJ STA',
      pickupCode: `PK${String(6000 + i)}`,
      paymentMethod: i % 2 === 0 ? 'COD' : 'PREPAID',
      paymentStatus: i % 2 === 0 ? 'UNPAID' : 'PAID',
      paymentAmount: i % 2 === 0 ? 12000 + i * 500 : 0,
      currency: 'USD',
      notifyStatus: picked ? 'PICKED_UP' : notified ? 'NOTIFIED' : 'PENDING',
      notifyTime: notified ? dayjs().subtract(i, 'day').format('YYYY/MM/DD HH:mm:ss') : null,
      pickedUpTime: picked ? dayjs().subtract(i - 1, 'day').format('YYYY/MM/DD HH:mm:ss') : null,
      updatedAt: dayjs().subtract(i, 'day').format('YYYY-MM-DD HH:mm:ss'),
    };
  });
};

export const PickupList: React.FC<{ warehouseId?: string; businessMode?: string }> = () => {
  const { token } = theme.useToken();
  const [data, setData] = useState<PickupRecord[]>(generatePickupData);
  const [filterStation, setFilterStation] = useState<string>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('ALL');
  const [filterNotifyStatus, setFilterNotifyStatus] = useState<string>('ALL');
  const [keyword, setKeyword] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (filterStation !== 'ALL' && item.pickupStation !== filterStation) return false;
      if (filterPaymentStatus !== 'ALL' && item.paymentStatus !== filterPaymentStatus) return false;
      if (filterNotifyStatus !== 'ALL' && item.notifyStatus !== filterNotifyStatus) return false;
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        return (
          item.trackingNo.toLowerCase().includes(kw) ||
          item.pickupNo.toLowerCase().includes(kw) ||
          item.recipientName.toLowerCase().includes(kw) ||
          item.recipientPhone.includes(kw)
        );
      }
      return true;
    });
  }, [data, filterStation, filterPaymentStatus, filterNotifyStatus, keyword]);

  const notifiedCount = filteredData.filter((item) => item.notifyStatus !== 'PENDING').length;
  const pickedCount = filteredData.filter((item) => item.notifyStatus === 'PICKED_UP').length;

  const handleReset = () => {
    setFilterStation('ALL');
    setFilterPaymentStatus('ALL');
    setFilterNotifyStatus('ALL');
    setKeyword('');
    setShowAdvancedFilters(false);
  };

  const handleNotify = (record: PickupRecord) => {
    if (record.notifyStatus === 'PICKED_UP') {
      message.info('该自提单已完成核销');
      return;
    }
    setData((prev) =>
      prev.map((item) =>
        item.id === record.id
          ? { ...item, notifyStatus: 'NOTIFIED', notifyTime: dayjs().format('YYYY/MM/DD HH:mm:ss') }
          : item,
      ),
    );
    message.success(`已发送自提通知（${record.pickupCode}）`);
  };

  const handlePickup = (record: PickupRecord) => {
    if (record.notifyStatus === 'PENDING') {
      message.warning('请先发送自提通知');
      return;
    }
    setData((prev) =>
      prev.map((item) =>
        item.id === record.id
          ? { ...item, notifyStatus: 'PICKED_UP', pickedUpTime: dayjs().format('YYYY/MM/DD HH:mm:ss') }
          : item,
      ),
    );
    message.success(`已完成自提核销：${record.trackingNo}`);
  };

  return (
    <div>
      <Space size={[8, 8]} wrap style={{ marginBottom: 10 }}>
        <Tag color="blue">自提单总数 {filteredData.length}</Tag>
        <Tag color="processing">已通知 {notifiedCount}</Tag>
        <Tag color="green">已核销 {pickedCount}</Tag>
      </Space>

      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Row gutter={[8, 8]} align="middle">
          <Col span={4}>
            <Select value={filterStation} onChange={setFilterStation} style={{ width: '100%' }}>
              <Select.Option value="ALL">全部站点</Select.Option>
              <Select.Option value="IKEJ STA">IKEJ STA</Select.Option>
              <Select.Option value="ABUJ STA">ABUJ STA</Select.Option>
            </Select>
          </Col>
          <Col flex="auto">
            <Input
              placeholder="自提单号/运单号/收件人/电话"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
              <Button type="link" onClick={() => setShowAdvancedFilters(v => !v)}>
                {showAdvancedFilters ? '收起筛选' : '高级筛选'}
              </Button>
            </Space>
          </Col>
        </Row>
        {showAdvancedFilters && (
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            <Col span={4}>
              <Select value={filterPaymentStatus} onChange={setFilterPaymentStatus} style={{ width: '100%' }}>
                <Select.Option value="ALL">全部支付状态</Select.Option>
                <Select.Option value="PAID">已付</Select.Option>
                <Select.Option value="UNPAID">未付</Select.Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select value={filterNotifyStatus} onChange={setFilterNotifyStatus} style={{ width: '100%' }}>
                <Select.Option value="ALL">全部通知状态</Select.Option>
                <Select.Option value="PENDING">待通知</Select.Option>
                <Select.Option value="NOTIFIED">已通知</Select.Option>
                <Select.Option value="PICKED_UP">已核销</Select.Option>
              </Select>
            </Col>
          </Row>
        )}
      </Card>
      <Table
        rowKey="id"
        dataSource={filteredData}
        columns={[
          { title: '自提单号', dataIndex: 'pickupNo', key: 'pickupNo', width: 180 },
          { title: '运单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 160 },
          { title: '收件人', dataIndex: 'recipientName', key: 'recipientName', width: 110 },
          { title: '电话', dataIndex: 'recipientPhone', key: 'recipientPhone', width: 150 },
          { title: '自提站点', dataIndex: 'pickupStation', key: 'pickupStation', width: 110 },
          { title: '自提码', dataIndex: 'pickupCode', key: 'pickupCode', width: 100, render: (code: string) => <Tag color="purple">{code}</Tag> },
          {
            title: '支付',
            key: 'payment',
            width: 180,
            render: (_: unknown, record: PickupRecord) => (
              <Space direction="vertical" size={0}>
                <span>
                  {record.paymentMethod === 'COD' ? '到付' : '预付'}
                  <Tag color={record.paymentStatus === 'PAID' ? 'green' : 'orange'} style={{ marginLeft: 6 }}>
                    {record.paymentStatus === 'PAID' ? '已付' : '未付'}
                  </Tag>
                </span>
                {record.paymentStatus === 'UNPAID' && (
                  <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                    {record.currency} {record.paymentAmount.toLocaleString()}
                  </span>
                )}
              </Space>
            ),
          },
          {
            title: '通知状态',
            key: 'notifyStatus',
            width: 110,
            render: (_: unknown, record: PickupRecord) => {
              if (record.notifyStatus === 'PICKED_UP') return <Tag color="success">已核销</Tag>;
              if (record.notifyStatus === 'NOTIFIED') return <Tag color="processing">已通知</Tag>;
              return <Tag>待通知</Tag>;
            },
          },
          {
            title: '操作',
            key: 'action',
            width: 170,
            fixed: 'right',
            render: (_: unknown, record: PickupRecord) => (
              <Space size="small">
                <Button
                  type="link"
                  size="small"
                  icon={<BellOutlined />}
                  disabled={record.notifyStatus === 'PICKED_UP'}
                  onClick={() => handleNotify(record)}
                >
                  通知
                </Button>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  disabled={record.notifyStatus === 'PICKED_UP'}
                  onClick={() => handlePickup(record)}
                >
                  核销自提
                </Button>
              </Space>
            ),
          },
          { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 120, render: (text: string) => dayjs(text).format('YYYY-MM-DD') },
        ]}
        scroll={{ x: 1700, y: showAdvancedFilters ? 'calc(100vh - 510px)' : 'calc(100vh - 460px)' }}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        size="small"
      />
    </div>
  );
};
