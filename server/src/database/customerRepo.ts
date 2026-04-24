import type Database from 'better-sqlite3';
import { uuid } from '../utils/idGenerator';

// 客户创建载荷（与前端新建客户表单字段对齐）
export interface CustomerCreatePayload {
  id?: string;
  customerCode?: string;
  name: string;
  customerType?: 'COMPANY_CN' | 'COMPANY_OVERSEAS' | 'INDIVIDUAL';
  country?: string;
  address?: string;
  industry?: string;
  source?: string;
  contact?: { name?: string; phone?: string; email?: string };
  // 兼容接口旧字段
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  salesId?: string | null;
  ownerUserId?: string | null;
  poolType?: 'PRIVATE' | 'PUBLIC';
  status?: 'ACTIVE' | 'DORMANT' | 'FROZEN';
  preferredTransport?: string;
  preferredPayment?: string;
  remark?: string;
  enterpriseInfo?: Record<string, any>;
  logisticsInfo?: {
    senderName?: string;
    senderPhone?: string;
    senderAddress?: string;
    senderCity?: string;
    senderCountry?: string;
    consigneeName?: string;
    consigneePhone?: string;
    consigneeAddress?: string;
    consigneeCity?: string;
    consigneeCountry?: string;
    consigneeZipCode?: string;
    preferredTransportType?: string;
    preferredRoute?: string;
    preferredServiceType?: string;
    paymentMethod?: string;
  };
  createdAt?: string;
}

// 生成 4 位助记码（字母+数字），与前端展示习惯一致
function generateShortCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  const pick = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  return `${pick(letters)}${pick(digits)}${pick(letters)}${pick(digits)}`;
}

function uniqueShortCode(db: Database.Database, preferred?: string): string {
  const check = db.prepare('SELECT 1 FROM crm_customer WHERE customer_code = ?');
  if (preferred && !check.get(preferred)) return preferred;
  for (let i = 0; i < 20; i++) {
    const code = generateShortCode();
    if (!check.get(code)) return code;
  }
  return `C${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

/**
 * 创建客户的唯一入口：POST 接口和 seed 脚本都走这里，保证数据完整。
 * 返回 { id, customerCode }。
 */
export function createCustomerRecord(
  db: Database.Database,
  payload: CustomerCreatePayload
): { id: string; customerCode: string } {
  const id = payload.id || uuid();
  const customerCode = uniqueShortCode(db, payload.customerCode);
  const contactName = payload.contact?.name ?? payload.contactName ?? null;
  const contactPhone = payload.contact?.phone ?? payload.contactPhone ?? null;
  const contactEmail = payload.contact?.email ?? payload.contactEmail ?? null;
  const ownerUserId = payload.salesId ?? payload.ownerUserId ?? null;
  const enterpriseInfoJson = payload.enterpriseInfo
    ? JSON.stringify(payload.enterpriseInfo)
    : null;
  const logi = payload.logisticsInfo;
  const preferredTransport =
    payload.preferredTransport ?? logi?.preferredTransportType ?? null;
  const preferredPayment = payload.preferredPayment ?? logi?.paymentMethod ?? null;

  const insertCustomer = db.prepare(`
    INSERT INTO crm_customer (
      id, customer_code, customer_name, customer_type,
      country, address, industry, source,
      contact_name, contact_phone, contact_email,
      owner_user_id, pool_type, status,
      preferred_transport, preferred_payment, enterprise_info, remark,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const createdAt = payload.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 19);
  // 兼容 App 端旧枚举:COMPANY_OS → COMPANY_OVERSEAS, PERSONAL → INDIVIDUAL
  const normalizeCustomerType = (t?: string): string => {
    if (!t) return 'COMPANY_CN';
    if (t === 'COMPANY_OS') return 'COMPANY_OVERSEAS';
    if (t === 'PERSONAL') return 'INDIVIDUAL';
    return t;
  };
  insertCustomer.run(
    id,
    customerCode,
    payload.name,
    normalizeCustomerType(payload.customerType || payload.enterpriseInfo?.entityType),
    payload.country ?? null,
    payload.address ?? null,
    payload.industry ?? null,
    payload.source ?? null,
    contactName,
    contactPhone,
    contactEmail,
    ownerUserId,
    payload.poolType || 'PRIVATE',
    payload.status || 'ACTIVE',
    preferredTransport,
    preferredPayment,
    enterpriseInfoJson,
    payload.remark ?? null,
    createdAt,
    createdAt
  );

  if (logi) {
    const hasSender = logi.senderName || logi.senderPhone || logi.senderAddress;
    if (hasSender) {
      db.prepare(
        `INSERT INTO crm_sender_profile
         (id, customer_id, sender_name, sender_phone, sender_address, sender_city, sender_country, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      ).run(
        uuid(),
        id,
        logi.senderName || '',
        logi.senderPhone || null,
        logi.senderAddress || null,
        logi.senderCity || null,
        logi.senderCountry || null
      );
    }
    const hasConsignee = logi.consigneeName || logi.consigneePhone || logi.consigneeAddress;
    if (hasConsignee) {
      db.prepare(
        `INSERT INTO crm_recipient_address
         (id, customer_id, recipient_name, recipient_phone, country, city, zip_code, detail_address, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
      ).run(
        uuid(),
        id,
        logi.consigneeName || '',
        logi.consigneePhone || null,
        logi.consigneeCountry || null,
        logi.consigneeCity || null,
        logi.consigneeZipCode || null,
        logi.consigneeAddress || null
      );
    }
  }

  return { id, customerCode };
}

const STATUS_TO_UI: Record<string, string> = {
  ACTIVE: '活跃',
  DORMANT: '沉睡',
  FROZEN: '冻结',
};

/**
 * 将 crm_customer 行映射为前端 Client 类型期望的形状。
 * 兼容保留原有扁平字段，避免其它调用点崩溃。
 */
export function mapCustomerRow(db: Database.Database, r: any): any {
  const orderCountRow = db
    .prepare('SELECT COUNT(*) as c FROM oms_order WHERE customer_id = ?')
    .get(r.id) as { c: number } | undefined;
  const lastOrderRow = db
    .prepare('SELECT MAX(created_at) as t FROM oms_order WHERE customer_id = ?')
    .get(r.id) as { t: string | null } | undefined;
  const totalOrders = orderCountRow?.c ?? 0;
  let enterpriseInfo: any = null;
  if (r.enterprise_info) {
    try {
      enterpriseInfo = JSON.parse(r.enterprise_info);
    } catch {
      enterpriseInfo = null;
    }
  }

  const senders = db
    .prepare(
      'SELECT * FROM crm_sender_profile WHERE customer_id = ? ORDER BY is_default DESC, created_at ASC'
    )
    .all(r.id) as any[];
  const recipients = db
    .prepare(
      'SELECT * FROM crm_recipient_address WHERE customer_id = ? ORDER BY is_default DESC, created_at ASC'
    )
    .all(r.id) as any[];

  const senderContacts = senders.map((s, i) => ({
    id: s.id || `SENDER-${i + 1}`,
    label: i === 0 ? '默认发货人' : `发货人 ${i + 1}`,
    senderName: s.sender_name,
    senderPhone: s.sender_phone,
    senderAddress: s.sender_address,
    senderCity: s.sender_city,
    senderCountry: s.sender_country,
  }));
  const receiverContacts = recipients.map((rp, i) => ({
    id: rp.id || `RECEIVER-${i + 1}`,
    label: i === 0 ? '默认收货人' : `收货人 ${i + 1}`,
    consigneeName: rp.recipient_name,
    consigneePhone: rp.recipient_phone,
    consigneeCountry: rp.country,
    consigneeCity: rp.city,
    consigneeZipCode: rp.zip_code,
    consigneeAddress: rp.detail_address,
  }));
  const firstSender = senderContacts[0];
  const firstReceiver = receiverContacts[0];
  const logisticsInfo =
    senderContacts.length || receiverContacts.length
      ? {
          senderContacts,
          receiverContacts,
          senderName: firstSender?.senderName,
          senderPhone: firstSender?.senderPhone,
          senderAddress: firstSender?.senderAddress,
          senderCity: firstSender?.senderCity,
          senderCountry: firstSender?.senderCountry,
          consigneeName: firstReceiver?.consigneeName,
          consigneePhone: firstReceiver?.consigneePhone,
          consigneeCountry: firstReceiver?.consigneeCountry,
          consigneeCity: firstReceiver?.consigneeCity,
          consigneeZipCode: firstReceiver?.consigneeZipCode,
          consigneeAddress: firstReceiver?.consigneeAddress,
          preferredTransportType: r.preferred_transport,
          paymentMethod: r.preferred_payment,
        }
      : undefined;

  return {
    // 前端 Client 形状
    id: r.id,
    shortCode: r.customer_code,
    name: r.customer_name,
    country: r.country,
    address: r.address,
    industry: r.industry,
    source: r.source,
    contact: {
      name: r.contact_name,
      phone: r.contact_phone,
      email: r.contact_email,
    },
    status: r.status, // 前端 mapClient 会再翻译成中文
    poolType: r.pool_type,
    salesId: r.owner_user_id,
    totalOrders,
    lastOrderTime: lastOrderRow?.t || undefined,
    createdAt: r.created_at,
    enterpriseInfo: enterpriseInfo || undefined,
    logisticsInfo,

    // 兼容旧字段（详情页等可能仍在读取）
    customerCode: r.customer_code,
    customerName: r.customer_name,
    customerType: r.customer_type,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    contactEmail: r.contact_email,
    ownerUserId: r.owner_user_id,
    preferredTransport: r.preferred_transport,
    preferredPayment: r.preferred_payment,
    remark: r.remark,
    orderCount: totalOrders,
  };
}
