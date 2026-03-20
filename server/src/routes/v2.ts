import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getDb } from '../database/connection';
import { getV2Db } from '../database/connectionV2';
import { success, error, paginated } from '../utils/response';

const router = Router();

type Line = 'SEA' | 'AIR';

function nowIso(): string {
  return new Date().toISOString();
}

function datePart(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function randomDigits(len: number): string {
  return `${Math.floor(Math.random() * (10 ** len))}`.padStart(len, '0');
}

function randomToken(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function createUniqueNo(db: Database.Database, table: string, column: string, prefix: string): string {
  for (let i = 0; i < 20; i++) {
    const candidate = `${prefix}-${datePart()}-${randomDigits(4)}`;
    const exists = db.prepare(`SELECT 1 FROM ${table} WHERE ${column} = ? LIMIT 1`).get(candidate);
    if (!exists) return candidate;
  }
  return `${prefix}-${datePart()}-${Date.now().toString().slice(-6)}`;
}

function createWarehouseEntryNo(db: Database.Database, orderNo: string, customerCode?: string): string {
  const c = (customerCode || 'CUST').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'CUST';
  const orderMarkRaw = String(orderNo || '').split('-').pop() || randomDigits(4);
  const orderMark = orderMarkRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-4) || randomDigits(4);
  const base = `${c}${orderMark}`;

  const existsBase = db.prepare('SELECT 1 FROM oms_order WHERE warehouse_entry_no = ? LIMIT 1').get(base);
  if (!existsBase) return base;

  const suffixDict = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < suffixDict.length; i++) {
    const candidate = `${base}${suffixDict[i]}`;
    const exists = db.prepare('SELECT 1 FROM oms_order WHERE warehouse_entry_no = ? LIMIT 1').get(candidate);
    if (!exists) return candidate;
  }

  return `${base}${Date.now().toString().slice(-2)}`;
}

function parseLine(input: unknown): Line {
  return input === 'AIR' ? 'AIR' : 'SEA';
}

function parseLineStrict(input: unknown): Line | null {
  const raw = String(input ?? '').trim().toUpperCase();
  if (raw === 'SEA' || raw === 'AIR') return raw;
  return null;
}

function nextSubOrderLine(db: Database.Database, orderId: string): number {
  const row = db.prepare('SELECT COALESCE(MAX(line_no), 0) AS maxLine FROM oms_sub_order WHERE order_id = ?')
    .get(orderId) as any;
  return Number(row?.maxLine || 0) + 1;
}

function createSubOrderNo(masterOrderNo: unknown, lineNo: unknown): string {
  const base = String(masterOrderNo || '').trim().toUpperCase();
  const seq = Number(lineNo || 0);
  if (!base) return '';
  if (!Number.isFinite(seq) || seq <= 0) return `${base}-01`;
  return `${base}-${String(seq).padStart(2, '0')}`;
}

function createOrderNo(db: Database.Database, businessLine: Line, createdAt?: string): string {
  const prefix = businessLine === 'AIR' ? 'A' : 'S';
  const date = (createdAt ? String(createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const likePattern = `${prefix}-${date}%`;
  const row = db.prepare(`
    SELECT MAX(CAST(SUBSTR(order_no, 11, 6) AS INTEGER)) AS maxSeq
    FROM oms_order
    WHERE order_no LIKE ?
  `).get(likePattern) as any;
  const nextSeq = Number(row?.maxSeq || 0) + 1;
  return `${prefix}-${date}${String(nextSeq).padStart(6, '0')}`;
}

function createJobNo(db: Database.Database, table: string, column: string, businessLine: Line, createdAt?: string): string {
  const linePrefix = businessLine === 'AIR' ? 'A' : 'S';
  const date = (createdAt ? String(createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const ym = date.slice(2, 6);
  const base = `${linePrefix}-JOB${ym}`;
  const likePattern = `${base}%`;
  const regex = new RegExp(`^${escapeRegExp(base)}(\\d{4})$`);
  const rows = db.prepare(`SELECT ${column} AS no FROM ${table} WHERE ${column} LIKE ?`).all(likePattern) as Array<{ no?: string }>;

  let maxSeq = 0;
  rows.forEach((row) => {
    const raw = String(row?.no || '');
    const match = raw.match(regex);
    if (!match) return;
    const seq = Number(match[1]);
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  });

  return `${base}${String(maxSeq + 1).padStart(4, '0')}`;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createLineScopedNo(
  db: Database.Database,
  table: string,
  column: string,
  prefix: string,
  businessLine: Line,
  createdAt?: string
): string {
  const line = parseLine(businessLine);
  const date = (createdAt ? String(createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const base = `${prefix}-${line}-${date}`;
  const likePattern = `${base}-%`;
  const regex = new RegExp(`^${escapeRegExp(base)}-(\\d+)$`);
  const rows = db.prepare(`SELECT ${column} AS no FROM ${table} WHERE ${column} LIKE ?`).all(likePattern) as Array<{ no?: string }>;

  let maxSeq = 0;
  rows.forEach((row) => {
    const raw = String(row?.no || '');
    const match = raw.match(regex);
    if (!match) return;
    const seq = Number(match[1]);
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  });

  return `${base}-${String(maxSeq + 1).padStart(4, '0')}`;
}

function calcVolumeCbm(lengthCm: number, widthCm: number, heightCm: number, fallbackVolume?: number): number {
  if (lengthCm > 0 && widthCm > 0 && heightCm > 0) {
    return (lengthCm * widthCm * heightCm) / 1000000;
  }
  return Number(fallbackVolume || 0);
}

function calcVolumeWeight(orderBusinessLine: Line, lengthCm: number, widthCm: number, heightCm: number, volumeCbm: number): number {
  if (orderBusinessLine === 'AIR') {
    if (lengthCm > 0 && widthCm > 0 && heightCm > 0) {
      return (lengthCm * widthCm * heightCm) / 6000;
    }
    return volumeCbm > 0 ? volumeCbm * 167 : 0;
  }
  return volumeCbm * 700;
}

function deriveOrderStatus(subStatuses: string[]): string {
  if (!subStatuses.length) return 'PENDING_INBOUND';
  if (subStatuses.includes('EXCEPTION')) return 'EXCEPTION';
  if (subStatuses.every((s) => s === 'DELIVERED')) return 'COMPLETED';
  if (subStatuses.includes('DELIVERED')) return 'PARTIAL_DELIVERED';
  if (subStatuses.every((s) => s === 'ARRIVED')) return 'ARRIVED';
  if (subStatuses.some((s) => ['IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'DELIVERING'].includes(s))) return 'IN_TRANSIT';
  if (subStatuses.includes('PENDING_DELIVERY')) return 'ARRIVED';
  if (subStatuses.every((s) => ['PENDING_DEPARTURE', 'INBOUND', 'PENDING_PACKING', 'PACKED'].includes(s))) {
    return subStatuses.includes('PENDING_DEPARTURE') ? 'PENDING_DEPARTURE' : 'INBOUND';
  }
  return 'PENDING_INBOUND';
}

function refreshOrderStatusByOrderId(db: Database.Database, orderId: string, at: string): void {
  const rows = db.prepare('SELECT sub_status FROM oms_sub_order WHERE order_id = ?').all(orderId) as Array<{ sub_status: string }>;
  const status = deriveOrderStatus(rows.map((r) => r.sub_status));
  db.prepare('UPDATE oms_order SET order_status = ?, order_status_updated_at = ?, updated_at = ? WHERE id = ?')
    .run(status, at, at, orderId);
}

function refreshOrderPaymentByOrderId(db: Database.Database, orderId: string, at: string): void {
  const order = db.prepare(`
    SELECT total_receivable_amount, total_paid_amount
    FROM oms_order
    WHERE id = ?
  `).get(orderId) as { total_receivable_amount: number; total_paid_amount: number } | undefined;
  if (!order) return;

  let status = 'UNPAID';
  if ((order.total_paid_amount || 0) > 0) status = 'PARTIAL';
  if ((order.total_receivable_amount || 0) > 0 && (order.total_paid_amount || 0) >= (order.total_receivable_amount || 0)) {
    status = 'PAID';
  }

  db.prepare('UPDATE oms_order SET payment_status = ?, payment_status_updated_at = ?, updated_at = ? WHERE id = ?')
    .run(status, at, at, orderId);
}

function findOrderByAnyNo(db: Database.Database, key: string): any {
  return db.prepare('SELECT * FROM oms_order WHERE id = ? OR order_no = ? OR display_order_no = ?')
    .get(key, key, key) as any;
}

function toNullableBool(v: unknown): number | null {
  if (v === true || v === 1 || v === '1') return 1;
  if (v === false || v === 0 || v === '0') return 0;
  return null;
}

const CUSTOMER_CODE_LENGTH = 4;
const CUSTOMER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CUSTOMER_CODE_REGEX = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{4}$/;

function toCleanText(value: unknown): string | null {
  const v = String(value ?? '').trim();
  return v ? v : null;
}

function toRequiredText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeCustomerStatus(value: unknown): 'ACTIVE' | 'DORMANT' | 'FROZEN' | null {
  const v = String(value ?? '').trim().toUpperCase();
  if (!v) return null;
  if (v === 'ACTIVE' || v === 'DORMANT' || v === 'FROZEN') return v;
  return null;
}

function normalizeCustomerPoolType(value: unknown): 'PRIVATE' | 'PUBLIC' | null {
  const v = String(value ?? '').trim().toUpperCase();
  if (!v) return null;
  if (v === 'PRIVATE' || v === 'PUBLIC') return v;
  return null;
}

function normalizeShortCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

function validateShortCode(value: string): boolean {
  return CUSTOMER_CODE_REGEX.test(value);
}

function randomCustomerShortCode(): string {
  let result = '';
  for (let i = 0; i < CUSTOMER_CODE_LENGTH; i++) {
    const index = Math.floor(Math.random() * CUSTOMER_CODE_ALPHABET.length);
    result += CUSTOMER_CODE_ALPHABET[index];
  }
  return result;
}

function createUniqueCustomerShortCode(db: Database.Database): string {
  for (let i = 0; i < 2000; i++) {
    const candidate = randomCustomerShortCode();
    if (!validateShortCode(candidate)) continue;
    const exists = db.prepare('SELECT 1 FROM crm_customer WHERE customer_code = ? LIMIT 1').get(candidate);
    if (!exists) return candidate;
  }
  throw new Error('客户编号生成失败，请重试');
}

function resolveOwnerUserId(db: Database.Database, maybeUserId: unknown): string | null {
  const raw = String(maybeUserId ?? '').trim();
  if (!raw) return null;
  const found = db.prepare('SELECT id FROM sys_user WHERE id = ?').get(raw) as any;
  return found?.id ? raw : null;
}

function parseContactPayload(body: any): { contactName: string; contactPhone: string; contactEmail: string | null } {
  const contact = body?.contact && typeof body.contact === 'object' ? body.contact : {};
  const contactName = toRequiredText(contact.name ?? body?.contactName);
  const contactPhone = toRequiredText(contact.phone ?? body?.contactPhone);
  const contactEmail = toCleanText(contact.email ?? body?.contactEmail);
  return { contactName, contactPhone, contactEmail };
}

function normalizeCustomerRow(row: any): any {
  return {
    id: row.id,
    shortCode: row.shortCode,
    name: row.name,
    country: row.country || '',
    address: row.address || '',
    industry: row.industry || '',
    status: row.status,
    poolType: row.poolType,
    salesId: row.salesId || null,
    salesPerson: row.salesPerson || null,
    source: row.source || null,
    remark: row.remark || null,
    companyType: row.companyType || null,
    creditLevel: row.creditLevel || null,
    totalOrders: Number(row.totalOrders || 0),
    lastOrderTime: row.lastOrderTime || null,
    enterPoolTime: row.enterPoolTime || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || row.createdAt,
    contact: {
      name: row.contactName || '',
      phone: row.contactPhone || '',
      email: row.contactEmail || undefined,
    },
  };
}

function loadCustomerCore(db: Database.Database, id: string): any | null {
  const row = db.prepare(`
    SELECT
      c.id,
      c.customer_code AS shortCode,
      c.customer_name AS name,
      c.country AS country,
      c.address AS address,
      c.industry AS industry,
      c.status AS status,
      c.pool_type AS poolType,
      c.owner_user_id AS salesId,
      su.real_name AS salesPerson,
      c.source AS source,
      c.remark AS remark,
      c.company_type AS companyType,
      c.credit_level AS creditLevel,
      c.contact_name AS contactName,
      c.contact_phone AS contactPhone,
      c.contact_email AS contactEmail,
      c.enter_pool_time AS enterPoolTime,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      (
        SELECT COUNT(*)
        FROM oms_order o
        WHERE o.customer_id = c.id
      ) AS totalOrders,
      (
        SELECT MAX(o.created_at)
        FROM oms_order o
        WHERE o.customer_id = c.id
      ) AS lastOrderTime
    FROM crm_customer c
    LEFT JOIN sys_user su ON su.id = c.owner_user_id
    WHERE c.id = ?
  `).get(id) as any;
  return row || null;
}

function resolveCountryIdByText(db: Database.Database, text: unknown): string | null {
  const value = String(text ?? '').trim();
  if (!value) return null;

  const byId = db.prepare('SELECT id FROM md_country WHERE id = ?').get(value) as any;
  if (byId?.id) return byId.id;

  const byCode = db.prepare('SELECT id FROM md_country WHERE UPPER(code) = ?').get(value.toUpperCase()) as any;
  if (byCode?.id) return byCode.id;

  const byName = db.prepare('SELECT id FROM md_country WHERE name_cn = ? OR name_en = ? LIMIT 1').get(value, value) as any;
  return byName?.id || null;
}

function resolveCityIdByText(db: Database.Database, countryId: string | null, text: unknown): string | null {
  const value = String(text ?? '').trim();
  if (!value) return null;

  const byId = db.prepare('SELECT id FROM md_city WHERE id = ?').get(value) as any;
  if (byId?.id) return byId.id;

  const byCode = db.prepare('SELECT id FROM md_city WHERE UPPER(code) = ?').get(value.toUpperCase()) as any;
  if (byCode?.id) return byCode.id;

  if (countryId) {
    const byNameInCountry = db.prepare(`
      SELECT id
      FROM md_city
      WHERE country_id = ? AND (name_cn = ? OR name_en = ?)
      LIMIT 1
    `).get(countryId, value, value) as any;
    if (byNameInCountry?.id) return byNameInCountry.id;
  }

  const byName = db.prepare('SELECT id FROM md_city WHERE name_cn = ? OR name_en = ? LIMIT 1').get(value, value) as any;
  return byName?.id || null;
}

function extractSenderContacts(logisticsInfo: any): Array<any> {
  if (!logisticsInfo || typeof logisticsInfo !== 'object') return [];
  if (Array.isArray(logisticsInfo.senderContacts)) return logisticsInfo.senderContacts;

  const hasLegacy = [
    logisticsInfo.senderName,
    logisticsInfo.senderPhone,
    logisticsInfo.senderAddress,
    logisticsInfo.senderCountry,
    logisticsInfo.senderCity,
  ].some((v) => String(v ?? '').trim());

  if (!hasLegacy) return [];
  return [{
    id: logisticsInfo.senderId || undefined,
    label: logisticsInfo.senderLabel || '默认发货人',
    senderName: logisticsInfo.senderName,
    senderPhone: logisticsInfo.senderPhone,
    senderAddress: logisticsInfo.senderAddress,
    senderCountry: logisticsInfo.senderCountry,
    senderCity: logisticsInfo.senderCity,
  }];
}

function extractReceiverContacts(logisticsInfo: any): Array<any> {
  if (!logisticsInfo || typeof logisticsInfo !== 'object') return [];
  if (Array.isArray(logisticsInfo.receiverContacts)) return logisticsInfo.receiverContacts;

  const hasLegacy = [
    logisticsInfo.consigneeName,
    logisticsInfo.consigneePhone,
    logisticsInfo.consigneeAddress,
    logisticsInfo.consigneeCountry,
    logisticsInfo.consigneeCity,
    logisticsInfo.consigneeEmail,
  ].some((v) => String(v ?? '').trim());

  if (!hasLegacy) return [];
  return [{
    id: logisticsInfo.recipientId || undefined,
    label: logisticsInfo.recipientLabel || '默认收货人',
    consigneeName: logisticsInfo.consigneeName,
    consigneePhone: logisticsInfo.consigneePhone,
    consigneeAddress: logisticsInfo.consigneeAddress,
    consigneeCountry: logisticsInfo.consigneeCountry,
    consigneeCity: logisticsInfo.consigneeCity,
    consigneeEmail: logisticsInfo.consigneeEmail,
    consigneeZipCode: logisticsInfo.consigneeZipCode,
  }];
}

function syncCustomerSenders(db: Database.Database, customerId: string, logisticsInfo: any, at: string): void {
  const hasSenderIntent = logisticsInfo
    && typeof logisticsInfo === 'object'
    && (
      Object.prototype.hasOwnProperty.call(logisticsInfo, 'senderContacts')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'senderName')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'senderPhone')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'senderAddress')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'senderCountry')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'senderCity')
    );
  if (!hasSenderIntent) return;

  const senders = extractSenderContacts(logisticsInfo);
  db.prepare('DELETE FROM crm_sender_profile WHERE customer_id = ?').run(customerId);
  if (!senders.length) return;

  const insertSender = db.prepare(`
    INSERT INTO crm_sender_profile (
      id, customer_id, sender_name, sender_phone, sender_address, sender_district,
      sender_city_id, sender_country_id, is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  senders.forEach((entry: any, idx: number) => {
    const countryId = resolveCountryIdByText(db, entry?.senderCountry);
    const cityId = resolveCityIdByText(db, countryId, entry?.senderCity);
    insertSender.run(
      String(entry?.id || randomToken('SENDER')),
      customerId,
      toRequiredText(entry?.senderName) || `发货人${idx + 1}`,
      toCleanText(entry?.senderPhone),
      toCleanText(entry?.senderAddress),
      toCleanText(entry?.senderDistrict),
      cityId,
      countryId,
      idx === 0 ? 1 : 0,
      at,
      at
    );
  });
}

function syncCustomerRecipients(db: Database.Database, customerId: string, logisticsInfo: any, at: string): void {
  const hasRecipientIntent = logisticsInfo
    && typeof logisticsInfo === 'object'
    && (
      Object.prototype.hasOwnProperty.call(logisticsInfo, 'receiverContacts')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'consigneeName')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'consigneePhone')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'consigneeAddress')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'consigneeCountry')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'consigneeCity')
      || Object.prototype.hasOwnProperty.call(logisticsInfo, 'consigneeEmail')
    );
  if (!hasRecipientIntent) return;

  const recipients = extractReceiverContacts(logisticsInfo);
  db.prepare('DELETE FROM uc_recipient_address WHERE customer_id = ?').run(customerId);
  if (!recipients.length) return;

  const insertRecipient = db.prepare(`
    INSERT INTO uc_recipient_address (
      id, customer_id, recipient_name, recipient_phone, recipient_email,
      country_id, city_id, district, detail_address, is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  recipients.forEach((entry: any, idx: number) => {
    const countryId = resolveCountryIdByText(db, entry?.consigneeCountry);
    const cityId = resolveCityIdByText(db, countryId, entry?.consigneeCity);
    if (!countryId || !cityId) {
      throw new Error(`收货人[${toRequiredText(entry?.consigneeName) || `#${idx + 1}`}]国家/城市无效，请先在基础设置维护国家城市`);
    }

    insertRecipient.run(
      String(entry?.id || randomToken('REC')),
      customerId,
      toRequiredText(entry?.consigneeName) || `收货人${idx + 1}`,
      toRequiredText(entry?.consigneePhone) || '-',
      toCleanText(entry?.consigneeEmail),
      countryId,
      cityId,
      toCleanText(entry?.district),
      toRequiredText(entry?.consigneeAddress) || '-',
      idx === 0 ? 1 : 0,
      at,
      at
    );
  });
}

function insertCustomerPoolLog(db: Database.Database, payload: {
  customerId: string;
  action: 'CLAIM' | 'RELEASE' | 'TRANSFER' | 'AUTO_RELEASE';
  fromPoolType?: 'PRIVATE' | 'PUBLIC' | null;
  toPoolType?: 'PRIVATE' | 'PUBLIC' | null;
  fromOwnerUserId?: string | null;
  toOwnerUserId?: string | null;
  operatorId?: string | null;
  operatorName?: string | null;
  reason?: string | null;
  createdAt: string;
}) {
  db.prepare(`
    INSERT INTO crm_customer_pool_log (
      id, customer_id, action, from_pool_type, to_pool_type,
      from_owner_user_id, to_owner_user_id, operator_id, operator_name, reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomToken('CPL'),
    payload.customerId,
    payload.action,
    payload.fromPoolType || null,
    payload.toPoolType || null,
    payload.fromOwnerUserId || null,
    payload.toOwnerUserId || null,
    payload.operatorId || null,
    payload.operatorName || null,
    payload.reason || null,
    payload.createdAt
  );
}

function loadCustomerSenderProfiles(db: Database.Database, customerId: string): any[] {
  return db.prepare(`
    SELECT
      s.id,
      s.sender_name AS senderName,
      s.sender_phone AS senderPhone,
      s.sender_address AS senderAddress,
      s.sender_district AS senderDistrict,
      s.sender_city_id AS senderCityId,
      s.sender_country_id AS senderCountryId,
      city.name_cn AS senderCity,
      country.name_cn AS senderCountry,
      s.is_default AS isDefault
    FROM crm_sender_profile s
    LEFT JOIN md_city city ON city.id = s.sender_city_id
    LEFT JOIN md_country country ON country.id = s.sender_country_id
    WHERE s.customer_id = ?
    ORDER BY s.is_default DESC, s.created_at DESC
  `).all(customerId) as any[];
}

function loadCustomerRecipientAddresses(db: Database.Database, customerId: string): any[] {
  return db.prepare(`
    SELECT
      r.id,
      r.recipient_name AS consigneeName,
      r.recipient_phone AS consigneePhone,
      r.recipient_email AS consigneeEmail,
      r.detail_address AS consigneeAddress,
      r.district AS district,
      r.country_id AS countryId,
      r.city_id AS cityId,
      ctry.name_cn AS destCountry,
      cty.name_cn AS destCity,
      r.is_default AS isDefault
    FROM uc_recipient_address r
    LEFT JOIN md_city cty ON cty.id = r.city_id
    LEFT JOIN md_country ctry ON ctry.id = r.country_id
    WHERE r.customer_id = ?
    ORDER BY r.is_default DESC, r.created_at DESC
  `).all(customerId) as any[];
}

function loadCustomerLineProfiles(db: Database.Database, customerId: string): any[] {
  return db.prepare(`
    SELECT
      p.id,
      p.customer_id AS customerId,
      p.business_line AS businessLine,
      p.preferred_route_code AS preferredRouteCode,
      p.preferred_service_type_code AS preferredServiceTypeCode,
      st.name AS preferredServiceTypeName,
      p.preferred_payment_method AS preferredPaymentMethod,
      p.preferred_payment_channel AS preferredPaymentChannel,
      p.default_sender_profile_id AS defaultSenderProfileId,
      p.default_recipient_address_id AS defaultRecipientAddressId,
      p.price_level AS priceLevel,
      p.risk_flag AS riskFlag,
      p.remark,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt
    FROM crm_customer_line_profile p
    LEFT JOIN md_service_type st ON st.code = p.preferred_service_type_code
    WHERE p.customer_id = ?
    ORDER BY p.business_line
  `).all(customerId) as any[];
}

function listAssignableSalesUsers(db: Database.Database): any[] {
  return db.prepare(`
    SELECT
      id,
      username,
      real_name AS realName,
      role_code AS roleCode,
      status
    FROM sys_user
    WHERE status = 'ACTIVE' AND role_code IN ('SALES', 'ADMIN', 'BOSS')
    ORDER BY role_code, real_name, username
  `).all() as any[];
}

// ======================================================
// Bootstrap check
// ======================================================

router.get('/health', (_req, res) => {
  const db = getV2Db();
  const counts = {
    customers: (db.prepare('SELECT COUNT(*) as c FROM crm_customer').get() as any).c,
    orders: (db.prepare('SELECT COUNT(*) as c FROM oms_order').get() as any).c,
    subOrders: (db.prepare('SELECT COUNT(*) as c FROM oms_sub_order').get() as any).c,
    jobs: (db.prepare('SELECT COUNT(*) as c FROM tms_job').get() as any).c,
    fees: (db.prepare('SELECT COUNT(*) as c FROM fin_fee').get() as any).c,
  };
  success(res, counts, 'v2 ok');
});

// ======================================================
// OMS
// ======================================================

router.get('/oms/users/sales', (_req, res) => {
  const db = getV2Db();
  success(res, listAssignableSalesUsers(db));
});

router.get('/oms/customers', (req, res) => {
  const db = getV2Db();
  const keyword = String(req.query.keyword || '').trim();
  const poolType = normalizeCustomerPoolType(req.query.poolType);
  const status = normalizeCustomerStatus(req.query.status);
  const salesId = String(req.query.salesId || '').trim();

  if (req.query.poolType && !poolType) {
    error(res, 'poolType 参数不合法，仅支持 PRIVATE/PUBLIC');
    return;
  }
  if (req.query.status && !status) {
    error(res, 'status 参数不合法，仅支持 ACTIVE/DORMANT/FROZEN');
    return;
  }

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (keyword) {
    where += ' AND (c.customer_code LIKE ? OR c.customer_name LIKE ? OR c.contact_name LIKE ? OR c.contact_phone LIKE ?)';
    const q = `%${keyword}%`;
    params.push(q, q, q, q);
  }
  if (poolType) {
    where += ' AND c.pool_type = ?';
    params.push(poolType);
  }
  if (status) {
    where += ' AND c.status = ?';
    params.push(status);
  }
  if (salesId) {
    where += ' AND c.owner_user_id = ?';
    params.push(salesId);
  }

  const rows = db.prepare(`
    SELECT
      c.id,
      c.customer_code AS shortCode,
      c.customer_name AS name,
      c.country AS country,
      c.address AS address,
      c.industry AS industry,
      c.status AS status,
      c.pool_type AS poolType,
      c.owner_user_id AS salesId,
      su.real_name AS salesPerson,
      c.source AS source,
      c.remark AS remark,
      c.company_type AS companyType,
      c.credit_level AS creditLevel,
      c.contact_name AS contactName,
      c.contact_phone AS contactPhone,
      c.contact_email AS contactEmail,
      c.enter_pool_time AS enterPoolTime,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      (
        SELECT COUNT(*)
        FROM oms_order o
        WHERE o.customer_id = c.id
      ) AS totalOrders,
      (
        SELECT MAX(o.created_at)
        FROM oms_order o
        WHERE o.customer_id = c.id
      ) AS lastOrderTime
    FROM crm_customer c
    LEFT JOIN sys_user su ON su.id = c.owner_user_id
    ${where}
    ORDER BY c.created_at DESC
  `).all(...params) as any[];

  const data = rows.map((row) => {
    const normalized = normalizeCustomerRow(row);
    const senderProfiles = loadCustomerSenderProfiles(db, row.id);
    const recipientAddresses = loadCustomerRecipientAddresses(db, row.id);
    const lineProfiles = loadCustomerLineProfiles(db, row.id);
    const defaultSender = senderProfiles[0] || null;
    const defaultRecipient = recipientAddresses[0] || null;
    return {
      ...normalized,
      lineProfiles,
      logisticsInfo: {
        senderName: defaultSender?.senderName || '',
        senderPhone: defaultSender?.senderPhone || '',
        senderAddress: defaultSender?.senderAddress || '',
        senderCity: defaultSender?.senderCity || '',
        senderCountry: defaultSender?.senderCountry || '',
        consigneeName: defaultRecipient?.consigneeName || '',
        consigneePhone: defaultRecipient?.consigneePhone || '',
        consigneeEmail: defaultRecipient?.consigneeEmail || '',
        consigneeAddress: defaultRecipient?.consigneeAddress || '',
        consigneeCity: defaultRecipient?.destCity || '',
        consigneeCountry: defaultRecipient?.destCountry || '',
        senderContacts: senderProfiles.map((item: any) => ({
          id: item.id,
          label: item.isDefault ? '默认发货人' : undefined,
          senderName: item.senderName,
          senderPhone: item.senderPhone,
          senderAddress: item.senderAddress,
          senderCity: item.senderCity,
          senderCountry: item.senderCountry,
        })),
        receiverContacts: recipientAddresses.map((item: any) => ({
          id: item.id,
          label: item.isDefault ? '默认收货人' : undefined,
          consigneeName: item.consigneeName,
          consigneePhone: item.consigneePhone,
          consigneeEmail: item.consigneeEmail,
          consigneeAddress: item.consigneeAddress,
          consigneeCity: item.destCity,
          consigneeCountry: item.destCountry,
        })),
      },
    };
  });

  success(res, data);
});

router.get('/oms/customers/:id', (req, res) => {
  const db = getV2Db();
  const row = loadCustomerCore(db, req.params.id);
  if (!row) {
    error(res, 'customer not found', 404);
    return;
  }

  const senderProfiles = loadCustomerSenderProfiles(db, row.id);
  const recipientAddresses = loadCustomerRecipientAddresses(db, row.id);
  const lineProfiles = loadCustomerLineProfiles(db, row.id);
  const defaultSender = senderProfiles[0] || null;
  const defaultRecipient = recipientAddresses[0] || null;

  success(res, {
    ...normalizeCustomerRow(row),
    lineProfiles,
    senderProfiles,
    recipientAddresses,
    logisticsInfo: {
      senderName: defaultSender?.senderName || '',
      senderPhone: defaultSender?.senderPhone || '',
      senderAddress: defaultSender?.senderAddress || '',
      senderCity: defaultSender?.senderCity || '',
      senderCountry: defaultSender?.senderCountry || '',
      consigneeName: defaultRecipient?.consigneeName || '',
      consigneePhone: defaultRecipient?.consigneePhone || '',
      consigneeEmail: defaultRecipient?.consigneeEmail || '',
      consigneeAddress: defaultRecipient?.consigneeAddress || '',
      consigneeCity: defaultRecipient?.destCity || '',
      consigneeCountry: defaultRecipient?.destCountry || '',
      senderContacts: senderProfiles.map((item: any) => ({
        id: item.id,
        label: item.isDefault ? '默认发货人' : undefined,
        senderName: item.senderName,
        senderPhone: item.senderPhone,
        senderAddress: item.senderAddress,
        senderCity: item.senderCity,
        senderCountry: item.senderCountry,
      })),
      receiverContacts: recipientAddresses.map((item: any) => ({
        id: item.id,
        label: item.isDefault ? '默认收货人' : undefined,
        consigneeName: item.consigneeName,
        consigneePhone: item.consigneePhone,
        consigneeEmail: item.consigneeEmail,
        consigneeAddress: item.consigneeAddress,
        consigneeCity: item.destCity,
        consigneeCountry: item.destCountry,
      })),
    },
    defaultSenderProfileId: defaultSender?.id || null,
    defaultRecipientAddressId: defaultRecipient?.id || null,
  });
});

router.post('/oms/customers', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const name = toRequiredText(body.name);
  const country = toRequiredText(body.country);
  const { contactName, contactPhone, contactEmail } = parseContactPayload(body);

  if (!name || !country || !contactName || !contactPhone) {
    error(res, '缺少必填字段：name、country、contact.name、contact.phone');
    return;
  }

  const status = normalizeCustomerStatus(body.status) || 'ACTIVE';
  const poolType = normalizeCustomerPoolType(body.poolType) || 'PUBLIC';
  if (body.status && !normalizeCustomerStatus(body.status)) {
    error(res, 'status 参数不合法，仅支持 ACTIVE/DORMANT/FROZEN');
    return;
  }
  if (body.poolType && !normalizeCustomerPoolType(body.poolType)) {
    error(res, 'poolType 参数不合法，仅支持 PRIVATE/PUBLIC');
    return;
  }

  const providedShortCode = normalizeShortCode(body.shortCode);
  let shortCode = providedShortCode;
  if (shortCode) {
    if (!validateShortCode(shortCode)) {
      error(res, '客户编号格式不合法，仅支持4位字母+数字组合（如 A1B2）');
      return;
    }
    const dup = db.prepare('SELECT id FROM crm_customer WHERE customer_code = ?').get(shortCode) as any;
    if (dup?.id) {
      error(res, `客户编号 ${shortCode} 已存在，请更换`);
      return;
    }
  } else {
    shortCode = createUniqueCustomerShortCode(db);
  }

  const ownerUserId = resolveOwnerUserId(db, body.salesId);
  if (poolType === 'PRIVATE' && !ownerUserId) {
    error(res, '私海客户必须绑定有效业务员 salesId');
    return;
  }
  if (poolType === 'PUBLIC' && ownerUserId) {
    error(res, '公海客户不允许直接绑定业务员，请通过认领流程分配');
    return;
  }
  const customerId = randomToken('CUST');
  const enterPoolTime = poolType === 'PUBLIC' ? now : null;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO crm_customer (
        id, customer_code, customer_name, customer_type, owner_user_id,
        source, pool_type, status, country, address, industry,
        contact_name, contact_phone, contact_email, company_type, credit_level, remark, enter_pool_time,
        created_at, updated_at
      )
      VALUES (
        ?, ?, ?, 'COMPANY', ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `).run(
      customerId,
      shortCode,
      name,
      ownerUserId,
      toCleanText(body.source),
      poolType,
      status,
      country,
      toCleanText(body.address),
      toCleanText(body.industry),
      contactName,
      contactPhone,
      contactEmail,
      toCleanText(body.companyType),
      toCleanText(body.creditLevel),
      toCleanText(body.remark),
      enterPoolTime,
      now,
      now
    );

    if (body.logisticsInfo && typeof body.logisticsInfo === 'object') {
      syncCustomerSenders(db, customerId, body.logisticsInfo, now);
      syncCustomerRecipients(db, customerId, body.logisticsInfo, now);
    }
  });

  try {
    tx();
  } catch (err: any) {
    error(res, String(err?.message || '客户创建失败'));
    return;
  }

  const created = loadCustomerCore(db, customerId);
  success(res, normalizeCustomerRow(created));
});

router.put('/oms/customers/:id', (req, res) => {
  const db = getV2Db();
  const body = req.body || {};
  const now = nowIso();
  const current = db.prepare('SELECT * FROM crm_customer WHERE id = ?').get(req.params.id) as any;
  if (!current) {
    error(res, 'customer not found', 404);
    return;
  }

  if ('poolType' in body || 'salesId' in body) {
    error(res, 'poolType/salesId 变更请使用认领、释放接口');
    return;
  }

  const sets: string[] = [];
  const params: any[] = [];

  const setField = (column: string, value: any) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };

  if (Object.prototype.hasOwnProperty.call(body, 'shortCode')) {
    const shortCode = normalizeShortCode(body.shortCode);
    if (!shortCode) {
      error(res, '客户编号不能为空');
      return;
    }
    if (!validateShortCode(shortCode)) {
      error(res, '客户编号格式不合法，仅支持4位字母+数字组合（如 A1B2）');
      return;
    }
    const dup = db.prepare('SELECT id FROM crm_customer WHERE customer_code = ? AND id != ?').get(shortCode, req.params.id) as any;
    if (dup?.id) {
      error(res, `客户编号 ${shortCode} 已存在，请更换`);
      return;
    }
    setField('customer_code', shortCode);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = toRequiredText(body.name);
    if (!name) {
      error(res, 'name 不能为空');
      return;
    }
    setField('customer_name', name);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'country')) {
    const country = toRequiredText(body.country);
    if (!country) {
      error(res, 'country 不能为空');
      return;
    }
    setField('country', country);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'address')) setField('address', toCleanText(body.address));
  if (Object.prototype.hasOwnProperty.call(body, 'industry')) setField('industry', toCleanText(body.industry));
  if (Object.prototype.hasOwnProperty.call(body, 'source')) setField('source', toCleanText(body.source));
  if (Object.prototype.hasOwnProperty.call(body, 'remark')) setField('remark', toCleanText(body.remark));
  if (Object.prototype.hasOwnProperty.call(body, 'companyType')) setField('company_type', toCleanText(body.companyType));
  if (Object.prototype.hasOwnProperty.call(body, 'creditLevel')) setField('credit_level', toCleanText(body.creditLevel));

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = normalizeCustomerStatus(body.status);
    if (!status) {
      error(res, 'status 参数不合法，仅支持 ACTIVE/DORMANT/FROZEN');
      return;
    }
    setField('status', status);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'contact')) {
    const { contactName, contactPhone, contactEmail } = parseContactPayload(body);
    if (!contactName || !contactPhone) {
      error(res, 'contact.name 与 contact.phone 为必填');
      return;
    }
    setField('contact_name', contactName);
    setField('contact_phone', contactPhone);
    setField('contact_email', contactEmail);
  }

  const tx = db.transaction(() => {
    if (sets.length > 0) {
      setField('updated_at', now);
      params.push(req.params.id);
      db.prepare(`UPDATE crm_customer SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    }

    if (body.logisticsInfo && typeof body.logisticsInfo === 'object') {
      syncCustomerSenders(db, req.params.id, body.logisticsInfo, now);
      syncCustomerRecipients(db, req.params.id, body.logisticsInfo, now);
      db.prepare('UPDATE crm_customer SET updated_at = ? WHERE id = ?').run(now, req.params.id);
    }
  });

  try {
    tx();
  } catch (err: any) {
    error(res, String(err?.message || '客户更新失败'));
    return;
  }

  const updated = loadCustomerCore(db, req.params.id);
  success(res, normalizeCustomerRow(updated));
});

router.delete('/oms/customers/:id', (req, res) => {
  const db = getV2Db();
  const current = db.prepare('SELECT id FROM crm_customer WHERE id = ?').get(req.params.id) as any;
  if (!current?.id) {
    error(res, 'customer not found', 404);
    return;
  }

  const orderCount = (db.prepare('SELECT COUNT(*) as c FROM oms_order WHERE customer_id = ?').get(req.params.id) as any)?.c || 0;
  if (orderCount > 0) {
    error(res, `该客户已有 ${orderCount} 条订单，不能删除。请改为冻结状态。`);
    return;
  }

  db.prepare('DELETE FROM crm_customer WHERE id = ?').run(req.params.id);
  success(res, null, 'customer deleted');
});

router.post('/oms/customers/:id/claim', (req, res) => {
  const db = getV2Db();
  const body = req.body || {};
  const now = nowIso();
  const customer = db.prepare('SELECT * FROM crm_customer WHERE id = ?').get(req.params.id) as any;
  if (!customer) {
    error(res, 'customer not found', 404);
    return;
  }
  if (customer.pool_type !== 'PUBLIC') {
    error(res, 'customer is not in public pool');
    return;
  }

  const ownerUserId = resolveOwnerUserId(db, body.salesId);
  if (!ownerUserId) {
    error(res, 'salesId 无效，认领失败');
    return;
  }
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE crm_customer
      SET pool_type = 'PRIVATE', owner_user_id = ?, enter_pool_time = NULL, updated_at = ?
      WHERE id = ?
    `).run(ownerUserId, now, req.params.id);

    insertCustomerPoolLog(db, {
      customerId: req.params.id,
      action: 'CLAIM',
      fromPoolType: 'PUBLIC',
      toPoolType: 'PRIVATE',
      fromOwnerUserId: customer.owner_user_id || null,
      toOwnerUserId: ownerUserId,
      operatorId: toCleanText(body.operatorId) || ownerUserId,
      operatorName: toCleanText(body.operatorName),
      reason: null,
      createdAt: now,
    });
  });

  tx();
  const updated = loadCustomerCore(db, req.params.id);
  success(res, normalizeCustomerRow(updated));
});

router.post('/oms/customers/:id/transfer', (req, res) => {
  const db = getV2Db();
  const body = req.body || {};
  const now = nowIso();
  const customer = db.prepare('SELECT * FROM crm_customer WHERE id = ?').get(req.params.id) as any;
  if (!customer) {
    error(res, 'customer not found', 404);
    return;
  }
  if (customer.pool_type !== 'PRIVATE') {
    error(res, '只有私海客户支持转移跟进');
    return;
  }

  const toSalesId = resolveOwnerUserId(db, body.toSalesId);
  if (!toSalesId) {
    error(res, 'toSalesId 无效');
    return;
  }
  if (toSalesId === customer.owner_user_id) {
    error(res, '目标同事与当前跟进人一致，无需转移');
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE crm_customer
      SET owner_user_id = ?, pool_type = 'PRIVATE', updated_at = ?
      WHERE id = ?
    `).run(toSalesId, now, req.params.id);

    insertCustomerPoolLog(db, {
      customerId: req.params.id,
      action: 'TRANSFER',
      fromPoolType: 'PRIVATE',
      toPoolType: 'PRIVATE',
      fromOwnerUserId: customer.owner_user_id || null,
      toOwnerUserId: toSalesId,
      operatorId: toCleanText(body.operatorId),
      operatorName: toCleanText(body.operatorName),
      reason: toCleanText(body.reason),
      createdAt: now,
    });
  });

  tx();
  const updated = loadCustomerCore(db, req.params.id);
  success(res, normalizeCustomerRow(updated));
});

router.post('/oms/customers/:id/release', (req, res) => {
  const db = getV2Db();
  const body = req.body || {};
  const now = nowIso();
  const customer = db.prepare('SELECT * FROM crm_customer WHERE id = ?').get(req.params.id) as any;
  if (!customer) {
    error(res, 'customer not found', 404);
    return;
  }
  if (customer.pool_type !== 'PRIVATE') {
    error(res, 'customer is not in private pool');
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE crm_customer
      SET pool_type = 'PUBLIC', owner_user_id = NULL, enter_pool_time = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, req.params.id);

    insertCustomerPoolLog(db, {
      customerId: req.params.id,
      action: 'RELEASE',
      fromPoolType: 'PRIVATE',
      toPoolType: 'PUBLIC',
      fromOwnerUserId: customer.owner_user_id || null,
      toOwnerUserId: null,
      operatorId: toCleanText(body.operatorId) || customer.owner_user_id || null,
      operatorName: toCleanText(body.operatorName),
      reason: toCleanText(body.reason),
      createdAt: now,
    });
  });

  tx();
  const updated = loadCustomerCore(db, req.params.id);
  success(res, normalizeCustomerRow(updated));
});

router.get('/oms/customers/:id/pool-logs', (req, res) => {
  const db = getV2Db();
  const customer = db.prepare('SELECT id FROM crm_customer WHERE id = ?').get(req.params.id) as any;
  if (!customer?.id) {
    error(res, 'customer not found', 404);
    return;
  }

  const rows = db.prepare(`
    SELECT
      id,
      action,
      from_pool_type AS fromPoolType,
      to_pool_type AS toPoolType,
      from_owner_user_id AS fromSalesId,
      to_owner_user_id AS toSalesId,
      operator_id AS operatorId,
      operator_name AS operatorName,
      reason,
      created_at AS createdAt
    FROM crm_customer_pool_log
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id);
  success(res, rows);
});

router.get('/oms/customers/:id/line-profiles', (req, res) => {
  const db = getV2Db();
  const customer = db.prepare('SELECT id FROM crm_customer WHERE id = ?').get(req.params.id) as any;
  if (!customer?.id) {
    error(res, 'customer not found', 404);
    return;
  }
  const businessLine = parseLineStrict(req.query.businessLine);
  if (req.query.businessLine && !businessLine) {
    error(res, 'businessLine 参数不合法，仅支持 SEA/AIR');
    return;
  }

  if (businessLine) {
    const row = db.prepare(`
      SELECT
        p.id,
        p.customer_id AS customerId,
        p.business_line AS businessLine,
        p.preferred_route_code AS preferredRouteCode,
        p.preferred_service_type_code AS preferredServiceTypeCode,
        st.name AS preferredServiceTypeName,
        p.preferred_payment_method AS preferredPaymentMethod,
        p.preferred_payment_channel AS preferredPaymentChannel,
        p.default_sender_profile_id AS defaultSenderProfileId,
        p.default_recipient_address_id AS defaultRecipientAddressId,
        p.price_level AS priceLevel,
        p.risk_flag AS riskFlag,
        p.remark,
        p.created_at AS createdAt,
        p.updated_at AS updatedAt
      FROM crm_customer_line_profile p
      LEFT JOIN md_service_type st ON st.code = p.preferred_service_type_code
      WHERE p.customer_id = ? AND p.business_line = ?
      LIMIT 1
    `).get(req.params.id, businessLine) as any;
    success(res, row || null);
    return;
  }

  success(res, loadCustomerLineProfiles(db, req.params.id));
});

router.put('/oms/customers/:id/line-profiles/:businessLine', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const customer = db.prepare('SELECT id FROM crm_customer WHERE id = ?').get(req.params.id) as any;
  if (!customer?.id) {
    error(res, 'customer not found', 404);
    return;
  }

  const businessLine = parseLineStrict(req.params.businessLine);
  if (!businessLine) {
    error(res, 'businessLine 参数不合法，仅支持 SEA/AIR');
    return;
  }

  const body = req.body || {};
  const serviceTypeCode = toCleanText(body.preferredServiceTypeCode);
  if (serviceTypeCode) {
    const service = db.prepare('SELECT code, business_line FROM md_service_type WHERE code = ?').get(serviceTypeCode) as any;
    if (!service?.code) {
      error(res, 'preferredServiceTypeCode 不存在');
      return;
    }
    if (service.business_line !== businessLine) {
      error(res, `服务类型 ${serviceTypeCode} 与业务线 ${businessLine} 不匹配`);
      return;
    }
  }

  const senderProfileId = toCleanText(body.defaultSenderProfileId);
  if (senderProfileId) {
    const sender = db.prepare('SELECT id FROM crm_sender_profile WHERE id = ? AND customer_id = ?').get(senderProfileId, req.params.id) as any;
    if (!sender?.id) {
      error(res, 'defaultSenderProfileId 无效');
      return;
    }
  }

  const recipientAddressId = toCleanText(body.defaultRecipientAddressId);
  if (recipientAddressId) {
    const recipient = db.prepare('SELECT id FROM uc_recipient_address WHERE id = ? AND customer_id = ?').get(recipientAddressId, req.params.id) as any;
    if (!recipient?.id) {
      error(res, 'defaultRecipientAddressId 无效');
      return;
    }
  }

  const existing = db.prepare('SELECT id FROM crm_customer_line_profile WHERE customer_id = ? AND business_line = ?')
    .get(req.params.id, businessLine) as any;

  const profileId = existing?.id || randomToken('CLP');
  if (existing?.id) {
    db.prepare(`
      UPDATE crm_customer_line_profile
      SET preferred_route_code = ?,
          preferred_service_type_code = ?,
          preferred_payment_method = ?,
          preferred_payment_channel = ?,
          default_sender_profile_id = ?,
          default_recipient_address_id = ?,
          price_level = ?,
          risk_flag = ?,
          remark = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      toCleanText(body.preferredRouteCode),
      serviceTypeCode,
      toCleanText(body.preferredPaymentMethod),
      toCleanText(body.preferredPaymentChannel),
      senderProfileId,
      recipientAddressId,
      toCleanText(body.priceLevel),
      toCleanText(body.riskFlag),
      toCleanText(body.remark),
      now,
      existing.id
    );
  } else {
    db.prepare(`
      INSERT INTO crm_customer_line_profile (
        id, customer_id, business_line, preferred_route_code, preferred_service_type_code,
        preferred_payment_method, preferred_payment_channel, default_sender_profile_id, default_recipient_address_id,
        price_level, risk_flag, remark, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profileId,
      req.params.id,
      businessLine,
      toCleanText(body.preferredRouteCode),
      serviceTypeCode,
      toCleanText(body.preferredPaymentMethod),
      toCleanText(body.preferredPaymentChannel),
      senderProfileId,
      recipientAddressId,
      toCleanText(body.priceLevel),
      toCleanText(body.riskFlag),
      toCleanText(body.remark),
      now,
      now
    );
  }

  const profile = db.prepare(`
    SELECT
      p.id,
      p.customer_id AS customerId,
      p.business_line AS businessLine,
      p.preferred_route_code AS preferredRouteCode,
      p.preferred_service_type_code AS preferredServiceTypeCode,
      st.name AS preferredServiceTypeName,
      p.preferred_payment_method AS preferredPaymentMethod,
      p.preferred_payment_channel AS preferredPaymentChannel,
      p.default_sender_profile_id AS defaultSenderProfileId,
      p.default_recipient_address_id AS defaultRecipientAddressId,
      p.price_level AS priceLevel,
      p.risk_flag AS riskFlag,
      p.remark,
      p.created_at AS createdAt,
      p.updated_at AS updatedAt
    FROM crm_customer_line_profile p
    LEFT JOIN md_service_type st ON st.code = p.preferred_service_type_code
    WHERE p.id = ?
  `).get(profileId);

  success(res, profile);
});

router.post('/oms/orders', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const orderSource = String(body.orderSource || 'SALES_ASSIST').trim().toUpperCase();

  let customerId = String(body.customerId || '').trim();
  let customer = customerId
    ? db.prepare('SELECT * FROM crm_customer WHERE id = ?').get(customerId) as any
    : null;

  // 客户自助端首单支持：未指定 customerId 时自动创建公海客户线索。
  if (!customer && orderSource === 'CUSTOMER_APP') {
    const lead = body.newCustomerLead && typeof body.newCustomerLead === 'object' ? body.newCustomerLead : null;
    if (!lead) {
      error(res, 'customerId is required (or provide newCustomerLead for customer-app first order)');
      return;
    }

    const leadName = toRequiredText(lead.customerName || lead.name || body.customerName);
    const leadCountry = toRequiredText(lead.country || lead.customerCountry || '中国');
    const leadContactName = toRequiredText(lead.contactName || body.senderName || body.consigneeName);
    const leadContactPhone = toRequiredText(lead.contactPhone || body.senderPhone || body.consigneePhone);
    const leadContactEmail = toCleanText(lead.contactEmail || body.consigneeEmail);
    if (!leadName || !leadCountry || !leadContactName || !leadContactPhone) {
      error(res, 'newCustomerLead 缺少必填字段：name/country/contactName/contactPhone');
      return;
    }

    const existingByLead = db.prepare(`
      SELECT *
      FROM crm_customer
      WHERE customer_name = ? AND contact_phone = ?
      LIMIT 1
    `).get(leadName, leadContactPhone) as any;

    if (existingByLead) {
      customer = existingByLead;
      customerId = existingByLead.id;
    } else {
      const recipientName = toRequiredText(body.consigneeName || lead.consigneeName || leadContactName);
      const recipientPhone = toRequiredText(body.consigneePhone || lead.consigneePhone || leadContactPhone);
      const recipientAddress = toRequiredText(body.consigneeAddress || body.destAddress || lead.consigneeAddress || '-');
      const recipientEmail = toCleanText(body.consigneeEmail || lead.consigneeEmail || leadContactEmail);
      const recipientCountryText = toRequiredText(lead.destCountry || body.destCountry || leadCountry);
      const recipientCityText = toRequiredText(lead.destCity || body.destCity);

      const recipientCountryId = resolveCountryIdByText(db, body.consigneeCountryId || recipientCountryText);
      const recipientCityId = resolveCityIdByText(db, recipientCountryId, body.consigneeCityId || recipientCityText);
      if (!recipientCountryId || !recipientCityId) {
        error(res, '首次下单自动建客户失败：收货国家/城市未匹配，请先维护基础国家城市');
        return;
      }

      const senderName = toCleanText(body.senderName || lead.senderName);
      const senderPhone = toCleanText(body.senderPhone || lead.senderPhone);
      const senderAddress = toCleanText(body.senderAddress || lead.senderAddress);
      const senderCountryId = resolveCountryIdByText(db, body.senderCountryId || lead.senderCountry || leadCountry);
      const senderCityId = resolveCityIdByText(db, senderCountryId, body.senderCityId || lead.senderCity);

      const createdCustomerId = randomToken('CUST');
      const createdCustomerCode = createUniqueCustomerShortCode(db);
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO crm_customer (
            id, customer_code, customer_name, customer_type, owner_user_id,
            source, pool_type, status, country, address, industry,
            contact_name, contact_phone, contact_email, company_type, credit_level, remark, enter_pool_time,
            created_at, updated_at
          )
          VALUES (
            ?, ?, ?, 'COMPANY', NULL,
            ?, 'PUBLIC', 'ACTIVE', ?, ?, NULL,
            ?, ?, ?, NULL, NULL, ?, ?,
            ?, ?
          )
        `).run(
          createdCustomerId,
          createdCustomerCode,
          leadName,
          toCleanText(lead.source || 'FIRST_ORDER_AUTO_CREATE'),
          leadCountry,
          toCleanText(lead.address),
          leadContactName,
          leadContactPhone,
          leadContactEmail,
          toCleanText(lead.remark || '首次下单自动创建公海线索'),
          now,
          now,
          now
        );

        if (senderName || senderPhone || senderAddress) {
          db.prepare(`
            INSERT INTO crm_sender_profile (
              id, customer_id, sender_name, sender_phone, sender_address, sender_district,
              sender_city_id, sender_country_id, is_default, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
          `).run(
            randomToken('SENDER'),
            createdCustomerId,
            senderName || leadContactName,
            senderPhone,
            senderAddress,
            null,
            senderCityId,
            senderCountryId,
            now,
            now
          );
        }

        db.prepare(`
          INSERT INTO uc_recipient_address (
            id, customer_id, recipient_name, recipient_phone, recipient_email,
            country_id, city_id, district, detail_address, is_default, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(
          randomToken('REC'),
          createdCustomerId,
          recipientName,
          recipientPhone,
          recipientEmail,
          recipientCountryId,
          recipientCityId,
          toCleanText(body.consigneeDistrict || lead.consigneeDistrict),
          recipientAddress,
          now,
          now
        );
      });

      tx();
      customerId = createdCustomerId;
      customer = db.prepare('SELECT * FROM crm_customer WHERE id = ?').get(createdCustomerId) as any;
    }
  }

  if (!customer || !customerId) {
    if (orderSource === 'CUSTOMER_APP') {
      error(res, 'customer not found', 404);
      return;
    }
    error(res, '当前销售代下单模式必须先选择已有客户 customerId');
    return;
  }

  const businessLine: Line = parseLine(body.businessLine);
  const lineProfile = db.prepare(`
    SELECT *
    FROM crm_customer_line_profile
    WHERE customer_id = ? AND business_line = ?
    LIMIT 1
  `).get(customerId, businessLine) as any;

  const serviceTypeCode = String(
    body.serviceTypeCode
    || lineProfile?.preferred_service_type_code
    || (businessLine === 'SEA' ? 'LCL_SEA' : 'STANDARD_AIR')
  );
  const service = db.prepare('SELECT code FROM md_service_type WHERE code = ?').get(serviceTypeCode) as any;
  if (!service) {
    error(res, 'serviceTypeCode not found');
    return;
  }

  const senderProfileId = body.senderProfileId
    ? String(body.senderProfileId)
    : (lineProfile?.default_sender_profile_id ? String(lineProfile.default_sender_profile_id) : '');
  const recipientAddressId = body.recipientAddressId
    ? String(body.recipientAddressId)
    : (lineProfile?.default_recipient_address_id ? String(lineProfile.default_recipient_address_id) : '');
  const sender = senderProfileId
    ? db.prepare('SELECT * FROM crm_sender_profile WHERE id = ?').get(senderProfileId) as any
    : db.prepare('SELECT * FROM crm_sender_profile WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC LIMIT 1').get(customerId) as any;
  const recipient = recipientAddressId
    ? db.prepare('SELECT * FROM uc_recipient_address WHERE id = ?').get(recipientAddressId) as any
    : db.prepare('SELECT * FROM uc_recipient_address WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC LIMIT 1').get(customerId) as any;

  if (!recipient) {
    error(res, 'recipient address not found, please bind recipient first');
    return;
  }

  const packages = Array.isArray(body.packages) ? body.packages : [];
  const validPackages = packages.filter((p: any) => p && p.trackingNo);
  const totalPieces = validPackages.reduce((sum: number, p: any) => sum + Number(p.pieces || 0), 0);
  const totalDeclaredWeight = validPackages.reduce((sum: number, p: any) => sum + Number(p.declaredWeightKg || p.weight || 0), 0);
  const totalDeclaredValue = validPackages.reduce((sum: number, p: any) => sum + Number(p.declaredValueUsd || p.declaredValue || 0), 0);

  const orderId = randomToken('ORD');
  const orderNo = createOrderNo(db, businessLine, now);
  const manualWarehouseEntryNo = String(body.warehouseEntryNo || '').trim();
  const warehouseEntryNo = manualWarehouseEntryNo || createWarehouseEntryNo(db, orderNo, customer.customer_code);
  const displayOrderNo = orderNo;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO oms_order (
        id, order_no, display_order_no, warehouse_entry_no, business_line, service_type_code,
        customer_id, customer_name, sales_user_id, creator_user_id, route_code, export_mode,
        order_status, order_status_updated_at, payment_status, payment_method, payment_channel, currency_code,
        total_declared_value, total_declared_weight_kg, total_declared_pieces,
        sender_name, sender_phone, sender_address, sender_district, sender_city_id, sender_country_id,
        consignee_name, consignee_phone, consignee_email, consignee_address, consignee_district,
        consignee_city_id, consignee_country_id, remark, created_by, created_at, updated_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        'PENDING_INBOUND', ?, 'UNPAID', ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `).run(
      orderId, orderNo, displayOrderNo, warehouseEntryNo, businessLine, serviceTypeCode,
      customer.id, customer.customer_name, body.salesUserId || null, body.creatorUserId || body.salesUserId || null,
      body.routeCode || lineProfile?.preferred_route_code || `${businessLine === 'SEA' ? 'SEA' : 'AIR'}-DEFAULT-ROUTE`,
      body.exportMode || null,
      now,
      body.paymentMethod || lineProfile?.preferred_payment_method || null,
      body.paymentChannel || lineProfile?.preferred_payment_channel || null,
      body.currencyCode || 'CNY',
      totalDeclaredValue, totalDeclaredWeight, totalPieces,
      body.senderName || sender?.sender_name || null,
      body.senderPhone || sender?.sender_phone || null,
      body.senderAddress || sender?.sender_address || null,
      body.senderDistrict || sender?.sender_district || null,
      body.senderCityId || sender?.sender_city_id || null,
      body.senderCountryId || sender?.sender_country_id || null,
      body.consigneeName || recipient.recipient_name,
      body.consigneePhone || recipient.recipient_phone,
      body.consigneeEmail || recipient.recipient_email || null,
      body.consigneeAddress || recipient.detail_address,
      body.consigneeDistrict || recipient.district || null,
      body.consigneeCityId || recipient.city_id,
      body.consigneeCountryId || recipient.country_id,
      body.remark || null,
      body.creatorUserId || body.salesUserId || null,
      now,
      now
    );

    const insertInitialPkg = db.prepare(`
      INSERT INTO oms_order_package_initial (
        id, order_id, line_no, express_company, tracking_no, package_status, package_status_updated_at,
        goods_name, goods_category, cargo_desc, declared_weight_kg, pieces, declared_value_usd,
        remark, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    validPackages.forEach((pkg: any, idx: number) => {
      insertInitialPkg.run(
        randomToken('PKG'),
        orderId,
        idx + 1,
        pkg.expressCompany || pkg.courier || 'UNKNOWN',
        pkg.trackingNo,
        'PENDING_SIGN',
        now,
        pkg.goodsName || pkg.itemName || '未命名货物',
        pkg.goodsCategory || pkg.category || null,
        (pkg.cargoDesc || pkg.cargoType || 'GENERAL') === 'SENSITIVE' ? 'SENSITIVE' : 'GENERAL',
        Number(pkg.declaredWeightKg || pkg.weight || 0),
        Number(pkg.pieces || 0),
        Number(pkg.declaredValueUsd || pkg.declaredValue || 0),
        pkg.remark || null,
        now,
        now
      );
    });

    db.prepare(`
      INSERT INTO oms_order_status_log (
        id, order_id, sub_order_id, status_code, node_code, node_name, event_time, operator_user_id, remark, created_at
      )
      VALUES (?, ?, ?, 'PENDING_INBOUND', 'ORDER_CREATE', '订单创建', ?, ?, ?, ?)
    `).run(
      randomToken('OSL'),
      orderId,
      null,
      now,
      body.creatorUserId || body.salesUserId || null,
      '订单已创建',
      now
    );
  });

  tx();

  const order = db.prepare('SELECT * FROM oms_order WHERE id = ?').get(orderId);
  const subOrders = db.prepare('SELECT * FROM oms_sub_order WHERE order_id = ? ORDER BY line_no').all(orderId);
  const initialPackages = db.prepare('SELECT * FROM oms_order_package_initial WHERE order_id = ? ORDER BY line_no').all(orderId);
  success(res, { order, subOrders, initialPackages });
});

router.get('/oms/orders', (req, res) => {
  const db = getV2Db();
  const {
    businessLine,
    customerId,
    status,
    paymentStatus,
    salesUserId,
    serviceTypeCode,
    currencyCode,
    keyword,
    startDate,
    endDate,
    page = '1',
    pageSize = '20',
  } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (businessLine) { where += ' AND o.business_line = ?'; params.push(String(businessLine)); }
  if (customerId) { where += ' AND o.customer_id = ?'; params.push(String(customerId)); }
  if (status) { where += ' AND o.order_status = ?'; params.push(String(status)); }
  if (paymentStatus) { where += ' AND o.payment_status = ?'; params.push(String(paymentStatus)); }
  if (salesUserId) { where += ' AND o.sales_user_id = ?'; params.push(String(salesUserId)); }
  if (serviceTypeCode) { where += ' AND o.service_type_code = ?'; params.push(String(serviceTypeCode)); }
  if (currencyCode) { where += ' AND o.currency_code = ?'; params.push(String(currencyCode)); }

  if (keyword) {
    where += ` AND (
      o.order_no LIKE ? OR o.display_order_no LIKE ? OR o.warehouse_entry_no LIKE ? OR
      o.customer_name LIKE ? OR o.consignee_name LIKE ? OR o.consignee_phone LIKE ? OR o.route_code LIKE ?
    )`;
    const v = `%${String(keyword)}%`;
    params.push(v, v, v, v, v, v, v);
  }

  if (startDate) {
    where += ' AND datetime(o.created_at) >= datetime(?)';
    params.push(`${String(startDate).slice(0, 10)}T00:00:00.000Z`);
  }
  if (endDate) {
    where += ' AND datetime(o.created_at) <= datetime(?)';
    params.push(`${String(endDate).slice(0, 10)}T23:59:59.999Z`);
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM oms_order o ${where}`).get(...params) as any).c;
  const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
  const sizeNum = Math.max(parseInt(String(pageSize), 10) || 20, 1);
  const offset = (pageNum - 1) * sizeNum;

  const rows = db.prepare(`
    SELECT
      o.*,
      st.name AS service_type_name,
      su.real_name AS sales_user_name,
      cu.real_name AS creator_user_name,
      country.name_cn AS consignee_country_name,
      city.name_cn AS consignee_city_name,
      (
        SELECT COUNT(*)
        FROM oms_sub_order so
        WHERE so.order_id = o.id
      ) AS sub_order_count
    FROM oms_order o
    LEFT JOIN md_service_type st ON st.code = o.service_type_code
    LEFT JOIN sys_user su ON su.id = o.sales_user_id
    LEFT JOIN sys_user cu ON cu.id = o.creator_user_id
    LEFT JOIN md_country country ON country.id = o.consignee_country_id
    LEFT JOIN md_city city ON city.id = o.consignee_city_id
    ${where}
    ORDER BY o.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, sizeNum, offset);

  paginated(res, rows as any[], total, pageNum, sizeNum);
});

router.get('/oms/orders/:id/full', (req, res) => {
  const db = getV2Db();
  const order = db.prepare(`
    SELECT
      o.*,
      st.name AS service_type_name,
      su.real_name AS sales_user_name,
      cu.real_name AS creator_user_name,
      sender_city.name_cn AS sender_city_name,
      sender_country.name_cn AS sender_country_name,
      consignee_city.name_cn AS consignee_city_name,
      consignee_country.name_cn AS consignee_country_name
    FROM oms_order o
    LEFT JOIN md_service_type st ON st.code = o.service_type_code
    LEFT JOIN sys_user su ON su.id = o.sales_user_id
    LEFT JOIN sys_user cu ON cu.id = o.creator_user_id
    LEFT JOIN md_city sender_city ON sender_city.id = o.sender_city_id
    LEFT JOIN md_country sender_country ON sender_country.id = o.sender_country_id
    LEFT JOIN md_city consignee_city ON consignee_city.id = o.consignee_city_id
    LEFT JOIN md_country consignee_country ON consignee_country.id = o.consignee_country_id
    WHERE o.id = ? OR o.order_no = ? OR o.display_order_no = ?
  `).get(req.params.id, req.params.id, req.params.id) as any;

  if (!order) {
    error(res, 'order not found', 404);
    return;
  }

  const parseExtraJson = (value: unknown): any => {
    if (!value) return null;
    try {
      return JSON.parse(String(value));
    } catch {
      return null;
    }
  };

  const subOrders = db.prepare(`
    SELECT
      so.*,
      st.name AS service_type_name,
      j.job_no,
      u.unit_no AS shipping_unit_no
    FROM oms_sub_order so
    LEFT JOIN md_service_type st ON st.code = so.service_type_code
    LEFT JOIN tms_job j ON j.id = so.job_id
    LEFT JOIN tms_shipping_unit u ON u.id = so.shipping_unit_id
    WHERE so.order_id = ?
    ORDER BY so.line_no
  `).all(order.id);
  const subOrderIds = (subOrders as any[]).map((row) => String(row.id));

  const jobBindings = db.prepare(`
    SELECT
      so.id AS sub_order_id,
      so.sub_order_no,
      so.line_no,
      COALESCE(rel.job_id, so.job_id) AS job_id,
      COALESCE(rel.shipping_unit_id, so.shipping_unit_id) AS shipping_unit_id,
      rel.sequence_no,
      j.job_no,
      j.job_status,
      j.current_phase,
      j.pol_site_id,
      j.pod_site_id,
      j.bill_no,
      j.vessel_voyage,
      j.flight_no,
      j.etd,
      j.eta,
      j.atd,
      j.ata,
      u.unit_no,
      u.unit_type,
      u.container_type,
      u.unit_status,
      pol.name AS pol_site_name,
      pod.name AS pod_site_name
    FROM oms_sub_order so
    LEFT JOIN tms_job_order_rel rel ON rel.sub_order_id = so.id
    LEFT JOIN tms_job j ON j.id = COALESCE(rel.job_id, so.job_id)
    LEFT JOIN tms_shipping_unit u ON u.id = COALESCE(rel.shipping_unit_id, so.shipping_unit_id)
    LEFT JOIN md_site pol ON pol.id = j.pol_site_id
    LEFT JOIN md_site pod ON pod.id = j.pod_site_id
    WHERE so.order_id = ?
    ORDER BY so.line_no ASC, rel.sequence_no ASC, rel.created_at ASC
  `).all(order.id) as any[];
  const jobIds = Array.from(new Set(jobBindings.map((row) => row.job_id).filter(Boolean)));

  const initialPackages = db.prepare('SELECT * FROM oms_order_package_initial WHERE order_id = ? ORDER BY line_no').all(order.id);
  const actualPackages = db.prepare('SELECT * FROM oms_order_package_actual WHERE order_id = ? ORDER BY created_at').all(order.id);
  const statusLogs = db.prepare('SELECT * FROM oms_order_status_log WHERE order_id = ? ORDER BY event_time DESC').all(order.id);
  const trackingWhere: string[] = ['order_id = ?'];
  const trackingParams: any[] = [order.id];
  if (subOrderIds.length > 0) {
    trackingWhere.push(`sub_order_id IN (${subOrderIds.map(() => '?').join(', ')})`);
    trackingParams.push(...subOrderIds);
  }
  if (jobIds.length > 0) {
    trackingWhere.push(`job_id IN (${jobIds.map(() => '?').join(', ')})`);
    trackingParams.push(...jobIds);
  }
  const trackingEvents = db.prepare(`
    SELECT *
    FROM tms_tracking_event
    WHERE ${trackingWhere.map((w) => `(${w})`).join(' OR ')}
    ORDER BY event_time DESC
  `).all(...trackingParams) as any[];

  const subIdsByJob = new Map<string, string[]>();
  for (const row of jobBindings) {
    const jobId = row.job_id ? String(row.job_id) : '';
    const subOrderId = row.sub_order_id ? String(row.sub_order_id) : '';
    if (!jobId || !subOrderId) continue;
    if (!subIdsByJob.has(jobId)) subIdsByJob.set(jobId, []);
    const arr = subIdsByJob.get(jobId)!;
    if (!arr.includes(subOrderId)) arr.push(subOrderId);
  }

  const timelineBuckets = new Map<string, { subOrderId: string; siteMap: Map<string, any> }>();
  const ensureBucket = (subOrderId: string) => {
    let current = timelineBuckets.get(subOrderId);
    if (!current) {
      current = { subOrderId, siteMap: new Map<string, any>() };
      timelineBuckets.set(subOrderId, current);
    }
    return current;
  };

  for (const event of trackingEvents) {
    const eventTime = event.event_time || event.created_at || null;
    const eventTs = eventTime ? Date.parse(String(eventTime)) : 0;
    const subFromEvent = event.sub_order_id ? String(event.sub_order_id) : '';
    const extra = parseExtraJson(event.extra_json);
    const targets: string[] = [];

    if (subFromEvent) {
      targets.push(subFromEvent);
    } else if (event.job_id && subIdsByJob.has(String(event.job_id))) {
      targets.push(...(subIdsByJob.get(String(event.job_id)) || []));
    } else if (subOrderIds.length === 1) {
      targets.push(subOrderIds[0]);
    }

    if (targets.length === 0) continue;

    const rawSiteName = String(
      extra?.siteName
      || extra?.site
      || extra?.stationName
      || event.location
      || '未分配站点'
    ).trim() || '未分配站点';
    const rawSiteCode = String(
      extra?.siteCode
      || extra?.stationCode
      || rawSiteName
    ).trim();
    const siteCode = rawSiteCode
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'UNASSIGNED';
    const nodeCode = String(event.node_code || extra?.nodeCode || event.status_code || 'UNKNOWN').trim() || 'UNKNOWN';
    const nodeName = String(event.node_name || extra?.nodeName || event.status_code || nodeCode).trim() || nodeCode;

    for (const subOrderId of targets) {
      const bucket = ensureBucket(subOrderId);
      let site = bucket.siteMap.get(siteCode);
      if (!site) {
        site = {
          siteCode,
          siteName: rawSiteName,
          firstEventTime: eventTime,
          firstEventTs: eventTs,
          nodesMap: new Map<string, any>(),
        };
        bucket.siteMap.set(siteCode, site);
      } else if (eventTs > 0 && (!site.firstEventTs || eventTs < site.firstEventTs)) {
        site.firstEventTs = eventTs;
        site.firstEventTime = eventTime;
      }

      const existingNode = site.nodesMap.get(nodeCode);
      const shouldReplace = !existingNode || (eventTs > 0 && eventTs >= (existingNode.eventTs || 0));
      if (shouldReplace) {
        site.nodesMap.set(nodeCode, {
          nodeCode,
          nodeName,
          statusCode: event.status_code || null,
          eventType: event.event_type || null,
          eventScope: event.event_scope || null,
          eventTime,
          eventTs,
          location: event.location || null,
          remark: event.remark || null,
          operatorUserId: event.operator_user_id || null,
        });
      }
    }
  }

  const trackingBySubOrder = Array.from(timelineBuckets.values()).map((bucket) => {
    const sites = Array.from(bucket.siteMap.values())
      .map((site) => ({
        siteCode: site.siteCode,
        siteName: site.siteName,
        firstEventTime: site.firstEventTime || null,
        nodes: Array.from(site.nodesMap.values())
          .sort((a: any, b: any) => (a.eventTs || 0) - (b.eventTs || 0)),
      }))
      .sort((a: any, b: any) => Date.parse(String(a.firstEventTime || '1970-01-01')) - Date.parse(String(b.firstEventTime || '1970-01-01')));
    return {
      subOrderId: bucket.subOrderId,
      sites,
    };
  });

  const dpnBaseSql = `
    SELECT DISTINCT
      d.*,
      wh.name AS warehouse_name,
      c.customer_name
    FROM pod_dpn d
    LEFT JOIN md_warehouse wh ON wh.id = d.warehouse_id
    LEFT JOIN crm_customer c ON c.id = d.customer_id
    JOIN pod_dpn_item i ON i.dpn_id = d.id
  `;
  const dpnWhereSql = subOrderIds.length > 0
    ? `WHERE i.order_id = ? OR i.sub_order_id IN (${subOrderIds.map(() => '?').join(', ')})`
    : 'WHERE i.order_id = ?';
  const dpns = db.prepare(`${dpnBaseSql} ${dpnWhereSql} ORDER BY d.created_at DESC`)
    .all(order.id, ...(subOrderIds.length > 0 ? subOrderIds : [])) as any[];
  const dpnIds = dpns.map((row) => row.id).filter(Boolean);

  let dpnItems: any[] = [];
  let deliveryTasks: any[] = [];
  if (dpnIds.length > 0) {
    const placeholders = dpnIds.map(() => '?').join(', ');
    dpnItems = db.prepare(`
      SELECT
        i.*,
        so.sub_order_no,
        o.order_no,
        o.display_order_no
      FROM pod_dpn_item i
      LEFT JOIN oms_sub_order so ON so.id = i.sub_order_id
      LEFT JOIN oms_order o ON o.id = i.order_id
      WHERE i.dpn_id IN (${placeholders})
      ORDER BY i.created_at DESC
    `).all(...dpnIds) as any[];
    deliveryTasks = db.prepare(`
      SELECT *
      FROM pod_delivery_task
      WHERE dpn_id IN (${placeholders})
      ORDER BY created_at DESC
    `).all(...dpnIds) as any[];
  }

  let routeTemplate: any = null;
  try {
    const legacyDb = getDb();
    const rawRouteCode = String(order.route_code || '').trim();
    const compactRoute = rawRouteCode.replace(/\s+/g, '');
    const routeParts = compactRoute.split(/→|->/);
    if (routeParts.length === 2) {
      const originCityCode = String(routeParts[0] || '').split('.')[0]?.toUpperCase();
      const destCityCode = String(routeParts[1] || '').split('.')[0]?.toUpperCase();
      if (originCityCode && destCityCode) {
        const routeRow = legacyDb.prepare(`
          SELECT *
          FROM routes_config
          WHERE UPPER(originCity) = ?
            AND UPPER(destCity) = ?
            AND transportType = ?
            AND status = 'ACTIVE'
          ORDER BY COALESCE(updatedAt, createdAt) DESC
          LIMIT 1
        `).get(originCityCode, destCityCode, order.business_line) as any;

        if (routeRow) {
          const nodeRows = legacyDb.prepare(`
            SELECT *
            FROM route_logistics_nodes
            WHERE routeId = ?
              AND status = 'ACTIVE'
            ORDER BY sortOrder ASC
          `).all(routeRow.id) as any[];
          routeTemplate = {
            routeId: routeRow.id,
            routeCode: rawRouteCode || `${routeRow.originCity}.${routeRow.originCountry}→${routeRow.destCity}.${routeRow.destCountry}`,
            businessLine: routeRow.transportType,
            origin: {
              country: routeRow.originCountry,
              city: routeRow.originCity,
            },
            destination: {
              country: routeRow.destCountry,
              city: routeRow.destCity,
            },
            transitDays: routeRow.transitDays || null,
            arrivalStation: routeRow.arrivalStation || null,
            nodes: nodeRows.map((node) => ({
              nodeCode: node.nodeCode,
              nodeName: node.nodeName,
              nodeType: node.nodeType,
              sortOrder: Number(node.sortOrder || 0),
              isRequired: Number(node.isRequired || 0) === 1,
            })),
          };
        }
      }
    }
  } catch {
    routeTemplate = null;
  }

  const fees = db.prepare(`
    SELECT *
    FROM fin_fee
    WHERE (fee_level = 'ORDER' AND related_id = ?)
       OR (fee_level = 'SUB_ORDER' AND related_id IN (SELECT id FROM oms_sub_order WHERE order_id = ?))
    ORDER BY created_at DESC
  `).all(order.id, order.id);
  const payments = db.prepare(`
    SELECT p.*
    FROM fin_payment p
    LEFT JOIN fin_fee f ON p.related_fee_id = f.id
    WHERE f.related_id = ?
    ORDER BY p.created_at DESC
  `).all(order.id);

  success(res, {
    order,
    subOrders,
    initialPackages,
    actualPackages,
    statusLogs,
    trackingEvents,
    trackingBySubOrder,
    jobBindings,
    routeTemplate,
    dpns,
    dpnItems,
    deliveryTasks,
    fees,
    payments,
  });
});

router.put('/oms/orders/:id', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const current = findOrderByAnyNo(db, req.params.id);
  if (!current) {
    error(res, 'order not found', 404);
    return;
  }

  const mapped: Record<string, any> = {
    order_status: body.status ?? body.orderStatus,
    payment_status: body.paymentStatus,
    payment_method: body.paymentMethod,
    payment_channel: body.paymentChannel,
    payment_time: body.paymentTime,
    route_code: body.routeCode,
    service_type_code: body.serviceType ?? body.serviceTypeCode,
    warehouse_entry_no: body.warehouseEntryNo,
    consignee_name: body.consignee,
    consignee_phone: body.consigneePhone,
    consignee_email: body.consigneeEmail,
    consignee_address: body.destAddress ?? body.consigneeAddress,
    consignee_district: body.district ?? body.consigneeDistrict,
    sender_name: body.sender,
    sender_phone: body.senderPhone,
    sender_address: body.senderAddress,
    sender_district: body.senderDistrict,
    remark: body.remark,
    currency_code: body.currency ?? body.currencyCode,
    sales_user_id: body.salesUserId,
    creator_user_id: body.creatorUserId,
    total_receivable_amount: body.totalFreight ?? body.totalReceivableAmount,
    total_paid_amount: body.paidAmount ?? body.totalPaidAmount,
    previous_status: body.previousStatus,
    return_type: body.returnType,
    return_reason: body.returnReason,
    return_refund_amount: body.returnRefundAmount,
    return_refund_method: body.returnRefundMethod,
    need_return: body.needReturn !== undefined ? toNullableBool(body.needReturn) : undefined,
    return_shipping_note: body.returnShippingNote,
    return_applied_by: body.returnAppliedBy,
    return_applied_at: body.returnAppliedAt,
    return_approver: body.returnApprover,
    return_approved_at: body.returnApprovedAt,
    return_reject_reason: body.returnRejectReason,
  };

  if (body.consigneeCityId) mapped.consignee_city_id = body.consigneeCityId;
  if (body.consigneeCountryId) mapped.consignee_country_id = body.consigneeCountryId;
  if (body.senderCityId) mapped.sender_city_id = body.senderCityId;
  if (body.senderCountryId) mapped.sender_country_id = body.senderCountryId;
  if (body.warehouseEntryNo !== undefined) {
    const normalizedEntryNo = String(body.warehouseEntryNo || '').trim();
    mapped.warehouse_entry_no = normalizedEntryNo || null;
    mapped.display_order_no = current.order_no;
  }

  const sets: string[] = [];
  const values: any[] = [];
  Object.entries(mapped).forEach(([col, val]) => {
    if (val === undefined) return;
    sets.push(`${col} = ?`);
    values.push(val);
  });

  const hasPackageUpdate = Array.isArray(body.expressPackages);

  if (sets.length === 0 && !hasPackageUpdate) {
    success(res, current);
    return;
  }

  if (sets.some((s) => s.startsWith('order_status'))) {
    sets.push('order_status_updated_at = ?');
    values.push(now);
  }
  if (sets.some((s) => s.startsWith('payment_status'))) {
    sets.push('payment_status_updated_at = ?');
    values.push(now);
  }

  sets.push('updated_at = ?');
  values.push(now);
  values.push(current.id);

  const tx = db.transaction(() => {
    if (sets.length > 0) {
      db.prepare(`UPDATE oms_order SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    }

    if (hasPackageUpdate) {
      const packages = (body.expressPackages as any[]).filter((pkg: any) => pkg && pkg.trackingNo);
      db.prepare('DELETE FROM oms_order_package_initial WHERE order_id = ?').run(current.id);
      const insertPkg = db.prepare(`
        INSERT INTO oms_order_package_initial (
          id, order_id, line_no, express_company, tracking_no, package_status, package_status_updated_at,
          goods_name, goods_category, cargo_desc, declared_weight_kg, pieces, declared_value_usd,
          remark, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let totalPieces = 0;
      let totalWeight = 0;
      let totalValue = 0;
      packages.forEach((pkg: any, idx: number) => {
        const pieces = Number(pkg.pieces || 0);
        const weight = Number(pkg.weight || pkg.declaredWeightKg || 0);
        const value = Number(pkg.declaredValue || pkg.declaredValueUsd || 0);
        const cargoDesc = String(pkg.cargoType || pkg.cargoDesc || 'GENERAL').toUpperCase();
        insertPkg.run(
          randomToken('PKG'),
          current.id,
          idx + 1,
          pkg.expressCompany || pkg.courier || 'UNKNOWN',
          String(pkg.trackingNo),
          'PENDING_SIGN',
          now,
          pkg.itemName || pkg.goodsName || '未命名货物',
          pkg.category || pkg.goodsCategory || null,
          cargoDesc.includes('SENSITIVE') || cargoDesc.includes('敏感') ? 'SENSITIVE' : 'GENERAL',
          weight,
          pieces,
          value,
          pkg.remark || null,
          now,
          now
        );
        totalPieces += pieces;
        totalWeight += weight;
        totalValue += value;
      });

      db.prepare(`
        UPDATE oms_order
        SET total_declared_pieces = ?,
            total_declared_weight_kg = ?,
            total_declared_value = ?,
            updated_at = ?
        WHERE id = ?
      `).run(totalPieces, totalWeight, totalValue, now, current.id);
    }
  });

  tx();
  const updated = db.prepare('SELECT * FROM oms_order WHERE id = ?').get(current.id);
  success(res, updated);
});

router.post('/oms/orders/:id/approve-return', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const order = findOrderByAnyNo(db, req.params.id);
  if (!order) {
    error(res, 'order not found', 404);
    return;
  }
  if (order.order_status !== 'RETURN_APPLIED') {
    error(res, 'order status is not RETURN_APPLIED');
    return;
  }

  const subOrders = db.prepare('SELECT id FROM oms_sub_order WHERE order_id = ?').all(order.id) as Array<{ id: string }>;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE oms_order
      SET order_status = 'CANCELLED',
          order_status_updated_at = ?,
          return_approver = ?,
          return_approved_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(now, body.approver || '系统', now, now, order.id);

    db.prepare(`
      UPDATE oms_sub_order
      SET sub_status = 'CANCELLED',
          sub_status_updated_at = ?,
          updated_at = ?
      WHERE order_id = ?
    `).run(now, now, order.id);

    subOrders.forEach((sub) => {
      db.prepare(`
        INSERT INTO oms_order_status_log (
          id, order_id, sub_order_id, status_code, node_code, node_name, event_time, operator_user_id, remark, created_at
        )
        VALUES (?, ?, ?, 'CANCELLED', 'RETURN_APPROVE', '退单审核通过', ?, ?, ?, ?)
      `).run(
        randomToken('OSL'),
        order.id,
        sub.id,
        now,
        body.approver || null,
        '退单审核通过，订单取消',
        now
      );
    });
  });
  tx();

  success(res, {
    order: db.prepare('SELECT * FROM oms_order WHERE id = ?').get(order.id),
    summary: {
      subOrderCancelled: subOrders.length,
    },
  });
});

router.post('/oms/orders/:id/reject-return', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const order = findOrderByAnyNo(db, req.params.id);
  if (!order) {
    error(res, 'order not found', 404);
    return;
  }
  if (order.order_status !== 'RETURN_APPLIED') {
    error(res, 'order status is not RETURN_APPLIED');
    return;
  }

  const restoredStatus = String(order.previous_status || 'PENDING_INBOUND');
  db.prepare(`
    UPDATE oms_order
    SET order_status = ?,
        order_status_updated_at = ?,
        return_type = NULL,
        return_reason = NULL,
        return_refund_amount = NULL,
        return_refund_method = NULL,
        need_return = NULL,
        return_shipping_note = NULL,
        return_applied_by = NULL,
        return_applied_at = NULL,
        previous_status = NULL,
        return_approver = ?,
        return_approved_at = ?,
        return_reject_reason = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    restoredStatus,
    now,
    body.approver || '系统',
    now,
    body.rejectReason || '',
    now,
    order.id
  );

  success(res, db.prepare('SELECT * FROM oms_order WHERE id = ?').get(order.id));
});

// ======================================================
// WMS
// ======================================================

router.post('/wms/inbounds', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const warehouseId = String(body.warehouseId || '').trim();
  if (!warehouseId) {
    error(res, 'warehouseId is required');
    return;
  }

  const inboundItems = Array.isArray(body.items) ? body.items : [];
  if (inboundItems.length === 0) {
    error(res, 'items is required');
    return;
  }

  const subOrderKey = String(body.subOrderId || '').trim();
  const orderKey = String(body.orderId || '').trim();
  const noOrderInbound = !subOrderKey && !orderKey;
  const requestedBusinessLine = parseLineStrict(body.businessLine);
  if (noOrderInbound && !requestedBusinessLine) {
    error(res, '无订单入库必须传入 businessLine（SEA/AIR）');
    return;
  }

  let fixedSub: any = null;
  let order: any = null;
  if (!noOrderInbound) {
    if (subOrderKey) {
      fixedSub = db.prepare('SELECT * FROM oms_sub_order WHERE id = ? OR sub_order_no = ?').get(subOrderKey, subOrderKey) as any;
      if (!fixedSub) {
        error(res, 'sub order not found');
        return;
      }
      order = db.prepare('SELECT * FROM oms_order WHERE id = ?').get(fixedSub.order_id) as any;
      if (!order) {
        error(res, 'order not found');
        return;
      }
      if (orderKey) {
        const requestedOrder = findOrderByAnyNo(db, orderKey);
        if (!requestedOrder) {
          error(res, 'order not found');
          return;
        }
        if (requestedOrder.id !== order.id) {
          error(res, 'subOrderId 与 orderId 不属于同一主单');
          return;
        }
      }
    } else {
      order = findOrderByAnyNo(db, orderKey);
      if (!order) {
        error(res, 'order not found');
        return;
      }
    }
  }

  const inboundId = randomToken('INB');
  const inboundNo = createUniqueNo(db, 'wms_inbound_order', 'inbound_no', 'INB');
  const createdSubOrderIds: string[] = [];
  const createdSubOrderNos: string[] = [];

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO wms_inbound_order (
        id, inbound_no, business_line, warehouse_id, order_id, sub_order_id, source_type,
        source_ref_no, inbound_status, inbound_at, operator_user_id, remark, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?)
    `).run(
      inboundId,
      inboundNo,
      noOrderInbound ? (requestedBusinessLine as Line) : order.business_line,
      warehouseId,
      noOrderInbound ? null : order.id,
      noOrderInbound ? null : (fixedSub?.id || null),
      body.sourceType || (noOrderInbound ? 'NO_ORDER' : 'THIRD_PARTY'),
      body.sourceRefNo || null,
      now,
      body.operatorUserId || null,
      body.remark || null,
      now,
      now
    );

    const insertInboundItem = db.prepare(`
      INSERT INTO wms_inbound_item (
        id, inbound_order_id, order_id, sub_order_id, package_actual_id, tracking_no,
        pieces, gross_weight_kg, length_cm, width_cm, height_cm, volume_cbm,
        package_condition, location_code, item_status,
        sender_name, sender_phone, consignee_name, consignee_phone, customer_hint,
        matched_order_id, matched_sub_order_id, matched_at,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSubOrder = db.prepare(`
      INSERT INTO oms_sub_order (
        id, sub_order_no, order_id, line_no, business_line, sub_status, sub_status_updated_at,
        route_code, service_type_code, chargeable_weight_kg, actual_weight_kg, volume_cbm,
        volume_weight_kg, pieces, remark, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'INBOUND', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertActualPkg = db.prepare(`
      INSERT INTO oms_order_package_actual (
        id, order_id, sub_order_id, initial_package_id, tracking_no, goods_name, cargo_desc,
        length_cm, width_cm, height_cm, pieces, gross_weight_kg, volume_cbm, volume_weight_kg,
        chargeable_weight_kg, package_status, package_status_updated_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_STOCK', ?, ?, ?)
    `);

    const insertStock = db.prepare(`
      INSERT INTO wms_stock (
        id, business_line, warehouse_id, order_id, sub_order_id, package_actual_id, stock_status,
        pieces, gross_weight_kg, volume_cbm, location_code, last_txn_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'IN_STOCK', ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertStockTxn = db.prepare(`
      INSERT INTO wms_stock_txn (
        id, stock_id, txn_type, qty_delta, weight_delta, from_location, to_location,
        ref_type, ref_id, operator_user_id, txn_time, remark, created_at
      )
      VALUES (?, ?, 'INBOUND', ?, ?, NULL, ?, 'INBOUND', ?, ?, ?, ?, ?)
    `);

    let subPieces = 0;
    let subWeight = 0;
    let subVolume = 0;
    let subChargeable = 0;
    let orderPieces = 0;
    let orderWeight = 0;
    let orderChargeable = 0;
    let unmatchedCount = 0;
    let nextLineNo = (!noOrderInbound && !fixedSub) ? nextSubOrderLine(db, order.id) : 0;

    inboundItems.forEach((item: any) => {
      const length = Number(item.lengthCm || 0);
      const width = Number(item.widthCm || 0);
      const height = Number(item.heightCm || 0);
      const pieces = Number(item.pieces || 0);
      const gross = Number(item.grossWeightKg || item.weightKg || 0);
      const currentBusinessLine: Line = noOrderInbound
        ? (requestedBusinessLine as Line)
        : (order.business_line === 'AIR' ? 'AIR' : 'SEA');
      const volumeCbm = length > 0 && width > 0 && height > 0
        ? (length * width * height) / 1000000
        : Number(item.volumeCbm || 0);
      const volumeWeight = currentBusinessLine === 'AIR'
        ? ((length * width * height) / 6000)
        : (volumeCbm * 700);
      const chargeable = Math.max(gross, volumeWeight || 0);
      const trackingNo = item.trackingNo ? String(item.trackingNo) : null;

      let currentOrderId: string | null = noOrderInbound ? null : order.id;
      let currentSubId: string | null = noOrderInbound ? null : (fixedSub?.id || null);
      if (!noOrderInbound && !fixedSub) {
        const subId = randomToken('SUB');
        const subNo = createSubOrderNo(order.order_no || order.display_order_no || order.id, nextLineNo);
        insertSubOrder.run(
          subId,
          subNo,
          order.id,
          nextLineNo,
          currentBusinessLine,
          now,
          order.route_code,
          order.service_type_code,
          chargeable,
          gross,
          volumeCbm,
          volumeWeight || 0,
          pieces,
          toCleanText(item.remark) || '入库自动生成子单',
          now,
          now
        );
        currentSubId = subId;
        currentOrderId = order.id;
        createdSubOrderIds.push(subId);
        createdSubOrderNos.push(subNo);
        nextLineNo += 1;
      }

      const initialPkg = (!noOrderInbound && trackingNo)
        ? db.prepare('SELECT * FROM oms_order_package_initial WHERE order_id = ? AND tracking_no = ? LIMIT 1').get(order.id, trackingNo) as any
        : null;
      const pkgActualId = randomToken('APKG');
      const inboundItemId = randomToken('INBI');
      const senderName = toCleanText(item.senderName || body.senderName);
      const senderPhone = toCleanText(item.senderPhone || body.senderPhone);
      const consigneeName = toCleanText(item.consigneeName || body.consigneeName);
      const consigneePhone = toCleanText(item.consigneePhone || body.consigneePhone);
      const customerHint = toCleanText(item.customerHint || body.customerHint);

      insertInboundItem.run(
        inboundItemId,
        inboundId,
        currentOrderId,
        currentSubId,
        null,
        trackingNo,
        pieces,
        gross,
        length || null,
        width || null,
        height || null,
        volumeCbm || 0,
        item.packageCondition || 'GOOD',
        item.locationCode || null,
        noOrderInbound ? 'PENDING' : 'COMPLETED',
        senderName,
        senderPhone,
        consigneeName,
        consigneePhone,
        customerHint,
        null,
        null,
        null,
        now,
        now
      );

      if (noOrderInbound) {
        db.prepare(`
          INSERT INTO wms_unmatched_package (
            id, business_line, warehouse_id, inbound_order_id, inbound_item_id, tracking_no, express_company,
            sender_name, sender_phone, consignee_name, consignee_phone, customer_hint,
            pieces, gross_weight_kg, volume_cbm, status, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
        `).run(
          randomToken('UMP'),
          requestedBusinessLine as Line,
          warehouseId,
          inboundId,
          inboundItemId,
          trackingNo,
          toCleanText(item.expressCompany || body.expressCompany),
          senderName,
          senderPhone,
          consigneeName,
          consigneePhone,
          customerHint,
          pieces,
          gross,
          volumeCbm || 0,
          now,
          now
        );
        unmatchedCount += 1;
      } else {
        if (!currentSubId) throw new Error('系统异常：子单未生成');

        insertActualPkg.run(
          pkgActualId,
          order.id,
          currentSubId,
          initialPkg?.id || null,
          trackingNo,
          item.goodsName || initialPkg?.goods_name || '未命名货物',
          (item.cargoDesc || initialPkg?.cargo_desc || 'GENERAL') === 'SENSITIVE' ? 'SENSITIVE' : 'GENERAL',
          length || null,
          width || null,
          height || null,
          pieces,
          gross,
          volumeCbm,
          volumeWeight || 0,
          chargeable,
          now,
          now,
          now
        );

        db.prepare(`
          UPDATE wms_inbound_item
          SET package_actual_id = ?, updated_at = ?
          WHERE id = ?
        `).run(pkgActualId, now, inboundItemId);

        const stockId = randomToken('STK');
        insertStock.run(
          stockId,
          order.business_line,
          warehouseId,
          order.id,
          currentSubId,
          pkgActualId,
          pieces,
          gross,
          volumeCbm || 0,
          item.locationCode || null,
          now,
          now,
          now
        );

        insertStockTxn.run(
          randomToken('STX'),
          stockId,
          pieces,
          gross,
          item.locationCode || null,
          inboundId,
          body.operatorUserId || null,
          now,
          '入库完成',
          now
        );

        if (initialPkg?.id) {
          db.prepare(`
            UPDATE oms_order_package_initial
            SET package_status = 'INBOUND', package_status_updated_at = ?, updated_at = ?
            WHERE id = ?
          `).run(now, now, initialPkg.id);
        }

        if (fixedSub) {
          subPieces += pieces;
          subWeight += gross;
          subVolume += volumeCbm || 0;
          subChargeable += chargeable;
        }
        orderPieces += pieces;
        orderWeight += gross;
        orderChargeable += chargeable;
      }
    });

    if (!noOrderInbound) {
      if (fixedSub) {
        db.prepare(`
          UPDATE oms_sub_order
          SET sub_status = 'INBOUND',
              sub_status_updated_at = ?,
              pieces = COALESCE(NULLIF(pieces, 0), ?),
              actual_weight_kg = COALESCE(actual_weight_kg, 0) + ?,
              volume_cbm = COALESCE(volume_cbm, 0) + ?,
              chargeable_weight_kg = COALESCE(chargeable_weight_kg, 0) + ?,
              updated_at = ?
          WHERE id = ?
        `).run(now, subPieces, subWeight, subVolume, subChargeable, now, fixedSub.id);
      }

      db.prepare(`
        UPDATE oms_order
        SET total_actual_weight_kg = COALESCE(total_actual_weight_kg, 0) + ?,
            total_actual_pieces = COALESCE(total_actual_pieces, 0) + ?,
            total_chargeable_weight_kg = COALESCE(total_chargeable_weight_kg, 0) + ?,
            updated_at = ?
        WHERE id = ?
      `).run(orderWeight, orderPieces, orderChargeable, now, order.id);

      if (fixedSub) {
        db.prepare(`
          INSERT INTO oms_order_status_log (
            id, order_id, sub_order_id, status_code, node_code, node_name, event_time, operator_user_id, remark, created_at
          )
          VALUES (?, ?, ?, 'INBOUND', 'WMS_INBOUND', '仓库入库', ?, ?, ?, ?)
        `).run(
          randomToken('OSL'),
          order.id,
          fixedSub.id,
          now,
          body.operatorUserId || null,
          `入库单 ${inboundNo}`,
          now
        );
      } else {
        const logStmt = db.prepare(`
          INSERT INTO oms_order_status_log (
            id, order_id, sub_order_id, status_code, node_code, node_name, event_time, operator_user_id, remark, created_at
          )
          VALUES (?, ?, ?, 'INBOUND', 'WMS_INBOUND_CREATE_SUB', '仓库入库并生成子单', ?, ?, ?, ?)
        `);
        createdSubOrderIds.forEach((subId, idx) => {
          logStmt.run(
            randomToken('OSL'),
            order.id,
            subId,
            now,
            body.operatorUserId || null,
            `入库单 ${inboundNo} 自动生成子单 ${createdSubOrderNos[idx] || subId}`,
            now
          );
        });
      }

      refreshOrderStatusByOrderId(db, order.id, now);
    } else {
      db.prepare(`
        UPDATE wms_inbound_order
        SET remark = COALESCE(remark, '') || CASE WHEN remark IS NULL OR remark = '' THEN '' ELSE '；' END || ?,
            updated_at = ?
        WHERE id = ?
      `).run(`待匹配池包裹 ${unmatchedCount} 条`, now, inboundId);
    }
  });

  tx();

  if (noOrderInbound) {
    success(res, { inboundId, inboundNo, unmatchedCount: inboundItems.length });
    return;
  }
  success(res, {
    inboundId,
    inboundNo,
    orderId: order.id,
    fixedSubOrderId: fixedSub?.id || null,
    createdSubOrderIds,
    createdSubOrderNos,
  });
});

router.get('/wms/unmatched-packages', (req, res) => {
  const db = getV2Db();
  const status = String(req.query.status || '').trim().toUpperCase();
  const businessLine = parseLineStrict(req.query.businessLine);
  const warehouseId = String(req.query.warehouseId || '').trim();
  const keyword = String(req.query.keyword || '').trim();

  if (req.query.businessLine && !businessLine) {
    error(res, 'businessLine 参数不合法，仅支持 SEA/AIR');
    return;
  }
  if (status && !['PENDING', 'MATCHED', 'CLOSED'].includes(status)) {
    error(res, 'status 参数不合法，仅支持 PENDING/MATCHED/CLOSED');
    return;
  }

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND u.status = ?'; params.push(status); }
  if (businessLine) { where += ' AND u.business_line = ?'; params.push(businessLine); }
  if (warehouseId) { where += ' AND u.warehouse_id = ?'; params.push(warehouseId); }
  if (keyword) {
    where += ' AND (u.tracking_no LIKE ? OR u.express_company LIKE ? OR u.consignee_name LIKE ? OR u.consignee_phone LIKE ? OR u.sender_phone LIKE ?)';
    const q = `%${keyword}%`;
    params.push(q, q, q, q, q);
  }

  const rows = db.prepare(`
    SELECT
      u.*,
      w.code AS warehouseCode,
      w.name AS warehouseName,
      o.order_no AS matchedOrderNo,
      o.display_order_no AS matchedDisplayOrderNo,
      so.sub_order_no AS matchedSubOrderNo
    FROM wms_unmatched_package u
    LEFT JOIN md_warehouse w ON w.id = u.warehouse_id
    LEFT JOIN oms_order o ON o.id = u.matched_order_id
    LEFT JOIN oms_sub_order so ON so.id = u.matched_sub_order_id
    ${where}
    ORDER BY CASE u.status WHEN 'PENDING' THEN 0 WHEN 'MATCHED' THEN 1 ELSE 2 END, u.created_at DESC
  `).all(...params);
  success(res, rows);
});

router.get('/wms/unmatched-packages/:id/recommendations', (req, res) => {
  const db = getV2Db();
  const unmatched = db.prepare('SELECT * FROM wms_unmatched_package WHERE id = ?').get(req.params.id) as any;
  if (!unmatched) {
    error(res, 'unmatched package not found', 404);
    return;
  }

  const keywordName = `%${String(unmatched.consignee_name || unmatched.customer_hint || '').trim()}%`;
  const keywordPhone = String(unmatched.consignee_phone || unmatched.sender_phone || '').trim();
  const trackingNo = String(unmatched.tracking_no || '').trim();

  const customerRows = db.prepare(`
    SELECT
      c.id,
      c.customer_code AS shortCode,
      c.customer_name AS customerName,
      c.contact_name AS contactName,
      c.contact_phone AS contactPhone,
      c.pool_type AS poolType,
      c.status AS customerStatus,
      (
        SELECT MAX(o.created_at)
        FROM oms_order o
        WHERE o.customer_id = c.id
      ) AS lastOrderAt
    FROM crm_customer c
    LEFT JOIN uc_recipient_address r ON r.customer_id = c.id
    WHERE c.status = 'ACTIVE'
      AND (
        (? != '' AND (c.contact_phone = ? OR r.recipient_phone = ?))
        OR (? != '%%' AND (c.customer_name LIKE ? OR c.contact_name LIKE ? OR r.recipient_name LIKE ?))
      )
    GROUP BY c.id
    ORDER BY c.updated_at DESC
    LIMIT 12
  `).all(keywordPhone, keywordPhone, keywordPhone, keywordName, keywordName, keywordName, keywordName);

  const orderRows = db.prepare(`
    SELECT
      o.id,
      o.order_no AS orderNo,
      o.display_order_no AS displayOrderNo,
      o.customer_id AS customerId,
      o.customer_name AS customerName,
      o.business_line AS businessLine,
      o.order_status AS orderStatus,
      o.consignee_name AS consigneeName,
      o.consignee_phone AS consigneePhone,
      o.created_at AS createdAt,
      o.updated_at AS updatedAt,
      (
        SELECT COUNT(*)
        FROM oms_sub_order so
        WHERE so.order_id = o.id
      ) AS subOrderCount
    FROM oms_order o
    WHERE o.business_line = ?
      AND (
        (? != '' AND (o.consignee_phone = ? OR EXISTS (
          SELECT 1
          FROM oms_order_package_initial p
          WHERE p.order_id = o.id AND p.tracking_no = ?
        )))
        OR (? != '%%' AND (o.customer_name LIKE ? OR o.consignee_name LIKE ?))
      )
    ORDER BY o.updated_at DESC
    LIMIT 20
  `).all(unmatched.business_line, keywordPhone, keywordPhone, trackingNo, keywordName, keywordName, keywordName);

  success(res, {
    unmatched,
    customers: customerRows,
    orders: orderRows,
  });
});

router.post('/wms/unmatched-packages/:id/match', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const unmatched = db.prepare('SELECT * FROM wms_unmatched_package WHERE id = ?').get(req.params.id) as any;
  if (!unmatched) {
    error(res, 'unmatched package not found', 404);
    return;
  }
  if (unmatched.status !== 'PENDING') {
    error(res, `当前状态为 ${unmatched.status}，不可重复匹配`);
    return;
  }

  const requestedOrderKey = String(body.orderId || '').trim();
  const requestedSubKey = String(body.subOrderId || '').trim();
  const forceCreateSub = body.createSubOrder !== false;

  let targetSub = requestedSubKey
    ? db.prepare('SELECT * FROM oms_sub_order WHERE id = ? OR sub_order_no = ?').get(requestedSubKey, requestedSubKey) as any
    : null;
  let targetOrder = requestedOrderKey
    ? db.prepare('SELECT * FROM oms_order WHERE id = ? OR order_no = ? OR display_order_no = ?')
      .get(requestedOrderKey, requestedOrderKey, requestedOrderKey) as any
    : null;

  if (!targetOrder && targetSub) {
    targetOrder = db.prepare('SELECT * FROM oms_order WHERE id = ?').get(targetSub.order_id) as any;
  }
  if (!targetOrder) {
    error(res, 'orderId 无效，请选择目标主单');
    return;
  }
  if (targetOrder.business_line !== unmatched.business_line) {
    error(res, '待匹配包裹与目标订单业务线不一致，不能挂单');
    return;
  }
  if (targetSub && targetSub.order_id !== targetOrder.id) {
    error(res, 'subOrderId 与 orderId 不属于同一主单');
    return;
  }

  const tx = db.transaction(() => {
    const gross = Number(unmatched.gross_weight_kg || 0);
    const volumeCbm = Number(unmatched.volume_cbm || 0);
    const chargeable = targetOrder.business_line === 'AIR'
      ? Math.max(gross, volumeCbm * 167)
      : Math.max(gross, volumeCbm * 700);
    const pieces = Number(unmatched.pieces || 0);

    if (!targetSub || forceCreateSub) {
      const lineNo = nextSubOrderLine(db, targetOrder.id);
      const subId = randomToken('SUB');
      const subNo = createSubOrderNo(targetOrder.order_no || targetOrder.display_order_no || targetOrder.id, lineNo);
      db.prepare(`
        INSERT INTO oms_sub_order (
          id, sub_order_no, order_id, line_no, business_line, sub_status, sub_status_updated_at,
          route_code, service_type_code, chargeable_weight_kg, actual_weight_kg, volume_cbm,
          volume_weight_kg, pieces, remark, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, 'INBOUND', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        subId,
        subNo,
        targetOrder.id,
        lineNo,
        targetOrder.business_line,
        now,
        targetOrder.route_code,
        targetOrder.service_type_code,
        chargeable,
        gross,
        volumeCbm,
        targetOrder.business_line === 'AIR' ? volumeCbm * 167 : volumeCbm * 700,
        pieces,
        toCleanText(body.remark) || '待匹配池挂单生成子单',
        now,
        now
      );
      targetSub = db.prepare('SELECT * FROM oms_sub_order WHERE id = ?').get(subId) as any;
    } else {
      db.prepare(`
        UPDATE oms_sub_order
        SET sub_status = 'INBOUND',
            sub_status_updated_at = ?,
            pieces = COALESCE(pieces, 0) + ?,
            actual_weight_kg = COALESCE(actual_weight_kg, 0) + ?,
            volume_cbm = COALESCE(volume_cbm, 0) + ?,
            chargeable_weight_kg = COALESCE(chargeable_weight_kg, 0) + ?,
            updated_at = ?
        WHERE id = ?
      `).run(now, pieces, gross, volumeCbm, chargeable, now, targetSub.id);
      targetSub = db.prepare('SELECT * FROM oms_sub_order WHERE id = ?').get(targetSub.id) as any;
    }

    const initialPkg = unmatched.tracking_no
      ? db.prepare(`
        SELECT *
        FROM oms_order_package_initial
        WHERE order_id = ? AND tracking_no = ?
        LIMIT 1
      `).get(targetOrder.id, unmatched.tracking_no) as any
      : null;

    const actualPackageId = randomToken('APKG');
    db.prepare(`
      INSERT INTO oms_order_package_actual (
        id, order_id, sub_order_id, initial_package_id, tracking_no, goods_name, cargo_desc,
        pieces, gross_weight_kg, volume_cbm, volume_weight_kg, chargeable_weight_kg,
        package_status, package_status_updated_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'GENERAL', ?, ?, ?, ?, ?, 'IN_STOCK', ?, ?, ?)
    `).run(
      actualPackageId,
      targetOrder.id,
      targetSub.id,
      initialPkg?.id || null,
      unmatched.tracking_no || null,
      '待匹配包裹',
      pieces,
      gross,
      volumeCbm,
      targetOrder.business_line === 'AIR' ? volumeCbm * 167 : volumeCbm * 700,
      chargeable,
      now,
      now,
      now
    );

    if (initialPkg?.id) {
      db.prepare(`
        UPDATE oms_order_package_initial
        SET package_status = 'INBOUND', package_status_updated_at = ?, updated_at = ?
        WHERE id = ?
      `).run(now, now, initialPkg.id);
    }

    db.prepare(`
      UPDATE wms_inbound_item
      SET order_id = ?,
          sub_order_id = ?,
          package_actual_id = ?,
          item_status = 'COMPLETED',
          matched_order_id = ?,
          matched_sub_order_id = ?,
          matched_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      targetOrder.id,
      targetSub.id,
      actualPackageId,
      targetOrder.id,
      targetSub.id,
      now,
      now,
      unmatched.inbound_item_id
    );

    db.prepare(`
      UPDATE wms_unmatched_package
      SET status = 'MATCHED',
          matched_order_id = ?,
          matched_sub_order_id = ?,
          match_method = ?,
          match_note = ?,
          matched_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      targetOrder.id,
      targetSub.id,
      toCleanText(body.matchMethod) || 'MANUAL',
      toCleanText(body.remark),
      now,
      now,
      unmatched.id
    );

    db.prepare(`
      UPDATE oms_order
      SET total_actual_weight_kg = COALESCE(total_actual_weight_kg, 0) + ?,
          total_actual_pieces = COALESCE(total_actual_pieces, 0) + ?,
          total_chargeable_weight_kg = COALESCE(total_chargeable_weight_kg, 0) + ?,
          updated_at = ?
      WHERE id = ?
    `).run(gross, pieces, chargeable, now, targetOrder.id);

    db.prepare(`
      INSERT INTO oms_order_status_log (
        id, order_id, sub_order_id, status_code, node_code, node_name,
        event_time, operator_user_id, remark, created_at
      )
      VALUES (?, ?, ?, 'INBOUND', 'NO_ORDER_MATCH', '待匹配池挂单入库', ?, ?, ?, ?)
    `).run(
      randomToken('OSL'),
      targetOrder.id,
      targetSub.id,
      now,
      toCleanText(body.operatorUserId),
      `待匹配包裹 ${unmatched.tracking_no || unmatched.id} 已挂单`,
      now
    );

    refreshOrderStatusByOrderId(db, targetOrder.id, now);
  });

  tx();

  const updated = db.prepare(`
    SELECT
      u.*,
      o.order_no AS matchedOrderNo,
      o.display_order_no AS matchedDisplayOrderNo,
      so.sub_order_no AS matchedSubOrderNo
    FROM wms_unmatched_package u
    LEFT JOIN oms_order o ON o.id = u.matched_order_id
    LEFT JOIN oms_sub_order so ON so.id = u.matched_sub_order_id
    WHERE u.id = ?
  `).get(req.params.id);

  success(res, updated);
});

router.put('/wms/unmatched-packages/:id', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const current = db.prepare('SELECT * FROM wms_unmatched_package WHERE id = ?').get(req.params.id) as any;
  if (!current) {
    error(res, 'unmatched package not found', 404);
    return;
  }

  const sets: string[] = [];
  const params: any[] = [];
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const pickValue = (camel: string, snake?: string) => {
    if (hasOwn(camel)) return body[camel];
    if (snake && hasOwn(snake)) return body[snake];
    return undefined;
  };

  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = String(body.status || '').trim().toUpperCase();
    if (!['PENDING', 'MATCHED', 'CLOSED'].includes(status)) {
      error(res, 'status 参数不合法，仅支持 PENDING/MATCHED/CLOSED');
      return;
    }
    sets.push('status = ?');
    params.push(status);
    if (status === 'CLOSED') {
      sets.push('matched_at = COALESCE(matched_at, ?)');
      params.push(now);
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'matchNote')) {
    sets.push('match_note = ?');
    params.push(toCleanText(body.matchNote));
  }
  if (Object.prototype.hasOwnProperty.call(body, 'matchMethod')) {
    sets.push('match_method = ?');
    params.push(toCleanText(body.matchMethod));
  }

  const trackingNo = pickValue('trackingNo', 'tracking_no');
  const expressCompany = pickValue('expressCompany', 'express_company');
  const senderName = pickValue('senderName', 'sender_name');
  const senderPhone = pickValue('senderPhone', 'sender_phone');
  const consigneeName = pickValue('consigneeName', 'consignee_name');
  const consigneePhone = pickValue('consigneePhone', 'consignee_phone');
  const customerHint = pickValue('customerHint', 'customer_hint');
  const pieces = pickValue('pieces');
  const grossWeightKg = pickValue('grossWeightKg', 'gross_weight_kg');
  const volumeCbm = pickValue('volumeCbm', 'volume_cbm');

  const hasEditFields = [
    trackingNo,
    expressCompany,
    senderName,
    senderPhone,
    consigneeName,
    consigneePhone,
    customerHint,
    pieces,
    grossWeightKg,
    volumeCbm,
  ].some((value) => value !== undefined);

  if (hasEditFields && current.status === 'MATCHED') {
    error(res, '已匹配记录不允许编辑基础字段，请先解除关联', 400);
    return;
  }

  if (trackingNo !== undefined) {
    sets.push('tracking_no = ?');
    params.push(toCleanText(trackingNo));
  }
  if (expressCompany !== undefined) {
    sets.push('express_company = ?');
    params.push(toCleanText(expressCompany));
  }
  if (senderName !== undefined) {
    sets.push('sender_name = ?');
    params.push(toCleanText(senderName));
  }
  if (senderPhone !== undefined) {
    sets.push('sender_phone = ?');
    params.push(toCleanText(senderPhone));
  }
  if (consigneeName !== undefined) {
    sets.push('consignee_name = ?');
    params.push(toCleanText(consigneeName));
  }
  if (consigneePhone !== undefined) {
    sets.push('consignee_phone = ?');
    params.push(toCleanText(consigneePhone));
  }
  if (customerHint !== undefined) {
    sets.push('customer_hint = ?');
    params.push(toCleanText(customerHint));
  }
  if (pieces !== undefined) {
    const parsedPieces = Number(pieces);
    if (!Number.isFinite(parsedPieces) || parsedPieces < 0) {
      error(res, 'pieces 参数不合法');
      return;
    }
    sets.push('pieces = ?');
    params.push(Math.round(parsedPieces));
  }
  if (grossWeightKg !== undefined) {
    const parsedWeight = Number(grossWeightKg);
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
      error(res, 'grossWeightKg 参数不合法');
      return;
    }
    sets.push('gross_weight_kg = ?');
    params.push(parsedWeight);
  }
  if (volumeCbm !== undefined) {
    const parsedVolume = Number(volumeCbm);
    if (!Number.isFinite(parsedVolume) || parsedVolume < 0) {
      error(res, 'volumeCbm 参数不合法');
      return;
    }
    sets.push('volume_cbm = ?');
    params.push(parsedVolume);
  }

  if (sets.length === 0) {
    success(res, current);
    return;
  }

  sets.push('updated_at = ?');
  params.push(now, req.params.id);
  db.prepare(`UPDATE wms_unmatched_package SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM wms_unmatched_package WHERE id = ?').get(req.params.id);
  success(res, updated);
});

router.delete('/wms/unmatched-packages/:id', (req, res) => {
  const db = getV2Db();
  const current = db.prepare('SELECT * FROM wms_unmatched_package WHERE id = ?').get(req.params.id) as any;
  if (!current) {
    error(res, 'unmatched package not found', 404);
    return;
  }

  if (current.status === 'MATCHED') {
    error(res, '已匹配记录不允许删除，请先解除关联', 400);
    return;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM wms_unmatched_package WHERE id = ?').run(req.params.id);
    db.prepare(`
      UPDATE wms_inbound_item
      SET item_status = 'ABNORMAL',
          updated_at = ?
      WHERE id = ?
    `).run(nowIso(), current.inbound_item_id);
  });
  tx();

  success(res, null, '待匹配包裹已删除');
});

// ======================================================
// TMS
// ======================================================

router.post('/tms/jobs', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const businessLine: Line = parseLine(body.businessLine);
  const jobId = randomToken('JOB');
  const jobNo = createJobNo(db, 'tms_job', 'job_no', businessLine, now);

  db.prepare(`
    INSERT INTO tms_job (
      id, job_no, business_line, pol_site_id, pod_site_id, carrier_supplier_id,
      vessel_voyage, flight_no, bill_no, current_phase, job_status,
      etd, eta, atd, ata, remark, created_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ORIGIN', 'PLANNED', ?, ?, NULL, NULL, ?, ?, ?, ?)
  `).run(
    jobId,
    jobNo,
    businessLine,
    body.polSiteId || null,
    body.podSiteId || null,
    body.carrierSupplierId || null,
    body.vesselVoyage || null,
    body.flightNo || null,
    body.billNo || null,
    body.etd || null,
    body.eta || null,
    body.remark || null,
    body.createdBy || null,
    now,
    now
  );

  success(res, db.prepare('SELECT * FROM tms_job WHERE id = ?').get(jobId));
});

router.post('/tms/jobs/:id/bind-sub-orders', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const job = db.prepare('SELECT * FROM tms_job WHERE id = ? OR job_no = ?').get(req.params.id, req.params.id) as any;
  if (!job) {
    error(res, 'job not found', 404);
    return;
  }

  const subOrderIds = Array.isArray(body.subOrderIds) ? body.subOrderIds.map(String).filter(Boolean) : [];
  if (subOrderIds.length === 0) {
    error(res, 'subOrderIds is required');
    return;
  }

  let shippingUnitId: string | null = null;
  if (body.shippingUnitNo) {
    const existing = db.prepare('SELECT id FROM tms_shipping_unit WHERE unit_no = ?').get(String(body.shippingUnitNo)) as any;
    if (existing) {
      shippingUnitId = existing.id;
      db.prepare(`
        UPDATE tms_shipping_unit
        SET job_id = ?, unit_status = 'LOADING', updated_at = ?
        WHERE id = ?
      `).run(job.id, now, shippingUnitId);
    } else {
      shippingUnitId = randomToken('UNIT');
      db.prepare(`
        INSERT INTO tms_shipping_unit (
          id, unit_no, business_line, unit_type, container_type, seal_no, warehouse_id, job_id,
          unit_status, max_weight_kg, max_volume_cbm, current_weight_kg, current_volume_cbm, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'LOADING', ?, ?, 0, 0, ?, ?)
      `).run(
        shippingUnitId,
        String(body.shippingUnitNo),
        job.business_line,
        body.unitType || 'CONTAINER',
        body.containerType || null,
        body.sealNo || null,
        body.warehouseId || null,
        job.id,
        body.maxWeightKg || null,
        body.maxVolumeCbm || null,
        now,
        now
      );
    }
  }

  const tx = db.transaction(() => {
    const insertRel = db.prepare(`
      INSERT OR IGNORE INTO tms_job_order_rel (id, job_id, sub_order_id, shipping_unit_id, sequence_no, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    subOrderIds.forEach((id: string, idx: number) => {
      const sub = db.prepare('SELECT * FROM oms_sub_order WHERE id = ? OR sub_order_no = ?').get(id, id) as any;
      if (!sub) return;

      insertRel.run(randomToken('JREL'), job.id, sub.id, shippingUnitId, idx + 1, now);
      db.prepare(`
        UPDATE oms_sub_order
        SET job_id = ?, shipping_unit_id = ?, sub_status = 'PENDING_DEPARTURE', sub_status_updated_at = ?, updated_at = ?
        WHERE id = ?
      `).run(job.id, shippingUnitId, now, now, sub.id);

      db.prepare(`
        INSERT INTO oms_order_status_log (
          id, order_id, sub_order_id, status_code, node_code, node_name, event_time, operator_user_id, remark, created_at
        )
        VALUES (?, ?, ?, 'PENDING_DEPARTURE', 'JOB_BIND', '绑定任务', ?, ?, ?, ?)
      `).run(
        randomToken('OSL'),
        sub.order_id,
        sub.id,
        now,
        body.operatorUserId || null,
        `绑定任务 ${job.job_no}`,
        now
      );

      refreshOrderStatusByOrderId(db, sub.order_id, now);
    });
  });

  tx();
  success(res, { jobId: job.id, shippingUnitId, boundCount: subOrderIds.length });
});

router.post('/tms/tracking-events', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const eventId = randomToken('EVT');
  const eventScope = String(body.eventScope || 'ORDER');
  const orderId = body.orderId ? String(body.orderId) : null;
  const subOrderId = body.subOrderId ? String(body.subOrderId) : null;
  const jobId = body.jobId ? String(body.jobId) : null;
  const dpnId = body.dpnId ? String(body.dpnId) : null;
  const statusCode = String(body.statusCode || 'IN_TRANSIT');
  const eventTime = body.eventTime ? String(body.eventTime) : now;

  db.prepare(`
    INSERT INTO tms_tracking_event (
      id, business_line, event_scope, order_id, sub_order_id, job_id, dpn_id, event_type,
      node_code, node_name, status_code, event_time, location, operator_user_id, remark, extra_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId,
    parseLine(body.businessLine),
    eventScope,
    orderId,
    subOrderId,
    jobId,
    dpnId,
    body.eventType || 'WAREHOUSE',
    body.nodeCode || null,
    body.nodeName || null,
    statusCode,
    eventTime,
    body.location || null,
    body.operatorUserId || null,
    body.remark || null,
    body.extraJson ? JSON.stringify(body.extraJson) : null,
    now
  );

  if (subOrderId) {
    const sub = db.prepare('SELECT * FROM oms_sub_order WHERE id = ?').get(subOrderId) as any;
    if (sub) {
      const validSubStatuses = new Set([
        'PENDING_INBOUND', 'INBOUND', 'PENDING_PACKING', 'PACKED', 'PENDING_DEPARTURE',
        'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'ARRIVED', 'PENDING_DELIVERY', 'DELIVERING',
        'DELIVERED', 'EXCEPTION', 'RETURN_APPLIED', 'CANCELLED',
      ]);
      if (validSubStatuses.has(statusCode)) {
        db.prepare('UPDATE oms_sub_order SET sub_status = ?, sub_status_updated_at = ?, updated_at = ? WHERE id = ?')
          .run(statusCode, eventTime, now, sub.id);
      }
      refreshOrderStatusByOrderId(db, sub.order_id, now);
    }
  }

  if (orderId) {
    const validOrderStatuses = new Set([
      'PENDING_INBOUND', 'INBOUND', 'PENDING_DEPARTURE', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED',
      'PARTIAL_DELIVERED', 'COMPLETED', 'EXCEPTION', 'RETURN_APPLIED', 'CANCELLED',
    ]);
    if (validOrderStatuses.has(statusCode)) {
      db.prepare('UPDATE oms_order SET order_status = ?, order_status_updated_at = ?, updated_at = ? WHERE id = ?')
        .run(statusCode, eventTime, now, orderId);
    }
  }

  if (jobId) {
    const validJobStatuses = new Set([
      'PLANNED', 'IN_PROGRESS', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED', 'CLEARED', 'COMPLETED', 'CANCELLED',
    ]);
    if (validJobStatuses.has(statusCode)) {
      db.prepare('UPDATE tms_job SET job_status = ?, updated_at = ? WHERE id = ?').run(statusCode, now, jobId);
    }
  }

  success(res, db.prepare('SELECT * FROM tms_tracking_event WHERE id = ?').get(eventId));
});

// ======================================================
// POD / Delivery
// ======================================================

router.get('/pod/dpns', (req, res) => {
  const db = getV2Db();
  const {
    businessLine,
    warehouseId,
    customerId,
    dpnStatus,
    route,
    logisticsStatus,
    executionStatus,
    keyword,
    page = '1',
    pageSize = '20',
  } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (businessLine) {
    const line = parseLineStrict(businessLine);
    if (!line) {
      error(res, 'businessLine must be SEA or AIR');
      return;
    }
    where += ' AND d.business_line = ?';
    params.push(line);
  }
  if (warehouseId) {
    where += ' AND d.warehouse_id = ?';
    params.push(String(warehouseId));
  }
  if (customerId) {
    where += ' AND d.customer_id = ?';
    params.push(String(customerId));
  }
  if (dpnStatus) {
    where += ' AND d.dpn_status = ?';
    params.push(String(dpnStatus));
  }
  if (route) {
    const routeLike = `%${String(route).trim()}%`;
    where += `
      AND EXISTS (
        SELECT 1
        FROM pod_dpn_item di3
        LEFT JOIN oms_sub_order so3 ON so3.id = di3.sub_order_id
        LEFT JOIN tms_job_order_rel jr3 ON jr3.sub_order_id = so3.id
        LEFT JOIN tms_job j3 ON j3.id = jr3.job_id
        LEFT JOIN md_site pol3 ON pol3.id = j3.pol_site_id
        LEFT JOIN md_site pod3 ON pod3.id = j3.pod_site_id
        WHERE di3.dpn_id = d.id
          AND (
            IFNULL(pol3.name, '') LIKE ?
            OR IFNULL(pod3.name, '') LIKE ?
            OR (IFNULL(pol3.name, '') || '-' || IFNULL(pod3.name, '')) LIKE ?
          )
      )
    `;
    params.push(routeLike, routeLike, routeLike);
  }

  const logistics = String(logisticsStatus || '').trim().toUpperCase();
  if (logistics === 'INBOUND') {
    where += ` AND d.dpn_status IN ('DRAFT', 'PENDING_ASSIGN')`;
  } else if (logistics === 'TRANSIT') {
    where += ` AND d.dpn_status IN ('ASSIGNED', 'IN_TRANSIT')`;
  } else if (logistics === 'SIGNED') {
    where += ` AND d.dpn_status = 'SIGNED'`;
  } else if (logistics === 'CANCELLED') {
    where += ` AND d.dpn_status = 'CANCELLED'`;
  }

  const execution = String(executionStatus || '').trim().toUpperCase();
  if (execution === 'PENDING') {
    where += ` AND d.dpn_status IN ('DRAFT', 'PENDING_ASSIGN')`;
  } else if (execution === 'EXECUTING') {
    where += ` AND d.dpn_status IN ('ASSIGNED', 'IN_TRANSIT')`;
  } else if (execution === 'DONE') {
    where += ` AND d.dpn_status = 'SIGNED'`;
  } else if (execution === 'CANCELLED') {
    where += ` AND d.dpn_status = 'CANCELLED'`;
  }

  if (keyword) {
    where += `
      AND (
        d.dpn_no LIKE ? OR d.recipient_name LIKE ? OR d.recipient_phone LIKE ?
        OR EXISTS (
          SELECT 1
          FROM pod_dpn_item di2
          LEFT JOIN oms_sub_order so2 ON so2.id = di2.sub_order_id
          LEFT JOIN oms_order o2 ON o2.id = di2.order_id
          LEFT JOIN tms_job_order_rel jr2 ON jr2.sub_order_id = so2.id
          LEFT JOIN tms_job j2 ON j2.id = jr2.job_id
          LEFT JOIN md_site pol2 ON pol2.id = j2.pol_site_id
          LEFT JOIN md_site pod2 ON pod2.id = j2.pod_site_id
          WHERE di2.dpn_id = d.id
            AND (
              so2.sub_order_no LIKE ?
              OR o2.order_no LIKE ?
              OR o2.display_order_no LIKE ?
              OR IFNULL(j2.job_no, '') LIKE ?
              OR IFNULL(pol2.name, '') LIKE ?
              OR IFNULL(pod2.name, '') LIKE ?
            )
        )
      )
    `;
    const like = `%${String(keyword)}%`;
    params.push(like, like, like, like, like, like, like, like, like);
  }

  const total = (db.prepare(`SELECT COUNT(*) AS c FROM pod_dpn d ${where}`).get(...params) as any)?.c || 0;
  const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
  const sizeNum = Math.max(parseInt(String(pageSize), 10) || 20, 1);
  const offset = (pageNum - 1) * sizeNum;

  const rows = db.prepare(`
    SELECT
      d.*,
      wh.name AS warehouse_name,
      c.customer_name,
      COUNT(DISTINCT di.id) AS item_count,
      COUNT(DISTINCT di.sub_order_id) AS sub_order_count,
      (
        SELECT t.task_no
        FROM pod_delivery_task t
        WHERE t.dpn_id = d.id
        ORDER BY datetime(t.created_at) DESC
        LIMIT 1
      ) AS latest_task_no,
      (
        SELECT t.task_status
        FROM pod_delivery_task t
        WHERE t.dpn_id = d.id
        ORDER BY datetime(t.created_at) DESC
        LIMIT 1
      ) AS latest_task_status,
      (
        SELECT GROUP_CONCAT(DISTINCT j2.job_no)
        FROM pod_dpn_item di2
        LEFT JOIN oms_sub_order so2 ON so2.id = di2.sub_order_id
        LEFT JOIN tms_job_order_rel jr2 ON jr2.sub_order_id = so2.id
        LEFT JOIN tms_job j2 ON j2.id = jr2.job_id
        WHERE di2.dpn_id = d.id
      ) AS job_nos,
      (
        SELECT GROUP_CONCAT(DISTINCT COALESCE(o2.display_order_no, o2.order_no))
        FROM pod_dpn_item di2
        LEFT JOIN oms_sub_order so2 ON so2.id = di2.sub_order_id
        LEFT JOIN oms_order o2 ON o2.id = so2.order_id
        WHERE di2.dpn_id = d.id
      ) AS order_nos,
      (
        SELECT GROUP_CONCAT(
          DISTINCT (
            IFNULL(pol2.name, '')
            || CASE WHEN pol2.name IS NOT NULL AND pod2.name IS NOT NULL THEN '-' ELSE '' END
            || IFNULL(pod2.name, '')
          )
        )
        FROM pod_dpn_item di2
        LEFT JOIN oms_sub_order so2 ON so2.id = di2.sub_order_id
        LEFT JOIN tms_job_order_rel jr2 ON jr2.sub_order_id = so2.id
        LEFT JOIN tms_job j2 ON j2.id = jr2.job_id
        LEFT JOIN md_site pol2 ON pol2.id = j2.pol_site_id
        LEFT JOIN md_site pod2 ON pod2.id = j2.pod_site_id
        WHERE di2.dpn_id = d.id
      ) AS route_names
    FROM pod_dpn d
    LEFT JOIN md_warehouse wh ON wh.id = d.warehouse_id
    LEFT JOIN crm_customer c ON c.id = d.customer_id
    LEFT JOIN pod_dpn_item di ON di.dpn_id = d.id
    ${where}
    GROUP BY d.id
    ORDER BY datetime(d.updated_at) DESC, d.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, sizeNum, offset);

  paginated(res, rows as any[], total, pageNum, sizeNum);
});

router.get('/pod/dpns/:id', (req, res) => {
  const db = getV2Db();
  const key = String(req.params.id || '').trim();
  if (!key) {
    error(res, 'dpn id is required');
    return;
  }

  const dpn = db.prepare(`
    SELECT
      d.*,
      wh.name AS warehouse_name,
      c.customer_name
    FROM pod_dpn d
    LEFT JOIN md_warehouse wh ON wh.id = d.warehouse_id
    LEFT JOIN crm_customer c ON c.id = d.customer_id
    WHERE d.id = ? OR d.dpn_no = ?
    LIMIT 1
  `).get(key, key) as any;
  if (!dpn) {
    error(res, 'dpn not found', 404);
    return;
  }

  const items = db.prepare(`
    SELECT
      i.*,
      so.sub_order_no,
      so.sub_status,
      o.order_no,
      o.display_order_no
    FROM pod_dpn_item i
    LEFT JOIN oms_sub_order so ON so.id = i.sub_order_id
    LEFT JOIN oms_order o ON o.id = i.order_id
    WHERE i.dpn_id = ?
    ORDER BY datetime(i.created_at) DESC
  `).all(dpn.id) as any[];

  const deliveryTasks = db.prepare(`
    SELECT *
    FROM pod_delivery_task
    WHERE dpn_id = ?
    ORDER BY datetime(created_at) DESC
  `).all(dpn.id) as any[];

  success(res, { dpn, items, deliveryTasks });
});

router.get('/pod/delivery-tasks', (req, res) => {
  const db = getV2Db();
  const {
    businessLine,
    warehouseId,
    taskStatus,
    dpnStatus,
    keyword,
    page = '1',
    pageSize = '20',
  } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (businessLine) {
    const line = parseLineStrict(businessLine);
    if (!line) {
      error(res, 'businessLine must be SEA or AIR');
      return;
    }
    where += ' AND d.business_line = ?';
    params.push(line);
  }
  if (warehouseId) {
    where += ' AND d.warehouse_id = ?';
    params.push(String(warehouseId));
  }
  if (taskStatus) {
    where += ' AND t.task_status = ?';
    params.push(String(taskStatus));
  }
  if (dpnStatus) {
    where += ' AND d.dpn_status = ?';
    params.push(String(dpnStatus));
  }

  if (keyword) {
    where += `
      AND (
        t.task_no LIKE ?
        OR d.dpn_no LIKE ?
        OR d.recipient_name LIKE ?
        OR d.recipient_phone LIKE ?
        OR IFNULL(t.driver_name, '') LIKE ?
        OR IFNULL(t.driver_phone, '') LIKE ?
        OR EXISTS (
          SELECT 1
          FROM pod_dpn_item di2
          LEFT JOIN oms_sub_order so2 ON so2.id = di2.sub_order_id
          LEFT JOIN oms_order o2 ON o2.id = di2.order_id
          WHERE di2.dpn_id = d.id
            AND (
              so2.sub_order_no LIKE ?
              OR o2.order_no LIKE ?
              OR o2.display_order_no LIKE ?
            )
        )
      )
    `;
    const like = `%${String(keyword)}%`;
    params.push(like, like, like, like, like, like, like, like, like);
  }

  const total = (db.prepare(`
    SELECT COUNT(*) AS c
    FROM pod_delivery_task t
    JOIN pod_dpn d ON d.id = t.dpn_id
    ${where}
  `).get(...params) as any)?.c || 0;

  const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
  const sizeNum = Math.max(parseInt(String(pageSize), 10) || 20, 1);
  const offset = (pageNum - 1) * sizeNum;

  const rows = db.prepare(`
    SELECT
      t.*,
      d.dpn_no,
      d.dpn_status,
      d.business_line,
      d.warehouse_id,
      d.recipient_name,
      d.recipient_phone,
      d.recipient_address,
      d.total_pieces,
      d.total_weight_kg,
      wh.name AS warehouse_name,
      (
        SELECT COUNT(*)
        FROM pod_dpn_item di
        WHERE di.dpn_id = d.id
      ) AS item_count,
      (
        SELECT COUNT(*)
        FROM pod_dpn_item di
        WHERE di.dpn_id = d.id AND di.sub_order_id IS NOT NULL
      ) AS sub_order_count
    FROM pod_delivery_task t
    JOIN pod_dpn d ON d.id = t.dpn_id
    LEFT JOIN md_warehouse wh ON wh.id = d.warehouse_id
    ${where}
    ORDER BY datetime(t.updated_at) DESC, t.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, sizeNum, offset);

  paginated(res, rows as any[], total, pageNum, sizeNum);
});

router.get('/pod/dpn-candidates', (req, res) => {
  const db = getV2Db();
  const {
    businessLine,
    customerId,
    keyword,
    page = '1',
    pageSize = '20',
  } = req.query;

  let where = `
    WHERE so.sub_status IN ('ARRIVED', 'PENDING_DELIVERY')
      AND NOT EXISTS (
        SELECT 1
        FROM pod_dpn_item di
        JOIN pod_dpn d ON d.id = di.dpn_id
        WHERE di.sub_order_id = so.id
          AND d.dpn_status <> 'CANCELLED'
      )
  `;
  const params: any[] = [];

  if (businessLine) {
    const line = parseLineStrict(businessLine);
    if (!line) {
      error(res, 'businessLine must be SEA or AIR');
      return;
    }
    where += ' AND so.business_line = ? AND o.business_line = ?';
    params.push(line, line);
  }
  if (customerId) {
    where += ' AND o.customer_id = ?';
    params.push(String(customerId));
  }
  if (keyword) {
    const kw = `%${String(keyword).trim()}%`;
    where += `
      AND (
        so.sub_order_no LIKE ?
        OR o.order_no LIKE ?
        OR IFNULL(o.display_order_no, '') LIKE ?
        OR IFNULL(c.customer_name, '') LIKE ?
      )
    `;
    params.push(kw, kw, kw, kw);
  }

  const total = (db.prepare(`
    SELECT COUNT(*) AS c
    FROM oms_sub_order so
    JOIN oms_order o ON o.id = so.order_id
    LEFT JOIN crm_customer c ON c.id = o.customer_id
    ${where}
  `).get(...params) as any)?.c || 0;

  const pageNum = Math.max(parseInt(String(page), 10) || 1, 1);
  const sizeNum = Math.max(parseInt(String(pageSize), 10) || 20, 1);
  const offset = (pageNum - 1) * sizeNum;

  const rows = db.prepare(`
    SELECT
      so.id AS sub_order_id,
      so.sub_order_no,
      so.sub_status,
      so.line_no,
      so.pieces,
      so.actual_weight_kg,
      so.updated_at,
      so.created_at,
      so.order_id,
      so.business_line,
      o.order_no,
      o.display_order_no,
      o.customer_id,
      c.customer_code,
      c.customer_name
    FROM oms_sub_order so
    JOIN oms_order o ON o.id = so.order_id
    LEFT JOIN crm_customer c ON c.id = o.customer_id
    ${where}
    ORDER BY datetime(so.updated_at) DESC, datetime(so.created_at) DESC, so.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, sizeNum, offset);

  paginated(res, rows as any[], total, pageNum, sizeNum);
});

router.post('/pod/dpns', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const subOrderIdsRaw: string[] = Array.isArray(body.subOrderIds) ? body.subOrderIds.map(String).filter(Boolean) : [];
  if (subOrderIdsRaw.length === 0) {
    error(res, 'subOrderIds is required');
    return;
  }
  const subOrderIds: string[] = Array.from(new Set(subOrderIdsRaw));
  if (subOrderIds.length !== subOrderIdsRaw.length) {
    error(res, 'subOrderIds contains duplicated values');
    return;
  }

  const customerId = String(body.customerId || '').trim();
  const warehouseId = String(body.warehouseId || '').trim();
  if (!customerId || !warehouseId) {
    error(res, 'customerId and warehouseId are required');
    return;
  }

  const businessLine = parseLineStrict(body.businessLine);
  if (!businessLine) {
    error(res, 'businessLine must be SEA or AIR');
    return;
  }

  const dpnId = randomToken('DPN');
  const dpnNo = createUniqueNo(db, 'pod_dpn', 'dpn_no', 'DPN');

  const placeholders = subOrderIds.map(() => '?').join(',');
  const subs = db.prepare(`
    SELECT
      so.id,
      so.sub_order_no,
      so.order_id,
      so.business_line,
      so.sub_status,
      so.pieces,
      so.actual_weight_kg,
      o.customer_id AS order_customer_id,
      o.business_line AS order_business_line
    FROM oms_sub_order so
    JOIN oms_order o ON o.id = so.order_id
    WHERE so.id IN (${placeholders})
  `).all(...subOrderIds) as any[];
  if (subs.length !== subOrderIds.length) {
    const foundIds = new Set<string>(subs.map((s) => String(s.id)));
    const missing = subOrderIds.filter((id) => !foundIds.has(id));
    error(res, `some sub orders not found: ${missing.join(', ')}`);
    return;
  }

  const lineMismatch = subs.filter((s) => String(s.business_line) !== businessLine || String(s.order_business_line) !== businessLine);
  if (lineMismatch.length > 0) {
    error(
      res,
      `sub orders business line mismatch: ${lineMismatch.slice(0, 5).map((s) => `${s.sub_order_no || s.id}:${s.business_line}/${s.order_business_line}`).join(', ')}`
    );
    return;
  }

  const customerMismatch = subs.filter((s) => String(s.order_customer_id) !== customerId);
  if (customerMismatch.length > 0) {
    error(
      res,
      `sub orders do not belong to customer ${customerId}: ${customerMismatch.slice(0, 5).map((s) => s.sub_order_no || s.id).join(', ')}`
    );
    return;
  }

  const bindingConflicts = db.prepare(`
    SELECT
      di.sub_order_id AS subOrderId,
      so.sub_order_no AS subOrderNo,
      d.dpn_no AS dpnNo,
      d.dpn_status AS dpnStatus
    FROM pod_dpn_item di
    JOIN pod_dpn d ON d.id = di.dpn_id
    LEFT JOIN oms_sub_order so ON so.id = di.sub_order_id
    WHERE di.sub_order_id IN (${placeholders})
      AND d.dpn_status <> 'CANCELLED'
  `).all(...subOrderIds) as any[];
  if (bindingConflicts.length > 0) {
    const detail = bindingConflicts.slice(0, 5).map((r) => `${r.subOrderNo || r.subOrderId}->${r.dpnNo}(${r.dpnStatus})`).join(', ');
    error(res, `sub orders already bound to non-cancelled DPN: ${detail}`);
    return;
  }

  const readyStatuses = new Set(['ARRIVED', 'PENDING_DELIVERY']);
  const notReadySubs = subs.filter((s) => !readyStatuses.has(String(s.sub_status || '')));
  if (notReadySubs.length > 0) {
    error(
      res,
      `sub orders are not ready for DPN: ${notReadySubs.slice(0, 5).map((s) => `${s.sub_order_no || s.id}:${s.sub_status}`).join(', ')}`
    );
    return;
  }

  const totalPieces = subs.reduce((sum, s) => sum + Number(s.pieces || 0), 0);
  const totalWeight = subs.reduce((sum, s) => sum + Number(s.actual_weight_kg || 0), 0);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO pod_dpn (
        id, dpn_no, business_line, warehouse_id, customer_id, recipient_name, recipient_phone, recipient_address,
        country_id, city_id, delivery_method, carrier_supplier_id, dpn_status, status_updated_at,
        total_pieces, total_weight_kg, total_receivable_amount, currency_code, payment_status,
        remark, created_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_ASSIGN', ?, ?, ?, ?, ?, 'UNPAID', ?, ?, ?, ?)
    `).run(
      dpnId,
      dpnNo,
      businessLine,
      warehouseId,
      customerId,
      body.recipientName || '待补全',
      body.recipientPhone || '待补全',
      body.recipientAddress || '待补全',
      body.countryId || null,
      body.cityId || null,
      body.deliveryMethod || 'DELIVERY',
      body.carrierSupplierId || null,
      now,
      totalPieces,
      totalWeight,
      Number(body.totalReceivableAmount || 0),
      body.currencyCode || 'NGN',
      body.remark || null,
      body.createdBy || null,
      now,
      now
    );

    const insertItem = db.prepare(`
      INSERT INTO pod_dpn_item (id, dpn_id, order_id, sub_order_id, stock_id, pieces, weight_kg, remark, created_at)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)
    `);

    const orderIds = new Set<string>();
    subs.forEach((s) => {
      insertItem.run(randomToken('DPNI'), dpnId, s.order_id, s.id, Number(s.pieces || 0), Number(s.actual_weight_kg || 0), null, now);
      db.prepare(`
        UPDATE oms_sub_order
        SET sub_status = 'PENDING_DELIVERY', sub_status_updated_at = ?, updated_at = ?
        WHERE id = ?
      `).run(now, now, s.id);
      orderIds.add(String(s.order_id));
    });

    orderIds.forEach((oid) => refreshOrderStatusByOrderId(db, oid, now));
  });

  tx();
  success(res, {
    dpn: db.prepare('SELECT * FROM pod_dpn WHERE id = ?').get(dpnId),
    items: db.prepare('SELECT * FROM pod_dpn_item WHERE dpn_id = ?').all(dpnId),
  });
});

router.post('/pod/dpns/draft', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const customerId = String(body.customerId || '').trim();
  const warehouseId = String(body.warehouseId || '').trim();
  if (!customerId || !warehouseId) {
    error(res, 'customerId and warehouseId are required');
    return;
  }

  const businessLine = parseLineStrict(body.businessLine);
  if (!businessLine) {
    error(res, 'businessLine must be SEA or AIR');
    return;
  }

  const dpnId = randomToken('DPN');
  const dpnNo = createUniqueNo(db, 'pod_dpn', 'dpn_no', 'DPN');

  db.prepare(`
    INSERT INTO pod_dpn (
      id, dpn_no, business_line, warehouse_id, customer_id, recipient_name, recipient_phone, recipient_address,
      country_id, city_id, delivery_method, carrier_supplier_id, dpn_status, status_updated_at,
      total_pieces, total_weight_kg, total_receivable_amount, currency_code, payment_status,
      remark, created_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, 'UNPAID', ?, ?, ?, ?)
  `).run(
    dpnId,
    dpnNo,
    businessLine,
    warehouseId,
    customerId,
    body.recipientName || '待补全',
    body.recipientPhone || '待补全',
    body.recipientAddress || '待补全',
    body.countryId || null,
    body.cityId || null,
    body.deliveryMethod || 'DELIVERY',
    body.carrierSupplierId || null,
    now,
    Number(body.totalPieces || 0),
    Number(body.totalWeightKg || 0),
    Number(body.totalReceivableAmount || 0),
    body.currencyCode || 'NGN',
    body.remark || null,
    body.createdBy || null,
    now,
    now,
  );

  success(res, {
    dpn: db.prepare('SELECT * FROM pod_dpn WHERE id = ?').get(dpnId),
    items: [],
  });
});

router.post('/pod/dpns/:id/bind-sub-orders', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const key = String(req.params.id || '').trim();

  const dpn = db.prepare('SELECT * FROM pod_dpn WHERE id = ? OR dpn_no = ?').get(key, key) as any;
  if (!dpn) {
    error(res, 'dpn not found', 404);
    return;
  }
  if (String(dpn.dpn_status) === 'SIGNED' || String(dpn.dpn_status) === 'CANCELLED') {
    error(res, `cannot bind sub orders for status=${dpn.dpn_status}`);
    return;
  }

  const subOrderIdsRaw: string[] = Array.isArray(body.subOrderIds) ? body.subOrderIds.map(String).filter(Boolean) : [];
  if (subOrderIdsRaw.length === 0) {
    error(res, 'subOrderIds is required');
    return;
  }
  const subOrderIds = Array.from(new Set(subOrderIdsRaw));
  if (subOrderIds.length !== subOrderIdsRaw.length) {
    error(res, 'subOrderIds contains duplicated values');
    return;
  }

  const placeholders = subOrderIds.map(() => '?').join(',');
  const subs = db.prepare(`
    SELECT
      so.id,
      so.sub_order_no,
      so.order_id,
      so.business_line,
      so.sub_status,
      so.pieces,
      so.actual_weight_kg,
      o.customer_id AS order_customer_id,
      o.business_line AS order_business_line
    FROM oms_sub_order so
    JOIN oms_order o ON o.id = so.order_id
    WHERE so.id IN (${placeholders})
  `).all(...subOrderIds) as any[];
  if (subs.length !== subOrderIds.length) {
    const foundIds = new Set<string>(subs.map((s) => String(s.id)));
    const missing = subOrderIds.filter((id) => !foundIds.has(id));
    error(res, `some sub orders not found: ${missing.join(', ')}`);
    return;
  }

  const lineMismatch = subs.filter((s) => String(s.business_line) !== String(dpn.business_line) || String(s.order_business_line) !== String(dpn.business_line));
  if (lineMismatch.length > 0) {
    error(
      res,
      `sub orders business line mismatch: ${lineMismatch.slice(0, 5).map((s) => `${s.sub_order_no || s.id}:${s.business_line}/${s.order_business_line}`).join(', ')}`
    );
    return;
  }

  const customerMismatch = subs.filter((s) => String(s.order_customer_id) !== String(dpn.customer_id));
  if (customerMismatch.length > 0) {
    error(
      res,
      `sub orders do not belong to customer ${dpn.customer_id}: ${customerMismatch.slice(0, 5).map((s) => s.sub_order_no || s.id).join(', ')}`
    );
    return;
  }

  const bindingConflicts = db.prepare(`
    SELECT
      di.sub_order_id AS subOrderId,
      so.sub_order_no AS subOrderNo,
      d.dpn_no AS dpnNo,
      d.dpn_status AS dpnStatus
    FROM pod_dpn_item di
    JOIN pod_dpn d ON d.id = di.dpn_id
    LEFT JOIN oms_sub_order so ON so.id = di.sub_order_id
    WHERE di.sub_order_id IN (${placeholders})
      AND d.dpn_status <> 'CANCELLED'
      AND d.id <> ?
  `).all(...subOrderIds, dpn.id) as any[];
  if (bindingConflicts.length > 0) {
    const detail = bindingConflicts.slice(0, 5).map((r) => `${r.subOrderNo || r.subOrderId}->${r.dpnNo}(${r.dpnStatus})`).join(', ');
    error(res, `sub orders already bound to non-cancelled DPN: ${detail}`);
    return;
  }

  const readyStatuses = new Set(['ARRIVED', 'PENDING_DELIVERY']);
  const notReadySubs = subs.filter((s) => !readyStatuses.has(String(s.sub_status || '')));
  if (notReadySubs.length > 0) {
    error(
      res,
      `sub orders are not ready for DPN: ${notReadySubs.slice(0, 5).map((s) => `${s.sub_order_no || s.id}:${s.sub_status}`).join(', ')}`
    );
    return;
  }

  const existingRows = db.prepare(`
    SELECT sub_order_id
    FROM pod_dpn_item
    WHERE dpn_id = ?
      AND sub_order_id IN (${placeholders})
  `).all(dpn.id, ...subOrderIds) as Array<{ sub_order_id: string }>;
  const existingSet = new Set(existingRows.map((r) => String(r.sub_order_id)));
  const toBind = subs.filter((s) => !existingSet.has(String(s.id)));
  if (toBind.length === 0) {
    success(res, {
      dpn: db.prepare('SELECT * FROM pod_dpn WHERE id = ?').get(dpn.id),
      items: db.prepare('SELECT * FROM pod_dpn_item WHERE dpn_id = ?').all(dpn.id),
      boundCount: 0,
    });
    return;
  }

  const tx = db.transaction(() => {
    const insertItem = db.prepare(`
      INSERT INTO pod_dpn_item (id, dpn_id, order_id, sub_order_id, stock_id, pieces, weight_kg, remark, created_at)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)
    `);

    const orderIds = new Set<string>();
    toBind.forEach((s) => {
      insertItem.run(randomToken('DPNI'), dpn.id, s.order_id, s.id, Number(s.pieces || 0), Number(s.actual_weight_kg || 0), null, now);
      db.prepare(`
        UPDATE oms_sub_order
        SET sub_status = 'PENDING_DELIVERY', sub_status_updated_at = ?, updated_at = ?
        WHERE id = ?
      `).run(now, now, s.id);
      orderIds.add(String(s.order_id));
    });

    const agg = db.prepare(`
      SELECT
        COALESCE(SUM(pieces), 0) AS totalPieces,
        COALESCE(SUM(weight_kg), 0) AS totalWeight
      FROM pod_dpn_item
      WHERE dpn_id = ?
    `).get(dpn.id) as any;

    const nextStatus = String(dpn.dpn_status) === 'DRAFT' ? 'PENDING_ASSIGN' : String(dpn.dpn_status || 'PENDING_ASSIGN');
    db.prepare(`
      UPDATE pod_dpn
      SET total_pieces = ?,
          total_weight_kg = ?,
          dpn_status = ?,
          status_updated_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(Number(agg?.totalPieces || 0), Number(agg?.totalWeight || 0), nextStatus, now, now, dpn.id);

    orderIds.forEach((oid) => refreshOrderStatusByOrderId(db, oid, now));
  });
  tx();

  success(res, {
    dpn: db.prepare('SELECT * FROM pod_dpn WHERE id = ?').get(dpn.id),
    items: db.prepare('SELECT * FROM pod_dpn_item WHERE dpn_id = ?').all(dpn.id),
    boundCount: toBind.length,
  });
});

router.post('/pod/delivery-tasks', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const dpnId = String(body.dpnId || '').trim();
  if (!dpnId) {
    error(res, 'dpnId is required');
    return;
  }

  const dpn = db.prepare('SELECT * FROM pod_dpn WHERE id = ? OR dpn_no = ?').get(dpnId, dpnId) as any;
  if (!dpn) {
    error(res, 'dpn not found', 404);
    return;
  }

  if (String(dpn.dpn_status) !== 'PENDING_ASSIGN') {
    error(res, `dpn status must be PENDING_ASSIGN before assign, current=${dpn.dpn_status}`);
    return;
  }

  const activeTask = db.prepare(`
    SELECT id, task_no, task_status
    FROM pod_delivery_task
    WHERE dpn_id = ?
      AND task_status NOT IN ('FAILED', 'CANCELLED', 'SIGNED')
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).get(dpn.id) as any;
  if (activeTask) {
    error(res, `dpn already has active task: ${activeTask.task_no}(${activeTask.task_status})`);
    return;
  }

  const taskId = randomToken('DTK');
  const taskNo = createLineScopedNo(db, 'pod_delivery_task', 'task_no', 'DTK', parseLine(dpn.business_line), now);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO pod_delivery_task (
        id, dpn_id, task_no, driver_user_id, driver_name, driver_phone, task_status,
        accepted_at, outbound_at, delivered_at, signed_at, sign_proof_json, remark, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'ACCEPTED', ?, NULL, NULL, NULL, NULL, ?, ?, ?)
    `).run(
      taskId,
      dpn.id,
      taskNo,
      body.driverUserId || null,
      body.driverName || null,
      body.driverPhone || null,
      now,
      body.remark || null,
      now,
      now
    );

    db.prepare('UPDATE pod_dpn SET dpn_status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?')
      .run('ASSIGNED', now, now, dpn.id);

    const items = db.prepare('SELECT sub_order_id, order_id FROM pod_dpn_item WHERE dpn_id = ?').all(dpn.id) as any[];
    const orderIds = new Set<string>();
    items.forEach((it) => {
      if (it.sub_order_id) {
        db.prepare(`
          UPDATE oms_sub_order
          SET sub_status = 'DELIVERING', sub_status_updated_at = ?, updated_at = ?
          WHERE id = ?
        `).run(now, now, it.sub_order_id);
      }
      if (it.order_id) orderIds.add(String(it.order_id));
    });
    orderIds.forEach((oid) => refreshOrderStatusByOrderId(db, oid, now));
  });

  tx();

  success(res, db.prepare('SELECT * FROM pod_delivery_task WHERE id = ?').get(taskId));
});

router.post('/pod/delivery-tasks/:id/sign', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const task = db.prepare('SELECT * FROM pod_delivery_task WHERE id = ? OR task_no = ?').get(req.params.id, req.params.id) as any;
  if (!task) {
    error(res, 'delivery task not found', 404);
    return;
  }

  if (task.task_status === 'SIGNED') {
    success(res, task);
    return;
  }
  if (task.task_status === 'FAILED' || task.task_status === 'CANCELLED') {
    error(res, `cannot sign task in status ${task.task_status}`);
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE pod_delivery_task
      SET task_status = 'SIGNED',
          delivered_at = COALESCE(delivered_at, ?),
          signed_at = ?,
          sign_proof_json = ?,
          updated_at = ?
      WHERE id = ?
    `).run(now, now, body.signProof ? JSON.stringify(body.signProof) : null, now, task.id);

    db.prepare('UPDATE pod_dpn SET dpn_status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?')
      .run('SIGNED', now, now, task.dpn_id);

    const items = db.prepare('SELECT sub_order_id, order_id FROM pod_dpn_item WHERE dpn_id = ?').all(task.dpn_id) as any[];
    const orderIds = new Set<string>();
    items.forEach((it) => {
      if (it.sub_order_id) {
        db.prepare(`
          UPDATE oms_sub_order
          SET sub_status = 'DELIVERED', sub_status_updated_at = ?, updated_at = ?
          WHERE id = ?
        `).run(now, now, it.sub_order_id);
      }
      if (it.order_id) orderIds.add(String(it.order_id));
    });
    orderIds.forEach((oid) => refreshOrderStatusByOrderId(db, oid, now));
  });

  tx();
  success(res, db.prepare('SELECT * FROM pod_delivery_task WHERE id = ?').get(task.id));
});

router.post('/pod/delivery-tasks/:id/fail', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const task = db.prepare('SELECT * FROM pod_delivery_task WHERE id = ? OR task_no = ?').get(req.params.id, req.params.id) as any;
  if (!task) {
    error(res, 'delivery task not found', 404);
    return;
  }

  if (task.task_status === 'FAILED') {
    success(res, task);
    return;
  }
  if (task.task_status === 'SIGNED' || task.task_status === 'CANCELLED') {
    error(res, `cannot fail task in status ${task.task_status}`);
    return;
  }

  const failReason = String(body.reason || body.remark || 'DELIVERY_FAILED').trim();
  const nextRemark = [task.remark, `FAILED:${failReason}`].filter(Boolean).join(' | ');

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE pod_delivery_task
      SET task_status = 'FAILED',
          remark = ?,
          updated_at = ?
      WHERE id = ?
    `).run(nextRemark || null, now, task.id);

    db.prepare('UPDATE pod_dpn SET dpn_status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?')
      .run('IN_TRANSIT', now, now, task.dpn_id);

    const items = db.prepare('SELECT sub_order_id, order_id FROM pod_dpn_item WHERE dpn_id = ?').all(task.dpn_id) as any[];
    const orderIds = new Set<string>();
    items.forEach((it) => {
      if (it.sub_order_id) {
        db.prepare(`
          UPDATE oms_sub_order
          SET sub_status = 'EXCEPTION', sub_status_updated_at = ?, updated_at = ?
          WHERE id = ?
        `).run(now, now, it.sub_order_id);
      }
      if (it.order_id) orderIds.add(String(it.order_id));
    });
    orderIds.forEach((oid) => refreshOrderStatusByOrderId(db, oid, now));
  });

  tx();
  success(res, db.prepare('SELECT * FROM pod_delivery_task WHERE id = ?').get(task.id));
});

router.post('/pod/dpns/:id/return-to-warehouse', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const dpn = db.prepare('SELECT * FROM pod_dpn WHERE id = ? OR dpn_no = ?').get(req.params.id, req.params.id) as any;
  if (!dpn) {
    error(res, 'dpn not found', 404);
    return;
  }

  if (dpn.dpn_status === 'SIGNED') {
    error(res, 'signed dpn cannot return to warehouse');
    return;
  }
  if (dpn.dpn_status === 'CANCELLED') {
    success(res, {
      dpn,
      items: db.prepare('SELECT * FROM pod_dpn_item WHERE dpn_id = ?').all(dpn.id),
    });
    return;
  }

  const failedTask = db.prepare(`
    SELECT id, task_no
    FROM pod_delivery_task
    WHERE dpn_id = ?
      AND task_status = 'FAILED'
    ORDER BY datetime(updated_at) DESC
    LIMIT 1
  `).get(dpn.id) as any;
  if (!failedTask) {
    error(res, 'return to warehouse requires at least one FAILED delivery task');
    return;
  }

  const remark = [dpn.remark, body.remark || `RETURNED_AFTER_FAIL:${failedTask.task_no || failedTask.id}`]
    .filter(Boolean)
    .join(' | ');

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE pod_dpn
      SET dpn_status = 'CANCELLED',
          status_updated_at = ?,
          remark = ?,
          updated_at = ?
      WHERE id = ?
    `).run(now, remark || null, now, dpn.id);

    const items = db.prepare('SELECT sub_order_id, order_id FROM pod_dpn_item WHERE dpn_id = ?').all(dpn.id) as any[];
    const orderIds = new Set<string>();
    items.forEach((it) => {
      if (it.sub_order_id) {
        db.prepare(`
          UPDATE oms_sub_order
          SET sub_status = 'ARRIVED', sub_status_updated_at = ?, updated_at = ?
          WHERE id = ?
        `).run(now, now, it.sub_order_id);
      }
      if (it.order_id) orderIds.add(String(it.order_id));
    });
    orderIds.forEach((oid) => refreshOrderStatusByOrderId(db, oid, now));
  });

  tx();
  success(res, {
    dpn: db.prepare('SELECT * FROM pod_dpn WHERE id = ?').get(dpn.id),
    items: db.prepare('SELECT * FROM pod_dpn_item WHERE dpn_id = ?').all(dpn.id),
  });
});

// ======================================================
// Finance + Workflow
// ======================================================

router.post('/finance/fees', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const feeLevel = String(body.feeLevel || '').trim();
  const relatedId = String(body.relatedId || '').trim();
  const feeItemCode = String(body.feeItemCode || '').trim();
  const feeDirection = String(body.feeDirection || '').trim();
  if (!feeLevel || !relatedId || !feeItemCode || !feeDirection) {
    error(res, 'feeLevel, relatedId, feeItemCode, feeDirection are required');
    return;
  }

  const unitPrice = Number(body.unitPrice || 0);
  const quantity = Number(body.quantity || 0);
  const amount = Number((unitPrice * quantity).toFixed(2));

  const feeId = randomToken('FEE');
  const feeNo = createUniqueNo(db, 'fin_fee', 'fee_no', 'FEE');
  db.prepare(`
    INSERT INTO fin_fee (
      id, fee_no, business_line, fee_level, related_id, related_no, fee_item_code, fee_direction,
      unit_price, quantity, amount, currency_code, fx_rate_to_cny,
      counterparty_type, counterparty_id, counterparty_name, fee_status,
      description, voucher_url, created_by, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)
  `).run(
    feeId,
    feeNo,
    parseLine(body.businessLine),
    feeLevel,
    relatedId,
    body.relatedNo || null,
    feeItemCode,
    feeDirection === 'PAYABLE' ? 'PAYABLE' : 'RECEIVABLE',
    unitPrice,
    quantity,
    amount,
    body.currencyCode || 'CNY',
    body.fxRateToCny || null,
    body.counterpartyType || null,
    body.counterpartyId || null,
    body.counterpartyName || null,
    body.description || null,
    body.voucherUrl || null,
    body.createdBy || null,
    now,
    now
  );

  if (feeLevel === 'ORDER' && feeDirection === 'RECEIVABLE') {
    db.prepare(`
      UPDATE oms_order
      SET total_receivable_amount = COALESCE(total_receivable_amount, 0) + ?, updated_at = ?
      WHERE id = ?
    `).run(amount, now, relatedId);
    refreshOrderPaymentByOrderId(db, relatedId, now);
  }

  success(res, db.prepare('SELECT * FROM fin_fee WHERE id = ?').get(feeId));
});

router.post('/workflow/instances', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const businessType = String(body.businessType || '').trim();
  const businessId = String(body.businessId || '').trim();
  if (!businessType || !businessId) {
    error(res, 'businessType and businessId are required');
    return;
  }

  const instanceId = randomToken('WFI');
  db.prepare(`
    INSERT INTO wf_instance (
      id, process_code, business_line, business_type, business_id, instance_status,
      current_node_code, initiator_user_id, started_at, ended_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, 'RUNNING', ?, ?, ?, NULL, ?)
  `).run(
    instanceId,
    body.processCode || 'DEFAULT',
    parseLine(body.businessLine),
    businessType,
    businessId,
    body.nodeCode || 'NODE_1',
    body.initiatorUserId || null,
    now,
    now
  );

  const taskId = randomToken('WFT');
  db.prepare(`
    INSERT INTO wf_task (
      id, instance_id, node_code, node_name, assignee_user_id, task_status, action, action_comment, action_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'PENDING', NULL, NULL, NULL, ?, ?)
  `).run(
    taskId,
    instanceId,
    body.nodeCode || 'NODE_1',
    body.nodeName || '审批节点',
    body.assigneeUserId || null,
    now,
    now
  );

  if (businessType === 'FEE') {
    db.prepare('UPDATE fin_fee SET fee_status = ?, updated_at = ? WHERE id = ?')
      .run('PENDING_APPROVAL', now, businessId);
  }

  success(res, {
    instance: db.prepare('SELECT * FROM wf_instance WHERE id = ?').get(instanceId),
    task: db.prepare('SELECT * FROM wf_task WHERE id = ?').get(taskId),
  });
});

router.post('/workflow/tasks/:id/action', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};
  const action = String(body.action || '').toUpperCase();
  if (!['APPROVE', 'REJECT'].includes(action)) {
    error(res, 'action must be APPROVE or REJECT');
    return;
  }

  const task = db.prepare('SELECT * FROM wf_task WHERE id = ?').get(req.params.id) as any;
  if (!task) {
    error(res, 'task not found', 404);
    return;
  }
  const instance = db.prepare('SELECT * FROM wf_instance WHERE id = ?').get(task.instance_id) as any;
  if (!instance) {
    error(res, 'instance not found', 404);
    return;
  }

  const taskStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const instanceStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE wf_task
      SET task_status = ?, action = ?, action_comment = ?, action_at = ?, updated_at = ?
      WHERE id = ?
    `).run(taskStatus, action, body.comment || null, now, now, task.id);

    db.prepare(`
      UPDATE wf_instance
      SET instance_status = ?, ended_at = ?, updated_at = ?
      WHERE id = ?
    `).run(instanceStatus, now, now, instance.id);

    if (instance.business_type === 'FEE') {
      db.prepare('UPDATE fin_fee SET fee_status = ?, updated_at = ? WHERE id = ?')
        .run(action === 'APPROVE' ? 'APPROVED' : 'REJECTED', now, instance.business_id);
    }
  });

  tx();

  success(res, {
    task: db.prepare('SELECT * FROM wf_task WHERE id = ?').get(task.id),
    instance: db.prepare('SELECT * FROM wf_instance WHERE id = ?').get(instance.id),
  });
});

router.post('/finance/payments/confirm', (req, res) => {
  const db = getV2Db();
  const now = nowIso();
  const body = req.body || {};

  const feeId = String(body.feeId || '').trim();
  if (!feeId) {
    error(res, 'feeId is required');
    return;
  }

  const fee = db.prepare('SELECT * FROM fin_fee WHERE id = ?').get(feeId) as any;
  if (!fee) {
    error(res, 'fee not found', 404);
    return;
  }

  const amount = Number(body.amount || fee.amount || 0);
  if (amount <= 0) {
    error(res, 'amount must be > 0');
    return;
  }

  const paymentId = randomToken('PAY');
  const paymentNo = createUniqueNo(db, 'fin_payment', 'payment_no', 'PAY');
  db.prepare(`
    INSERT INTO fin_payment (
      id, payment_no, business_line, payment_type, related_fee_id, related_id,
      counterparty_type, counterparty_id, counterparty_name, amount, currency_code, fx_rate,
      payment_method, payment_channel, payment_account, voucher_url,
      payment_status, payment_time, confirmed_by, confirmed_at, remark, created_at, updated_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      'CONFIRMED', ?, ?, ?, ?, ?, ?
    )
  `).run(
    paymentId,
    paymentNo,
    fee.business_line,
    fee.fee_direction === 'PAYABLE' ? 'OUTBOUND' : 'INBOUND',
    fee.id,
    fee.related_id,
    fee.counterparty_type || null,
    fee.counterparty_id || null,
    fee.counterparty_name || null,
    amount,
    body.currencyCode || fee.currency_code || 'CNY',
    body.fxRate || fee.fx_rate_to_cny || null,
    body.paymentMethod || 'BANK',
    body.paymentChannel || null,
    body.paymentAccount || null,
    body.voucherUrl || null,
    now,
    body.confirmedBy || null,
    now,
    body.remark || null,
    now,
    now
  );

  const paid = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM fin_payment
    WHERE related_fee_id = ? AND payment_status = 'CONFIRMED'
  `).get(fee.id) as any).total as number;

  const feeStatus = paid >= Number(fee.amount || 0) ? 'PAID' : 'PARTIAL_PAID';
  db.prepare('UPDATE fin_fee SET fee_status = ?, updated_at = ? WHERE id = ?').run(feeStatus, now, fee.id);

  if (fee.fee_level === 'ORDER' && fee.fee_direction === 'RECEIVABLE') {
    db.prepare(`
      UPDATE oms_order
      SET total_paid_amount = COALESCE(total_paid_amount, 0) + ?,
          payment_time = ?,
          updated_at = ?
      WHERE id = ?
    `).run(amount, now, now, fee.related_id);
    refreshOrderPaymentByOrderId(db, String(fee.related_id), now);
  }

  success(res, {
    payment: db.prepare('SELECT * FROM fin_payment WHERE id = ?').get(paymentId),
    fee: db.prepare('SELECT * FROM fin_fee WHERE id = ?').get(fee.id),
  });
});

export default router;
