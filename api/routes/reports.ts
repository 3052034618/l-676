import { Router, type Request, type Response } from 'express'
import ExcelJS from 'exceljs'
import jsPDFModule from 'jspdf'
const jsPDF = (jsPDFModule as any).default || jsPDFModule
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
  const avgResponseHours = completedTasks.length > 0 ? Math.max(0, totalResponseHours / completedTasks.length) : 0

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

  const teams = data.teams as Record<string, unknown>[]
  const buckets = data.overdueDistribution as { range: string; count: number }[]
  const totalMeetings = data.totalMeetings as { cnt: number }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('Meeting Efficiency Report', pageW / 2, 25, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`Report Period: ${m}`, pageW / 2, 33, { align: 'center' })

  doc.setDrawColor(255, 107, 53)
  doc.setLineWidth(0.8)
  doc.line(20, 37, pageW - 20, 37)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Overview', 20, 47)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const metrics = [
    [`Total Meetings: ${totalMeetings.cnt}`, `Total Tasks: ${data.totalTasks}`],
    [`Completed: ${data.completedTasks}`, `Overdue: ${data.overdueTasks}`],
    [`Completion Rate: ${(data.overallCompletionRate * 100).toFixed(1)}%`, `Avg Response: ${data.overallAvgResponseTime.toFixed(1)}h`],
  ]
  let yPos = 54
  metrics.forEach(row => {
    doc.text(row[0], 25, yPos)
    doc.text(row[1], pageW / 2 + 5, yPos)
    yPos += 7
  })

  yPos += 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Team Comparison', 20, yPos)

  yPos += 8
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  const headers = ['Team', 'Completion', 'Avg Resp(h)', 'Meetings', 'Duration', 'Overdue']
  const colX = [20, 60, 90, 120, 145, 170]
  headers.forEach((h, i) => doc.text(h, colX[i], yPos))
  doc.setDrawColor(200, 200, 200)
  doc.line(20, yPos + 1, pageW - 20, yPos + 1)

  doc.setFont('helvetica', 'normal')
  yPos += 7
  teams.forEach(t => {
    if (yPos > 270) {
      doc.addPage()
      yPos = 20
    }
    const row = [
      String(t.team_name).substring(0, 12),
      `${((t.completion_rate as number) * 100).toFixed(1)}%`,
      (t.avg_response_hours as number).toFixed(1),
      String(t.total_meetings),
      `${t.total_duration}m`,
      String(t.overdue_count),
    ]
    row.forEach((cell, i) => doc.text(cell, colX[i], yPos))
    yPos += 6
  })

  yPos += 8
  if (yPos > 240) { doc.addPage(); yPos = 20 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Overdue Distribution', 20, yPos)

  yPos += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const maxCount = Math.max(...buckets.map(b => b.count), 1)
  buckets.forEach(b => {
    if (yPos > 270) { doc.addPage(); yPos = 20 }
    doc.text(`${b.range}: ${b.count}`, 25, yPos)
    const barW = (b.count / maxCount) * 80
    doc.setFillColor(255, 107, 53)
    doc.rect(70, yPos - 3.5, barW, 4, 'F')
    yPos += 8
  })

  yPos += 10
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(`Generated by Smart Meeting Platform at ${new Date().toLocaleString('zh-CN')}`, pageW / 2, yPos, { align: 'center' })

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="report-${m}.pdf"`)
  res.setHeader('Content-Length', pdfBuffer.length)
  res.send(pdfBuffer)
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
