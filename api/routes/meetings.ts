import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import db from '../database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, '..', 'uploads')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const ALLOWED_TYPES = ['ppt', 'pptx', 'pdf', 'jpg', 'png', 'doc', 'docx']

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '')
    if (ALLOWED_TYPES.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`不支持的文件格式，允许的类型：${ALLOWED_TYPES.join(', ')}`))
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 },
})

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { status, team_id, page = '1', pageSize = '10' } = req.query
  const pageNum = Math.max(1, parseInt(page as string) || 1)
  const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize as string) || 10))
  const offset = (pageNum - 1) * pageSizeNum

  let where = 'WHERE 1=1'
  const params: unknown[] = []

  if (status) {
    where += ' AND m.status = ?'
    params.push(status)
  }
  if (team_id) {
    where += ' AND m.team_id = ?'
    params.push(team_id)
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM meetings m ${where}`).get(...params) as { total: number }
  const rows = db.prepare(`
    SELECT m.*, t.name as team_name
    FROM meetings m
    LEFT JOIN teams t ON m.team_id = t.id
    ${where}
    ORDER BY m.date DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSizeNum, offset) as Record<string, unknown>[]

  const taskCounts = db.prepare(`
    SELECT meeting_id, COUNT(*) as task_count FROM tasks GROUP BY meeting_id
  `).all() as { meeting_id: string; task_count: number }[]
  const taskMap = new Map(taskCounts.map(r => [r.meeting_id, r.task_count]))

  const meetings = rows.map(r => ({
    ...r,
    task_count: taskMap.get(r.id as string) || 0,
  }))

  res.json({
    success: true,
    data: { items: meetings, total: countRow.total, page: pageNum, pageSize: pageSizeNum },
  })
})

router.get('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const meeting = db.prepare(`
    SELECT m.*, t.name as team_name
    FROM meetings m
    LEFT JOIN teams t ON m.team_id = t.id
    WHERE m.id = ?
  `).get(id) as Record<string, unknown> | undefined

  if (!meeting) {
    res.status(404).json({ success: false, error: '会议不存在' })
    return
  }

  const tasks = db.prepare('SELECT * FROM tasks WHERE meeting_id = ?').all(id)
  const materials = db.prepare('SELECT * FROM materials WHERE meeting_id = ?').all(id)

  res.json({ success: true, data: { ...meeting, tasks, materials } })
})

router.post('/', (req: Request, res: Response): void => {
  const { title, date, duration, status, transcription, team_id } = req.body
  if (!title || !date) {
    res.status(400).json({ success: false, error: '标题和日期为必填项' })
    return
  }

  const id = uuidv4()
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  db.prepare(`
    INSERT INTO meetings (id, title, date, duration, status, transcription, team_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, date, duration || 0, status || 'recording', transcription || '', team_id || null, now, now)

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id)

  if (team_id) {
    const logId = uuidv4()
    db.prepare('INSERT INTO logs (id, type, detail, operator_id, related_id, is_anomaly, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(logId, 'recording', `创建会议：${title}`, null, id, 0, now)
  }

  res.status(201).json({ success: true, data: meeting })
})

router.put('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ success: false, error: '会议不存在' })
    return
  }

  const { title, date, duration, status, transcription, team_id } = req.body
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

  db.prepare(`
    UPDATE meetings SET title=?, date=?, duration=?, status=?, transcription=?, team_id=?, updated_at=?
    WHERE id=?
  `).run(
    title ?? existing.title,
    date ?? existing.date,
    duration ?? existing.duration,
    status ?? existing.status,
    transcription ?? existing.transcription,
    team_id ?? existing.team_id,
    now,
    id,
  )

  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id)
  res.json({ success: true, data: meeting })
})

router.delete('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id)
  if (!existing) {
    res.status(404).json({ success: false, error: '会议不存在' })
    return
  }

  const delMaterials = db.prepare('SELECT file_path FROM materials WHERE meeting_id = ?').all(id) as { file_path: string }[]
  delMaterials.forEach(m => {
    const fp = path.join(__dirname, '..', m.file_path)
    if (fs.existsSync(fp)) fs.unlinkSync(fp)
  })

  db.prepare('DELETE FROM materials WHERE meeting_id = ?').run(id)
  db.prepare('DELETE FROM tasks WHERE meeting_id = ?').run(id)
  db.prepare('DELETE FROM meetings WHERE id = ?').run(id)

  res.json({ success: true, message: '已删除' })
})

router.post('/:id/materials', upload.single('file'), (req: Request, res: Response): void => {
  const { id } = req.params
  const meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id)
  if (!meeting) {
    res.status(404).json({ success: false, error: '会议不存在' })
    return
  }

  if (!req.file) {
    res.status(400).json({ success: false, error: '请上传文件' })
    return
  }

  const materialId = uuidv4()
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '')
  const relativePath = `uploads/${req.file.filename}`

  db.prepare(`
    INSERT INTO materials (id, meeting_id, filename, file_type, file_path, file_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(materialId, id, req.file.originalname, ext, relativePath, req.file.size, now)

  const logId = uuidv4()
  db.prepare('INSERT INTO logs (id, type, detail, operator_id, related_id, is_anomaly, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(logId, 'material_upload', `上传材料：${req.file.originalname}`, null, id, 0, now)

  const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId)
  res.status(201).json({ success: true, data: material })
})

router.get('/:id/materials', (req: Request, res: Response): void => {
  const { id } = req.params
  const materials = db.prepare('SELECT * FROM materials WHERE meeting_id = ? ORDER BY created_at DESC').all(id)
  res.json({ success: true, data: materials })
})

export default router
