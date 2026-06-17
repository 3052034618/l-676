import { Router, type Request, type Response } from 'express'
import ExcelJS from 'exceljs'
import db from '../database.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { keyword, dateFrom, dateTo, assignee_id, page = '1', pageSize = '10' } = req.query
  const pageNum = Math.max(1, parseInt(page as string) || 1)
  const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize as string) || 10))
  const offset = (pageNum - 1) * pageSizeNum

  const meetingParams: unknown[] = []
  const taskParams: unknown[] = []

  let meetingWhere = 'WHERE 1=1'
  let taskWhere = 'WHERE 1=1'

  if (keyword) {
    meetingWhere += ' AND (m.title LIKE ? OR m.transcription LIKE ?)'
    meetingParams.push(`%${keyword}%`, `%${keyword}%`)
    taskWhere += ' AND (t.title LIKE ? OR t.description LIKE ?)'
    taskParams.push(`%${keyword}%`, `%${keyword}%`)
  }

  if (dateFrom) {
    meetingWhere += ' AND m.date >= ?'
    meetingParams.push(dateFrom)
    taskWhere += ' AND t.created_at >= ?'
    taskParams.push(dateFrom)
  }

  if (dateTo) {
    meetingWhere += ' AND m.date <= ?'
    meetingParams.push(dateTo)
    taskWhere += ' AND t.created_at <= ?'
    taskParams.push(dateTo)
  }

  if (assignee_id) {
    taskWhere += ' AND t.assignee_id = ?'
    taskParams.push(assignee_id)
  }

  const meetings = db.prepare(`
    SELECT m.id, m.title, m.date, m.duration, m.status, m.team_id, tm.name as team_name, 'meeting' as type
    FROM meetings m
    LEFT JOIN teams tm ON m.team_id = tm.id
    ${meetingWhere}
    ORDER BY m.date DESC
  `).all(...meetingParams) as Record<string, unknown>[]

  const tasks = db.prepare(`
    SELECT t.id, t.title, t.status, t.urgency, t.deadline, t.assignee_id, u.name as assignee_name, 'task' as type
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    ${taskWhere}
    ORDER BY t.created_at DESC
  `).all(...taskParams) as Record<string, unknown>[]

  const allResults = [
    ...meetings.map(m => ({ ...m, type: 'meeting' })),
    ...tasks.map(t => ({ ...t, type: 'task' })),
  ]

  allResults.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const dateA = (a.date || a.deadline || a.created_at) as string
    const dateB = (b.date || b.deadline || b.created_at) as string
    return dateB.localeCompare(dateA)
  })

  const total = allResults.length
  const items = allResults.slice(offset, offset + pageSizeNum)

  res.json({
    success: true,
    data: {
      items,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      meetingCount: meetings.length,
      taskCount: tasks.length,
    },
  })
})

router.post('/export', async (req: Request, res: Response): Promise<void> => {
  const { keyword, dateFrom, dateTo, assignee_id, ids } = req.body

  let meetingWhere = 'WHERE 1=1'
  let taskWhere = 'WHERE 1=1'
  const meetingParams: unknown[] = []
  const taskParams: unknown[] = []

  if (ids && Array.isArray(ids) && ids.length > 0) {
    const meetingIds = ids as string[]
    const taskIds = ids as string[]
    if (meetingIds.length > 0) {
      meetingWhere += ` AND m.id IN (${meetingIds.map(() => '?').join(',')})`
      meetingParams.push(...meetingIds)
    }
    if (taskIds.length > 0) {
      taskWhere += ` AND t.id IN (${taskIds.map(() => '?').join(',')})`
      taskParams.push(...taskIds)
    }
  } else {
    if (keyword) {
      meetingWhere += ' AND (m.title LIKE ? OR m.transcription LIKE ?)'
      meetingParams.push(`%${keyword}%`, `%${keyword}%`)
      taskWhere += ' AND (t.title LIKE ? OR t.description LIKE ?)'
      taskParams.push(`%${keyword}%`, `%${keyword}%`)
    }
    if (dateFrom) {
      meetingWhere += ' AND m.date >= ?'
      meetingParams.push(dateFrom)
      taskWhere += ' AND t.created_at >= ?'
      taskParams.push(dateFrom)
    }
    if (dateTo) {
      meetingWhere += ' AND m.date <= ?'
      meetingParams.push(dateTo)
      taskWhere += ' AND t.created_at <= ?'
      taskParams.push(dateTo)
    }
    if (assignee_id) {
      taskWhere += ' AND t.assignee_id = ?'
      taskParams.push(assignee_id)
    }
  }

  const meetings = db.prepare(`
    SELECT m.*, tm.name as team_name
    FROM meetings m
    LEFT JOIN teams tm ON m.team_id = tm.id
    ${meetingWhere}
    ORDER BY m.date DESC
  `).all(...meetingParams) as Record<string, unknown>[]

  const tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    ${taskWhere}
    ORDER BY t.created_at DESC
  `).all(...taskParams) as Record<string, unknown>[]

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Meeting Platform'
  workbook.created = new Date()

  if (meetings.length > 0) {
    const sheet = workbook.addWorksheet('会议')
    sheet.columns = [
      { header: '会议标题', key: 'title', width: 30 },
      { header: '日期', key: 'date', width: 20 },
      { header: '时长(分钟)', key: 'duration', width: 15 },
      { header: '状态', key: 'status', width: 15 },
      { header: '团队', key: 'team_name', width: 20 },
      { header: '纪要', key: 'transcription', width: 50 },
    ]
    meetings.forEach(m => sheet.addRow({
      title: m.title,
      date: m.date,
      duration: m.duration,
      status: m.status,
      team_name: m.team_name,
      transcription: (m.transcription as string || '').substring(0, 200),
    }))
  }

  if (tasks.length > 0) {
    const sheet = workbook.addWorksheet('待办')
    sheet.columns = [
      { header: '待办标题', key: 'title', width: 30 },
      { header: '描述', key: 'description', width: 40 },
      { header: '负责人', key: 'assignee_name', width: 15 },
      { header: '紧急度', key: 'urgency', width: 12 },
      { header: '状态', key: 'status', width: 12 },
      { header: '截止日期', key: 'deadline', width: 20 },
    ]
    tasks.forEach(t => sheet.addRow({
      title: t.title,
      description: t.description,
      assignee_name: t.assignee_name,
      urgency: t.urgency,
      status: t.status,
      deadline: t.deadline,
    }))
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="search-results.xlsx"')

  await workbook.xlsx.write(res)
  res.end()
})

export default router
