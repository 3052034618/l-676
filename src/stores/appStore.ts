import { create } from 'zustand';
import {
  api,
  type Meeting,
  type Task,
  type LogEntry,
  type Stats,
  type ReportData,
  type TeamDrillData,
  type SearchResult,
  type PaginatedResult,
  type OverdueTaskWithGovernance,
  type GovernanceStats,
  type OverdueUser,
} from '@/utils/api';

interface AppState {
  meetings: Meeting[];
  meetingsTotal: number;
  tasks: Task[];
  tasksTotal: number;
  logs: LogEntry[];
  logsTotal: number;
  stats: Stats | null;
  reportData: ReportData | null;
  teamDrillData: TeamDrillData | null;
  searchResults: SearchResult | null;
  selectedTask: Task | null;
  governanceStats: GovernanceStats | null;
  overdueTasks: OverdueTaskWithGovernance[];
  overdueTasksTotal: number;
  overdueUsers: OverdueUser[];
  currentUser: { name: string; role: string; avatar: string };
  sidebarCollapsed: boolean;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;

  toggleSidebar: () => void;
  fetchMeetings: (params?: Record<string, string>) => Promise<void>;
  fetchMeeting: (id: string) => Promise<Meeting>;
  createMeeting: (data: Partial<Meeting>) => Promise<void>;
  fetchTasks: (params?: Record<string, string>) => Promise<void>;
  fetchTask: (id: string) => Promise<Task>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  remindTask: (id: string) => Promise<void>;
  setSelectedTask: (task: Task | null) => void;
  fetchStats: () => Promise<void>;
  fetchReport: (month?: string) => Promise<void>;
  fetchTeamDrill: (teamId: string, month?: string) => Promise<void>;
  clearTeamDrill: () => void;
  fetchLogs: (params?: Record<string, string>) => Promise<void>;
  search: (params: Record<string, string>) => Promise<void>;
  fetchGovernanceStats: () => Promise<void>;
  fetchOverdueTasks: (params?: Record<string, string>) => Promise<void>;
  fetchOverdueUsers: () => Promise<void>;
  clearError: (key: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  meetings: [],
  meetingsTotal: 0,
  tasks: [],
  tasksTotal: 0,
  logs: [],
  logsTotal: 0,
  stats: null,
  reportData: null,
  teamDrillData: null,
  searchResults: null,
  selectedTask: null,
  governanceStats: null,
  overdueTasks: [],
  overdueTasksTotal: 0,
  overdueUsers: [],
  currentUser: { name: '张伟', role: '系统管理员', avatar: '' },
  sidebarCollapsed: false,
  loading: {},
  error: {},

  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  fetchMeetings: async (params) => {
    set(s => ({ loading: { ...s.loading, meetings: true }, error: { ...s.error, meetings: null } }));
    try {
      const res = await api.meetings.list(params);
      set({ meetings: res.items, meetingsTotal: res.total, loading: { ...get().loading, meetings: false } });
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, meetings: false }, error: { ...s.error, meetings: e.message } }));
    }
  },

  fetchMeeting: async (id) => {
    return api.meetings.get(id);
  },

  createMeeting: async (data) => {
    set(s => ({ loading: { ...s.loading, createMeeting: true } }));
    try {
      await api.meetings.create(data);
      await get().fetchMeetings();
      set(s => ({ loading: { ...s.loading, createMeeting: false } }));
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, createMeeting: false }, error: { ...s.error, createMeeting: e.message } }));
    }
  },

  fetchTasks: async (params) => {
    set(s => ({ loading: { ...s.loading, tasks: true }, error: { ...s.error, tasks: null } }));
    try {
      const res = await api.tasks.list(params);
      set({ tasks: res.items, tasksTotal: res.total, loading: { ...get().loading, tasks: false } });
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, tasks: false }, error: { ...s.error, tasks: e.message } }));
    }
  },

  fetchTask: async (id) => {
    return api.tasks.get(id);
  },

  updateTask: async (id, data) => {
    try {
      await api.tasks.update(id, data);
      await get().fetchTasks();
    } catch (e: any) {
      set(s => ({ error: { ...s.error, updateTask: e.message } }));
    }
  },

  remindTask: async (id) => {
    try {
      await api.tasks.remind(id);
      await get().fetchTasks();
    } catch (e: any) {
      set(s => ({ error: { ...s.error, remindTask: e.message } }));
    }
  },

  setSelectedTask: (task) => set({ selectedTask: task }),

  fetchStats: async () => {
    set(s => ({ loading: { ...s.loading, stats: true }, error: { ...s.error, stats: null } }));
    try {
      const stats = await api.stats.get();
      set({ stats, loading: { ...get().loading, stats: false } });
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, stats: false }, error: { ...s.error, stats: e.message } }));
    }
  },

  fetchReport: async (month) => {
    set(s => ({ loading: { ...s.loading, report: true }, error: { ...s.error, report: null } }));
    try {
      const reportData = await api.reports.get(month);
      set({ reportData, loading: { ...get().loading, report: false } });
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, report: false }, error: { ...s.error, report: e.message } }));
    }
  },

  fetchTeamDrill: async (teamId, month) => {
    set(s => ({ loading: { ...s.loading, teamDrill: true }, error: { ...s.error, teamDrill: null } }));
    try {
      const teamDrillData = await api.reports.getTeamDrill(teamId, month);
      set({ teamDrillData, loading: { ...get().loading, teamDrill: false } });
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, teamDrill: false }, error: { ...s.error, teamDrill: e.message } }));
    }
  },

  clearTeamDrill: () => set({ teamDrillData: null }),

  fetchLogs: async (params) => {
    set(s => ({ loading: { ...s.loading, logs: true }, error: { ...s.error, logs: null } }));
    try {
      const res = await api.logs.list(params);
      set({ logs: res.items, logsTotal: res.total, loading: { ...get().loading, logs: false } });
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, logs: false }, error: { ...s.error, logs: e.message } }));
    }
  },

  fetchGovernanceStats: async () => {
    set(s => ({ loading: { ...s.loading, governanceStats: true }, error: { ...s.error, governanceStats: null } }));
    try {
      const governanceStats = await api.governance.getStats();
      set({ governanceStats, loading: { ...get().loading, governanceStats: false } });
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, governanceStats: false }, error: { ...s.error, governanceStats: e.message } }));
    }
  },

  fetchOverdueTasks: async (params) => {
    set(s => ({ loading: { ...s.loading, overdueTasks: true }, error: { ...s.error, overdueTasks: null } }));
    try {
      const res = await api.governance.getOverdue(params);
      set({ overdueTasks: res.items, overdueTasksTotal: res.total, loading: { ...get().loading, overdueTasks: false } });
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, overdueTasks: false }, error: { ...s.error, overdueTasks: e.message } }));
    }
  },

  fetchOverdueUsers: async () => {
    set(s => ({ loading: { ...s.loading, overdueUsers: true }, error: { ...s.error, overdueUsers: null } }));
    try {
      const overdueUsers = await api.governance.getUsers();
      set({ overdueUsers, loading: { ...get().loading, overdueUsers: false } });
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, overdueUsers: false }, error: { ...s.error, overdueUsers: e.message } }));
    }
  },

  search: async (params) => {
    set(s => ({ loading: { ...s.loading, search: true }, error: { ...s.error, search: null } }));
    try {
      const searchResults = await api.search.query(params);
      set({ searchResults, loading: { ...get().loading, search: false } });
    } catch (e: any) {
      set(s => ({ loading: { ...s.loading, search: false }, error: { ...s.error, search: e.message } }));
    }
  },

  clearError: (key) => set(s => ({ error: { ...s.error, [key]: null } })),
}));
