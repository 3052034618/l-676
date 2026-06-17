import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import StatusBadge from '@/components/StatusBadge';

const statusTabs = [
  { key: 'all', label: '全部' },
  { key: 'recording', label: '录制中' },
  { key: 'transcribing', label: '转写中' },
  { key: 'completed', label: '已完成' },
];

export default function Meetings() {
  const navigate = useNavigate();
  const { meetings, meetingsTotal, loading, fetchMeetings, createMeeting } = useAppStore();
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', team_id: '', status: 'recording' });
  const pageSize = 10;

  useEffect(() => {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (activeTab !== 'all') params.status = activeTab;
    if (keyword) params.keyword = keyword;
    fetchMeetings(params);
  }, [page, activeTab, keyword, fetchMeetings]);

  const totalPages = Math.ceil(meetingsTotal / pageSize);

  const handleCreate = async () => {
    if (!form.title || !form.date) return;
    await createMeeting({
      title: form.title,
      date: form.date,
      team_id: form.team_id,
      status: form.status,
    });
    setShowCreate(false);
    setForm({ title: '', date: '', team_id: '', status: 'recording' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>会议管理</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> 新建会议
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className="px-3 py-1.5 rounded-md text-sm transition-colors"
              style={{
                backgroundColor: activeTab === tab.key ? 'var(--color-accent)' : 'transparent',
                color: activeTab === tab.key ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            value={keyword}
            onChange={e => { setKeyword(e.target.value); setPage(1); }}
            placeholder="搜索会议主题..."
            className="input-base w-full pl-9"
          />
        </div>
      </div>

      {loading.meetings ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-border-light)' }}>
                {['主题', '日期', '时长', '团队', '状态', '待办数', '操作'].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium" style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meetings.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>暂无会议数据</td></tr>
              ) : meetings.map(m => (
                <tr key={m.id} className="border-b transition-colors hover:bg-opacity-50" style={{ borderColor: 'var(--color-border-light)' }}>
                  <td className="py-3 px-4 font-medium" style={{ color: 'var(--color-text-primary)' }}>{m.title}</td>
                  <td className="py-3 px-4" style={{ color: 'var(--color-text-secondary)' }}>{m.date}</td>
                  <td className="py-3 px-4 font-mono-number" style={{ color: 'var(--color-text-secondary)' }}>{m.duration}分钟</td>
                  <td className="py-3 px-4" style={{ color: 'var(--color-text-secondary)' }}>{m.team_name ?? '-'}</td>
                  <td className="py-3 px-4"><StatusBadge type="meeting" status={m.status} /></td>
                  <td className="py-3 px-4 font-mono-number" style={{ color: 'var(--color-text-secondary)' }}>{m.task_count ?? 0}</td>
                  <td className="py-3 px-4">
                    <button onClick={() => navigate(`/meetings/${m.id}`)} className="flex items-center gap-1 text-sm" style={{ color: 'var(--color-accent)' }}>
                      <Eye size={14} /> 查看
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            共 {meetingsTotal} 条
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="card w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>新建会议</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>会议主题</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-base w-full" placeholder="输入会议主题" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>会议日期</label>
                <input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-base w-full" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>团队ID</label>
                <input value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))} className="input-base w-full" placeholder="输入团队标识" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>初始状态</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input-base w-full">
                  <option value="recording">录制中</option>
                  <option value="transcribing">转写中</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">取消</button>
              <button onClick={handleCreate} className="btn-primary" disabled={loading.createMeeting}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
