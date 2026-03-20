/**
 * 数据查询工具函数
 * 用于查询关联数据
 */

import type { MasterOrder, SubOrder } from '../types/order';
import type { ShippingUnit, Job } from '../types/core';
import type { InboundRecord } from '../types/warehouse';

// ==================== 订单查询 ====================

/**
 * 根据主订单ID查询所有子订单
 */
export function getSubOrdersByMasterOrderId(
  masterOrderId: string,
  allSubOrders: SubOrder[]
): SubOrder[] {
  return allSubOrders.filter(s => s.masterOrderId === masterOrderId);
}

/**
 * 根据子订单ID查询主订单
 */
export function getMasterOrderBySubOrderId(
  subOrderId: string,
  allSubOrders: SubOrder[],
  allMasterOrders: MasterOrder[]
): MasterOrder | undefined {
  const subOrder = allSubOrders.find(s => s.id === subOrderId);
  if (!subOrder) return undefined;
  return allMasterOrders.find(m => m.id === subOrder.masterOrderId);
}

// ==================== 集装箱查询 ====================

/**
 * 根据任务号查询所有集装箱
 */
export function getShippingUnitsByJobNo(
  jobNo: string,
  allUnits: ShippingUnit[]
): ShippingUnit[] {
  return allUnits.filter(u => u.jobNo === jobNo);
}

/**
 * 根据集装箱ID查询子订单列表
 */
export function getSubOrdersByShippingUnit(
  unit: ShippingUnit,
  allSubOrders: SubOrder[]
): SubOrder[] {
  return allSubOrders.filter(s => unit.orderIds.includes(s.id));
}

/**
 * 查询可用的集装箱（已封箱且未绑定任务）
 */
export function getAvailableShippingUnits(
  allUnits: ShippingUnit[],
  transportType?: 'SEA' | 'AIR'
): ShippingUnit[] {
  return allUnits.filter(u => {
    // 状态必须是已封箱
    if (u.status !== 'SEALED') return false;
    // 未绑定任务
    if (u.jobNo) return false;
    // 运输方式匹配（如果指定）
    if (transportType && u.transportMode !== transportType) return false;
    return true;
  });
}

// ==================== 入库记录查询 ====================

/**
 * 根据子订单ID查询入库记录
 */
export function getInboundRecordsBySubOrderId(
  subOrderId: string,
  allRecords: InboundRecord[]
): InboundRecord[] {
  return allRecords.filter(r => r.subOrderId === subOrderId);
}

/**
 * 根据主订单ID查询所有入库记录
 */
export function getInboundRecordsByMasterOrderId(
  masterOrderId: string,
  allRecords: InboundRecord[]
): InboundRecord[] {
  return allRecords.filter(r => r.masterOrderId === masterOrderId);
}
