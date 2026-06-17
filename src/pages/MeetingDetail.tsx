import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CheckSquare, Paperclip, Upload, File } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { api } from '@/utils/api';
import StatusBadge from '@/components/StatusBadge';
import type { Meeting, Material } from '@/utils/api';

type TabKey = 'transcription' | 'tasks' | 'materials';

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchMeeting } = useAppStore();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('transcription');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchMeeting(id).then(m => {
      setMeeting(m);
      setMaterials(m.materials ?? []);
    }).finally(() => setLoading(false));
  }, [id, fetchMeeting]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    try {
      await api.meetings.uploadMaterial(id, file);
      const updated = await api.meetings.getMaterials(id);
      setMaterials(updated);
    } catch {}
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const tabs: { key: TabKey; label: string; icon: typeof FileText }[] = [
    { key: 'transcription', label: '纪要', icon: FileText },
    { key: 'tasks', label: '待办', icon: CheckSquare },
    { key: 'materials', label: '材料', icon: Paperclip },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!meeting) {
    return <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>会议不存在</div>;
  }

  const meetingTasks = meeting.tasks ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/meetings')} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>{meeting.title}</h1>
            <StatusBadge type="meeting" status={meeting.status} />
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {meeting.date} · {meeting.duration}分钟 · {meeting.team_name ?? '未指定团队'}
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        {tabs.map(({ key, label, icon: TabIcon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors"
            style={{
              backgroundColor: activeTab === key ? 'var(--color-accent)' : 'transparent',
              color: activeTab === key ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            <TabIcon size={16} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'transcription' && (
        <div className="card space-y-4">
          <h2 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>会议纪要</h2>
          {meeting.transcription ? (
            <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {meeting.transcription.split('\n').map((line, i) => {
                const isAction = line.startsWith('[待办]');
                return (
                  <p key={i} className={isAction ? 'font-medium' : ''} style={isAction ? { color: 'var(--color-accent)' } : {}}>
                    {line}
                  </p>
                );
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)' }}>纪要正在生成中...</p>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-2">
          {meetingTasks.length === 0 ? (
            <div className="card text-center py-8" style={{ color: 'var(--color-text-muted)' }}>暂无待办</div>
          ) : (
            meetingTasks.map(task => (
              <div key={task.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{task.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {task.assignee_name ?? '未指定'} · 截止: {task.deadline}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge type="urgency" status={task.urgency} />
                  <StatusBadge type="task" status={task.status} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>会议材料</h2>
            <button onClick={() => fileInputRef.current?.click()} className="btn-primary flex items-center gap-2 text-sm">
              <Upload size={14} /> 上传文件
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          </div>
          {materials.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>暂无上传材料</div>
          ) : (
            <div className="space-y-2">
              {materials.map(mat => (
                <div key={mat.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <File size={16} style={{ color: 'var(--color-text-muted)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{mat.filename}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {(mat.file_size / 1024).toFixed(1)}KB · {mat.created_at}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
