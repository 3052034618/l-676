import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, User, Building2, Clock, BellRing, ChevronDown, ChevronUp, UserCheck, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import StatusBadge from '@/components/StatusBadge';
import type { OverdueTaskWithGovernance } from '@/utils/api';

const recipientLabels: Record<string, { label: string; icon: typeof User; color: string }> = {
  assignee: { label: '负责人', icon: User, color: 'var(--color-accent)' },
  supervisor: { label: '直属主管', icon: UserCheck, color: 'var(--color-warning)' },
  dept_head: { label: '部门负责人', icon: Building2, color: 'var(--color-danger)' },
};

export default function Governance() {
  const navigate = useNavigate();
  const { governanceStats, overdueTasks, overdueTasksTotal, overdueUsers, loading, fetchGovernanceStats, fetchOverdueTasks, fetchOverdueUsers } = useAppStore();
  const [teamFilter, setTeamFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    fetchGovernanceStats();
    fetchOverdueUsers();
  }, [fetchGovernanceStats, fetchOverdueUsers]);

  useEffect(() => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (teamFilter !== 'all') params.team_id = teamFilter;
    if (levelFilter !== 'all') params.escalation_level = levelFilter;
    if (assigneeFilter !== 'all') params.assignee_id = assigneeFilter;
    fetchOverdueTasks(params);
  }, [page, teamFilter, levelFilter, assigneeFilter, fetchOverdueTasks]);

  const handleFilterChange = () => {
    setPage(1);
  };

  useEffect(() => {
    handleFilterChange();
  }, [teamFilter, levelFilter, assigneeFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleRemind = (taskId: string) => {
    // 直接调用 task remind
  };

  const totalPages = Math.ceil(overdueTasksTotal / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>超时治理</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card flex items-start justify-between">
          <div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>超时待办总数</p>
            <p className="text-2xl font-bold font-mono-number mt-1" style={{ color: 'var(--color-danger)' }}>
              {governanceStats?.total_overdue ?? 0}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger)' }}>
            <AlertTriangle size={20} />
          </div>
        </div>
        <div className="card flex items-start justify-between">
          <div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>待催办</p>
            <p className="text-2xl font-bold font-mono-number mt-1" style={{ color: 'var(--color-warning)' }}>
              {governanceStats?.by_level?.[0] ?? 0}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)' }}>
            <BellRing size={20} />
          </div>
        </div>
        <div className="card flex items-start justify-between">
          <div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>已升级主管</p>
            <p className="text-2xl font-bold font-mono-number mt-1" style={{ color: '#8B5CF6' }}>
              {governanceStats?.by_level?.[1] ?? 0}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)', color: '#8B5CF6' }}>
            <UserCheck size={20} />
          </div>
        </div>
        <div className="card flex items-start justify-between">
          <div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>已升级部门</p>
            <p className="text-2xl font-bold font-mono-number mt-1" style={{ color: 'var(--color-danger)' }}>
              {governanceStats?.by_level?.[2] ?? 0}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--color-danger)' }}>
            <Building2 size={20} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>团队:</label>
            <select
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              className="input-base text-sm py-1.5 min-w-[120px]"
            >
              <option value="all">全部团队</option>
              {(governanceStats?.by_team ?? []).map(t => (
                <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>升级级别:</label>
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              className="input-base text-sm py-1.5 min-w-[120px]"
            >
              <option value="all">全部</option>
              <option value="0">待催办</option>
              <option value="1">已升级主管</option>
              <option value="2">已升级部门</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--color-text-muted)' }}>负责人:</label>
            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              className="input-base text-sm py-1.5 min-w-[120px]"
            >
              <option value="all">全部</option>
              {overdueUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.overdue_count}条)</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
          共 {overdueTasksTotal} 条超时待办
        </div>

        {loading.overdueTasks ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="space-y-2">
            {overdueTasks.map(task => (
              <div
                key={task.id}
                className="border rounded-lg overflow-hidden transition-all"
                style={{ borderColor: 'var(--color-border-light)' }}
              >
                <div
                  className="flex items-center gap-4 p-3 cursor-pointer hover:bg-opacity-30 transition-colors"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                  onClick={() => toggleExpand(task.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {task.title}
                      </span>
                      <StatusBadge type="urgency" status={task.urgency} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <span className="flex items-center gap-1">
                        <User size={12} /> {task.assignee_name}
                      </span>
                      <span>{task.team_name}</span>
                      <span>超期 {task.overdue_days} 天</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1">
                      {task.notified_recipients.length > 0 ? (
                        task.notified_recipients.map((r, i) => {
                          const info = recipientLabels[r.recipient_type] || recipientLabels.assignee;
                          const Icon = info.icon;
                          return (
                            <div
                              key={i}
                              className="w-7 h-7 rounded-full flex items-center justify-center border-2"
                              style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: info.color, color: info.color }}
                              title={info.label}
                            >
                              <Icon size={12} />
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>尚未催办</span>
                      )}
                    </div>
                    {expandedId === task.id ? <ChevronUp size={16} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />}
                  </div>
                </div>

                {expandedId === task.id && (
                  <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
                    <div className="pt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>截止日期</p>
                        <p className="font-mono-number" style={{ color: 'var(--color-danger)' }}>{task.deadline}</p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>催办次数</p>
                        <p className="font-mono-number" style={{ color: 'var(--color-text-primary)' }}>{task.remind_count} 次</p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>最近催办</p>
                        <p className="font-mono-number text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {task.last_remind_at || '尚未催办'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>下次检查</p>
                        <p className="font-mono-number text-xs" style={{ color: 'var(--color-accent)' }}>{task.next_check_at}</p>
                      </div>
                    </div>

                    {task.notified_recipients.length > 0 && (
                      <div>
                        <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>已通知对象</p>
                        <div className="space-y-1.5">
                          {task.notified_recipients.map((r, i) => {
                            const info = recipientLabels[r.recipient_type] || recipientLabels.assignee;
                            const Icon = info.icon;
                            return (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${info.color}20`, color: info.color }}>
                                  <Icon size={12} />
                                </div>
                                <span style={{ color: info.color }}>{info.label}</span>
                                <ArrowRight size={12} style={{ color: 'var(--color-text-muted)' }} />
                                <span style={{ color: 'var(--color-text-secondary)' }}>{r.sent_to_name}</span>
                                <span className="text-xs ml-auto font-mono-number" style={{ color: 'var(--color-text-muted)' }}>{r.sent_at}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>来源会议: {task.meeting_title || '-'}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${task.id}`); }}
                        className="btn-primary text-sm py-1.5 px-3"
                      >
                        查看详情
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {overdueTasks.length === 0 && (
              <div className="py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                暂无超时待办
              </div>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
