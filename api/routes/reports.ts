import { Router, type Request, type Response } from 'express'
import ExcelJS from 'exceljs'
import db from '../database.js'

const router = Router()

function getMonthlyData(month: string) {
  const teamReports = db.prepare(`
    SELECT r.*, t.name as team_name
    FROM reports r
    LEFT JOIN teams t ON r.team_id = t.id
    WHERE r.month = ?
    ORDER BY t.name
  `).all(month)

  const allTasks = db.prepare(`
    SELECT t.* FROM tasks t
    LEFT JOIN meetings m ON t.meeting_id = m.id
    WHERE strftime('%Y-%m', m.date) = ?
  `).all(month)

  const total = allTasks.length
  const completed = allTasks.filter((t: Record<string, unknown>) => t.status === 'completed').length
  const overdue = allTasks.filter((t: Record<string, unknown>) => t.status === 'overdue').length

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const actualOverdue = allTasks.filter((t: Record<string, unknown>) =>
    t.status !== 'completed' && (t.deadline as string) < now
  ).length

  const completedTasks = allTasks.filter((t: Record<string, unknown>) => t.status === 'completed')
  let totalResponseHours = 0
  completedTasks.forEach((t: Record<string, unknown>) => {
    if (t.completed_at && t.created_at) {
      const hours = (new Date(t.completed_at as string).getTime() - new Date(t.created_at as string).getTime()) / (1000 * 60 * 60)
      totalResponseHours += hours
    }
  })
  const avgResponseHours = completedTasks.length > 0 ? totalResponseHours / completedTasks.length : 0

  const overdueBuckets = [
    { range: '1-3天', count: 0 },
    { range: '3-7天', count: 0 },
    { range: '7-14天', count: 0 },
    { range: '14天以上', count: 0 },
  ]
  const overdueTasks = allTasks.filter((t: Record<string, unknown>) => t.status === 'overdue' || (t.status !== 'completed' && (t.deadline as string) < now))
  overdueTasks.forEach((t: Record<string, unknown>) => {
    const diffDays = (Date.now() - new Date(t.deadline as string).getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays <= 3) overdueBuckets[0].count++
    else if (diffDays <= 7) overdueBuckets[1].count++
    else if (diffDays <= 14) overdueBuckets[2].count++
    else overdueBuckets[3].count++
  })

  const currentMonthDate = new Date(month + '-01')
  const lastMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
    .toISOString().substring(0, 7)

  const lastTeamReports = db.prepare(`
    SELECT r.*, t.name as team_name
    FROM reports r
    LEFT JOIN teams t ON r.team_id = t.id
    WHERE r.month = ?
  `).all(lastMonth)

  const vsLastMonth: Record<string, unknown> = {}
  const lastMap = new Map(lastTeamReports.map((r: Record<string, unknown>) => [r.team_id, r]))
  teamReports.forEach((r: Record<string, unknown>) => {
    const last = lastMap.get(r.team_id) as Record<string, unknown> | undefined
    vsLastMonth[r.team_id as string] = {
      completion_rate_change: last ? (r.completion_rate as number) - (last.completion_rate as number) : 0,
      avg_response_hours_change: last ? (r.avg_response_hours as number) - (last.avg_response_hours as number) : 0,
      overdue_count_change: last ? (r.overdue_count as number) - (last.overdue_count as number) : 0,
    }
  })

  return {
    month,
    teams: teamReports,
    overallCompletionRate: total > 0 ? completed / total : 0,
    overallAvgResponseTime: avgResponseHours,
    overdueDistribution: overdueBuckets,
    totalMeetings: db.prepare(`SELECT COUNT(*) as cnt FROM meetings WHERE strftime('%Y-%m', date) = ?`).get(month) as { cnt: number },
    totalTasks: total,
    completedTasks: completed,
    overdueTasks: actualOverdue,
    vsLastMonth,
  }
}

router.get('/monthly', (req: Request, res: Response): void => {
  const { month } = req.query
  const m = (month as string) || new Date().toISOString().substring(0, 7)
  const data = getMonthlyData(m)
  res.json({ success: true, data })
})

router.get('/monthly/pdf', (req: Request, res: Response): void => {
  const { month } = req.query
  const m = (month as string) || new Date().toISOString().substring(0, 7)
  const data = getMonthlyData(m)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  const teams = data.teams as Record<string, unknown>[]
  const buckets = data.overdueDistribution as { range: string; count: number }[]
  const totalMeetings = data.totalMeetings as { cnt: number }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>会议效率分析报告 - ${m}</title>
<style>
body{font-family:"Noto Sans SC",sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1B2A4A}
h1{text-align:center;color:#1B2A4A;border-bottom:3px solid #FF6B35;padding-bottom:10px}
h2{color:#FF6B35;margin-top:30px}
.metric{display:inline-block;width:45%;margin:10px 2%;padding:15px;background:#f8f9fa;border-radius:8px;border-left:4px solid #FF6B35}
.metric .value{font-size:28px;font-weight:bold;font-family:"JetBrains Mono",monospace;color:#1B2A4A}
.metric .label{font-size:14px;color:#6b7280}
table{width:100%;border-collapse:collapse;margin:15px 0}
th{background:#1B2A4A;color:#fff;padding:10px;text-align:left}
td{padding:10px;border-bottom:1px solid #e5e7eb}
tr:hover{background:#f8f9fa}
.bar{display:inline-block;height:20px;background:#FF6B35;border-radius:3px;min-width:2px}
.footer{text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px}
@media print{body{margin:0;padding:20px}}
</style>
</head>
<body>
<h1>会议效率分析报告</h1>
<p style="text-align:center;color:#6b7280">报告期间：${m}</p>

<h2>总体概览</h2>
<div>
  <div class="metric"><div class="value">${totalMeetings.cnt}</div><div class="label">会议总数</div></div>
  <div class="metric"><div class="value">${data.totalTasks}</div><div class="label">待办总数</div></div>
  <div class="metric"><div class="value">${(data.overallCompletionRate * 100).toFixed(1)}%</div><div class="label">完成率</div></div>
  <div class="metric"><div class="value">${data.overallAvgResponseTime.toFixed(1)}h</div><div class="label">平均响应耗时</div></div>
  <div class="metric"><div class="value">${data.completedTasks}</div><div class="label">已完成</div></div>
  <div class="metric"><div class="value">${data.overdueTasks}</div><div class="label">超时数</div></div>
</div>

<h2>团队对比</h2>
<table>
<tr><th>团队</th><th>完成率</th><th>平均响应(h)</th><th>会议数</th><th>总时长(min)</th><th>超时数</th></tr>
${teams.map(t => `<tr><td>${t.team_name}</td><td>${((t.completion_rate as number) * 100).toFixed(1)}%</td><td>${(t.avg_response_hours as number).toFixed(1)}</td><td>${t.total_meetings}</td><td>${t.total_duration}</td><td>${t.overdue_count}</td></tr>`).join('')}
</table>

<h2>超时分布</h2>
<table>
<tr><th>超时范围</th><th>数量</th><th>分布</th></tr>
${buckets.map(b => {
    const maxCount = Math.max(...buckets.map(x => x.count), 1)
    return `<tr><td>${b.range}</td><td>${b.count}</td><td><span class="bar" style="width:${(b.count / maxCount * 200)}px"></span></td></tr>`
  }).join('')}
</table>

<div class="footer">智能会议管理平台 · 自动生成于 ${new Date().toLocaleString('zh-CN')}</div>
</body>
</html>`

  res.send(html)
})

router.get('/monthly/excel', async (req: Request, res: Response): Promise<void> => {
  const { month } = req.query
  const m = (month as string) || new Date().toISOString().substring(0, 7)
  const data = getMonthlyData(m)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Meeting Platform'
  workbook.created = new Date()

  const summarySheet = workbook.addWorksheet('总体概览')
  summarySheet.columns = [
    { header: '指标', key: 'metric', width: 25 },
    { header: '数值', key: 'value', width: 20 },
  ]
  summarySheet.addRow({ metric: '报告月份', value: m })
  summarySheet.addRow({ metric: '会议总数', value: (data.totalMeetings as { cnt: number }).cnt })
  summarySheet.addRow({ metric: '待办总数', value: data.totalTasks })
  summarySheet.addRow({ metric: '已完成', value: data.completedTasks })
  summarySheet.addRow({ metric: '超时数', value: data.overdueTasks })
  summarySheet.addRow({ metric: '完成率', value: `${(data.overallCompletionRate * 100).toFixed(1)}%` })
  summarySheet.addRow({ metric: '平均响应耗时', value: `${data.overallAvgResponseTime.toFixed(1)}h` })

  const teamSheet = workbook.addWorksheet('团队对比')
  teamSheet.columns = [
    { header: '团队', key: 'team', width: 20 },
    { header: '完成率', key: 'completion_rate', width: 18 },
    { header: '平均响应(h)', key: 'avg_response', width: 18 },
    { header: '会议数', key: 'total_meetings', width: 12 },
    { header: '总时长(min)', key: 'total_duration', width: 15 },
    { header: '超时数', key: 'overdue_count', width: 12 },
  ]
  const teams = data.teams as Record<string, unknown>[]
  teams.forEach(t => {
    teamSheet.addRow({
      team: t.team_name,
      completion_rate: `${((t.completion_rate as number) * 100).toFixed(1)}%`,
      avg_response: (t.avg_response_hours as number).toFixed(1),
      total_meetings: t.total_meetings,
      total_duration: t.total_duration,
      overdue_count: t.overdue_count,
    })
  })

  const overdueSheet = workbook.addWorksheet('超时分布')
  overdueSheet.columns = [
    { header: '超时范围', key: 'range', width: 20 },
    { header: '数量', key: 'count', width: 12 },
  ]
  const buckets = data.overdueDistribution as { range: string; count: number }[]
  buckets.forEach(b => overdueSheet.addRow(b))

  const trendSheet = workbook.addWorksheet('环比趋势')
  trendSheet.columns = [
    { header: '团队ID', key: 'team_id', width: 36 },
    { header: '完成率变化', key: 'cr_change', width: 20 },
    { header: '响应时间变化(h)', key: 'ar_change', width: 20 },
    { header: '超时数变化', key: 'oc_change', width: 15 },
  ]
  const vsData = data.vsLastMonth as Record<string, Record<string, number>>
  Object.entries(vsData).forEach(([teamId, changes]) => {
    trendSheet.addRow({
      team_id: teamId,
      cr_change: `${(changes.completion_rate_change * 100).toFixed(1)}%`,
      ar_change: changes.avg_response_hours_change.toFixed(1),
      oc_change: changes.overdue_count_change,
    })
  })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="report-${m}.xlsx"`)

  await workbook.xlsx.write(res)
  res.end()
})

export default router
