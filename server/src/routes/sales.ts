import { Router } from 'express';
import { getDb } from '../database/connection';
import { success, error } from '../utils/response';

const router = Router();

// GET /api/sales/dashboard
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const { salesId } = req.query;

  // Aggregate stats
  const totalClients = (db.prepare(
    'SELECT COUNT(*) as c FROM clients WHERE poolType = ? AND salesId = ?'
  ).get('PRIVATE', salesId || '') as any)?.c || 0;

  const totalOrders = (db.prepare(
    'SELECT COUNT(*) as c FROM master_orders WHERE salesPerson IS NOT NULL'
  ).get() as any).c;

  const pendingPayments = (db.prepare(
    "SELECT COUNT(*) as c, SUM(COALESCE(totalFreight, 0) - COALESCE(paidAmount, 0)) as amount FROM master_orders WHERE paymentStatus IN ('UNPAID','PARTIAL')"
  ).get() as any);

  const completedOrders = (db.prepare(
    "SELECT COUNT(*) as c FROM master_orders WHERE status = 'COMPLETED'"
  ).get() as any).c;

  success(res, {
    totalClients,
    totalOrders,
    completedOrders,
    pendingPaymentCount: pendingPayments.c,
    pendingPaymentAmount: pendingPayments.amount || 0,
  });
});

// GET /api/sales/pending-payments
router.get('/pending-payments', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      id,
      id as orderNo,
      customerId,
      customerName,
      COALESCE(totalFreight, 0) as totalAmount,
      COALESCE(totalFreight, 0) as totalFreight,
      COALESCE(paidAmount, 0) as paidAmount,
      (COALESCE(totalFreight, 0) - COALESCE(paidAmount, 0)) as pendingAmount,
      'USD' as currency,
      date(createdAt, '+30 day') as dueDate,
      CASE
        WHEN paymentStatus IN ('UNPAID','PARTIAL') AND date(createdAt, '+30 day') < date('now')
          THEN CAST(julianday('now') - julianday(date(createdAt, '+30 day')) AS INTEGER)
        ELSE 0
      END as overdueDays,
      0 as reminderCount,
           paymentStatus, createdAt
    FROM master_orders
    WHERE paymentStatus IN ('UNPAID','PARTIAL') AND COALESCE(totalFreight, 0) > 0
    ORDER BY createdAt DESC
  `).all();
  success(res, rows);
});

// POST /api/sales/reminders
router.post('/reminders', (req, res) => {
  const db = getDb();
  const { orderId, method, message } = req.body;

  if (!orderId || !method) {
    error(res, 'orderId and method are required');
    return;
  }

  // Just log the reminder (in real app, would send SMS/email)
  const now = new Date().toISOString();

  // Create a notification
  const notifId = `NOTIF-${Date.now()}`;
  db.prepare(`
    INSERT INTO notifications (id, type, title, content, warehouse, createdAt)
    VALUES (?, 'REMINDER', '催款通知', ?, 'SALES', ?)
  `).run(notifId, message || `催款提醒已发送 (${method})`, now);

  success(res, { id: notifId, method, sentAt: now });
});

// GET /api/sales/reminders/:paymentId
router.get('/reminders/:paymentId', (req, res) => {
  const db = getDb();
  // Return notifications related to the payment
  const rows = db.prepare(
    "SELECT * FROM notifications WHERE type = 'REMINDER' ORDER BY createdAt DESC LIMIT 10"
  ).all();
  success(res, rows);
});

// GET /api/sales/quotes
router.get('/quotes', (req, res) => {
  const db = getDb();
  const {
    originCity,
    destCity,
    transportType,
    country,
    weight,
    volume,
    type
  } = req.query as Record<string, string | undefined>;

  const weightNum = Number(weight || 0);
  const volumeNum = Number(volume || 0);
  const cargoType = String(type || 'NORMAL').toUpperCase();

  const countryAliases: Record<string, string[]> = {
    USA: ['美国', 'USA', 'US'],
    GB: ['英国', 'UK', 'GB'],
    DE: ['德国', 'DE'],
    NG: ['尼日利亚', 'NG', 'NIGERIA'],
    GH: ['加纳', 'GH', 'GHANA'],
  };

  let where = "WHERE status = 'ACTIVE'";
  const params: any[] = [];
  if (originCity) { where += ' AND originCity = ?'; params.push(originCity); }
  if (destCity) { where += ' AND destCity LIKE ?'; params.push(`%${destCity}%`); }
  if (transportType) { where += ' AND transportType = ?'; params.push(transportType); }
  if (country) {
    const aliases = countryAliases[String(country).toUpperCase()] || [String(country)];
    const placeholders = aliases.map(() => '?').join(', ');
    where += ` AND (destCountry IN (${placeholders}) OR destCity IN (${placeholders}))`;
    params.push(...aliases, ...aliases);
  }

  const routes = db.prepare(`SELECT * FROM routes_config ${where} ORDER BY originCity, destCity`).all(...params) as any[];
  const rules = db.prepare(`
    SELECT * FROM freight_rate_rules
    WHERE status = 'ACTIVE'
    ORDER BY datetime(updatedAt) DESC, datetime(createdAt) DESC
  `).all() as any[];

  const findRule = (routeType: string) => {
    if (routeType === 'AIR') {
      return rules.find((r) => r.transportMode === 'AIR');
    }
    return rules.find((r) => r.transportMode === 'SEA_LCL');
  };

  const parseJsonSafe = (value: any, fallback: any) => {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch (_) {
      return fallback;
    }
  };

  const quoteRows = routes.map((route) => {
    const rule = findRule(route.transportType);
    const transportLabel = route.transportType === 'AIR' ? '空运' : '海运拼箱';
    let calcWeight = weightNum > 0 ? weightNum : 1;
    let totalPrice = 0;
    let unitPrice = Number(route.pricePerKg || 0);

    if (route.transportType === 'AIR') {
      const divisor = Number(rule?.volumetricDivisor || 6000);
      const volumeWeight = volumeNum > 0 ? (volumeNum * 1000000) / divisor : 0;
      calcWeight = Math.max(weightNum || 0, volumeWeight || 0, 1);
      const baseRate = Number(rule?.firstWeightPrice || rule?.unitPrice || route.pricePerKg || 0);
      const surchargeMap = parseJsonSafe(rule?.surchargeRates, {});
      const surchargeRate = cargoType !== 'NORMAL' ? Number(surchargeMap?.[cargoType] || 0) : 0;
      totalPrice = calcWeight * baseRate * (1 + surchargeRate);
      const minCharge = Number(rule?.minCharge || 0);
      if (minCharge > 0 && totalPrice < minCharge) totalPrice = minCharge;
      unitPrice = calcWeight > 0 ? totalPrice / calcWeight : baseRate;
    } else {
      const ratio = Number(rule?.volumeWeightRatio || 700);
      const billableVolume = Math.max(volumeNum || 0, ratio > 0 ? (weightNum || 0) / ratio : 0, 0);
      const perCbm = Number(rule?.unitPricePerCBM || rule?.unitPrice || route.pricePerCbm || 0);
      totalPrice = billableVolume * perCbm;
      const minCharge = Number(rule?.minCharge || 0);
      if (minCharge > 0 && totalPrice < minCharge) totalPrice = minCharge;
      unitPrice = (weightNum || 0) > 0 ? totalPrice / (weightNum || 1) : (route.pricePerKg || 0);
    }

    const days = route.transitDays || (route.transportType === 'AIR' ? '5-8天' : '25-35天');

    return {
      key: route.id,
      routeId: route.id,
      channel: `${route.originCity}→${route.destCity} ${transportLabel}`,
      type: route.transportType,
      etd: `预计${days}`,
      pricePerKg: Number(unitPrice.toFixed(2)),
      totalPrice: Number(totalPrice.toFixed(2)),
      tags: [transportLabel, route.destCountry].filter(Boolean),
    };
  });

  quoteRows.sort((a, b) => a.totalPrice - b.totalPrice);
  success(res, quoteRows);
});

export default router;
