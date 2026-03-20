#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001/api';
const DB_PATH = path.resolve(ROOT, 'server/logistics.db');

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function safe(v) {
  return String(v ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br/>');
}

function listTsxFiles(dir) {
  const abs = path.resolve(ROOT, dir);
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => path.join(dir, f));
}

function analyzePage(file) {
  const abs = path.resolve(ROOT, file);
  const content = fs.readFileSync(abs, 'utf8');
  const hasApi = /(Api\.|api\.)/.test(content);
  const hasStaticSeed = /(const\s+\w+Data\s*:\s*\w+\[\]\s*=\s*\[\])|(模拟数据)|(TODO)/.test(content);
  const closure = hasApi ? 'API_CONNECTED' : 'STATIC_OR_MOCK';
  return { file, hasApi, hasStaticSeed, closure };
}

async function api(method, endpoint, token) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { /* ignore */ }
  return { ok: res.ok && (json?.success !== false), status: res.status, json, text };
}

function runDbChecks() {
  const BetterSqlite3 = require(path.resolve(ROOT, 'server/node_modules/better-sqlite3'));
  const db = new BetterSqlite3(DB_PATH, { readonly: true, fileMustExist: true });

  const checks = [];

  const feeOrderTotal = db.prepare(`SELECT COUNT(*) c FROM fee_records WHERE relatedType='ORDER'`).get().c;
  const feeOrderLinked = db.prepare(`
    SELECT COUNT(*) c
    FROM fee_records f
    WHERE f.relatedType='ORDER'
      AND (
        EXISTS (SELECT 1 FROM master_orders m WHERE m.id = f.relatedId OR m.orderNo = f.relatedNo)
        OR EXISTS (SELECT 1 FROM sub_orders s WHERE s.id = f.relatedId OR s.subOrderNo = f.relatedNo)
      )
  `).get().c;
  checks.push({
    id: 'DB01',
    name: '费用-订单关联完整性',
    pass: feeOrderTotal === feeOrderLinked,
    detail: `linked=${feeOrderLinked}/${feeOrderTotal}`,
  });

  const feeJobTotal = db.prepare(`SELECT COUNT(*) c FROM fee_records WHERE relatedType='JOB'`).get().c;
  const feeJobLinked = db.prepare(`
    SELECT COUNT(*) c
    FROM fee_records f
    WHERE f.relatedType='JOB'
      AND EXISTS (SELECT 1 FROM jobs j WHERE j.jobNo = f.relatedId OR j.jobNo = f.relatedNo)
  `).get().c;
  checks.push({
    id: 'DB02',
    name: '费用-任务关联完整性',
    pass: feeJobTotal === feeJobLinked,
    detail: `linked=${feeJobLinked}/${feeJobTotal}`,
  });

  const feeTransferTotal = db.prepare(`SELECT COUNT(*) c FROM fee_records WHERE relatedType='TRANSFER'`).get().c;
  const feeTransferLinked = db.prepare(`
    SELECT COUNT(*) c
    FROM fee_records f
    WHERE f.relatedType='TRANSFER'
      AND EXISTS (SELECT 1 FROM transfer_orders t WHERE t.id = f.relatedId OR t.transferNo = f.relatedNo)
  `).get().c;
  checks.push({
    id: 'DB03',
    name: '费用-调拨关联完整性',
    pass: feeTransferTotal === feeTransferLinked,
    detail: `linked=${feeTransferLinked}/${feeTransferTotal}`,
  });

  const masterNoSub = db.prepare(`
    SELECT COUNT(*) c
    FROM master_orders m
    WHERE NOT EXISTS (SELECT 1 FROM sub_orders s WHERE s.masterOrderId = m.id)
  `).get().c;
  checks.push({
    id: 'DB04',
    name: '主订单-子订单关系',
    pass: masterNoSub === 0,
    detail: `masters_without_sub=${masterNoSub}`,
  });

  const subNoMaster = db.prepare(`
    SELECT COUNT(*) c
    FROM sub_orders s
    WHERE NOT EXISTS (SELECT 1 FROM master_orders m WHERE m.id = s.masterOrderId)
  `).get().c;
  checks.push({
    id: 'DB05',
    name: '子订单主单外键完整性',
    pass: subNoMaster === 0,
    detail: `subs_without_master=${subNoMaster}`,
  });

  db.close();
  return checks;
}

async function main() {
  const runStart = new Date().toISOString();

  const groups = [
    { module: '财务中心', dir: 'client/src/pages/finance' },
    { module: '经营分析', dir: 'client/src/pages/analytics' },
    { module: '系统设置', dir: 'client/src/pages/system' },
  ];

  const pageRows = [];
  for (const g of groups) {
    const files = listTsxFiles(g.dir);
    for (const file of files) {
      const a = analyzePage(file);
      pageRows.push({
        module: g.module,
        page: path.basename(file, '.tsx'),
        file,
        closure: a.closure,
        note: a.hasStaticSeed ? '存在静态/模拟数据痕迹' : (a.hasApi ? '已接 API' : '未发现 API 调用'),
      });
    }
  }

  let token = '';
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  try {
    const loginJson = await loginRes.json();
    token = loginJson?.data?.token || '';
  } catch (_) {
    token = '';
  }

  const apiChecks = [];
  const endpoints = [
    ['API01', 'GET', '/fees', false, '费用列表'],
    ['API02', 'GET', '/suppliers', false, '供应商列表'],
    ['API03', 'GET', '/system/routes', false, '线路配置列表'],
    ['API04', 'GET', '/system/exchange-rates', false, '汇率配置'],
    ['API05', 'GET', '/system/warehouses', false, '仓库配置列表'],
    ['API06', 'GET', '/orders/master', false, '主订单列表'],
    ['API07', 'GET', '/jobs', false, '任务列表'],
    ['API08', 'GET', '/delivery', false, '配送单列表'],
    ['API09', 'GET', '/warehouse/inbound', false, '入库记录列表'],
    ['API10', 'GET', '/auth/users', true, '用户管理列表(需鉴权)'],
    ['API11', 'GET', '/sales/dashboard', false, '销售看板汇总'],
  ];

  for (const [id, method, endpoint, needAuth, name] of endpoints) {
    try {
      const r = await api(method, endpoint, needAuth ? token : '');
      apiChecks.push({
        id,
        name,
        pass: Boolean(r.ok),
        detail: `status=${r.status}`,
      });
    } catch (err) {
      apiChecks.push({
        id,
        name,
        pass: false,
        detail: err.message,
      });
    }
  }

  const dbChecks = runDbChecks();

  const connectedCount = pageRows.filter((r) => r.closure === 'API_CONNECTED').length;
  const staticCount = pageRows.length - connectedCount;
  const apiPass = apiChecks.filter((r) => r.pass).length;
  const dbPass = dbChecks.filter((r) => r.pass).length;

  const md = [];
  md.push('# 全模块闭环审计报告');
  md.push('');
  md.push(`- 执行开始: ${runStart}`);
  md.push(`- 执行结束: ${new Date().toISOString()}`);
  md.push(`- API 基址: \`${BASE_URL}\``);
  md.push(`- 页面总数: ${pageRows.length}`);
  md.push(`- 已接 API: ${connectedCount}`);
  md.push(`- 静态/模拟页: ${staticCount}`);
  md.push(`- API 冒烟通过: ${apiPass}/${apiChecks.length}`);
  md.push(`- 数据关系通过: ${dbPass}/${dbChecks.length}`);
  md.push('');
  md.push('## 1) 页面接线审计');
  md.push('');
  md.push('| 模块 | 页面 | 闭环状态 | 说明 | 文件 |');
  md.push('|---|---|---|---|---|');
  for (const r of pageRows.sort((a, b) => a.module.localeCompare(b.module) || a.page.localeCompare(b.page))) {
    md.push(`| ${safe(r.module)} | ${safe(r.page)} | ${safe(r.closure)} | ${safe(r.note)} | ${safe(r.file)} |`);
  }
  md.push('');
  md.push('## 2) API 冒烟');
  md.push('');
  md.push('| ID | 结果 | 检查项 | 明细 |');
  md.push('|---|---|---|---|');
  for (const r of apiChecks) {
    md.push(`| ${safe(r.id)} | ${r.pass ? 'PASS' : 'FAIL'} | ${safe(r.name)} | ${safe(r.detail)} |`);
  }
  md.push('');
  md.push('## 3) 数据关系审计');
  md.push('');
  md.push('| ID | 结果 | 检查项 | 明细 |');
  md.push('|---|---|---|---|');
  for (const r of dbChecks) {
    md.push(`| ${safe(r.id)} | ${r.pass ? 'PASS' : 'FAIL'} | ${safe(r.name)} | ${safe(r.detail)} |`);
  }
  md.push('');
  md.push('## 4) 结论');
  md.push('');
  if (staticCount === 0 && apiPass === apiChecks.length && dbPass === dbChecks.length) {
    md.push('- 全模块已达到可执行闭环口径。');
  } else {
    md.push('- 当前仍存在未接 API 页面或数据关系缺口，尚未达到“全模块完全闭环”。');
    md.push('- 优先处理：`STATIC_OR_MOCK` 页面、`FAIL` 的 API 冒烟项、`FAIL` 的数据关系项。');
  }

  const outDir = path.resolve(ROOT, 'docs/test-results');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `全模块闭环审计报告_${nowStamp()}.md`);
  fs.writeFileSync(outPath, md.join('\n'), 'utf8');

  console.log(`RESULT_MD=${outPath}`);
  console.log(`SUMMARY pages=${pageRows.length} connected=${connectedCount} static=${staticCount} apiPass=${apiPass}/${apiChecks.length} dbPass=${dbPass}/${dbChecks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
