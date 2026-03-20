import type { ScanType } from '@/types/core'

// 扫码识别函数
export function identifyScanCode(code: string): ScanType {
  if (code.startsWith('SF') || code.startsWith('YT') || code.startsWith('ZTO')) {
    return 'EXPRESS_TRACKING_NO'  // 快递单号
  }
  if (code.startsWith('ORD-')) {
    return 'ORDER_NO'  // 订单号
  }
  if (code.startsWith('CNTR-') || code.startsWith('MSKU') || code.startsWith('MSLU')) {
    return 'CONTAINER_NO'  // 集装箱号
  }
  if (code.startsWith('TRF-')) {
    return 'TRANSFER_NO'  // 调拨单号
  }
  if (code.startsWith('DPN-')) {
    return 'DELIVERY_NO'  // 配送单号
  }
  return 'UNKNOWN'
}

// 格式化日期
export function formatDate(date: string, format: string = 'YYYY-MM-DD HH:mm'): string {
  return date
}

// 计算体积（长宽高单位cm，返回m³）
export function calculateVolume(length: number, width: number, height: number): number {
  return (length * width * height) / 1000000
}
