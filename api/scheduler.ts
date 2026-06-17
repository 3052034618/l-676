import cron from 'node-cron'
import { v4 as uuidv4 } from 'uuid'
import db from './database.js'

let schedulerStarted = false

export function startScheduler() {
  if (schedulerStarted) return
  schedulerStarted = true

  cron.schedule('0 * * * *', () => {
    try {
      processOverdueTasks()
    } catch (e) {
      console.error('Scheduler error:', e)
    }
  })

  console.log('Task scheduler started (checks every hour)')
}

function getSupervisorAndDeptHead(assigneeId: string): { supervisorId: string | null; deptHeadId: string | null; supervisorName: string; deptHeadName: string } {
  const row = db.prepare(`
    SELECT u.supervisor_id, t.leader_id as dept_head_id,
           s.name as supervisor_name, l.name as dept_head_name
    FROM users u
    LEFT JOIN users s ON u.supervisor_id = s.id
    LEFT JOIN teams t ON u.team_id = t.id
    LEFT JOIN users l ON t.leader_id = l.id
    WHERE u.id = ?
  `).get(assigneeId) as Record<string, unknown> | undefined

  return {
    supervisorId: (row?.supervisor_id as string) || null,
    deptHeadId: (row?.dept_head_id as string) || null,
    supervisorName: (row?.supervisor_name as string) || '',
    deptHeadName: (row?.dept_head_name as string) || '',
  }
}

function upsertAssigneeReminder(taskId: string, type: string, sentTo: string, sentAt: string) {
  const existing = db.prepare(
    'SELECT id FROM reminders WHERE task_id = ? AND recipient_type = ?'
  ).get(taskId, 'assignee') as { id: string } | undefined

  if (existing) {
    db.prepare(
      'UPDATE reminders SET sent_at = ?, type = ?, status = ? WHERE id = ?'
    ).run(sentAt, type, 'sent', existing.id)
  } else {
    const reminderId = uuidv4()
    db.prepare(
      'INSERT INTO reminders (id, task_id, type, sent_to, recipient_type, sent_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(reminderId, taskId, type, sentTo, 'assignee', sentAt, 'sent')
  }
}

function insertEscalationReminder(taskId: string, sentTo: string, recipientType: 'supervisor' | 'dept_head', sentAt: string): boolean {
  const existing = db.prepare(
    'SELECT id FROM reminders WHERE task_id = ? AND recipient_type = ?'
  ).get(taskId, recipientType) as { id: string } | undefined

  if (existing) return false

  const reminderId = uuidv4()
  db.prepare(
    'INSERT INTO reminders (id, task_id, type, sent_to, recipient_type, sent_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(reminderId, taskId, 'escalation', sentTo, recipientType, sentAt, 'sent')
  return true
}

function insertLog(type: string, detail: string, operatorId: string | null, relatedId: string | null, isAnomaly: number, createdAt: string) {
  const logId = uuidv4()
  db.prepare(
    'INSERT INTO logs (id, type, detail, operator_id, related_id, is_anomaly, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(logId, type, detail, operatorId, relatedId, isAnomaly, createdAt)
}

function processOverdueTasks() {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  const overdueTasks = db.prepare(`
    SELECT t.*, u.name as assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.status NOT IN ('completed') AND t.deadline < ?
  `).all(now) as Record<string, unknown>[]

  for (const task of overdueTasks) {
    const taskId = task.id as string
    const lastReminded = task.last_reminded_at as string | null
    const prevRemindCount = (task.remind_count as number) || 0
    const prevEscalationLevel = (task.escalation_level as number) || 0

    if (lastReminded) {
      const lastTime = new Date(lastReminded).getTime()
      const hoursSinceLastReminder = (Date.now() - lastTime) / (1000 * 60 * 60)
      if (hoursSinceLastReminder < 24) continue
    } else {
      const deadlineTime = new Date(task.deadline as string).getTime()
      const hoursSinceDeadline = (Date.now() - deadlineTime) / (1000 * 60 * 60)
      if (hoursSinceDeadline < 24) continue
    }

    const remindCount = prevRemindCount + 1
    let escalationLevel = prevEscalationLevel

    const { supervisorId, deptHeadId, supervisorName, deptHeadName } = getSupervisorAndDeptHead(task.assignee_id as string)

    const isFirstEscalation = prevRemindCount < 2 && remindCount >= 2
    const isFirstAnomaly = prevRemindCount < 4 && remindCount >= 4

    if (isFirstEscalation && supervisorId) {
      escalationLevel = Math.max(escalationLevel, 1)
    }

    upsertAssigneeReminder(taskId, 'auto_remind', task.assignee_id as string, now)

    if (remindCount >= 2) {
      if (supervisorId && supervisorId !== task.assignee_id) {
        insertEscalationReminder(taskId, supervisorId, 'supervisor', now)
      }
      if (deptHeadId && deptHeadId !== supervisorId && deptHeadId !== task.assignee_id) {
        insertEscalationReminder(taskId, deptHeadId, 'dept_head', now)
      }
    }

    db.prepare(
      'UPDATE tasks SET remind_count=?, escalation_level=?, last_reminded_at=?, status=?, updated_at=? WHERE id=?'
    ).run(remindCount, escalationLevel, now, 'overdue', now, taskId)

    insertLog(
      'remind',
      `自动催办：待办"${task.title}"已超期，第${remindCount}次提醒负责人`,
      task.assignee_id as string,
      taskId,
      0,
      now
    )

    if (isFirstEscalation) {
      const names: string[] = []
      if (supervisorName) names.push(`直属主管(${supervisorName})`)
      if (deptHeadName && deptHeadName !== supervisorName) names.push(`部门负责人(${deptHeadName})`)
      const notified = names.length > 0 ? names.join('、') : '相关负责人'
      insertLog(
        'escalation',
        `自动升级：待办"${task.title}"连续${remindCount}次催办未处理，已通知${notified}`,
        task.assignee_id as string,
        taskId,
        1,
        now
      )
    }

    if (isFirstAnomaly) {
      insertLog(
        'anomaly',
        `异常：待办"${task.title}"持续超期，催办${remindCount}次均未处理`,
        task.assignee_id as string,
        taskId,
        1,
        now
      )
    }
  }

  db.save()
}
