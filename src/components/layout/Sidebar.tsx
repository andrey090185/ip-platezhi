import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { logout } from '@/firebase/auth'
import { isFirebaseConfigured } from '@/firebase/config'
import { ipRepo } from '@/db/repositories/ipRepo'
import { settingsRepo } from '@/db/repositories/settingsRepo'
import {
  LayoutDashboard, Receipt, Calculator, CalendarDays,
  Wallet, FileText, Settings, Menu, X, Building2, LogOut,
  Cloud, CloudOff, Loader2, ChevronDown, Plus, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Обзор' },
  { to: '/income', icon: Receipt, label: 'Операции' },
  { to: '/taxes', icon: Calculator, label: 'Платежи' },
  { to: '/calendar', icon: CalendarDays, label: 'Календарь' },
  { to: '/ens', icon: Wallet, label: 'ЕНС' },
  { to: '/reports', icon: FileText, label: 'Отчёты' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
]

const syncStatusConfig = {
  synced: { icon: Cloud, label: 'Синхронизировано', color: 'text-green-500' },
  syncing: { icon: Loader2, label: 'Синхронизация...', color: 'text-blue-500 animate-spin' },
  offline: { icon: CloudOff, label: 'Оффлайн', color: 'text-muted-foreground' },
  error: { icon: CloudOff, label: 'Ошибка синхронизации', color: 'text-red-500' },
}

export function Sidebar() {
  const navigate = useNavigate()
  const { sidebarOpen, setSidebarOpen, currentIp, userId, syncStatus, ipList, setIpList, switchToIp } = useAppStore()
  const syncConfig = syncStatusConfig[syncStatus]
  const SyncIcon = syncConfig.icon
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadIpList = async () => {
    const ips = await ipRepo.getAll()
    setIpList(ips)
  }

  const handleSwitchIp = async (ip: typeof ipList[number]) => {
    if (ip.id === currentIp?.id) {
      setDropdownOpen(false)
      return
    }
    const settings = await settingsRepo.getTaxSettings(ip.id!)
    const holidays = await settingsRepo.getHolidays(ip.id!, ip.year)
    switchToIp(ip, settings ?? null, holidays)
    setDropdownOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-200 flex flex-col',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border shrink-0">
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

        {/* IP Switcher */}
        {currentIp && (
          <div className="px-2 py-2 border-b border-sidebar-border shrink-0" ref={dropdownRef}>
            <button
              onClick={async () => {
                if (!dropdownOpen) await loadIpList()
                setDropdownOpen(!dropdownOpen)
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors text-left"
            >
              <Building2 className="w-4 h-4 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{currentIp.name}</p>
                <p className="text-[10px] text-muted-foreground">ИНН: {currentIp.inn}</p>
              </div>
              <ChevronDown className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform', dropdownOpen && 'rotate-180')} />
            </button>

            {dropdownOpen && (
              <div className="mt-1 mx-1 rounded-lg border border-sidebar-border bg-sidebar shadow-lg overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {ipList.map((ip) => (
                    <button
                      key={ip.id}
                      onClick={() => handleSwitchIp(ip)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent',
                        ip.id === currentIp?.id && 'bg-sidebar-accent/50'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{ip.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {ip.usnObject === 'income' ? 'УСН 6%' : 'УСН 15%'} · {ip.year}
                        </p>
                      </div>
                      {ip.id === currentIp?.id && (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-sidebar-border p-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      setSidebarOpen(false)
                      navigate('/onboarding')
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs text-muted-foreground hover:bg-sidebar-accent transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Добавить ИП
                  </button>
                </div>
              </div>
            )}
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

        {/* Управление ИП */}
        <div className="px-2 pb-2 shrink-0">
          <NavLink
            to="/ips"
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
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Мои ИП</span>
          </NavLink>
        </div>

        {isFirebaseConfigured() && (
          <div className="p-3 border-t border-sidebar-border shrink-0 space-y-2">
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