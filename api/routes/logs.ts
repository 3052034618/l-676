import { Router, type Request, type Response } from 'express'
import db from '../database.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { type, page = '1', pageSize = '20' } = req.query
  const pageNum = Math.max(1, parseInt(page as string) || 1)
  const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize as string) || 20))
  const offset = (pageNum - 1) * pageSizeNum

  let where = 'WHERE 1=1'
  const params: unknown[] = []

  if (type) {
    where += ' AND l.type = ?'
    params.push(type)
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM logs l ${where}`).get(...params) as { total: number }

  const rows = db.prepare(`
    SELECT l.*, u.name as operator_name
    FROM logs l
    LEFT JOIN users u ON l.operator_id = u.id
    ${where}
    ORDER BY l.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSizeNum, offset)

  res.json({
    success: true,
    data: { items: rows, total: countRow.total, page: pageNum, pageSize: pageSizeNum },
  })
})

router.get('/anomalies', (_req: Request, res: Response): void => {
  const rows = db.prepare(`
    SELECT l.*, u.name as operator_name
    FROM logs l
    LEFT JOIN users u ON l.operator_id = u.id
    WHERE l.is_anomaly = 1
    ORDER BY l.created_at DESC
  `).all()

  const overdueTasks = db.prepare(`
    SELECT t.id, t.title, t.deadline, t.urgency, t.remind_count, t.escalation_level,
      u.name as assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.status NOT IN ('completed') AND t.deadline < datetime('now')
      AND (t.remind_count >= 3 OR t.escalation_level >= 2)
    ORDER BY t.urgency ASC, t.deadline ASC
  `).all()

  res.json({
    success: true,
    data: {
      anomalyLogs: rows,
      criticalOverdueTasks: overdueTasks,
    },
  })
})

export default router
