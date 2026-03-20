/**
 * 订单相关工具函数
 * 包含状态计算、数据查询等
 */

import type { MasterOrder, SubOrder } from '../types/order';
import type { MasterOrderStatus, SubOrderStatus } from '../types/order';

// ==================== 状态计算 ====================

/**
 * 计算主订单状态（基于所有子订单状态）
 */
export function calculateMasterOrderStatus(subOrders: SubOrder[]): MasterOrderStatus {
  if (subOrders.length === 0) return 'PENDING_INBOUND';

  const statuses = subOrders.map(s => s.status);

  // 优先级1: 异常
  if (statuses.some(s => s === 'EXCEPTION')) return 'EXCEPTION';

  // 优先级2: 全部签收
  if (statuses.every(s => s === 'DELIVERED')) return 'COMPLETED';

  // 优先级3: 部分签收
  if (statuses.some(s => s === 'DELIVERED')) return 'PARTIAL_DELIVERED';

  // 优先级4: 已到达
  if (statuses.every(s => s === 'ARRIVED')) return 'ARRIVED';

  // 优先级5: 运输中
  if (statuses.some(s => ['IN_TRANSIT', 'CUSTOMS_CLEARANCE'].includes(s))) {
    return 'IN_TRANSIT';
  }

  // 优先级6: 已发运
  if (statuses.every(s => ['PENDING_DEPARTURE', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'ARRIVED', 'PENDING_DELIVERY', 'DELIVERING', 'DELIVERED'].includes(s))) {
    return 'DEPARTED';
  }

  // 优先级7: 等待发货
  if (statuses.some(s => s === 'PENDING_DEPARTURE')) return 'PENDING_DEPARTURE';

  // 优先级8: 已入库
  if (statuses.every(s => ['INBOUND', 'PENDING_PACKING', 'PACKED', 'PENDING_DEPARTURE'].includes(s))) {
    return 'INBOUND';
  }

  // 默认：等待入库
  return 'PENDING_INBOUND';
}

/**
 * 计算主订单的汇总数据
 */
export function calculateMasterOrderStats(subOrders: SubOrder[]) {
  return {
    totalPieces: subOrders.reduce((sum, s) => sum + s.pieces, 0),
    totalWeight: subOrders.reduce((sum, s) => sum + s.weight, 0),
    totalVolume: subOrders.reduce((sum, s) => sum + s.volume, 0),
  };
}

/**
 * 检查主订单是否可以拆分
 */
export function canSplitOrder(order: MasterOrder): boolean {
  // 已经拆分过的不能再拆
  if (order.splitStatus === 'PARTIAL' || order.splitStatus === 'COMPLETED') return false;

  // 状态必须是等待入库
  if (!['PENDING_INBOUND', 'INBOUND'].includes(order.status)) return false;

  // 必须有物品
  if (order.items.length === 0) return false;

  return true;
}

/**
 * 生成子订单号
 */
export function generateSubOrderNo(masterOrderNo: string, batchNo: number): string {
  return `${masterOrderNo}-${String(batchNo).padStart(2, '0')}`;
}
