import React, { useState } from 'react';
import {
  Card, Table, Button, Modal, Space, Tag, message, Tabs, Badge, Descriptions
} from 'antd';
import {
  WarningOutlined, ClockCircleOutlined, DollarOutlined,
  CheckOutlined, CloseOutlined, EyeOutlined, ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { TabPane } = Tabs;

// 预警类型定义
type AlertType = 'ORDER_DELAY' | 'PAYMENT_OVERDUE' | 'STOCK_ABNORMAL' | 'FEE_PENDING' | 'CUSTOMS_DELAY';
type AlertLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type AlertStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'IGNORED';

interface AlertItem {
  id: string;
  alertNo: string;
  type: AlertType;
  level: AlertLevel;
  status: AlertStatus;
  title: string;
  description: string;
  relatedType?: 'ORDER' | 'JOB' | 'FEE' | 'STOCK';
  relatedId?: string;
  relatedNo?: string;
  triggerTime: string;
  resolvedTime?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  remark?: string;
}

// 预警类型配置
const ALERT_TYPE_CONFIG: Record<AlertType, { label: string; color: string }> = {
  ORDER_DELAY: { label: '订单延误', color: 'orange' },
  PAYMENT_OVERDUE: { label: '付款逾期', color: 'red' },
  STOCK_ABNORMAL: { label: '库存异常', color: 'purple' },
  FEE_PENDING: { label: '费用待审', color: 'blue' },
  CUSTOMS_DELAY: { label: '清关延误', color: 'volcano' },
};

// 预警级别配置
const ALERT_LEVEL_CONFIG: Record<AlertLevel, { label: string; color: string }> = {
  HIGH: { label: '高', color: 'red' },
  MEDIUM: { label: '中', color: 'orange' },
  LOW: { label: '低', color: 'blue' },
};

// 预警状态配置
const ALERT_STATUS_CONFIG: Record<AlertStatus, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'default' },
  PROCESSING: { label: '处理中', color: 'processing' },
  RESOLVED: { label: '已解决', color: 'success' },
  IGNORED: { label: '已忽略', color: 'default' },
};


export const AlertCenter: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('PENDING');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);

  // 统计数据
  const pendingCount = alerts.filter(a => a.status === 'PENDING').length;
  const processingCount = alerts.filter(a => a.status === 'PROCESSING').length;
  const highLevelCount = alerts.filter(a => a.level === 'HIGH' && a.status === 'PENDING').length;

  // 根据标签页筛选数据
  const filteredAlerts = alerts.filter(a => {
    if (activeTab === 'ALL') return true;
    return a.status === activeTab;
  });

  // 表格列定义
  const columns = [
    {
      title: '预警编号',
      dataIndex: 'alertNo',
      key: 'alertNo',
      width: 180,
    },
    {
      title: '预警类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: AlertType) => (
        <Tag color={ALERT_TYPE_CONFIG[type].color}>
          {ALERT_TYPE_CONFIG[type].label}
        </Tag>
      ),
    },
    {
      title: '严重程度',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: AlertLevel) => (
        <Tag color={ALERT_LEVEL_CONFIG[level].color}>
          {ALERT_LEVEL_CONFIG[level].label}
        </Tag>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
    },
    {
      title: '关联单号',
      dataIndex: 'relatedNo',
      key: 'relatedNo',
      width: 180,
      render: (text: string) => text || '-',
    },
    {
      title: '触发时间',
      dataIndex: 'triggerTime',
      key: 'triggerTime',
      width: 160,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: AlertStatus) => (
        <Tag color={ALERT_STATUS_CONFIG[status].color}>
          {ALERT_STATUS_CONFIG[status].label}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (record: AlertItem) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedAlert(record);
              setDetailModalVisible(true);
            }}
          >
            详情
          </Button>
          {record.status === 'PENDING' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleResolve(record.id)}
              >
                处理
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleIgnore(record.id)}
              >
                忽略
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  // 处理预警
  const handleResolve = async (id: string) => {
    try {
      setLoading(true);
      // TODO: 调用处理 API
      // await axios.post(`/api/alerts/${id}/resolve`);

      setAlerts(alerts.map(alert =>
        alert.id === id
          ? {
              ...alert,
              status: 'RESOLVED' as AlertStatus,
              resolvedTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              resolvedBy: 'CURRENT_USER',
              resolvedByName: '当前用户',
            }
          : alert
      ));
      message.success('预警已处理');
    } catch (error) {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 忽略预警
  const handleIgnore = async (id: string) => {
    Modal.confirm({
      title: '确认忽略',
      content: '确定要忽略这条预警吗？',
      onOk: async () => {
        try {
          setLoading(true);
          // TODO: 调用忽略 API
          // await axios.post(`/api/alerts/${id}/ignore`);

          setAlerts(alerts.map(alert =>
            alert.id === id
              ? { ...alert, status: 'IGNORED' as AlertStatus }
              : alert
          ));
          message.success('预警已忽略');
        } catch (error) {
          message.error('操作失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 刷新预警列表
  const handleRefresh = async () => {
    try {
      setLoading(true);
      // TODO: 调用刷新 API
      // const response = await axios.get('/api/alerts');
      // setAlerts(response.data);

      message.success('刷新成功');
    } catch (error) {
      message.error('刷新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 统计卡片 */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <div>
            <ClockCircleOutlined style={{ fontSize: 24, color: '#faad14', marginRight: 8 }} />
            <span style={{ fontSize: 16 }}>待处理: </span>
            <span style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>{pendingCount}</span>
          </div>
          <div>
            <WarningOutlined style={{ fontSize: 24, color: '#ff4d4f', marginRight: 8 }} />
            <span style={{ fontSize: 16 }}>高优先级: </span>
            <span style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>{highLevelCount}</span>
          </div>
          <div>
            <DollarOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 8 }} />
            <span style={{ fontSize: 16 }}>处理中: </span>
            <span style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>{processingCount}</span>
          </div>
        </Space>
      </Card>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
        </Space>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={<Badge count={pendingCount} offset={[10, 0]}>待处理</Badge>}
            key="PENDING"
          />
          <TabPane tab="处理中" key="PROCESSING" />
          <TabPane tab="已解决" key="RESOLVED" />
          <TabPane tab="已忽略" key="IGNORED" />
          <TabPane tab="全部" key="ALL" />
        </Tabs>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredAlerts}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 预警详情弹窗 */}
      <Modal
        title="预警详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedAlert && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="预警编号">{selectedAlert.alertNo}</Descriptions.Item>
            <Descriptions.Item label="预警类型">
              <Tag color={ALERT_TYPE_CONFIG[selectedAlert.type].color}>
                {ALERT_TYPE_CONFIG[selectedAlert.type].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="严重程度">
              <Tag color={ALERT_LEVEL_CONFIG[selectedAlert.level].color}>
                {ALERT_LEVEL_CONFIG[selectedAlert.level].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={ALERT_STATUS_CONFIG[selectedAlert.status].color}>
                {ALERT_STATUS_CONFIG[selectedAlert.status].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="标题" span={2}>{selectedAlert.title}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{selectedAlert.description}</Descriptions.Item>
            <Descriptions.Item label="关联单号">{selectedAlert.relatedNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="触发时间">{selectedAlert.triggerTime}</Descriptions.Item>
            {selectedAlert.resolvedTime && (
              <>
                <Descriptions.Item label="处理时间">{selectedAlert.resolvedTime}</Descriptions.Item>
                <Descriptions.Item label="处理人">{selectedAlert.resolvedByName || '-'}</Descriptions.Item>
                <Descriptions.Item label="处理备注" span={2}>{selectedAlert.remark || '-'}</Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
