import { Outlet } from 'react-router-dom';
import { Bell, User } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useAppStore } from '@/stores/appStore';

export default function Layout() {
  const { currentUser } = useAppStore();

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <header
          className="flex items-center justify-between h-14 px-6 border-b shrink-0"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-light)',
          }}
        >
          <div />

          <div className="flex items-center gap-4">
            <button
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Bell size={20} />
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ backgroundColor: 'var(--color-danger)' }}
              />
            </button>

            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)' }}
              >
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <User size={16} />
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {currentUser.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {currentUser.role}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
