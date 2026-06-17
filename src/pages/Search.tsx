import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, User, Video, CheckSquare, Download } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import StatusBadge from '@/components/StatusBadge';
import type { Meeting, Task } from '@/utils/api';

type SearchItem = (Meeting | Task) & { item_type: 'meeting' | 'task' };

export default function SearchPage() {
  const navigate = useNavigate();
  const { searchResults, loading, search } = useAppStore();
  const [keyword, setKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [assignee, setAssignee] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (keyword) params.keyword = keyword;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (assignee) params.assignee_id = assignee;
    search(params);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!searchResults?.items) return;
    if (selectedIds.size === searchResults.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(searchResults.items.map(i => i.id)));
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (assignee) params.set('assignee_id', assignee);

    const fetchOptions: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
    if (selectedIds.size > 0) {
      fetchOptions.body = JSON.stringify({ ids: Array.from(selectedIds) });
    } else {
      const body: Record<string, string> = {};
      if (keyword) body.keyword = keyword;
      if (dateFrom) body.dateFrom = dateFrom;
      if (dateTo) body.dateTo = dateTo;
      if (assignee) body.assignee_id = assignee;
      fetchOptions.body = JSON.stringify(body);
    }

    fetch('/api/search/export', fetchOptions)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'search-results.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const isMeeting = (item: Meeting | Task): item is Meeting =>
    'team_id' in item || 'transcription' in item || 'duration' in item;

  const items: SearchItem[] = (searchResults?.items ?? []).map(item => ({
    ...item,
    item_type: isMeeting(item) ? 'meeting' : 'task',
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>历史查询</h1>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜索关键词..."
              className="input-base w-full pl-9"
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-base w-full pl-9" />
          </div>
          <div className="relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-base w-full pl-9" />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="负责人ID" className="input-base w-full pl-9" />
            </div>
            <button onClick={handleSearch} className="btn-primary flex items-center gap-2">
              <Search size={14} /> 查询
            </button>
          </div>
        </div>
      </div>

      {loading.search ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : searchResults ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              共找到 {searchResults.total} 条结果（会议 {searchResults.meetingCount}，待办 {searchResults.taskCount}）
              {selectedIds.size > 0 && ` · 已选 ${selectedIds.size} 条`}
            </span>
            <button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download size={14} /> 导出{selectedIds.size > 0 ? '已选' : '全部'}
            </button>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="card text-center py-12" style={{ color: 'var(--color-text-muted)' }}>暂无搜索结果</div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-3 py-1">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded accent-orange-500"
                  />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>全选</span>
                </div>
                {items.map(item => (
                  <div
                    key={item.id}
                    className="card cursor-pointer transition-colors"
                    onClick={() => {
                      if (item.item_type === 'meeting') navigate(`/meetings/${item.id}`);
                      else navigate(`/tasks?id=${item.id}`);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={e => { e.stopPropagation(); toggleSelect(item.id); }}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 mt-0.5 rounded accent-orange-500"
                        />
                        <div className="mt-0.5">
                          {item.item_type === 'meeting' ? (
                            <Video size={16} style={{ color: 'var(--color-accent)' }} />
                          ) : (
                            <CheckSquare size={16} style={{ color: 'var(--color-success)' }} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{item.title}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            {item.item_type === 'meeting'
                              ? `${(item as Meeting).date} · ${(item as Meeting).duration}分钟`
                              : `负责人: ${(item as Task).assignee_name ?? '未指定'} · 截止: ${(item as Task).deadline}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="badge" style={{
                          backgroundColor: item.item_type === 'meeting' ? 'var(--color-accent-soft)' : 'var(--color-success-soft)',
                          color: item.item_type === 'meeting' ? 'var(--color-accent)' : 'var(--color-success)',
                        }}>
                          {item.item_type === 'meeting' ? '会议' : '待办'}
                        </span>
                        <StatusBadge type={item.item_type} status={item.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          输入搜索条件开始查询
        </div>
      )}
    </div>
  );
}
