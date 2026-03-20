import { Router } from 'express';
import { getDb } from '../database/connection';
import { success, error } from '../utils/response';

const router = Router();

// GET /api/notifications
router.get('/', (req, res) => {
  const db = getDb();
  const { warehouse, userId, unreadOnly } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (warehouse) { where += ' AND warehouse = ?'; params.push(warehouse); }
  if (userId) { where += ' AND (userId = ? OR userId IS NULL)'; params.push(userId); }
  if (unreadOnly === 'true') { where += ' AND read = 0'; }

  const rows = db.prepare(`SELECT * FROM notifications ${where} ORDER BY createdAt DESC LIMIT 50`).all(...params);
  success(res, rows);
});

// PUT /api/notifications/:id/read
router.put('/:id/read', (req, res) => {
  const db = getDb();
  const result = db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  if (result.changes === 0) { error(res, 'Notification not found', 404); return; }
  success(res, null, 'Marked as read');
});

// POST /api/notifications
router.post('/', (req, res) => {
  const db = getDb();
  const id = `NOTIF-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  const now = new Date().toISOString();
  const { type, title, content, userId, warehouse, relatedId, relatedType, method } = req.body;

  if (!title || !content) { error(res, 'title and content are required'); return; }

  db.prepare(`
    INSERT INTO notifications (id, type, title, content, userId, warehouse, relatedId, relatedType, read, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, type || 'SYSTEM', title, content, userId || null, warehouse || 'SALES', relatedId || null, relatedType || null, now);

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  success(res, notification);
});

export default router;
