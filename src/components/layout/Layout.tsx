import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:ml-60">
        <Header />
        <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7 max-w-[1600px]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
