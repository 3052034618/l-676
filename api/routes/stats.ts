import { Router, type Request, type Response } from 'express'
import db from '../database.js'

const router = Router()

router.get('/dashboard', (_req: Request, res: Response): void => {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  const totalMeetings = db.prepare('SELECT COUNT(*) as cnt FROM meetings').get() as { cnt: number }
  const totalTasks = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as { cnt: number }
  const completedTasks = db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'completed'").get() as { cnt: number }
  const overdueTasks = db.prepare(`
    SELECT COUNT(*) as cnt FROM tasks
    WHERE status NOT IN ('completed') AND deadline < ?
  `).get(now) as { cnt: number }

  const completionRate = totalTasks.cnt > 0 ? completedTasks.cnt / totalTasks.cnt : 0
  const overdueRate = totalTasks.cnt > 0 ? overdueTasks.cnt / totalTasks.cnt : 0

  const recentMeetings = db.prepare(`
    SELECT m.*, t.name as team_name
    FROM meetings m
    LEFT JOIN teams t ON m.team_id = t.id
    ORDER BY m.date DESC
    LIMIT 5
  `).all()

  const overdueTasksList = db.prepare(`
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
    LIMIT 10
  `).all(now)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().replace('T', ' ').substring(0, 19)
  const weekMeetings = db.prepare('SELECT COUNT(*) as cnt FROM meetings WHERE date >= ?').get(weekAgoStr) as { cnt: number }

  res.json({
    success: true,
    data: {
      totalMeetings: totalMeetings.cnt,
      weekMeetings: weekMeetings.cnt,
      totalTasks: totalTasks.cnt,
      completedTasks: completedTasks.cnt,
      overdueTasks: overdueTasks.cnt,
      completionRate: Math.round(completionRate * 1000) / 10,
      overdueRate: Math.round(overdueRate * 1000) / 10,
      recentMeetings,
      overdueTasksList,
    },
  })
})

export default router
