#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001/api';
const ROOT = path.resolve(__dirname, '../..');
const DB_PATH = path.resolve(ROOT, 'server/logistics.db');

const results = [];
let db = null;

function pushResult({ id, name, pass, expected, actual, evidence, phase = 'P0' }) {
  results.push({
    id,
    name,
    pass: Boolean(pass),
    expected: String(expected ?? ''),
    actual: String(actual ?? ''),
    evidence: String(evidence ?? ''),
    phase,
    at: new Date().toISOString(),
  });
}

function safe(v) {
  return String(v ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br/>');
}

function getDb() {
  if (db) return db;
  const BetterSqlite3 = require(path.resolve(ROOT, 'server/node_modules/better-sqlite3'));
  db = new BetterSqlite3(DB_PATH, { readonly: true, fileMustExist: true });
  db.pragma('busy_timeout = 5000');
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function placeholders(count) {
  return Array.from({ length: count }, () => '?').join(',');
}

async function api(method, endpoint, body) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload;
  try {
    payload = await res.json();
  } catch {
    payload = { success: false, error: `Non-JSON response, status=${res.status}` };
  }

  if (!res.ok || payload.success === false) {
    const msg = payload?.error || payload?.message || `HTTP ${res.status}`;
    throw new Error(`${method} ${endpoint} failed: ${msg}`);
  }
  return payload;
}

async function waitForServer() {
  const start = Date.now();
  let lastErr = '';
  while (Date.now() - start < 30000) {
    try {
      await api('GET', '/jobs');
      return;
    } catch (err) {
      lastErr = err.message;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Server not ready in 30s: ${lastErr}`);
}

function checkPageContract(id, name, file, pattern, expected) {
  const abs = path.resolve(ROOT, file);
  try {
    const content = fs.readFileSync(abs, 'utf8');
    const ok = pattern.test(content);
    pushResult({
      id,
      name,
      pass: ok,
      expected,
      actual: ok ? 'matched' : 'not matched',
      evidence: file,
    });
  } catch (err) {
    pushResult({
      id,
      name,
      pass: false,
      expected,
      actual: `read file failed: ${err.message}`,
      evidence: file,
    });
  }
}

function calcMasterStatusBySubs(subStatuses) {
  if (!subStatuses.length) return 'PENDING_INBOUND';
  if (subStatuses.includes('EXCEPTION')) return 'EXCEPTION';
  if (subStatuses.every((s) => s === 'DELIVERED')) return 'COMPLETED';
  if (subStatuses.includes('DELIVERED')) return 'PARTIAL_DELIVERED';
  if (subStatuses.every((s) => s === 'ARRIVED')) return 'ARRIVED';
  if (subStatuses.some((s) => ['IN_TRANSIT', 'CUSTOMS_CLEARANCE'].includes(s))) return 'IN_TRANSIT';
  if (subStatuses.every((s) => ['PENDING_DEPARTURE', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'ARRIVED', 'PENDING_DELIVERY', 'DELIVERING', 'DELIVERED'].includes(s))) {
    return 'DEPARTED';
  }
  if (subStatuses.includes('PENDING_DEPARTURE')) return 'PENDING_DEPARTURE';
  if (subStatuses.every((s) => ['INBOUND', 'PENDING_PACKING', 'PACKED', 'PENDING_DEPARTURE'].includes(s))) return 'INBOUND';
  return 'PENDING_INBOUND';
}

async function main() {
  const runStart = new Date().toISOString();
  const suffix = Date.now();
  const evidence = {};

  await waitForServer();

  // A组：页面行为契约
  checkPageContract('A01', '任务创建动作映射', 'client/src/pages/tms/OriginJobList.tsx', /\bjobApi\.create\s*\(/, 'OriginJobList 调用 jobApi.create');
  checkPageContract('A02', '运输单元创建动作映射', 'client/src/pages/wms/origin/ContainerMgt.tsx', /\bwarehouseApi\.createUnit\s*\(/, 'ContainerMgt 调用 warehouseApi.createUnit');
  checkPageContract('A03', '任务绑定动作映射', 'client/src/pages/wms/origin/ContainerMgt.tsx', /\bjobApi\.bindUnits\s*\(/, 'ContainerMgt 调用 jobApi.bindUnits');
  checkPageContract('A04', '主单创建动作映射', 'client/src/pages/oms/OrderListV2.tsx', /\borderApi\.createMaster\s*\(/, 'OrderListV2 调用 orderApi.createMaster');
  checkPageContract('A05', '子单创建接口存在', 'server/src/routes/orders.ts', /router\.post\('\/sub'/, '存在 POST /api/orders/sub');
  checkPageContract('A06', '起运入库动作映射', 'app/src/pages/inbound/InboundForm.tsx', /\bwarehouseApi\.createInbound\s*\(/, 'InboundForm 调用 warehouseApi.createInbound');
  checkPageContract('A07', '装载动作映射', 'app/src/pages/packing/PackingTaskDetail.tsx', /\bwarehouseApi\.loadUnit\s*\(/, 'PackingTaskDetail 调用 warehouseApi.loadUnit');
  checkPageContract('A08', '封箱动作映射', 'app/src/pages/packing/PackingTaskDetail.tsx', /\bwarehouseApi\.sealUnit\s*\(/, 'PackingTaskDetail 调用 warehouseApi.sealUnit');
  checkPageContract('A09', '配送创建动作映射', 'app/src/pages/warehouse-us/delivery/DeliveryCreate.tsx', /\bdeliveryApi\.create\s*\(/, 'DeliveryCreate 调用 deliveryApi.create');
  checkPageContract('A10', '派单签收动作映射', 'app/src/pages/warehouse-us/delivery/DeliveryDetail.tsx', /\bdeliveryApi\.(assign|sign)\s*\(/, 'DeliveryDetail 调用 deliveryApi.assign/sign');
  checkPageContract('A11', '费用录入动作映射', 'client/src/pages/finance/FeeInput.tsx', /\bfeeApi\.create\s*\(/, 'FeeInput 调用 feeApi.create');
  checkPageContract('A12', '费用审批动作映射', 'client/src/pages/finance/FeeApproval.tsx', /\bfeeApi\.(approve|reject)\s*\(/, 'FeeApproval 调用 feeApi.approve/reject');
  checkPageContract('A13', '到达国集装箱入库动作映射', 'app/src/pages/warehouse-us/container/ContainerTaskDetail.tsx', /\bwarehouseApi\.createInbound\s*\(/, 'ContainerTaskDetail 调用 warehouseApi.createInbound');
  checkPageContract('A14', '到达国集装箱详情真实子单查询', 'app/src/pages/warehouse-us/container/ContainerTaskDetail.tsx', /\borderApi\.listSub\s*\(/, 'ContainerTaskDetail 调用 orderApi.listSub');
  checkPageContract('A15', '待入库列表真实待入库查询', 'app/src/pages/inbound/PendingInboundList.tsx', /\borderApi\.listSub\s*\(\s*\{\s*status:\s*'PENDING_INBOUND'/, 'PendingInboundList 调用 orderApi.listSub(PENDING_INBOUND)');
  checkPageContract('A16', '到达国扫码入库货况映射', 'app/src/pages/warehouse-us/inbound/InboundScan.tsx', /mapConditionToPackage[\s\S]*SHORT[\s\S]*INCOMPLETE/, 'InboundScan 将 SHORT 映射为 INCOMPLETE');
  checkPageContract('A17', '到达国集装箱任务列表真实数据源', 'app/src/pages/warehouse-us/container/ContainerTaskList.tsx', /warehouseApi\.listStock\s*\(\s*\{\s*warehouse:\s*'US'\s*\}\s*\)[\s\S]*orderApi\.listSub/, 'ContainerTaskList 联合查询 US 库存与子单');
  checkPageContract('A18', '起运国扫码页异常上报动作映射', 'app/src/pages/warehouse-cn/ScanOrder.tsx', /orderApi\.updateSub[\s\S]*status:\s*'EXCEPTION'/, 'ScanOrder 调用 orderApi.updateSub(EXCEPTION)');
  checkPageContract('A19', '起运国扫码页装箱动作映射', 'app/src/pages/warehouse-cn/ScanOrder.tsx', /warehouseApi\.loadUnit\s*\(/, 'ScanOrder 调用 warehouseApi.loadUnit');
  checkPageContract('A20', '起运国扫码页出库动作映射', 'app/src/pages/warehouse-cn/ScanOrder.tsx', /orderApi\.updateSub[\s\S]*status:\s*'PENDING_DEPARTURE'/, 'ScanOrder 调用 orderApi.updateSub(PENDING_DEPARTURE)');
  checkPageContract('A21', '起运国扫码页退运动作映射', 'app/src/pages/warehouse-cn/ScanOrder.tsx', /warehouseApi\.createReturn[\s\S]*RETURN_APPLIED/, 'ScanOrder 调用 warehouseApi.createReturn 并更新 RETURN_APPLIED');

  // 登录可用性校验（角色存在）
  const loginUsers = [
    ['sales1', 'sales123'],
    ['ops_cn1', 'ops123'],
    ['warehouse_cn1', 'wh123'],
    ['warehouse_us1', 'wh123'],
    ['finance1', 'fin123'],
  ];
  for (const [u, p] of loginUsers) {
    try {
      const r = await api('POST', '/auth/login', { username: u, password: p });
      pushResult({
        id: `AUTH-${u}`,
        name: `登录校验(${u})`,
        pass: Boolean(r.data?.token),
        expected: '返回 token',
        actual: r.data?.token ? 'token exists' : 'token missing',
        evidence: '/api/auth/login',
      });
    } catch (err) {
      pushResult({
        id: `AUTH-${u}`,
        name: `登录校验(${u})`,
        pass: false,
        expected: '返回 token',
        actual: err.message,
        evidence: '/api/auth/login',
      });
    }
  }

  // B01: 创建任务（任务先行）
  const jobNo = `E2E-SEA-JOB-${suffix}`;
  const jobCreate = await api('POST', '/jobs', {
    jobNo,
    route: '深圳 → 拉各斯',
    pol: '深圳港',
    pod: '拉各斯港',
    carrier: 'E2E CARRIER',
    transportType: 'SEA',
    etd: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    eta: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
    remark: 'E2E sea closed-loop',
  });
  const job = jobCreate.data;
  evidence.jobNo = jobNo;
  pushResult({
    id: 'B01',
    name: '创建任务（计划先行）',
    pass: job.jobNo === jobNo && job.status === 'PLANNED',
    expected: 'jobNo匹配，状态=PLANNED',
    actual: `jobNo=${job.jobNo}, status=${job.status}`,
    evidence: `/api/jobs ${jobNo}`,
  });

  // B02: 任务绑定多单元（2个）
  const unit1 = (await api('POST', '/warehouse/units', {
    unitNo: `E2E-SEA-UNIT1-${suffix}`,
    unitType: '40HQ',
    transportMode: 'SEA',
    maxWeight: 26000,
    maxVolume: 76,
    warehouse: '深圳仓',
    warehouseId: 'WH-GZ-001',
    remark: 'E2E unit1',
  })).data;

  const unit2 = (await api('POST', '/warehouse/units', {
    unitNo: `E2E-SEA-UNIT2-${suffix}`,
    unitType: '40HQ',
    transportMode: 'SEA',
    maxWeight: 26000,
    maxVolume: 76,
    warehouse: '深圳仓',
    warehouseId: 'WH-GZ-001',
    remark: 'E2E unit2',
  })).data;

  await api('POST', `/jobs/${jobNo}/bind-units`, { unitIds: [unit1.id, unit2.id] });
  const jobAfterBind = (await api('GET', `/jobs/${jobNo}`)).data;
  const boundUnits = (jobAfterBind.shippingUnitIds || []).length;
  pushResult({
    id: 'B02',
    name: '任务绑定多单元',
    pass: boundUnits >= 2,
    expected: '任务绑定 >=2 个运输单元',
    actual: `boundUnits=${boundUnits}`,
    evidence: `/api/jobs/${jobNo}`,
  });

  // B03: 新建主订单（含快递包裹 — 用户下单时填写的第三方快递信息）
  const expressDefs = [
    { expressCompany: 'SF', name: 'E2E cargo 1', category: '电子产品', cargoType: '普货', weight: 40, pieces: 10, declaredValue: 1000 },
    { expressCompany: 'YTO', name: 'E2E cargo 2', category: '日用品', cargoType: '普货', weight: 45, pieces: 12, declaredValue: 2000 },
    { expressCompany: 'ZTO', name: 'E2E cargo 3', category: '服装', cargoType: '普货', weight: 35, pieces: 8, declaredValue: 3000 },
  ];
  const master = (await api('POST', '/orders/master', {
    customerId: 'C1',
    customerName: '深圳大疆贸易有限公司',
    sender: '测试发货人',
    senderPhone: '13800000000',
    senderAddress: '广东深圳',
    consignee: 'E2E收件人',
    consigneePhone: '+234-800-0000000',
    destCountry: '尼日利亚',
    destCity: '拉各斯',
    destAddress: 'Lagos E2E Address',
    transportType: 'SEA',
    totalPieces: 30,
    totalWeight: 120,
    totalVolume: 1.2,
    totalValue: 6000,
    totalFreight: 1800,
    salesPerson: 'sales1',
    remark: 'E2E master order',
    expressPackages: expressDefs.map((def, i) => ({
      ...def,
      trackingNo: `E2E-TRACK-${suffix}-${i + 1}`,
    })),
  })).data;
  evidence.masterId = master.id;
  evidence.orderNo = master.orderNo;
  pushResult({
    id: 'B03',
    name: '新建主订单',
    pass: master.status === 'PENDING_INBOUND',
    expected: '主单状态=PENDING_INBOUND',
    actual: `status=${master.status}`,
    evidence: `/api/orders/master/${master.id}`,
  });

  // B04: 创建3个子单（模拟仓库收货后每个快递包裹创建一个子单）
  const subDefs = [
    { idx: 1, pieces: 10, weight: 40, volume: 0.4 },
    { idx: 2, pieces: 12, weight: 45, volume: 0.45 },
    { idx: 3, pieces: 8, weight: 35, volume: 0.35 },
  ];
  const subs = [];
  for (const def of subDefs) {
    const ep = expressDefs[def.idx - 1];
    const sub = (await api('POST', '/orders/sub', {
      subOrderNo: `${master.orderNo}-E2E-${def.idx}`,
      masterOrderId: master.id,
      batchNo: 1,
      pieces: def.pieces,
      weight: def.weight,
      volume: def.volume,
      value: 1000 * def.idx,
      transportType: 'SEA',
      route: '深圳 → 拉各斯',
      consignee: 'E2E收件人',
      consigneePhone: '+234-800-0000000',
      destCountry: '尼日利亚',
      destCity: '拉各斯',
      destAddress: 'Lagos E2E Address',
      expressCompany: ep.expressCompany,
      expressTrackingNo: `E2E-TRACK-${suffix}-${def.idx}`,
      goodsDescription: ep.name,
      remark: 'created by e2e test',
    })).data;
    subs.push(sub);
  }

  // 关联快递包裹到子单（模拟仓库收货后将包裹分配给子单）
  const masterDetail = (await api('GET', `/orders/master/${master.id}`)).data;
  const pkgs = masterDetail.expressPackages || [];
  if (pkgs.length > 0) {
    const linkedPkgs = pkgs.map((pkg, i) => ({
      ...pkg,
      subOrderId: subs[i] ? subs[i].id : null,
    }));
    await api('PUT', `/orders/master/${master.id}`, { expressPackages: linkedPkgs });
  }

  const subList = await api('GET', `/orders/sub?masterOrderId=${master.id}&pageSize=100`);
  const subCount = (subList.data || []).length;
  pushResult({
    id: 'B04',
    name: '主单拆分多子单',
    pass: subCount === 3,
    expected: '主单下子单数=3',
    actual: `subCount=${subCount}`,
    evidence: `/api/orders/sub?masterOrderId=${master.id}`,
  });

  // B05: 单元装载多子单（unit1装2个，unit2装1个）
  await api('POST', `/warehouse/units/${unit1.id}/load`, { subOrderIds: [subs[0].id, subs[1].id] });
  await api('POST', `/warehouse/units/${unit2.id}/load`, { subOrderIds: [subs[2].id] });
  const unitsAfterLoad = (await api('GET', `/warehouse/units?jobNo=${jobNo}`)).data || [];
  const unit1Data = unitsAfterLoad.find((u) => u.id === unit1.id);
  const unit2Data = unitsAfterLoad.find((u) => u.id === unit2.id);
  const u1Count = (unit1Data?.orderIds || []).length;
  const u2Count = (unit2Data?.orderIds || []).length;
  pushResult({
    id: 'B05',
    name: '单元装载多子单',
    pass: u1Count === 2 && u2Count === 1,
    expected: 'Unit1=2, Unit2=1',
    actual: `Unit1=${u1Count}, Unit2=${u2Count}`,
    evidence: `/api/warehouse/units?jobNo=${jobNo}`,
  });

  // B06: 起运入库（3子单）
  for (let i = 0; i < subs.length; i += 1) {
    await api('POST', '/warehouse/inbound', {
      subOrderId: subs[i].id,
      masterOrderId: master.id,
      trackingNo: `E2E-INB-TRACK-${suffix}-${i + 1}`,
      expressCompany: 'SF',
      clientCode: 'C1',
      clientName: '深圳大疆贸易有限公司',
      pieces: subDefs[i].pieces,
      actualWeight: subDefs[i].weight,
      actualVolume: subDefs[i].volume,
      inboundMethod: 'SCAN',
      warehouseLocation: `A-0${i + 1}`,
      warehouse: 'CN',
      warehouseId: 'WH-GZ-001',
      operator: 'warehouse_cn1',
      remark: 'e2e inbound',
    });
  }
  const subAfterInbound = [];
  for (const s of subs) {
    const one = (await api('GET', `/orders/sub/${s.id}`)).data;
    subAfterInbound.push(one);
  }
  const inboundAll = subAfterInbound.every((s) => s.status === 'INBOUND');
  pushResult({
    id: 'B06',
    name: '起运入库',
    pass: inboundAll,
    expected: '3个子单状态均为INBOUND',
    actual: subAfterInbound.map((s) => s.status).join(','),
    evidence: `/api/orders/sub/:id x3`,
  });

  // B07: 封箱
  const seal1 = (await api('POST', `/warehouse/units/${unit1.id}/seal`, { sealNo: `SEAL-${suffix}-1` })).data;
  const seal2 = (await api('POST', `/warehouse/units/${unit2.id}/seal`, { sealNo: `SEAL-${suffix}-2` })).data;
  pushResult({
    id: 'B07',
    name: '装载后封箱',
    pass: seal1.status === 'SEALED' && seal2.status === 'SEALED',
    expected: '两个单元均SEALED',
    actual: `unit1=${seal1.status}, unit2=${seal2.status}`,
    evidence: `/api/warehouse/units/:id/seal`,
  });

  // B08: 发运前子单状态
  for (const s of subs) {
    await api('PUT', `/orders/sub/${s.id}/status`, {
      status: 'PENDING_DEPARTURE',
      currentNode: '等待发货',
    });
  }
  const subAfterPendingDeparture = [];
  for (const s of subs) {
    const one = (await api('GET', `/orders/sub/${s.id}`)).data;
    subAfterPendingDeparture.push(one);
  }
  pushResult({
    id: 'B08',
    name: '发运前状态切换',
    pass: subAfterPendingDeparture.every((s) => s.status === 'PENDING_DEPARTURE'),
    expected: '子单状态全部=PENDING_DEPARTURE',
    actual: subAfterPendingDeparture.map((s) => s.status).join(','),
    evidence: `/api/orders/sub/:id/status`,
  });

  // B09: 任务状态全链路
  const lifecycle = [
    { status: 'IN_PROGRESS', currentPhase: 'ORIGIN', originPhaseStatus: 'IN_PROGRESS' },
    { status: 'DEPARTED', currentPhase: 'IN_TRANSIT', originPhaseStatus: 'DEPARTED' },
    { status: 'IN_TRANSIT', currentPhase: 'IN_TRANSIT' },
    { status: 'ARRIVED', currentPhase: 'DESTINATION', destPhaseStatus: 'ARRIVED' },
    { status: 'CLEARED', currentPhase: 'DESTINATION', destPhaseStatus: 'CLEARED' },
    { status: 'COMPLETED', currentPhase: 'DESTINATION', destPhaseStatus: 'COMPLETED' },
  ];
  for (const step of lifecycle) {
    await api('PUT', `/jobs/${jobNo}`, step);
  }
  const jobAfterLifecycle = (await api('GET', `/jobs/${jobNo}`)).data;
  pushResult({
    id: 'B09',
    name: '任务运输过程状态切换',
    pass: jobAfterLifecycle.status === 'COMPLETED',
    expected: '任务状态最终=COMPLETED',
    actual: `status=${jobAfterLifecycle.status}`,
    evidence: `/api/jobs/${jobNo}`,
  });

  // B10/B11/B12: 配送创建、派单、签收
  const delivery = (await api('POST', '/delivery', {
    recipientName: 'E2E收件人',
    recipientPhone: '+234-800-0000000',
    recipientAddress: 'Lagos E2E Address',
    city: '拉各斯',
    country: '尼日利亚',
    deliveryMethod: 'DELIVERY',
    totalPieces: subDefs.reduce((acc, x) => acc + x.pieces, 0),
    totalWeight: subDefs.reduce((acc, x) => acc + x.weight, 0),
    deliveryFee: 120,
    currency: 'USD',
    remark: 'e2e delivery',
    createdBy: 'ops_us1',
    subOrderIds: subs.map((s) => s.id),
  })).data;
  evidence.deliveryId = delivery.id;
  pushResult({
    id: 'B10',
    name: '配送单创建',
    pass: delivery.status === 'PENDING',
    expected: '配送单状态=PENDING',
    actual: `status=${delivery.status}`,
    evidence: `/api/delivery (id=${delivery.id})`,
  });

  const assigned = (await api('POST', `/delivery/${delivery.id}/assign`, {
    driverId: 'USR-009',
    driverName: 'Emmanuel',
    driverPhone: '+234-803-1234567',
  })).data;
  pushResult({
    id: 'B11',
    name: '配送派单',
    pass: assigned.status === 'ACCEPTED',
    expected: '配送单状态=ACCEPTED',
    actual: `status=${assigned.status}`,
    evidence: `/api/delivery/${delivery.id}/assign`,
  });

  await api('PUT', `/delivery/${delivery.id}`, { status: 'IN_TRANSIT' });
  const signed = (await api('POST', `/delivery/${delivery.id}/sign`, { photos: [] })).data;
  pushResult({
    id: 'B12',
    name: '配送签收',
    pass: signed.status === 'SIGNED',
    expected: '配送单状态=SIGNED',
    actual: `status=${signed.status}`,
    evidence: `/api/delivery/${delivery.id}/sign`,
  });

  // B13: 子单签收（手动推进）
  for (const s of subs) {
    await api('PUT', `/orders/sub/${s.id}/status`, { status: 'DELIVERED', currentNode: '已签收' });
  }
  const subAfterDelivered = [];
  for (const s of subs) {
    const one = (await api('GET', `/orders/sub/${s.id}`)).data;
    subAfterDelivered.push(one);
  }
  pushResult({
    id: 'B13',
    name: '子单签收完成',
    pass: subAfterDelivered.every((s) => s.status === 'DELIVERED'),
    expected: '3个子单状态均为DELIVERED',
    actual: subAfterDelivered.map((s) => s.status).join(','),
    evidence: `/api/orders/sub/:id/status`,
  });

  // C01/C02/C03：关系一致性
  const jobFinal = (await api('GET', `/jobs/${jobNo}`)).data;
  const finalUnits = (await api('GET', `/warehouse/units?jobNo=${jobNo}`)).data || [];
  const finalSubs = (await api('GET', `/orders/sub?masterOrderId=${master.id}&pageSize=100`)).data || [];

  pushResult({
    id: 'C01',
    name: '关系一致性 JOB->UNIT',
    pass: (jobFinal.shippingUnitIds || []).length >= 2,
    expected: '任务下运输单元数>=2',
    actual: `count=${(jobFinal.shippingUnitIds || []).length}`,
    evidence: `/api/jobs/${jobNo}`,
  });

  const finalU1 = finalUnits.find((u) => u.id === unit1.id);
  const finalU2 = finalUnits.find((u) => u.id === unit2.id);
  pushResult({
    id: 'C02',
    name: '关系一致性 UNIT->SUB',
    pass: (finalU1?.orderIds || []).length === 2 && (finalU2?.orderIds || []).length === 1,
    expected: 'Unit1=2, Unit2=1',
    actual: `Unit1=${(finalU1?.orderIds || []).length}, Unit2=${(finalU2?.orderIds || []).length}`,
    evidence: `/api/warehouse/units?jobNo=${jobNo}`,
  });

  pushResult({
    id: 'C03',
    name: '关系一致性 MASTER->SUB',
    pass: finalSubs.length === 3,
    expected: '主单下子单=3',
    actual: `count=${finalSubs.length}`,
    evidence: `/api/orders/sub?masterOrderId=${master.id}`,
  });

  // C04：主单状态一致性（基于子单推导）
  const masterFinal = (await api('GET', `/orders/master/${master.id}`)).data;
  const derivedMasterStatus = calcMasterStatusBySubs(finalSubs.map((s) => s.status));
  pushResult({
    id: 'C04',
    name: '状态一致性（主单 vs 子单汇总）',
    pass: masterFinal.status === derivedMasterStatus,
    expected: `master.status=${derivedMasterStatus}`,
    actual: `master.status=${masterFinal.status}, derived=${derivedMasterStatus}`,
    evidence: `/api/orders/master/${master.id}`,
  });

  // C05：配送签收对子单联动（在手动DELIVERED前应自动联动）
  // 这里用 delivery 签收后、手动置 DELIVERED 前的快照来判断是否有自动联动
  // 因脚本已经推进到 DELIVERED，这里改为通过签收后接口逻辑判断：delivery/sign 未包含 sub_orders 更新逻辑
  const deliveryRouteFile = path.resolve(ROOT, 'server/src/routes/delivery.ts');
  const deliveryRouteContent = fs.readFileSync(deliveryRouteFile, 'utf8');
  const hasSubOrderUpdateOnSign = /router\.post\('\/:id\/sign'[\s\S]*UPDATE\s+sub_orders/i.test(deliveryRouteContent);
  pushResult({
    id: 'C05',
    name: '状态一致性（签收对子单联动）',
    pass: hasSubOrderUpdateOnSign,
    expected: 'delivery sign 触发 sub_orders 状态联动',
    actual: hasSubOrderUpdateOnSign ? 'detected' : 'not detected',
    evidence: 'server/src/routes/delivery.ts',
  });

  // C06：入库对库存联动
  let stockHits = 0;
  for (const s of finalSubs) {
    const rows = (await api('GET', `/warehouse/stock?keyword=${encodeURIComponent(s.subOrderNo)}`)).data || [];
    if (rows.some((r) => r.subOrderNo === s.subOrderNo)) stockHits += 1;
  }
  pushResult({
    id: 'C06',
    name: '状态一致性（入库->库存）',
    pass: stockHits === finalSubs.length,
    expected: `命中库存记录=${finalSubs.length}`,
    actual: `stockHits=${stockHits}`,
    evidence: '/api/warehouse/stock?keyword=...',
  });

  // C07/C08/C09：财务一致性
  const feeRecv = (await api('POST', '/fees', {
    relatedType: 'ORDER',
    relatedId: master.id,
    relatedNo: master.orderNo,
    feeType: 'FREIGHT_INCOME',
    feeDirection: 'RECEIVABLE',
    amount: 1800,
    currency: 'CNY',
    createdBy: 'sales1',
    customerId: master.customerId,
    customerName: master.customerName,
    description: 'E2E receivable',
  })).data;

  const feePay = (await api('POST', '/fees', {
    relatedType: 'JOB',
    relatedId: jobNo,
    relatedNo: jobNo,
    feeType: 'CARRIER_COST',
    feeDirection: 'PAYABLE',
    amount: 900,
    currency: 'CNY',
    createdBy: 'ops_cn1',
    supplierName: 'E2E CARRIER',
    description: 'E2E payable',
  })).data;

  await api('POST', `/fees/${feeRecv.id}/approve`, { approver: 'finance1' });
  await api('POST', `/fees/${feePay.id}/approve`, { approver: 'finance1' });

  const recvFees = (await api('GET', `/fees?relatedType=ORDER&relatedId=${master.id}`)).data || [];
  const payFees = (await api('GET', `/fees?relatedType=JOB&relatedId=${jobNo}`)).data || [];
  const recvApproved = recvFees.filter((f) => f.status === 'APPROVED');
  const payApproved = payFees.filter((f) => f.status === 'APPROVED');
  const recvSum = recvApproved.reduce((acc, f) => acc + Number(f.amount || 0), 0);
  const paySum = payApproved.reduce((acc, f) => acc + Number(f.amount || 0), 0);
  const profit = recvSum - paySum;

  pushResult({
    id: 'C07',
    name: '财务一致性（订单应收）',
    pass: recvApproved.length > 0 && recvSum === 1800,
    expected: '订单应收审批后金额=1800',
    actual: `approvedCount=${recvApproved.length}, sum=${recvSum}`,
    evidence: `/api/fees?relatedType=ORDER&relatedId=${master.id}`,
  });

  pushResult({
    id: 'C08',
    name: '财务一致性（任务应付）',
    pass: payApproved.length > 0 && paySum === 900,
    expected: '任务应付审批后金额=900',
    actual: `approvedCount=${payApproved.length}, sum=${paySum}`,
    evidence: `/api/fees?relatedType=JOB&relatedId=${jobNo}`,
  });

  pushResult({
    id: 'C09',
    name: '财务一致性（利润核算）',
    pass: profit === 900,
    expected: '利润=1800-900=900',
    actual: `profit=${profit}`,
    evidence: 'receivable/payable approved fees',
  });

  // C10/C11：日志留痕
  let subWithLogs = 0;
  let logTimestampOk = 0;
  for (const s of finalSubs) {
    const subDetail = (await api('GET', `/orders/sub/${s.id}`)).data;
    const logs = subDetail.logisticsRecords || [];
    if (logs.length > 0) subWithLogs += 1;
    if (logs.every((l) => Boolean(l.timestamp))) logTimestampOk += 1;
  }
  pushResult({
    id: 'C10',
    name: '日志一致性（关键动作留痕）',
    pass: subWithLogs === finalSubs.length,
    expected: `每个子单均有logistics_records（${finalSubs.length}/${finalSubs.length}）`,
    actual: `${subWithLogs}/${finalSubs.length}`,
    evidence: '/api/orders/sub/:id -> logisticsRecords',
  });

  pushResult({
    id: 'C11',
    name: '日志一致性（节点时间戳完整）',
    pass: logTimestampOk === finalSubs.length,
    expected: `每个子单日志均带timestamp（${finalSubs.length}/${finalSubs.length}）`,
    actual: `${logTimestampOk}/${finalSubs.length}`,
    evidence: '/api/orders/sub/:id -> logisticsRecords.timestamp',
  });

  // C12：端到端一致性总判定
  const c12Pass = [
    jobFinal.status === 'COMPLETED',
    signed.status === 'SIGNED',
    finalSubs.every((s) => s.status === 'DELIVERED'),
    masterFinal.status === derivedMasterStatus,
    recvSum === 1800,
    paySum === 900,
    subWithLogs === finalSubs.length,
  ].every(Boolean);
  pushResult({
    id: 'C12',
    name: '端到端一致性（状态+财务+日志）',
    pass: c12Pass,
    expected: '状态、财务、日志三维全部一致',
    actual: `job=${jobFinal.status}, delivery=${signed.status}, subs=${finalSubs.map((s) => s.status).join(',')}, master=${masterFinal.status}/${derivedMasterStatus}, recv=${recvSum}, pay=${paySum}, logs=${subWithLogs}/${finalSubs.length}`,
    evidence: '综合判定',
  });

  // D组：数据库落库一致性（API + 页面行为之外）
  const subIds = finalSubs.map((s) => s.id);
  const subOrderNos = finalSubs.map((s) => s.subOrderNo);
  try {
    const dbx = getDb();

    // D01: 入库记录落库
    const inbRows = dbx.prepare(
      `SELECT subOrderId, status, warehouse FROM inbound_records WHERE masterOrderId = ? AND subOrderId IN (${placeholders(subIds.length)})`
    ).all(master.id, ...subIds);
    pushResult({
      id: 'D01',
      name: '落库一致性（inbound_records）',
      pass: inbRows.length === subIds.length && inbRows.every((r) => r.status === 'COMPLETED'),
      expected: `inbound_records 命中=${subIds.length} 且状态均为COMPLETED`,
      actual: `rows=${inbRows.length}, statuses=${inbRows.map((r) => r.status).join(',')}`,
      evidence: 'server/logistics.db.inbound_records',
    });

    // D02: 库存记录落库
    const stockRows = dbx.prepare(
      `SELECT subOrderNo, status, warehouse, shippingUnitId FROM stock_items WHERE subOrderNo IN (${placeholders(subOrderNos.length)})`
    ).all(...subOrderNos);
    pushResult({
      id: 'D02',
      name: '落库一致性（stock_items）',
      pass: stockRows.length === subOrderNos.length && stockRows.every((r) => r.status === 'IN_STOCK'),
      expected: `stock_items 命中=${subOrderNos.length} 且状态均为IN_STOCK`,
      actual: `rows=${stockRows.length}, statuses=${stockRows.map((r) => r.status).join(',')}`,
      evidence: 'server/logistics.db.stock_items',
    });

    // D03: 配送明细落库
    const deliveryItemRows = dbx.prepare(
      'SELECT subOrderId FROM delivery_order_items WHERE deliveryOrderId = ?'
    ).all(delivery.id);
    const dbSubIdSet = new Set(deliveryItemRows.map((r) => r.subOrderId));
    const allMatched = subIds.every((id) => dbSubIdSet.has(id)) && dbSubIdSet.size === subIds.length;
    pushResult({
      id: 'D03',
      name: '落库一致性（delivery_order_items）',
      pass: allMatched,
      expected: `delivery_order_items 精确关联 ${subIds.length} 个子单`,
      actual: `dbCount=${dbSubIdSet.size}, expected=${subIds.length}`,
      evidence: 'server/logistics.db.delivery_order_items',
    });

    // D04: 日志节点落库
    const logRows = dbx.prepare(
      `SELECT subOrderId, step, status, timestamp FROM logistics_records WHERE subOrderId IN (${placeholders(subIds.length)})`
    ).all(...subIds);
    const requiredSteps = ['入库完成', '等待发运', '已签收'];
    const logBySub = new Map();
    for (const row of logRows) {
      const arr = logBySub.get(row.subOrderId) || [];
      arr.push(row);
      logBySub.set(row.subOrderId, arr);
    }
    const logPass = subIds.every((id) => {
      const rows = logBySub.get(id) || [];
      const stepSet = new Set(rows.map((r) => r.step));
      return requiredSteps.every((st) => stepSet.has(st))
        && rows.every((r) => Boolean(r.timestamp))
        && rows.every((r) => r.status === 'completed');
    });
    pushResult({
      id: 'D04',
      name: '落库一致性（logistics_records）',
      pass: logPass,
      expected: `每个子单日志包含 ${requiredSteps.join('/')} 且 status=completed、timestamp完整`,
      actual: `subCount=${subIds.length}, logRows=${logRows.length}`,
      evidence: 'server/logistics.db.logistics_records',
    });

    // D05: 财务审批落库
    const feeRows = dbx.prepare(
      'SELECT id, status, amount FROM fee_records WHERE id IN (?, ?)'
    ).all(feeRecv.id, feePay.id);
    const feeMap = new Map(feeRows.map((f) => [f.id, f]));
    const recvDb = feeMap.get(feeRecv.id);
    const payDb = feeMap.get(feePay.id);
    const feeDbPass = Boolean(recvDb && payDb)
      && recvDb.status === 'APPROVED'
      && payDb.status === 'APPROVED'
      && Number(recvDb.amount) === 1800
      && Number(payDb.amount) === 900;
    pushResult({
      id: 'D05',
      name: '落库一致性（fee_records）',
      pass: feeDbPass,
      expected: '应收/应付两条费用均已审批，金额分别为1800/900',
      actual: `recv=${recvDb ? `${recvDb.status}/${recvDb.amount}` : 'missing'}, pay=${payDb ? `${payDb.status}/${payDb.amount}` : 'missing'}`,
      evidence: 'server/logistics.db.fee_records',
    });
  } catch (err) {
    pushResult({
      id: 'D01',
      name: '数据库核验初始化',
      pass: false,
      expected: '可读取 logistics.db',
      actual: err.message,
      evidence: DB_PATH,
    });
  }

  // E组：异常 + 退运分支（API + DB）
  const exMaster = (await api('POST', '/orders/master', {
    customerId: 'C1',
    customerName: '异常分支测试客户',
    sender: '测试发货人',
    senderPhone: '13800000000',
    senderAddress: '广东深圳',
    consignee: '异常收件人',
    consigneePhone: '+234-800-1234567',
    destCountry: '尼日利亚',
    destCity: '拉各斯',
    destAddress: 'Lagos Exception Address',
    transportType: 'SEA',
    totalPieces: 2,
    totalWeight: 5,
    totalVolume: 0.03,
    totalValue: 200,
    totalFreight: 60,
    salesPerson: 'sales1',
    remark: 'E2E exception branch',
  })).data;

  const exSub = (await api('POST', '/orders/sub', {
    subOrderNo: `${exMaster.orderNo}-EX-1`,
    masterOrderId: exMaster.id,
    batchNo: 1,
    pieces: 2,
    weight: 5,
    volume: 0.03,
    value: 200,
    transportType: 'SEA',
    route: '深圳 → 拉各斯',
    consignee: '异常收件人',
    consigneePhone: '+234-800-1234567',
    destCountry: '尼日利亚',
    destCity: '拉各斯',
    destAddress: 'Lagos Exception Address',
    expressCompany: 'SF',
    expressTrackingNo: `E2E-EX-TRACK-${suffix}`,
    goodsDescription: 'E2E exception cargo',
    remark: 'created by e2e exception branch',
  })).data;

  const exMarked = (await api('PUT', `/orders/sub/${exSub.id}/status`, {
    status: 'EXCEPTION',
    currentNode: '货物异常待处理',
  })).data;
  pushResult({
    id: 'E01',
    name: '异常分支：子单上报异常',
    pass: exMarked.status === 'EXCEPTION',
    expected: '子单状态=EXCEPTION',
    actual: `status=${exMarked.status}`,
    evidence: `/api/orders/sub/${exSub.id}/status`,
  });

  const exReturn = (await api('POST', '/warehouse/returns', {
    orderNo: exMaster.orderNo,
    trackingNo: exSub.expressTrackingNo,
    customerName: exMaster.customerName,
    returnType: 'CUSTOMER',
    returnStage: 'ORIGIN',
    reason: 'E2E异常退运',
    pieces: 2,
    weight: 5,
    volume: 0.03,
    applicant: 'warehouse_cn1',
    remark: 'E2E exception return apply',
  })).data;
  pushResult({
    id: 'E02',
    name: '异常分支：创建退运记录',
    pass: exReturn.status === 'PENDING',
    expected: '退运记录状态=PENDING',
    actual: `status=${exReturn.status}`,
    evidence: `/api/warehouse/returns (id=${exReturn.id})`,
  });

  const exReturnApplied = (await api('PUT', `/orders/sub/${exSub.id}/status`, {
    status: 'RETURN_APPLIED',
    currentNode: '已申请退运',
  })).data;
  pushResult({
    id: 'E03',
    name: '异常分支：子单状态更新为退运申请中',
    pass: exReturnApplied.status === 'RETURN_APPLIED',
    expected: '子单状态=RETURN_APPLIED',
    actual: `status=${exReturnApplied.status}`,
    evidence: `/api/orders/sub/${exSub.id}/status`,
  });

  try {
    const dbx = getDb();
    const exReturnDb = dbx.prepare('SELECT id, status, orderNo, trackingNo FROM return_records WHERE id = ?').get(exReturn.id);
    const exSubDb = dbx.prepare('SELECT id, status FROM sub_orders WHERE id = ?').get(exSub.id);
    const e04Pass = Boolean(exReturnDb && exSubDb)
      && exReturnDb.status === 'PENDING'
      && exReturnDb.orderNo === exMaster.orderNo
      && exReturnDb.trackingNo === exSub.expressTrackingNo
      && exSubDb.status === 'RETURN_APPLIED';
    pushResult({
      id: 'E04',
      name: '异常分支：退运与子单状态落库一致性',
      pass: e04Pass,
      expected: 'return_records=PENDING 且 sub_orders=RETURN_APPLIED',
      actual: `return=${exReturnDb ? `${exReturnDb.status}/${exReturnDb.orderNo}/${exReturnDb.trackingNo}` : 'missing'}, sub=${exSubDb ? exSubDb.status : 'missing'}`,
      evidence: 'server/logistics.db.return_records + sub_orders',
    });
  } catch (err) {
    pushResult({
      id: 'E04',
      name: '异常分支：退运与子单状态落库一致性',
      pass: false,
      expected: '可读取物流数据库并命中记录',
      actual: err.message,
      evidence: DB_PATH,
    });
  }

  // 写报告
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(ROOT, 'docs/test-results');
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, `海运闭环自动化执行结果_${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({
    meta: {
      runStart,
      runEnd: new Date().toISOString(),
      baseUrl: BASE_URL,
      total: results.length,
      passed,
      failed,
      entities: evidence,
    },
    results,
  }, null, 2), 'utf8');

  const lines = [];
  lines.push('# 海运闭环自动化执行结果');
  lines.push('');
  lines.push(`- 执行开始: ${runStart}`);
  lines.push(`- 执行结束: ${new Date().toISOString()}`);
  lines.push(`- API 基址: \`${BASE_URL}\``);
  lines.push(`- 总用例: ${results.length}`);
  lines.push(`- 通过: ${passed}`);
  lines.push(`- 失败: ${failed}`);
  lines.push(`- 关键实体: jobNo=${evidence.jobNo || '-'}, masterId=${evidence.masterId || '-'}, orderNo=${evidence.orderNo || '-'}, deliveryId=${evidence.deliveryId || '-'}`);
  lines.push('');
  lines.push('| ID | 结果 | 用例 | 预期 | 实际 | 证据 |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of results) {
    lines.push(`| ${safe(r.id)} | ${r.pass ? 'PASS' : 'FAIL'} | ${safe(r.name)} | ${safe(r.expected)} | ${safe(r.actual)} | ${safe(r.evidence)} |`);
  }
  const mdPath = path.join(outDir, `海运闭环自动化执行结果_${stamp}.md`);
  fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');

  console.log(`RESULT_JSON=${jsonPath}`);
  console.log(`RESULT_MD=${mdPath}`);
  console.log(`SUMMARY total=${results.length} passed=${passed} failed=${failed}`);

  closeDb();
  if (failed > 0) process.exitCode = 2;
}

main().catch((err) => {
  closeDb();
  console.error(err);
  process.exit(1);
});
