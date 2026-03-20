#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../..');
const verifyScript = path.resolve(__dirname, 'verify-v2-full-flow.js');
const reportDir = path.resolve(repoRoot, 'docs', 'reports');
const reportJsonPath = path.resolve(reportDir, 'v2-full-flow-verify-latest.json');
const reportMdPath = path.resolve(reportDir, 'v2-full-flow-verify-latest.md');

const lines = process.argv.slice(2).map((v) => String(v).toUpperCase()).filter(Boolean);
const targetLines = lines.length > 0 ? lines : ['SEA', 'AIR'];

const parseJsonFromText = (text) => {
  const trimmed = String(text || '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  const maybeJson = trimmed.slice(start, end + 1);
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
};

const runOne = (line) => {
  const startedAt = Date.now();
  const proc = spawnSync(process.execPath, [verifyScript, line], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  const durationMs = Date.now() - startedAt;
  const stdout = String(proc.stdout || '');
  const stderr = String(proc.stderr || '');
  const merged = `${stdout}${stderr}`.trim();

  if (proc.status === 0) {
    const parsed = parseJsonFromText(stdout) || parseJsonFromText(merged);
    return {
      line,
      ok: true,
      exitCode: proc.status,
      durationMs,
      summary: parsed,
      raw: merged,
    };
  }

  return {
    line,
    ok: false,
    exitCode: proc.status,
    durationMs,
    error: merged || `exit code ${proc.status}`,
  };
};

const toMarkdown = (report) => {
  const rows = report.results.map((r) => {
    const status = r.ok ? 'PASS' : 'FAIL';
    const orderNo = r.summary?.orderNo || '-';
    const orderStatus = r.summary?.finalOrderStatus || '-';
    const orderStatusAfterSign = r.summary?.orderStatusAfterSign || '-';
    const paymentStatusAfterSign = r.summary?.paymentStatusAfterSign || '-';
    const paymentStatus = r.summary?.finalPaymentStatus || '-';
    const subStatuses = Array.isArray(r.summary?.finalSubStatuses) ? r.summary.finalSubStatuses.join(',') : '-';
    const error = r.ok ? '-' : (r.error || '-').replace(/\n/g, ' ');
    return `| ${r.line} | ${status} | ${orderNo} | ${orderStatusAfterSign} | ${paymentStatusAfterSign} | ${orderStatus} | ${paymentStatus} | ${subStatuses} | ${r.durationMs} | ${error} |`;
  });

  const header = [
    '# V2 全链路验证报告',
    '',
    `- 执行时间: ${report.executedAt}`,
    `- 总体结果: ${report.ok ? 'PASS' : 'FAIL'}`,
    `- 覆盖业务线: ${report.lines.join(', ')}`,
    '',
    '| 业务线 | 结果 | 主单号 | 签收后主单 | 签收后支付 | 最终主单 | 最终支付 | 子单状态 | 耗时(ms) | 错误 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |',
  ];

  return [...header, ...rows, ''].join('\n');
};

const main = () => {
  const executedAt = new Date().toISOString();
  const results = targetLines.map(runOne);
  const ok = results.every((r) => r.ok);
  const report = { executedAt, ok, lines: targetLines, results };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(reportMdPath, toMarkdown(report), 'utf8');

  console.log(JSON.stringify({
    ok,
    lines: targetLines,
    reportJsonPath,
    reportMdPath,
  }, null, 2));

  if (!ok) process.exit(1);
};

main();
