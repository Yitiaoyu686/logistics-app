/**
 * 任务相关工具函数
 */

import type { Job, ShippingUnit } from '../types/core';

// ==================== 任务统计计算 ====================

/**
 * 计算任务的统计数据（从绑定的集装箱汇总）
 */
export function calculateJobStats(
  job: Job,
  allUnits: ShippingUnit[]
): Job['stats'] {
  const units = allUnits.filter(u => job.shippingUnitIds?.includes(u.id));

  if (units.length === 0) {
    return {
      containers: 0,
      orders: 0,
      pieces: 0,
      weight: 0,
      volume: 0,
    };
  }

  // 汇总所有订单ID（去重）
  const allOrderIds = new Set<string>();
  units.forEach(u => {
    u.orderIds.forEach(orderId => allOrderIds.add(orderId));
  });

  return {
    containers: units.length,
    orders: allOrderIds.size,
    pieces: units.reduce((sum, u) => sum + u.loadedPieces, 0),
    weight: units.reduce((sum, u) => sum + u.currentWeight, 0),
    volume: units.reduce((sum, u) => sum + u.currentVolume, 0),
  };
}

/**
 * 计算任务的容量信息
 */
export function calculateJobCapacity(
  job: Job,
  allUnits: ShippingUnit[]
): Job['capacity'] {
  const units = allUnits.filter(u => job.shippingUnitIds?.includes(u.id));

  if (units.length === 0) {
    return {
      weight: 0,
      volume: 0,
    };
  }

  return {
    weight: units.reduce((sum, u) => sum + u.maxWeight, 0),
    volume: units.reduce((sum, u) => sum + u.maxVolume, 0),
  };
}

/**
 * 计算装载率
 */
export function calculateLoadingRate(current: number, max: number): number {
  if (max === 0) return 0;
  return Math.round((current / max) * 100);
}

/**
 * 生成任务号
 */
export function generateJobNo(pol: string, pod: string): string {
  const timestamp = new Date().getTime().toString().slice(-8);
  return `JOB-${pol}-${pod}-${timestamp}`;
}
