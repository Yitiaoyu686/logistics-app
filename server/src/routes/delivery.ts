import { Router } from 'express';
import { getDb } from '../database/connection';
import { success, error } from '../utils/response';
import { generateId } from '../utils/idGenerator';
import { addSubOrderLog, syncMasterOrderStatus } from '../utils/orderFlow';

const router = Router();

// GET /api/delivery
router.get('/', (req, res) => {
  const db = getDb();
  const { status, driverId, city } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status) { where += ' AND status = ?'; params.push(status); }
  if (driverId) { where += ' AND driverId = ?'; params.push(driverId); }
  if (city) { where += ' AND city = ?'; params.push(city); }

  const rows = db.prepare(`SELECT * FROM delivery_orders ${where} ORDER BY createdAt DESC`).all(...params);

  // Add items for each delivery order
  const data = (rows as any[]).map(d => {
    d.photos = d.photos ? JSON.parse(d.photos) : [];
    d.items = db.prepare('SELECT * FROM delivery_order_items WHERE deliveryOrderId = ?').all(d.id);
    return d;
  });

  success(res, data);
});

// POST /api/delivery
router.post('/', (req, res) => {
  const db = getDb();
  const id = generateId('DPN');
  const dpnNo = id;
  const now = new Date().toISOString();

  const {
    recipientName, recipientPhone, recipientAddress, city, country,
    deliveryMethod, totalPieces, totalWeight, deliveryFee, currency,
    remark, createdBy, subOrderIds
  } = req.body;

  if (!recipientName || !recipientPhone || !recipientAddress) {
    error(res, 'Missing required fields');
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO delivery_orders (id, dpnNo, recipientName, recipientPhone, recipientAddress, city, country, deliveryMethod, status, totalPieces, totalWeight, deliveryFee, currency, remark, createdBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?)
    `).run(id, dpnNo, recipientName, recipientPhone, recipientAddress,
      city || null, country || null, deliveryMethod || 'DELIVERY',
      totalPieces || 0, totalWeight || 0, deliveryFee || 0, currency || 'USD',
      remark || null, createdBy || null, now);

    if (subOrderIds && Array.isArray(subOrderIds)) {
      const insertItem = db.prepare(`
        INSERT INTO delivery_order_items (id, deliveryOrderId, subOrderId, subOrderNo)
        VALUES (?, ?, ?, ?)
      `);
      for (const subId of subOrderIds) {
        const sub = db.prepare('SELECT id FROM sub_orders WHERE id = ?').get(subId) as any;
        if (sub) {
          insertItem.run(generateId('DOI'), id, subId, sub.id);
        }
      }
    }
  });
  tx();

  const delivery = db.prepare('SELECT * FROM delivery_orders WHERE id = ?').get(id) as any;
  delivery.photos = delivery.photos ? JSON.parse(delivery.photos) : [];
  delivery.items = db.prepare('SELECT * FROM delivery_order_items WHERE deliveryOrderId = ?').all(id);
  success(res, delivery);
});

// PUT /api/delivery/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM delivery_orders WHERE id = ?').get(req.params.id);
  if (!existing) { error(res, 'Delivery order not found', 404); return; }

  const fields = req.body;
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'dpnNo' || key === 'items') continue;
    if (key === 'photos') {
      sets.push('photos = ?');
      params.push(JSON.stringify(value));
    } else {
      sets.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (sets.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE delivery_orders SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  const delivery = db.prepare('SELECT * FROM delivery_orders WHERE id = ?').get(req.params.id) as any;
  delivery.photos = delivery.photos ? JSON.parse(delivery.photos) : [];
  delivery.items = db.prepare('SELECT * FROM delivery_order_items WHERE deliveryOrderId = ?').all(req.params.id);
  success(res, delivery);
});

// POST /api/delivery/:id/assign
router.post('/:id/assign', (req, res) => {
  const db = getDb();
  const { driverId, driverName, driverPhone } = req.body;
  if (!driverId) { error(res, 'driverId is required'); return; }

  const existing = db.prepare('SELECT id FROM delivery_orders WHERE id = ?').get(req.params.id);
  if (!existing) { error(res, 'Delivery order not found', 404); return; }

  const now = new Date().toISOString();
  db.prepare("UPDATE delivery_orders SET driverId = ?, driverName = ?, driverPhone = ?, status = 'ACCEPTED', acceptedAt = ? WHERE id = ?")
    .run(driverId, driverName || null, driverPhone || null, now, req.params.id);

  const delivery = db.prepare('SELECT * FROM delivery_orders WHERE id = ?').get(req.params.id) as any;
  delivery.photos = delivery.photos ? JSON.parse(delivery.photos) : [];
  success(res, delivery);
});

// POST /api/delivery/:id/sign
router.post('/:id/sign', (req, res) => {
  const db = getDb();
  const { photos } = req.body;

  const existing = db.prepare('SELECT id FROM delivery_orders WHERE id = ?').get(req.params.id);
  if (!existing) { error(res, 'Delivery order not found', 404); return; }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare("UPDATE delivery_orders SET status = 'SIGNED', signedAt = ?, photos = ? WHERE id = ?")
      .run(now, photos ? JSON.stringify(photos) : null, req.params.id);

    const deliveryItems = db.prepare('SELECT subOrderId FROM delivery_order_items WHERE deliveryOrderId = ?').all(req.params.id) as any[];
    const masterIds = new Set<string>();
    for (const item of deliveryItems) {
      // C05 需要签收时对子单状态有联动更新
      db.prepare("UPDATE sub_orders SET status = 'DELIVERED', currentNode = '已签收', updatedAt = ? WHERE id = ?")
        .run(now, item.subOrderId);

      const sub = db.prepare('SELECT id, masterOrderId FROM sub_orders WHERE id = ?').get(item.subOrderId) as any;
      if (!sub) continue;
      if (sub.masterOrderId) masterIds.add(sub.masterOrderId);
      addSubOrderLog(db, {
        subOrderId: sub.id,
        status: 'DELIVERED',
        step: '配送签收',
        operator: 'driver',
        location: '目的地仓',
        remark: '配送单签收完成',
        timestamp: now,
      });
    }

    for (const masterId of masterIds) {
      syncMasterOrderStatus(db, masterId, now);
    }
  });
  tx();

  const delivery = db.prepare('SELECT * FROM delivery_orders WHERE id = ?').get(req.params.id) as any;
  delivery.photos = delivery.photos ? JSON.parse(delivery.photos) : [];
  success(res, delivery);
});

export default router;
