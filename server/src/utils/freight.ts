/**
 * 运费估算公式(Demo)
 * - 首公斤 63 CNY,续公斤 57 CNY(取最接近向上取整的公斤,<=1 按 1 计)
 * - serviceType 差价:STANDARD × 0.8,ECONOMY × 0.6,其他(含 EXPRESS)× 1
 *
 * 与 App 端 order-create.tsx 的 estimatedFee 逻辑一致,挪到后端统一计算
 * 便于 Web / App / 入库后端同时复用。
 */
export function calcFreight(weightKg: number, serviceType?: string | null): number {
  const w = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 0;
  if (w <= 0) return 0;
  const base = w <= 1 ? 63 : 63 + (w - 1) * 57;
  const multiplier =
    serviceType === 'STANDARD' ? 0.8 :
    serviceType === 'ECONOMY' ? 0.6 : 1;
  return Math.round(base * multiplier * 100) / 100;
}
