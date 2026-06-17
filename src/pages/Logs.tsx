import { useEffect, useState } from 'react';
import { AlertCircle, Video, CheckSquare, Upload, Bell, ArrowUpCircle, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

const typeFilters = [
  { key: 'all', label: '全部', icon: Settings },
  { key: 'recording', label: '录制', icon: Video },
  { key: 'task_assign', label: '任务分配', icon: CheckSquare },
  { key: 'remind', label: '提醒', icon: Bell },
  { key: 'escalation', label: '升级', icon: ArrowUpCircle },
  { key: 'material_upload', label: '材料', icon: Upload },
  { key: 'anomaly', label: '异常', icon: AlertCircle },
];

const typeIcons: Record<string, typeof Video> = {
  recording: Video,
  task_assign: CheckSquare,
  remind: Bell,
  escalation: ArrowUpCircle,
  material_upload: Upload,
  anomaly: AlertCircle,
};

const typeLabels: Record<string, string> = {
  recording: '录制',
  task_assign: '任务分配',
  remind: '提醒',
  escalation: '升级',
  material_upload: '材料上传',
  anomaly: '异常',
};

export default function Logs() {
  const { logs, logsTotal, loading, fetchLogs } = useAppStore();
  const [activeType, setActiveType] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (activeType !== 'all') params.type = activeType;
    fetchLogs(params);
  }, [page, activeType, fetchLogs]);

  const totalPages = Math.ceil(logsTotal / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>操作日志</h1>
      </div>

      <div className="flex gap-1 p-1 rounded-lg flex-wrap" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        {typeFilters.map(({ key, label, icon: TypeIcon }) => (
          <button
            key={key}
            onClick={() => { setActiveType(key); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
            style={{
              backgroundColor: activeType === key ? 'var(--color-accent)' : 'transparent',
              color: activeType === key ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            <TypeIcon size={14} /> {label}
          </button>
        ))}
      </div>

      {loading.logs ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>暂无日志</div>
      ) : (
        <div className="relative pl-8 space-y-4">
          <div className="absolute left-3 top-2 bottom-2 w-px" style={{ backgroundColor: 'var(--color-border)' }} />

          {logs.map(log => {
            const LogIcon = typeIcons[log.type] || Settings;
            const isAnomaly = log.is_anomaly === 1;
            return (
              <div key={log.id} className="relative">
                <div
                  className="absolute -left-[22px] top-2 w-3 h-3 rounded-full border-2"
                  style={{
                    backgroundColor: isAnomaly ? 'var(--color-danger)' : 'var(--color-bg-primary)',
                    borderColor: isAnomaly ? 'var(--color-danger)' : 'var(--color-border)',
                  }}
                />

                <div
                  className="card"
                  style={isAnomaly ? { borderLeftWidth: '3px', borderLeftColor: 'var(--color-danger)' } : {}}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <LogIcon size={14} style={{ color: isAnomaly ? 'var(--color-danger)' : 'var(--color-text-muted)' }} />
                      <span className="text-sm font-medium" style={{ color: isAnomaly ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                        {typeLabels[log.type] ?? log.type}
                      </span>
                      {isAnomaly && (
                        <span className="badge" style={{ backgroundColor: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}>
                          异常
                        </span>
                      )}
                    </div>
                    <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>{log.created_at}</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{log.detail}</p>
                  {log.operator_name && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>操作人: {log.operator_name}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            共 {logsTotal} 条
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary p-2 disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-mono-number" style={{ color: 'var(--color-text-secondary)' }}>{page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary p-2 disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
