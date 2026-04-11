import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database/schema';
import { generateToken, authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: '用户名和密码不能为空' });
    return;
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.username, u.real_name, u.email, u.phone, u.status,
           r.role_code, r.role_name
    FROM sys_user u
    LEFT JOIN sys_user_role ur ON ur.user_id = u.id
    LEFT JOIN sys_role r ON r.id = ur.role_id
    WHERE u.username = ?
  `).get(username) as any;

  if (!user) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  if (user.status !== 'ACTIVE') {
    res.status(403).json({ error: '账号已被禁用' });
    return;
  }

  if (!bcrypt.compareSync(password, (db.prepare('SELECT password_hash FROM sys_user WHERE id = ?').get(user.id) as any).password_hash)) {
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const token = generateToken({
    id: user.id,
    username: user.username,
    real_name: user.real_name,
    role_code: user.role_code,
    role_name: user.role_name,
  });

  res.json({
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        realName: user.real_name,
        email: user.email,
        phone: user.phone,
        role: user.role_code,
        roles: [user.role_code],
        roleDetails: [{ id: user.id, roleCode: user.role_code, roleName: user.role_name }],
        status: user.status,
      },
    },
  });
});

// GET /api/auth/profile
router.get('/profile', authMiddleware, (req: Request, res: Response) => {
  res.json({ data: req.user });
});

// GET /api/auth/users
router.get('/users', (req: Request, res: Response) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.username, u.real_name as realName, u.email, u.phone, u.status, u.created_at as createdAt,
           r.role_code as role, r.role_name
    FROM sys_user u
    LEFT JOIN sys_user_role ur ON ur.user_id = u.id
    LEFT JOIN sys_role r ON r.id = ur.role_id
    ORDER BY u.created_at
  `).all() as any[];

  const mapped = users.map((u: any) => ({
    ...u,
    roles: [u.role],
    roleDetails: [{ id: u.id, roleCode: u.role, roleName: u.role_name }],
  }));

  res.json({ data: mapped });
});

export default router;
