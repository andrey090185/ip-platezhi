import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/components/layout/Layout'
import { useAppStore } from '@/store/appStore'
import { ipRepo } from '@/db/repositories/ipRepo'
import { onAuthChange } from '@/firebase/auth'
import { isFirebaseConfigured } from '@/firebase/config'
import { syncOnLogin, setSyncUser, setSyncStatusHandler } from '@/firebase/syncManager'

import Onboarding from '@/pages/Onboarding'
import IpSelector from '@/pages/IpSelector'
import Auth from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import IncomeExpenses from '@/pages/IncomeExpenses'
import TaxCalculation from '@/pages/TaxCalculation'
import CalendarPage from '@/pages/Calendar'
import Ens from '@/pages/Ens'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'

function App() {
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState<'loading' | 'auth' | 'onboarding' | 'selector' | 'app'>('loading')
  const {
    setIsOnboarded,
    setUserId, setSyncStatus,
    theme, isOnboarded
  } = useAppStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // When onboarding completes or IP is selected in selector, switch to app route
  useEffect(() => {
    if (isOnboarded && (route === 'onboarding' || route === 'selector')) {
      setRoute('app')
    }
  }, [isOnboarded, route])

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      initAppLocal()
      return
    }

    // Let background auto-sync update the sidebar status indicator.
    setSyncStatusHandler(setSyncStatus)

    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        setUserId(user.uid)
        setSyncUser(user.uid)
        setLoading(true)
        setSyncStatus('syncing')
        try {
          await syncOnLogin(user.uid)
          setSyncStatus('synced')
        } catch (e) {
          console.warn('Sync on login failed:', e)
          setSyncStatus('error')
        }
        await initAppLocal()
      } else {
        // Login is required — show the auth screen when no user is signed in.
        setUserId(null)
        setSyncUser(null)
        setSyncStatus('offline')
        setRoute('auth')
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const initAppLocal = async () => {
    const count = await ipRepo.getCount()

    if (count === 0) {
      setRoute('onboarding')
      setLoading(false)
      return
    }

    // Always show IP selector as the home page
    setRoute('selector')
    setLoading(false)
  }

  if (loading || route === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center animate-pulse">
            <span className="text-primary-foreground font-bold">ИП</span>
          </div>
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (route === 'auth') {
    return (
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="*" element={<Auth />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    )
  }

  if (route === 'onboarding') {
    return (
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    )
  }

  if (route === 'selector') {
    return (
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/ips" element={<IpSelector />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<Navigate to="/ips" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/ips" element={<IpSelector />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/income" element={<IncomeExpenses />} />
            <Route path="/taxes" element={<TaxCalculation />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/ens" element={<Ens />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  )
}

export default App
