#!/usr/bin/env node
/* eslint-disable no-console */

const base = process.env.API_BASE || 'http://localhost:3001/api';
const inputLine = String(process.argv[2] || 'SEA').toUpperCase();
const businessLine = inputLine === 'AIR' ? 'AIR' : 'SEA';

const cfg = businessLine === 'SEA'
  ? {
      serviceTypeCode: 'LCL_SEA',
      routeCode: 'SZ.CN→LOS.NGA',
      originWarehouseId: 'WH-GZ-001',
      destWarehouseId: 'WH-LOS-001',
      polSiteId: 'SITE-SZ-ORIGIN',
      podSiteId: 'SITE-LOS-DEST',
      carrierSupplierId: 'SUP-MAERSK',
      unitType: 'CONTAINER',
      containerType: '40HQ',
      prefix: 'S',
    }
  : {
      serviceTypeCode: 'STANDARD_AIR',
      routeCode: 'GZ.CN→LOS.NGA',
      originWarehouseId: 'WH-SZ-001',
      destWarehouseId: 'WH-LOS-001',
      polSiteId: 'SITE-GZ-ORIGIN',
      podSiteId: 'SITE-LOS-DEST',
      carrierSupplierId: 'SUP-CZ',
      unitType: 'PALLET',
      containerType: 'AIR_PALLET',
      prefix: 'A',
    };

function unwrap(raw) {
  return raw && raw.data !== undefined ? raw.data : raw;
}

function ensure(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${method} ${path} 返回非 JSON: ${text.slice(0, 200)}`);
  }

  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${path} 失败: ${json.error || json.message || text}`);
  }

  return json;
}

async function callExpectFail(method, path, body, expectMessage) {
  try {
    await call(method, path, body);
  } catch (err) {
    const message = String(err?.message || err || '');
    if (expectMessage) {
      ensure(message.includes(expectMessage), `${method} ${path} 失败信息不符合预期: ${message}`);
    }
    return message;
  }
  throw new Error(`${method} ${path} 期望失败但实际成功`);
}

function makeTag() {
  const t = Date.now().toString().slice(-8);
  const r = Math.floor(Math.random() * 900 + 100);
  return `${cfg.prefix}${t}${r}`;
}

function pick(obj, keys, fallback) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return fallback;
}

async function verifyLineIsolation(orderNo) {
  const same = unwrap(await call('GET', `/v2/oms/orders?businessLine=${businessLine}&keyword=${encodeURIComponent(orderNo)}&page=1&pageSize=20`));
  const otherLine = businessLine === 'SEA' ? 'AIR' : 'SEA';
  const other = unwrap(await call('GET', `/v2/oms/orders?businessLine=${otherLine}&keyword=${encodeURIComponent(orderNo)}&page=1&pageSize=20`));

  const sameRows = Array.isArray(same?.data) ? same.data : Array.isArray(same) ? same : [];
  const otherRows = Array.isArray(other?.data) ? other.data : Array.isArray(other) ? other : [];

  ensure(sameRows.some((r) => [r.order_no, r.orderNo, r.display_order_no].includes(orderNo)), `业务线隔离校验失败：${businessLine} 下未查到 ${orderNo}`);
  ensure(otherRows.length === 0, `业务线隔离校验失败：${otherLine} 不应查到 ${orderNo}`);
}

async function main() {
  const tag = makeTag();
  const trackingNos = [`${businessLine}-${tag}-01`, `${businessLine}-${tag}-02`];

  const customerRes = unwrap(await call('POST', '/v2/oms/customers', {
    name: `全链路校验客户-${tag}`,
    country: 'China',
    contact: {
      name: 'Flow Verifier',
      phone: `138${Date.now().toString().slice(-8)}`,
      email: `flow-${tag}@demo.local`,
    },
    poolType: 'PUBLIC',
    logisticsInfo: {
      senderContacts: [
        {
          senderName: '广州发货人',
          senderPhone: '13800000001',
          senderAddress: '广州市白云区示例路 1 号',
          senderCountry: 'China',
          senderCity: 'Guangzhou',
        },
      ],
      receiverContacts: [
        {
          consigneeName: 'Lagos Receiver',
          consigneePhone: '+2348001234567',
          consigneeEmail: `receiver-${tag}@demo.local`,
          consigneeAddress: 'No.18 Allen Avenue, Ikeja, Lagos',
          consigneeCountry: 'Nigeria',
          consigneeCity: 'Lagos',
        },
      ],
    },
  }));
  ensure(customerRes?.id, '客户创建失败：缺少 customer.id');

  const orderPayload = unwrap(await call('POST', '/v2/oms/orders', {
    customerId: customerRes.id,
    businessLine,
    serviceTypeCode: cfg.serviceTypeCode,
    routeCode: cfg.routeCode,
    paymentMethod: 'PREPAID',
    paymentChannel: 'BANK',
    currencyCode: 'CNY',
    packages: trackingNos.map((trackingNo, idx) => ({
      trackingNo,
      expressCompany: 'SF',
      goodsName: `校验货物-${idx + 1}`,
      goodsCategory: 'GENERAL',
      cargoDesc: 'GENERAL',
      declaredWeightKg: idx === 0 ? 12.5 : 8.2,
      pieces: 1,
      declaredValueUsd: idx === 0 ? 200 : 120,
      remark: `校验包裹-${idx + 1}`,
    })),
    creatorUserId: 'U-SALES-01',
    salesUserId: 'U-SALES-01',
    remark: '全链路校验主单',
  }));

  const order = orderPayload?.order || orderPayload;
  ensure(order?.id, '主单创建失败：缺少 order.id');
  const orderNo = String(pick(order, ['order_no', 'orderNo', 'display_order_no'], order.id));

  const job = unwrap(await call('POST', '/v2/tms/jobs', {
    businessLine,
    polSiteId: cfg.polSiteId,
    podSiteId: cfg.podSiteId,
    carrierSupplierId: cfg.carrierSupplierId,
    etd: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    eta: new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString(),
    remark: '全链路校验任务',
    createdBy: 'U-OPS-CN-01',
  }));
  ensure(job?.id, '任务创建失败：缺少 job.id');

  const inbound = unwrap(await call('POST', '/v2/wms/inbounds', {
    warehouseId: cfg.originWarehouseId,
    orderId: order.id,
    businessLine,
    sourceType: 'THIRD_PARTY',
    operatorUserId: 'U-OPS-CN-01',
    remark: '主单入库自动生子单校验',
    items: trackingNos.map((trackingNo, idx) => ({
      trackingNo,
      expressCompany: 'SF',
      senderName: '广州发货人',
      senderPhone: '13800000001',
      consigneeName: 'Lagos Receiver',
      consigneePhone: '+2348001234567',
      customerHint: customerRes.name,
      pieces: 1,
      grossWeightKg: idx === 0 ? 12.5 : 8.2,
      lengthCm: idx === 0 ? 50 : 45,
      widthCm: idx === 0 ? 40 : 35,
      heightCm: idx === 0 ? 35 : 30,
      packageCondition: 'GOOD',
      locationCode: idx === 0 ? 'A-01' : 'A-02',
      remark: `入库包裹-${idx + 1}`,
    })),
  }));

  const createdSubOrderIds = Array.isArray(inbound?.createdSubOrderIds) ? inbound.createdSubOrderIds.map(String) : [];
  ensure(createdSubOrderIds.length === trackingNos.length, `子单生成校验失败：期望 ${trackingNos.length}，实际 ${createdSubOrderIds.length}`);

  const fullAfterInbound = unwrap(await call('GET', `/v2/oms/orders/${order.id}/full`));
  const subAfterInbound = Array.isArray(fullAfterInbound?.subOrders) ? fullAfterInbound.subOrders : [];
  ensure(subAfterInbound.length === trackingNos.length, `主单子单数量异常：期望 ${trackingNos.length}，实际 ${subAfterInbound.length}`);
  ensure(subAfterInbound.every((s) => (s.sub_status || s.status) === 'INBOUND'), '入库后子单状态应全部为 INBOUND');

  await call('POST', `/v2/tms/jobs/${job.id}/bind-sub-orders`, {
    subOrderIds: createdSubOrderIds,
    shippingUnitNo: `UNIT-${tag}`,
    unitType: cfg.unitType,
    containerType: cfg.containerType,
    warehouseId: cfg.originWarehouseId,
    operatorUserId: 'U-OPS-CN-01',
  });

  const fullAfterBind = unwrap(await call('GET', `/v2/oms/orders/${order.id}/full`));
  const subAfterBind = Array.isArray(fullAfterBind?.subOrders) ? fullAfterBind.subOrders : [];
  ensure(subAfterBind.every((s) => (s.sub_status || s.status) === 'PENDING_DEPARTURE'), '任务绑定后子单状态应为 PENDING_DEPARTURE');

  for (const subOrderId of createdSubOrderIds) {
    await call('POST', '/v2/tms/tracking-events', {
      businessLine,
      eventScope: 'SUB_ORDER',
      orderId: order.id,
      subOrderId,
      jobId: job.id,
      eventType: 'IMPORT',
      nodeCode: 'ARRIVE_DEST',
      nodeName: '到达目的地',
      statusCode: 'ARRIVED',
      location: 'Lagos',
      operatorUserId: 'U-OPS-US-01',
      remark: '全链路校验推进',
    });
  }

  const fullAfterTrack = unwrap(await call('GET', `/v2/oms/orders/${order.id}/full`));
  const subAfterTrack = Array.isArray(fullAfterTrack?.subOrders) ? fullAfterTrack.subOrders : [];
  ensure(subAfterTrack.every((s) => (s.sub_status || s.status) === 'ARRIVED'), '节点推进后子单状态应为 ARRIVED');

  const createDpnPayload = {
    businessLine,
    customerId: customerRes.id,
    warehouseId: cfg.destWarehouseId,
    subOrderIds: createdSubOrderIds,
    recipientName: 'Lagos Receiver',
    recipientPhone: '+2348001234567',
    recipientAddress: 'No.18 Allen Avenue, Ikeja, Lagos',
    deliveryMethod: 'DELIVERY',
    currencyCode: 'NGN',
    totalReceivableAmount: 1200,
    createdBy: 'U-OPS-US-01',
    remark: '全链路校验 DPN',
  };

  const dpnPayload1 = unwrap(await call('POST', '/v2/pod/dpns', createDpnPayload));
  const dpn1 = dpnPayload1?.dpn || dpnPayload1;
  ensure(dpn1?.id, 'DPN 创建失败：缺少 dpn.id');

  const fullAfterDpn1 = unwrap(await call('GET', `/v2/oms/orders/${order.id}/full`));
  const subAfterDpn1 = Array.isArray(fullAfterDpn1?.subOrders) ? fullAfterDpn1.subOrders : [];
  ensure(subAfterDpn1.every((s) => (s.sub_status || s.status) === 'PENDING_DELIVERY'), '创建 DPN 后子单状态应为 PENDING_DELIVERY');

  const task1 = unwrap(await call('POST', '/v2/pod/delivery-tasks', {
    dpnId: dpn1.id,
    driverUserId: 'U-OPS-US-01',
    driverName: '自动配送员',
    driverPhone: '+2348000009999',
    remark: '全链路校验派单',
  }));
  ensure(task1?.id, '配送任务创建失败：缺少 task.id');

  const fullAfterAssign1 = unwrap(await call('GET', `/v2/oms/orders/${order.id}/full`));
  const subAfterAssign1 = Array.isArray(fullAfterAssign1?.subOrders) ? fullAfterAssign1.subOrders : [];
  ensure(subAfterAssign1.every((s) => (s.sub_status || s.status) === 'DELIVERING'), '派单后子单状态应为 DELIVERING');

  await call('POST', `/v2/pod/delivery-tasks/${task1.id}/fail`, {
    reason: '客户不在家',
  });

  const fullAfterFail = unwrap(await call('GET', `/v2/oms/orders/${order.id}/full`));
  const subAfterFail = Array.isArray(fullAfterFail?.subOrders) ? fullAfterFail.subOrders : [];
  ensure(subAfterFail.every((s) => (s.sub_status || s.status) === 'EXCEPTION'), '派送失败后子单状态应为 EXCEPTION');

  await callExpectFail('POST', '/v2/pod/dpns', createDpnPayload, 'non-cancelled DPN');

  await call('POST', `/v2/pod/dpns/${dpn1.id}/return-to-warehouse`, {
    remark: '回仓重派校验',
  });

  const fullAfterReturn = unwrap(await call('GET', `/v2/oms/orders/${order.id}/full`));
  const subAfterReturn = Array.isArray(fullAfterReturn?.subOrders) ? fullAfterReturn.subOrders : [];
  ensure(subAfterReturn.every((s) => (s.sub_status || s.status) === 'ARRIVED'), '回仓后子单状态应回到 ARRIVED');

  const dpnPayload2 = unwrap(await call('POST', '/v2/pod/dpns', createDpnPayload));
  const dpn2 = dpnPayload2?.dpn || dpnPayload2;
  ensure(dpn2?.id, '重派 DPN 创建失败：缺少 dpn.id');

  const task2 = unwrap(await call('POST', '/v2/pod/delivery-tasks', {
    dpnId: dpn2.id,
    driverUserId: 'U-OPS-US-01',
    driverName: '自动配送员',
    driverPhone: '+2348000009999',
    remark: '全链路校验重派',
  }));
  ensure(task2?.id, '重派配送任务创建失败：缺少 task.id');

  await call('POST', `/v2/pod/delivery-tasks/${task2.id}/sign`, {
    signProof: { from: 'verify-v2-full-flow', by: 'U-OPS-US-01', at: new Date().toISOString() },
  });

  const fullAfterSignBeforePay = unwrap(await call('GET', `/v2/oms/orders/${order.id}/full`));
  const orderAfterSign = fullAfterSignBeforePay?.order || {};
  const orderStatusAfterSign = String(pick(orderAfterSign, ['order_status', 'status'], ''));
  const paymentStatusAfterSign = String(pick(orderAfterSign, ['payment_status', 'paymentStatus'], ''));
  ensure(orderStatusAfterSign === 'COMPLETED', `签收后主单状态应为 COMPLETED，实际 ${orderStatusAfterSign}`);
  ensure(paymentStatusAfterSign !== 'PAID', `签收时支付不应已完成，实际 ${paymentStatusAfterSign}`);

  const fee = unwrap(await call('POST', '/v2/finance/fees', {
    businessLine,
    feeLevel: 'ORDER',
    relatedId: order.id,
    relatedNo: orderNo,
    feeItemCode: 'FREIGHT',
    feeDirection: 'RECEIVABLE',
    unitPrice: 1200,
    quantity: 1,
    currencyCode: 'CNY',
    counterpartyType: 'CUSTOMER',
    counterpartyId: customerRes.id,
    counterpartyName: customerRes.name,
    description: '全链路校验应收',
    createdBy: 'U-FIN-01',
  }));
  ensure(fee?.id, '费用创建失败：缺少 fee.id');

  const wf = unwrap(await call('POST', '/v2/workflow/instances', {
    businessLine,
    processCode: 'FEE_APPROVAL',
    businessType: 'FEE',
    businessId: fee.id,
    nodeCode: 'FIN_APPROVAL',
    nodeName: '财务审批',
    initiatorUserId: 'U-FIN-01',
    assigneeUserId: 'U-ADMIN',
  }));

  const workflowTaskId = wf?.task?.id;
  ensure(workflowTaskId, '审批流创建失败：缺少 workflowTaskId');

  await call('POST', `/v2/workflow/tasks/${workflowTaskId}/action`, {
    action: 'APPROVE',
    comment: '自动审批通过',
  });

  await call('POST', '/v2/finance/payments/confirm', {
    feeId: fee.id,
    amount: 1200,
    paymentMethod: 'BANK',
    paymentChannel: 'AUTO',
    paymentAccount: 'AUTO-ACC',
    confirmedBy: 'U-FIN-01',
    remark: '自动收款',
  });

  const fullFinal = unwrap(await call('GET', `/v2/oms/orders/${order.id}/full`));
  const finalOrderStatus = String(pick(fullFinal?.order, ['order_status', 'status'], ''));
  const finalPaymentStatus = String(pick(fullFinal?.order, ['payment_status', 'paymentStatus'], ''));
  const finalSubStatuses = Array.isArray(fullFinal?.subOrders)
    ? fullFinal.subOrders.map((s) => String(pick(s, ['sub_status', 'status'], '-')))
    : [];

  ensure(finalOrderStatus === 'COMPLETED', `主单状态异常：期望 COMPLETED，实际 ${finalOrderStatus}`);
  ensure(finalSubStatuses.length === trackingNos.length && finalSubStatuses.every((s) => s === 'DELIVERED'), `子单状态异常：${finalSubStatuses.join(',')}`);
  ensure(finalPaymentStatus === 'PAID', `支付状态异常：期望 PAID，实际 ${finalPaymentStatus}`);

  await verifyLineIsolation(orderNo);

  const summary = {
    ok: true,
    businessLine,
    orderId: order.id,
    orderNo,
    firstDpnNo: dpn1.dpn_no || dpn1.dpnNo || dpn1.id,
    secondDpnNo: dpn2.dpn_no || dpn2.dpnNo || dpn2.id,
    createdSubOrderIds,
    orderStatusAfterSign,
    paymentStatusAfterSign,
    finalOrderStatus,
    finalSubStatuses,
    finalPaymentStatus,
    checks: [
      '1包裹=1子单',
      '任务绑定后子单 PENDING_DEPARTURE',
      '子单禁止进入多个未取消 DPN',
      '派送失败→回仓→新 DPN 重派',
      '签收完成与支付完成独立',
      '最终签收后子单 DELIVERED & 主单 COMPLETED',
      '支付流程最终可达 PAID',
      'SEA/AIR 列表隔离',
    ],
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(`[FAIL] ${err.message || err}`);
  process.exit(1);
});
