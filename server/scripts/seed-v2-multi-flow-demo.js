#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('path');
const BetterSqlite3 = require(path.resolve(__dirname, '../node_modules/better-sqlite3'));

const v2Db = new BetterSqlite3(path.resolve(__dirname, '../logistics_v2.db'));
const legacyDb = new BetterSqlite3(path.resolve(__dirname, '../logistics.db'));

v2Db.pragma('foreign_keys = ON');
legacyDb.pragma('foreign_keys = ON');

const now = new Date();
const batch = now.toISOString().slice(0, 10).replace(/-/g, '');
const createdAt = now.toISOString();

const summary = {
  batch,
  customers: [],
  orders: [],
  jobs: [],
  unmatchedPackages: [],
  routeTemplates: [],
};

function isoOffset(days = 0, hours = 0) {
  const d = new Date(now.getTime() + days * 24 * 3600 * 1000 + hours * 3600 * 1000);
  return d.toISOString();
}

function rand4() {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const noCounter = {};
function nextWaybillNo(table, column, businessLine) {
  const prefix = businessLine === 'AIR' ? 'A' : 'S';
  const key = `${table}:${prefix}:${batch}`;
  if (!noCounter[key]) {
    const likePattern = `${prefix}-${batch}%`;
    const row = v2Db.prepare(`
      SELECT MAX(CAST(SUBSTR(${column}, 11, 6) AS INTEGER)) AS maxSeq
      FROM ${table}
      WHERE ${column} LIKE ?
    `).get(likePattern);
    noCounter[key] = Number(row?.maxSeq || 0);
  }
  noCounter[key] += 1;
  return `${prefix}-${batch}${String(noCounter[key]).padStart(6, '0')}`;
}

function nextJobNo(businessLine) {
  const prefix = businessLine === 'AIR' ? 'A' : 'S';
  const ym = batch.slice(2, 6);
  const key = `job:${prefix}:${ym}`;
  if (!noCounter[key]) {
    const likePattern = `${prefix}-JOB${ym}%`;
    const row = v2Db.prepare(`
      SELECT MAX(CAST(SUBSTR(job_no, 10, 4) AS INTEGER)) AS maxSeq
      FROM tms_job
      WHERE job_no LIKE ?
    `).get(likePattern);
    noCounter[key] = Number(row?.maxSeq || 0);
  }
  noCounter[key] += 1;
  return `${prefix}-JOB${ym}${String(noCounter[key]).padStart(4, '0')}`;
}

function uniqueCustomerCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 5000; i++) {
    let code = '';
    for (let j = 0; j < 4; j++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (!/[A-Z]/.test(code) || !/\d/.test(code)) continue;
    const exists = v2Db.prepare('SELECT id FROM crm_customer WHERE customer_code = ? LIMIT 1').get(code);
    if (!exists) return code;
  }
  throw new Error('无法生成唯一客户编号');
}

function ensureLegacyRouteTemplate() {
  const routeRows = [
    {
      id: makeId('RTE'),
      originCountry: 'CN',
      originCity: 'GZ',
      destCountry: 'NGA',
      destCity: 'LOS',
      transportType: 'SEA',
      arrivalStation: '拉各斯站点',
      transitDays: '18-25',
      nodes: [
        ['SEA_INBOUND', '起运仓入库', 'WAREHOUSE_IN', 1],
        ['SEA_PACK', '集装', 'WAREHOUSE_OUT', 2],
        ['SEA_EXPORT', '出口报关', 'CUSTOMS_EXPORT', 3],
        ['SEA_DEPART', '离境', 'DEPARTURE', 4],
        ['SEA_ARRIVE', '到港', 'ARRIVAL', 5],
        ['SEA_IMPORT', '进口清关', 'CUSTOMS_IMPORT', 6],
        ['SEA_DELIVERY', '末端派送', 'DELIVERY', 7],
      ],
    },
    {
      id: makeId('RTE'),
      originCountry: 'CN',
      originCity: 'GZ',
      destCountry: 'NGA',
      destCity: 'LOS',
      transportType: 'AIR',
      arrivalStation: '拉各斯机场站',
      transitDays: '3-7',
      nodes: [
        ['AIR_INBOUND', '起运仓入库', 'WAREHOUSE_IN', 1],
        ['AIR_EXPORT', '出口报关', 'CUSTOMS_EXPORT', 2],
        ['AIR_FLIGHT', '航班起飞', 'DEPARTURE', 3],
        ['AIR_ARRIVE', '到达机场', 'ARRIVAL', 4],
        ['AIR_IMPORT', '进口清关', 'CUSTOMS_IMPORT', 5],
        ['AIR_LASTMILE', '末端派送', 'DELIVERY', 6],
      ],
    },
  ];

  const existsSea = legacyDb.prepare("SELECT id FROM routes_config WHERE originCity='GZ' AND destCity='LOS' AND transportType='SEA' LIMIT 1").get();
  const existsAir = legacyDb.prepare("SELECT id FROM routes_config WHERE originCity='GZ' AND destCity='LOS' AND transportType='AIR' LIMIT 1").get();

  const insertRoute = legacyDb.prepare(`
    INSERT INTO routes_config (
      id, originCountry, originCity, destCountry, destCity, transportType,
      transitDays, pricePerKg, pricePerCbm, freightDiscount, volumeRatio,
      firstWeightValue, firstWeightCOD_USD, firstWeightPrepaid_RMB,
      arrivalStation, status, remark, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 1, 0, 0, ?, 'ACTIVE', ?, ?, ?)
  `);

  const insertNode = legacyDb.prepare(`
    INSERT INTO route_logistics_nodes (
      id, routeId, nodeCode, nodeName, nodeNameEn, nodeType,
      sortOrder, isRequired, description, status, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'ACTIVE', ?, ?)
  `);

  for (const route of routeRows) {
    if ((route.transportType === 'SEA' && existsSea) || (route.transportType === 'AIR' && existsAir)) continue;
    insertRoute.run(
      route.id,
      route.originCountry,
      route.originCity,
      route.destCountry,
      route.destCity,
      route.transportType,
      route.transitDays,
      route.arrivalStation,
      `联调模板-${route.transportType}`,
      createdAt,
      createdAt
    );
    for (const [code, name, type, sort] of route.nodes) {
      insertNode.run(
        makeId('RLN'),
        route.id,
        code,
        name,
        name,
        type,
        sort,
        `${name}节点`,
        createdAt,
        createdAt
      );
    }
    summary.routeTemplates.push({ transportType: route.transportType, routeId: route.id });
  }
}

function createCustomer(def) {
  const id = makeId('CUST');
  const code = uniqueCustomerCode();
  const senderId = makeId('SENDER');
  const recipientId = makeId('REC');

  v2Db.prepare(`
    INSERT INTO crm_customer (
      id, customer_code, customer_name, customer_type, owner_user_id, source, pool_type, status,
      country, address, industry, contact_name, contact_phone, contact_email, company_type, credit_level, remark,
      enter_pool_time, created_at, updated_at
    ) VALUES (?, ?, ?, 'COMPANY', ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    code,
    def.name,
    def.ownerUserId || null,
    def.source || '线索导入',
    def.poolType,
    def.country || '中国',
    def.address,
    def.industry || '贸易',
    def.contactName,
    def.contactPhone,
    def.contactEmail || null,
    'COMPANY',
    def.creditLevel || 'B',
    `联调批次${batch}`,
    def.poolType === 'PUBLIC' ? createdAt : null,
    createdAt,
    createdAt
  );

  v2Db.prepare(`
    INSERT INTO crm_sender_profile (
      id, customer_id, sender_name, sender_phone, sender_address, sender_district,
      sender_city_id, sender_country_id, is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'CITY-GZ', 'CTRY-CN', 1, ?, ?)
  `).run(senderId, id, `${def.contactName}`, def.contactPhone, def.address, '白云区', createdAt, createdAt);

  v2Db.prepare(`
    INSERT INTO uc_recipient_address (
      id, customer_id, recipient_name, recipient_phone, recipient_email,
      country_id, city_id, district, detail_address, is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'CTRY-NG', 'CITY-LOS', 'IKEJA', ?, 1, ?, ?)
  `).run(recipientId, id, `${def.name}收件`, def.contactPhone.replace(/^1/, '+234-8'), def.contactEmail || null, `Lagos IKEJA ${def.name} Office`, createdAt, createdAt);

  for (const line of ['SEA', 'AIR']) {
    v2Db.prepare(`
      INSERT INTO crm_customer_line_profile (
        id, customer_id, business_line, preferred_route_code, preferred_service_type_code,
        preferred_payment_method, preferred_payment_channel, default_sender_profile_id, default_recipient_address_id,
        price_level, risk_flag, remark, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'PREPAID', 'WECHAT', ?, ?, 'L1', 'LOW', ?, ?, ?)
    `).run(
      makeId('CLP'),
      id,
      line,
      'GZ.CN→LOS.NGA',
      line === 'SEA' ? 'LCL_SEA' : 'STANDARD_AIR',
      senderId,
      recipientId,
      `联调${line}业务线`,
      createdAt,
      createdAt
    );
  }

  summary.customers.push({ id, code, name: def.name, poolType: def.poolType });
  return { id, code, name: def.name, senderId, recipientId, contactPhone: def.contactPhone };
}

function insertOrderFlow(flow) {
  const orderId = makeId('ORD');
  const orderNo = nextWaybillNo('oms_order', 'order_no', flow.businessLine);
  const displayOrderNo = orderNo;
  const warehouseEntryNo = flow.businessLine === 'SEA' ? `IN-${flow.customer.code}-${batch}-${rand4().slice(0, 3)}` : null;

  const subDefs = flow.subDefs;
  const totalWeight = subDefs.reduce((s, x) => s + x.weight, 0);
  const totalPieces = subDefs.reduce((s, x) => s + x.pieces, 0);

  v2Db.prepare(`
    INSERT INTO oms_order (
      id, order_no, display_order_no, warehouse_entry_no, business_line, service_type_code,
      customer_id, customer_name, sales_user_id, creator_user_id, route_code, export_mode,
      order_status, order_status_updated_at, payment_status, payment_method, payment_channel, payment_time,
      currency_code, total_declared_weight_kg, total_declared_pieces, total_actual_weight_kg, total_actual_pieces,
      total_chargeable_weight_kg, total_receivable_amount, total_paid_amount,
      sender_name, sender_phone, sender_address, sender_district, sender_city_id, sender_country_id,
      consignee_name, consignee_phone, consignee_email, consignee_address, consignee_district, consignee_city_id, consignee_country_id,
      remark, created_by, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, 'BUYER_EXPORT',
      ?, ?, ?, ?, ?, ?,
      'CNY', ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, '白云区', 'CITY-GZ', 'CTRY-CN',
      ?, ?, ?, ?, 'IKEJA', 'CITY-LOS', 'CTRY-NG',
      ?, ?, ?, ?
    )
  `).run(
    orderId,
    orderNo,
    displayOrderNo,
    warehouseEntryNo,
    flow.businessLine,
    flow.serviceType,
    flow.customer.id,
    flow.customer.name,
    flow.salesUserId,
    flow.salesUserId,
    flow.routeCode,
    flow.orderStatus,
    createdAt,
    flow.paymentStatus,
    'PREPAID',
    'WECHAT',
    flow.paymentStatus === 'UNPAID' ? null : createdAt,
    totalWeight,
    totalPieces,
    totalWeight,
    totalPieces,
    totalWeight,
    flow.totalReceivable,
    flow.totalPaid,
    `${flow.customer.name} 发货`,
    flow.customer.contactPhone,
    `广州市白云区联调仓-${flow.businessLine}`,
    `${flow.customer.name} 收件`,
    flow.customer.contactPhone.replace(/^1/, '+234-8'),
    `${flow.customer.name.toUpperCase()}@demo.com`,
    `${flow.customer.name} Lagos Office`,
    flow.remark,
    flow.salesUserId,
    createdAt,
    createdAt
  );

  let jobId = null;
  const subRows = [];

  if (flow.job) {
    jobId = makeId('JOB');
    const jobNo = nextJobNo(flow.businessLine);
    v2Db.prepare(`
      INSERT INTO tms_job (
        id, job_no, business_line, pol_site_id, pod_site_id, carrier_supplier_id,
        vessel_voyage, flight_no, bill_no, current_phase, job_status,
        etd, eta, atd, ata, remark, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, 'SITE-GZ-ORIGIN', 'SITE-LOS-DEST', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId,
      jobNo,
      flow.businessLine,
      flow.businessLine === 'SEA' ? 'SUP-MAERSK' : 'SUP-CZ',
      flow.businessLine === 'SEA' ? `VV-${rand4()}` : null,
      flow.businessLine === 'AIR' ? `CZ${rand4()}` : null,
      `${flow.businessLine}-BL-${rand4()}`,
      flow.job.phase,
      flow.job.status,
      isoOffset(-1),
      isoOffset(4),
      flow.job.status === 'IN_TRANSIT' || flow.job.status === 'ARRIVED' ? isoOffset(0) : null,
      flow.job.status === 'ARRIVED' ? isoOffset(3) : null,
      `联调任务-${flow.name}`,
      flow.opsUserId,
      createdAt,
      createdAt
    );

    const unitIds = flow.job.units.map((unit, idx) => {
      const unitId = makeId('UNIT');
      const unitNo = `${flow.businessLine}-${unit.label}-${batch}-${String(idx + 1).padStart(2, '0')}`;
      v2Db.prepare(`
        INSERT INTO tms_shipping_unit (
          id, unit_no, business_line, unit_type, container_type, seal_no, warehouse_id, job_id,
          unit_status, max_weight_kg, max_volume_cbm, current_weight_kg, current_volume_cbm, created_at, updated_at
        ) VALUES (?, ?, ?, 'CONTAINER', ?, ?, ?, ?, ?, 26000, 76, ?, ?, ?, ?)
      `).run(
        unitId,
        unitNo,
        flow.businessLine,
        flow.businessLine === 'SEA' ? 'LCL' : 'AIR_PALLET',
        `SEAL-${rand4()}`,
        flow.businessLine === 'SEA' ? 'WH-GZ-001' : 'WH-SZ-001',
        jobId,
        unit.status,
        totalWeight / flow.job.units.length,
        1.2,
        createdAt,
        createdAt
      );
      return { unitId, unitNo };
    });

    summary.jobs.push({ jobId, jobNo, businessLine: flow.businessLine, units: unitIds.map((u) => u.unitNo) });
    flow._unitIds = unitIds;
  }

  for (let idx = 0; idx < subDefs.length; idx++) {
    const sub = subDefs[idx];
    const lineNo = idx + 1;
    const subId = makeId('SUB');
    const subNo = nextWaybillNo('oms_sub_order', 'sub_order_no', flow.businessLine);
    const unit = flow._unitIds ? flow._unitIds[sub.unitIndex || 0] : null;

    v2Db.prepare(`
      INSERT INTO oms_sub_order (
        id, sub_order_no, order_id, line_no, business_line, sub_status, sub_status_updated_at,
        route_code, service_type_code, bill_no, shipping_unit_id, job_id, container_no,
        chargeable_weight_kg, actual_weight_kg, volume_cbm, volume_weight_kg, pieces,
        remark, etd, eta, atd, ata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subId,
      subNo,
      orderId,
      lineNo,
      flow.businessLine,
      sub.status,
      createdAt,
      flow.routeCode,
      flow.serviceType,
      `${flow.businessLine}-BILL-${rand4()}`,
      unit ? unit.unitId : null,
      jobId,
      unit ? unit.unitNo : null,
      sub.weight,
      sub.weight,
      sub.volume,
      sub.volume * 167,
      sub.pieces,
      `${flow.name}-子单${lineNo}`,
      isoOffset(-1),
      isoOffset(3),
      sub.status === 'IN_TRANSIT' || sub.status === 'ARRIVED' || sub.status === 'DELIVERED' ? isoOffset(0) : null,
      sub.status === 'ARRIVED' || sub.status === 'DELIVERED' ? isoOffset(2) : null,
      createdAt,
      createdAt
    );

    if (jobId && unit) {
      v2Db.prepare(`
        INSERT INTO tms_job_order_rel (id, job_id, sub_order_id, shipping_unit_id, sequence_no, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(makeId('JREL'), jobId, subId, unit.unitId, lineNo, createdAt);
    }

    const initId = makeId('PKGI');
    const trackingNo = `${flow.businessLine}-TP-${batch}-${rand4()}`;
    v2Db.prepare(`
      INSERT INTO oms_order_package_initial (
        id, order_id, line_no, express_company, tracking_no, package_status, package_status_updated_at,
        goods_name, goods_category, cargo_desc, declared_weight_kg, pieces, declared_value_usd, remark, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'GENERAL', ?, ?, ?, ?, ?, ?)
    `).run(
      initId,
      orderId,
      lineNo,
      flow.businessLine === 'SEA' ? '顺丰' : 'DHL',
      trackingNo,
      sub.hasActual ? 'INBOUND' : 'PENDING_SIGN',
      createdAt,
      `${flow.name}-货物${lineNo}`,
      flow.businessLine === 'SEA' ? '海运货' : '空运货',
      sub.weight,
      sub.pieces,
      200 + lineNo * 20,
      `初始包裹-${flow.name}`,
      createdAt,
      createdAt
    );

    if (sub.hasActual) {
      v2Db.prepare(`
        INSERT INTO oms_order_package_actual (
          id, order_id, sub_order_id, initial_package_id, tracking_no, goods_name, cargo_desc,
          length_cm, width_cm, height_cm, pieces, gross_weight_kg, volume_cbm, volume_weight_kg,
          chargeable_weight_kg, package_status, package_status_updated_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'GENERAL', 40, 35, 30, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId('PKGA'),
        orderId,
        subId,
        initId,
        trackingNo,
        `${flow.name}-货物${lineNo}`,
        sub.pieces,
        sub.weight,
        sub.volume,
        sub.volume * 167,
        sub.weight,
        sub.actualStatus || 'IN_STOCK',
        createdAt,
        createdAt,
        createdAt
      );
    }

    v2Db.prepare(`
      INSERT INTO oms_order_status_log (
        id, order_id, sub_order_id, status_code, node_code, node_name, event_time, operator_user_id, remark, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      makeId('OSL'),
      orderId,
      subId,
      sub.status,
      'SUB_STATUS',
      '子单状态更新',
      createdAt,
      flow.opsUserId,
      `${flow.name}-${sub.status}`,
      createdAt
    );

    if (Array.isArray(sub.events)) {
      for (const evt of sub.events) {
        v2Db.prepare(`
          INSERT INTO tms_tracking_event (
            id, business_line, event_scope, order_id, sub_order_id, job_id, event_type,
            node_code, node_name, status_code, event_time, location, operator_user_id, remark, extra_json, created_at
          ) VALUES (?, ?, 'SUB_ORDER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          makeId('EVT'),
          flow.businessLine,
          orderId,
          subId,
          jobId,
          evt.eventType,
          evt.nodeCode,
          evt.nodeName,
          evt.statusCode,
          evt.eventTime,
          evt.siteName,
          flow.opsUserId,
          `${flow.name}-${evt.nodeName}`,
          JSON.stringify({ siteName: evt.siteName, siteCode: evt.siteCode || null }),
          createdAt
        );
      }
    }

    subRows.push({ subId, subNo, subStatus: sub.status });
  }

  if (flow.dpn && subRows.length > 0) {
    const dpnId = makeId('DPN');
    const dpnNo = `${flow.businessLine}-DPN-${batch}-${rand4()}`;
    const dpnSubRows = subRows.filter((_, idx) => flow.dpn.subIndexes.includes(idx));
    const totalDpnWeight = dpnSubRows.reduce((s, _, idx) => s + (flow.subDefs[flow.dpn.subIndexes[idx]].weight || 0), 0);

    v2Db.prepare(`
      INSERT INTO pod_dpn (
        id, dpn_no, business_line, warehouse_id, customer_id, recipient_name, recipient_phone, recipient_address,
        country_id, city_id, delivery_method, carrier_supplier_id, dpn_status, status_updated_at,
        total_pieces, total_weight_kg, total_receivable_amount, currency_code, payment_status, remark,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CTRY-NG', 'CITY-LOS', ?, 'SUP-LOS-LOCAL', ?, ?, ?, ?, ?, 'CNY', ?, ?, ?, ?, ?)
    `).run(
      dpnId,
      dpnNo,
      flow.businessLine,
      'WH-LOS-001',
      flow.customer.id,
      `${flow.customer.name}收件`,
      flow.customer.contactPhone.replace(/^1/, '+234-8'),
      `${flow.customer.name} Lagos Delivery`,
      flow.dpn.method,
      flow.dpn.status,
      createdAt,
      dpnSubRows.length,
      totalDpnWeight,
      300,
      flow.dpn.paymentStatus,
      `DPN-${flow.name}`,
      flow.opsDestUserId,
      createdAt,
      createdAt
    );

    for (const subRow of dpnSubRows) {
      v2Db.prepare(`
        INSERT INTO pod_dpn_item (id, dpn_id, order_id, sub_order_id, pieces, weight_kg, remark, created_at)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
      `).run(makeId('DPNI'), dpnId, orderId, subRow.subId, 10, `DPN item ${subRow.subNo}`, createdAt);
    }

    const taskStatus = flow.dpn.taskStatus || 'IN_TRANSIT';
    v2Db.prepare(`
      INSERT INTO pod_delivery_task (
        id, dpn_id, task_no, driver_user_id, driver_name, driver_phone, task_status,
        accepted_at, outbound_at, delivered_at, signed_at, sign_proof_json, remark, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      makeId('DTK'),
      dpnId,
      `${flow.businessLine}-DTK-${batch}-${rand4()}`,
      flow.opsDestUserId,
      flow.businessLine === 'SEA' ? 'Emeka Driver' : 'Abdul Driver',
      '+234-800-777-0001',
      taskStatus,
      isoOffset(1),
      isoOffset(1, 2),
      taskStatus === 'DELIVERED' || taskStatus === 'SIGNED' ? isoOffset(2) : null,
      taskStatus === 'SIGNED' ? isoOffset(2, 1) : null,
      taskStatus === 'SIGNED' ? JSON.stringify([{ url: 'https://demo.example/sign-proof.jpg' }]) : null,
      `配送任务-${flow.name}`,
      createdAt,
      createdAt
    );
  }

  if (flow.totalReceivable > 0) {
    const feeId = makeId('FEE');
    const feeStatus = flow.feeStatus || 'APPROVED';
    v2Db.prepare(`
      INSERT INTO fin_fee (
        id, fee_no, business_line, fee_level, related_id, related_no, fee_item_code, fee_direction,
        unit_price, quantity, amount, currency_code, fee_status, description, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, 'ORDER', ?, ?, 'FREIGHT', 'RECEIVABLE', ?, 1, ?, 'CNY', ?, ?, ?, ?, ?)
    `).run(
      feeId,
      `${flow.businessLine}-FEE-${batch}-${rand4()}`,
      flow.businessLine,
      orderId,
      orderNo,
      flow.totalReceivable,
      flow.totalReceivable,
      feeStatus,
      `费用-${flow.name}`,
      flow.salesUserId,
      createdAt,
      createdAt
    );

    if (flow.totalPaid > 0) {
      v2Db.prepare(`
        INSERT INTO fin_payment (
          id, payment_no, business_line, payment_type, related_fee_id, related_id,
          counterparty_type, counterparty_id, counterparty_name,
          amount, currency_code, payment_method, payment_channel, payment_status, payment_time,
          confirmed_by, confirmed_at, remark, created_at, updated_at
        ) VALUES (?, ?, ?, 'INBOUND', ?, ?, 'CUSTOMER', ?, ?, ?, 'CNY', 'WECHAT', 'WECHAT', 'CONFIRMED', ?, ?, ?, ?, ?, ?)
      `).run(
        makeId('PAY'),
        `${flow.businessLine}-PAY-${batch}-${rand4()}`,
        flow.businessLine,
        feeId,
        orderId,
        flow.customer.id,
        flow.customer.name,
        flow.totalPaid,
        createdAt,
        flow.financeUserId,
        createdAt,
        `收款-${flow.name}`,
        createdAt,
        createdAt
      );
    }

    if (feeStatus === 'PENDING_APPROVAL') {
      const instId = makeId('WFI');
      v2Db.prepare(`
        INSERT INTO wf_instance (
          id, process_code, business_line, business_type, business_id, instance_status,
          current_node_code, initiator_user_id, started_at, created_at, updated_at
        ) VALUES (?, 'FEE_APPROVAL_STD', ?, 'FEE', ?, 'RUNNING', 'FIN_REVIEW', ?, ?, ?, ?)
      `).run(instId, flow.businessLine, feeId, flow.salesUserId, createdAt, createdAt, createdAt);

      v2Db.prepare(`
        INSERT INTO wf_task (
          id, instance_id, node_code, node_name, assignee_user_id, task_status, created_at, updated_at
        ) VALUES (?, ?, 'FIN_REVIEW', '财务审核', ?, 'PENDING', ?, ?)
      `).run(makeId('WFT'), instId, flow.financeUserId, createdAt, createdAt);
    }
  }

  summary.orders.push({ orderId, orderNo, businessLine: flow.businessLine, status: flow.orderStatus, subs: subRows.map((s) => ({ no: s.subNo, status: s.subStatus })) });
}

function createUnmatchedPackage(def) {
  const inboundId = makeId('INB');
  const inboundNo = `${def.businessLine}-INB-${batch}-${rand4()}`;
  const itemId = makeId('INBI');
  const unmatchedId = makeId('UMP');

  v2Db.prepare(`
    INSERT INTO wms_inbound_order (
      id, inbound_no, business_line, warehouse_id, source_type, source_ref_no, inbound_status,
      inbound_at, operator_user_id, remark, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'NO_ORDER', ?, 'COMPLETED', ?, ?, ?, ?, ?)
  `).run(
    inboundId,
    inboundNo,
    def.businessLine,
    def.businessLine === 'SEA' ? 'WH-GZ-001' : 'WH-SZ-001',
    def.trackingNo,
    createdAt,
    def.operatorUserId,
    '无订单快递入库',
    createdAt,
    createdAt
  );

  v2Db.prepare(`
    INSERT INTO wms_inbound_item (
      id, inbound_order_id, tracking_no, pieces, gross_weight_kg, length_cm, width_cm, height_cm, volume_cbm,
      package_condition, location_code, item_status,
      sender_name, sender_phone, consignee_name, consignee_phone, customer_hint,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 40, 30, 25, ?, 'GOOD', ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    itemId,
    inboundId,
    def.trackingNo,
    1,
    def.weight,
    0.03,
    'NO_ORDER_ZONE',
    def.senderName,
    def.senderPhone,
    def.consigneeName,
    def.consigneePhone,
    def.customerHint,
    createdAt,
    createdAt
  );

  v2Db.prepare(`
    INSERT INTO wms_unmatched_package (
      id, business_line, warehouse_id, inbound_order_id, inbound_item_id,
      tracking_no, express_company, sender_name, sender_phone, consignee_name, consignee_phone, customer_hint,
      pieces, gross_weight_kg, volume_cbm, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0.03, 'PENDING', ?, ?)
  `).run(
    unmatchedId,
    def.businessLine,
    def.businessLine === 'SEA' ? 'WH-GZ-001' : 'WH-SZ-001',
    inboundId,
    itemId,
    def.trackingNo,
    def.expressCompany,
    def.senderName,
    def.senderPhone,
    def.consigneeName,
    def.consigneePhone,
    def.customerHint,
    def.weight,
    createdAt,
    createdAt
  );

  summary.unmatchedPackages.push({ unmatchedId, trackingNo: def.trackingNo, businessLine: def.businessLine });
}

function main() {
  const tx = v2Db.transaction(() => {
    ensureLegacyRouteTemplate();

    const customers = [
      createCustomer({ name: `联调公海客户A-${batch}`, ownerUserId: null, poolType: 'PUBLIC', source: '客户首单', address: '广州市白云区A座', contactName: '公海A', contactPhone: '13910000001', contactEmail: 'public.a@demo.com' }),
      createCustomer({ name: `联调公海客户B-${batch}`, ownerUserId: null, poolType: 'PUBLIC', source: '客户首单', address: '广州市白云区B座', contactName: '公海B', contactPhone: '13910000002', contactEmail: 'public.b@demo.com' }),
      createCustomer({ name: `联调私海客户SEA-${batch}`, ownerUserId: 'U-SALES-01', poolType: 'PRIVATE', source: '销售录入', address: '广州市白云区C座', contactName: '私海SEA', contactPhone: '13910000003', contactEmail: 'sea.private@demo.com' }),
      createCustomer({ name: `联调私海客户AIR-${batch}`, ownerUserId: 'U-SALES-02', poolType: 'PRIVATE', source: '销售录入', address: '广州市白云区D座', contactName: '私海AIR', contactPhone: '13910000004', contactEmail: 'air.private@demo.com' }),
      createCustomer({ name: `联调综合客户1-${batch}`, ownerUserId: 'U-SALES-01', poolType: 'PRIVATE', source: '老客复购', address: '广州市白云区E座', contactName: '综合1', contactPhone: '13910000005', contactEmail: 'mix1@demo.com' }),
      createCustomer({ name: `联调综合客户2-${batch}`, ownerUserId: 'U-SALES-02', poolType: 'PRIVATE', source: '展会线索', address: '广州市白云区F座', contactName: '综合2', contactPhone: '13910000006', contactEmail: 'mix2@demo.com' }),
    ];

    const [pubA, pubB, seaC, airC, mix1, mix2] = customers;

    insertOrderFlow({
      name: 'SEA待入库',
      customer: seaC,
      businessLine: 'SEA',
      serviceType: 'LCL_SEA',
      routeCode: 'GZ.CN→LOS.NGA',
      orderStatus: 'PENDING_INBOUND',
      paymentStatus: 'UNPAID',
      totalReceivable: 980,
      totalPaid: 0,
      remark: '待入库测试单',
      salesUserId: 'U-SALES-01',
      opsUserId: 'U-OPS-CN-01',
      opsDestUserId: 'U-OPS-US-01',
      financeUserId: 'U-FIN-01',
      subDefs: [
        { status: 'PENDING_INBOUND', weight: 18.5, pieces: 1, volume: 0.08, hasActual: false },
        { status: 'PENDING_INBOUND', weight: 22.0, pieces: 1, volume: 0.11, hasActual: false },
      ],
    });

    insertOrderFlow({
      name: 'SEA已入库待发运',
      customer: mix1,
      businessLine: 'SEA',
      serviceType: 'LCL_SEA',
      routeCode: 'GZ.CN→LOS.NGA',
      orderStatus: 'INBOUND',
      paymentStatus: 'PARTIAL',
      totalReceivable: 1800,
      totalPaid: 600,
      remark: '已入库待任务',
      salesUserId: 'U-SALES-01',
      opsUserId: 'U-OPS-CN-01',
      opsDestUserId: 'U-OPS-US-01',
      financeUserId: 'U-FIN-01',
      subDefs: [
        { status: 'INBOUND', weight: 28.5, pieces: 1, volume: 0.12, hasActual: true, actualStatus: 'IN_STOCK' },
        { status: 'PENDING_PACKING', weight: 31.0, pieces: 1, volume: 0.15, hasActual: true, actualStatus: 'PACKED' },
      ],
      job: {
        phase: 'ORIGIN',
        status: 'IN_PROGRESS',
        units: [
          { label: 'AK', status: 'LOADING' },
        ],
      },
    });

    insertOrderFlow({
      name: 'SEA运输中多集装',
      customer: mix2,
      businessLine: 'SEA',
      serviceType: 'LCL_SEA',
      routeCode: 'GZ.CN→LOS.NGA',
      orderStatus: 'IN_TRANSIT',
      paymentStatus: 'PARTIAL',
      totalReceivable: 3600,
      totalPaid: 1200,
      remark: '一个任务多集装测试',
      salesUserId: 'U-SALES-02',
      opsUserId: 'U-OPS-CN-01',
      opsDestUserId: 'U-OPS-US-01',
      financeUserId: 'U-FIN-01',
      subDefs: [
        {
          status: 'IN_TRANSIT', weight: 24.5, pieces: 1, volume: 0.1, hasActual: true, actualStatus: 'IN_TRANSIT', unitIndex: 0,
          events: [
            { eventType: 'WAREHOUSE', nodeCode: 'INBOUND', nodeName: '入库', statusCode: 'INBOUND', eventTime: isoOffset(-3), siteName: '白云区站点（广州总调度中心）' },
            { eventType: 'CUSTOMS', nodeCode: 'EXPORT_CUSTOMS', nodeName: '出口报关', statusCode: 'CUSTOMS_CLEARANCE', eventTime: isoOffset(-2), siteName: '白云区站点（广州总调度中心）' },
            { eventType: 'EXPORT', nodeCode: 'DEPARTED', nodeName: '离境', statusCode: 'IN_TRANSIT', eventTime: isoOffset(-1), siteName: '广州港' },
          ],
        },
        {
          status: 'IN_TRANSIT', weight: 26.0, pieces: 1, volume: 0.11, hasActual: true, actualStatus: 'IN_TRANSIT', unitIndex: 0,
          events: [
            { eventType: 'WAREHOUSE', nodeCode: 'PACKING', nodeName: '集装', statusCode: 'PACKED', eventTime: isoOffset(-2), siteName: '白云区站点（广州总调度中心）' },
            { eventType: 'EXPORT', nodeCode: 'DEPARTED', nodeName: '离境', statusCode: 'IN_TRANSIT', eventTime: isoOffset(-1), siteName: '广州港' },
          ],
        },
        {
          status: 'ARRIVED', weight: 20.0, pieces: 1, volume: 0.09, hasActual: true, actualStatus: 'ARRIVED', unitIndex: 1,
          events: [
            { eventType: 'IMPORT', nodeCode: 'ARRIVED_PORT', nodeName: '到港', statusCode: 'ARRIVED', eventTime: isoOffset(0), siteName: '拉各斯总调度中心' },
            { eventType: 'IMPORT', nodeCode: 'IMPORT_CUSTOMS', nodeName: '进口清关', statusCode: 'CUSTOMS_CLEARANCE', eventTime: isoOffset(1), siteName: '拉各斯总调度中心' },
          ],
        },
      ],
      job: {
        phase: 'LINE_HAUL',
        status: 'IN_TRANSIT',
        units: [
          { label: 'AK1', status: 'SHIPPED' },
          { label: 'AK2', status: 'SHIPPED' },
        ],
      },
    });

    insertOrderFlow({
      name: 'SEA已签收完成',
      customer: mix1,
      businessLine: 'SEA',
      serviceType: 'LCL_SEA',
      routeCode: 'GZ.CN→LOS.NGA',
      orderStatus: 'COMPLETED',
      paymentStatus: 'PAID',
      totalReceivable: 2100,
      totalPaid: 2100,
      remark: '海运全流程完成',
      salesUserId: 'U-SALES-01',
      opsUserId: 'U-OPS-CN-01',
      opsDestUserId: 'U-OPS-US-01',
      financeUserId: 'U-FIN-01',
      subDefs: [
        {
          status: 'DELIVERED', weight: 19.0, pieces: 1, volume: 0.08, hasActual: true, actualStatus: 'DELIVERED', unitIndex: 0,
          events: [
            { eventType: 'DELIVERY', nodeCode: 'DELIVERY_DISPATCH', nodeName: '派送', statusCode: 'DELIVERING', eventTime: isoOffset(-1), siteName: '伊科贾站点（拉各斯总调度中心）' },
            { eventType: 'DELIVERY', nodeCode: 'DELIVERED', nodeName: '签收', statusCode: 'DELIVERED', eventTime: isoOffset(0), siteName: '末端配送站' },
          ],
        },
      ],
      job: {
        phase: 'DESTINATION',
        status: 'COMPLETED',
        units: [
          { label: 'AKF', status: 'ARRIVED' },
        ],
      },
      dpn: {
        subIndexes: [0],
        method: 'DELIVERY',
        status: 'SIGNED',
        taskStatus: 'SIGNED',
        paymentStatus: 'PAID',
      },
    });

    insertOrderFlow({
      name: 'AIR待发运',
      customer: airC,
      businessLine: 'AIR',
      serviceType: 'STANDARD_AIR',
      routeCode: 'GZ.CN→LOS.NGA',
      orderStatus: 'PENDING_DEPARTURE',
      paymentStatus: 'UNPAID',
      totalReceivable: 1350,
      totalPaid: 0,
      remark: '空运待发运',
      salesUserId: 'U-SALES-02',
      opsUserId: 'U-OPS-CN-01',
      opsDestUserId: 'U-OPS-US-01',
      financeUserId: 'U-FIN-01',
      subDefs: [
        { status: 'PENDING_DEPARTURE', weight: 9.5, pieces: 1, volume: 0.04, hasActual: true, actualStatus: 'PACKED', unitIndex: 0 },
      ],
      job: {
        phase: 'ORIGIN',
        status: 'PLANNED',
        units: [
          { label: 'AIRP', status: 'LOADING' },
        ],
      },
    });

    insertOrderFlow({
      name: 'AIR运输中',
      customer: mix2,
      businessLine: 'AIR',
      serviceType: 'EXPRESS_AIR',
      routeCode: 'GZ.CN→LOS.NGA',
      orderStatus: 'IN_TRANSIT',
      paymentStatus: 'PARTIAL',
      totalReceivable: 2600,
      totalPaid: 1000,
      remark: '空运中转运输中',
      salesUserId: 'U-SALES-02',
      opsUserId: 'U-OPS-CN-01',
      opsDestUserId: 'U-OPS-US-01',
      financeUserId: 'U-FIN-01',
      subDefs: [
        {
          status: 'IN_TRANSIT', weight: 11.2, pieces: 1, volume: 0.05, hasActual: true, actualStatus: 'IN_TRANSIT', unitIndex: 0,
          events: [
            { eventType: 'EXPORT', nodeCode: 'DEPARTED', nodeName: '起飞', statusCode: 'IN_TRANSIT', eventTime: isoOffset(-1), siteName: '广州白云机场' },
            { eventType: 'IMPORT', nodeCode: 'ARRIVED_PORT', nodeName: '到达机场', statusCode: 'ARRIVED', eventTime: isoOffset(0), siteName: '拉各斯机场' },
          ],
        },
        {
          status: 'IN_TRANSIT', weight: 10.8, pieces: 1, volume: 0.05, hasActual: true, actualStatus: 'IN_TRANSIT', unitIndex: 0,
          events: [
            { eventType: 'EXPORT', nodeCode: 'DEPARTED', nodeName: '起飞', statusCode: 'IN_TRANSIT', eventTime: isoOffset(-1), siteName: '广州白云机场' },
          ],
        },
      ],
      job: {
        phase: 'LINE_HAUL',
        status: 'IN_TRANSIT',
        units: [
          { label: 'AIRC', status: 'SHIPPED' },
        ],
      },
    });

    insertOrderFlow({
      name: 'AIR异常待审核',
      customer: pubA,
      businessLine: 'AIR',
      serviceType: 'STANDARD_AIR',
      routeCode: 'GZ.CN→LOS.NGA',
      orderStatus: 'EXCEPTION',
      paymentStatus: 'UNPAID',
      totalReceivable: 900,
      totalPaid: 0,
      feeStatus: 'PENDING_APPROVAL',
      remark: '异常件等待审核',
      salesUserId: 'U-SALES-01',
      opsUserId: 'U-OPS-CN-01',
      opsDestUserId: 'U-OPS-US-01',
      financeUserId: 'U-FIN-01',
      subDefs: [
        {
          status: 'EXCEPTION', weight: 8.2, pieces: 1, volume: 0.03, hasActual: true, actualStatus: 'DAMAGED',
          events: [
            { eventType: 'EXCEPTION', nodeCode: 'EXCEPTION_DAMAGE', nodeName: '破损异常', statusCode: 'EXCEPTION', eventTime: isoOffset(0), siteName: '广州白云机场站' },
          ],
        },
      ],
    });

    insertOrderFlow({
      name: 'AIR签收完成',
      customer: pubB,
      businessLine: 'AIR',
      serviceType: 'EXPRESS_AIR',
      routeCode: 'GZ.CN→LOS.NGA',
      orderStatus: 'COMPLETED',
      paymentStatus: 'PAID',
      totalReceivable: 1680,
      totalPaid: 1680,
      remark: '空运全流程完成',
      salesUserId: 'U-SALES-02',
      opsUserId: 'U-OPS-CN-01',
      opsDestUserId: 'U-OPS-US-01',
      financeUserId: 'U-FIN-01',
      subDefs: [
        {
          status: 'DELIVERED', weight: 7.8, pieces: 1, volume: 0.03, hasActual: true, actualStatus: 'DELIVERED', unitIndex: 0,
          events: [
            { eventType: 'IMPORT', nodeCode: 'IMPORT_CUSTOMS', nodeName: '进口清关', statusCode: 'CUSTOMS_CLEARANCE', eventTime: isoOffset(-1), siteName: '拉各斯机场' },
            { eventType: 'DELIVERY', nodeCode: 'DELIVERED', nodeName: '签收', statusCode: 'DELIVERED', eventTime: isoOffset(0), siteName: '末端配送站' },
          ],
        },
      ],
      job: {
        phase: 'DESTINATION',
        status: 'COMPLETED',
        units: [
          { label: 'AIRF', status: 'ARRIVED' },
        ],
      },
      dpn: {
        subIndexes: [0],
        method: 'DELIVERY',
        status: 'SIGNED',
        taskStatus: 'SIGNED',
        paymentStatus: 'PAID',
      },
    });

    createUnmatchedPackage({
      businessLine: 'SEA',
      trackingNo: `SEA-NO-ORDER-${batch}-${rand4()}`,
      expressCompany: '顺丰',
      senderName: '无单寄件人A',
      senderPhone: '13920000001',
      consigneeName: '无单收件A',
      consigneePhone: '+234-801-111-0001',
      customerHint: '联调公海客户A',
      weight: 12.5,
      operatorUserId: 'U-OPS-CN-01',
    });

    createUnmatchedPackage({
      businessLine: 'SEA',
      trackingNo: `SEA-NO-ORDER-${batch}-${rand4()}`,
      expressCompany: '中通',
      senderName: '无单寄件人B',
      senderPhone: '13920000002',
      consigneeName: '无单收件B',
      consigneePhone: '+234-801-222-0002',
      customerHint: '联调综合客户1',
      weight: 9.8,
      operatorUserId: 'U-OPS-CN-01',
    });

    createUnmatchedPackage({
      businessLine: 'AIR',
      trackingNo: `AIR-NO-ORDER-${batch}-${rand4()}`,
      expressCompany: 'DHL',
      senderName: '无单寄件人C',
      senderPhone: '13920000003',
      consigneeName: '无单收件C',
      consigneePhone: '+234-801-333-0003',
      customerHint: '联调私海客户AIR',
      weight: 4.2,
      operatorUserId: 'U-OPS-CN-01',
    });
  });

  tx();

  console.log(JSON.stringify(summary, null, 2));
}

try {
  main();
} finally {
  v2Db.close();
  legacyDb.close();
}
