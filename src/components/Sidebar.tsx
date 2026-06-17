import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Video, CheckSquare, BarChart3, Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '工作台' },
  { to: '/meetings', icon: Video, label: '会议管理' },
  { to: '/tasks', icon: CheckSquare, label: '待办中心' },
  { to: '/reports', icon: BarChart3, label: '效率报告' },
  { to: '/search', icon: Search, label: '历史查询' },
  { to: '/logs', icon: FileText, label: '操作日志' },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        'flex flex-col h-screen border-r transition-all duration-300 shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border-light)',
      }}
    >
      <div className="flex items-center h-16 px-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent)' }}>
              <Video size={18} className="text-white" />
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
              会议管理平台
            </span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto" style={{ backgroundColor: 'var(--color-accent)' }}>
            <Video size={18} className="text-white" />
          </div>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                sidebarCollapsed && 'justify-center px-0',
                isActive
                  ? 'text-white font-medium'
                  : 'hover:bg-opacity-50'
              )
            }
            style={({ isActive }) => ({
              backgroundColor: isActive ? 'var(--color-accent)' : 'transparent',
              color: isActive ? '#fff' : 'var(--color-text-secondary)',
            })}
          >
            <Icon size={20} />
            {!sidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 border-t transition-colors"
        style={{
          borderColor: 'var(--color-border-light)',
          color: 'var(--color-text-muted)',
        }}
      >
        {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}
