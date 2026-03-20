#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const BetterSqlite3 = require(path.resolve(__dirname, '../node_modules/better-sqlite3'));

const serverRoot = path.resolve(__dirname, '..');
process.chdir(serverRoot);
require(path.resolve(serverRoot, 'node_modules/ts-node/register/transpile-only'));

for (const file of ['logistics.db', 'logistics_v2.db']) {
  const target = path.resolve(serverRoot, file);
  if (fs.existsSync(target)) fs.unlinkSync(target);
}

const { createTables } = require('../src/database/schema');
const { seedData } = require('../src/database/seed');
const { createV2Tables } = require('../src/database/schemaV2');
const { seedV2Data } = require('../src/database/seedV2');

createTables();
seedData();
createV2Tables();
seedV2Data();

const v2Db = new BetterSqlite3(path.resolve(serverRoot, 'logistics_v2.db'));
v2Db.prepare(`
  INSERT OR IGNORE INTO sys_user (
    id, username, real_name, password_hash, email, phone, role_code, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
`).run('U-SALES-02', 'sales2', '销售B', 'sales123', 'sales2@example.com', '13800000005', 'SALES', new Date().toISOString(), new Date().toISOString());
v2Db.close();

require('./seed-v2-multi-flow-demo');
console.log('Fresh closure demo data is ready.');
