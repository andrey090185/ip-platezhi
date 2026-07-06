import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/components/layout/Layout'
import { useAppStore } from '@/store/appStore'
import { ipRepo } from '@/db/repositories/ipRepo'
import { settingsRepo } from '@/db/repositories/settingsRepo'
import { onAuthChange } from '@/firebase/auth'
import { isFirebaseConfigured } from '@/firebase/config'
import { loadAllFromCloud, migrateAllToCloud } from '@/firebase/syncManager'

import Onboarding from '@/pages/Onboarding'
import IpSelector from '@/pages/IpSelector'
import Auth from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import IncomeExpenses from '@/pages/IncomeExpenses'
import Employees from '@/pages/Employees'
import Payroll from '@/pages/Payroll'
import TaxCalculation from '@/pages/TaxCalculation'
import CalendarPage from '@/pages/Calendar'
import Ens from '@/pages/Ens'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'

function App() {
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState<'loading' | 'auth' | 'onboarding' | 'selector' | 'app'>('loading')
  const {
    setCurrentIp, setTaxSettings, setHolidays, setIsOnboarded, setIpList,
    setUserId, setSyncStatus,
    theme
  } = useAppStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      initAppLocal()
      return
    }

    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        setUserId(user.uid)
        setSyncStatus('syncing')
        await loadAllFromCloud(user.uid)
        setSyncStatus('synced')
        await initAppLocal()
      } else {
        setUserId(null)
        setSyncStatus('offline')
        await initAppLocal()
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

    if (count === 1) {
      const ip = await ipRepo.get()
      if (ip) {
        setCurrentIp(ip)
        const settings = await settingsRepo.getTaxSettings(ip.id!)
        if (settings) setTaxSettings(settings)
        const holidays = await settingsRepo.getHolidays(ip.id!, ip.year)
        setHolidays(holidays)
        setIsOnboarded(true)
      }
      setRoute('app')
      setLoading(false)
      return
    }

    const lastId = useAppStore.getState().getLastActiveIpId()
    if (lastId) {
      const ips = await ipRepo.getAll()
      const found = ips.find(i => i.id === lastId)
      if (found) {
        setCurrentIp(found)
        const settings = await settingsRepo.getTaxSettings(found.id!)
        if (settings) setTaxSettings(settings)
        const holidays = await settingsRepo.getHolidays(found.id!, found.year)
        setHolidays(holidays)
        setIsOnboarded(true)
        setRoute('app')
        setLoading(false)
        return
      }
    }

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
            <Route path="/employees" element={<Employees />} />
            <Route path="/payroll" element={<Payroll />} />
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
