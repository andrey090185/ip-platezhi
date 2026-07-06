import { useAppStore } from '@/store/appStore'
import { Menu, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Header() {
  const { setSidebarOpen, theme, toggleTheme, currentIp } = useAppStore()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </Button>

      <div className="flex-1" />

      <Button variant="ghost" size="icon" onClick={toggleTheme}>
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </Button>
    </header>
  )
}
