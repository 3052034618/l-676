import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'meeting.db')

interface PreparedStatement {
  get(...params: unknown[]): Record<string, unknown> | undefined
  all(...params: unknown[]): Record<string, unknown>[]
  run(...params: unknown[]): { changes: number; lastInsertRowid: number }
}

class DatabaseWrapper {
  private db: SqlJsDatabase | null = null
  private inTransaction = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  async init() {
    const SQL = await initSqlJs()

    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath)
      this.db = new SQL.Database(buffer)
    } else {
      this.db = new SQL.Database()
    }

    this.db.run('PRAGMA foreign_keys = ON')
  }

  private ensureDb(): SqlJsDatabase {
    if (!this.db) throw new Error('Database not initialized')
    return this.db
  }

  save() {
    const db = this.ensureDb()
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
  }

  private deferredSave() {
    if (this.inTransaction) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.save()
      this.saveTimer = null
    }, 500)
  }

  exec(sql: string) {
    const db = this.ensureDb()
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0)
    for (const stmt of statements) {
      db.run(stmt)
    }
    this.save()
  }

  prepare(sql: string): PreparedStatement {
    const wrapper = this
    return {
      get(...params: unknown[]): Record<string, unknown> | undefined {
        const db = wrapper.ensureDb()
        const stmt = db.prepare(sql)
        if (params.length > 0) stmt.bind(params)
        let result: Record<string, unknown> | undefined
        if (stmt.step()) {
          result = stmt.getAsObject() as Record<string, unknown>
        }
        stmt.free()
        return result
      },
      all(...params: unknown[]): Record<string, unknown>[] {
        const db = wrapper.ensureDb()
        const stmt = db.prepare(sql)
        if (params.length > 0) stmt.bind(params)
        const results: Record<string, unknown>[] = []
        while (stmt.step()) {
          results.push(stmt.getAsObject() as Record<string, unknown>)
        }
        stmt.free()
        return results
      },
      run(...params: unknown[]): { changes: number; lastInsertRowid: number } {
        const db = wrapper.ensureDb()
        const stmt = db.prepare(sql)
        if (params.length > 0) stmt.bind(params)
        stmt.step()
        const result = {
          changes: db.getRowsModified(),
          lastInsertRowid: 0,
        }
        stmt.free()
        wrapper.deferredSave()
        return result
      },
    }
  }

  transaction(fn: () => void): void {
    const db = this.ensureDb()
    this.inTransaction = true
    db.run('BEGIN TRANSACTION')
    try {
      fn()
      db.run('COMMIT')
      this.inTransaction = false
      this.save()
    } catch (e) {
      this.inTransaction = false
      try { db.run('ROLLBACK') } catch { /* already rolled back */ }
      throw e
    }
  }
}

const dbWrapper = new DatabaseWrapper()

export async function initDatabase() {
  await dbWrapper.init()

  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      leader_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'member',
      team_id TEXT,
      supervisor_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      duration INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'recording',
      transcription TEXT DEFAULT '',
      team_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      assignee_id TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      deadline TEXT NOT NULL,
      calculated_deadline_reason TEXT DEFAULT '',
      escalation_level INTEGER DEFAULT 0,
      remind_count INTEGER DEFAULT 0,
      last_reminded_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id),
      FOREIGN KEY (assignee_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id)
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      detail TEXT NOT NULL,
      operator_id TEXT,
      related_id TEXT,
      is_anomaly INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      team_id TEXT,
      completion_rate REAL DEFAULT 0,
      avg_response_hours REAL DEFAULT 0,
      total_meetings INTEGER DEFAULT 0,
      total_duration INTEGER DEFAULT 0,
      overdue_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (team_id) REFERENCES teams(id)
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL,
      sent_to TEXT NOT NULL,
      recipient_type TEXT NOT NULL DEFAULT 'assignee',
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );
  `)

  try {
    dbWrapper.exec(`
      CREATE INDEX IF NOT EXISTS idx_meetings_team ON meetings(team_id);
      CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
      CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date);
      CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_meeting ON tasks(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
      CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
      CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_logs_anomaly ON logs(is_anomaly);
      CREATE INDEX IF NOT EXISTS idx_materials_meeting ON materials(meeting_id);
    `)
  } catch { /* indexes may already exist */ }

  try {
    const cols = dbWrapper.prepare('PRAGMA table_info(reminders)').all() as { name: string }[]
    const hasRecipientType = cols.some(c => c.name === 'recipient_type')
    if (!hasRecipientType) {
      dbWrapper.exec(`ALTER TABLE reminders ADD COLUMN recipient_type TEXT NOT NULL DEFAULT 'assignee'`)
    }
  } catch { /* migration may fail on older schemas, ignore */ }

  seedData()
}

function seedData() {
  const count = dbWrapper.prepare('SELECT COUNT(*) as cnt FROM teams').get() as { cnt: number } | undefined
  if (count && count.cnt > 0) return

  const now = new Date()
  const fmt = (d: Date) => d.toISOString().replace('T', ' ').substring(0, 19)

  const teams = [
    { id: uuidv4(), name: '产品研发部' },
    { id: uuidv4(), name: '市场营销部' },
    { id: uuidv4(), name: '运营管理部' },
  ]

  dbWrapper.transaction(() => {
    teams.forEach(t => dbWrapper.prepare('INSERT INTO teams (id, name, leader_id, created_at) VALUES (?, ?, ?, ?)').run(t.id, t.name, null, fmt(now)))

    const users = [
      { id: uuidv4(), name: '张伟', email: 'zhangwei@example.com', role: 'admin', team_id: teams[0].id, supervisor_id: null as string | null },
      { id: uuidv4(), name: '李娜', email: 'lina@example.com', role: 'leader', team_id: teams[0].id, supervisor_id: null as string | null },
      { id: uuidv4(), name: '王强', email: 'wangqiang@example.com', role: 'supervisor', team_id: teams[1].id, supervisor_id: null as string | null },
      { id: uuidv4(), name: '刘芳', email: 'liufang@example.com', role: 'member', team_id: teams[0].id, supervisor_id: null as string | null },
      { id: uuidv4(), name: '陈明', email: 'chenming@example.com', role: 'member', team_id: teams[1].id, supervisor_id: null as string | null },
      { id: uuidv4(), name: '赵丽', email: 'zhaoli@example.com', role: 'supervisor', team_id: teams[2].id, supervisor_id: null as string | null },
    ]

    users[1].supervisor_id = users[0].id
    users[3].supervisor_id = users[1].id
    users[4].supervisor_id = users[2].id

    users.forEach(u => dbWrapper.prepare('INSERT INTO users (id, name, email, role, team_id, supervisor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(u.id, u.name, u.email, u.role, u.team_id, u.supervisor_id, fmt(now)))

    dbWrapper.prepare('UPDATE teams SET leader_id = ? WHERE id = ?').run(users[1].id, teams[0].id)
    dbWrapper.prepare('UPDATE teams SET leader_id = ? WHERE id = ?').run(users[2].id, teams[1].id)
    dbWrapper.prepare('UPDATE teams SET leader_id = ? WHERE id = ?').run(users[5].id, teams[2].id)

    const d = (daysAgo: number, hoursOffset = 0) => {
      const date = new Date(now)
      date.setDate(date.getDate() - daysAgo)
      date.setHours(date.getHours() + hoursOffset)
      return fmt(date)
    }
    const futureD = (daysAhead: number) => {
      const date = new Date(now)
      date.setDate(date.getDate() + daysAhead)
      return fmt(date)
    }

    const meetings = [
      { id: uuidv4(), title: 'Q3产品路线图评审', date: d(14), duration: 90, status: 'completed', transcription: '本次会议讨论了Q3产品路线图，确定三大方向：性能优化、新功能开发、用户体验提升。张伟负责性能优化方案，李娜负责新功能需求整理，刘芳负责用户调研。', team_id: teams[0].id },
      { id: uuidv4(), title: '新功能需求讨论会', date: d(10), duration: 60, status: 'completed', transcription: '讨论了新功能需求清单，优先级排序：1.智能推荐 2.数据看板 3.批量操作。王强负责市场调研，陈明负责竞品分析。', team_id: teams[0].id },
      { id: uuidv4(), title: '市场推广策略会', date: d(7), duration: 45, status: 'completed', transcription: '确定了下半年市场推广策略，重点放在社交媒体和内容营销。预算分配：线上60%，线下40%。', team_id: teams[1].id },
      { id: uuidv4(), title: '运营效率提升方案', date: d(5), duration: 60, status: 'completed', transcription: '分析了当前运营瓶颈，决定引入自动化工具提升效率。赵丽负责工具选型，预计一个月内完成评估。', team_id: teams[2].id },
      { id: uuidv4(), title: '用户体验优化评审', date: d(3), duration: 75, status: 'transcribing', transcription: '正在转写中...', team_id: teams[0].id },
      { id: uuidv4(), title: '竞品分析报告会', date: d(2), duration: 50, status: 'transcribing', transcription: '正在转写中...', team_id: teams[1].id },
      { id: uuidv4(), title: 'Q3季度复盘会', date: d(1), duration: 120, status: 'recording', transcription: '', team_id: teams[0].id },
      { id: uuidv4(), title: '品牌升级方案讨论', date: futureD(2), duration: 0, status: 'recording', transcription: '', team_id: teams[1].id },
      { id: uuidv4(), title: '技术架构升级评审', date: d(20), duration: 90, status: 'completed', transcription: '决定将核心服务迁移至微服务架构，分三个阶段实施。张伟负责架构设计，李娜负责进度跟踪。', team_id: teams[0].id },
      { id: uuidv4(), title: '客户满意度分析会', date: d(12), duration: 40, status: 'completed', transcription: '客户满意度调查显示，产品易用性和响应速度是主要改进方向。陈明负责整理改进清单。', team_id: teams[1].id },
    ]

    meetings.forEach(m => dbWrapper.prepare('INSERT INTO meetings (id, title, date, duration, status, transcription, team_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(m.id, m.title, m.date, m.duration, m.status, m.transcription, m.team_id, m.date, m.date))

    const tasks = [
      { meeting_id: meetings[0].id, title: '完成性能优化方案', description: '针对系统响应速度问题，制定详细优化方案，包括数据库查询优化、缓存策略调整等', assignee_id: users[0].id, urgency: 'high', status: 'completed', deadline: d(7), reason: '紧急度high，基准3天，历史平均响应时间调整+4天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: d(7, 6), created_at: d(14), updated_at: d(7, 6) },
      { meeting_id: meetings[0].id, title: '整理新功能需求清单', description: '汇总各业务线新功能需求，按优先级排序并输出需求文档', assignee_id: users[1].id, urgency: 'medium', status: 'completed', deadline: d(4), reason: '紧急度medium，基准5天，历史平均响应时间调整+0天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: d(5, 3), created_at: d(14), updated_at: d(5, 3) },
      { meeting_id: meetings[0].id, title: '完成用户调研报告', description: '对核心用户群进行深度调研，输出调研报告', assignee_id: users[3].id, urgency: 'medium', status: 'completed', deadline: d(2), reason: '紧急度medium，基准5天，历史平均响应时间调整-3天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: d(3, 8), created_at: d(14), updated_at: d(3, 8) },
      { meeting_id: meetings[1].id, title: '智能推荐功能原型设计', description: '设计智能推荐功能的交互原型和视觉方案', assignee_id: users[3].id, urgency: 'high', status: 'in_progress', deadline: futureD(3), reason: '紧急度high，基准3天，历史平均响应时间调整+0天', escalation: 0, remind: 1, last_reminded_at: d(1), completed_at: null, created_at: d(10), updated_at: d(1) },
      { meeting_id: meetings[1].id, title: '数据看板需求分析', description: '分析数据看板所需的数据指标和展示形式', assignee_id: users[0].id, urgency: 'medium', status: 'in_progress', deadline: futureD(5), reason: '紧急度medium，基准5天，历史平均响应时间调整+0天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: null, created_at: d(10), updated_at: d(2) },
      { meeting_id: meetings[2].id, title: '社交媒体推广方案', description: '制定下半年社交媒体推广计划，包括平台选择、内容规划、投放策略', assignee_id: users[4].id, urgency: 'high', status: 'in_progress', deadline: futureD(2), reason: '紧急度high，基准3天，历史平均响应时间调整-1天', escalation: 0, remind: 1, last_reminded_at: d(1), completed_at: null, created_at: d(7), updated_at: d(1) },
      { meeting_id: meetings[2].id, title: '内容营销选题策划', description: '策划Q3内容营销选题，输出内容日历', assignee_id: users[2].id, urgency: 'low', status: 'pending', deadline: futureD(7), reason: '紧急度low，基准7天，历史平均响应时间调整+0天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: null, created_at: d(7), updated_at: d(7) },
      { meeting_id: meetings[3].id, title: '自动化工具选型评估', description: '调研并评估3-5款自动化运营工具，输出对比报告', assignee_id: users[5].id, urgency: 'critical', status: 'overdue', deadline: d(1), reason: '紧急度critical，基准1天，历史平均响应时间调整+0天', escalation: 2, remind: 3, last_reminded_at: d(0), completed_at: null, created_at: d(5), updated_at: d(0) },
      { meeting_id: meetings[3].id, title: '运营流程梳理', description: '梳理当前运营流程，识别自动化改造机会点', assignee_id: users[5].id, urgency: 'high', status: 'overdue', deadline: d(2), reason: '紧急度high，基准3天，历史平均响应时间调整-1天', escalation: 1, remind: 2, last_reminded_at: d(0), completed_at: null, created_at: d(5), updated_at: d(0) },
      { meeting_id: meetings[4].id, title: 'UX改版方案设计', description: '根据用户反馈设计界面优化方案', assignee_id: users[3].id, urgency: 'high', status: 'pending', deadline: futureD(4), reason: '紧急度high，基准3天，历史平均响应时间调整+1天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: null, created_at: d(3), updated_at: d(3) },
      { meeting_id: meetings[4].id, title: '前端性能优化', description: '优化首屏加载速度和交互响应', assignee_id: users[0].id, urgency: 'critical', status: 'in_progress', deadline: futureD(1), reason: '紧急度critical，基准1天，历史平均响应时间调整+0天', escalation: 0, remind: 1, last_reminded_at: d(1), completed_at: null, created_at: d(3), updated_at: d(1) },
      { meeting_id: meetings[8].id, title: '微服务架构设计方案', description: '输出微服务架构设计文档，包括服务拆分、通信协议、部署方案', assignee_id: users[0].id, urgency: 'critical', status: 'completed', deadline: d(13), reason: '紧急度critical，基准1天，历史平均响应时间调整+0天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: d(14, 5), created_at: d(20), updated_at: d(14, 5) },
      { meeting_id: meetings[8].id, title: '迁移计划制定', description: '制定分阶段迁移计划，包括时间节点和风险评估', assignee_id: users[1].id, urgency: 'high', status: 'completed', deadline: d(10), reason: '紧急度high，基准3天，历史平均响应时间调整-2天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: d(12, 2), created_at: d(20), updated_at: d(12, 2) },
      { meeting_id: meetings[9].id, title: '客户满意度改进清单', description: '根据调研结果整理产品改进清单', assignee_id: users[4].id, urgency: 'medium', status: 'completed', deadline: d(5), reason: '紧急度medium，基准5天，历史平均响应时间调整-2天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: d(6, 4), created_at: d(12), updated_at: d(6, 4) },
      { meeting_id: meetings[5].id, title: '竞品功能对比分析', description: '对比主要竞品的核心功能差异', assignee_id: users[4].id, urgency: 'medium', status: 'pending', deadline: futureD(5), reason: '紧急度medium，基准5天，历史平均响应时间调整+0天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: null, created_at: d(2), updated_at: d(2) },
      { meeting_id: meetings[6].id, title: 'Q3复盘报告撰写', description: '汇总Q3各部门工作成果和问题', assignee_id: users[1].id, urgency: 'high', status: 'pending', deadline: futureD(3), reason: '紧急度high，基准3天，历史平均响应时间调整+0天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: null, created_at: d(1), updated_at: d(1) },
      { meeting_id: meetings[7].id, title: '品牌视觉升级方案', description: '设计新品牌视觉识别系统', assignee_id: users[2].id, urgency: 'low', status: 'pending', deadline: futureD(7), reason: '紧急度low，基准7天，历史平均响应时间调整+0天', escalation: 0, remind: 0, last_reminded_at: null, completed_at: null, created_at: futureD(2), updated_at: futureD(2) },
    ]

    tasks.forEach(t => {
      const id = uuidv4()
      dbWrapper.prepare('INSERT INTO tasks (id, meeting_id, title, description, assignee_id, urgency, status, deadline, calculated_deadline_reason, escalation_level, remind_count, last_reminded_at, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, t.meeting_id, t.title, t.description, t.assignee_id, t.urgency, t.status, t.deadline, t.reason, t.escalation, t.remind, t.last_reminded_at, t.completed_at, t.created_at, t.updated_at)
    })

    const materials = [
      { id: uuidv4(), meeting_id: meetings[0].id, filename: 'Q3产品路线图.pptx', file_type: 'pptx', file_path: 'uploads/q3-roadmap.pptx', file_size: 2048576 },
      { id: uuidv4(), meeting_id: meetings[0].id, filename: '需求优先级评估.pdf', file_type: 'pdf', file_path: 'uploads/priority-assessment.pdf', file_size: 1536000 },
      { id: uuidv4(), meeting_id: meetings[2].id, filename: '市场推广预算.docx', file_type: 'docx', file_path: 'uploads/marketing-budget.docx', file_size: 512000 },
      { id: uuidv4(), meeting_id: meetings[3].id, filename: '运营数据看板.jpg', file_type: 'jpg', file_path: 'uploads/ops-dashboard.jpg', file_size: 307200 },
      { id: uuidv4(), meeting_id: meetings[8].id, filename: '架构设计文档.pdf', file_type: 'pdf', file_path: 'uploads/arch-design.pdf', file_size: 4096000 },
      { id: uuidv4(), meeting_id: meetings[9].id, filename: '客户满意度报告.pdf', file_type: 'pdf', file_path: 'uploads/csat-report.pdf', file_size: 1024000 },
    ]

    materials.forEach(m => dbWrapper.prepare('INSERT INTO materials (id, meeting_id, filename, file_type, file_path, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(m.id, m.meeting_id, m.filename, m.file_type, m.file_path, m.file_size, fmt(now)))

    const logs = [
      { id: uuidv4(), type: 'recording', detail: 'Q3产品路线图评审会议开始录制', operator_id: users[0].id, related_id: meetings[0].id, is_anomaly: 0, created_at: d(14) },
      { id: uuidv4(), type: 'recording', detail: '新功能需求讨论会开始录制', operator_id: users[1].id, related_id: meetings[1].id, is_anomaly: 0, created_at: d(10) },
      { id: uuidv4(), type: 'task_assign', detail: '将"完成性能优化方案"分配给张伟', operator_id: users[1].id, related_id: null, is_anomaly: 0, created_at: d(14) },
      { id: uuidv4(), type: 'task_assign', detail: '将"智能推荐功能原型设计"分配给刘芳', operator_id: users[1].id, related_id: null, is_anomaly: 0, created_at: d(10) },
      { id: uuidv4(), type: 'remind', detail: '自动催办：自动化工具选型评估已超期1天', operator_id: users[5].id, related_id: null, is_anomaly: 0, created_at: d(0) },
      { id: uuidv4(), type: 'escalation', detail: '升级通知：自动化工具选型评估连续催办未处理，已上报主管', operator_id: users[5].id, related_id: null, is_anomaly: 1, created_at: d(0) },
      { id: uuidv4(), type: 'material_upload', detail: '张伟上传了Q3产品路线图.pptx', operator_id: users[0].id, related_id: meetings[0].id, is_anomaly: 0, created_at: d(14) },
      { id: uuidv4(), type: 'material_upload', detail: '王强上传了市场推广预算.docx', operator_id: users[2].id, related_id: meetings[2].id, is_anomaly: 0, created_at: d(7) },
      { id: uuidv4(), type: 'anomaly', detail: '异常检测：自动化工具选型评估超期3天仍未完成，催办3次均未响应', operator_id: null, related_id: null, is_anomaly: 1, created_at: d(0) },
      { id: uuidv4(), type: 'recording', detail: 'Q3季度复盘会开始录制', operator_id: users[0].id, related_id: meetings[6].id, is_anomaly: 0, created_at: d(1) },
      { id: uuidv4(), type: 'task_assign', detail: '将"运营流程梳理"分配给赵丽', operator_id: users[5].id, related_id: null, is_anomaly: 0, created_at: d(5) },
      { id: uuidv4(), type: 'remind', detail: '自动催办：运营流程梳理已超期1天', operator_id: users[5].id, related_id: null, is_anomaly: 0, created_at: d(1) },
    ]

    logs.forEach(l => dbWrapper.prepare('INSERT INTO logs (id, type, detail, operator_id, related_id, is_anomaly, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(l.id, l.type, l.detail, l.operator_id, l.related_id, l.is_anomaly, l.created_at))

    const currentMonth = now.toISOString().substring(0, 7)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7)

    const reports = [
      { id: uuidv4(), month: currentMonth, team_id: teams[0].id, completion_rate: 0.72, avg_response_hours: 18.5, total_meetings: 5, total_duration: 375, overdue_count: 0 },
      { id: uuidv4(), month: currentMonth, team_id: teams[1].id, completion_rate: 0.60, avg_response_hours: 24.0, total_meetings: 3, total_duration: 135, overdue_count: 1 },
      { id: uuidv4(), month: currentMonth, team_id: teams[2].id, completion_rate: 0.45, avg_response_hours: 36.0, total_meetings: 2, total_duration: 100, overdue_count: 2 },
      { id: uuidv4(), month: lastMonth, team_id: teams[0].id, completion_rate: 0.65, avg_response_hours: 22.0, total_meetings: 4, total_duration: 300, overdue_count: 1 },
      { id: uuidv4(), month: lastMonth, team_id: teams[1].id, completion_rate: 0.55, avg_response_hours: 28.0, total_meetings: 2, total_duration: 90, overdue_count: 2 },
      { id: uuidv4(), month: lastMonth, team_id: teams[2].id, completion_rate: 0.50, avg_response_hours: 32.0, total_meetings: 1, total_duration: 45, overdue_count: 1 },
    ]

    reports.forEach(r => dbWrapper.prepare('INSERT INTO reports (id, month, team_id, completion_rate, avg_response_hours, total_meetings, total_duration, overdue_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(r.id, r.month, r.team_id, r.completion_rate, r.avg_response_hours, r.total_meetings, r.total_duration, r.overdue_count, fmt(now)))
  })

  dbWrapper.save()
  console.log('Database initialized with seed data')
}

export default dbWrapper
