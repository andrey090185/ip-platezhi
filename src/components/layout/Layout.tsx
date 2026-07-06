import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'

export function Layout() {
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:ml-64">
        <Header />
        <main className="p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
