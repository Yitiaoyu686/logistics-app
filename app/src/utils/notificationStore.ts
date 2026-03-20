import { useSyncExternalStore } from 'react'

export type MessageType = 'inbound' | 'packing' | 'delivery' | 'transfer' | 'alert' | 'return' | 'container' | 'system' | 'order' | 'payment' | 'task'

export interface NotificationMessage {
  id: string
  type: MessageType
  title: string
  content: string
  time: string
  read: boolean
  urgent?: boolean
  warehouse: 'CN' | 'US' | 'SALES'
}

// 起运国仓消息：围绕快递收件、入库、装箱、出库发运
const MESSAGES_CN: NotificationMessage[] = [
  { id: 'cn-1', type: 'inbound', title: '包裹到达通知', content: '订单 ORD-20260209-001 快递已到达仓库，共5件待入库', time: '10分钟前', read: false, urgent: false, warehouse: 'CN' },
  { id: 'cn-2', type: 'inbound', title: '入库异常', content: '订单 ORD-20260209-003 发现包装破损，请检查处理', time: '25分钟前', read: false, urgent: true, warehouse: 'CN' },
  { id: 'cn-3', type: 'packing', title: '装箱任务提醒', content: '集装箱 CNTR-001 装载率已达85%，后天ETD，请尽快完成装箱', time: '30分钟前', read: false, urgent: false, warehouse: 'CN' },
  { id: 'cn-4', type: 'transfer', title: '调拨到达', content: '深圳仓调拨 TRF-IN-001 已到达广州仓，8个订单待签收', time: '1小时前', read: false, urgent: false, warehouse: 'CN' },
  { id: 'cn-5', type: 'alert', title: '库存超时预警', content: '3个订单在库超过5天未装箱，请尽快安排出库', time: '1小时前', read: false, urgent: true, warehouse: 'CN' },
  { id: 'cn-6', type: 'alert', title: '集装箱超重预警', content: '集装箱 CNTR-002 已超重12%，请调整装箱方案或拆分货物', time: '2小时前', read: true, urgent: true, warehouse: 'CN' },
  { id: 'cn-7', type: 'return', title: '退运申请', content: '客户申请退运 ORD-20260208-005，原因：客户取消订单', time: '3小时前', read: true, urgent: false, warehouse: 'CN' },
  { id: 'cn-8', type: 'system', title: 'ETD出库提醒', content: '明日有2个集装箱ETD，请确认装箱完成和出库准备', time: '5小时前', read: true, urgent: false, warehouse: 'CN' },
]

// 到达国仓消息：围绕集装箱到港、清关、拆箱入仓、配送末端
const MESSAGES_US: NotificationMessage[] = [
  { id: 'us-1', type: 'container', title: '集装箱到港通知', content: '集装箱 CNTR-001 已抵达拉各斯港，预计明日完成清关', time: '15分钟前', read: false, urgent: false, warehouse: 'US' },
  { id: 'us-2', type: 'container', title: '清关完成', content: '集装箱 CNTR-003 清关手续已完成，可安排提柜入仓', time: '40分钟前', read: false, urgent: false, warehouse: 'US' },
  { id: 'us-3', type: 'inbound', title: '拆箱入仓任务', content: '集装箱 CNTR-002 已到仓库，共45件货物待拆箱分拣入仓', time: '1小时前', read: false, urgent: false, warehouse: 'US' },
  { id: 'us-4', type: 'delivery', title: '客户催单', content: '客户 John Adeyemi 催促配送订单 ORD-20260205-012，已等待3天', time: '1小时前', read: false, urgent: true, warehouse: 'US' },
  { id: 'us-5', type: 'delivery', title: '配送签收确认', content: '配送单 DPN-20260209-003 客户已签收，共3件货物', time: '2小时前', read: false, urgent: false, warehouse: 'US' },
  { id: 'us-6', type: 'alert', title: '配送超时预警', content: '5个配送单超过承诺时效，请优先安排派送', time: '2小时前', read: true, urgent: true, warehouse: 'US' },
  { id: 'us-7', type: 'alert', title: '清关延误预警', content: '集装箱 CNTR-004 清关已超3个工作日，请联系报关行跟进', time: '3小时前', read: true, urgent: true, warehouse: 'US' },
  { id: 'us-8', type: 'system', title: '集装箱ETA提醒', content: '2个集装箱预计本周到港，请提前准备仓库空间和人员', time: '6小时前', read: true, urgent: false, warehouse: 'US' },
]

// 销售消息：围绕订单、收款、运输任务
const MESSAGES_SALES: NotificationMessage[] = [
  { id: 'sales-1', type: 'order', title: '新订单确认', content: '客户 Chukwu Emeka 的订单 ORD-2026-0201 已确认入库', time: '20分钟前', read: false, urgent: false, warehouse: 'SALES' },
  { id: 'sales-2', type: 'payment', title: '收款到账', content: '订单 ORD-2026-0206 已收到全额付款 $12,000', time: '45分钟前', read: false, urgent: false, warehouse: 'SALES' },
  { id: 'sales-3', type: 'task', title: '任务发运通知', content: 'JOB-2026-002 空运航班已起飞，预计5天后到达', time: '1小时前', read: false, urgent: false, warehouse: 'SALES' },
  { id: 'sales-4', type: 'payment', title: '付款逾期提醒', content: '客户 Fatima Ibrahim 订单 ORD-2026-0204 已逾期4天，待收 $1,500', time: '2小时前', read: false, urgent: true, warehouse: 'SALES' },
  { id: 'sales-5', type: 'order', title: '订单状态更新', content: '订单 ORD-2026-0205 部分入库完成（20/35件）', time: '3小时前', read: true, urgent: false, warehouse: 'SALES' },
  { id: 'sales-6', type: 'alert', title: '客户跟进提醒', content: '客户 Grace Nwosu 已超过60天未下单，建议联系维护', time: '4小时前', read: true, urgent: false, warehouse: 'SALES' },
  { id: 'sales-7', type: 'task', title: '集装箱装载提醒', content: 'JOB-2026-001 装载率72%，ETD 2月12日，还可接单', time: '5小时前', read: true, urgent: false, warehouse: 'SALES' },
  { id: 'sales-8', type: 'system', title: '报价更新', content: '拉各斯海运标准价格已更新，请查看最新报价', time: '6小时前', read: true, urgent: false, warehouse: 'SALES' },
]

let messages = [...MESSAGES_CN, ...MESSAGES_US, ...MESSAGES_SALES]
const listeners = new Set<() => void>()

function emitChange() {
  listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getUserWarehouse(): 'CN' | 'US' | 'SALES' {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.role === 'WAREHOUSE_US') return 'US'
    if (user.role === 'SALES') return 'SALES'
    return 'CN'
  } catch {
    return 'CN'
  }
}

export function markRead(id: string) {
  messages = messages.map(m => m.id === id ? { ...m, read: true } : m)
  emitChange()
}

export function markAllRead() {
  const wh = getUserWarehouse()
  messages = messages.map(m => m.warehouse === wh ? { ...m, read: true } : m)
  emitChange()
}

export function deleteMessage(id: string) {
  messages = messages.filter(m => m.id !== id)
  emitChange()
}

export function useNotificationMessages(): NotificationMessage[] {
  const all = useSyncExternalStore(subscribe, () => messages)
  const wh = getUserWarehouse()
  return all.filter(m => m.warehouse === wh)
}

export function useUnreadCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => {
      const wh = getUserWarehouse()
      return messages.filter(m => m.warehouse === wh && !m.read).length
    }
  )
}
