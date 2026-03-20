import React, { useState, useMemo } from 'react';
import {
  Modal, Card, Row, Col, Table, Button, Space, Tag, Form, Input, Select,
  InputNumber, message, Divider, Statistic, Alert, Checkbox, Typography,
  DatePicker, Radio
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, WarningOutlined, CheckCircleOutlined,
  SplitCellsOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { MasterOrder, OrderItem, SubOrder } from '../../types/core';

const { Text } = Typography;
const { TextArea } = Input;

interface SubOrderConfig {
  id: string; // Temporary ID for UI
  batchNo: number;
  transportType: 'SEA' | 'AIR';
  route: string;
  splitReason: string;
  estimatedDeparture?: string;
  assignedItems: { itemId: string; quantity: number }[]; // Item assignments
}

interface OrderSplitModalProps {
  visible: boolean;
  masterOrder: MasterOrder;
  onCancel: () => void;
  onConfirm: (subOrders: SubOrderConfig[]) => void;
}

export const OrderSplitModal: React.FC<OrderSplitModalProps> = ({
  visible,
  masterOrder,
  onCancel,
  onConfirm
}) => {
  const [subOrderConfigs, setSubOrderConfigs] = useState<SubOrderConfig[]>([
    {
      id: 'sub-1',
      batchNo: 1,
      transportType: 'SEA',
      route: masterOrder.preferredRoute || '',
      splitReason: '',
      assignedItems: []
    }
  ]);

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [activeSubOrderId, setActiveSubOrderId] = useState<string>('sub-1');

  // Calculate item allocation status
  const itemAllocationMap = useMemo(() => {
    const map = new Map<string, { allocated: number; remaining: number }>();

    masterOrder.items.forEach(item => {
      let allocated = 0;
      subOrderConfigs.forEach(config => {
        const assignment = config.assignedItems.find(a => a.itemId === item.id);
        if (assignment) {
          allocated += assignment.quantity;
        }
      });
      map.set(item.id, {
        allocated,
        remaining: item.quantity - allocated
      });
    });

    return map;
  }, [masterOrder.items, subOrderConfigs]);

  // Check if all items are allocated
  const allItemsAllocated = useMemo(() => {
    return Array.from(itemAllocationMap.values()).every(stat => stat.remaining === 0);
  }, [itemAllocationMap]);

  // Calculate sub-order statistics
  const calculateSubOrderStats = (config: SubOrderConfig) => {
    let pieces = 0;
    let weight = 0;
    let volume = 0;
    let value = 0;

    config.assignedItems.forEach(assignment => {
      const item = masterOrder.items.find(i => i.id === assignment.itemId);
      if (item) {
        pieces += assignment.quantity;
        weight += item.weight * assignment.quantity;
        volume += item.volume * assignment.quantity;
        value += (item.declaredValue || 0) * assignment.quantity;
      }
    });

    return { pieces, weight, volume, value };
  };

  // Add new sub-order
  const handleAddSubOrder = () => {
    const newId = `sub-${subOrderConfigs.length + 1}`;
    const newBatchNo = Math.max(...subOrderConfigs.map(s => s.batchNo)) + 1;

    setSubOrderConfigs([
      ...subOrderConfigs,
      {
        id: newId,
        batchNo: newBatchNo,
        transportType: 'SEA',
        route: masterOrder.preferredRoute || '',
        splitReason: '',
        assignedItems: []
      }
    ]);
    setActiveSubOrderId(newId);
  };

  // Remove sub-order
  const handleRemoveSubOrder = (id: string) => {
    if (subOrderConfigs.length === 1) {
      message.warning('至少需要保留一个子订单');
      return;
    }
    setSubOrderConfigs(subOrderConfigs.filter(s => s.id !== id));
    if (activeSubOrderId === id) {
      setActiveSubOrderId(subOrderConfigs[0].id);
    }
  };

  // Update sub-order field
  const handleUpdateSubOrder = (id: string, field: keyof SubOrderConfig, value: any) => {
    setSubOrderConfigs(
      subOrderConfigs.map(s => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  // Assign selected items to active sub-order
  const handleAssignItems = () => {
    if (selectedItemIds.length === 0) {
      message.warning('请先选择要分配的物品');
      return;
    }

    const activeConfig = subOrderConfigs.find(s => s.id === activeSubOrderId);
    if (!activeConfig) return;

    const newAssignedItems = [...activeConfig.assignedItems];

    selectedItemIds.forEach(itemId => {
      const item = masterOrder.items.find(i => i.id === itemId);
      if (!item) return;

      const allocation = itemAllocationMap.get(itemId);
      if (!allocation || allocation.remaining === 0) {
        message.warning(`${item.name} 已全部分配`);
        return;
      }

      // Check if already assigned to this sub-order
      const existingIndex = newAssignedItems.findIndex(a => a.itemId === itemId);
      if (existingIndex >= 0) {
        // Increase quantity (up to remaining)
        const canAdd = allocation.remaining;
        newAssignedItems[existingIndex].quantity += canAdd;
      } else {
        // Add new assignment with remaining quantity
        newAssignedItems.push({
          itemId,
          quantity: allocation.remaining
        });
      }
    });

    handleUpdateSubOrder(activeSubOrderId, 'assignedItems', newAssignedItems);
    setSelectedItemIds([]);
    message.success('物品分配成功');
  };

  // Update assignment quantity
  const handleUpdateAssignment = (subOrderId: string, itemId: string, quantity: number) => {
    const config = subOrderConfigs.find(s => s.id === subOrderId);
    if (!config) return;

    const item = masterOrder.items.find(i => i.id === itemId);
    if (!item) return;

    const allocation = itemAllocationMap.get(itemId);
    if (!allocation) return;

    const currentAssignment = config.assignedItems.find(a => a.itemId === itemId);
    const currentQuantity = currentAssignment?.quantity || 0;
    const maxQuantity = allocation.remaining + currentQuantity;

    if (quantity > maxQuantity) {
      message.warning(`${item.name} 最多还可分配 ${maxQuantity} 件`);
      return;
    }

    const newAssignedItems = config.assignedItems.map(a =>
      a.itemId === itemId ? { ...a, quantity } : a
    ).filter(a => a.quantity > 0);

    handleUpdateSubOrder(subOrderId, 'assignedItems', newAssignedItems);
  };

  // Remove assignment
  const handleRemoveAssignment = (subOrderId: string, itemId: string) => {
    const config = subOrderConfigs.find(s => s.id === subOrderId);
    if (!config) return;

    const newAssignedItems = config.assignedItems.filter(a => a.itemId !== itemId);
    handleUpdateSubOrder(subOrderId, 'assignedItems', newAssignedItems);
  };

  // Validate and submit
  const handleSubmit = () => {
    // Check if all items are allocated
    if (!allItemsAllocated) {
      message.error('请分配所有物品后再提交');
      return;
    }

    // Validate each sub-order
    for (const config of subOrderConfigs) {
      if (!config.route) {
        message.error(`子订单${config.batchNo}：请填写运输路线`);
        return;
      }
      if (!config.splitReason) {
        message.error(`子订单${config.batchNo}：请填写拆单原因`);
        return;
      }
      if (config.assignedItems.length === 0) {
        message.error(`子订单${config.batchNo}：请至少分配一件物品`);
        return;
      }
    }

    onConfirm(subOrderConfigs);
  };

  // Item columns for selection table
  const itemColumns = [
    {
      title: '物品名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string, record: OrderItem) => (
        <Space direction="vertical" size={0}>
          <Text>{text}</Text>
          {record.nameEn && (
            <Text type="secondary" style={{ fontSize: 12 }}>{record.nameEn}</Text>
          )}
        </Space>
      )
    },
    {
      title: '总数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80
    },
    {
      title: '已分配',
      key: 'allocated',
      width: 80,
      render: (_: any, record: OrderItem) => {
        const allocation = itemAllocationMap.get(record.id);
        return (
          <Text type={allocation?.remaining === 0 ? 'success' : undefined}>
            {allocation?.allocated || 0}
          </Text>
        );
      }
    },
    {
      title: '待分配',
      key: 'remaining',
      width: 80,
      render: (_: any, record: OrderItem) => {
        const allocation = itemAllocationMap.get(record.id);
        const remaining = allocation?.remaining || 0;
        return (
          <Text strong type={remaining === 0 ? 'secondary' : 'warning'}>
            {remaining}
          </Text>
        );
      }
    },
    {
      title: '重量(kg)',
      dataIndex: 'weight',
      key: 'weight',
      width: 90,
      render: (weight: number, record: OrderItem) => (
        <Text>{(weight * record.quantity).toFixed(2)}</Text>
      )
    },
    {
      title: '体积(m³)',
      dataIndex: 'volume',
      key: 'volume',
      width: 90,
      render: (volume: number, record: OrderItem) => (
        <Text>{(volume * record.quantity).toFixed(3)}</Text>
      )
    },
    {
      title: '属性',
      dataIndex: 'attributes',
      key: 'attributes',
      width: 120,
      render: (attrs?: string[]) => (
        <>
          {attrs?.slice(0, 2).map((attr, idx) => (
            <Tag key={idx} color="orange" style={{ fontSize: 11, marginBottom: 2 }}>
              {attr}
            </Tag>
          ))}
        </>
      )
    }
  ];

  // Assignment columns for sub-order detail
  const assignmentColumns = (subOrderId: string) => [
    {
      title: '物品名称',
      key: 'name',
      render: (_: any, record: { itemId: string; quantity: number }) => {
        const item = masterOrder.items.find(i => i.id === record.itemId);
        return item ? item.name : '-';
      }
    },
    {
      title: '分配数量',
      key: 'quantity',
      width: 150,
      render: (_: any, record: { itemId: string; quantity: number }) => {
        const item = masterOrder.items.find(i => i.id === record.itemId);
        const allocation = itemAllocationMap.get(record.itemId);
        if (!item || !allocation) return '-';

        const currentQuantity = record.quantity;
        const maxQuantity = allocation.remaining + currentQuantity;

        return (
          <InputNumber
            size="small"
            min={1}
            max={maxQuantity}
            value={currentQuantity}
            onChange={(value) => handleUpdateAssignment(subOrderId, record.itemId, value || 1)}
            style={{ width: 80 }}
            suffix={`/ ${maxQuantity}`}
          />
        );
      }
    },
    {
      title: '重量',
      key: 'weight',
      width: 100,
      render: (_: any, record: { itemId: string; quantity: number }) => {
        const item = masterOrder.items.find(i => i.id === record.itemId);
        return item ? `${(item.weight * record.quantity).toFixed(2)} kg` : '-';
      }
    },
    {
      title: '体积',
      key: 'volume',
      width: 100,
      render: (_: any, record: { itemId: string; quantity: number }) => {
        const item = masterOrder.items.find(i => i.id === record.itemId);
        return item ? `${(item.volume * record.quantity).toFixed(3)} m³` : '-';
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: { itemId: string; quantity: number }) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveAssignment(subOrderId, record.itemId)}
        >
          移除
        </Button>
      )
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <SplitCellsOutlined />
          <span>拆分订单 - {masterOrder.orderNo}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={1400}
      style={{ top: 20 }}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleSubmit}
            disabled={!allItemsAllocated}
          >
            确认拆分
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Alert
          message="拆单说明"
          description="将主订单的物品分配到多个子订单中，支持不同批次、不同运输方式。请确保所有物品都被分配后再提交。"
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
        />
      </div>

      <Row gutter={16}>
        {/* Left Column: Item Pool */}
        <Col span={10}>
          <Card
            title="待分配物品池"
            size="small"
            extra={
              <Space>
                <Text type="secondary">
                  {allItemsAllocated ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>全部已分配</Tag>
                  ) : (
                    <Tag color="warning" icon={<WarningOutlined />}>
                      剩余 {Array.from(itemAllocationMap.values()).filter(s => s.remaining > 0).length} 项
                    </Tag>
                  )}
                </Text>
              </Space>
            }
            style={{ height: 600 }}
          >
            <Table
              rowSelection={{
                selectedRowKeys: selectedItemIds,
                onChange: (keys) => setSelectedItemIds(keys as string[]),
                getCheckboxProps: (record: OrderItem) => {
                  const allocation = itemAllocationMap.get(record.id);
                  return {
                    disabled: allocation?.remaining === 0
                  };
                }
              }}
              dataSource={masterOrder.items}
              columns={itemColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 450 }}
            />
            <div style={{ marginTop: 12 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAssignItems}
                disabled={selectedItemIds.length === 0}
                block
              >
                分配到当前子订单
              </Button>
            </div>
          </Card>
        </Col>

        {/* Right Column: Sub-orders Configuration */}
        <Col span={14}>
          <Card
            title={`子订单配置 (${subOrderConfigs.length}个)`}
            size="small"
            extra={
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddSubOrder}
                size="small"
              >
                添加子订单
              </Button>
            }
            style={{ height: 600, overflow: 'auto' }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {subOrderConfigs.map((config) => {
                const stats = calculateSubOrderStats(config);
                const isActive = activeSubOrderId === config.id;

                return (
                  <Card
                    key={config.id}
                    size="small"
                    type={isActive ? 'inner' : undefined}
                    style={{
                      border: isActive ? '2px solid #1890ff' : '1px solid #f0f0f0',
                      cursor: 'pointer'
                    }}
                    onClick={() => setActiveSubOrderId(config.id)}
                    title={
                      <Space>
                        <Text strong>批次 {config.batchNo}</Text>
                        {isActive && <Tag color="blue">当前选中</Tag>}
                        {config.assignedItems.length === 0 && (
                          <Tag color="warning" icon={<WarningOutlined />}>未分配物品</Tag>
                        )}
                      </Space>
                    }
                    extra={
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSubOrder(config.id);
                        }}
                      >
                        删除
                      </Button>
                    }
                  >
                    {/* Configuration Form */}
                    <Row gutter={16} style={{ marginBottom: 12 }}>
                      <Col span={8}>
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>运输方式 *</Text>
                        </div>
                        <Radio.Group
                          value={config.transportType}
                          onChange={(e) => handleUpdateSubOrder(config.id, 'transportType', e.target.value)}
                          size="small"
                        >
                          <Radio.Button value="SEA">海运</Radio.Button>
                          <Radio.Button value="AIR">空运</Radio.Button>
                        </Radio.Group>
                      </Col>
                      <Col span={16}>
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>运输路线 *</Text>
                        </div>
                        <Input
                          size="small"
                          placeholder="例如: 广州 → 拉各斯"
                          value={config.route}
                          onChange={(e) => handleUpdateSubOrder(config.id, 'route', e.target.value)}
                        />
                      </Col>
                    </Row>

                    <Row gutter={16} style={{ marginBottom: 12 }}>
                      <Col span={12}>
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>预计发货时间</Text>
                        </div>
                        <DatePicker
                          size="small"
                          showTime
                          format="YYYY-MM-DD HH:mm"
                          value={config.estimatedDeparture ? dayjs(config.estimatedDeparture) : null}
                          onChange={(date) =>
                            handleUpdateSubOrder(
                              config.id,
                              'estimatedDeparture',
                              date ? date.format('YYYY-MM-DD HH:mm:ss') : undefined
                            )
                          }
                          style={{ width: '100%' }}
                        />
                      </Col>
                      <Col span={12}>
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>拆单原因 *</Text>
                        </div>
                        <Input
                          size="small"
                          placeholder="例如: 首批海运发货"
                          value={config.splitReason}
                          onChange={(e) => handleUpdateSubOrder(config.id, 'splitReason', e.target.value)}
                        />
                      </Col>
                    </Row>

                    <Divider style={{ margin: '12px 0' }} />

                    {/* Assigned Items */}
                    <div style={{ marginBottom: 8 }}>
                      <Text strong style={{ fontSize: 12 }}>已分配物品 ({config.assignedItems.length}项)</Text>
                    </div>

                    {config.assignedItems.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 24, background: '#fafafa', borderRadius: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          暂无分配物品，请从左侧物品池选择
                        </Text>
                      </div>
                    ) : (
                      <>
                        <Table
                          dataSource={config.assignedItems}
                          columns={assignmentColumns(config.id)}
                          rowKey="itemId"
                          size="small"
                          pagination={false}
                          scroll={{ y: 150 }}
                        />

                        {/* Statistics */}
                        <div style={{ marginTop: 12, padding: 12, background: '#f5f7fa', borderRadius: 4 }}>
                          <Row gutter={16}>
                            <Col span={6}>
                              <Statistic
                                title="件数"
                                value={stats.pieces}
                                suffix="件"
                                valueStyle={{ fontSize: 14 }}
                              />
                            </Col>
                            <Col span={6}>
                              <Statistic
                                title="重量"
                                value={stats.weight.toFixed(1)}
                                suffix="kg"
                                valueStyle={{ fontSize: 14 }}
                              />
                            </Col>
                            <Col span={6}>
                              <Statistic
                                title="体积"
                                value={stats.volume.toFixed(3)}
                                suffix="m³"
                                valueStyle={{ fontSize: 14 }}
                              />
                            </Col>
                            <Col span={6}>
                              <Statistic
                                title="货值"
                                value={stats.value.toFixed(2)}
                                prefix="$"
                                valueStyle={{ fontSize: 14 }}
                              />
                            </Col>
                          </Row>
                        </div>
                      </>
                    )}
                  </Card>
                );
              })}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Summary Footer */}
      <Card size="small" style={{ marginTop: 16, background: '#fafafa' }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="子订单总数"
              value={subOrderConfigs.length}
              suffix="个"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="物品分配进度"
              value={
                Math.round(
                  (Array.from(itemAllocationMap.values()).filter(s => s.remaining === 0).length /
                    masterOrder.items.length) *
                    100
                )
              }
              suffix="%"
              valueStyle={{
                color: allItemsAllocated ? '#3f8600' : '#faad14'
              }}
            />
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              <div>总件数: {masterOrder.totalPieces} 件</div>
              <div>总重量: {masterOrder.totalWeight.toFixed(1)} kg</div>
              <div>总体积: {masterOrder.totalVolume.toFixed(3)} m³</div>
            </div>
          </Col>
        </Row>
      </Card>
    </Modal>
  );
};
