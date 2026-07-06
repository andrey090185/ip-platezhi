import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import {
  LayoutDashboard, Receipt, Users, Calculator, CalendarDays,
  Wallet, FileText, Settings, ChevronLeft, Menu, X, Building2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Главная' },
  { to: '/ips', icon: Building2, label: 'Мои ИП' },
  { to: '/income', icon: Receipt, label: 'Доходы и расходы' },
  { to: '/employees', icon: Users, label: 'Сотрудники' },
  { to: '/payroll', icon: Calculator, label: 'Зарплата' },
  { to: '/taxes', icon: Wallet, label: 'Расчёт налогов' },
  { to: '/calendar', icon: CalendarDays, label: 'Календарь' },
  { to: '/ens', icon: Wallet, label: 'ЕНС' },
  { to: '/reports', icon: FileText, label: 'Отчёты' },
  { to: '/settings', icon: Settings, label: 'Настройки' },
]

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, currentIp } = useAppStore()
  const location = useLocation()

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
