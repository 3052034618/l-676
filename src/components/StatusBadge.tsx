import { cn } from '@/lib/utils';

type BadgeType = 'meeting' | 'task' | 'urgency';

const meetingStatusMap: Record<string, { label: string; color: string; bg: string }> = {
  recording: { label: '录制中', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  transcribing: { label: '转写中', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  completed: { label: '已完成', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
};

const taskStatusMap: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待处理', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  in_progress: { label: '进行中', color: '#FF6B35', bg: 'rgba(255,107,53,0.15)' },
  completed: { label: '已完成', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  overdue: { label: '已超时', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

const urgencyMap: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: '低', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  medium: { label: '中', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  high: { label: '高', color: '#FF6B35', bg: 'rgba(255,107,53,0.15)' },
  critical: { label: '紧急', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

interface StatusBadgeProps {
  type: BadgeType;
  status: string;
  className?: string;
}

export default function StatusBadge({ type, status, className }: StatusBadgeProps) {
  const map = type === 'meeting' ? meetingStatusMap : type === 'task' ? taskStatusMap : urgencyMap;
  const config = map[status];

  if (!config) return null;

  return (
    <span
      className={cn('badge', className)}
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}
