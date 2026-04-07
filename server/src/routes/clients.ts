import { Router } from 'express';
import { getDb } from '../database/connection';
import { success, error, paginated } from '../utils/response';
import { generateId } from '../utils/idGenerator';

const router = Router();

const CLIENT_SHORT_CODE_SCOPE = 'CLIENT_SHORT_CODE';
const CLIENT_SHORT_CODE_PREFIX = '';
const CLIENT_SHORT_CODE_LENGTH = 4;
const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CLIENT_SHORT_CODE_REGEX = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{4}$/;
const CLIENT_STATUSES = new Set(['ACTIVE', 'DORMANT', 'FROZEN']);
const CLIENT_POOLS = new Set(['PRIVATE', 'PUBLIC']);
const EDITABLE_FIELDS = new Set([
  'shortCode', 'name', 'country', 'address', 'industry', 'contact', 'logisticsInfo', 'enterpriseInfo',
  'status', 'source', 'remark', 'companyType', 'creditLevel'
]);

function normalizeClientShortCode(value: string): string {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function validateShortCode(value: string): boolean {
  return CLIENT_SHORT_CODE_REGEX.test(value);
}

function parseJsonSafely(raw: any, fallback: any) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseClientRow(row: any) {
  if (!row) return row;
  return {
    ...row,
    contact: parseJsonSafely(row.contact, {}),
    logisticsInfo: parseJsonSafely(row.logisticsInfo, null),
    enterpriseInfo: parseJsonSafely(row.enterpriseInfo, null)
  };
}

function parseContact(contact: any, required: boolean) {
  const parsed = parseJsonSafely(contact, null);
  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: !required,
      errorMessage: required ? 'contact 必须为对象，且包含 name 与 phone' : ''
    };
  }
  const name = String(parsed.name || '').trim();
  const phone = String(parsed.phone || '').trim();
  const email = String(parsed.email || '').trim();

  if (required && (!name || !phone)) {
    return { ok: false, errorMessage: 'contact.name 与 contact.phone 为必填' };
  }

  return {
    ok: true,
    value: JSON.stringify({
      name,
      phone,
      email: email || undefined
    })
  };
}

function parseLogisticsInfo(logisticsInfo: any) {
  if (logisticsInfo === undefined) {
    return { shouldUpdate: false };
  }
  if (logisticsInfo === null || logisticsInfo === '') {
    return { shouldUpdate: true, value: null as string | null };
  }
  const parsed = parseJsonSafely(logisticsInfo, null);
  if (!parsed || typeof parsed !== 'object') {
    return { shouldUpdate: true, value: null as string | null };
  }
  return { shouldUpdate: true, value: JSON.stringify(parsed) };
}

function parseEnterpriseInfo(enterpriseInfo: any) {
  if (enterpriseInfo === undefined) {
    return { shouldUpdate: false };
  }
  if (enterpriseInfo === null || enterpriseInfo === '') {
    return { shouldUpdate: true, value: null as string | null };
  }
  const parsed = parseJsonSafely(enterpriseInfo, null);
  if (!parsed || typeof parsed !== 'object') {
    return { shouldUpdate: true, value: null as string | null };
  }
  return { shouldUpdate: true, value: JSON.stringify(parsed) };
}

function normalizeEnum(value: any, allowed: Set<string>) {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (!allowed.has(normalized)) return null;
  return normalized;
}

function normalizeNullableText(value: any): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeRequiredText(value: any): string {
  return String(value ?? '').trim();
}

function toPositiveInt(value: any, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function encodeShortCode(num: number): string {
  let value = Math.max(0, Math.floor(num));
  const base = SHORT_CODE_ALPHABET.length;
  let encoded = '';

  do {
    encoded = SHORT_CODE_ALPHABET[value % base] + encoded;
    value = Math.floor(value / base);
  } while (value > 0);

  return encoded.padStart(CLIENT_SHORT_CODE_LENGTH, 'A').slice(-CLIENT_SHORT_CODE_LENGTH);
}

function ensureSequenceTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS code_sequences (
      scope TEXT PRIMARY KEY,
      lastValue INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL
    )
  `);
}

function ensureClientPoolLogsTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_pool_logs (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK(action IN ('CLAIM','RELEASE','TRANSFER','AUTO_RELEASE')),
      fromPoolType TEXT CHECK(fromPoolType IN ('PRIVATE','PUBLIC')),
      toPoolType TEXT CHECK(toPoolType IN ('PRIVATE','PUBLIC')),
      fromSalesId TEXT,
      toSalesId TEXT,
      operatorId TEXT,
      operatorName TEXT,
      reason TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cpl_customer ON client_pool_logs(customerId);
    CREATE INDEX IF NOT EXISTS idx_cpl_time ON client_pool_logs(createdAt);
  `);
}

function nextClientShortCode(db: any): string {
  const now = new Date().toISOString();
  ensureSequenceTable(db);

  db.prepare(`
    INSERT OR IGNORE INTO code_sequences (scope, lastValue, updatedAt)
    VALUES (?, 0, ?)
  `).run(CLIENT_SHORT_CODE_SCOPE, now);

  db.prepare(`
    UPDATE code_sequences
    SET lastValue = lastValue + 1, updatedAt = ?
    WHERE scope = ?
  `).run(now, CLIENT_SHORT_CODE_SCOPE);

  const row = db.prepare('SELECT lastValue FROM code_sequences WHERE scope = ?').get(CLIENT_SHORT_CODE_SCOPE) as any;
  const seq = Number(row?.lastValue || 0);
  return `${CLIENT_SHORT_CODE_PREFIX}${encodeShortCode(seq)}`;
}

function generateUniqueClientShortCode(db: any): string {
  for (let i = 0; i < 2000; i++) {
    let candidate = '';
    for (let j = 0; j < CLIENT_SHORT_CODE_LENGTH; j++) {
      const index = Math.floor(Math.random() * SHORT_CODE_ALPHABET.length);
      candidate += SHORT_CODE_ALPHABET[index];
    }
    if (!validateShortCode(candidate)) continue;
    const exists = db.prepare('SELECT 1 FROM clients WHERE shortCode = ? LIMIT 1').get(candidate);
    if (!exists) {
      return candidate;
    }
  }
  throw new Error('客户编号生成失败，请重试');
}

type SalesValidationResult = { ok: true } | { ok: false; message: string };

function validateSalesUser(db: any, salesId: string): SalesValidationResult {
  const row = db.prepare('SELECT id, status FROM users WHERE id = ?').get(salesId) as any;
  if (!row) return { ok: false, message: '业务员不存在' };
  if (row.status && row.status !== 'ACTIVE') return { ok: false, message: '业务员账号非激活状态' };
  return { ok: true };
}

function insertPoolLog(db: any, payload: {
  customerId: string;
  action: 'CLAIM' | 'RELEASE' | 'TRANSFER' | 'AUTO_RELEASE';
  fromPoolType?: 'PRIVATE' | 'PUBLIC';
  toPoolType?: 'PRIVATE' | 'PUBLIC';
  fromSalesId?: string | null;
  toSalesId?: string | null;
  operatorId?: string | null;
  operatorName?: string | null;
  reason?: string | null;
}) {
  ensureClientPoolLogsTable(db);
  db.prepare(`
    INSERT INTO client_pool_logs (
      id, customerId, action, fromPoolType, toPoolType,
      fromSalesId, toSalesId, operatorId, operatorName, reason, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateId('CPL'),
    payload.customerId,
    payload.action,
    payload.fromPoolType || null,
    payload.toPoolType || null,
    payload.fromSalesId || null,
    payload.toSalesId || null,
    payload.operatorId || null,
    payload.operatorName || null,
    payload.reason || null,
    new Date().toISOString()
  );
}

// GET /api/clients
router.get('/', (req, res) => {
  const db = getDb();
  const pageNum = toPositiveInt(req.query.page, 1, 1, 1000000);
  const sizeNum = toPositiveInt(req.query.pageSize, 50, 1, 200);
  const {
    poolType,
    status,
    salesId,
    keyword
  } = req.query;

  const normalizedPoolType = normalizeEnum(poolType, CLIENT_POOLS);
  const normalizedStatus = normalizeEnum(status, CLIENT_STATUSES);
  if (normalizedPoolType === null) {
    error(res, 'poolType 参数不合法，仅支持 PRIVATE/PUBLIC');
    return;
  }
  if (normalizedStatus === null) {
    error(res, 'status 参数不合法，仅支持 ACTIVE/DORMANT/FROZEN');
    return;
  }

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (normalizedPoolType) { where += ' AND poolType = ?'; params.push(normalizedPoolType); }
  if (normalizedStatus) { where += ' AND status = ?'; params.push(normalizedStatus); }
  if (salesId) { where += ' AND salesId = ?'; params.push(String(salesId)); }
  if (keyword) {
    where += ' AND (name LIKE ? OR shortCode LIKE ? OR country LIKE ? OR contact LIKE ?)';
    const kw = `%${String(keyword).trim()}%`;
    params.push(kw, kw, kw, kw);
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM clients ${where}`).get(...params) as any).c;
  const offset = (pageNum - 1) * sizeNum;
  const rows = db.prepare(`SELECT * FROM clients ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
    .all(...params, sizeNum, offset);

  const data = (rows as any[]).map(parseClientRow);
  paginated(res, data, total, pageNum, sizeNum);
});

// GET /api/clients/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id) as any;
  if (!row) { error(res, 'Client not found', 404); return; }
  success(res, parseClientRow(row));
});

// GET /api/clients/:id/pool-logs
router.get('/:id/pool-logs', (req, res) => {
  const db = getDb();
  ensureClientPoolLogsTable(db);
  const exists = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id) as any;
  if (!exists) { error(res, 'Client not found', 404); return; }
  const rows = db.prepare('SELECT * FROM client_pool_logs WHERE customerId = ? ORDER BY createdAt DESC').all(req.params.id);
  success(res, rows);
});

// POST /api/clients
router.post('/', (req, res) => {
  const db = getDb();
  const id = generateId('CLT');
  const now = new Date().toISOString();
  const {
    shortCode,
    name,
    country,
    address,
    industry,
    contact,
    logisticsInfo,
    enterpriseInfo,
    status,
    poolType,
    salesId,
    source,
    remark,
    companyType,
    creditLevel
  } = req.body || {};

  const normalizedName = normalizeRequiredText(name);
  const normalizedCountry = normalizeRequiredText(country);
  if (!normalizedName || !normalizedCountry || !contact) {
    error(res, '缺少必填字段：name、country、contact');
    return;
  }

  const contactParsed = parseContact(contact, true);
  if (!contactParsed.ok) {
    error(res, contactParsed.errorMessage || '联系人信息不合法');
    return;
  }

  const normalizedStatus = normalizeEnum(status, CLIENT_STATUSES);
  const normalizedPoolType = normalizeEnum(poolType, CLIENT_POOLS);
  if (normalizedStatus === null) {
    error(res, 'status 参数不合法，仅支持 ACTIVE/DORMANT/FROZEN');
    return;
  }
  if (normalizedPoolType === null) {
    error(res, 'poolType 参数不合法，仅支持 PRIVATE/PUBLIC');
    return;
  }

  if (salesId) {
    const salesCheck = validateSalesUser(db, String(salesId));
    if (!salesCheck.ok) {
      error(res, salesCheck.message || '业务员校验失败');
      return;
    }
  }

  const actualPoolType = normalizedPoolType || 'PUBLIC';
  if (actualPoolType === 'PRIVATE' && !salesId) {
    error(res, '私海客户必须绑定业务员 salesId');
    return;
  }
  if (actualPoolType === 'PUBLIC' && salesId) {
    error(res, '公海客户不允许直接绑定业务员，请先认领');
    return;
  }

  const providedShortCode = normalizeClientShortCode(shortCode || '');
  let actualShortCode = providedShortCode;
  if (actualShortCode && !validateShortCode(actualShortCode)) {
    error(res, '客户编号格式不合法，仅支持4位字母+数字组合（如 A1B2）');
    return;
  }

  if (!actualShortCode) {
    actualShortCode = generateUniqueClientShortCode(db);
  } else {
    const duplicate = db.prepare('SELECT id FROM clients WHERE shortCode = ?').get(actualShortCode) as any;
    if (duplicate) {
      error(res, `客户编号 ${actualShortCode} 已存在，请更换`);
      return;
    }
  }

  const logisticsParsed = parseLogisticsInfo(logisticsInfo);
  const logisticsValue = logisticsParsed.shouldUpdate ? logisticsParsed.value : null;
  const enterpriseParsed = parseEnterpriseInfo(enterpriseInfo);
  const enterpriseValue = enterpriseParsed.shouldUpdate ? enterpriseParsed.value : null;
  const enterPoolTime = actualPoolType === 'PUBLIC' ? now : null;

  try {
    db.prepare(`
      INSERT INTO clients (
        id, shortCode, name, country, address, industry, contact, logisticsInfo, enterpriseInfo,
        status, poolType, salesId, source, remark, companyType, creditLevel, enterPoolTime, createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      actualShortCode,
      normalizedName,
      normalizedCountry,
      normalizeNullableText(address),
      normalizeNullableText(industry),
      contactParsed.value,
      logisticsValue,
      enterpriseValue,
      normalizedStatus || 'ACTIVE',
      actualPoolType,
      salesId || null,
      normalizeNullableText(source),
      normalizeNullableText(remark),
      normalizeNullableText(companyType),
      normalizeNullableText(creditLevel),
      enterPoolTime,
      now
    );
  } catch (err: any) {
    const message = String(err?.message || '');
    if (message.includes('UNIQUE constraint failed: clients.shortCode')) {
      error(res, `客户编号 ${actualShortCode} 已存在，请重试`);
      return;
    }
    throw err;
  }

  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
  success(res, parseClientRow(row));
});

// PUT /api/clients/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id) as any;
  if (!existing) { error(res, 'Client not found', 404); return; }

  const fields = req.body || {};
  if ('poolType' in fields || 'salesId' in fields) {
    error(res, 'poolType/salesId 变更请使用认领、释放或转移接口');
    return;
  }
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (!EDITABLE_FIELDS.has(key)) continue;

    if (key === 'shortCode') {
      const normalized = normalizeClientShortCode(String(value || ''));
      if (!normalized) {
        error(res, '客户编号不能为空');
        return;
      }
      if (!validateShortCode(normalized)) {
        error(res, '客户编号格式不合法，仅支持4位字母+数字组合（如 A1B2）');
        return;
      }
      const duplicate = db.prepare('SELECT id FROM clients WHERE shortCode = ? AND id != ?').get(normalized, req.params.id) as any;
      if (duplicate) {
        error(res, `客户编号 ${normalized} 已存在，请更换`);
        return;
      }
      sets.push('shortCode = ?');
      params.push(normalized);
      continue;
    }

    if (key === 'status') {
      const normalized = normalizeEnum(value, CLIENT_STATUSES);
      if (normalized === null) {
        error(res, 'status 参数不合法，仅支持 ACTIVE/DORMANT/FROZEN');
        return;
      }
      if (normalized) {
        sets.push('status = ?');
        params.push(normalized);
      }
      continue;
    }

    if (key === 'contact') {
      const parsed = parseContact(value, true);
      if (!parsed.ok) {
        error(res, parsed.errorMessage || '联系人信息不合法');
        return;
      }
      sets.push('contact = ?');
      params.push(parsed.value);
      continue;
    }

    if (key === 'logisticsInfo') {
      const parsed = parseLogisticsInfo(value);
      if (parsed.shouldUpdate) {
        sets.push('logisticsInfo = ?');
        params.push(parsed.value ?? null);
      }
      continue;
    }

    if (key === 'enterpriseInfo') {
      const parsed = parseEnterpriseInfo(value);
      if (parsed.shouldUpdate) {
        sets.push('enterpriseInfo = ?');
        params.push(parsed.value ?? null);
      }
      continue;
    }

    if (key === 'name' || key === 'country') {
      const normalized = normalizeRequiredText(value);
      if (!normalized) {
        error(res, `${key} 不能为空`);
        return;
      }
      sets.push(`${key} = ?`);
      params.push(normalized);
      continue;
    }

    sets.push(`${key} = ?`);
    if (typeof value === 'string') {
      params.push(normalizeNullableText(value));
    } else {
      params.push(value ?? null);
    }
  }

  if (sets.length === 0) {
    error(res, '没有可更新字段');
    return;
  }
  params.push(req.params.id);
  db.prepare(`UPDATE clients SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id) as any;
  success(res, parseClientRow(row));
});

// DELETE /api/clients/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id) as any;
  if (!client) {
    error(res, 'Client not found', 404);
    return;
  }

  const orderCount = (db.prepare('SELECT COUNT(*) as c FROM master_orders WHERE customerId = ?').get(req.params.id) as any).c || 0;
  if (orderCount > 0) {
    error(res, `该客户已有 ${orderCount} 条订单，不能删除。请改为冻结状态。`);
    return;
  }

  const result = db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    error(res, 'Client not found', 404);
    return;
  }
  success(res, null, 'Client deleted');
});

// POST /api/clients/:id/claim
router.post('/:id/claim', (req, res) => {
  const db = getDb();
  const { salesId, operatorId, operatorName } = req.body || {};
  const normalizedSalesId = normalizeRequiredText(salesId);
  if (!normalizedSalesId) {
    error(res, 'salesId is required');
    return;
  }
  const salesCheck = validateSalesUser(db, normalizedSalesId);
  if (!salesCheck.ok) {
    error(res, salesCheck.message || '业务员校验失败');
    return;
  }

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id) as any;
  if (!client) { error(res, 'Client not found', 404); return; }
  if (client.poolType !== 'PUBLIC') { error(res, 'Client is not in public pool'); return; }

  const tx = db.transaction(() => {
    db.prepare('UPDATE clients SET poolType = ?, salesId = ?, enterPoolTime = NULL WHERE id = ?')
      .run('PRIVATE', normalizedSalesId, req.params.id);

    insertPoolLog(db, {
      customerId: req.params.id,
      action: 'CLAIM',
      fromPoolType: 'PUBLIC',
      toPoolType: 'PRIVATE',
      fromSalesId: client.salesId || null,
      toSalesId: normalizedSalesId,
      operatorId: normalizeNullableText(operatorId) || normalizedSalesId,
      operatorName: normalizeNullableText(operatorName),
      reason: null
    });
  });
  tx();

  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id) as any;
  success(res, parseClientRow(row));
});

// POST /api/clients/:id/release
router.post('/:id/release', (req, res) => {
  const db = getDb();
  const { reason, operatorId, operatorName } = req.body || {};

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id) as any;
  if (!client) { error(res, 'Client not found', 404); return; }
  if (client.poolType !== 'PRIVATE') { error(res, 'Client is not in private pool'); return; }

  const now = new Date().toISOString();
  const salesUser = client.salesId ? db.prepare('SELECT realName FROM users WHERE id = ?').get(client.salesId) as any : null;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE clients
      SET poolType = ?, salesId = NULL, formerSalesName = ?, returnReason = ?, enterPoolTime = ?
      WHERE id = ?
    `).run('PUBLIC', salesUser?.realName || null, normalizeNullableText(reason), now, req.params.id);

    insertPoolLog(db, {
      customerId: req.params.id,
      action: 'RELEASE',
      fromPoolType: 'PRIVATE',
      toPoolType: 'PUBLIC',
      fromSalesId: client.salesId || null,
      toSalesId: null,
      operatorId: normalizeNullableText(operatorId) || client.salesId || null,
      operatorName: normalizeNullableText(operatorName) || salesUser?.realName || null,
      reason: normalizeNullableText(reason)
    });
  });
  tx();

  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id) as any;
  success(res, parseClientRow(row));
});

export default router;
