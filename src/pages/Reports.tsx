import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { Download, TrendingUp, TrendingDown, Users, CheckCircle, AlertTriangle, Video, ArrowLeft, Clock, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/utils/api';
import type { TeamReport } from '@/utils/api';
import StatusBadge from '@/components/StatusBadge';

export default function Reports() {
  const { reportData, teamDrillData, loading, fetchReport, fetchTeamDrill, clearTeamDrill } = useAppStore();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeDrillTab, setActiveDrillTab] = useState<'tasks' | 'meetings'>('tasks');

  useEffect(() => {
    fetchReport(month);
  }, [month, fetchReport]);

  const handleTeamClick = (team: TeamReport) => {
    fetchTeamDrill(team.team_id, month);
  };

  const handleBack = () => {
    clearTeamDrill();
  };

  const metrics = [
    { label: '总会议数', value: String(reportData?.totalMeetings?.cnt ?? 0), icon: Video, color: 'var(--color-accent)' },
    { label: '任务完成率', value: `${((reportData?.overallCompletionRate ?? 0) * 100).toFixed(1)}%`, icon: CheckCircle, color: 'var(--color-success)' },
    { label: '平均响应时间', value: `${(reportData?.overallAvgResponseTime ?? 0).toFixed(1)}h`, icon: Clock, color: '#8B5CF6' },
    { label: '超时任务数', value: String(reportData?.overdueTasks ?? 0), icon: AlertTriangle, color: 'var(--color-danger)' },
  ];

  const darkTheme = {
    textStyle: { color: '#94A3B8' },
    legend: { textStyle: { color: '#94A3B8' } },
    tooltip: { backgroundColor: '#243556', borderColor: '#334B73', textStyle: { color: '#F1F5F9' } },
  };

  const getVsTrend = (team: TeamReport, field: 'completion_rate_change' | 'avg_response_hours_change' | 'overdue_count_change') => {
    const vs = reportData?.vsLastMonth?.[team.team_id];
    return vs ? vs[field] : 0;
  };

  if (teamDrillData) {
    const s = teamDrillData.summary;
    const drillMetrics = [
      { label: '会议数', value: String(s.total_meetings), icon: Video, color: 'var(--color-accent)' },
      { label: '完成率', value: `${(s.completion_rate * 100).toFixed(1)}%`, icon: CheckCircle, color: 'var(--color-success)' },
      { label: '平均响应', value: `${s.avg_response_hours.toFixed(1)}h`, icon: Clock, color: '#8B5CF6' },
      { label: '超时待办', value: String(s.overdue_tasks), icon: AlertTriangle, color: 'var(--color-danger)' },
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-2 rounded-lg hover:bg-opacity-50 transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>{teamDrillData.team.name}</h1>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{teamDrillData.month} 月度效率明细</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="month" value={month} onChange={e => { setMonth(e.target.value); fetchTeamDrill(teamDrillData.team.id, e.target.value); }} className="input-base text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {drillMetrics.map(m => (
            <div key={m.label} className="card flex items-start justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{m.label}</p>
                <p className="text-2xl font-bold font-mono-number mt-1" style={{ color: 'var(--color-text-primary)' }}>{m.value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${m.color}20`, color: m.color }}>
                <m.icon size={20} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
            <button
              onClick={() => setActiveDrillTab('tasks')}
              className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
              style={{
                color: activeDrillTab === 'tasks' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                borderColor: activeDrillTab === 'tasks' ? 'var(--color-accent)' : 'transparent',
              }}
            >
              待办明细 ({teamDrillData.tasks.length})
            </button>
            <button
              onClick={() => setActiveDrillTab('meetings')}
              className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
              style={{
                color: activeDrillTab === 'meetings' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                borderColor: activeDrillTab === 'meetings' ? 'var(--color-accent)' : 'transparent',
              }}
            >
              会议明细 ({teamDrillData.meetings.length})
            </button>
          </div>

          {activeDrillTab === 'tasks' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--color-border-light)' }}>
                    {['待办标题', '负责人', '状态', '紧急度', '截止日期', '响应耗时', '来源会议', ''].map(h => (
                      <th key={h} className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamDrillData.tasks.map(t => (
                    <tr key={t.id} className="border-b hover:bg-opacity-30 transition-colors" style={{ borderColor: 'var(--color-border-light)' }}>
                      <td className="py-2 px-3" style={{ color: 'var(--color-text-primary)' }}>{t.title}</td>
                      <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>{t.assignee_name || '-'}</td>
                      <td className="py-2 px-3"><StatusBadge type="task" status={t.status} /></td>
                      <td className="py-2 px-3"><StatusBadge type="urgency" status={t.urgency} /></td>
                      <td className="py-2 px-3 font-mono-number" style={{ color: t.is_overdue ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>{t.deadline}</td>
                      <td className="py-2 px-3 font-mono-number" style={{ color: 'var(--color-text-secondary)' }}>
                        {t.response_hours !== null ? `${t.response_hours.toFixed(1)}h` : '-'}
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--color-text-muted)' }}>{t.meeting_title || '-'}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => navigate(`/tasks/${t.id}`)}
                          className="text-xs flex items-center gap-1 ml-auto"
                          style={{ color: 'var(--color-accent)' }}
                        >
                          <ExternalLink size={12} /> 查看
                        </button>
                      </td>
                    </tr>
                  ))}
                  {teamDrillData.tasks.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>暂无待办数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeDrillTab === 'meetings' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--color-border-light)' }}>
                    {['会议标题', '日期', '时长', '状态', ''].map(h => (
                      <th key={h} className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamDrillData.meetings.map(m => (
                    <tr key={m.id} className="border-b hover:bg-opacity-30 transition-colors" style={{ borderColor: 'var(--color-border-light)' }}>
                      <td className="py-2 px-3" style={{ color: 'var(--color-text-primary)' }}>{m.title}</td>
                      <td className="py-2 px-3 font-mono-number" style={{ color: 'var(--color-text-secondary)' }}>{m.date}</td>
                      <td className="py-2 px-3 font-mono-number" style={{ color: 'var(--color-text-secondary)' }}>{m.duration}分钟</td>
                      <td className="py-2 px-3"><StatusBadge type="meeting" status={m.status} /></td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => navigate(`/meetings/${m.id}`)}
                          className="text-xs flex items-center gap-1 ml-auto"
                          style={{ color: 'var(--color-accent)' }}
                        >
                          <ExternalLink size={12} /> 查看
                        </button>
                      </td>
                    </tr>
                  ))}
                  {teamDrillData.meetings.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>暂无会议数据</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>效率报告</h1>
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-base text-sm" />
          <a href={api.reports.exportPdfUrl(month)} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> PDF
          </a>
          <a href={api.reports.exportExcelUrl(month)} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Excel
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="card flex items-start justify-between">
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{m.label}</p>
              <p className="text-2xl font-bold font-mono-number mt-1" style={{ color: 'var(--color-text-primary)' }}>{m.value}</p>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${m.color}20`, color: m.color }}>
              <m.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {loading.report ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>团队完成率对比</h3>
              <ReactECharts
                option={{
                  ...darkTheme,
                  tooltip: { ...darkTheme.tooltip, trigger: 'axis' },
                  legend: { ...darkTheme.legend, data: ['完成率', '超时数'] },
                  xAxis: { type: 'category', data: reportData?.teams.map(t => t.team_name) ?? [], axisLabel: { color: '#94A3B8' } },
                  yAxis: { type: 'value', axisLabel: { color: '#94A3B8' }, splitLine: { lineStyle: { color: '#334B73' } } },
                  series: [
                    { name: '完成率', type: 'bar', data: reportData?.teams.map(t => (t.completion_rate * 100).toFixed(1)) ?? [], itemStyle: { color: '#10B981' } },
                    { name: '超时数', type: 'bar', data: reportData?.teams.map(t => t.overdue_count) ?? [], itemStyle: { color: '#EF4444' } },
                  ],
                }}
                style={{ height: 280 }}
              />
            </div>

            <div className="card">
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>超时分布</h3>
              <ReactECharts
                option={{
                  ...darkTheme,
                  tooltip: { ...darkTheme.tooltip, trigger: 'item' },
                  series: [{
                    type: 'pie',
                    radius: ['40%', '70%'],
                    data: reportData?.overdueDistribution?.map(d => ({ name: d.range, value: d.count })) ?? [{ name: '暂无数据', value: 0 }],
                    label: { color: '#94A3B8' },
                    itemStyle: { borderColor: '#1E3054', borderWidth: 2 },
                    color: ['#FF6B35', '#EF4444', '#F59E0B', '#8B5CF6', '#10B981'],
                  }],
                }}
                style={{ height: 280 }}
              />
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
              <Users size={16} /> 团队对比详情
              <span className="text-xs ml-2 font-normal" style={{ color: 'var(--color-text-muted)' }}>点击团队查看明细</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--color-border-light)' }}>
                    {['团队', '会议数', '总时长', '完成率', '平均响应', '超时数', '环比'].map(h => (
                      <th key={h} className="text-left py-2 px-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(reportData?.teams ?? []).map(t => {
                    const completionChange = getVsTrend(t, 'completion_rate_change');
                    const CompIcon = completionChange >= 0 ? TrendingUp : TrendingDown;
                    return (
                      <tr
                        key={t.team_id}
                        className="border-b cursor-pointer hover:bg-opacity-50 transition-colors"
                        style={{ borderColor: 'var(--color-border-light)' }}
                        onClick={() => handleTeamClick(t)}
                      >
                        <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-accent)' }}>
                          <span className="hover:underline">{t.team_name}</span>
                        </td>
                        <td className="py-2 px-3 font-mono-number" style={{ color: 'var(--color-text-secondary)' }}>{t.total_meetings}</td>
                        <td className="py-2 px-3 font-mono-number" style={{ color: 'var(--color-text-secondary)' }}>{t.total_duration}分钟</td>
                        <td className="py-2 px-3 font-mono-number" style={{ color: t.completion_rate >= 0.8 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                          {(t.completion_rate * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 font-mono-number" style={{ color: 'var(--color-text-secondary)' }}>{t.avg_response_hours.toFixed(1)}h</td>
                        <td className="py-2 px-3 font-mono-number" style={{ color: t.overdue_count > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                          {t.overdue_count}
                        </td>
                        <td className="py-2 px-3">
                          <span className="flex items-center gap-1 text-xs" style={{ color: completionChange >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            <CompIcon size={12} /> {completionChange >= 0 ? '+' : ''}{(completionChange * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
