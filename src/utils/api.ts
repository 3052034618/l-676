const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `请求失败: ${res.status}`);
  }
  const json = await res.json();
  return json.data as T;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: number;
  status: string;
  transcription: string;
  team_id: string;
  team_name?: string;
  task_count?: number;
  tasks?: Task[];
  materials?: Material[];
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  meeting_id: string;
  filename: string;
  file_type: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

export interface Task {
  id: string;
  meeting_id: string;
  title: string;
  description: string;
  assignee_id: string;
  assignee_name?: string;
  urgency: string;
  status: string;
  deadline: string;
  calculated_deadline_reason: string;
  escalation_level: number;
  remind_count: number;
  completed_at: string | null;
  reminders?: Reminder[];
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  task_id: string;
  type: string;
  sent_to: string;
  sent_to_name?: string;
  recipient_type: 'assignee' | 'supervisor' | 'dept_head';
  sent_at: string;
  status: string;
}

export interface LogEntry {
  id: string;
  type: string;
  detail: string;
  operator_id: string | null;
  operator_name?: string;
  related_id: string | null;
  is_anomaly: number;
  created_at: string;
}

export interface Stats {
  totalMeetings: number;
  weekMeetings: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
  overdueRate: number;
  recentMeetings: Meeting[];
  overdueTasksList: Task[];
}

export interface ReportData {
  month: string;
  teams: TeamReport[];
  overallCompletionRate: number;
  overallAvgResponseTime: number;
  overdueDistribution: { range: string; count: number }[];
  totalMeetings: { cnt: number };
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  vsLastMonth: Record<string, {
    completion_rate_change: number;
    avg_response_hours_change: number;
    overdue_count_change: number;
  }>;
}

export interface TeamReport {
  team_id: string;
  team_name: string;
  completion_rate: number;
  avg_response_hours: number;
  total_meetings: number;
  total_duration: number;
  overdue_count: number;
}

export interface TeamDrillData {
  team: { id: string; name: string };
  month: string;
  summary: {
    total_meetings: number;
    total_duration: number;
    total_tasks: number;
    completed_tasks: number;
    completion_rate: number;
    avg_response_hours: number;
    overdue_tasks: number;
  };
  meetings: Meeting[];
  tasks: (Task & { response_hours: number | null; is_overdue: number; meeting_title?: string; meeting_date?: string; assignee_name?: string })[];
}

export interface NotifiedRecipient {
  recipient_type: 'assignee' | 'supervisor' | 'dept_head';
  sent_to: string;
  sent_to_name: string;
  sent_at: string;
}

export interface OverdueTaskWithGovernance extends Task {
  team_id?: string;
  team_name?: string;
  meeting_title?: string;
  assignee_name?: string;
  notified_recipients: NotifiedRecipient[];
  first_escalation_at: string | null;
  last_remind_at: string | null;
  next_check_at: string;
  overdue_days: number;
}

export interface GovernanceStats {
  total_overdue: number;
  by_level: Record<string, number>;
  by_team: { team_id: string; team_name: string; cnt: number }[];
}

export interface OverdueUser {
  id: string;
  name: string;
  role: string;
  team_name?: string;
  overdue_count: number;
}

export interface SearchResult {
  items: (Meeting | Task)[];
  total: number;
  page: number;
  pageSize: number;
  meetingCount: number;
  taskCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const api = {
  meetings: {
    list: async (params?: Record<string, string>): Promise<PaginatedResult<Meeting>> => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
      return request(`/meetings${qs}`);
    },
    get: (id: string) => request<Meeting>(`/meetings/${id}`),
    create: (data: Partial<Meeting>) =>
      request<Meeting>('/meetings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Meeting>) =>
      request<Meeting>(`/meetings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/meetings/${id}`, { method: 'DELETE' }),
    uploadMaterial: (id: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetch(`${BASE_URL}/meetings/${id}/materials`, {
        method: 'POST',
        body: formData,
      }).then(res => res.json()).then(json => json.data);
    },
    getMaterials: (id: string) => request<Material[]>(`/meetings/${id}/materials`),
  },
  tasks: {
    list: async (params?: Record<string, string>): Promise<PaginatedResult<Task>> => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
      return request(`/tasks${qs}`);
    },
    get: (id: string) => request<Task>(`/tasks/${id}`),
    update: (id: string, data: Partial<Task>) =>
      request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remind: (id: string) =>
      request<{ remind_count: number; escalation_level: number; sent_to: string; type: string }>(`/tasks/${id}/remind`, { method: 'POST' }),
    overdue: () => request<Task[]>('/tasks/overdue'),
  },
  stats: {
    get: () => request<Stats>('/stats/dashboard'),
  },
  reports: {
    get: (month?: string) =>
      request<ReportData>(`/reports/monthly${month ? `?month=${month}` : ''}`),
    getTeamDrill: (teamId: string, month?: string) =>
      request<TeamDrillData>(`/reports/monthly/team/${teamId}${month ? `?month=${month}` : ''}`),
    exportPdfUrl: (month?: string) => `${BASE_URL}/reports/monthly/pdf${month ? `?month=${month}` : ''}`,
    exportExcelUrl: (month?: string) => `${BASE_URL}/reports/monthly/excel${month ? `?month=${month}` : ''}`,
  },
  governance: {
    getOverdue: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
      return request<PaginatedResult<OverdueTaskWithGovernance>>(`/governance/overdue${qs}`);
    },
    getStats: () => request<GovernanceStats>('/governance/stats'),
    getUsers: () => request<OverdueUser[]>('/governance/users'),
  },
  search: {
    query: (params: Record<string, string>) =>
      request<SearchResult>(`/search?${new URLSearchParams(params).toString()}`),
    exportUrl: () => `${BASE_URL}/search/export`,
  },
  logs: {
    list: async (params?: Record<string, string>): Promise<PaginatedResult<LogEntry>> => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
      return request(`/logs${qs}`);
    },
    anomalies: () => request<{ anomalyLogs: LogEntry[]; criticalOverdueTasks: Task[] }>('/logs/anomalies'),
  },
};
