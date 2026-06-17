import { Router, type Request, type Response } from 'express'
import db from '../database.js'

const router = Router()

router.get('/overdue', (req: Request, res: Response): void => {
  const { assignee_id, team_id, escalation_level, page = '1', pageSize = '20' } = req.query
  const pageNum = Math.max(1, parseInt(page as string) || 1)
  const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize as string) || 20))
  const offset = (pageNum - 1) * pageSizeNum

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  let where = 'WHERE t.status NOT IN (\'completed\') AND t.deadline < ?'
  const params: unknown[] = [now]

  if (assignee_id) {
    where += ' AND t.assignee_id = ?'
    params.push(assignee_id)
  }
  if (team_id) {
    where += ' AND u.team_id = ?'
    params.push(team_id)
  }
  if (escalation_level && String(escalation_level) !== 'all') {
    where += ' AND t.escalation_level = ?'
    params.push(parseInt(escalation_level as string))
  }

  const countRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN teams tm ON u.team_id = tm.id
    ${where}
  `).get(...params) as { total: number }

  const rows = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.supervisor_id,
           tm.name as team_name, tm.id as team_id,
           m.title as meeting_title
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN teams tm ON u.team_id = tm.id
    LEFT JOIN meetings m ON t.meeting_id = m.id
    ${where}
    ORDER BY
      CASE t.urgency
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END ASC,
      t.deadline ASC
    LIMIT ? OFFSET ?
  `).all(...params, pageSizeNum, offset) as Record<string, unknown>[]

  const taskIds = rows.map(r => r.id as string)

  let reminders: Record<string, unknown>[] = []
  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => '?').join(',')
    reminders = db.prepare(`
      SELECT r.*, u.name as sent_to_name
      FROM reminders r
      LEFT JOIN users u ON r.sent_to = u.id
      WHERE r.task_id IN (${placeholders})
      ORDER BY r.sent_at ASC
    `).all(...taskIds) as Record<string, unknown>[]
  }

  const reminderMap = new Map<string, Record<string, unknown>[]>()
  reminders.forEach(r => {
    const taskId = r.task_id as string
    if (!reminderMap.has(taskId)) reminderMap.set(taskId, [])
    reminderMap.get(taskId)!.push(r)
  })

  const enriched = rows.map(task => {
    const taskReminders = reminderMap.get(task.id as string) || []

    const notifiedRecipients = taskReminders
      .filter(r => r.type === 'escalation')
      .map(r => ({
        recipient_type: r.recipient_type as string,
        sent_to: r.sent_to as string,
        sent_to_name: r.sent_to_name as string,
        sent_at: r.sent_at as string,
      }))

    const firstEscalationAt = taskReminders.find(r => r.type === 'escalation')?.sent_at as string | undefined

    const lastRemind = taskReminders.length > 0
      ? taskReminders[taskReminders.length - 1]
      : null

    const nextCheckAt = task.last_reminded_at
      ? (() => {
        const d = new Date(task.last_reminded_at as string)
        d.setHours(d.getHours() + 24)
        return d.toISOString().replace('T', ' ').substring(0, 19)
      })()
      : (() => {
        const d = new Date(task.deadline as string)
        d.setHours(d.getHours() + 24)
        return d.toISOString().replace('T', ' ').substring(0, 19)
      })()

    const overdueDays = Math.floor(
      (Date.now() - new Date(task.deadline as string).getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      ...task,
      notified_recipients: notifiedRecipients,
      first_escalation_at: firstEscalationAt || null,
      last_remind_at: lastRemind ? lastRemind.sent_at : null,
      next_check_at: nextCheckAt,
      overdue_days: overdueDays,
    }
  })

  res.json({
    success: true,
    data: { items: enriched, total: countRow.total, page: pageNum, pageSize: pageSizeNum },
  })
})

router.get('/stats', (_req: Request, res: Response): void => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  const totalOverdue = db.prepare(`
    SELECT COUNT(*) as cnt FROM tasks WHERE status NOT IN ('completed') AND deadline < ?
  `).get(now) as { cnt: number }

  const byLevel = db.prepare(`
    SELECT escalation_level, COUNT(*) as cnt
    FROM tasks
    WHERE status NOT IN ('completed') AND deadline < ?
    GROUP BY escalation_level
    ORDER BY escalation_level
  `).all(now) as { escalation_level: number; cnt: number }[]

  const byTeam = db.prepare(`
    SELECT tm.id as team_id, tm.name as team_name, COUNT(*) as cnt
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN teams tm ON u.team_id = tm.id
    WHERE t.status NOT IN ('completed') AND t.deadline < ?
    GROUP BY tm.id
    ORDER BY cnt DESC
  `).all(now) as { team_id: string; team_name: string; cnt: number }[]

  const levelMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
  byLevel.forEach(r => { levelMap[r.escalation_level] = r.cnt })

  res.json({
    success: true,
    data: {
      total_overdue: totalOverdue.cnt,
      by_level: levelMap,
      by_team: byTeam,
    },
  })
})

router.get('/users', (_req: Request, res: Response): void => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const rows = db.prepare(`
    SELECT u.id, u.name, u.role, tm.name as team_name,
           COUNT(t.id) as overdue_count
    FROM users u
    LEFT JOIN teams tm ON u.team_id = tm.id
    LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status NOT IN ('completed') AND t.deadline < ?
    GROUP BY u.id
    HAVING overdue_count > 0
    ORDER BY overdue_count DESC
  `).all(now) as Record<string, unknown>[]

  res.json({ success: true, data: rows })
})

export default router
