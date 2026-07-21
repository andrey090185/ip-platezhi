import { useAppStore } from '@/store/appStore'
import { Menu, Moon, Sun, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Header() {
  const { setSidebarOpen, theme, toggleTheme, currentIp } = useAppStore()

  return (
    <header className="app-header sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/90 backdrop-blur-xl px-4 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </Button>

      <div className="min-w-0">
        <p className="text-base font-semibold truncate">{currentIp?.name}</p>
        <p className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground"><Circle className="size-1.5 fill-emerald-500 text-emerald-500" /> Данные хранятся локально и синхронизируются при входе</p>
      </div>

      <div className="flex-1" />

      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Сменить тему">
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </Button>
    </header>
  )
}
