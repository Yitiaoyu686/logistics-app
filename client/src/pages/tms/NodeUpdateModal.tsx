import React, { useState, useEffect } from 'react';
import {
  Modal, Radio, Space, Typography, Divider, Tag, Alert,
  Timeline, message, Input, Checkbox
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined,
  RocketOutlined, ContainerOutlined, EnvironmentOutlined,
  FileProtectOutlined, CarOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

// 物流节点定义
interface LogisticsNode {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const LOGISTICS_NODES: LogisticsNode[] = [
  {
    key: 'BOOKING_CONFIRMED',
    label: '订舱确认',
    icon: <FileProtectOutlined />,
    description: '已确认舱位，开始配载',
    color: '#1890ff'
  },
  {
    key: 'LOADING_COMPLETED',
    label: '装柜完成',
    icon: <ContainerOutlined />,
    description: '集装箱装柜完成',
    color: '#52c41a'
  },
  {
    key: 'CUSTOMS_CLEARED',
    label: '报关放行',
    icon: <FileProtectOutlined />,
    description: '海关放行，准备离港',
    color: '#13c2c2'
  },
  {
    key: 'DEPARTED',
    label: '离港',
    icon: <RocketOutlined />,
    description: '已离开起运港',
    color: '#722ed1'
  },
  {
    key: 'IN_TRANSIT',
    label: '在途',
    icon: <EnvironmentOutlined />,
    description: '运输途中',
    color: '#fa8c16'
  },
  {
    key: 'ARRIVED',
    label: '到港',
    icon: <EnvironmentOutlined />,
    description: '已到达目的港',
    color: '#eb2f96'
  },
  {
    key: 'CUSTOMS_CLEARANCE',
    label: '清关',
    icon: <FileProtectOutlined />,
    description: '目的港清关中',
    color: '#faad14'
  },
  {
    key: 'DELIVERY',
    label: '派送',
    icon: <CarOutlined />,
    description: '派送至目的仓',
    color: '#52c41a'
  }
];

interface NodeUpdateModalProps {
  visible: boolean;
  jobId: string;
  currentStatus: string;
  onCancel: () => void;
  onConfirm: (jobId: string, newNode: string, exceptionInfo?: { hasException: boolean; remark?: string }) => void;
}

export const NodeUpdateModal: React.FC<NodeUpdateModalProps> = ({
  visible,
  jobId,
  currentStatus,
  onCancel,
  onConfirm
}) => {
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [hasException, setHasException] = useState(false);
  const [exceptionRemark, setExceptionRemark] = useState('');

  // 当 Modal 打开时，默认选中当前状态
  useEffect(() => {
    if (visible) {
      setSelectedNode(currentStatus || '');
      setHasException(false);
      setExceptionRemark('');
    }
  }, [visible, currentStatus]);

  const handleConfirm = async () => {
    if (!selectedNode) {
      message.warning('请选择要更新的节点');
      return;
    }

    if (hasException && !exceptionRemark.trim()) {
      message.warning('请填写异常情况说明');
      return;
    }

    setLoading(true);
    try {
      // 模拟 API 调用
      await new Promise(resolve => setTimeout(resolve, 500));

      onConfirm(jobId, selectedNode, {
        hasException,
        remark: hasException ? exceptionRemark : undefined
      });

      const successMsg = hasException
        ? '节点更新成功，已记录异常信息'
        : '节点更新成功';
      message.success(successMsg);

      setSelectedNode('');
      setHasException(false);
      setExceptionRemark('');
    } catch (error) {
      message.error('节点更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedNode('');
    setHasException(false);
    setExceptionRemark('');
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          <Text>更新物流节点</Text>
          <Tag color="blue">{jobId}</Tag>
        </Space>
      }
      open={visible}
      onOk={handleConfirm}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={700}
      okText="确认更新"
      cancelText="取消"
      zIndex={2000}
    >
      <Alert
        message="提示"
        description="请选择当前任务的最新物流节点状态，系统将记录更新时间和操作人"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Divider titlePlacement="left">当前状态</Divider>
      <div style={{ marginBottom: 24, padding: 16, background: '#f5f7fa', borderRadius: 8 }}>
        {currentStatus ? (
          <Space size="large">
            <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>
              {LOGISTICS_NODES.find(n => n.key === currentStatus)?.label || currentStatus}
            </Tag>
            <Text type="secondary">
              {LOGISTICS_NODES.find(n => n.key === currentStatus)?.description}
            </Text>
          </Space>
        ) : (
          <Text type="secondary">暂无状态</Text>
        )}
      </div>

      <Divider titlePlacement="left">选择新节点</Divider>
      <Radio.Group
        value={selectedNode}
        onChange={(e) => setSelectedNode(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {LOGISTICS_NODES.map((node) => (
            <Radio
              key={node.key}
              value={node.key}
              style={{
                width: '100%',
                padding: 16,
                border: '1px solid #d9d9d9',
                borderRadius: 8,
                background: selectedNode === node.key ? '#e6f7ff' : '#fff',
                borderColor: selectedNode === node.key ? '#1890ff' : '#d9d9d9'
              }}
            >
              <Space align="start" size="middle">
                <div style={{ fontSize: 20, color: node.color }}>
                  {node.icon}
                </div>
                <div>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>
                      {node.label}
                    </Text>
                    {node.key === currentStatus && (
                      <Tag color="orange" style={{ marginLeft: 8 }}>当前</Tag>
                    )}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {node.description}
                    </Text>
                  </div>
                </div>
              </Space>
            </Radio>
          ))}
        </Space>
      </Radio.Group>

      <Divider titlePlacement="left">异常情况</Divider>
      <div style={{ marginBottom: 16 }}>
        <Checkbox
          checked={hasException}
          onChange={(e) => setHasException(e.target.checked)}
        >
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <Text>此节点存在异常情况</Text>
          </Space>
        </Checkbox>
      </div>

      {hasException && (
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="请详细描述异常情况"
            description="例如：集装箱损坏、货物丢失、海关扣货、天气延误等"
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
          />
          <Input.TextArea
            value={exceptionRemark}
            onChange={(e) => setExceptionRemark(e.target.value)}
            placeholder="请输入异常情况的详细说明..."
            rows={4}
            maxLength={500}
            showCount
          />
        </div>
      )}

      <Divider />
      <Text type="secondary" style={{ fontSize: 12 }}>
        * 节点更新后将自动记录更新时间为: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
      </Text>
    </Modal>
  );
};
