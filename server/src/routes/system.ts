import { Router } from 'express';
import { getDb } from '../database/connection';
import { success, error } from '../utils/response';
import { generateId } from '../utils/idGenerator';

const router = Router();

const DEFAULT_CURRENCY_META: Record<string, { name: string; nameEn: string; symbol: string }> = {
  USD: { name: '美元', nameEn: 'US Dollar', symbol: '$' },
  EUR: { name: '欧元', nameEn: 'Euro', symbol: '€' },
  GBP: { name: '英镑', nameEn: 'British Pound', symbol: '£' },
  JPY: { name: '日元', nameEn: 'Japanese Yen', symbol: '¥' },
  HKD: { name: '港币', nameEn: 'Hong Kong Dollar', symbol: 'HK$' },
  AUD: { name: '澳元', nameEn: 'Australian Dollar', symbol: 'A$' },
  CAD: { name: '加元', nameEn: 'Canadian Dollar', symbol: 'C$' },
  SGD: { name: '新加坡元', nameEn: 'Singapore Dollar', symbol: 'S$' },
  NGN: { name: '尼日利亚奈拉', nameEn: 'Nigerian Naira', symbol: '₦' },
  GHS: { name: '加纳塞地', nameEn: 'Ghanaian Cedi', symbol: '₵' },
};

const CONTINENT_VALUES = new Set([
  'ASIA',
  'EUROPE',
  'NORTH_AMERICA',
  'SOUTH_AMERICA',
  'AFRICA',
  'OCEANIA',
]);

const WORKFLOW_STATUS_VALUES = new Set(['ACTIVE', 'INACTIVE', 'DRAFT']);
const SITE_TYPE_VALUES = new Set(['HQ', 'DISPATCH_CENTER', 'SATELLITE']);
const LOGISTICS_NODE_TYPE_VALUES = new Set([
  'PICKUP',
  'WAREHOUSE_IN',
  'CUSTOMS_EXPORT',
  'DEPARTURE',
  'IN_TRANSIT',
  'ARRIVAL',
  'CUSTOMS_IMPORT',
  'WAREHOUSE_OUT',
  'DELIVERY',
  'SIGNED',
]);
const RBAC_STATUS_VALUES = new Set(['ACTIVE', 'INACTIVE']);
const RBAC_ROLE_SCOPE_VALUES = new Set(['ALL_SITE', 'ASSIGNED_SITE', 'OWN_SITE']);
const RBAC_PERMISSION_TYPE_VALUES = new Set(['MENU', 'TAB', 'BUTTON', 'API']);
const BASE_DATA_TYPE_VALUES = new Set([
  'ORDER_SERVICE_TYPE',
  'PAYMENT_METHOD',
  'PAYMENT_CHANNEL',
  'CONTAINER_TYPE',
  'EXPRESS_COMPANY',
  'CARRIER',
  'CARGO_CATEGORY',
  'CARGO_TYPE',
  'FEE_TYPE',
  'ORDER_REMARK_TAG',
]);
const BASE_DATA_STATUS_VALUES = new Set(['ACTIVE', 'INACTIVE']);
const TRANSPORT_MODE_VALUES = new Set(['ALL', 'SEA', 'AIR']);

function parseJsonSafe(value: any, fallback: any = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
}

function normalizeFreightRuleRow(row: any) {
  return {
    ...row,
    continuationTiers: parseJsonSafe(row?.continuationTiers, []),
    surchargeRates: parseJsonSafe(row?.surchargeRates, {}),
  };
}

function normalizeCountryRow(row: any) {
  return {
    ...row,
    isOrigin: Number(row?.isOrigin || 0) === 1,
    isDestination: Number(row?.isDestination || 0) === 1,
    requiresMaterial: Number(row?.requiresMaterial || 0) === 1,
  };
}

function normalizeCityRow(row: any) {
  return {
    ...row,
    isPort: Number(row?.isPort || 0) === 1,
    isAirport: Number(row?.isAirport || 0) === 1,
  };
}

function normalizeSiteRow(row: any) {
  return {
    ...row,
  };
}

function normalizeLogisticsNodeRow(row: any) {
  return {
    ...row,
    isRequired: Number(row?.isRequired || 0) === 1,
  };
}

function toBooleanInt(value: any) {
  return value ? 1 : 0;
}

function normalizeWorkflowRow(row: any) {
  return {
    ...row,
    nodes: parseJsonSafe(row?.nodes, []),
  };
}

function normalizeDepartmentRow(row: any) {
  return {
    ...row,
  };
}

function normalizeRbacRoleRow(row: any) {
  return {
    ...row,
    isSystem: Number(row?.isSystem || 0) === 1,
  };
}

function normalizeRbacPermissionRow(row: any) {
  return {
    ...row,
  };
}

function normalizeBaseDataRow(row: any) {
  return {
    ...row,
    sortOrder: Number(row?.sortOrder || 0),
    isBuiltin: Number(row?.isBuiltin || 0) === 1,
    extra: parseJsonSafe(row?.extra, null),
  };
}

function resolvePermissionIds(db: any, payload: any) {
  if (Array.isArray(payload?.permissionIds)) {
    const permissionIds = payload.permissionIds.map((id: any) => String(id));
    if (permissionIds.length === 0) return [];
    const placeholders = permissionIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id FROM sys_permissions WHERE id IN (${placeholders})`).all(...permissionIds) as any[];
    if (rows.length !== permissionIds.length) {
      throw new Error('Some permissionIds are invalid');
    }
    return permissionIds;
  }

  if (Array.isArray(payload?.permissionCodes)) {
    const permissionCodes = payload.permissionCodes.map((code: any) => String(code).trim());
    if (permissionCodes.length === 0) return [];
    const placeholders = permissionCodes.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id, permissionCode FROM sys_permissions WHERE permissionCode IN (${placeholders})`).all(...permissionCodes) as any[];
    if (rows.length !== permissionCodes.length) {
      throw new Error('Some permissionCodes are invalid');
    }
    return rows.map((row) => row.id);
  }

  return [];
}

function resolveRoleIds(db: any, payload: any) {
  if (Array.isArray(payload?.roleIds)) {
    const roleIds = payload.roleIds.map((id: any) => String(id));
    if (roleIds.length === 0) return [];
    const placeholders = roleIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id FROM sys_roles WHERE id IN (${placeholders})`).all(...roleIds) as any[];
    if (rows.length !== roleIds.length) {
      throw new Error('Some roleIds are invalid');
    }
    return roleIds;
  }

  if (Array.isArray(payload?.roleCodes)) {
    const roleCodes = payload.roleCodes.map((code: any) => String(code).trim().toUpperCase());
    if (roleCodes.length === 0) return [];
    const placeholders = roleCodes.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id, roleCode FROM sys_roles WHERE roleCode IN (${placeholders})`).all(...roleCodes) as any[];
    if (rows.length !== roleCodes.length) {
      throw new Error('Some roleCodes are invalid');
    }
    return rows.map((row) => row.id);
  }

  return [];
}

function listCitiesWithSites(db: any, countryId: string) {
  const cityRows = db.prepare('SELECT * FROM cities WHERE countryId = ? ORDER BY cityName ASC').all(countryId) as any[];
  if (cityRows.length === 0) return [];

  const cityIds = cityRows.map((city) => city.id);
  const placeholders = cityIds.map(() => '?').join(',');
  const siteRows = db.prepare(`
    SELECT * FROM sites
    WHERE cityId IN (${placeholders})
    ORDER BY siteName ASC
  `).all(...cityIds) as any[];

  const siteMap = new Map<string, any[]>();
  for (const site of siteRows) {
    const list = siteMap.get(site.cityId) || [];
    list.push(normalizeSiteRow(site));
    siteMap.set(site.cityId, list);
  }

  return cityRows.map((city) => ({
    ...normalizeCityRow(city),
    sites: siteMap.get(city.id) || [],
  }));
}

function buildBaseDataCode(dataName: string) {
  const cleaned = String(dataName || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  if (cleaned) return cleaned;
  return `ITEM_${Date.now()}`;
}

// ==================== BASE DATA (统一基础设置字典) ====================

// GET /api/system/base-data
router.get('/base-data', (req, res) => {
  const db = getDb();
  const { dataType, status, transportMode, keyword } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (dataType) {
    const dataTypeValue = String(dataType).trim().toUpperCase();
    if (!BASE_DATA_TYPE_VALUES.has(dataTypeValue)) {
      error(res, 'Invalid dataType');
      return;
    }
    where += ' AND dataType = ?';
    params.push(dataTypeValue);
  }

  if (status) {
    const statusValue = String(status).trim().toUpperCase();
    if (!BASE_DATA_STATUS_VALUES.has(statusValue)) {
      error(res, 'Invalid status');
      return;
    }
    where += ' AND status = ?';
    params.push(statusValue);
  }

  if (transportMode) {
    const modeValue = String(transportMode).trim().toUpperCase();
    if (!TRANSPORT_MODE_VALUES.has(modeValue)) {
      error(res, 'Invalid transportMode');
      return;
    }
    if (modeValue === 'ALL') {
      where += " AND transportMode = 'ALL'";
    } else {
      where += " AND (transportMode = 'ALL' OR transportMode = ?)";
      params.push(modeValue);
    }
  }

  if (keyword) {
    const pattern = `%${String(keyword).trim()}%`;
    where += ' AND (dataCode LIKE ? OR dataName LIKE ? OR dataNameEn LIKE ?)';
    params.push(pattern, pattern, pattern);
  }

  const rows = db.prepare(`
    SELECT *
    FROM base_data_items
    ${where}
    ORDER BY dataType ASC, sortOrder ASC, dataCode ASC
  `).all(...params) as any[];

  success(res, rows.map(normalizeBaseDataRow));
});

// GET /api/system/base-data/options
router.get('/base-data/options', (req, res) => {
  const db = getDb();
  const { types, transportMode } = req.query;

  const typeValues = Array.isArray(types)
    ? types.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
    : String(types || '')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

  const targetTypes = typeValues.length > 0
    ? typeValues
    : Array.from(BASE_DATA_TYPE_VALUES);

  const invalidType = targetTypes.find((type) => !BASE_DATA_TYPE_VALUES.has(type));
  if (invalidType) {
    error(res, `Invalid type: ${invalidType}`);
    return;
  }

  const params: any[] = [];
  const placeholders = targetTypes.map(() => '?').join(',');
  params.push(...targetTypes);

  let modeClause = '';
  if (transportMode) {
    const modeValue = String(transportMode).trim().toUpperCase();
    if (!TRANSPORT_MODE_VALUES.has(modeValue)) {
      error(res, 'Invalid transportMode');
      return;
    }
    if (modeValue === 'ALL') {
      modeClause = " AND transportMode = 'ALL'";
    } else {
      modeClause = " AND (transportMode = 'ALL' OR transportMode = ?)";
      params.push(modeValue);
    }
  }

  const rows = db.prepare(`
    SELECT *
    FROM base_data_items
    WHERE dataType IN (${placeholders})
      AND status = 'ACTIVE'
      ${modeClause}
    ORDER BY dataType ASC, sortOrder ASC, dataCode ASC
  `).all(...params) as any[];

  const grouped: Record<string, any[]> = {};
  for (const type of targetTypes) grouped[type] = [];
  rows.forEach((row) => {
    const normalized = normalizeBaseDataRow(row);
    grouped[normalized.dataType] = grouped[normalized.dataType] || [];
    grouped[normalized.dataType].push(normalized);
  });

  success(res, grouped);
});

// POST /api/system/base-data
router.post('/base-data', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const id = generateId('BDI');
  const payload = req.body || {};

  const dataType = String(payload.dataType || '').trim().toUpperCase();
  const dataCode = String(payload.dataCode || '').trim().toUpperCase() || buildBaseDataCode(payload.dataName);
  const dataName = String(payload.dataName || '').trim();
  const dataNameEn = payload.dataNameEn ? String(payload.dataNameEn).trim() : null;
  const transportMode = String(payload.transportMode || 'ALL').trim().toUpperCase();
  const status = String(payload.status || 'ACTIVE').trim().toUpperCase();
  const sortOrder = Number(payload.sortOrder || 0);
  const extra = payload.extra ? JSON.stringify(payload.extra) : null;
  const remark = payload.remark ? String(payload.remark).trim() : null;

  if (!dataType || !BASE_DATA_TYPE_VALUES.has(dataType)) {
    error(res, 'Invalid dataType');
    return;
  }
  if (!dataCode || !dataName) {
    error(res, 'Missing required fields: dataCode, dataName');
    return;
  }
  if (!TRANSPORT_MODE_VALUES.has(transportMode)) {
    error(res, 'Invalid transportMode');
    return;
  }
  if (!BASE_DATA_STATUS_VALUES.has(status)) {
    error(res, 'Invalid status');
    return;
  }

  const duplicate = db.prepare('SELECT id FROM base_data_items WHERE dataType = ? AND dataCode = ?').get(dataType, dataCode);
  if (duplicate) {
    error(res, 'dataCode already exists under this dataType');
    return;
  }

  db.prepare(`
    INSERT INTO base_data_items
    (id, dataType, dataCode, dataName, dataNameEn, transportMode, sortOrder, status, isBuiltin, extra, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(
    id,
    dataType,
    dataCode,
    dataName,
    dataNameEn,
    transportMode,
    Number.isFinite(sortOrder) ? sortOrder : 0,
    status,
    extra,
    remark,
    now,
    now
  );

  const row = db.prepare('SELECT * FROM base_data_items WHERE id = ?').get(id);
  success(res, normalizeBaseDataRow(row));
});

// PUT /api/system/base-data/:id
router.put('/base-data/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM base_data_items WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Base data item not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;

  if (fields.dataType !== undefined) {
    fields.dataType = String(fields.dataType).trim().toUpperCase();
    if (!BASE_DATA_TYPE_VALUES.has(fields.dataType)) {
      error(res, 'Invalid dataType');
      return;
    }
  }
  if (fields.dataCode !== undefined) {
    fields.dataCode = String(fields.dataCode).trim().toUpperCase();
    if (!fields.dataCode) {
      error(res, 'dataCode cannot be empty');
      return;
    }
  }
  if (fields.dataName !== undefined) {
    fields.dataName = String(fields.dataName).trim();
    if (!fields.dataName) {
      error(res, 'dataName cannot be empty');
      return;
    }
  }
  if (fields.transportMode !== undefined) {
    fields.transportMode = String(fields.transportMode).trim().toUpperCase();
    if (!TRANSPORT_MODE_VALUES.has(fields.transportMode)) {
      error(res, 'Invalid transportMode');
      return;
    }
  }
  if (fields.status !== undefined) {
    fields.status = String(fields.status).trim().toUpperCase();
    if (!BASE_DATA_STATUS_VALUES.has(fields.status)) {
      error(res, 'Invalid status');
      return;
    }
  }
  if (fields.sortOrder !== undefined) {
    const n = Number(fields.sortOrder);
    if (!Number.isFinite(n)) {
      error(res, 'sortOrder must be number');
      return;
    }
    fields.sortOrder = n;
  }
  if (fields.dataNameEn !== undefined && fields.dataNameEn !== null) {
    fields.dataNameEn = String(fields.dataNameEn).trim();
  }
  if (fields.remark !== undefined && fields.remark !== null) {
    fields.remark = String(fields.remark).trim();
  }
  if (fields.extra !== undefined) {
    fields.extra = fields.extra ? JSON.stringify(fields.extra) : null;
  }

  const nextType = fields.dataType || existing.dataType;
  const nextCode = fields.dataCode || existing.dataCode;
  const duplicate = db.prepare('SELECT id FROM base_data_items WHERE dataType = ? AND dataCode = ? AND id != ?')
    .get(nextType, nextCode, req.params.id);
  if (duplicate) {
    error(res, 'dataCode already exists under this dataType');
    return;
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt' || key === 'isBuiltin') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  if (sets.length <= 1) {
    success(res, normalizeBaseDataRow(existing));
    return;
  }

  db.prepare(`UPDATE base_data_items SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM base_data_items WHERE id = ?').get(req.params.id);
  success(res, normalizeBaseDataRow(row));
});

// DELETE /api/system/base-data/:id
router.delete('/base-data/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM base_data_items WHERE id = ?').get(req.params.id) as any;
  if (!row) {
    error(res, 'Base data item not found', 404);
    return;
  }
  if (Number(row.isBuiltin || 0) === 1) {
    error(res, 'Built-in base data item cannot be deleted');
    return;
  }

  db.prepare('DELETE FROM base_data_items WHERE id = ?').run(req.params.id);
  success(res, null, 'Base data item deleted');
});

// GET /api/system/routes
router.get('/routes', (req, res) => {
  const db = getDb();
  const { transportType, originCity, destCountry, status } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (transportType) { where += ' AND transportType = ?'; params.push(transportType); }
  if (originCity) { where += ' AND originCity = ?'; params.push(originCity); }
  if (destCountry) { where += ' AND destCountry = ?'; params.push(destCountry); }
  if (status) { where += ' AND status = ?'; params.push(status); }

  const rows = db.prepare(`SELECT * FROM routes_config ${where} ORDER BY originCity, destCity`).all(...params);
  success(res, rows);
});

// POST /api/system/routes
router.post('/routes', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const id = generateId('ROUTE');
  const {
    originCountry,
    originCity,
    destCountry,
    destCity,
    transportType,
    transitDays,
    pricePerKg,
    pricePerCbm,
    freightDiscount,
    volumeRatio,
    firstWeightValue,
    firstWeightCOD_USD,
    firstWeightPrepaid_RMB,
    arrivalStation,
    status,
    remark,
  } = req.body;

  if (!originCountry || !originCity || !destCountry || !destCity || !transportType) {
    error(res, 'Missing required fields: originCountry, originCity, destCountry, destCity, transportType');
    return;
  }

  db.prepare(`
    INSERT INTO routes_config (
      id, originCountry, originCity, destCountry, destCity, transportType, transitDays,
      pricePerKg, pricePerCbm, freightDiscount, volumeRatio, firstWeightValue,
      firstWeightCOD_USD, firstWeightPrepaid_RMB, arrivalStation, status, remark, createdAt, updatedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    originCountry,
    originCity,
    destCountry,
    destCity,
    transportType,
    transitDays || null,
    pricePerKg ?? null,
    pricePerCbm ?? null,
    freightDiscount ?? null,
    volumeRatio ?? null,
    firstWeightValue ?? null,
    firstWeightCOD_USD ?? null,
    firstWeightPrepaid_RMB ?? null,
    arrivalStation || null,
    status || 'ACTIVE',
    remark || null,
    now,
    now
  );

  const row = db.prepare('SELECT * FROM routes_config WHERE id = ?').get(id);
  success(res, row);
});

// PUT /api/system/routes/:id
router.put('/routes/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM routes_config WHERE id = ?').get(req.params.id);
  if (!existing) {
    error(res, 'Route not found', 404);
    return;
  }

  const sets: string[] = [];
  const params: any[] = [];
  const fields = req.body || {};
  const skip = new Set(['id', 'createdAt']);
  for (const [key, value] of Object.entries(fields)) {
    if (skip.has(key)) continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  if (sets.length <= 1) {
    const row = db.prepare('SELECT * FROM routes_config WHERE id = ?').get(req.params.id);
    success(res, row);
    return;
  }

  db.prepare(`UPDATE routes_config SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM routes_config WHERE id = ?').get(req.params.id);
  success(res, row);
});

// DELETE /api/system/routes/:id
router.delete('/routes/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM routes_config WHERE id = ?').get(req.params.id);
  if (!existing) {
    error(res, 'Route not found', 404);
    return;
  }
  db.prepare('DELETE FROM routes_config WHERE id = ?').run(req.params.id);
  success(res, null, 'Route deleted');
});

// ==================== ROUTE LOGISTICS NODES ====================

// GET /api/system/logistics-nodes
router.get('/logistics-nodes', (req, res) => {
  const db = getDb();
  const { routeId, status } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (routeId) { where += ' AND n.routeId = ?'; params.push(routeId); }
  if (status) { where += ' AND n.status = ?'; params.push(status); }

  const rows = db.prepare(`
    SELECT n.*, r.originCountry, r.originCity, r.destCountry, r.destCity, r.transportType
    FROM route_logistics_nodes n
    INNER JOIN routes_config r ON r.id = n.routeId
    ${where}
    ORDER BY n.routeId ASC, n.sortOrder ASC, datetime(n.createdAt) ASC
  `).all(...params) as any[];

  success(res, rows.map(normalizeLogisticsNodeRow));
});

// POST /api/system/logistics-nodes
router.post('/logistics-nodes', (req, res) => {
  const db = getDb();
  const id = generateId('LNODE');
  const now = new Date().toISOString();
  const payload = req.body || {};

  const routeId = String(payload.routeId || '').trim();
  const nodeCode = String(payload.nodeCode || '').trim().toUpperCase();
  const nodeName = String(payload.nodeName || '').trim();
  const nodeType = String(payload.nodeType || '').trim().toUpperCase();
  const sortOrder = Number(payload.sortOrder || 0);

  if (!routeId || !nodeCode || !nodeName || !nodeType) {
    error(res, 'Missing required fields: routeId, nodeCode, nodeName, nodeType');
    return;
  }
  if (!LOGISTICS_NODE_TYPE_VALUES.has(nodeType)) {
    error(res, 'Invalid nodeType');
    return;
  }
  if (!Number.isFinite(sortOrder) || sortOrder <= 0) {
    error(res, 'sortOrder must be a positive number');
    return;
  }

  const route = db.prepare('SELECT id FROM routes_config WHERE id = ?').get(routeId);
  if (!route) {
    error(res, 'Route not found', 404);
    return;
  }

  const duplicate = db.prepare('SELECT id FROM route_logistics_nodes WHERE routeId = ? AND nodeCode = ?').get(routeId, nodeCode);
  if (duplicate) {
    error(res, 'nodeCode already exists in this route');
    return;
  }

  db.prepare(`
    INSERT INTO route_logistics_nodes
    (id, routeId, nodeCode, nodeName, nodeNameEn, nodeType, sortOrder, isRequired, description, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    routeId,
    nodeCode,
    nodeName,
    payload.nodeNameEn || null,
    nodeType,
    sortOrder,
    payload.isRequired === false ? 0 : 1,
    payload.description || null,
    payload.status || 'ACTIVE',
    now,
    now
  );

  const row = db.prepare(`
    SELECT n.*, r.originCountry, r.originCity, r.destCountry, r.destCity, r.transportType
    FROM route_logistics_nodes n
    INNER JOIN routes_config r ON r.id = n.routeId
    WHERE n.id = ?
  `).get(id);
  success(res, normalizeLogisticsNodeRow(row));
});

// PUT /api/system/logistics-nodes/:id
router.put('/logistics-nodes/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM route_logistics_nodes WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Logistics node not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;
  if (fields.nodeCode !== undefined) {
    fields.nodeCode = String(fields.nodeCode).trim().toUpperCase();
    if (!fields.nodeCode) {
      error(res, 'nodeCode cannot be empty');
      return;
    }
  }
  if (fields.nodeType !== undefined) {
    fields.nodeType = String(fields.nodeType).trim().toUpperCase();
    if (!LOGISTICS_NODE_TYPE_VALUES.has(fields.nodeType)) {
      error(res, 'Invalid nodeType');
      return;
    }
  }
  if (fields.sortOrder !== undefined) {
    const sortOrder = Number(fields.sortOrder);
    if (!Number.isFinite(sortOrder) || sortOrder <= 0) {
      error(res, 'sortOrder must be a positive number');
      return;
    }
    fields.sortOrder = sortOrder;
  }
  if (fields.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(String(fields.status))) {
    error(res, 'Invalid status');
    return;
  }
  if (fields.isRequired !== undefined) {
    fields.isRequired = fields.isRequired ? 1 : 0;
  }

  const routeId = String(fields.routeId || existing.routeId);
  if (routeId !== existing.routeId) {
    const route = db.prepare('SELECT id FROM routes_config WHERE id = ?').get(routeId);
    if (!route) {
      error(res, 'Route not found', 404);
      return;
    }
  }

  const nodeCode = String(fields.nodeCode || existing.nodeCode);
  const duplicate = db.prepare(`
    SELECT id FROM route_logistics_nodes
    WHERE routeId = ? AND nodeCode = ? AND id != ?
  `).get(routeId, nodeCode, req.params.id);
  if (duplicate) {
    error(res, 'nodeCode already exists in this route');
    return;
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  if (sets.length > 1) {
    db.prepare(`UPDATE route_logistics_nodes SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  const row = db.prepare(`
    SELECT n.*, r.originCountry, r.originCity, r.destCountry, r.destCity, r.transportType
    FROM route_logistics_nodes n
    INNER JOIN routes_config r ON r.id = n.routeId
    WHERE n.id = ?
  `).get(req.params.id);
  success(res, normalizeLogisticsNodeRow(row));
});

// DELETE /api/system/logistics-nodes/:id
router.delete('/logistics-nodes/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM route_logistics_nodes WHERE id = ?').get(req.params.id);
  if (!existing) {
    error(res, 'Logistics node not found', 404);
    return;
  }
  db.prepare('DELETE FROM route_logistics_nodes WHERE id = ?').run(req.params.id);
  success(res, null, 'Logistics node deleted');
});

// GET /api/system/exchange-rates
router.get('/exchange-rates', (req, res) => {
  const db = getDb();
  const { status, currencyCode } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (currencyCode) { where += ' AND currencyCode = ?'; params.push(String(currencyCode).toUpperCase()); }

  let currencies = db.prepare(`SELECT * FROM exchange_currencies ${where} ORDER BY currencyCode ASC`).all(...params) as any[];

  // Init defaults for old DB files
  if (currencies.length === 0) {
    const now = new Date().toISOString();
    const defaults = [
      { currencyCode: 'USD', rate: 7.1429 },
      { currencyCode: 'EUR', rate: 7.6923 },
      { currencyCode: 'GBP', rate: 9.0909 },
      { currencyCode: 'NGN', rate: 0.0047 },
      { currencyCode: 'GHS', rate: 0.5814 },
    ];

    const insertCurrency = db.prepare(`
      INSERT INTO exchange_currencies
      (id, currencyCode, currencyName, currencyNameEn, symbol, manualRate, liveRate, rateDate, remark, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);
    const insertHistory = db.prepare(`
      INSERT INTO exchange_rate_history
      (id, currencyCode, rate, rateType, recordDate, operator, createdAt)
      VALUES (?, ?, ?, 'MANUAL', ?, 'SYSTEM', ?)
    `);

    const tx = db.transaction(() => {
      for (const item of defaults) {
        const meta = DEFAULT_CURRENCY_META[item.currencyCode] || { name: item.currencyCode, nameEn: item.currencyCode, symbol: item.currencyCode };
        const id = generateId('CUR');
        insertCurrency.run(id, item.currencyCode, meta.name, meta.nameEn, meta.symbol, item.rate, item.rate, now.slice(0, 10), null, now, now);
        insertHistory.run(generateId('ERH'), item.currencyCode, item.rate, now.slice(0, 10), now);
      }
    });
    tx();

    currencies = db.prepare(`SELECT * FROM exchange_currencies ${where} ORDER BY currencyCode ASC`).all(...params) as any[];
  }

  const historyWhere = currencyCode ? 'WHERE currencyCode = ?' : '';
  const historyParams = currencyCode ? [String(currencyCode).toUpperCase()] : [];
  const rateHistory = db.prepare(`
    SELECT * FROM exchange_rate_history
    ${historyWhere}
    ORDER BY createdAt DESC
    LIMIT 500
  `).all(...historyParams);

  const rates: Record<string, number> = { CNY: 1 };
  for (const row of currencies) {
    if (row.manualRate && Number(row.manualRate) > 0) {
      rates[row.currencyCode] = Number((1 / Number(row.manualRate)).toFixed(6));
    }
  }
  const latestUpdatedAt = currencies.reduce((max, row) => {
    const current = String(row.updatedAt || row.createdAt || '');
    return current > max ? current : max;
  }, '');

  success(res, {
    base: 'CNY',
    rates,
    updatedAt: latestUpdatedAt || new Date().toISOString(),
    currencies,
    rateHistory,
  });
});

// POST /api/system/exchange-rates/currencies
router.post('/exchange-rates/currencies', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const id = generateId('CUR');
  const {
    currencyCode,
    currencyName,
    currencyNameEn,
    symbol,
    manualRate,
    liveRate,
    rateDate,
    remark,
    status,
  } = req.body || {};

  const code = String(currencyCode || '').trim().toUpperCase();
  if (!code || !currencyName) {
    error(res, 'Missing required fields: currencyCode, currencyName');
    return;
  }
  if (!/^[A-Z]{3}$/.test(code)) {
    error(res, 'currencyCode must be 3 uppercase letters');
    return;
  }

  const exists = db.prepare('SELECT id FROM exchange_currencies WHERE currencyCode = ?').get(code);
  if (exists) {
    error(res, 'Currency code already exists');
    return;
  }

  db.prepare(`
    INSERT INTO exchange_currencies
    (id, currencyCode, currencyName, currencyNameEn, symbol, manualRate, liveRate, rateDate, remark, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    code,
    currencyName,
    currencyNameEn || null,
    symbol || code,
    manualRate ?? null,
    liveRate ?? manualRate ?? null,
    rateDate || now.slice(0, 10),
    remark || null,
    status || 'ACTIVE',
    now,
    now
  );

  if (manualRate !== undefined && manualRate !== null) {
    db.prepare(`
      INSERT INTO exchange_rate_history
      (id, currencyCode, rate, rateType, recordDate, operator, createdAt)
      VALUES (?, ?, ?, 'MANUAL', ?, ?, ?)
    `).run(generateId('ERH'), code, Number(manualRate), rateDate || now.slice(0, 10), 'SYSTEM', now);
  }

  const row = db.prepare('SELECT * FROM exchange_currencies WHERE id = ?').get(id);
  success(res, row);
});

// PUT /api/system/exchange-rates/currencies/:id
router.put('/exchange-rates/currencies/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM exchange_currencies WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Currency not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;
  if (fields.currencyCode) {
    fields.currencyCode = String(fields.currencyCode).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(fields.currencyCode)) {
      error(res, 'currencyCode must be 3 uppercase letters');
      return;
    }
    const duplicate = db.prepare('SELECT id FROM exchange_currencies WHERE currencyCode = ? AND id != ?')
      .get(fields.currencyCode, req.params.id);
    if (duplicate) {
      error(res, 'Currency code already exists');
      return;
    }
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  if (sets.length <= 1) {
    const row = db.prepare('SELECT * FROM exchange_currencies WHERE id = ?').get(req.params.id);
    success(res, row);
    return;
  }

  db.prepare(`UPDATE exchange_currencies SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM exchange_currencies WHERE id = ?').get(req.params.id);
  success(res, row);
});

// DELETE /api/system/exchange-rates/currencies/:id
router.delete('/exchange-rates/currencies/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM exchange_currencies WHERE id = ?').get(req.params.id) as any;
  if (!row) {
    error(res, 'Currency not found', 404);
    return;
  }
  db.prepare('DELETE FROM exchange_rate_history WHERE currencyCode = ?').run(row.currencyCode);
  db.prepare('DELETE FROM exchange_currencies WHERE id = ?').run(req.params.id);
  success(res, null, 'Currency deleted');
});

// POST /api/system/exchange-rates/currencies/:currencyCode/rates
router.post('/exchange-rates/currencies/:currencyCode/rates', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const currencyCode = String(req.params.currencyCode || '').trim().toUpperCase();
  const { rate, rateType, recordDate, operator } = req.body || {};
  const rateNum = Number(rate);
  const normalizedRateType = String(rateType || 'MANUAL').toUpperCase();
  const normalizedRecordDate = String(recordDate || now.slice(0, 10));

  if (!currencyCode || Number.isNaN(rateNum) || rateNum <= 0) {
    error(res, 'Invalid currencyCode or rate');
    return;
  }
  if (!['MANUAL', 'LIVE'].includes(normalizedRateType)) {
    error(res, 'Invalid rateType, expected MANUAL/LIVE');
    return;
  }

  const row = db.prepare('SELECT * FROM exchange_currencies WHERE currencyCode = ?').get(currencyCode) as any;
  if (!row) {
    error(res, 'Currency not found', 404);
    return;
  }

  if (normalizedRateType === 'MANUAL') {
    db.prepare(`
      UPDATE exchange_currencies
      SET manualRate = ?, rateDate = ?, updatedAt = ?
      WHERE currencyCode = ?
    `).run(rateNum, normalizedRecordDate, now, currencyCode);
  } else {
    db.prepare(`
      UPDATE exchange_currencies
      SET liveRate = ?, updatedAt = ?
      WHERE currencyCode = ?
    `).run(rateNum, now, currencyCode);
  }

  db.prepare(`
    INSERT INTO exchange_rate_history
    (id, currencyCode, rate, rateType, recordDate, operator, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId('ERH'), currencyCode, rateNum, normalizedRateType, normalizedRecordDate, operator || 'SYSTEM', now);

  const updated = db.prepare('SELECT * FROM exchange_currencies WHERE currencyCode = ?').get(currencyCode);
  success(res, updated, 'Rate saved');
});

// POST /api/system/exchange-rates/refresh-live
router.post('/exchange-rates/refresh-live', (_req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const rows = db.prepare(`SELECT * FROM exchange_currencies WHERE status = 'ACTIVE'`).all() as any[];

  const tx = db.transaction(() => {
    for (const row of rows) {
      const base = Number(row.manualRate || row.liveRate || 0);
      if (!base || base <= 0) continue;
      const next = Number((base * (1 + (Math.random() - 0.5) * 0.02)).toFixed(4));
      db.prepare('UPDATE exchange_currencies SET liveRate = ?, updatedAt = ? WHERE id = ?').run(next, now, row.id);
      db.prepare(`
        INSERT INTO exchange_rate_history
        (id, currencyCode, rate, rateType, recordDate, operator, createdAt)
        VALUES (?, ?, ?, 'LIVE', ?, 'SYSTEM', ?)
      `).run(generateId('ERH'), row.currencyCode, next, now.slice(0, 10), now);
    }
  });
  tx();

  const latest = db.prepare('SELECT * FROM exchange_currencies ORDER BY currencyCode ASC').all();
  success(res, latest, 'Live rates refreshed');
});

// ==================== FREIGHT RATE RULES ====================

// GET /api/system/freight-rates
router.get('/freight-rates', (req, res) => {
  const db = getDb();
  const { transportMode, status } = req.query;
  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (transportMode) { where += ' AND transportMode = ?'; params.push(transportMode); }
  if (status) { where += ' AND status = ?'; params.push(status); }

  const rows = db.prepare(`SELECT * FROM freight_rate_rules ${where} ORDER BY datetime(updatedAt) DESC, datetime(createdAt) DESC`).all(...params) as any[];
  success(res, rows.map(normalizeFreightRuleRow));
});

// POST /api/system/freight-rates
router.post('/freight-rates', (req, res) => {
  const db = getDb();
  const id = generateId('FRR');
  const now = new Date().toISOString();
  const payload = req.body || {};

  if (!payload.name || !payload.transportMode || !payload.currency || payload.unitPrice === undefined || payload.unitPrice === null) {
    error(res, 'Missing required fields: name, transportMode, currency, unitPrice');
    return;
  }
  if (!['AIR', 'SEA_LCL'].includes(String(payload.transportMode))) {
    error(res, 'Invalid transportMode, expected AIR/SEA_LCL');
    return;
  }

  db.prepare(`
    INSERT INTO freight_rate_rules
    (id, name, transportMode, volumetricDivisor, firstWeightPrice, continuationTiers, surchargeRates, packagingSurchargePerKg,
     volumeWeightRatio, unitPricePerCBM, currency, unitPrice, unitType, minCharge, remark, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    payload.name,
    payload.transportMode,
    payload.volumetricDivisor ?? null,
    payload.firstWeightPrice ?? null,
    payload.continuationTiers ? JSON.stringify(payload.continuationTiers) : null,
    payload.surchargeRates ? JSON.stringify(payload.surchargeRates) : null,
    payload.packagingSurchargePerKg ?? null,
    payload.volumeWeightRatio ?? null,
    payload.unitPricePerCBM ?? null,
    payload.currency,
    payload.unitPrice,
    payload.unitType || (payload.transportMode === 'AIR' ? '/kg' : '/CBM'),
    payload.minCharge ?? null,
    payload.remark ?? null,
    payload.status || 'ACTIVE',
    now,
    now
  );

  const row = db.prepare('SELECT * FROM freight_rate_rules WHERE id = ?').get(id);
  success(res, normalizeFreightRuleRow(row));
});

// PUT /api/system/freight-rates/:id
router.put('/freight-rates/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM freight_rate_rules WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Freight rule not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;
  if (fields.transportMode && !['AIR', 'SEA_LCL'].includes(String(fields.transportMode))) {
    error(res, 'Invalid transportMode, expected AIR/SEA_LCL');
    return;
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    if (key === 'continuationTiers' || key === 'surchargeRates') {
      sets.push(`${key} = ?`);
      params.push(value ? JSON.stringify(value) : null);
      continue;
    }
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  if (sets.length <= 1) {
    success(res, normalizeFreightRuleRow(existing));
    return;
  }

  db.prepare(`UPDATE freight_rate_rules SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM freight_rate_rules WHERE id = ?').get(req.params.id);
  success(res, normalizeFreightRuleRow(row));
});

// DELETE /api/system/freight-rates/:id
router.delete('/freight-rates/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM freight_rate_rules WHERE id = ?').get(req.params.id);
  if (!existing) {
    error(res, 'Freight rule not found', 404);
    return;
  }
  db.prepare('DELETE FROM freight_rate_rules WHERE id = ?').run(req.params.id);
  success(res, null, 'Freight rule deleted');
});

// ==================== COUNTRY / CITY ====================

// GET /api/system/countries
router.get('/countries', (req, res) => {
  const db = getDb();
  const { q, continent, status } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (continent) {
    where += ' AND continent = ?';
    params.push(continent);
  }
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (q) {
    where += ' AND (countryName LIKE ? OR countryNameEn LIKE ? OR countryCode LIKE ? OR phoneCode LIKE ? OR currencyName LIKE ?)';
    const pattern = `%${String(q).trim()}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  const countries = db.prepare(`
    SELECT * FROM countries
    ${where}
    ORDER BY countryName ASC
  `).all(...params) as any[];

  if (countries.length === 0) {
    success(res, []);
    return;
  }

  const list = countries.map((row) => ({
    ...normalizeCountryRow(row),
    cities: listCitiesWithSites(db, row.id),
  }));

  success(res, list);
});

// POST /api/system/countries
router.post('/countries', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const id = generateId('COUNTRY');
  const payload = req.body || {};

  const code = String(payload.countryCode || '').trim().toUpperCase();
  const continent = String(payload.continent || '').trim().toUpperCase();

  if (!code || !payload.countryName || !payload.countryNameEn || !continent) {
    error(res, 'Missing required fields: countryCode, countryName, countryNameEn, continent');
    return;
  }
  if (!CONTINENT_VALUES.has(continent)) {
    error(res, 'Invalid continent');
    return;
  }

  const duplicate = db.prepare('SELECT id FROM countries WHERE countryCode = ?').get(code);
  if (duplicate) {
    error(res, 'countryCode already exists');
    return;
  }

  db.prepare(`
    INSERT INTO countries
    (id, countryCode, countryName, countryNameEn, continent, phoneCode, currencyCode, currencyName, currencySymbol,
     timezone, flagImage, countryImage, isOrigin, isDestination, requiresMaterial, status, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    code,
    payload.countryName,
    payload.countryNameEn,
    continent,
    payload.phoneCode || null,
    payload.currencyCode || null,
    payload.currencyName || null,
    payload.currencySymbol || null,
    payload.timezone || null,
    payload.flagImage || null,
    payload.countryImage || null,
    toBooleanInt(payload.isOrigin),
    toBooleanInt(payload.isDestination),
    toBooleanInt(payload.requiresMaterial),
    payload.status || 'ACTIVE',
    payload.remark || null,
    now,
    now
  );

  const row = db.prepare('SELECT * FROM countries WHERE id = ?').get(id);
  success(res, { ...normalizeCountryRow(row), cities: [] });
});

// PUT /api/system/countries/:id
router.put('/countries/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM countries WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Country not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;

  if (fields.countryCode !== undefined) {
    fields.countryCode = String(fields.countryCode).trim().toUpperCase();
    if (!fields.countryCode) {
      error(res, 'countryCode cannot be empty');
      return;
    }
    const duplicate = db.prepare('SELECT id FROM countries WHERE countryCode = ? AND id != ?')
      .get(fields.countryCode, req.params.id);
    if (duplicate) {
      error(res, 'countryCode already exists');
      return;
    }
  }
  if (fields.continent !== undefined) {
    fields.continent = String(fields.continent).trim().toUpperCase();
    if (!CONTINENT_VALUES.has(fields.continent)) {
      error(res, 'Invalid continent');
      return;
    }
  }
  if (fields.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(String(fields.status))) {
    error(res, 'Invalid status');
    return;
  }
  if (fields.isOrigin !== undefined) fields.isOrigin = toBooleanInt(fields.isOrigin);
  if (fields.isDestination !== undefined) fields.isDestination = toBooleanInt(fields.isDestination);
  if (fields.requiresMaterial !== undefined) fields.requiresMaterial = toBooleanInt(fields.requiresMaterial);

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  if (sets.length <= 1) {
    success(res, { ...normalizeCountryRow(existing), cities: listCitiesWithSites(db, req.params.id) });
    return;
  }

  db.prepare(`UPDATE countries SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM countries WHERE id = ?').get(req.params.id) as any;
  success(res, { ...normalizeCountryRow(row), cities: listCitiesWithSites(db, req.params.id) });
});

// DELETE /api/system/countries/:id
router.delete('/countries/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM countries WHERE id = ?').get(req.params.id);
  if (!existing) {
    error(res, 'Country not found', 404);
    return;
  }
  db.prepare('DELETE FROM countries WHERE id = ?').run(req.params.id);
  success(res, null, 'Country deleted');
});

// POST /api/system/countries/:countryId/cities
router.post('/countries/:countryId/cities', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const id = generateId('CITY');
  const countryId = req.params.countryId;
  const payload = req.body || {};

  const country = db.prepare('SELECT id FROM countries WHERE id = ?').get(countryId);
  if (!country) {
    error(res, 'Country not found', 404);
    return;
  }

  const cityCode = String(payload.cityCode || '').trim().toUpperCase();
  if (!cityCode || !payload.cityName || !payload.cityNameEn) {
    error(res, 'Missing required fields: cityCode, cityName, cityNameEn');
    return;
  }

  const duplicate = db.prepare('SELECT id FROM cities WHERE countryId = ? AND cityCode = ?').get(countryId, cityCode);
  if (duplicate) {
    error(res, 'cityCode already exists in this country');
    return;
  }

  db.prepare(`
    INSERT INTO cities
    (id, countryId, cityCode, cityName, cityNameEn, provinceState, isPort, isAirport, timezone, latitude, longitude, status, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    countryId,
    cityCode,
    payload.cityName,
    payload.cityNameEn,
    payload.provinceState || null,
    toBooleanInt(payload.isPort),
    toBooleanInt(payload.isAirport),
    payload.timezone || null,
    payload.latitude ?? null,
    payload.longitude ?? null,
    payload.status || 'ACTIVE',
    payload.remark || null,
    now,
    now
  );

  const row = db.prepare('SELECT * FROM cities WHERE id = ?').get(id);
  success(res, normalizeCityRow(row));
});

// PUT /api/system/countries/:countryId/cities/:cityId
router.put('/countries/:countryId/cities/:cityId', (req, res) => {
  const db = getDb();
  const { countryId, cityId } = req.params;
  const existing = db.prepare('SELECT * FROM cities WHERE id = ? AND countryId = ?').get(cityId, countryId) as any;
  if (!existing) {
    error(res, 'City not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;
  if (fields.cityCode !== undefined) {
    fields.cityCode = String(fields.cityCode).trim().toUpperCase();
    if (!fields.cityCode) {
      error(res, 'cityCode cannot be empty');
      return;
    }
    const duplicate = db.prepare('SELECT id FROM cities WHERE countryId = ? AND cityCode = ? AND id != ?')
      .get(countryId, fields.cityCode, cityId);
    if (duplicate) {
      error(res, 'cityCode already exists in this country');
      return;
    }
  }
  if (fields.isPort !== undefined) fields.isPort = toBooleanInt(fields.isPort);
  if (fields.isAirport !== undefined) fields.isAirport = toBooleanInt(fields.isAirport);
  if (fields.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(String(fields.status))) {
    error(res, 'Invalid status');
    return;
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'countryId' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(cityId);
  params.push(countryId);

  if (sets.length <= 1) {
    success(res, normalizeCityRow(existing));
    return;
  }

  db.prepare(`UPDATE cities SET ${sets.join(', ')} WHERE id = ? AND countryId = ?`).run(...params);
  const row = db.prepare('SELECT * FROM cities WHERE id = ? AND countryId = ?').get(cityId, countryId);
  success(res, normalizeCityRow(row));
});

// DELETE /api/system/countries/:countryId/cities/:cityId
router.delete('/countries/:countryId/cities/:cityId', (req, res) => {
  const db = getDb();
  const { countryId, cityId } = req.params;
  const existing = db.prepare('SELECT id FROM cities WHERE id = ? AND countryId = ?').get(cityId, countryId);
  if (!existing) {
    error(res, 'City not found', 404);
    return;
  }
  db.prepare('DELETE FROM cities WHERE id = ? AND countryId = ?').run(cityId, countryId);
  success(res, null, 'City deleted');
});

// ==================== SITE (站点组织) ====================

// GET /api/system/sites
router.get('/sites', (req, res) => {
  const db = getDb();
  const { countryId, cityId, status, siteType, q } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (countryId) { where += ' AND s.countryId = ?'; params.push(countryId); }
  if (cityId) { where += ' AND s.cityId = ?'; params.push(cityId); }
  if (status) { where += ' AND s.status = ?'; params.push(status); }
  if (siteType) { where += ' AND s.siteType = ?'; params.push(siteType); }
  if (q) {
    const pattern = `%${String(q).trim()}%`;
    where += ' AND (s.siteName LIKE ? OR s.siteNameEn LIKE ? OR s.siteCode LIKE ? OR s.district LIKE ?)';
    params.push(pattern, pattern, pattern, pattern);
  }

  const rows = db.prepare(`
    SELECT s.*, c.countryName, c.countryCode, ci.cityName, ci.cityCode
    FROM sites s
    INNER JOIN countries c ON c.id = s.countryId
    INNER JOIN cities ci ON ci.id = s.cityId
    ${where}
    ORDER BY c.countryName ASC, ci.cityName ASC, s.siteName ASC
  `).all(...params);

  success(res, (rows as any[]).map(normalizeSiteRow));
});

// POST /api/system/sites
router.post('/sites', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const id = generateId('SITE');
  const payload = req.body || {};

  const countryId = String(payload.countryId || '').trim();
  const cityId = String(payload.cityId || '').trim();
  const siteCode = String(payload.siteCode || '').trim().toUpperCase();
  const siteName = String(payload.siteName || '').trim();
  const siteType = String(payload.siteType || 'DISPATCH_CENTER').trim().toUpperCase();

  if (!countryId || !cityId || !siteCode || !siteName) {
    error(res, 'Missing required fields: countryId, cityId, siteCode, siteName');
    return;
  }
  if (!SITE_TYPE_VALUES.has(siteType)) {
    error(res, 'Invalid siteType');
    return;
  }

  const city = db.prepare('SELECT id, countryId FROM cities WHERE id = ?').get(cityId) as any;
  if (!city || city.countryId !== countryId) {
    error(res, 'City does not belong to country', 400);
    return;
  }

  const duplicate = db.prepare('SELECT id FROM sites WHERE cityId = ? AND siteCode = ?').get(cityId, siteCode);
  if (duplicate) {
    error(res, 'siteCode already exists in this city');
    return;
  }

  db.prepare(`
    INSERT INTO sites
    (id, countryId, cityId, siteCode, siteName, siteNameEn, district, siteType, address, contactName, contactPhone, businessHours, status, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    countryId,
    cityId,
    siteCode,
    siteName,
    payload.siteNameEn || null,
    payload.district || null,
    siteType,
    payload.address || null,
    payload.contactName || null,
    payload.contactPhone || null,
    payload.businessHours || null,
    payload.status || 'ACTIVE',
    payload.remark || null,
    now,
    now
  );

  const row = db.prepare(`
    SELECT s.*, c.countryName, c.countryCode, ci.cityName, ci.cityCode
    FROM sites s
    INNER JOIN countries c ON c.id = s.countryId
    INNER JOIN cities ci ON ci.id = s.cityId
    WHERE s.id = ?
  `).get(id);
  success(res, normalizeSiteRow(row));
});

// PUT /api/system/sites/:id
router.put('/sites/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Site not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;

  if (fields.siteCode !== undefined) {
    fields.siteCode = String(fields.siteCode).trim().toUpperCase();
    if (!fields.siteCode) {
      error(res, 'siteCode cannot be empty');
      return;
    }
  }
  if (fields.siteType !== undefined) {
    fields.siteType = String(fields.siteType).trim().toUpperCase();
    if (!SITE_TYPE_VALUES.has(fields.siteType)) {
      error(res, 'Invalid siteType');
      return;
    }
  }
  if (fields.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(String(fields.status))) {
    error(res, 'Invalid status');
    return;
  }

  const nextCountryId = String(fields.countryId || existing.countryId);
  const nextCityId = String(fields.cityId || existing.cityId);
  const city = db.prepare('SELECT id, countryId FROM cities WHERE id = ?').get(nextCityId) as any;
  if (!city || city.countryId !== nextCountryId) {
    error(res, 'City does not belong to country', 400);
    return;
  }

  const nextSiteCode = String(fields.siteCode || existing.siteCode);
  const duplicate = db.prepare('SELECT id FROM sites WHERE cityId = ? AND siteCode = ? AND id != ?')
    .get(nextCityId, nextSiteCode, req.params.id);
  if (duplicate) {
    error(res, 'siteCode already exists in this city');
    return;
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  if (sets.length > 1) {
    db.prepare(`UPDATE sites SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  const row = db.prepare(`
    SELECT s.*, c.countryName, c.countryCode, ci.cityName, ci.cityCode
    FROM sites s
    INNER JOIN countries c ON c.id = s.countryId
    INNER JOIN cities ci ON ci.id = s.cityId
    WHERE s.id = ?
  `).get(req.params.id);
  success(res, normalizeSiteRow(row));
});

// DELETE /api/system/sites/:id
router.delete('/sites/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM sites WHERE id = ?').get(req.params.id);
  if (!existing) {
    error(res, 'Site not found', 404);
    return;
  }

  const warehouseCount = (db.prepare('SELECT COUNT(*) as c FROM warehouses WHERE siteId = ?').get(req.params.id) as any)?.c || 0;
  if (warehouseCount > 0) {
    error(res, '该站点仍关联仓库，无法删除');
    return;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_sites WHERE siteId = ?').run(req.params.id);
    db.prepare('DELETE FROM site_bindings WHERE siteId = ? OR boundSiteId = ?').run(req.params.id, req.params.id);
    db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  });
  tx();

  success(res, null, 'Site deleted');
});

// GET /api/system/user-sites/:userId
router.get('/user-sites/:userId', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT s.*, c.countryName, ci.cityName
    FROM sites s
    INNER JOIN user_sites us ON us.siteId = s.id
    INNER JOIN countries c ON c.id = s.countryId
    INNER JOIN cities ci ON ci.id = s.cityId
    WHERE us.userId = ?
    ORDER BY c.countryName ASC, ci.cityName ASC, s.siteName ASC
  `).all(req.params.userId);
  success(res, (rows as any[]).map(normalizeSiteRow));
});

// PUT /api/system/user-sites/:userId
router.put('/user-sites/:userId', (req, res) => {
  const db = getDb();
  const siteIds: string[] = Array.isArray(req.body?.siteIds) ? req.body.siteIds : [];
  const now = new Date().toISOString();

  if (siteIds.length > 0) {
    const placeholders = siteIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id FROM sites WHERE id IN (${placeholders})`).all(...siteIds) as any[];
    if (rows.length !== siteIds.length) {
      error(res, 'Some siteIds are invalid');
      return;
    }
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_sites WHERE userId = ?').run(req.params.userId);
    db.prepare('DELETE FROM user_warehouses WHERE userId = ?').run(req.params.userId);

    const insertSite = db.prepare('INSERT INTO user_sites (id, userId, siteId, createdAt) VALUES (?, ?, ?, ?)');
    const insertWarehouse = db.prepare('INSERT INTO user_warehouses (id, userId, warehouseId, createdAt) VALUES (?, ?, ?, ?)');
    const insertedWh = new Set<string>();

    for (const siteId of siteIds) {
      insertSite.run(generateId('US'), req.params.userId, siteId, now);

      const warehouseRows = db.prepare('SELECT id FROM warehouses WHERE siteId = ?').all(siteId) as any[];
      for (const row of warehouseRows) {
        if (insertedWh.has(row.id)) continue;
        insertedWh.add(row.id);
        insertWarehouse.run(generateId('UW'), req.params.userId, row.id, now);
      }
    }
  });
  tx();

  const rows = db.prepare(`
    SELECT s.*, c.countryName, ci.cityName
    FROM sites s
    INNER JOIN user_sites us ON us.siteId = s.id
    INNER JOIN countries c ON c.id = s.countryId
    INNER JOIN cities ci ON ci.id = s.cityId
    WHERE us.userId = ?
    ORDER BY c.countryName ASC, ci.cityName ASC, s.siteName ASC
  `).all(req.params.userId);
  success(res, (rows as any[]).map(normalizeSiteRow));
});

// ==================== DEPARTMENTS ====================

// GET /api/system/departments
router.get('/departments', (req, res) => {
  const db = getDb();
  const { status, q } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) {
    where += ' AND d.status = ?';
    params.push(String(status).trim().toUpperCase());
  }
  if (q) {
    where += ' AND (d.deptCode LIKE ? OR d.deptName LIKE ?)';
    const pattern = `%${String(q).trim()}%`;
    params.push(pattern, pattern);
  }

  const rows = db.prepare(`
    SELECT
      d.*,
      u.realName AS managerName,
      (SELECT COUNT(*) FROM users x WHERE x.departmentId = d.id) AS userCount
    FROM departments d
    LEFT JOIN users u ON u.id = d.managerUserId
    ${where}
    ORDER BY d.sortOrder ASC, d.deptCode ASC
  `).all(...params) as any[];

  success(res, rows.map(normalizeDepartmentRow));
});

// POST /api/system/departments
router.post('/departments', (req, res) => {
  const db = getDb();
  const payload = req.body || {};
  const now = new Date().toISOString();
  const id = generateId('DEPT');

  const deptCode = String(payload.deptCode || '').trim().toUpperCase();
  const deptName = String(payload.deptName || '').trim();
  const status = String(payload.status || 'ACTIVE').trim().toUpperCase();

  if (!deptCode || !deptName) {
    error(res, 'Missing required fields: deptCode, deptName');
    return;
  }
  if (!RBAC_STATUS_VALUES.has(status)) {
    error(res, 'Invalid department status');
    return;
  }

  const duplicateCode = db.prepare('SELECT id FROM departments WHERE deptCode = ?').get(deptCode);
  if (duplicateCode) {
    error(res, 'deptCode already exists');
    return;
  }
  const duplicateName = db.prepare('SELECT id FROM departments WHERE deptName = ?').get(deptName);
  if (duplicateName) {
    error(res, 'deptName already exists');
    return;
  }
  if (payload.parentId) {
    const parent = db.prepare('SELECT id FROM departments WHERE id = ?').get(payload.parentId);
    if (!parent) {
      error(res, 'parentId is invalid');
      return;
    }
  }
  if (payload.managerUserId) {
    const manager = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.managerUserId);
    if (!manager) {
      error(res, 'managerUserId is invalid');
      return;
    }
  }

  db.prepare(`
    INSERT INTO departments
    (id, deptCode, deptName, parentId, managerUserId, sortOrder, status, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    deptCode,
    deptName,
    payload.parentId || null,
    payload.managerUserId || null,
    Number(payload.sortOrder || 0),
    status,
    payload.remark || null,
    now,
    now
  );

  const row = db.prepare(`
    SELECT
      d.*,
      u.realName AS managerName,
      (SELECT COUNT(*) FROM users x WHERE x.departmentId = d.id) AS userCount
    FROM departments d
    LEFT JOIN users u ON u.id = d.managerUserId
    WHERE d.id = ?
  `).get(id);
  success(res, normalizeDepartmentRow(row));
});

// PUT /api/system/departments/:id
router.put('/departments/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Department not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;
  if (fields.deptCode !== undefined) {
    fields.deptCode = String(fields.deptCode).trim().toUpperCase();
    if (!fields.deptCode) {
      error(res, 'deptCode cannot be empty');
      return;
    }
    const duplicate = db.prepare('SELECT id FROM departments WHERE deptCode = ? AND id != ?')
      .get(fields.deptCode, req.params.id);
    if (duplicate) {
      error(res, 'deptCode already exists');
      return;
    }
  }
  if (fields.deptName !== undefined) {
    fields.deptName = String(fields.deptName).trim();
    if (!fields.deptName) {
      error(res, 'deptName cannot be empty');
      return;
    }
    const duplicate = db.prepare('SELECT id FROM departments WHERE deptName = ? AND id != ?')
      .get(fields.deptName, req.params.id);
    if (duplicate) {
      error(res, 'deptName already exists');
      return;
    }
  }
  if (fields.status !== undefined) {
    fields.status = String(fields.status).trim().toUpperCase();
    if (!RBAC_STATUS_VALUES.has(fields.status)) {
      error(res, 'Invalid department status');
      return;
    }
  }
  if (fields.parentId !== undefined && fields.parentId) {
    if (String(fields.parentId) === req.params.id) {
      error(res, 'parentId cannot be self');
      return;
    }
    const parent = db.prepare('SELECT id FROM departments WHERE id = ?').get(fields.parentId);
    if (!parent) {
      error(res, 'parentId is invalid');
      return;
    }
  }
  if (fields.managerUserId !== undefined && fields.managerUserId) {
    const manager = db.prepare('SELECT id FROM users WHERE id = ?').get(fields.managerUserId);
    if (!manager) {
      error(res, 'managerUserId is invalid');
      return;
    }
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }

  if (fields.deptName !== undefined) {
    // Keep legacy users.department display name synchronized.
    db.prepare('UPDATE users SET department = ? WHERE departmentId = ?').run(fields.deptName, req.params.id);
  }

  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);
  db.prepare(`UPDATE departments SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const row = db.prepare(`
    SELECT
      d.*,
      u.realName AS managerName,
      (SELECT COUNT(*) FROM users x WHERE x.departmentId = d.id) AS userCount
    FROM departments d
    LEFT JOIN users u ON u.id = d.managerUserId
    WHERE d.id = ?
  `).get(req.params.id);
  success(res, normalizeDepartmentRow(row));
});

// DELETE /api/system/departments/:id
router.delete('/departments/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Department not found', 404);
    return;
  }

  const childCount = (db.prepare('SELECT COUNT(*) as c FROM departments WHERE parentId = ?').get(req.params.id) as any)?.c || 0;
  if (Number(childCount) > 0) {
    error(res, '该部门存在子部门，无法删除');
    return;
  }

  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users WHERE departmentId = ?').get(req.params.id) as any)?.c || 0;
  if (Number(userCount) > 0) {
    error(res, '该部门仍有关联用户，无法删除');
    return;
  }

  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  success(res, null, 'Department deleted');
});

// ==================== RBAC ====================

// GET /api/system/rbac/roles
router.get('/rbac/roles', (req, res) => {
  const db = getDb();
  const { status, q } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) {
    where += ' AND r.status = ?';
    params.push(String(status).trim().toUpperCase());
  }
  if (q) {
    where += ' AND (r.roleCode LIKE ? OR r.roleName LIKE ?)';
    const pattern = `%${String(q).trim()}%`;
    params.push(pattern, pattern);
  }

  const rows = db.prepare(`
    SELECT
      r.*,
      (SELECT COUNT(*) FROM sys_user_roles ur WHERE ur.roleId = r.id) AS userCount,
      (SELECT COUNT(*) FROM sys_role_permissions rp WHERE rp.roleId = r.id) AS permissionCount
    FROM sys_roles r
    ${where}
    ORDER BY r.isSystem DESC, r.roleCode ASC
  `).all(...params) as any[];

  success(res, rows.map(normalizeRbacRoleRow));
});

// POST /api/system/rbac/roles
router.post('/rbac/roles', (req, res) => {
  const db = getDb();
  const payload = req.body || {};
  const now = new Date().toISOString();

  const roleCode = String(payload.roleCode || '').trim().toUpperCase();
  const roleName = String(payload.roleName || '').trim();
  const siteScope = String(payload.siteScope || 'ASSIGNED_SITE').trim().toUpperCase();
  const status = String(payload.status || 'ACTIVE').trim().toUpperCase();
  const isSystem = Number(payload.isSystem) === 1 ? 1 : 0;

  if (!roleCode || !roleName) {
    error(res, 'Missing required fields: roleCode, roleName');
    return;
  }
  if (!RBAC_ROLE_SCOPE_VALUES.has(siteScope)) {
    error(res, 'Invalid siteScope');
    return;
  }
  if (!RBAC_STATUS_VALUES.has(status)) {
    error(res, 'Invalid role status');
    return;
  }

  const duplicate = db.prepare('SELECT id FROM sys_roles WHERE roleCode = ?').get(roleCode);
  if (duplicate) {
    error(res, 'roleCode already exists');
    return;
  }

  const id = generateId('ROLE');
  db.prepare(`
    INSERT INTO sys_roles (id, roleCode, roleName, description, siteScope, status, isSystem, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    roleCode,
    roleName,
    payload.description || null,
    siteScope,
    status,
    isSystem,
    now,
    now
  );

  const row = db.prepare(`
    SELECT
      r.*,
      (SELECT COUNT(*) FROM sys_user_roles ur WHERE ur.roleId = r.id) AS userCount,
      (SELECT COUNT(*) FROM sys_role_permissions rp WHERE rp.roleId = r.id) AS permissionCount
    FROM sys_roles r
    WHERE r.id = ?
  `).get(id);
  success(res, normalizeRbacRoleRow(row));
});

// PUT /api/system/rbac/roles/:id
router.put('/rbac/roles/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sys_roles WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Role not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;
  if (fields.roleCode !== undefined) {
    fields.roleCode = String(fields.roleCode).trim().toUpperCase();
    if (!fields.roleCode) {
      error(res, 'roleCode cannot be empty');
      return;
    }
    const duplicate = db.prepare('SELECT id FROM sys_roles WHERE roleCode = ? AND id != ?').get(fields.roleCode, req.params.id);
    if (duplicate) {
      error(res, 'roleCode already exists');
      return;
    }
  }
  if (fields.siteScope !== undefined) {
    fields.siteScope = String(fields.siteScope).trim().toUpperCase();
    if (!RBAC_ROLE_SCOPE_VALUES.has(fields.siteScope)) {
      error(res, 'Invalid siteScope');
      return;
    }
  }
  if (fields.status !== undefined) {
    fields.status = String(fields.status).trim().toUpperCase();
    if (!RBAC_STATUS_VALUES.has(fields.status)) {
      error(res, 'Invalid role status');
      return;
    }
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);
  db.prepare(`UPDATE sys_roles SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const row = db.prepare(`
    SELECT
      r.*,
      (SELECT COUNT(*) FROM sys_user_roles ur WHERE ur.roleId = r.id) AS userCount,
      (SELECT COUNT(*) FROM sys_role_permissions rp WHERE rp.roleId = r.id) AS permissionCount
    FROM sys_roles r
    WHERE r.id = ?
  `).get(req.params.id);
  success(res, normalizeRbacRoleRow(row));
});

// DELETE /api/system/rbac/roles/:id
router.delete('/rbac/roles/:id', (req, res) => {
  const db = getDb();
  const role = db.prepare('SELECT * FROM sys_roles WHERE id = ?').get(req.params.id) as any;
  if (!role) {
    error(res, 'Role not found', 404);
    return;
  }
  if (Number(role.isSystem || 0) === 1) {
    error(res, 'System role cannot be deleted');
    return;
  }

  const userCount = (db.prepare('SELECT COUNT(*) as c FROM sys_user_roles WHERE roleId = ?').get(req.params.id) as any)?.c || 0;
  if (Number(userCount) > 0) {
    error(res, '该角色仍有关联用户，无法删除');
    return;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM sys_role_permissions WHERE roleId = ?').run(req.params.id);
    db.prepare('DELETE FROM sys_roles WHERE id = ?').run(req.params.id);
  });
  tx();
  success(res, null, 'Role deleted');
});

// GET /api/system/rbac/permissions
router.get('/rbac/permissions', (req, res) => {
  const db = getDb();
  const { status, moduleKey, q } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) {
    where += ' AND p.status = ?';
    params.push(String(status).trim().toUpperCase());
  }
  if (moduleKey) {
    where += ' AND p.moduleKey = ?';
    params.push(String(moduleKey).trim());
  }
  if (q) {
    where += ' AND (p.permissionCode LIKE ? OR p.permissionName LIKE ? OR p.description LIKE ?)';
    const pattern = `%${String(q).trim()}%`;
    params.push(pattern, pattern, pattern);
  }

  const rows = db.prepare(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM sys_role_permissions rp WHERE rp.permissionId = p.id) AS roleCount
    FROM sys_permissions p
    ${where}
    ORDER BY p.moduleKey ASC, p.permissionCode ASC
  `).all(...params) as any[];

  success(res, rows.map(normalizeRbacPermissionRow));
});

// POST /api/system/rbac/permissions
router.post('/rbac/permissions', (req, res) => {
  const db = getDb();
  const payload = req.body || {};
  const now = new Date().toISOString();

  const permissionCode = String(payload.permissionCode || '').trim();
  const permissionName = String(payload.permissionName || '').trim();
  const permissionType = String(payload.permissionType || 'MENU').trim().toUpperCase();
  const status = String(payload.status || 'ACTIVE').trim().toUpperCase();

  if (!permissionCode || !permissionName) {
    error(res, 'Missing required fields: permissionCode, permissionName');
    return;
  }
  if (!RBAC_PERMISSION_TYPE_VALUES.has(permissionType)) {
    error(res, 'Invalid permissionType');
    return;
  }
  if (!RBAC_STATUS_VALUES.has(status)) {
    error(res, 'Invalid permission status');
    return;
  }

  const duplicate = db.prepare('SELECT id FROM sys_permissions WHERE permissionCode = ?').get(permissionCode);
  if (duplicate) {
    error(res, 'permissionCode already exists');
    return;
  }

  const id = generateId('PERM');
  db.prepare(`
    INSERT INTO sys_permissions
    (id, permissionCode, permissionName, moduleKey, permissionType, path, description, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    permissionCode,
    permissionName,
    payload.moduleKey || null,
    permissionType,
    payload.path || null,
    payload.description || null,
    status,
    now,
    now
  );

  const row = db.prepare(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM sys_role_permissions rp WHERE rp.permissionId = p.id) AS roleCount
    FROM sys_permissions p
    WHERE p.id = ?
  `).get(id);
  success(res, normalizeRbacPermissionRow(row));
});

// PUT /api/system/rbac/permissions/:id
router.put('/rbac/permissions/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sys_permissions WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Permission not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;
  if (fields.permissionCode !== undefined) {
    fields.permissionCode = String(fields.permissionCode).trim();
    if (!fields.permissionCode) {
      error(res, 'permissionCode cannot be empty');
      return;
    }
    const duplicate = db.prepare('SELECT id FROM sys_permissions WHERE permissionCode = ? AND id != ?')
      .get(fields.permissionCode, req.params.id);
    if (duplicate) {
      error(res, 'permissionCode already exists');
      return;
    }
  }
  if (fields.permissionType !== undefined) {
    fields.permissionType = String(fields.permissionType).trim().toUpperCase();
    if (!RBAC_PERMISSION_TYPE_VALUES.has(fields.permissionType)) {
      error(res, 'Invalid permissionType');
      return;
    }
  }
  if (fields.status !== undefined) {
    fields.status = String(fields.status).trim().toUpperCase();
    if (!RBAC_STATUS_VALUES.has(fields.status)) {
      error(res, 'Invalid permission status');
      return;
    }
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);
  db.prepare(`UPDATE sys_permissions SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const row = db.prepare(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM sys_role_permissions rp WHERE rp.permissionId = p.id) AS roleCount
    FROM sys_permissions p
    WHERE p.id = ?
  `).get(req.params.id);
  success(res, normalizeRbacPermissionRow(row));
});

// DELETE /api/system/rbac/permissions/:id
router.delete('/rbac/permissions/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sys_permissions WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Permission not found', 404);
    return;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM sys_role_permissions WHERE permissionId = ?').run(req.params.id);
    db.prepare('DELETE FROM sys_permissions WHERE id = ?').run(req.params.id);
  });
  tx();
  success(res, null, 'Permission deleted');
});

// GET /api/system/rbac/roles/:roleId/permissions
router.get('/rbac/roles/:roleId/permissions', (req, res) => {
  const db = getDb();
  const role = db.prepare('SELECT * FROM sys_roles WHERE id = ?').get(req.params.roleId) as any;
  if (!role) {
    error(res, 'Role not found', 404);
    return;
  }

  const assignedRows = db.prepare(`
    SELECT p.id, p.permissionCode
    FROM sys_permissions p
    INNER JOIN sys_role_permissions rp ON rp.permissionId = p.id
    WHERE rp.roleId = ?
    ORDER BY p.permissionCode ASC
  `).all(req.params.roleId) as any[];
  const assignedPermissionIds = assignedRows.map((row) => row.id);
  const assignedPermissionCodes = assignedRows.map((row) => row.permissionCode);

  const allPermissions = db.prepare(`
    SELECT p.*
    FROM sys_permissions p
    ORDER BY p.moduleKey ASC, p.permissionCode ASC
  `).all() as any[];

  success(res, {
    role: normalizeRbacRoleRow(role),
    assignedPermissionIds,
    assignedPermissionCodes,
    permissions: allPermissions.map((permission) => ({
      ...normalizeRbacPermissionRow(permission),
      checked: assignedPermissionIds.includes(permission.id),
    })),
  });
});

// PUT /api/system/rbac/roles/:roleId/permissions
router.put('/rbac/roles/:roleId/permissions', (req, res) => {
  const db = getDb();
  const role = db.prepare('SELECT id FROM sys_roles WHERE id = ?').get(req.params.roleId);
  if (!role) {
    error(res, 'Role not found', 404);
    return;
  }

  let permissionIds: string[] = [];
  try {
    permissionIds = resolvePermissionIds(db, req.body || {});
  } catch (err: any) {
    error(res, err?.message || 'Invalid permissions payload');
    return;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM sys_role_permissions WHERE roleId = ?').run(req.params.roleId);
    const insert = db.prepare(`
      INSERT OR IGNORE INTO sys_role_permissions (id, roleId, permissionId, createdAt)
      VALUES (?, ?, ?, ?)
    `);
    for (const permissionId of permissionIds) {
      insert.run(generateId('RP'), req.params.roleId, permissionId, now);
    }
  });
  tx();

  const assignedRows = db.prepare(`
    SELECT p.id, p.permissionCode
    FROM sys_permissions p
    INNER JOIN sys_role_permissions rp ON rp.permissionId = p.id
    WHERE rp.roleId = ?
    ORDER BY p.permissionCode ASC
  `).all(req.params.roleId) as any[];
  success(res, {
    roleId: req.params.roleId,
    assignedPermissionIds: assignedRows.map((row) => row.id),
    assignedPermissionCodes: assignedRows.map((row) => row.permissionCode),
  });
});

// GET /api/system/rbac/users/:userId/roles
router.get('/rbac/users/:userId/roles', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.userId) as any;
  if (!user) {
    error(res, 'User not found', 404);
    return;
  }

  const rows = db.prepare(`
    SELECT r.*
    FROM sys_roles r
    INNER JOIN sys_user_roles ur ON ur.roleId = r.id
    WHERE ur.userId = ?
    ORDER BY r.roleCode ASC
  `).all(req.params.userId) as any[];

  const roleRows = rows.map(normalizeRbacRoleRow);
  const roleCodes = roleRows.map((row) => row.roleCode);
  success(res, {
    userId: req.params.userId,
    role: roleCodes[0] || user.role,
    roleIds: roleRows.map((row) => row.id),
    roleCodes,
    roles: roleRows,
  });
});

// PUT /api/system/rbac/users/:userId/roles
router.put('/rbac/users/:userId/roles', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.userId) as any;
  if (!user) {
    error(res, 'User not found', 404);
    return;
  }

  let roleIds: string[] = [];
  try {
    roleIds = resolveRoleIds(db, req.body || {});
  } catch (err: any) {
    error(res, err?.message || 'Invalid roles payload');
    return;
  }
  if (roleIds.length === 0) {
    error(res, 'At least one role is required');
    return;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM sys_user_roles WHERE userId = ?').run(req.params.userId);
    const insert = db.prepare(`
      INSERT OR IGNORE INTO sys_user_roles (id, userId, roleId, createdAt)
      VALUES (?, ?, ?, ?)
    `);
    for (const roleId of roleIds) {
      insert.run(generateId('UR'), req.params.userId, roleId, now);
    }
  });
  tx();

  const roleRows = db.prepare(`
    SELECT r.*
    FROM sys_roles r
    INNER JOIN sys_user_roles ur ON ur.roleId = r.id
    WHERE ur.userId = ?
    ORDER BY r.roleCode ASC
  `).all(req.params.userId) as any[];
  const normalizedRoles = roleRows.map(normalizeRbacRoleRow);
  const roleCodes = normalizedRoles.map((row) => row.roleCode);
  if (roleCodes.length > 0) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(roleCodes[0], req.params.userId);
  }

  success(res, {
    userId: req.params.userId,
    role: roleCodes[0] || user.role,
    roleIds: normalizedRoles.map((row) => row.id),
    roleCodes,
    roles: normalizedRoles,
  });
});

// ==================== WORKFLOW CONFIG ====================

// GET /api/system/workflows
router.get('/workflows', (req, res) => {
  const db = getDb();
  const { status, businessType, q } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (businessType) { where += ' AND businessType = ?'; params.push(businessType); }
  if (q) {
    where += ' AND (name LIKE ? OR code LIKE ? OR description LIKE ?)';
    const pattern = `%${String(q).trim()}%`;
    params.push(pattern, pattern, pattern);
  }

  const rows = db.prepare(`
    SELECT * FROM workflow_configs
    ${where}
    ORDER BY datetime(updatedAt) DESC, datetime(createdAt) DESC
  `).all(...params) as any[];

  success(res, rows.map(normalizeWorkflowRow));
});

// POST /api/system/workflows
router.post('/workflows', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  const id = generateId('WF');
  const payload = req.body || {};
  const code = String(payload.code || '').trim().toUpperCase();
  const status = String(payload.status || 'DRAFT').trim().toUpperCase();
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];

  if (!payload.name || !code || !payload.businessType) {
    error(res, 'Missing required fields: name, code, businessType');
    return;
  }
  if (!WORKFLOW_STATUS_VALUES.has(status)) {
    error(res, 'Invalid workflow status');
    return;
  }
  const duplicate = db.prepare('SELECT id FROM workflow_configs WHERE code = ?').get(code);
  if (duplicate) {
    error(res, 'Workflow code already exists');
    return;
  }

  db.prepare(`
    INSERT INTO workflow_configs
    (id, name, code, businessType, description, status, nodes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    payload.name,
    code,
    payload.businessType,
    payload.description || null,
    status,
    JSON.stringify(nodes),
    now,
    now
  );

  const row = db.prepare('SELECT * FROM workflow_configs WHERE id = ?').get(id);
  success(res, normalizeWorkflowRow(row));
});

// PUT /api/system/workflows/:id
router.put('/workflows/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM workflow_configs WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Workflow not found', 404);
    return;
  }

  const fields = { ...(req.body || {}) } as Record<string, any>;
  if (fields.code !== undefined) {
    fields.code = String(fields.code).trim().toUpperCase();
    if (!fields.code) {
      error(res, 'Workflow code cannot be empty');
      return;
    }
    const duplicate = db.prepare('SELECT id FROM workflow_configs WHERE code = ? AND id != ?')
      .get(fields.code, req.params.id);
    if (duplicate) {
      error(res, 'Workflow code already exists');
      return;
    }
  }
  if (fields.status !== undefined) {
    fields.status = String(fields.status).trim().toUpperCase();
    if (!WORKFLOW_STATUS_VALUES.has(fields.status)) {
      error(res, 'Invalid workflow status');
      return;
    }
  }
  if (fields.nodes !== undefined) {
    fields.nodes = JSON.stringify(Array.isArray(fields.nodes) ? fields.nodes : []);
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  if (sets.length <= 1) {
    success(res, normalizeWorkflowRow(existing));
    return;
  }

  db.prepare(`UPDATE workflow_configs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM workflow_configs WHERE id = ?').get(req.params.id);
  success(res, normalizeWorkflowRow(row));
});

// PUT /api/system/workflows/:id/status
router.put('/workflows/:id/status', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM workflow_configs WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Workflow not found', 404);
    return;
  }

  const status = String(req.body?.status || '').trim().toUpperCase();
  if (!WORKFLOW_STATUS_VALUES.has(status)) {
    error(res, 'Invalid workflow status');
    return;
  }

  db.prepare('UPDATE workflow_configs SET status = ?, updatedAt = ? WHERE id = ?')
    .run(status, new Date().toISOString(), req.params.id);
  const row = db.prepare('SELECT * FROM workflow_configs WHERE id = ?').get(req.params.id);
  success(res, normalizeWorkflowRow(row));
});

// DELETE /api/system/workflows/:id
router.delete('/workflows/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM workflow_configs WHERE id = ?').get(req.params.id);
  if (!existing) {
    error(res, 'Workflow not found', 404);
    return;
  }
  db.prepare('DELETE FROM workflow_configs WHERE id = ?').run(req.params.id);
  success(res, null, 'Workflow deleted');
});

// GET /api/no-order-express
router.get('/no-order-express', (req, res) => {
  const db = getDb();
  const { status } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND status = ?'; params.push(status); }

  const rows = db.prepare(`SELECT * FROM no_order_express ${where} ORDER BY signTime DESC`).all(...params);
  success(res, rows);
});

// ==================== WAREHOUSES ====================

// GET /api/system/warehouses
router.get('/warehouses', (req, res) => {
  const db = getDb();
  const { type, status, country, siteId } = req.query;
  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (type) { where += ' AND w.type = ?'; params.push(type); }
  if (status) { where += ' AND w.status = ?'; params.push(status); }
  if (country) { where += ' AND w.country = ?'; params.push(country); }
  if (siteId) { where += ' AND w.siteId = ?'; params.push(siteId); }
  const rows = db.prepare(`
    SELECT w.*, s.siteName, s.siteType
    FROM warehouses w
    LEFT JOIN sites s ON s.id = w.siteId
    ${where}
    ORDER BY w.type, w.createdAt ASC
  `).all(...params);
  success(res, rows);
});

// GET /api/system/warehouses/user/:userId - 必须放在 /:id 之前
router.get('/warehouses/user/:userId', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT w.*, s.siteName, s.siteType
    FROM warehouses w
    LEFT JOIN sites s ON s.id = w.siteId
    INNER JOIN user_warehouses uw ON w.id = uw.warehouseId
    WHERE uw.userId = ?
    ORDER BY w.type, w.name
  `).all(req.params.userId);
  success(res, rows);
});

// GET /api/system/warehouses/:id
router.get('/warehouses/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT w.*, s.siteName, s.siteType
    FROM warehouses w
    LEFT JOIN sites s ON s.id = w.siteId
    WHERE w.id = ?
  `).get(req.params.id);
  if (!row) { error(res, 'Warehouse not found', 404); return; }
  success(res, row);
});

// POST /api/system/warehouses
router.post('/warehouses', (req, res) => {
  const db = getDb();
  const id = generateId('WH');
  const now = new Date().toISOString();
  const { code, name, nameEn, type, country, city, siteId, address, managerId, managerName, managerPhone, capacity, remark } = req.body;
  if (!code || !name || !type || !country || !city) {
    error(res, 'Missing required fields: code, name, type, country, city');
    return;
  }
  const existing = db.prepare('SELECT id FROM warehouses WHERE code = ?').get(code);
  if (existing) { error(res, '仓库编码已存在'); return; }

  if (siteId) {
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(siteId);
    if (!site) {
      error(res, '站点不存在');
      return;
    }
  }

  db.prepare(`
    INSERT INTO warehouses (id, code, name, nameEn, type, country, city, siteId, address, managerId, managerName, managerPhone, capacity, status, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
  `).run(id, code, name, nameEn || null, type, country, city, siteId || null, address || null,
    managerId || null, managerName || null, managerPhone || null, capacity || null,
    remark || null, now, now);
  const warehouse = db.prepare(`
    SELECT w.*, s.siteName, s.siteType
    FROM warehouses w
    LEFT JOIN sites s ON s.id = w.siteId
    WHERE w.id = ?
  `).get(id);
  success(res, warehouse);
});

// PUT /api/system/warehouses/:id
router.put('/warehouses/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id) as any;
  if (!existing) { error(res, 'Warehouse not found', 404); return; }
  const fields = req.body;

  if (fields?.siteId) {
    const site = db.prepare('SELECT id FROM sites WHERE id = ?').get(fields.siteId);
    if (!site) {
      error(res, '站点不存在');
      return;
    }
  }

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'createdAt') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);
  db.prepare(`UPDATE warehouses SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const warehouse = db.prepare(`
    SELECT w.*, s.siteName, s.siteType
    FROM warehouses w
    LEFT JOIN sites s ON s.id = w.siteId
    WHERE w.id = ?
  `).get(req.params.id);
  success(res, warehouse);
});

// DELETE /api/system/warehouses/:id
router.delete('/warehouses/:id', (req, res) => {
  const db = getDb();
  const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id) as any;
  if (!warehouse) { error(res, 'Warehouse not found', 404); return; }
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM user_warehouses WHERE warehouseId = ?').get(req.params.id) as any).c;
  if (userCount > 0) {
    error(res, '该仓库仍有关联用户，无法删除');
    return;
  }
  db.prepare('DELETE FROM warehouses WHERE id = ?').run(req.params.id);
  success(res, null, '仓库删除成功');
});

// PUT /api/system/warehouses/user/:userId
router.put('/warehouses/user/:userId', (req, res) => {
  const db = getDb();
  const { warehouseIds } = req.body;
  if (!Array.isArray(warehouseIds)) {
    error(res, 'warehouseIds array is required');
    return;
  }
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_warehouses WHERE userId = ?').run(req.params.userId);
    const insert = db.prepare('INSERT INTO user_warehouses (id, userId, warehouseId, createdAt) VALUES (?, ?, ?, ?)');
    for (const whId of warehouseIds) {
      insert.run(generateId('UW'), req.params.userId, whId, now);
    }
  });
  tx();
  const rows = db.prepare(`
    SELECT w.*, s.siteName, s.siteType
    FROM warehouses w
    LEFT JOIN sites s ON s.id = w.siteId
    INNER JOIN user_warehouses uw ON w.id = uw.warehouseId
    WHERE uw.userId = ?
    ORDER BY w.type, w.name
  `).all(req.params.userId);
  success(res, rows);
});

export default router;
