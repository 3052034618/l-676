import { useState, useEffect } from 'react';
import { X, User, Clock, AlertTriangle, Bell, ArrowUpCircle, BellRing, UserCheck, Building2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import StatusBadge from '@/components/StatusBadge';
import type { Task, Reminder } from '@/utils/api';

interface TaskDetailProps {
  task: Task;
  onClose: () => void;
}

const recipientLabels: Record<string, { label: string; icon: typeof User; color: string }> = {
  assignee: { label: '负责人', icon: User, color: 'var(--color-accent)' },
  supervisor: { label: '直属主管', icon: UserCheck, color: 'var(--color-warning)' },
  dept_head: { label: '部门负责人', icon: Building2, color: 'var(--color-danger)' },
};

export default function TaskDetail({ task, onClose }: TaskDetailProps) {
  const { remindTask, loading } = useAppStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getCountdown = (deadline: string) => {
    const diff = new Date(deadline).getTime() - now;
    if (diff <= 0) return { text: '已超时', overdue: true };
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    if (days > 0) return { text: `${days}天${remainHours}小时`, overdue: false };
    return { text: `${hours}小时`, overdue: false };
  };

  const countdown = getCountdown(task.deadline);
  const reminders = task.reminders ?? [];

  const getRecipientInfo = (r: Reminder) => {
    const type = r.recipient_type || 'assignee';
    return recipientLabels[type] || recipientLabels.assignee;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg h-full overflow-y-auto border-l"
        style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>任务详情</h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>{task.title}</h3>
              <StatusBadge type="task" status={task.status} />
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{task.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <User size={14} style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>负责人</span>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{task.assignee_name ?? '未指定'}</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>紧急度</span>
              </div>
              <StatusBadge type="urgency" status={task.urgency} />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>截止时间</span>
            </div>
            <p className="text-sm font-medium font-mono-number" style={{ color: countdown.overdue ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
              {task.deadline}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="badge"
                style={{
                  backgroundColor: countdown.overdue ? 'var(--color-danger-soft)' : 'var(--color-warning-soft)',
                  color: countdown.overdue ? 'var(--color-danger)' : 'var(--color-warning)',
                }}
              >
                剩余: {countdown.text}
              </span>
            </div>
            {task.calculated_deadline_reason && (
              <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {task.calculated_deadline_reason}
              </p>
            )}
          </div>

          {task.escalation_level > 0 && (
            <div className="card" style={{ borderLeftWidth: '3px', borderLeftColor: 'var(--color-warning)' }}>
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpCircle size={14} style={{ color: 'var(--color-warning)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--color-warning)' }}>升级状态</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                已升级至第 {task.escalation_level} 级
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell size={14} style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  提醒记录 ({task.remind_count})
                </span>
              </div>
              <button
                onClick={() => remindTask(task.id)}
                disabled={loading.remindTask}
                className="btn-primary flex items-center gap-2 text-sm py-1.5 px-3"
              >
                <BellRing size={14} /> 发送提醒
              </button>
            </div>
            {reminders.length > 0 ? (
              <div className="relative pl-6 space-y-3">
                <div className="absolute left-2 top-1 bottom-1 w-px" style={{ backgroundColor: 'var(--color-border)' }} />
                {reminders.map(r => {
                  const info = getRecipientInfo(r);
                  const RecIcon = info.icon;
                  return (
                    <div key={r.id} className="relative">
                      <div
                        className="absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full border-2"
                        style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: info.color }}
                      />
                      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        <RecIcon size={12} style={{ color: info.color }} />
                        <span className="font-medium" style={{ color: info.color }}>{info.label}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>→</span>
                        <span>{r.sent_to_name || r.sent_to}</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {r.type} · {r.sent_at}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>暂无提醒记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
