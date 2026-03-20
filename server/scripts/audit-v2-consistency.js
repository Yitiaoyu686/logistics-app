#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('path');
const BetterSqlite3 = require('better-sqlite3');

const dbPath = path.resolve(__dirname, '../logistics_v2.db');
const db = new BetterSqlite3(dbPath, { readonly: true });
db.pragma('foreign_keys = ON');

function deriveOrderStatus(subStatuses) {
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

function pushFindings(findings, title, rows) {
  if (!rows || rows.length === 0) return;
  findings.push({ title, count: rows.length, rows });
}

function audit() {
  const findings = [];

  const orders = db.prepare('SELECT id, order_no, order_status FROM oms_order').all();
  const subByOrder = db.prepare('SELECT order_id, sub_status FROM oms_sub_order').all();
  const group = new Map();
  subByOrder.forEach((r) => {
    const list = group.get(r.order_id) || [];
    list.push(String(r.sub_status));
    group.set(r.order_id, list);
  });

  const statusMismatch = [];
  for (const order of orders) {
    const current = String(order.order_status || '');
    if (['CANCELLED', 'RETURN_APPLIED'].includes(current)) {
      continue;
    }
    const expected = deriveOrderStatus(group.get(order.id) || []);
    if (current !== expected) {
      statusMismatch.push({
        orderId: order.id,
        orderNo: order.order_no,
        current,
        expected,
      });
    }
  }
  pushFindings(findings, '主单状态与子单聚合状态不一致', statusMismatch);

  const mixedOrderLine = db.prepare(`
    SELECT
      o.id AS orderId,
      o.order_no AS orderNo,
      o.business_line AS orderLine,
      so.id AS subOrderId,
      so.sub_order_no AS subOrderNo,
      so.business_line AS subLine
    FROM oms_order o
    JOIN oms_sub_order so ON so.order_id = o.id
    WHERE o.business_line <> so.business_line
  `).all();
  pushFindings(findings, '主单与子单业务线不一致', mixedOrderLine);

  const mixedJobLine = db.prepare(`
    SELECT
      rel.id AS relId,
      j.id AS jobId,
      j.job_no AS jobNo,
      j.business_line AS jobLine,
      so.id AS subOrderId,
      so.sub_order_no AS subOrderNo,
      so.business_line AS subLine
    FROM tms_job_order_rel rel
    JOIN tms_job j ON j.id = rel.job_id
    JOIN oms_sub_order so ON so.id = rel.sub_order_id
    WHERE j.business_line <> so.business_line
  `).all();
  pushFindings(findings, '任务绑定关系存在业务线混绑', mixedJobLine);

  const activeDpnConflict = db.prepare(`
    SELECT
      di.sub_order_id AS subOrderId,
      so.sub_order_no AS subOrderNo,
      COUNT(DISTINCT di.dpn_id) AS activeDpnCount,
      GROUP_CONCAT(DISTINCT d.dpn_no) AS dpnNos
    FROM pod_dpn_item di
    JOIN pod_dpn d ON d.id = di.dpn_id
    LEFT JOIN oms_sub_order so ON so.id = di.sub_order_id
    WHERE d.dpn_status <> 'CANCELLED'
    GROUP BY di.sub_order_id
    HAVING COUNT(DISTINCT di.dpn_id) > 1
  `).all();
  pushFindings(findings, '子单同时出现在多个未取消 DPN', activeDpnConflict);

  const matchedUnmatchedMissingLink = db.prepare(`
    SELECT id, tracking_no, matched_order_id, matched_sub_order_id, status
    FROM wms_unmatched_package
    WHERE status = 'MATCHED' AND (matched_order_id IS NULL OR matched_sub_order_id IS NULL)
  `).all();
  pushFindings(findings, '待匹配包裹标记 MATCHED 但关联主子单缺失', matchedUnmatchedMissingLink);

  const deliveredButUnsignedDpn = db.prepare(`
    SELECT
      d.id AS dpnId,
      d.dpn_no AS dpnNo,
      d.dpn_status AS dpnStatus,
      t.id AS taskId,
      t.task_no AS taskNo,
      t.task_status AS taskStatus
    FROM pod_dpn d
    LEFT JOIN pod_delivery_task t ON t.dpn_id = d.id
    WHERE d.dpn_status = 'SIGNED'
      AND (t.id IS NULL OR t.task_status <> 'SIGNED')
  `).all();
  pushFindings(findings, 'DPN 已签收但配送任务未签收', deliveredButUnsignedDpn);

  const signedDpnSubStatusMismatch = db.prepare(`
    SELECT
      d.id AS dpnId,
      d.dpn_no AS dpnNo,
      so.id AS subOrderId,
      so.sub_order_no AS subOrderNo,
      so.sub_status AS subStatus
    FROM pod_dpn d
    JOIN pod_dpn_item di ON di.dpn_id = d.id
    JOIN oms_sub_order so ON so.id = di.sub_order_id
    WHERE d.dpn_status = 'SIGNED'
      AND so.sub_status <> 'DELIVERED'
  `).all();
  pushFindings(findings, 'DPN 已签收但子单状态非 DELIVERED', signedDpnSubStatusMismatch);

  const failedTaskStateMismatch = db.prepare(`
    SELECT
      t.id AS taskId,
      t.task_no AS taskNo,
      t.task_status AS taskStatus,
      d.id AS dpnId,
      d.dpn_no AS dpnNo,
      d.dpn_status AS dpnStatus
    FROM pod_delivery_task t
    JOIN pod_dpn d ON d.id = t.dpn_id
    WHERE t.task_status = 'FAILED'
      AND d.dpn_status IN ('SIGNED')
  `).all();
  pushFindings(findings, '配送任务 FAILED 但 DPN 状态非法', failedTaskStateMismatch);

  const cancelledDpnPendingDeliverySub = db.prepare(`
    SELECT
      d.id AS dpnId,
      d.dpn_no AS dpnNo,
      so.id AS subOrderId,
      so.sub_order_no AS subOrderNo,
      so.sub_status AS subStatus
    FROM pod_dpn d
    JOIN pod_dpn_item di ON di.dpn_id = d.id
    JOIN oms_sub_order so ON so.id = di.sub_order_id
    WHERE d.dpn_status = 'CANCELLED'
      AND so.sub_status = 'PENDING_DELIVERY'
  `).all();
  pushFindings(findings, '取消 DPN 后子单仍停留 PENDING_DELIVERY', cancelledDpnPendingDeliverySub);

  return findings;
}

function toMarkdown(findings) {
  const lines = [];
  lines.push('# V2 数据一致性审计报告');
  lines.push('');
  lines.push(`- 执行时间: ${new Date().toISOString()}`);
  lines.push(`- 数据库: ${dbPath}`);
  lines.push(`- 总问题数: ${findings.reduce((sum, f) => sum + f.count, 0)}`);
  lines.push('');

  if (findings.length === 0) {
    lines.push('结论: 无一致性问题。');
    lines.push('');
    return lines.join('\n');
  }

  findings.forEach((f, idx) => {
    lines.push(`## ${idx + 1}. ${f.title}（${f.count}）`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(f.rows.slice(0, 20), null, 2));
    lines.push('```');
    lines.push('');
  });

  return lines.join('\n');
}

function main() {
  const findings = audit();
  const summary = {
    ok: findings.length === 0,
    checkedAt: new Date().toISOString(),
    database: dbPath,
    findingCount: findings.reduce((sum, f) => sum + f.count, 0),
    findings,
  };

  const reportDir = path.resolve(__dirname, '../../docs/reports');
  const jsonPath = path.resolve(reportDir, 'v2-consistency-audit-latest.json');
  const mdPath = path.resolve(reportDir, 'v2-consistency-audit-latest.md');
  require('fs').mkdirSync(reportDir, { recursive: true });
  require('fs').writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  require('fs').writeFileSync(mdPath, `${toMarkdown(findings)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: summary.ok,
    findingCount: summary.findingCount,
    jsonPath,
    mdPath,
  }, null, 2));

  if (!summary.ok) process.exit(1);
}

main();
