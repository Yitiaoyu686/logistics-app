/**
 * 海运集装箱管理 — 复用空运装箱组件（AirCargoMgt），仅数据不同
 * 前端界面逻辑完全一致，通过 businessMode 区分空运/海运数据
 */
import React from 'react';
import { AirCargoMgt } from './AirCargoMgt';

export const ContainerMgt = ({
  warehouseId,
  businessMode = 'SEA',
}: {
  warehouseId?: string;
  businessMode?: 'ALL' | 'SEA' | 'AIR';
}) => {
  return <AirCargoMgt warehouseId={warehouseId} businessMode="SEA" />;
};
