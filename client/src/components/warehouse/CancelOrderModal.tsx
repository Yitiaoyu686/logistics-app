import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Descriptions,
  Table,
  Select,
  Checkbox,
  Button,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';

export interface SubOrderForCancel {
  id: string;
  subOrderNo: string;
  trackingNo: string;
  expressCompany?: string;
  status: string;
  statusTime?: string;
  updateDate?: string;
}

export interface CancelOrderModalProps {
  visible: boolean;
  orderId: string;
  orderNo?: string;
  routeCode?: string;
  serviceType?: string;
  salesPerson?: string;
  customerName?: string;
  subOrders?: SubOrderForCancel[];
  onSubmit: (cancelledSubOrders: string[], reasons: Record<string, string>) => void;
  onCancel: () => void;
}

const CANCEL_REASONS = [
  '客户取消',
  '地址错误',
  '货物损坏',
  '重复下单',
  '无法联系客户',
  '海关扣留',
  '禁运物品',
  '其他',
];

const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  visible,
  orderNo,
  routeCode,
  serviceType,
  salesPerson,
  customerName,
  subOrders = [],
  onSubmit,
  onCancel,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, string>>({});

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setSelectedIds(new Set());
      setReasons({});
    }
  }, [visible]);

  const allSelected = useMemo(
    () => subOrders.length > 0 && subOrders.every((s) => selectedIds.has(s.id)),
    [subOrders, selectedIds],
  );

  const someSelected = useMemo(
    () => subOrders.some((s) => selectedIds.has(s.id)) && !allSelected,
    [subOrders, selectedIds, allSelected],
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(subOrders.map((s) => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleReasonChange = (id: string, reason: string) => {
    setReasons((prev) => ({ ...prev, [id]: reason }));
  };

  const handleSubmit = () => {
    if (selectedIds.size === 0) {
      message.warning('请至少选择一个子订单');
      return;
    }

    const missingReason = Array.from(selectedIds).find((id) => !reasons[id]);
    if (missingReason) {
      const sub = subOrders.find((s) => s.id === missingReason);
      message.warning(`子订单 ${sub?.subOrderNo ?? missingReason} 未选择取消原因`);
      return;
    }

    const selectedReasons: Record<string, string> = {};
    selectedIds.forEach((id) => {
      selectedReasons[id] = reasons[id];
    });

    onSubmit(Array.from(selectedIds), selectedReasons);
  };

  const columns: ColumnsType<SubOrderForCancel> = [
    {
      title: '第三方运单',
      dataIndex: 'trackingNo',
      key: 'trackingNo',
      render: (trackingNo: string, record: SubOrderForCancel) => (
        <span>
          {trackingNo}
          {record.expressCompany && (
            <span style={{ color: '#999', marginLeft: 4 }}>({record.expressCompany})</span>
          )}
        </span>
      ),
    },
    {
      title: '订单号',
      dataIndex: 'subOrderNo',
      key: 'subOrderNo',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: SubOrderForCancel) => (
        <span>
          <Tag>{status}</Tag>
          {record.statusTime && (
            <span style={{ fontSize: 12, color: '#999', marginLeft: 4 }}>
              {record.statusTime}
            </span>
          )}
        </span>
      ),
    },
    {
      title: '取消原因',
      key: 'cancelReason',
      width: 160,
      render: (_: unknown, record: SubOrderForCancel) => (
        <Select
          style={{ width: '100%' }}
          placeholder="请选择"
          value={reasons[record.id] || undefined}
          onChange={(val) => handleReasonChange(record.id, val)}
          options={CANCEL_REASONS.map((r) => ({ label: r, value: r }))}
          size="small"
        />
      ),
    },
    {
      title: () => (
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={(e) => handleSelectAll(e.target.checked)}
        >
          选择
        </Checkbox>
      ),
      key: 'select',
      width: 80,
      align: 'center',
      render: (_: unknown, record: SubOrderForCancel) => (
        <Checkbox
          checked={selectedIds.has(record.id)}
          onChange={(e) => handleSelect(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '更新日期',
      dataIndex: 'updateDate',
      key: 'updateDate',
    },
  ];

  return (
    <Modal
      title="取消子订单"
      open={visible}
      onCancel={onCancel}
      width={900}
      destroyOnClose
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button style={{ marginRight: 8 }} onClick={onCancel}>
            返回
          </Button>
          <Button type="primary" danger onClick={handleSubmit}>
            提交
          </Button>
        </div>
      }
    >
      <Descriptions
        bordered
        size="small"
        column={3}
        style={{ marginBottom: 16 }}
      >
        <Descriptions.Item label="订单号">{orderNo ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="线路">{routeCode ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="服务类型">{serviceType ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="业务员">{salesPerson ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="用户">{customerName ?? '-'}</Descriptions.Item>
      </Descriptions>

      <Table<SubOrderForCancel>
        columns={columns}
        dataSource={subOrders}
        rowKey="id"
        size="small"
        pagination={false}
      />
    </Modal>
  );
};

export default CancelOrderModal;
