import React, { useState, useEffect } from 'react';
import {
  Drawer, Descriptions, Table, Tag, Card, Typography, Timeline, message
} from 'antd';
import {
  ContainerOutlined, CheckCircleOutlined, LockOutlined,
  RocketOutlined, InboxOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ShippingUnit, ShippingUnitStatus } from '../../../types/core';
import { orderApi } from '../../../api';

const { Text } = Typography;

interface ShippingUnitDetailProps {
  visible: boolean;
  unit: ShippingUnit | null;
  onClose: () => void;
  onUpdate?: (unit: ShippingUnit) => void;
}

// 状态配置
const STATUS_CONFIG: Record<ShippingUnitStatus, { text: string; color: string; icon: React.ReactNode }> = {
  EMPTY: { text: '空闲', color: 'default', icon: <InboxOutlined /> },
  LOADING: { text: '装载中', color: 'processing', icon: <ContainerOutlined /> },
  SEALED: { text: '已封箱', color: 'success', icon: <LockOutlined /> },
  SHIPPED: { text: '已出库', color: 'default', icon: <RocketOutlined /> },
  ARRIVED: { text: '已到达', color: 'success', icon: <CheckCircleOutlined /> }
};

export const ShippingUnitDetail: React.FC<ShippingUnitDetailProps> = ({
  visible,
  unit,
  onClose
}) => {
  const [subOrders, setSubOrders] = useState<any[]>([]);

  // 从API加载关联的子订单
  useEffect(() => {
    if (!unit || !visible || unit.orderIds.length === 0) {
      setSubOrders([]);
      return;
    }
    const fetchSubOrders = async () => {
      try {
        const res: any = await orderApi.listSub();
        const allSubs = res.data || [];
        setSubOrders(allSubs.filter((s: any) => unit.orderIds.includes(s.id)));
      } catch (error: any) {
        message.error(error.message || '加载子订单数据失败');
      }
    };
    fetchSubOrders();
  }, [unit, visible]);

  if (!unit) return null;

  const statusConfig = STATUS_CONFIG[unit.status];
  const isSeaTransport = unit.transportMode === 'SEA';
  const grossWeight = Number((unit as any).grossWeight ?? unit.currentWeight ?? 0);
  const chargeableWeight = Number((unit as any).chargeableWeight ?? unit.currentWeight ?? 0);
  const volumeWeight = (unit as any).volumeWeight as number | undefined;

  // 订单列表表格列
  const orderColumns = [
    {
      title: '序号',
      key: 'index',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: '单号',
      dataIndex: 'subOrderNo',
      key: 'subOrderNo',
      width: 140,
      render: (text: string) => <a>{text}</a>
    },
    {
      title: '第三方运单',
      key: 'expressInfo',
      width: 150,
      render: (_: any, record: typeof subOrders[0]) => (
        <div>
          <div style={{ fontSize: 12 }}>{record.expressCompany || '-'}</div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.expressTrackingNo || '-'}
          </Text>
        </div>
      )
    },
    {
      title: '国家',
      dataIndex: 'destCountry',
      key: 'destCountry',
      width: 70
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 80,
      render: (text: string) => text || '-'
    },
    {
      title: '用户',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 100
    },
    {
      title: '品名',
      dataIndex: 'goodsDescription',
      key: 'goodsDescription',
      width: 100,
      render: (text: string, record: typeof subOrders[0]) => {
        if (text) return text;
        if (record.items && record.items.length > 0) {
          return record.items[0].name;
        }
        return '-';
      }
    },
    {
      title: '说明',
      dataIndex: 'cargoType',
      key: 'cargoType',
      width: 70,
      render: (text: string) => text || '普货'
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 60,
      align: 'right' as const
    },
    {
      title: '体积CBM',
      dataIndex: 'volume',
      key: 'volume',
      width: 90,
      align: 'right' as const,
      render: (volume: number) => volume.toFixed(2)
    },
    {
      title: '体积重KGS',
      dataIndex: 'volumeWeight',
      key: 'volumeWeight',
      width: 100,
      align: 'right' as const,
      render: (volumeWeight: number, record: typeof subOrders[0]) => {
        const vw = volumeWeight || record.volume;
        return vw.toFixed(2);
      }
    },
    {
      title: '毛量KGS',
      dataIndex: 'weight',
      key: 'weight',
      width: 90,
      align: 'right' as const,
      render: (weight: number) => weight.toFixed(2)
    }
  ];

  return (
    <Drawer
      title="运输单元详情"
      width={1200}
      open={visible}
      onClose={onClose}
      destroyOnClose
    >
      {/* 基本信息 */}
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={3} bordered>
          <Descriptions.Item label="单元编号" span={3}>
            <Text strong style={{ fontSize: 16 }}>{unit.unitNo}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="单元类型">
            <Tag color="blue">{unit.unitType}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="运输方式">
            <Tag color={isSeaTransport ? 'blue' : 'orange'}>
              {isSeaTransport ? '海运' : '空运'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusConfig.color} icon={statusConfig.icon}>
              {statusConfig.text}
            </Tag>
          </Descriptions.Item>
          {isSeaTransport && unit.sealNo && (
            <Descriptions.Item label="封条号" span={3}>
              {unit.sealNo}
            </Descriptions.Item>
          )}

          {/* 海运集装箱显示最大承重和体积 */}
          {isSeaTransport && unit.maxWeight && (
            <>
              <Descriptions.Item label="最大承重">
                {unit.maxWeight.toFixed(2)} kg
              </Descriptions.Item>
              <Descriptions.Item label="最大体积">
                {unit.maxVolume?.toFixed(2)} m³
              </Descriptions.Item>
              <Descriptions.Item label="当前装载">
                {unit.loadedOrders} 票 / {unit.loadedPieces} 件
              </Descriptions.Item>
              <Descriptions.Item label="当前重量">
                <Text strong>{unit.currentWeight?.toFixed(2)} kg</Text>
                <Text type="secondary"> / {unit.maxWeight.toFixed(2)} kg</Text>
              </Descriptions.Item>
              <Descriptions.Item label="当前体积">
                <Text strong>{unit.currentVolume?.toFixed(2)} m³</Text>
                <Text type="secondary"> / {unit.maxVolume?.toFixed(2)} m³</Text>
              </Descriptions.Item>
            </>
          )}

          {/* 空运单元显示重量信息 */}
          {!isSeaTransport && (
            <>
              <Descriptions.Item label="毛重">
                {grossWeight.toFixed(2)} kg
              </Descriptions.Item>
              <Descriptions.Item label="计费重量">
                {chargeableWeight.toFixed(2)} kg
              </Descriptions.Item>
              <Descriptions.Item label="当前装载">
                {unit.loadedOrders} 票 / {unit.loadedPieces} 件
              </Descriptions.Item>
              {volumeWeight && (
                <Descriptions.Item label="体积重">
                  {volumeWeight.toFixed(2)} kg
                </Descriptions.Item>
              )}
              {unit.length && unit.width && unit.height && (
                <Descriptions.Item label="尺寸(cm)">
                  {unit.length} × {unit.width} × {unit.height}
                </Descriptions.Item>
              )}
            </>
          )}
          <Descriptions.Item label="关联任务">
            {unit.jobNo ? <Tag color="blue">{unit.jobNo}</Tag> : <Text type="secondary">未绑定</Text>}
          </Descriptions.Item>
          {unit.route && (
            <Descriptions.Item label="线路" span={3}>
              {unit.route}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="创建时间">
            {dayjs(unit.createdAt).format('YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
          {unit.sealedTime && (
            <Descriptions.Item label="封箱时间">
              {dayjs(unit.sealedTime).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          )}
          {unit.operator && (
            <Descriptions.Item label="操作人">
              {unit.operator}
            </Descriptions.Item>
          )}
          {unit.remark && (
            <Descriptions.Item label="备注" span={3}>
              {unit.remark}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* 装载订单列表 */}
      <Card title={`装载订单 (${subOrders.length}票)`} style={{ marginBottom: 16 }}>
        {subOrders.length > 0 ? (
          <Table
            rowKey="id"
            columns={orderColumns}
            dataSource={subOrders}
            pagination={false}
            size="small"
            summary={(pageData) => {
              let totalPieces = 0;
              let totalVolume = 0;
              let totalVolumeWeight = 0;
              let totalWeight = 0;

              pageData.forEach(({ pieces, volume, volumeWeight, weight }) => {
                totalPieces += pieces;
                totalVolume += volume;
                totalVolumeWeight += (volumeWeight || volume);
                totalWeight += weight;
              });

              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={8} align="right">
                      <Text strong>合计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} align="right">
                      <Text strong>{totalPieces}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={9} align="right">
                      <Text strong>{totalVolume.toFixed(2)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={10} align="right">
                      <Text strong>{totalVolumeWeight.toFixed(2)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={11} align="right">
                      <Text strong>{totalWeight.toFixed(2)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
            <InboxOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div>暂无装载订单</div>
          </div>
        )}
      </Card>

      {/* 操作日志 */}
      <Card title="操作日志">
        <Timeline
          items={[
            {
              color: 'green',
              children: (
                <div>
                  <div style={{ fontWeight: 'bold' }}>创建运输单元</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {dayjs(unit.createdAt).format('YYYY-MM-DD HH:mm')} - {unit.operator || '系统'}
                  </div>
                </div>
              )
            },
            unit.loadingStartTime && {
              color: 'blue',
              children: (
                <div>
                  <div style={{ fontWeight: 'bold' }}>开始装载</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {dayjs(unit.loadingStartTime).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
              )
            },
            unit.sealedTime && {
              color: 'orange',
              children: (
                <div>
                  <div style={{ fontWeight: 'bold' }}>封箱完成</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {dayjs(unit.sealedTime).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
              )
            },
            unit.shippedAt && {
              color: 'purple',
              children: (
                <div>
                  <div style={{ fontWeight: 'bold' }}>已出库</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {dayjs(unit.shippedAt).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
              )
            },
            unit.arrivedAt && {
              color: 'green',
              children: (
                <div>
                  <div style={{ fontWeight: 'bold' }}>已到达</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {dayjs(unit.arrivedAt).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
              )
            }
          ].filter(Boolean) as any}
        />
      </Card>
    </Drawer>
  );
};
