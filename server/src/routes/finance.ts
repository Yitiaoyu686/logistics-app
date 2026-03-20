import { Router } from 'express';
import { getDb } from '../database/connection';
import { success, error } from '../utils/response';
import { generateId } from '../utils/idGenerator';

const router = Router();
const ALLOWED_RELATED_TYPES = new Set(['ORDER', 'JOB', 'UNIT', 'TRANSFER', 'DPN']);
const COMMISSION_PLAN_TYPES = new Set([
  'PLAN_A_ABCD',
  'PLAN_B_SEA_VETERAN',
  'PLAN_C_NIGERIA_SEA',
  'PLAN_D_NIGERIA_AIR',
]);
const COMMISSION_OFFICES = new Set(['GUANGZHOU', 'NIGERIA']);
const COMMISSION_BIZ_TYPES = new Set(['AIR', 'SEA', 'BOTH']);
const COMMISSION_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

function generateFeeNo() {
  return `FEE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
}

function normalizeRelatedType(raw: any): string {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'CONTAINER' || value === 'SHIPPING_UNIT') return 'UNIT';
  if (value === 'DELIVERY') return 'DPN';
  return value;
}

function resolveFeeRelation(db: any, relatedTypeRaw: any, relatedIdRaw: any, relatedNoRaw: any) {
  const relatedType = normalizeRelatedType(relatedTypeRaw);
  if (!ALLOWED_RELATED_TYPES.has(relatedType)) {
    return { ok: false, message: 'Invalid relatedType, expected ORDER/JOB/UNIT/TRANSFER/DPN' };
  }

  const candidateSet = new Set<string>();
  for (const raw of [relatedIdRaw, relatedNoRaw]) {
    const v = String(raw || '').trim();
    if (v) candidateSet.add(v);
  }
  const candidates = Array.from(candidateSet);
  if (!candidates.length) {
    return { ok: false, message: 'relatedId or relatedNo is required' };
  }

  const findOrder = () => {
    for (const key of candidates) {
      const master = db.prepare('SELECT id, orderNo FROM master_orders WHERE id = ? OR orderNo = ? LIMIT 1').get(key, key) as any;
      if (master) return { relatedType, relatedId: master.id, relatedNo: master.orderNo };

      const sub = db.prepare('SELECT id, subOrderNo FROM sub_orders WHERE id = ? OR subOrderNo = ? LIMIT 1').get(key, key) as any;
      if (sub) return { relatedType, relatedId: sub.id, relatedNo: sub.subOrderNo };
    }
    return null;
  };

  const findJob = () => {
    for (const key of candidates) {
      const row = db.prepare('SELECT jobNo FROM jobs WHERE jobNo = ? LIMIT 1').get(key) as any;
      if (row) return { relatedType, relatedId: row.jobNo, relatedNo: row.jobNo };
    }
    return null;
  };

  const findUnit = () => {
    for (const key of candidates) {
      const row = db.prepare('SELECT id, unitNo FROM shipping_units WHERE id = ? OR unitNo = ? LIMIT 1').get(key, key) as any;
      if (row) return { relatedType, relatedId: row.id, relatedNo: row.unitNo };
    }
    return null;
  };

  const findTransfer = () => {
    for (const key of candidates) {
      const row = db.prepare('SELECT id, transferNo FROM transfer_orders WHERE id = ? OR transferNo = ? LIMIT 1').get(key, key) as any;
      if (row) return { relatedType, relatedId: row.id, relatedNo: row.transferNo };
    }
    return null;
  };

  const findDpn = () => {
    for (const key of candidates) {
      const row = db.prepare('SELECT id, dpnNo FROM delivery_orders WHERE id = ? OR dpnNo = ? LIMIT 1').get(key, key) as any;
      if (row) return { relatedType, relatedId: row.id, relatedNo: row.dpnNo };
    }
    return null;
  };

  const resolved =
    relatedType === 'ORDER' ? findOrder() :
    relatedType === 'JOB' ? findJob() :
    relatedType === 'UNIT' ? findUnit() :
    relatedType === 'TRANSFER' ? findTransfer() :
    findDpn();

  if (!resolved) {
    return { ok: false, message: `Related ${relatedType} not found in database` };
  }
  return { ok: true, data: resolved };
}

function hasActiveFee(db: any, relatedType: string, relatedId: string) {
  const row = db.prepare(`
    SELECT id
    FROM fee_records
    WHERE relatedType = ? AND relatedId = ? AND status != 'CANCELLED'
    LIMIT 1
  `).get(relatedType, relatedId) as any;
  return !!row;
}

function insertAutoFee(db: any, payload: {
  relatedType: 'ORDER' | 'UNIT' | 'JOB';
  relatedId: string;
  relatedNo: string;
  feeType: string;
  feeDirection: 'PAYABLE' | 'RECEIVABLE';
  amount: number;
  currency?: string;
  customerId?: string | null;
  customerName?: string | null;
  description: string;
  createdBy: string;
}) {
  const now = new Date().toISOString();
  const id = generateId('FEE');
  const feeNo = generateFeeNo();
  db.prepare(`
    INSERT INTO fee_records (
      id, feeNo, relatedType, relatedId, relatedNo, feeType, feeDirection, amount, currency, exchangeRate, status,
      supplierId, supplierName, customerId, customerName, description, remark, createdBy, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1.0, 'PENDING', NULL, NULL, ?, ?, ?, 'AUTO_GENERATED', ?, ?, ?)
  `).run(
    id, feeNo, payload.relatedType, payload.relatedId, payload.relatedNo, payload.feeType, payload.feeDirection, payload.amount,
    payload.currency || 'CNY',
    payload.customerId || null, payload.customerName || null, payload.description,
    payload.createdBy, now, now
  );
}

function parseJsonSafe(raw: any, fallback: any) {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch (_) {
    return fallback;
  }
}

function ensureCommissionTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_commission_rules (
      id TEXT PRIMARY KEY,
      planType TEXT NOT NULL,
      planName TEXT NOT NULL,
      office TEXT NOT NULL CHECK(office IN ('GUANGZHOU','NIGERIA')),
      businessType TEXT NOT NULL CHECK(businessType IN ('AIR','SEA','BOTH')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      configJson TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_finance_commission_rules_status
      ON finance_commission_rules(status);

    CREATE TABLE IF NOT EXISTS finance_commission_bonus (
      id TEXT PRIMARY KEY,
      triggerWeightKg REAL NOT NULL,
      bonusAmount REAL NOT NULL,
      minPersonalWeightKg REAL NOT NULL,
      minQualifiedCount INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  const count = db.prepare('SELECT COUNT(*) AS c FROM finance_commission_rules').get() as any;
  if (Number(count?.c || 0) === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO finance_commission_rules
      (id, planType, planName, office, businessType, status, configJson, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      'CP-001',
      'PLAN_A_ABCD',
      '广州主方案ABCD（空运双指标互锁）',
      'GUANGZHOU',
      'AIR',
      'ACTIVE',
      JSON.stringify({
        baseTickets: 50,
        salaryMultiplier: 3,
        tiers: [
          { level: 'A', pricePerTicket: 30, profitRate: 0.1 },
          { level: 'B', pricePerTicket: 40, profitRate: 0.12 },
          { level: 'C', pricePerTicket: 50, profitRate: 0.15 },
          { level: 'D', pricePerTicket: 60, profitRate: 0.18 },
        ],
      }),
      now,
      now
    );

    insert.run(
      'CP-002',
      'PLAN_B_SEA_VETERAN',
      '海运老员工方案（广州毛利百分比）',
      'GUANGZHOU',
      'SEA',
      'ACTIVE',
      JSON.stringify({
        baseTask: 6000,
        tierBreakpoint: 35000,
        lowerRate: 0.4,
        upperRate: 0.5,
      }),
      now,
      now
    );

    insert.run(
      'CP-003',
      'PLAN_C_NIGERIA_SEA',
      '尼日利亚海运方案（体积阶梯NGN）',
      'NIGERIA',
      'SEA',
      'ACTIVE',
      JSON.stringify({
        baseTaskCBM: 30,
        tiers: [
          { threshold: 0, unitPrice: 1000 },
          { threshold: 100, unitPrice: 1200 },
          { threshold: 300, unitPrice: 1500 },
        ],
      }),
      now,
      now
    );

    insert.run(
      'CP-004',
      'PLAN_D_NIGERIA_AIR',
      '尼日利亚空运方案（重量阶梯NGN）',
      'NIGERIA',
      'AIR',
      'ACTIVE',
      JSON.stringify({
        baseTaskKg: 1000,
        tiers: [
          { threshold: 0, unitPrice: 2 },
          { threshold: 2000, unitPrice: 3 },
          { threshold: 5000, unitPrice: 4 },
        ],
      }),
      now,
      now
    );
  }

  const bonus = db.prepare('SELECT id FROM finance_commission_bonus WHERE id = ?').get('BONUS_DEFAULT') as any;
  if (!bonus) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO finance_commission_bonus
      (id, triggerWeightKg, bonusAmount, minPersonalWeightKg, minQualifiedCount, createdAt, updatedAt)
      VALUES ('BONUS_DEFAULT', ?, ?, ?, ?, ?, ?)
    `).run(50000, 3000, 3000, 2, now, now);
  }
}

function normalizeCommissionRuleRow(row: any) {
  return {
    ...row,
    config: parseJsonSafe(row?.configJson, null),
  };
}

// ==================== COMMISSION RULES ====================

// GET /api/finance/commission/rules
router.get('/finance/commission/rules', (req, res) => {
  const db = getDb();
  ensureCommissionTables(db);

  const { status, office, planType } = req.query;
  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status) {
    const statusValue = String(status).trim().toUpperCase();
    if (!COMMISSION_STATUSES.has(statusValue)) {
      error(res, 'Invalid status');
      return;
    }
    where += ' AND status = ?';
    params.push(statusValue);
  }

  if (office) {
    const officeValue = String(office).trim().toUpperCase();
    if (!COMMISSION_OFFICES.has(officeValue)) {
      error(res, 'Invalid office');
      return;
    }
    where += ' AND office = ?';
    params.push(officeValue);
  }

  if (planType) {
    const planTypeValue = String(planType).trim().toUpperCase();
    if (!COMMISSION_PLAN_TYPES.has(planTypeValue)) {
      error(res, 'Invalid planType');
      return;
    }
    where += ' AND planType = ?';
    params.push(planTypeValue);
  }

  const rows = db.prepare(`
    SELECT *
    FROM finance_commission_rules
    ${where}
    ORDER BY datetime(updatedAt) DESC
  `).all(...params) as any[];
  success(res, rows.map(normalizeCommissionRuleRow));
});

// POST /api/finance/commission/rules
router.post('/finance/commission/rules', (req, res) => {
  const db = getDb();
  ensureCommissionTables(db);

  const payload = req.body || {};
  const planType = String(payload.planType || '').trim().toUpperCase();
  const planName = String(payload.planName || '').trim();
  const office = String(payload.office || '').trim().toUpperCase();
  const businessType = String(payload.businessType || '').trim().toUpperCase();
  const status = String(payload.status || 'ACTIVE').trim().toUpperCase();
  const config = payload.config === undefined ? null : payload.config;

  if (!COMMISSION_PLAN_TYPES.has(planType)) {
    error(res, 'Invalid planType');
    return;
  }
  if (!planName) {
    error(res, 'planName is required');
    return;
  }
  if (!COMMISSION_OFFICES.has(office)) {
    error(res, 'Invalid office');
    return;
  }
  if (!COMMISSION_BIZ_TYPES.has(businessType)) {
    error(res, 'Invalid businessType');
    return;
  }
  if (!COMMISSION_STATUSES.has(status)) {
    error(res, 'Invalid status');
    return;
  }

  const id = generateId('CP');
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO finance_commission_rules
    (id, planType, planName, office, businessType, status, configJson, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    planType,
    planName,
    office,
    businessType,
    status,
    config === null ? null : JSON.stringify(config),
    now,
    now
  );

  const row = db.prepare('SELECT * FROM finance_commission_rules WHERE id = ?').get(id) as any;
  success(res, normalizeCommissionRuleRow(row));
});

// PUT /api/finance/commission/rules/:id
router.put('/finance/commission/rules/:id', (req, res) => {
  const db = getDb();
  ensureCommissionTables(db);

  const existing = db.prepare('SELECT * FROM finance_commission_rules WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Commission rule not found', 404);
    return;
  }

  const payload = req.body || {};
  const sets: string[] = [];
  const params: any[] = [];

  if (payload.planType !== undefined) {
    const value = String(payload.planType || '').trim().toUpperCase();
    if (!COMMISSION_PLAN_TYPES.has(value)) {
      error(res, 'Invalid planType');
      return;
    }
    sets.push('planType = ?');
    params.push(value);
  }

  if (payload.planName !== undefined) {
    const value = String(payload.planName || '').trim();
    if (!value) {
      error(res, 'planName cannot be empty');
      return;
    }
    sets.push('planName = ?');
    params.push(value);
  }

  if (payload.office !== undefined) {
    const value = String(payload.office || '').trim().toUpperCase();
    if (!COMMISSION_OFFICES.has(value)) {
      error(res, 'Invalid office');
      return;
    }
    sets.push('office = ?');
    params.push(value);
  }

  if (payload.businessType !== undefined) {
    const value = String(payload.businessType || '').trim().toUpperCase();
    if (!COMMISSION_BIZ_TYPES.has(value)) {
      error(res, 'Invalid businessType');
      return;
    }
    sets.push('businessType = ?');
    params.push(value);
  }

  if (payload.status !== undefined) {
    const value = String(payload.status || '').trim().toUpperCase();
    if (!COMMISSION_STATUSES.has(value)) {
      error(res, 'Invalid status');
      return;
    }
    sets.push('status = ?');
    params.push(value);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'config')) {
    sets.push('configJson = ?');
    params.push(payload.config === null ? null : JSON.stringify(payload.config));
  }

  if (!sets.length) {
    error(res, 'No valid update fields');
    return;
  }

  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);
  db.prepare(`UPDATE finance_commission_rules SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const row = db.prepare('SELECT * FROM finance_commission_rules WHERE id = ?').get(req.params.id) as any;
  success(res, normalizeCommissionRuleRow(row));
});

// DELETE /api/finance/commission/rules/:id
router.delete('/finance/commission/rules/:id', (req, res) => {
  const db = getDb();
  ensureCommissionTables(db);

  const row = db.prepare('SELECT id FROM finance_commission_rules WHERE id = ?').get(req.params.id) as any;
  if (!row) {
    error(res, 'Commission rule not found', 404);
    return;
  }

  db.prepare('DELETE FROM finance_commission_rules WHERE id = ?').run(req.params.id);
  success(res, null, 'Commission rule deleted');
});

// GET /api/finance/commission/bonus
router.get('/finance/commission/bonus', (req, res) => {
  const db = getDb();
  ensureCommissionTables(db);

  const row = db.prepare('SELECT * FROM finance_commission_bonus WHERE id = ?').get('BONUS_DEFAULT') as any;
  success(res, row || null);
});

// PUT /api/finance/commission/bonus
router.put('/finance/commission/bonus', (req, res) => {
  const db = getDb();
  ensureCommissionTables(db);

  const payload = req.body || {};
  const triggerWeightKg = Number(payload.triggerWeightKg);
  const bonusAmount = Number(payload.bonusAmount);
  const minPersonalWeightKg = Number(payload.minPersonalWeightKg);
  const minQualifiedCount = Number(payload.minQualifiedCount);

  if (!Number.isFinite(triggerWeightKg) || triggerWeightKg < 0) {
    error(res, 'Invalid triggerWeightKg');
    return;
  }
  if (!Number.isFinite(bonusAmount) || bonusAmount < 0) {
    error(res, 'Invalid bonusAmount');
    return;
  }
  if (!Number.isFinite(minPersonalWeightKg) || minPersonalWeightKg < 0) {
    error(res, 'Invalid minPersonalWeightKg');
    return;
  }
  if (!Number.isFinite(minQualifiedCount) || minQualifiedCount < 0) {
    error(res, 'Invalid minQualifiedCount');
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE finance_commission_bonus
    SET triggerWeightKg = ?,
        bonusAmount = ?,
        minPersonalWeightKg = ?,
        minQualifiedCount = ?,
        updatedAt = ?
    WHERE id = 'BONUS_DEFAULT'
  `).run(triggerWeightKg, bonusAmount, minPersonalWeightKg, minQualifiedCount, now);

  const row = db.prepare('SELECT * FROM finance_commission_bonus WHERE id = ?').get('BONUS_DEFAULT');
  success(res, row);
});

// ==================== FEES ====================

// GET /api/fees
router.get('/fees', (req, res) => {
  const db = getDb();
  const { id, status, feeDirection, relatedType, relatedId, relatedNo, feeNo } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (id) { where += ' AND id = ?'; params.push(id); }
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (feeDirection) { where += ' AND feeDirection = ?'; params.push(feeDirection); }
  if (relatedType) { where += ' AND relatedType = ?'; params.push(relatedType); }
  if (relatedId) { where += ' AND relatedId = ?'; params.push(relatedId); }
  if (relatedNo) { where += ' AND relatedNo = ?'; params.push(relatedNo); }
  if (feeNo) { where += ' AND feeNo = ?'; params.push(feeNo); }

  const rows = db.prepare(`SELECT * FROM fee_records ${where} ORDER BY createdAt DESC`).all(...params);
  success(res, rows);
});

// GET /api/fees/coverage
router.get('/fees/coverage', (req, res) => {
  const db = getDb();

  const orders = db.prepare(`
    SELECT COUNT(*) AS total
    FROM master_orders mo
    WHERE NOT EXISTS (
      SELECT 1 FROM fee_records fr
      WHERE fr.relatedType = 'ORDER' AND fr.relatedId = mo.id AND fr.status != 'CANCELLED'
    )
  `).get() as any;

  const units = db.prepare(`
    SELECT COUNT(*) AS total
    FROM shipping_units su
    WHERE NOT EXISTS (
      SELECT 1 FROM fee_records fr
      WHERE fr.relatedType = 'UNIT' AND fr.relatedId = su.id AND fr.status != 'CANCELLED'
    )
  `).get() as any;

  const jobs = db.prepare(`
    SELECT COUNT(*) AS total
    FROM jobs j
    WHERE NOT EXISTS (
      SELECT 1 FROM fee_records fr
      WHERE fr.relatedType = 'JOB' AND fr.relatedId = j.jobNo AND fr.status != 'CANCELLED'
    )
  `).get() as any;

  success(res, {
    ORDER: Number(orders?.total || 0),
    UNIT: Number(units?.total || 0),
    JOB: Number(jobs?.total || 0),
  });
});

// POST /api/fees/bootstrap
router.post('/fees/bootstrap', (req, res) => {
  const db = getDb();
  const createdBy = String(req.body?.createdBy || 'SYSTEM');
  const typeList = Array.isArray(req.body?.types) ? req.body.types : ['ORDER', 'UNIT', 'JOB'];
  const types = new Set(typeList.map((x: any) => String(x || '').toUpperCase()));

  const summary: Record<string, { created: number; skipped: number }> = {
    ORDER: { created: 0, skipped: 0 },
    UNIT: { created: 0, skipped: 0 },
    JOB: { created: 0, skipped: 0 },
  };

  const tx = db.transaction(() => {
    if (types.has('ORDER')) {
      const orders = db.prepare(`
        SELECT id, id AS orderNo, customerId, customerName, COALESCE(totalFreight, 0) AS totalFreight
        FROM master_orders
      `).all() as any[];

      for (const row of orders) {
        if (hasActiveFee(db, 'ORDER', row.id)) {
          summary.ORDER.skipped++;
          continue;
        }
        insertAutoFee(db, {
          relatedType: 'ORDER',
          relatedId: row.id,
          relatedNo: row.orderNo,
          feeType: 'FREIGHT',
          feeDirection: 'RECEIVABLE',
          amount: Number(row.totalFreight || 0),
          currency: 'CNY',
          customerId: row.customerId || null,
          customerName: row.customerName || null,
          description: '系统自动获取：订单级运费',
          createdBy,
        });
        summary.ORDER.created++;
      }
    }

    if (types.has('UNIT')) {
      const units = db.prepare(`
        SELECT id, unitNo
        FROM shipping_units
      `).all() as any[];

      for (const row of units) {
        if (hasActiveFee(db, 'UNIT', row.id)) {
          summary.UNIT.skipped++;
          continue;
        }
        insertAutoFee(db, {
          relatedType: 'UNIT',
          relatedId: row.id,
          relatedNo: row.unitNo || row.id,
          feeType: 'HANDLING',
          feeDirection: 'PAYABLE',
          amount: 0,
          currency: 'CNY',
          description: '系统自动获取：集装单元费用草稿（待补录金额）',
          createdBy,
        });
        summary.UNIT.created++;
      }
    }

    if (types.has('JOB')) {
      const jobs = db.prepare(`
        SELECT jobNo
        FROM jobs
      `).all() as any[];

      for (const row of jobs) {
        if (hasActiveFee(db, 'JOB', row.jobNo)) {
          summary.JOB.skipped++;
          continue;
        }
        insertAutoFee(db, {
          relatedType: 'JOB',
          relatedId: row.jobNo,
          relatedNo: row.jobNo,
          feeType: 'OTHER',
          feeDirection: 'PAYABLE',
          amount: 0,
          currency: 'CNY',
          description: '系统自动获取：任务级费用草稿（待补录金额）',
          createdBy,
        });
        summary.JOB.created++;
      }
    }
  });

  tx();
  success(res, summary, 'Auto fee bootstrap completed');
});

// POST /api/fees
router.post('/fees', (req, res) => {
  const db = getDb();
  const id = generateId('FEE');
  const feeNo = generateFeeNo();
  const now = new Date().toISOString();

  const {
    relatedType, relatedId, relatedNo, feeType, feeDirection, amount,
    currency, exchangeRate, supplierId, supplierName, customerId, customerName,
    description, remark, createdBy, paymentMethod, paymentChannel, paymentAccount, paymentVoucher, paymentOperator
  } = req.body;

  if (!relatedType || !relatedId || !relatedNo || !feeType || !feeDirection || amount === undefined || amount === null || !createdBy) {
    error(res, 'Missing required fields');
    return;
  }

  const relation: any = resolveFeeRelation(db, relatedType, relatedId, relatedNo);
  if (!relation.ok) {
    error(res, relation.message);
    return;
  }

  db.prepare(`
    INSERT INTO fee_records (
      id, feeNo, relatedType, relatedId, relatedNo, feeType, feeDirection, amount, currency, exchangeRate, status,
      supplierId, supplierName, customerId, customerName, description, remark, paymentMethod, paymentChannel,
      paymentAccount, paymentVoucher, paymentOperator, createdBy, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, feeNo, relation.data.relatedType, relation.data.relatedId, relation.data.relatedNo, feeType, feeDirection, amount,
    currency || 'CNY', exchangeRate || 1.0,
    supplierId || null, supplierName || null, customerId || null, customerName || null,
    description || null, remark || null,
    paymentMethod || null, paymentChannel || null, paymentAccount || null, paymentVoucher || null, paymentOperator || null,
    createdBy, now, now);

  const fee = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(id);
  success(res, fee);
});

// PUT /api/fees/:id
router.put('/fees/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id, relatedType, relatedId, relatedNo FROM fee_records WHERE id = ?').get(req.params.id) as any;
  if (!existing) { error(res, 'Fee record not found', 404); return; }

  const fields = { ...(req.body || {}) } as Record<string, any>;
  const needsRelationValidation = fields.relatedType !== undefined || fields.relatedId !== undefined || fields.relatedNo !== undefined;
  if (needsRelationValidation) {
    const relation: any = resolveFeeRelation(
      db,
      fields.relatedType ?? existing.relatedType,
      fields.relatedId ?? existing.relatedId,
      fields.relatedNo ?? existing.relatedNo
    );
    if (!relation.ok) {
      error(res, relation.message);
      return;
    }
    fields.relatedType = relation.data.relatedType;
    fields.relatedId = relation.data.relatedId;
    fields.relatedNo = relation.data.relatedNo;
  }

  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'feeNo') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }

  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  db.prepare(`UPDATE fee_records SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const fee = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(req.params.id);
  success(res, fee);
});

// POST /api/fees/:id/approve
router.post('/fees/:id/approve', (req, res) => {
  const db = getDb();
  const { approver } = req.body;

  const fee = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(req.params.id) as any;
  if (!fee) { error(res, 'Fee record not found', 404); return; }
  if (fee.status !== 'PENDING') { error(res, 'Fee is not in PENDING status'); return; }

  const now = new Date().toISOString();
  db.prepare("UPDATE fee_records SET status = 'APPROVED', approver = ?, approvedAt = ?, updatedAt = ? WHERE id = ?")
    .run(approver || null, now, now, req.params.id);

  const updated = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(req.params.id);
  success(res, updated);
});

// POST /api/fees/:id/pay
router.post('/fees/:id/pay', (req, res) => {
  const db = getDb();
  const { paymentMethod, paymentChannel, paymentAccount, paymentVoucher, paidAt, operator, remark } = req.body || {};

  const fee = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(req.params.id) as any;
  if (!fee) { error(res, 'Fee record not found', 404); return; }
  if (fee.status !== 'APPROVED') { error(res, 'Only APPROVED fee can be paid'); return; }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE fee_records
    SET status = 'PAID',
        paidAt = ?,
        paymentMethod = ?,
        paymentChannel = ?,
        paymentAccount = ?,
        paymentVoucher = ?,
        paymentOperator = ?,
        remark = ?,
        updatedAt = ?
    WHERE id = ?
  `).run(
    paidAt || now,
    paymentMethod || null,
    paymentChannel || null,
    paymentAccount || null,
    paymentVoucher || null,
    operator || null,
    remark || fee.remark || null,
    now,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(req.params.id);
  success(res, updated);
});

// POST /api/fees/:id/cancel
router.post('/fees/:id/cancel', (req, res) => {
  const db = getDb();
  const { reason } = req.body || {};

  const fee = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(req.params.id) as any;
  if (!fee) { error(res, 'Fee record not found', 404); return; }
  if (fee.status === 'PAID') { error(res, 'Paid fee cannot be cancelled'); return; }
  if (fee.status === 'CANCELLED') { error(res, 'Fee already cancelled'); return; }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE fee_records
    SET status = 'CANCELLED',
        remark = ?,
        updatedAt = ?
    WHERE id = ?
  `).run(
    reason ? `${fee.remark ? `${fee.remark}；` : ''}作废原因：${reason}` : fee.remark || null,
    now,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(req.params.id);
  success(res, updated);
});

// POST /api/fees/:id/reject
router.post('/fees/:id/reject', (req, res) => {
  const db = getDb();
  const { approver, rejectReason } = req.body;

  const fee = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(req.params.id) as any;
  if (!fee) { error(res, 'Fee record not found', 404); return; }
  if (fee.status !== 'PENDING') { error(res, 'Fee is not in PENDING status'); return; }

  const now = new Date().toISOString();
  db.prepare("UPDATE fee_records SET status = 'REJECTED', approver = ?, rejectReason = ?, approvedAt = ?, updatedAt = ? WHERE id = ?")
    .run(approver || null, rejectReason || null, now, now, req.params.id);

  const updated = db.prepare('SELECT * FROM fee_records WHERE id = ?').get(req.params.id);
  success(res, updated);
});

// ==================== SUPPLIERS ====================

// GET /api/suppliers
router.get('/suppliers', (req, res) => {
  const db = getDb();
  const { type, status } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (type) { where += ' AND type = ?'; params.push(type); }
  if (status) { where += ' AND status = ?'; params.push(status); }

  const rows = db.prepare(`SELECT * FROM suppliers ${where} ORDER BY createdAt DESC`).all(...params);
  success(res, rows);
});

// POST /api/suppliers
router.post('/suppliers', (req, res) => {
  const db = getDb();
  const id = generateId('SUP');
  const now = new Date().toISOString();

  const { code, name, nameEn, type, country, city, address, contactPerson, phone, email, bankAccount, bankName, taxId, remark } = req.body;

  if (!code || !name || !type) {
    error(res, 'Missing required fields: code, name, type');
    return;
  }

  db.prepare(`
    INSERT INTO suppliers (id, code, name, nameEn, type, country, city, address, contactPerson, phone, email, bankAccount, bankName, taxId, status, remark, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
  `).run(id, code, name, nameEn || null, type, country || null, city || null, address || null,
    contactPerson || null, phone || null, email || null, bankAccount || null, bankName || null, taxId || null,
    remark || null, now);

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  success(res, supplier);
});

export default router;
