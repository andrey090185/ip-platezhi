import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/components/layout/Layout'
import { useAppStore } from '@/store/appStore'
import { ipRepo } from '@/db/repositories/ipRepo'
import { onAuthChange } from '@/firebase/auth'
import { isFirebaseConfigured } from '@/firebase/config'
import { syncOnLogin, setSyncUser, setSyncStatusHandler } from '@/firebase/syncManager'

const Onboarding = lazy(() => import('@/pages/Onboarding'))
const IpSelector = lazy(() => import('@/pages/IpSelector'))
const Auth = lazy(() => import('@/pages/Auth'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const IncomeExpenses = lazy(() => import('@/pages/IncomeExpenses'))
const TaxCalculation = lazy(() => import('@/pages/TaxCalculation'))
const Settings = lazy(() => import('@/pages/Settings'))

function PageFallback() {
  return <div className="min-h-[50vh] grid place-items-center text-sm text-muted-foreground">Загружаем раздел…</div>
}

function App() {
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState<'loading' | 'auth' | 'onboarding' | 'selector' | 'app'>('loading')
  const {
    setUserId, setSyncStatus,
    resetWorkspace, theme, isOnboarded
  } = useAppStore()

  const initAppLocal = useCallback(async () => {
    const count = await ipRepo.getCount()

    if (count === 0) {
      setRoute('onboarding')
      setLoading(false)
      return
    }

    setRoute('selector')
    setLoading(false)
  }, [])

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
      resetWorkspace()
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
  }, [initAppLocal, resetWorkspace, setSyncStatus, setUserId])

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
          <Suspense fallback={<PageFallback />}><Routes>
            <Route path="*" element={<Auth />} />
          </Routes></Suspense>
        </BrowserRouter>
      </TooltipProvider>
    )
  }

  if (route === 'onboarding') {
    return (
      <TooltipProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}><Routes>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
          </Routes></Suspense>
        </BrowserRouter>
      </TooltipProvider>
    )
  }

  if (route === 'selector') {
    return (
      <TooltipProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}><Routes>
            <Route path="/ips" element={<IpSelector />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="*" element={<Navigate to="/ips" replace />} />
          </Routes></Suspense>
        </BrowserRouter>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}><Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/ips" element={<IpSelector />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/income" element={<IncomeExpenses />} />
            <Route path="/taxes" element={<TaxCalculation />} />
            <Route path="/calendar" element={<Navigate to="/taxes" replace />} />
            <Route path="/ens" element={<Navigate to="/taxes" replace />} />
            <Route path="/reports" element={<Navigate to="/income" replace />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes></Suspense>
      </BrowserRouter>
    </TooltipProvider>
  )
}

export default App
