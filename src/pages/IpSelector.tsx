import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { ipRepo } from '@/db/repositories/ipRepo'
import { settingsRepo } from '@/db/repositories/settingsRepo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Trash2, Building2, Users, Calendar } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'

export default function IpSelector() {
  const navigate = useNavigate()
  const { setCurrentIp, setTaxSettings, setHolidays, setIsOnboarded, setIpList, ipList } = useAppStore()
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadIps()
  }, [])

  const loadIps = async () => {
    const ips = await ipRepo.getAll()
    setIpList(ips)
  }

  const handleSelectIp = async (ip: any) => {
    setCurrentIp(ip)
    const settings = await settingsRepo.getTaxSettings(ip.id!)
    if (settings) setTaxSettings(settings)
    const holidays = await settingsRepo.getHolidays(ip.id!, ip.year)
    setHolidays(holidays)
    setIsOnboarded(true)
    // Full reload so App re-resolves routing to the app for the selected IP.
    // A plain navigate() is bounced back to /ips while route === 'selector'.
    window.location.href = '/dashboard'
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await ipRepo.deleteWithCascade(deleteTarget.id)
    const lastId = localStorage.getItem('ip-platezhi-last-ip-id')
    if (lastId === String(deleteTarget.id)) {
      localStorage.removeItem('ip-platezhi-last-ip-id')
    }
    setDeleteTarget(null)
    setDeleting(false)
    loadIps()
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Мои ИП</h1>
            <p className="text-muted-foreground">Выберите ИП для работы или добавьте новый</p>
          </div>
          <Button onClick={() => navigate('/onboarding')} className="gap-2">
            <Plus className="w-4 h-4" /> Добавить ИП
          </Button>
        </div>

        {ipList.length === 0 ? (
          <EmptyState
            title="Нет добавленных ИП"
            description="Создайте первый профиль индивидуального предпринимателя"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ipList.map((ip) => (
              <Card
                key={ip.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base leading-tight">{ip.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">ИНН: {ip.inn || 'не указан'}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget({ id: ip.id!, name: ip.name })
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent
                  className="space-y-3 cursor-pointer"
                  onClick={() => handleSelectIp(ip)}
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {ip.usnObject === 'income' ? 'УСН Доходы' : 'УСН Д-Р'}
                    </Badge>
                    <Badge variant="outline">{ip.year}</Badge>
                    {ip.region && <Badge variant="outline">{ip.region}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {ip.hasEmployees && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {ip.employeeCount || '?'} сотр.
                      </span>
                    )}
                    {ip.ndsEnabled && (
                      <Badge variant="secondary" className="text-xs">НДС</Badge>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    Открыть
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Удалить ИП?</DialogTitle>
              <DialogDescription>
                Все данные ИП «{deleteTarget?.name}» будут безвозвратно удалены:
                доходы, расходы, сотрудники, расчёты, календарь, настройки.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Удаление...' : 'Удалить'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
