import { Router } from 'express';
import { getDb } from '../database/connection';
import { success, error } from '../utils/response';

const router = Router();

function normalizeTransportType(input: unknown): 'SEA' | 'AIR' | 'TRUCK' {
  const raw = String(input || '').toUpperCase();
  if (raw === 'AIR') return 'AIR';
  if (raw === 'TRUCK') return 'TRUCK';
  return 'SEA';
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createLegacyJobNo(db: any, transportType: unknown, createdAt?: string): string {
  const line = normalizeTransportType(transportType);
  const linePrefix = line === 'AIR' ? 'A' : 'S';
  const date = (createdAt ? String(createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const ym = date.slice(2, 6);
  const base = `${linePrefix}-JOB${ym}`;
  const likePattern = `${base}%`;
  const regex = new RegExp(`^${escapeRegExp(base)}(\\d{4})$`);
  const rows = db.prepare('SELECT jobNo FROM jobs WHERE jobNo LIKE ?').all(likePattern) as Array<{ jobNo?: string }>;

  let maxSeq = 0;
  rows.forEach((row) => {
    const raw = String(row?.jobNo || '');
    const match = raw.match(regex);
    if (!match) return;
    const seq = Number(match[1]);
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  });

  return `${base}${String(maxSeq + 1).padStart(4, '0')}`;
}

// GET /api/jobs
router.get('/', (req, res) => {
  const db = getDb();
  const { status, transportType, keyword } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status) { where += ' AND status = ?'; params.push(status); }
  if (transportType) { where += ' AND transportType = ?'; params.push(transportType); }
  if (keyword) {
    where += ' AND (jobNo LIKE ? OR route LIKE ? OR carrier LIKE ? OR pol LIKE ? OR pod LIKE ?)';
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  const rows = db.prepare(`SELECT * FROM jobs ${where} ORDER BY createdAt DESC`).all(...params);

  // Add stats for each job
  const data = (rows as any[]).map(job => {
    const units = db.prepare('SELECT * FROM shipping_units WHERE jobNo = ?').all(job.jobNo) as any[];

    // Find sub-orders: first by direct jobNo, then via shippingUnitId chain
    let subOrders = db.prepare('SELECT * FROM sub_orders WHERE jobNo = ?').all(job.jobNo) as any[];
    if (subOrders.length === 0 && units.length > 0) {
      const unitIds = units.map((u: any) => u.id);
      const placeholders = unitIds.map(() => '?').join(',');
      subOrders = db.prepare(`SELECT * FROM sub_orders WHERE shippingUnitId IN (${placeholders})`).all(...unitIds) as any[];
    }

    // Enrich sub-orders with master order and client info
    const enrichedSubOrders = subOrders.map((s: any) => {
      const master = s.masterOrderId
        ? db.prepare('SELECT id, customerName, customerId FROM master_orders WHERE id = ?').get(s.masterOrderId) as any
        : null;
      return {
        ...s,
        subOrderNo: s.id,
        masterOrderNo: master?.id || s.masterOrderId,
        clientName: master?.customerName || '',
        clientCode: master?.customerId || '',
      };
    });

    return {
      ...job,
      shippingUnitIds: units.map(u => u.id),
      shippingUnits: units.map(u => ({ id: u.id, unitNo: u.unitNo, unitType: u.unitType, status: u.status })),
      subOrders: enrichedSubOrders,
      orderIds: enrichedSubOrders.map((s: any) => s.id),
      stats: {
        containers: units.length,
        orders: enrichedSubOrders.length,
        pieces: enrichedSubOrders.reduce((sum: number, s: any) => sum + (s.pieces || 0), 0),
        weight: units.reduce((sum: number, u: any) => sum + (u.currentWeight || 0), 0),
        volume: units.reduce((sum: number, u: any) => sum + (u.currentVolume || 0), 0)
      },
      capacity: {
        weight: units.reduce((sum: number, u: any) => sum + (u.maxWeight || 0), 0),
        volume: units.reduce((sum: number, u: any) => sum + (u.maxVolume || 0), 0)
      }
    };
  });

  success(res, data);
});

// GET /api/jobs/:jobNo
router.get('/:jobNo', (req, res) => {
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE jobNo = ?').get(req.params.jobNo) as any;
  if (!job) { error(res, 'Job not found', 404); return; }

  // Include shipping units
  job.shippingUnits = db.prepare('SELECT * FROM shipping_units WHERE jobNo = ?').all(req.params.jobNo);
  job.shippingUnitIds = (job.shippingUnits as any[]).map(u => u.id);

  // Include sub orders: first by direct jobNo, then via shippingUnitId chain
  let subOrders = db.prepare('SELECT * FROM sub_orders WHERE jobNo = ?').all(req.params.jobNo) as any[];
  if (subOrders.length === 0 && (job.shippingUnits as any[]).length > 0) {
    const unitIds = (job.shippingUnits as any[]).map((u: any) => u.id);
    const placeholders = unitIds.map(() => '?').join(',');
    subOrders = db.prepare(`SELECT * FROM sub_orders WHERE shippingUnitId IN (${placeholders})`).all(...unitIds) as any[];
  }

  // Enrich sub-orders with master order and client info
  job.subOrders = subOrders.map((s: any) => {
    const master = s.masterOrderId
      ? db.prepare('SELECT id, customerName, customerId FROM master_orders WHERE id = ?').get(s.masterOrderId) as any
      : null;
    return {
      ...s,
      subOrderNo: s.id,
      masterOrderNo: master?.id || s.masterOrderId,
      clientName: master?.customerName || '',
      clientCode: master?.customerId || '',
    };
  });
  job.orderIds = (job.subOrders as any[]).map((s: any) => s.id);

  // Stats
  job.stats = {
    containers: job.shippingUnits.length,
    orders: job.subOrders.length,
    pieces: (job.subOrders as any[]).reduce((sum: number, s: any) => sum + (s.pieces || 0), 0),
    weight: (job.shippingUnits as any[]).reduce((sum: number, u: any) => sum + (u.currentWeight || 0), 0),
    volume: (job.shippingUnits as any[]).reduce((sum: number, u: any) => sum + (u.currentVolume || 0), 0)
  };
  job.capacity = {
    weight: (job.shippingUnits as any[]).reduce((sum: number, u: any) => sum + (u.maxWeight || 0), 0),
    volume: (job.shippingUnits as any[]).reduce((sum: number, u: any) => sum + (u.maxVolume || 0), 0)
  };

  success(res, job);
});

// POST /api/jobs
router.post('/', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const {
    jobNo, route, pol, pod, transitPort, carrier, billOfLading, vesselVoyage, flightNo,
    transportType, etd, eta, remark
  } = req.body;

  if (!route || !pol || !pod || !carrier || !transportType || !etd || !eta) {
    error(res, 'Missing required fields');
    return;
  }

  const finalJobNo = jobNo || createLegacyJobNo(db, transportType, now);

  db.prepare(`
    INSERT INTO jobs (jobNo, route, pol, pod, transitPort, carrier, billOfLading, vesselVoyage, flightNo, transportType, currentPhase, originPhaseStatus, destPhaseStatus, status, etd, eta, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ORIGIN', 'PLANNED', 'IN_TRANSIT', 'PLANNED', ?, ?, ?, ?, ?)
  `).run(finalJobNo, route, pol, pod, transitPort || null, carrier,
    billOfLading || null, vesselVoyage || null, flightNo || null,
    transportType, etd, eta, remark || null, now, now);

  const job = db.prepare('SELECT * FROM jobs WHERE jobNo = ?').get(finalJobNo);
  success(res, job);
});

// PUT /api/jobs/:jobNo
router.put('/:jobNo', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT jobNo FROM jobs WHERE jobNo = ?').get(req.params.jobNo);
  if (!existing) { error(res, 'Job not found', 404); return; }

  const fields = req.body;
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'jobNo' || key === 'shippingUnits' || key === 'subOrders' || key === 'stats' || key === 'capacity' || key === 'shippingUnitIds' || key === 'orderIds') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }

  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.jobNo);

  db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE jobNo = ?`).run(...params);

  const job = db.prepare('SELECT * FROM jobs WHERE jobNo = ?').get(req.params.jobNo);
  success(res, job);
});

// POST /api/jobs/:jobNo/bind-units
router.post('/:jobNo/bind-units', (req, res) => {
  const db = getDb();
  const { unitIds } = req.body;
  if (!unitIds || !Array.isArray(unitIds)) { error(res, 'unitIds array is required'); return; }

  const job = db.prepare('SELECT jobNo FROM jobs WHERE jobNo = ?').get(req.params.jobNo);
  if (!job) { error(res, 'Job not found', 404); return; }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const unitId of unitIds) {
      db.prepare('UPDATE shipping_units SET jobNo = ?, updatedAt = ? WHERE id = ?')
        .run(req.params.jobNo, now, unitId);
    }
    db.prepare('UPDATE jobs SET updatedAt = ? WHERE jobNo = ?').run(now, req.params.jobNo);
  });
  tx();

  success(res, null, 'Units bound successfully');
});

// POST /api/jobs/:jobNo/unbind-units
router.post('/:jobNo/unbind-units', (req, res) => {
  const db = getDb();
  const { unitIds } = req.body;
  if (!unitIds || !Array.isArray(unitIds)) { error(res, 'unitIds array is required'); return; }

  const job = db.prepare('SELECT jobNo FROM jobs WHERE jobNo = ?').get(req.params.jobNo);
  if (!job) { error(res, 'Job not found', 404); return; }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const unitId of unitIds) {
      db.prepare('UPDATE shipping_units SET jobNo = NULL, updatedAt = ? WHERE id = ? AND jobNo = ?')
        .run(now, unitId, req.params.jobNo);
    }
    db.prepare('UPDATE jobs SET updatedAt = ? WHERE jobNo = ?').run(now, req.params.jobNo);
  });
  tx();

  success(res, null, 'Units unbound successfully');
});

// DELETE /api/jobs/:jobNo
router.delete('/:jobNo', (req, res) => {
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE jobNo = ?').get(req.params.jobNo) as any;
  if (!job) { error(res, 'Job not found', 404); return; }

  // Check if shipping units are bound
  const units = db.prepare('SELECT id FROM shipping_units WHERE jobNo = ?').all(req.params.jobNo);
  if (units.length > 0) {
    error(res, '该任务已绑定运输单元，无法删除', 400);
    return;
  }

  db.prepare('DELETE FROM jobs WHERE jobNo = ?').run(req.params.jobNo);
  success(res, null, '任务删除成功');
});

// PUT /api/jobs/:jobNo/origin-phase
router.put('/:jobNo/origin-phase', (req, res) => {
  const db = getDb();
  const { originPhaseStatus, remark } = req.body;
  const existing = db.prepare('SELECT jobNo FROM jobs WHERE jobNo = ?').get(req.params.jobNo);
  if (!existing) { error(res, 'Job not found', 404); return; }

  const now = new Date().toISOString();
  db.prepare('UPDATE jobs SET originPhaseStatus = ?, remark = COALESCE(?, remark), updatedAt = ? WHERE jobNo = ?')
    .run(originPhaseStatus, remark || null, now, req.params.jobNo);

  const job = db.prepare('SELECT * FROM jobs WHERE jobNo = ?').get(req.params.jobNo);
  success(res, job);
});

// PUT /api/jobs/:jobNo/dest-phase
router.put('/:jobNo/dest-phase', (req, res) => {
  const db = getDb();
  const { destPhaseStatus, remark } = req.body;
  const existing = db.prepare('SELECT jobNo FROM jobs WHERE jobNo = ?').get(req.params.jobNo);
  if (!existing) { error(res, 'Job not found', 404); return; }

  const now = new Date().toISOString();
  db.prepare('UPDATE jobs SET destPhaseStatus = ?, remark = COALESCE(?, remark), updatedAt = ? WHERE jobNo = ?')
    .run(destPhaseStatus, remark || null, now, req.params.jobNo);

  const job = db.prepare('SELECT * FROM jobs WHERE jobNo = ?').get(req.params.jobNo);
  success(res, job);
});

export default router;
