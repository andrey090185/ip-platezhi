import { NavLink } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { logout } from '@/firebase/auth'
import { isFirebaseConfigured } from '@/firebase/config'
import {
  LayoutDashboard, Receipt, Calculator, CalendarDays,
  Wallet, FileText, Settings, Menu, X, Building2, LogOut,
  Cloud, CloudOff, Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Обзор' },
  { to: '/income', icon: Receipt, label: 'Операции' },
  { to: '/taxes', icon: Calculator, label: 'Платежи' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
]

const syncStatusConfig = {
  synced: { icon: Cloud, label: 'Синхронизировано', color: 'text-green-500' },
  syncing: { icon: Loader2, label: 'Синхронизация...', color: 'text-blue-500 animate-spin' },
  offline: { icon: CloudOff, label: 'Оффлайн', color: 'text-muted-foreground' },
  error: { icon: CloudOff, label: 'Ошибка синхронизации', color: 'text-red-500' },
}

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, currentIp, userId, syncStatus } = useAppStore()
  const syncConfig = syncStatusConfig[syncStatus]
  const SyncIcon = syncConfig.icon

  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-200',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">ИП</span>
              </div>
              <span className="font-semibold text-sidebar-foreground text-sm">ИП Платежи</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded hover:bg-sidebar-accent"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {currentIp && (
            <div className="px-4 py-3 border-b border-sidebar-border">
              <p className="text-xs text-muted-foreground truncate">{currentIp.name}</p>
              <p className="text-xs text-muted-foreground">ИНН: {currentIp.inn}</p>
            </div>
          )}

          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {isFirebaseConfigured() && (
            <div className="p-3 border-t border-sidebar-border space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <SyncIcon className={cn('w-3.5 h-3.5', syncConfig.color)} />
                <span>{syncConfig.label}</span>
              </div>
              {userId && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate flex-1">{userId.substring(0, 16)}...</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  )
}
