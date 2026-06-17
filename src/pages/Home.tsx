import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, CheckSquare, TrendingUp, AlertTriangle, Plus, ArrowRight, Clock } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';

export default function Home() {
  const navigate = useNavigate();
  const { stats, loading, fetchStats } = useAppStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading.stats && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const recentMeetings = stats?.recentMeetings ?? [];
  const overdueTasks = stats?.overdueTasksList ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>工作台</h1>
        <button onClick={() => navigate('/meetings')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> 新建会议
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Video} value={stats?.weekMeetings ?? 0} label="本周会议" iconColor="var(--color-accent)" />
        <StatCard icon={CheckSquare} value={stats?.totalTasks ?? 0} label="待办总数" iconColor="#8B5CF6" />
        <StatCard icon={TrendingUp} value={`${stats?.completionRate ?? 0}%`} label="完成率" iconColor="var(--color-success)" />
        <StatCard icon={AlertTriangle} value={`${stats?.overdueRate ?? 0}%`} label="超时率" iconColor="var(--color-danger)" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>近期会议</h2>
          <button onClick={() => navigate('/meetings')} className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-accent)' }}>
            查看全部 <ArrowRight size={14} />
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {recentMeetings.length === 0 ? (
            <div className="card w-full text-center py-8" style={{ color: 'var(--color-text-muted)' }}>暂无会议数据</div>
          ) : (
            recentMeetings.map(m => (
              <div
                key={m.id}
                className="card-hover shrink-0 w-64 cursor-pointer"
                onClick={() => navigate(`/meetings/${m.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{m.title}</h3>
                  <StatusBadge type="meeting" status={m.status} />
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="flex items-center gap-1"><Clock size={12} /> {m.date}</span>
                  <span>{m.duration}分钟</span>
                </div>
                <div className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {m.task_count ?? 0} 个待办
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {overdueTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
            <h2 className="text-base font-medium" style={{ color: 'var(--color-danger)' }}>超时待办提醒</h2>
          </div>
          <div className="space-y-2">
            {overdueTasks.slice(0, 5).map(t => (
              <div
                key={t.id}
                className="card flex items-center justify-between cursor-pointer"
                onClick={() => navigate(`/tasks?id=${t.id}`)}
                style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--color-danger)' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{t.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    负责人: {t.assignee_name ?? '未指定'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge type="task" status="overdue" />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                    截止: {t.deadline}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-base font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>快捷操作</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Video, label: '新建会议', color: 'var(--color-accent)', onClick: () => navigate('/meetings') },
            { icon: CheckSquare, label: '查看待办', color: '#8B5CF6', onClick: () => navigate('/tasks') },
            { icon: TrendingUp, label: '效率报告', color: 'var(--color-success)', onClick: () => navigate('/reports') },
            { icon: Clock, label: '历史查询', color: 'var(--color-warning)', onClick: () => navigate('/search') },
          ].map(({ icon: BtnIcon, label, color, onClick }) => (
            <button key={label} onClick={onClick} className="card flex flex-col items-center gap-2 py-4 transition-colors" style={{ color }}>
              <BtnIcon size={24} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
