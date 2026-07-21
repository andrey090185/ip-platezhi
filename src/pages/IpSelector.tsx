import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { ipRepo } from '@/db/repositories/ipRepo'
import { settingsRepo } from '@/db/repositories/settingsRepo'
import { transactionRepo } from '@/db/repositories/transactionRepo'
import { taxCalcRepo } from '@/db/repositories/taxCalcRepo'
import { recalculateTaxPlan } from '@/services/taxPlanService'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { d, dMax } from '@/engine/decimal'
import type { IpProfile } from '@/types'
import { ArrowRight, Building2, Plus, Trash2, WalletCards } from 'lucide-react'

interface IpStats { income: string; remaining: string }

export default function IpSelector() {
  const navigate = useNavigate()
  const {
    setCurrentIp, setTaxSettings, setHolidays, setIsOnboarded, setIpList, ipList, userId,
  } = useAppStore()
  const [stats, setStats] = useState<Record<number, IpStats>>({})
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadIps = useCallback(async () => {
    const ips = await ipRepo.getAll()
    setIpList(ips)
    const entries = await Promise.all(ips.filter(ip => ip.id).map(async ip => {
      const [settings, holidays] = await Promise.all([
        settingsRepo.getTaxSettings(ip.id!),
        settingsRepo.getHolidays(ip.id!, ip.year),
      ])
      if (settings) {
        try {
          await recalculateTaxPlan(ip, settings, holidays)
        } catch {
          // Keep the selector usable and show the last saved totals. The full
          // diagnostic remains available after opening the profile.
        }
      }
      const [totals, obligations] = await Promise.all([
        transactionRepo.getYearTotals(ip.id!, ip.year),
        taxCalcRepo.getAll(ip.id!),
      ])
      const remaining = obligations.reduce(
        (sum, item) => sum.plus(dMax(d(0), d(item.amount).minus(d(item.paidAmount)))), d(0),
      )
      return [ip.id!, { income: totals.income, remaining: remaining.toFixed(2) }] as const
    }))
    setStats(Object.fromEntries(entries))
  }, [setIpList])

  useEffect(() => { void loadIps() }, [loadIps])

  const totals = useMemo(() => ipList.reduce((acc, ip) => ({
    income: acc.income.plus(d(ip.id ? stats[ip.id]?.income ?? 0 : 0)),
    remaining: acc.remaining.plus(d(ip.id ? stats[ip.id]?.remaining ?? 0 : 0)),
  }), { income: d(0), remaining: d(0) }), [ipList, stats])

  const openIp = async (ip: IpProfile) => {
    const [settings, holidays] = await Promise.all([
      settingsRepo.getTaxSettings(ip.id!),
      settingsRepo.getHolidays(ip.id!, ip.year),
    ])
    setCurrentIp(ip)
    setTaxSettings(settings ?? null)
    setHolidays(holidays)
    setIsOnboarded(true)
    navigate('/dashboard')
  }

  const deleteIp = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await ipRepo.deleteWithCascade(deleteTarget.id, userId ?? undefined)
    if (localStorage.getItem('ip-platezhi-last-ip-id') === String(deleteTarget.id)) {
      localStorage.removeItem('ip-platezhi-last-ip-id')
    }
    setDeleteTarget(null)
    setDeleting(false)
    await loadIps()
  }

  return (
    <div className="portfolio-shell">
      <header className="portfolio-header">
        <div className="flex items-center gap-3"><div className="brand-mark"><span>ИП</span></div><div><strong>ИП Платежи</strong><p>Портфель предпринимателей</p></div></div>
        <Button onClick={() => navigate('/onboarding')}><Plus className="size-4" /> Добавить ИП</Button>
      </header>

      <main className="portfolio-main">
        <div className="page-heading">
          <div><p className="eyebrow">ВСЕ ПРОФИЛИ</p><h1>Портфель ИП</h1><p>Общая картина и раздельный учёт по каждому предпринимателю.</p></div>
        </div>

        <div className="metric-grid">
          <Card className="metric-card featured"><CardContent><span>Общий доход</span><MoneyDisplay amount={totals.income.toFixed(2)} size="lg" /><small>по всем профилям за рабочий год</small></CardContent></Card>
          <Card className="metric-card"><CardContent><span>Осталось оплатить</span><MoneyDisplay amount={totals.remaining.toFixed(2)} size="lg" /><small>по рассчитанным обязательствам</small></CardContent></Card>
          <Card className="metric-card"><CardContent><span>Активных ИП</span><div className="text-3xl font-semibold tabular-nums">{ipList.length}</div><small>данные полностью разделены</small></CardContent></Card>
        </div>

        <section className="content-section">
          <div className="section-heading"><div><p className="eyebrow">ПРОФИЛИ</p><h2>Выберите ИП</h2></div><WalletCards className="size-5 text-muted-foreground" /></div>
          {ipList.length === 0 ? <EmptyState title="Нет добавленных ИП" description="Создайте первый профиль индивидуального предпринимателя" /> : (
            <div className="portfolio-grid">
              {ipList.map(ip => (
                <Card key={ip.id} className="portfolio-card">
                  <CardContent>
                    <div className="flex items-start justify-between gap-3">
                      <div className="profile-icon"><Building2 className="size-5" /></div>
                      <Button variant="ghost" size="icon" aria-label={`Удалить ${ip.name}`} onClick={() => setDeleteTarget({ id: ip.id!, name: ip.name })}><Trash2 className="size-4 text-muted-foreground" /></Button>
                    </div>
                    <div className="mt-4"><h3>{ip.name}</h3><p>ИНН {ip.inn}</p></div>
                    <div className="flex flex-wrap gap-1.5 mt-3"><Badge variant="outline">УСН «Доходы»</Badge><Badge variant="outline">{ip.year}</Badge>{ip.region && <Badge variant="outline">{ip.region}</Badge>}</div>
                    <div className="portfolio-values"><div><span>Доход</span><MoneyDisplay amount={ip.id ? stats[ip.id]?.income ?? '0' : '0'} /></div><div><span>К оплате</span><MoneyDisplay amount={ip.id ? stats[ip.id]?.remaining ?? '0' : '0'} /></div></div>
                    <Button className="w-full" variant="outline" onClick={() => openIp(ip)}>Открыть профиль <ArrowRight className="size-4" /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Удалить ИП?</DialogTitle><DialogDescription>Профиль «{deleteTarget?.name}» и только связанные с ним операции, платежи и настройки будут удалены локально и из синхронизации. Сделайте резервную копию, если данные могут понадобиться.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button><Button variant="destructive" disabled={deleting} onClick={deleteIp}>{deleting ? 'Удаляем…' : 'Удалить ИП'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
