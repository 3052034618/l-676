import { useEffect, useState } from 'react';
import { Filter, User, Clock, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import StatusBadge from '@/components/StatusBadge';
import TaskDetail from '@/pages/TaskDetail';
import type { Task } from '@/utils/api';

const columns = [
  { key: 'pending' as const, label: '待处理', color: '#94A3B8' },
  { key: 'in_progress' as const, label: '进行中', color: '#FF6B35' },
  { key: 'completed' as const, label: '已完成', color: '#10B981' },
  { key: 'overdue' as const, label: '已超时', color: '#EF4444' },
];

export default function Tasks() {
  const { tasks, fetchTasks, loading } = useAppStore();
  const [filterUrgency, setFilterUrgency] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const assignees = [...new Set(tasks.map(t => t.assignee_name).filter(Boolean))] as string[];

  const filtered = tasks.filter(t => {
    if (filterUrgency !== 'all' && t.urgency !== filterUrgency) return false;
    if (filterAssignee !== 'all' && t.assignee_name !== filterAssignee) return false;
    return true;
  });

  const grouped = columns.map(col => ({
    ...col,
    items: filtered.filter(t => t.status === col.key),
  }));

  const getCountdown = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return '已超时';
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}小时`;
    return `${Math.floor(hours / 24)}天`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>待办中心</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
            <select
              value={filterUrgency}
              onChange={e => setFilterUrgency(e.target.value)}
              className="input-base text-sm py-1.5"
            >
              <option value="all">全部紧急度</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="critical">紧急</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <User size={14} style={{ color: 'var(--color-text-muted)' }} />
            <select
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              className="input-base text-sm py-1.5"
            >
              <option value="all">全部负责人</option>
              {assignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading.tasks ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[500px]">
          {grouped.map(col => (
            <div key={col.key} className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{col.label}</span>
                <span className="badge" style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }}>
                  {col.items.length}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
                {col.items.length === 0 ? (
                  <div className="card text-center py-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>暂无任务</div>
                ) : (
                  col.items.map(task => (
                    <div
                      key={task.id}
                      className="card cursor-pointer transition-colors"
                      onClick={() => setSelectedTask(task)}
                      style={{ borderLeftWidth: '3px', borderLeftColor: col.color }}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium pr-2" style={{ color: 'var(--color-text-primary)' }}>{task.title}</p>
                        <StatusBadge type="urgency" status={task.urgency} />
                      </div>
                      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        <span className="flex items-center gap-1"><User size={12} /> {task.assignee_name ?? '未指定'}</span>
                        <span className="flex items-center gap-1" style={{ color: task.status === 'overdue' ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>
                          {task.status === 'overdue' ? <AlertTriangle size={12} /> : <Clock size={12} />}
                          {getCountdown(task.deadline)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTask && (
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
