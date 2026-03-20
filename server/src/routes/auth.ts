import { Router } from 'express';
import { getDb } from '../database/connection';
import { signToken, authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { generateId } from '../utils/idGenerator';

const router = Router();

const SUPER_ROLE_CODES = new Set(['ADMIN', 'BOSS']);
const USER_STATUS_VALUES = new Set(['ACTIVE', 'INACTIVE', 'LOCKED']);

function isSuperRole(roleCodes: string[]) {
  return roleCodes.some((roleCode) => SUPER_ROLE_CODES.has(roleCode));
}

function normalizeRoleRow(row: any) {
  return {
    ...row,
    isSystem: Number(row?.isSystem || 0) === 1,
  };
}

function normalizePermissionRow(row: any) {
  return {
    ...row,
  };
}

function loadUserRoles(db: any, userId: string, legacyRole?: string) {
  let rows = db.prepare(`
    SELECT r.*
    FROM sys_roles r
    INNER JOIN sys_user_roles ur ON ur.roleId = r.id
    WHERE ur.userId = ? AND r.status = 'ACTIVE'
    ORDER BY r.roleCode ASC
  `).all(userId) as any[];

  if (rows.length === 0 && legacyRole) {
    const roleRow = db.prepare('SELECT * FROM sys_roles WHERE roleCode = ?').get(String(legacyRole).trim().toUpperCase()) as any;
    if (roleRow?.id) {
      db.prepare(`
        INSERT OR IGNORE INTO sys_user_roles (id, userId, roleId, createdAt)
        VALUES (?, ?, ?, ?)
      `).run(`UR-${userId}-${roleRow.id}`, userId, roleRow.id, new Date().toISOString());
      rows = [roleRow];
    }
  }

  return rows.map(normalizeRoleRow);
}

function loadUserPermissions(db: any, userId: string) {
  const rows = db.prepare(`
    SELECT DISTINCT p.*
    FROM sys_permissions p
    INNER JOIN sys_role_permissions rp ON rp.permissionId = p.id
    INNER JOIN sys_user_roles ur ON ur.roleId = rp.roleId
    INNER JOIN sys_roles r ON r.id = ur.roleId
    WHERE ur.userId = ? AND p.status = 'ACTIVE' AND r.status = 'ACTIVE'
    ORDER BY p.moduleKey ASC, p.permissionCode ASC
  `).all(userId) as any[];
  return rows.map(normalizePermissionRow);
}

function loadUserWarehouses(db: any, userId: string, superAccess: boolean) {
  if (superAccess) {
    return db.prepare(`
      SELECT id, code, name, nameEn, type, country, city, siteId
      FROM warehouses
      WHERE status = 'ACTIVE'
      ORDER BY type, name
    `).all();
  }

  return db.prepare(`
    SELECT w.id, w.code, w.name, w.nameEn, w.type, w.country, w.city, w.siteId
    FROM warehouses w
    INNER JOIN user_warehouses uw ON w.id = uw.warehouseId
    WHERE uw.userId = ? AND w.status = 'ACTIVE'
    ORDER BY w.type, w.name
  `).all(userId);
}

function loadUserSites(db: any, userId: string, superAccess: boolean) {
  if (superAccess) {
    return db.prepare(`
      SELECT s.id, s.siteCode, s.siteName, s.siteType, s.countryId, s.cityId, s.status,
             c.countryName, ci.cityName
      FROM sites s
      INNER JOIN countries c ON c.id = s.countryId
      INNER JOIN cities ci ON ci.id = s.cityId
      WHERE s.status = 'ACTIVE'
      ORDER BY c.countryName, ci.cityName, s.siteName
    `).all();
  }

  return db.prepare(`
    SELECT s.id, s.siteCode, s.siteName, s.siteType, s.countryId, s.cityId, s.status,
           c.countryName, ci.cityName
    FROM sites s
    INNER JOIN user_sites us ON us.siteId = s.id
    INNER JOIN countries c ON c.id = s.countryId
    INNER JOIN cities ci ON ci.id = s.cityId
    WHERE us.userId = ? AND s.status = 'ACTIVE'
    ORDER BY c.countryName, ci.cityName, s.siteName
  `).all(userId);
}

function getPrimaryRoleCode(roleCodes: string[], legacyRole?: string) {
  if (roleCodes.includes('ADMIN')) return 'ADMIN';
  if (roleCodes.includes('BOSS')) return 'BOSS';
  if (roleCodes.length > 0) return roleCodes[0];
  if (legacyRole) return String(legacyRole).trim().toUpperCase();
  return 'ADMIN';
}

function buildUserContext(db: any, userRow: any) {
  const roles = loadUserRoles(db, userRow.id, userRow.role);
  const roleCodes = roles.map((role) => role.roleCode);
  const primaryRole = getPrimaryRoleCode(roleCodes, userRow.role);
  const permissions = loadUserPermissions(db, userRow.id);
  const permissionCodes = permissions.map((permission) => permission.permissionCode);
  const superAccess = isSuperRole(roleCodes.length > 0 ? roleCodes : [primaryRole]);

  const warehouses = loadUserWarehouses(db, userRow.id, superAccess);
  const sites = loadUserSites(db, userRow.id, superAccess);

  return {
    ...userRow,
    role: primaryRole,
    roles: roleCodes.length > 0 ? roleCodes : [primaryRole],
    roleDetails: roles,
    permissions: permissionCodes,
    permissionDetails: permissions,
    warehouses,
    sites,
  };
}

function resolveDepartmentInfo(db: any, payload: any, current?: { departmentId?: string | null; department?: string | null }) {
  if (payload?.departmentId !== undefined) {
    const deptId = String(payload.departmentId || '').trim();
    if (!deptId) {
      return { departmentId: null, department: null };
    }
    const dept = db.prepare('SELECT id, deptName FROM departments WHERE id = ?').get(deptId) as any;
    if (!dept?.id) {
      throw new Error('Invalid departmentId');
    }
    return { departmentId: dept.id, department: dept.deptName };
  }

  if (payload?.department !== undefined) {
    const deptName = String(payload.department || '').trim();
    if (!deptName) {
      return { departmentId: null, department: null };
    }
    const dept = db.prepare('SELECT id, deptName FROM departments WHERE deptName = ?').get(deptName) as any;
    if (dept?.id) {
      return { departmentId: dept.id, department: dept.deptName };
    }
    return { departmentId: null, department: deptName };
  }

  return {
    departmentId: current?.departmentId ?? null,
    department: current?.department ?? null,
  };
}

function listAssignableRoleIds(db: any, payload: any) {
  if (Array.isArray(payload?.roleIds) && payload.roleIds.length > 0) {
    const roleIds = payload.roleIds.map((id: any) => String(id));
    const placeholders = roleIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id FROM sys_roles WHERE id IN (${placeholders})`).all(...roleIds) as any[];
    if (rows.length !== roleIds.length) {
      throw new Error('Some roleIds are invalid');
    }
    return roleIds;
  }

  if (Array.isArray(payload?.roleCodes) && payload.roleCodes.length > 0) {
    const roleCodes = payload.roleCodes.map((code: any) => String(code).trim().toUpperCase());
    const placeholders = roleCodes.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id, roleCode FROM sys_roles WHERE roleCode IN (${placeholders})`).all(...roleCodes) as any[];
    if (rows.length !== roleCodes.length) {
      throw new Error('Some roleCodes are invalid');
    }
    return rows.map((row) => row.id);
  }

  const fallbackRoleCode = String(payload?.role || '').trim().toUpperCase();
  if (fallbackRoleCode) {
    const role = db.prepare('SELECT id FROM sys_roles WHERE roleCode = ?').get(fallbackRoleCode) as any;
    if (!role?.id) {
      throw new Error('Invalid role');
    }
    return [role.id];
  }

  return [];
}

function bindUserRoles(db: any, userId: string, roleIds: string[], now: string) {
  db.prepare('DELETE FROM sys_user_roles WHERE userId = ?').run(userId);
  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO sys_user_roles (id, userId, roleId, createdAt)
    VALUES (?, ?, ?, ?)
  `);
  for (const roleId of roleIds) {
    insertRole.run(`UR-${userId}-${roleId}`, userId, roleId, now);
  }

  let roleCode = 'SALES';
  if (roleIds.length > 0) {
    const role = db.prepare('SELECT roleCode FROM sys_roles WHERE id = ?').get(roleIds[0]) as any;
    if (role?.roleCode) {
      roleCode = role.roleCode;
    }
  } else {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as any;
    if (user?.role) roleCode = user.role;
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(roleCode, userId);
}

function bindUserSitesAndWarehouses(db: any, userId: string, payload: any, now: string) {
  const hasSiteUpdate = Array.isArray(payload?.siteIds);
  const hasWarehouseUpdate = Array.isArray(payload?.warehouseIds);
  if (!hasSiteUpdate && !hasWarehouseUpdate) return;

  const siteIds: string[] = hasSiteUpdate ? payload.siteIds.map((id: any) => String(id)) : [];
  if (hasSiteUpdate && siteIds.length > 0) {
    const placeholders = siteIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id FROM sites WHERE id IN (${placeholders})`).all(...siteIds) as any[];
    if (rows.length !== siteIds.length) {
      throw new Error('Some siteIds are invalid');
    }
  }

  const explicitWarehouseIds: string[] = hasWarehouseUpdate ? payload.warehouseIds.map((id: any) => String(id)) : [];
  if (hasWarehouseUpdate && explicitWarehouseIds.length > 0) {
    const placeholders = explicitWarehouseIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id FROM warehouses WHERE id IN (${placeholders})`).all(...explicitWarehouseIds) as any[];
    if (rows.length !== explicitWarehouseIds.length) {
      throw new Error('Some warehouseIds are invalid');
    }
  }

  if (hasSiteUpdate) {
    db.prepare('DELETE FROM user_sites WHERE userId = ?').run(userId);
    const insertSite = db.prepare('INSERT OR IGNORE INTO user_sites (id, userId, siteId, createdAt) VALUES (?, ?, ?, ?)');
    for (const siteId of siteIds) {
      insertSite.run(generateId('US'), userId, siteId, now);
    }
  }

  db.prepare('DELETE FROM user_warehouses WHERE userId = ?').run(userId);
  const insertWarehouse = db.prepare('INSERT OR IGNORE INTO user_warehouses (id, userId, warehouseId, createdAt) VALUES (?, ?, ?, ?)');
  const mergedWarehouseIds = new Set<string>();

  const siteIdsForWarehouse = hasSiteUpdate
    ? siteIds
    : (db.prepare('SELECT siteId FROM user_sites WHERE userId = ?').all(userId) as any[]).map((row) => row.siteId).filter(Boolean);

  if (siteIdsForWarehouse.length > 0) {
    const placeholders = siteIdsForWarehouse.map(() => '?').join(',');
    const rows = db.prepare(`SELECT id FROM warehouses WHERE siteId IN (${placeholders})`).all(...siteIdsForWarehouse) as any[];
    for (const row of rows) {
      if (row?.id) mergedWarehouseIds.add(String(row.id));
    }
  }

  for (const warehouseId of explicitWarehouseIds) {
    mergedWarehouseIds.add(warehouseId);
  }

  for (const warehouseId of mergedWarehouseIds) {
    insertWarehouse.run(generateId('UW'), userId, warehouseId, now);
  }
}

function assertAdmin(req: any, res: any) {
  if (req.user?.role !== 'ADMIN') {
    error(res, 'Permission denied', 403);
    return false;
  }
  return true;
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    error(res, 'Username and password are required');
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

  if (!user || user.password !== password) {
    error(res, 'Invalid username or password', 401);
    return;
  }

  if (user.status !== 'ACTIVE') {
    error(res, 'Account is disabled', 403);
    return;
  }

  db.prepare('UPDATE users SET lastLoginAt = ? WHERE id = ?').run(new Date().toISOString(), user.id);
  const userContext = buildUserContext(db, user);

  const token = signToken({
    id: user.id,
    username: user.username,
    realName: user.realName,
    role: userContext.role,
  });

  success(res, {
    token,
    user: {
      id: userContext.id,
      username: userContext.username,
      realName: userContext.realName,
      role: userContext.role,
      roles: userContext.roles,
      permissions: userContext.permissions,
      email: userContext.email,
      phone: userContext.phone,
      departmentId: userContext.departmentId || null,
      department: userContext.department,
      warehouses: userContext.warehouses,
      sites: userContext.sites,
    },
  });
});

// GET /api/auth/profile
router.get('/profile', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT id, username, realName, role, email, phone, departmentId, department, warehouseId, warehouseName, status, createdAt, lastLoginAt
    FROM users
    WHERE id = ?
  `).get(req.user!.id) as any;

  if (!user) {
    error(res, 'User not found', 404);
    return;
  }

  const userContext = buildUserContext(db, user);
  success(res, userContext);
});

// GET /api/auth/users - list all users (admin only)
router.get('/users', authMiddleware, (req, res) => {
  if (!assertAdmin(req, res)) return;

  const db = getDb();
  const users = db.prepare(`
    SELECT id, username, realName, role, email, phone, departmentId, department, status, createdAt, lastLoginAt
    FROM users
    ORDER BY datetime(createdAt) ASC
  `).all() as any[];

  const list = users.map((user) => buildUserContext(db, user));
  success(res, list);
});

// POST /api/auth/users - create user (admin only)
router.post('/users', authMiddleware, (req, res) => {
  if (!assertAdmin(req, res)) return;

  const payload = req.body || {};
  const username = String(payload.username || '').trim();
  const realName = String(payload.realName || '').trim();
  const password = String(payload.password || '123456');
  const status = String(payload.status || 'ACTIVE').trim().toUpperCase();

  if (!username || !realName || !password) {
    error(res, 'Missing required fields: username, realName, password');
    return;
  }
  if (!USER_STATUS_VALUES.has(status)) {
    error(res, 'Invalid user status');
    return;
  }

  const db = getDb();
  const duplicate = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (duplicate) {
    error(res, 'Username already exists');
    return;
  }

  let roleIds: string[] = [];
  try {
    roleIds = listAssignableRoleIds(db, payload);
  } catch (err: any) {
    error(res, err?.message || 'Invalid role payload');
    return;
  }
  if (roleIds.length === 0) {
    error(res, 'At least one role is required');
    return;
  }

  const id = generateId('USR');
  const now = new Date().toISOString();
  let departmentInfo: { departmentId: string | null; department: string | null } = { departmentId: null, department: null };
  try {
    departmentInfo = resolveDepartmentInfo(db, payload);
  } catch (err: any) {
    error(res, err?.message || 'Invalid department payload');
    return;
  }

  try {
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, username, realName, password, email, phone, role, status, departmentId, department, warehouseId, warehouseName, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        username,
        realName,
        password,
        payload.email || null,
        payload.phone || null,
        'SALES',
        status,
        departmentInfo.departmentId,
        departmentInfo.department,
        null,
        null,
        now
      );

      bindUserRoles(db, id, roleIds, now);
      bindUserSitesAndWarehouses(db, id, payload, now);
    });
    tx();
  } catch (err: any) {
    error(res, err?.message || 'Create user failed');
    return;
  }

  const created = db.prepare(`
    SELECT id, username, realName, role, email, phone, departmentId, department, status, createdAt, lastLoginAt
    FROM users
    WHERE id = ?
  `).get(id) as any;

  success(res, buildUserContext(db, created));
});

// PUT /api/auth/users/:id - update user (admin only)
router.put('/users/:id', authMiddleware, (req, res) => {
  if (!assertAdmin(req, res)) return;

  const userId = String(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!existing) {
    error(res, 'User not found', 404);
    return;
  }

  const payload = req.body || {};
  if (payload.status && !USER_STATUS_VALUES.has(String(payload.status).trim().toUpperCase())) {
    error(res, 'Invalid user status');
    return;
  }

  let roleIds: string[] | null = null;
  const hasRolePayload =
    (Array.isArray(payload.roleIds) && payload.roleIds.length >= 0) ||
    (Array.isArray(payload.roleCodes) && payload.roleCodes.length >= 0) ||
    payload.role !== undefined;
  if (hasRolePayload) {
    try {
      roleIds = listAssignableRoleIds(db, payload);
      if (!roleIds || roleIds.length === 0) {
        error(res, 'At least one role is required');
        return;
      }
    } catch (err: any) {
      error(res, err?.message || 'Invalid role payload');
      return;
    }
  }

  const now = new Date().toISOString();
  let departmentInfo: { departmentId: string | null; department: string | null } = {
    departmentId: existing.departmentId || null,
    department: existing.department || null,
  };
  try {
    departmentInfo = resolveDepartmentInfo(db, payload, {
      departmentId: existing.departmentId || null,
      department: existing.department || null,
    });
  } catch (err: any) {
    error(res, err?.message || 'Invalid department payload');
    return;
  }
  const sets: string[] = [];
  const params: any[] = [];
  const editableKeys = ['realName', 'email', 'phone', 'status'];
  for (const key of editableKeys) {
    if (payload[key] === undefined) continue;
    const value = key === 'status' ? String(payload[key]).trim().toUpperCase() : payload[key];
    sets.push(`${key} = ?`);
    params.push(value);
  }
  if (payload.departmentId !== undefined || payload.department !== undefined) {
    sets.push('departmentId = ?', 'department = ?');
    params.push(departmentInfo.departmentId, departmentInfo.department);
  }
  if (payload.password) {
    sets.push('password = ?');
    params.push(String(payload.password));
  }

  try {
    const tx = db.transaction(() => {
      if (sets.length > 0) {
        params.push(userId);
        db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      }

      if (roleIds) {
        bindUserRoles(db, userId, roleIds, now);
      }

      bindUserSitesAndWarehouses(db, userId, payload, now);
    });
    tx();
  } catch (err: any) {
    error(res, err?.message || 'Update user failed');
    return;
  }

  const row = db.prepare(`
    SELECT id, username, realName, role, email, phone, departmentId, department, status, createdAt, lastLoginAt
    FROM users
    WHERE id = ?
  `).get(userId) as any;
  success(res, buildUserContext(db, row));
});

// DELETE /api/auth/users/:id - delete user (admin only)
router.delete('/users/:id', authMiddleware, (req, res) => {
  if (!assertAdmin(req, res)) return;

  if (req.params.id === req.user!.id) {
    error(res, 'Cannot delete current login user');
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!existing) {
    error(res, 'User not found', 404);
    return;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM sys_user_roles WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM user_sites WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM user_warehouses WHERE userId = ?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  });
  tx();

  success(res, null, 'User deleted');
});

// POST /api/auth/users/:id/reset-password - reset password (admin only)
router.post('/users/:id/reset-password', authMiddleware, (req, res) => {
  if (!assertAdmin(req, res)) return;

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!existing) {
    error(res, 'User not found', 404);
    return;
  }

  const password = String(req.body?.password || '123456');
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(password, req.params.id);
  success(res, null, 'Password reset successfully');
});

export default router;
