import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { uuid, generateJobNo } from '../utils/idGenerator';

const router = Router();

// GET /api/jobs — 任务列表（起运国办/到达国办）
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { status, businessLine, keyword } = req.query;
  let sql = 'SELECT * FROM tms_job WHERE 1=1';
  const params: any[] = [];

  if (businessLine && businessLine !== 'ALL') { sql += ' AND business_line = ?'; params.push(businessLine); }
  if (status) { sql += ' AND job_status = ?'; params.push(status); }
  if (keyword) {
    sql += ' AND (job_no LIKE ? OR route_code LIKE ? OR carrier_name LIKE ? OR container_no LIKE ?)';
    const k = `%${keyword}%`;
    params.push(k, k, k, k);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// GET /api/jobs/:jobNo — 任务详情
router.get('/:jobNo', (req: Request, res: Response) => {
  const db = getDb();
  const job = db.prepare('SELECT * FROM tms_job WHERE job_no = ? OR id = ?').get(req.params.jobNo, req.params.jobNo) as any;
  if (!job) { res.status(404).json({ error: 'Job not found' }); return; }

  const relations = db.prepare(`
    SELECT jor.*, so.sub_order_no, so.sub_status, so.pieces, so.actual_weight_kg,
      o.order_no, o.customer_name
    FROM tms_job_order_rel jor
    LEFT JOIN oms_sub_order so ON so.id = jor.sub_order_id
    LEFT JOIN oms_order o ON o.id = so.order_id
    WHERE jor.job_id = ?
  `).all(job.id);

  const events = db.prepare("SELECT * FROM tms_tracking_event WHERE job_id = ? ORDER BY event_time").all(job.id);

  const units = db.prepare('SELECT * FROM tms_shipping_unit WHERE job_id = ?').all(job.id);

  res.json({ data: { ...job, relations, events, units } });
});

// POST /api/jobs — 创建任务
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  const id = uuid();
  const businessLine = b.businessLine || b.business_line || 'SEA';
  const jobNo = generateJobNo(businessLine);

  db.prepare(`INSERT INTO tms_job (id, job_no, business_line, route_code, origin_port, dest_port, carrier_name, vessel_voyage, flight_no, bill_no, container_no, container_type, cargo_type, service_type, job_status, total_pieces, total_weight_kg, etd, eta, remark, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, jobNo, businessLine,
    b.routeCode || b.route_code,
    b.originPort || b.origin_port,
    b.destPort || b.dest_port,
    b.carrierName || b.carrier_name,
    b.vesselVoyage || b.vessel_voyage,
    b.flightNo || b.flight_no,
    b.billNo || b.bill_no,
    b.containerNo || b.container_no,
    b.containerType || b.container_type,
    b.cargoType || b.cargo_type || 'GENERAL',
    b.serviceType || b.service_type || 'EXPRESS',
    'PLANNED',
    b.totalPieces || 0,
    b.totalWeightKg || 0,
    b.etd, b.eta, b.remark, b.createdBy
  );

  res.json({ data: { id, jobNo } });
});

// PUT /api/jobs/:jobNo — 更新任务
router.put('/:jobNo', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  const sets: string[] = [];
  const vals: any[] = [];

  const allowedFields = [
    'job_status', 'current_node', 'carrier_name', 'vessel_voyage', 'flight_no', 'bill_no',
    'container_no', 'etd', 'eta', 'atd', 'ata', 'remark',
    'trucking_company', 'trucking_company_id', 'shipping_no',
    'driver_name', 'driver_phone', 'plate_no',
    'query_phone', 'track_url',
    'recipient_name', 'recipient_phone', 'recipient_address',
  ];
  for (const field of allowedFields) {
    const camelKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const value = b[field] || b[camelKey];
    if (value !== undefined) { sets.push(`${field} = ?`); vals.push(value); }
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    vals.push(req.params.jobNo);
    db.prepare(`UPDATE tms_job SET ${sets.join(', ')} WHERE job_no = ? OR id = ?`).run(...vals, req.params.jobNo);
  }
  res.json({ data: { jobNo: req.params.jobNo } });
});

// POST /api/v2/tms/shipping-units — 创建集装号
router.post('/shipping-units', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  const id = uuid();
  const unitNo = b.unitNo || `U-${Date.now()}`;

  db.prepare(
    "INSERT INTO tms_shipping_unit (id, unit_no, business_line, unit_type, container_type, seal_no, job_id, route_code, unit_status, max_weight_kg, max_volume_cbm) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
  ).run(
    id, unitNo,
    b.businessLine || 'SEA',
    b.unitType || 'CONTAINER',
    b.containerType || null,
    b.sealNo || null,
    b.jobId || null,
    b.routeCode || null,
    'EMPTY',
    Number(b.maxWeightKg) || 0,
    Number(b.maxVolumeCbm) || 0,
  );

  // 如果关联了 job 且是海运(1 JOB = 1 集装箱),同步把 container_no 写到 tms_job
  // 空运不写,因为空运 1 JOB 对应多个集装号,concept 不适用
  if (b.jobId) {
    const job = db.prepare('SELECT business_line FROM tms_job WHERE id = ?').get(b.jobId) as any;
    if (job?.business_line === 'SEA') {
      db.prepare("UPDATE tms_job SET container_no = COALESCE(container_no, ?), updated_at = datetime('now') WHERE id = ?")
        .run(unitNo, b.jobId);
    }
  }

  res.json({ data: { id, unitNo } });
});

// POST /api/v2/tms/tracking-events — 创建跟踪事件
router.post('/tracking-events', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  db.prepare('INSERT INTO tms_tracking_event (id, business_line, event_scope, order_id, sub_order_id, job_id, dpn_id, node_code, node_name, event_type, status_code, event_time, location, operator_user_id, remark) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    id, b.businessLine || 'SEA', b.eventScope || 'JOB',
    b.orderId, b.subOrderId, b.jobId, b.dpnId,
    b.nodeCode, b.nodeName, b.eventType || 'EXPORT',
    b.statusCode, b.eventTime || new Date().toISOString(), b.location,
    b.operatorUserId, b.remark
  );
  res.json({ data: { id } });
});

export default router;
