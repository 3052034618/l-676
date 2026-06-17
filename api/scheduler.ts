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

function processOverdueTasks() {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  const overdueTasks = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.supervisor_id, u.team_id
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.status NOT IN ('completed') AND t.deadline < ?
  `).all(now) as Record<string, unknown>[]

  for (const task of overdueTasks) {
    const taskId = task.id as string
    const lastReminded = task.last_reminded_at as string | null

    if (lastReminded) {
      const lastTime = new Date(lastReminded).getTime()
      const hoursSinceLastReminder = (Date.now() - lastTime) / (1000 * 60 * 60)
      if (hoursSinceLastReminder < 24) continue
    } else {
      const deadlineTime = new Date(task.deadline as string).getTime()
      const hoursSinceDeadline = (Date.now() - deadlineTime) / (1000 * 60 * 60)
      if (hoursSinceDeadline < 24) continue
    }

    const remindCount = ((task.remind_count as number) || 0) + 1
    let sentTo = task.assignee_id as string
    let reminderType = 'auto_remind'
    let escalationLevel = task.escalation_level as number
    let isAnomaly = 0

    if (remindCount >= 2 && task.supervisor_id) {
      sentTo = task.supervisor_id as string
      reminderType = 'escalation'
      escalationLevel = Math.min(escalationLevel + 1, 3)
      isAnomaly = 1
    }

    if (remindCount >= 4) {
      isAnomaly = 1
    }

    const reminderId = uuidv4()
    db.prepare('INSERT INTO reminders (id, task_id, type, sent_to, sent_at, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(reminderId, taskId, reminderType, sentTo, now, 'sent')

    db.prepare('UPDATE tasks SET remind_count=?, escalation_level=?, last_reminded_at=?, status=?, updated_at=? WHERE id=?')
      .run(remindCount, escalationLevel, now, 'overdue', now, taskId)

    const logDetail = reminderType === 'escalation'
      ? `自动升级：待办"${task.title}"连续${remindCount}次催办未处理，已通知主管`
      : `自动催办：待办"${task.title}"已超期，第${remindCount}次提醒`

    const logId = uuidv4()
    db.prepare('INSERT INTO logs (id, type, detail, operator_id, related_id, is_anomaly, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(logId, reminderType === 'escalation' ? 'escalation' : 'remind', logDetail, task.assignee_id, taskId, isAnomaly, now)

    if (remindCount >= 4) {
      const anomalyLogId = uuidv4()
      db.prepare('INSERT INTO logs (id, type, detail, operator_id, related_id, is_anomaly, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(anomalyLogId, 'anomaly', `异常：待办"${task.title}"持续超期，催办${remindCount}次均未处理`, task.assignee_id, taskId, 1, now)
    }
  }

  db.save()
}
