import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const router = Router()

const URGENCY_BASE_DAYS: Record<string, number> = {
  critical: 1,
  high: 3,
  medium: 5,
  low: 7,
}

function calculateDeadline(urgency: string, assigneeId: string): { deadline: string; reason: string } {
  const baseDays = URGENCY_BASE_DAYS[urgency] || 5

  const row = db.prepare(`
    SELECT AVG(
      CAST(julianday(COALESCE(t.completed_at, datetime('now'))) - julianday(t.created_at) AS REAL) * 24
    ) as avg_hours
    FROM tasks t
    WHERE t.assignee_id = ? AND t.status = 'completed'
  `).get(assigneeId) as { avg_hours: number | null }

  const avgHours = row?.avg_hours || 0
  const avgDays = avgHours / 24

  let adjustment = 0
  if (avgDays > 0) {
    if (avgDays > baseDays) {
      adjustment = Math.round(avgDays - baseDays)
    } else {
      adjustment = -Math.round(baseDays - avgDays)
    }
    adjustment = Math.min(adjustment, 7)
  }

  const totalDays = Math.max(1, baseDays + adjustment)
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + totalDays)
  const deadlineStr = deadline.toISOString().replace('T', ' ').substring(0, 19)

  const reason = `紧急度${urgency}，基准${baseDays}天，历史平均响应时间调整${adjustment >= 0 ? '+' : ''}${adjustment}天`

  return { deadline: deadlineStr, reason }
}

router.get('/', (req: Request, res: Response): void => {
  const { status, urgency, assignee_id, page = '1', pageSize = '10' } = req.query
  const pageNum = Math.max(1, parseInt(page as string) || 1)
  const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize as string) || 10))
  const offset = (pageNum - 1) * pageSizeNum

  let where = 'WHERE 1=1'
  const params: unknown[] = []

  if (status) {
    where += ' AND t.status = ?'
    params.push(status)
  }
  if (urgency) {
    where += ' AND t.urgency = ?'
    params.push(urgency)
  }
  if (assignee_id) {
    where += ' AND t.assignee_id = ?'
    params.push(assignee_id)
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM tasks t ${where}`).get(...params) as { total: number }

  const rows = db.prepare(`
    SELECT t.*, u.name as assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
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
  `).all(...params, pageSizeNum, offset)

  res.json({
    success: true,
    data: { items: rows, total: countRow.total, page: pageNum, pageSize: pageSizeNum },
  })
})

router.get('/overdue', (_req: Request, res: Response): void => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const rows = db.prepare(`
    SELECT t.*, u.name as assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.status NOT IN ('completed') AND t.deadline < ?
    ORDER BY
      CASE t.urgency
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END ASC,
      t.deadline ASC
  `).all(now)

  res.json({ success: true, data: rows })
})

router.get('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.id = ?
  `).get(id)

  if (!task) {
    res.status(404).json({ success: false, error: '待办不存在' })
    return
  }

  const reminders = db.prepare(`
    SELECT r.*, u.name as sent_to_name
    FROM reminders r
    LEFT JOIN users u ON r.sent_to = u.id
    WHERE r.task_id = ?
    ORDER BY r.sent_at DESC
  `).all(id)
  res.json({ success: true, data: { ...(task as Record<string, unknown>), reminders } })
})

router.put('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ success: false, error: '待办不存在' })
    return
  }

  const { title, description, assignee_id, urgency, status } = req.body
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  let completedAt = existing.completed_at as string | null
  if (status === 'completed' && existing.status !== 'completed') {
    completedAt = now
  } else if (status && status !== 'completed') {
    completedAt = null
  }

  const newUrgency = urgency ?? existing.urgency
  const newAssignee = assignee_id ?? existing.assignee_id
  let deadline = existing.deadline as string
  let reason = existing.calculated_deadline_reason as string

  if (urgency && urgency !== existing.urgency) {
    const calc = calculateDeadline(newUrgency as string, newAssignee as string)
    deadline = calc.deadline
    reason = calc.reason
  }

  db.prepare(`
    UPDATE tasks SET title=?, description=?, assignee_id=?, urgency=?, status=?,
      deadline=?, calculated_deadline_reason=?, completed_at=?, updated_at=?
    WHERE id=?
  `).run(
    title ?? existing.title,
    description ?? existing.description,
    newAssignee,
    newUrgency,
    status ?? existing.status,
    deadline,
    reason,
    completedAt,
    now,
    id,
  )

  if (status && status !== existing.status) {
    const logId = uuidv4()
    db.prepare('INSERT INTO logs (id, type, detail, operator_id, related_id, is_anomaly, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(logId, 'task_assign', `待办"${existing.title}"状态更新为${status}`, newAssignee, id, 0, now)
  }

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.id = ?
  `).get(id)

  res.json({ success: true, data: task })
})

router.post('/:id/remind', (req: Request, res: Response): void => {
  const { id } = req.params
  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.supervisor_id, u.team_id
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.id = ?
  `).get(id) as Record<string, unknown> | undefined

  if (!task) {
    res.status(404).json({ success: false, error: '待办不存在' })
    return
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const prevRemindCount = (task.remind_count as number) || 0
  const remindCount = prevRemindCount + 1

  const prevEscalationLevel = (task.escalation_level as number) || 0
  let escalationLevel = prevEscalationLevel

  const teamRow = db.prepare(`
    SELECT t.leader_id as dept_head_id, u.name as dept_head_name
    FROM teams t
    LEFT JOIN users u ON t.leader_id = u.id
    WHERE t.id = ?
  `).get(task.team_id as string) as Record<string, unknown> | undefined

  const supervisorId = task.supervisor_id as string | null
  const deptHeadId = teamRow?.dept_head_id as string | null || null
  const deptHeadName = teamRow?.dept_head_name as string || ''

  const supervisorRow = supervisorId
    ? db.prepare('SELECT name FROM users WHERE id = ?').get(supervisorId) as { name: string } | undefined
    : undefined
  const supervisorName = supervisorRow?.name || ''

  const isFirstEscalation = prevRemindCount < 2 && remindCount >= 2
  const isFirstAnomaly = prevRemindCount < 3 && remindCount >= 3

  if (isFirstEscalation && supervisorId) {
    escalationLevel = Math.max(escalationLevel, 1)
  }

  const existingAssigneeReminder = db.prepare(
    'SELECT id FROM reminders WHERE task_id = ? AND recipient_type = ?'
  ).get(id, 'assignee') as { id: string } | undefined

  if (existingAssigneeReminder) {
    db.prepare(
      'UPDATE reminders SET sent_at = ?, type = ?, status = ? WHERE id = ?'
    ).run(now, 'manual_remind', 'sent', existingAssigneeReminder.id)
  } else {
    const reminderId = uuidv4()
    db.prepare(
      'INSERT INTO reminders (id, task_id, type, sent_to, recipient_type, sent_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(reminderId, id, 'manual_remind', task.assignee_id as string, 'assignee', now, 'sent')
  }

  if (remindCount >= 2) {
    if (supervisorId && supervisorId !== task.assignee_id) {
      const existingSupervisor = db.prepare(
        'SELECT id FROM reminders WHERE task_id = ? AND recipient_type = ?'
      ).get(id, 'supervisor') as { id: string } | undefined
      if (!existingSupervisor) {
        const supReminderId = uuidv4()
        db.prepare(
          'INSERT INTO reminders (id, task_id, type, sent_to, recipient_type, sent_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(supReminderId, id, 'escalation', supervisorId, 'supervisor', now, 'sent')
      }
    }
    if (deptHeadId && deptHeadId !== supervisorId && deptHeadId !== task.assignee_id) {
      const existingDeptHead = db.prepare(
        'SELECT id FROM reminders WHERE task_id = ? AND recipient_type = ?'
      ).get(id, 'dept_head') as { id: string } | undefined
      if (!existingDeptHead) {
        const deptReminderId = uuidv4()
        db.prepare(
          'INSERT INTO reminders (id, task_id, type, sent_to, recipient_type, sent_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(deptReminderId, id, 'escalation', deptHeadId, 'dept_head', now, 'sent')
      }
    }
  }

  db.prepare('UPDATE tasks SET remind_count=?, escalation_level=?, last_reminded_at=?, updated_at=? WHERE id=?')
    .run(remindCount, escalationLevel, now, now, id)

  const logType = isFirstEscalation ? 'escalation' : 'remind'

  let logDetail = `手动催办：待办"${task.title}"第${remindCount}次催办`
  if (isFirstEscalation) {
    const names: string[] = []
    if (supervisorName) names.push(`直属主管(${supervisorName})`)
    if (deptHeadName && deptHeadName !== supervisorName) names.push(`部门负责人(${deptHeadName})`)
    const notified = names.length > 0 ? names.join('、') : '相关负责人'
    logDetail = `手动升级：待办"${task.title}"第${remindCount}次催办未处理，已通知${notified}`
  }

  const isAnomaly = isFirstAnomaly ? 1 : 0
  const logId = uuidv4()
  db.prepare('INSERT INTO logs (id, type, detail, operator_id, related_id, is_anomaly, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(logId, logType, logDetail, task.assignee_id, id, isAnomaly, now)

  res.json({
    success: true,
    data: {
      remind_count: remindCount,
      escalation_level: escalationLevel,
    },
  })
})

export default router
