import { create } from 'zustand'
import type { IpProfile, TaxSettings, Holiday } from '@/types'

const LAST_IP_KEY = 'ip-platezhi-last-ip-id'

interface AppState {
  currentIp: IpProfile | null
  taxSettings: TaxSettings | null
  holidays: Holiday[]
  isOnboarded: boolean
  ipList: IpProfile[]
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  userId: string | null
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error'

  setCurrentIp: (ip: IpProfile | null) => void
  setTaxSettings: (settings: TaxSettings | null) => void
  setHolidays: (holidays: Holiday[]) => void
  setIsOnboarded: (v: boolean) => void
  setIpList: (list: IpProfile[]) => void
  setSidebarOpen: (v: boolean) => void
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  getLastActiveIpId: () => number | null
  setUserId: (id: string | null) => void
  setSyncStatus: (status: 'synced' | 'syncing' | 'offline' | 'error') => void
}

export const useAppStore = create<AppState>((set) => ({
  currentIp: null,
  taxSettings: null,
  holidays: [],
  isOnboarded: false,
  ipList: [],
  sidebarOpen: false,
  theme: (typeof window !== 'undefined' && localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  userId: null,
  syncStatus: 'offline',

  setCurrentIp: (ip) => {
    if (ip?.id) {
      localStorage.setItem(LAST_IP_KEY, String(ip.id))
    }
    set({ currentIp: ip })
  },
  setTaxSettings: (settings) => set({ taxSettings: settings }),
  setHolidays: (holidays) => set({ holidays }),
  setIsOnboarded: (v) => set({ isOnboarded: v }),
  setIpList: (list) => set({ ipList: list }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    set({ theme })
  },
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('theme', newTheme)
    return { theme: newTheme }
  }),
  getLastActiveIpId: () => {
    const val = localStorage.getItem(LAST_IP_KEY)
    return val ? parseInt(val) : null
  },
  setUserId: (id) => set({ userId: id }),
  setSyncStatus: (status) => set({ syncStatus: status }),
}))
