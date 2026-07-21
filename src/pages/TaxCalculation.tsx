import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { MoneyDisplay } from '@/components/shared/MoneyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CalculationDetails } from '@/components/shared/CalculationDetails'
import { taxCalcRepo } from '@/db/repositories/taxCalcRepo'
import { paymentRepo } from '@/db/repositories/paymentRepo'
import { recalculateTaxPlan } from '@/services/taxPlanService'
import { d, dMax, dMin } from '@/engine/decimal'
import { formatDate, getDaysUntil } from '@/engine/dateUtils'
import { buildTaxPaymentCsv } from '@/utils/taxPaymentExport'
import { formatObligationPeriod, taxYearFromPeriod } from '@/utils/taxPeriods'
import type { Payment, PaymentAllocation, TaxObligation, TaxPaymentKind } from '@/types'
import {
  AlertCircle, CalendarClock, CheckCircle2, Download, History, Loader2, Plus, RefreshCw, Split, Trash2, WalletCards,
} from 'lucide-react'

const typeLabels: Record<TaxObligation['type'], string> = {
  usn_advance: 'Аванс УСН',
  usn_annual: 'Годовой налог УСН',
  ip_premium_fixed: 'Фиксированные взносы',
  ip_premium_additional: 'Дополнительный взнос 1%',
  notification: 'Уведомление',
}

const paymentKindLabels: Record<TaxPaymentKind, string> = {
  usn: 'УСН',
  fixed_premium: 'Фиксированные взносы',
  additional_premium: 'Дополнительный 1%',
  enp: 'ЕНП без распределения',
  other_tax: 'Другой налоговый платёж',
}

function outstanding(obligation: TaxObligation): string {
  return dMax(d(0), d(obligation.amount).minus(d(obligation.paidAmount))).toFixed(2)
}

function kindFor(obligation: TaxObligation): TaxPaymentKind {
  if (obligation.type === 'ip_premium_fixed') return 'fixed_premium'
  if (obligation.type === 'ip_premium_additional') return 'additional_premium'
  return 'usn'
}

function taxYearFor(obligation: TaxObligation): number {
  return obligation.taxYear ?? taxYearFromPeriod(obligation.period) ?? Number(obligation.dueDate.slice(0, 4))
}

function obligationSelectLabel(value: string, obligations: TaxObligation[], emptyLabel: string): string {
  if (value === 'none') return emptyLabel
  const obligation = obligations.find(item => item.id === Number(value))
  return obligation
    ? `${typeLabels[obligation.type]} · ${formatObligationPeriod(obligation)} · осталось ${outstanding(obligation)} ₽`
    : 'Обязательство не найдено'
}

export default function TaxCalculation() {
  const { currentIp, taxSettings, holidays } = useAppStore()
  const [obligations, setObligations] = useState<TaxObligation[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentAllocations, setPaymentAllocations] = useState<PaymentAllocation[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [allocationPayment, setAllocationPayment] = useState<Payment | null>(null)
  const [allocationForm, setAllocationForm] = useState({ obligationId: 'none', amount: '' })
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    kind: 'usn' as TaxPaymentKind,
    period: '',
    taxYear: new Date().getFullYear(),
    obligationId: 'none',
    allocateAmount: '',
    documentNumber: '',
    comment: '',
  })

  const loadStored = useCallback(async () => {
    if (!currentIp?.id) return
    const [dues, history, links] = await Promise.all([
      taxCalcRepo.getAll(currentIp.id),
      paymentRepo.getAll(currentIp.id),
      paymentRepo.getAllocations(currentIp.id),
    ])
    setObligations(dues.sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
    setPayments(history)
    setPaymentAllocations(links)
  }, [currentIp?.id])

  const calculate = useCallback(async () => {
    if (!currentIp || !taxSettings) return
    setRecalculating(true)
    setError('')
    try {
      await recalculateTaxPlan(currentIp, taxSettings, holidays)
      await loadStored()
    } catch (calculationError) {
      setError(calculationError instanceof Error ? calculationError.message : 'Не удалось пересчитать обязательства.')
    } finally {
      setRecalculating(false)
      setLoading(false)
    }
  }, [currentIp, holidays, loadStored, taxSettings])

  useEffect(() => { void calculate() }, [calculate])

  const totals = useMemo(() => ({
    accrued: obligations.reduce((sum, item) => sum.plus(d(item.amount)), d(0)).toFixed(2),
    paid: payments.reduce((sum, item) => sum.plus(d(item.amount)), d(0)).toFixed(2),
    outstanding: obligations.reduce((sum, item) => sum.plus(d(outstanding(item))), d(0)).toFixed(2),
    unallocated: payments.reduce((sum, payment) => {
      const allocated = paymentAllocations
        .filter(link => link.paymentId === payment.id)
        .reduce((inner, link) => inner.plus(d(link.amount)), d(0))
      return sum.plus(d(payment.amount).minus(allocated))
    }, d(0)).toFixed(2),
  }), [obligations, payments, paymentAllocations])

  const openPayment = (obligation?: TaxObligation) => {
    const remainder = obligation ? outstanding(obligation) : ''
    setError('')
    setForm({
      date: new Date().toISOString().slice(0, 10),
      amount: remainder,
      kind: obligation ? kindFor(obligation) : 'usn',
      period: obligation?.period ?? '',
      taxYear: obligation?.taxYear ?? currentIp?.year ?? new Date().getFullYear(),
      obligationId: obligation?.id ? String(obligation.id) : 'none',
      allocateAmount: remainder,
      documentNumber: '',
      comment: '',
    })
    setDialogOpen(true)
  }

  const selectObligation = (value: string) => {
    const obligation = obligations.find(item => item.id === Number(value))
    const remainder = obligation ? outstanding(obligation) : ''
    setForm(current => ({
      ...current,
      obligationId: value,
      kind: obligation ? kindFor(obligation) : current.kind,
      period: obligation?.period ?? current.period,
      taxYear: obligation?.taxYear ?? current.taxYear,
      amount: current.amount || remainder,
      allocateAmount: remainder ? dMin(d(current.amount || remainder), d(remainder)).toFixed(2) : '',
    }))
  }

  const handleSavePayment = async () => {
    if (!currentIp?.id || !d(form.amount || 0).gt(0)) {
      setError('Укажите сумму платежа больше нуля.')
      return
    }
    if (!Number.isInteger(form.taxYear) || form.taxYear < 2000 || form.taxYear > currentIp.year + 1) {
      setError('Укажите корректный расчётный год платежа.')
      return
    }
    if (form.obligationId !== 'none' && d(form.allocateAmount || 0).gt(d(form.amount))) {
      setError('Зачтённая сумма не может превышать сумму платежа.')
      return
    }
    try {
      await paymentRepo.add({
        ipId: currentIp.id,
        obligationId: form.obligationId === 'none' ? null : Number(form.obligationId),
        allocateAmount: form.obligationId === 'none' ? '0' : form.allocateAmount,
        date: form.date,
        amount: d(form.amount).toFixed(2),
        description: paymentKindLabels[form.kind],
        kind: form.kind,
        period: form.period || null,
        taxYear: form.taxYear,
        documentNumber: form.documentNumber,
        comment: form.comment,
        source: 'manual',
        sourceTransactionId: null,
      })
      setDialogOpen(false)
      await loadStored()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить платёж.')
    }
  }

  const handleDeletePayment = async (payment: Payment) => {
    if (!payment.id || payment.source === 'transaction') return
    if (!window.confirm('Удалить платёж из истории? Связанное обязательство снова станет неоплаченным.')) return
    await paymentRepo.remove(payment.id)
    await loadStored()
  }

  const unallocatedFor = (payment: Payment) => {
    const allocated = paymentAllocations
      .filter(link => link.paymentId === payment.id)
      .reduce((sum, link) => sum.plus(d(link.amount)), d(0))
    return dMax(d(0), d(payment.amount).minus(allocated)).toFixed(2)
  }

  const openAllocation = (payment: Payment) => {
    setError('')
    setAllocationPayment(payment)
    setAllocationForm({ obligationId: 'none', amount: unallocatedFor(payment) })
  }

  const selectAllocationObligation = (value: string) => {
    const obligation = obligations.find(item => item.id === Number(value))
    const available = allocationPayment ? unallocatedFor(allocationPayment) : '0'
    setAllocationForm({
      obligationId: value,
      amount: obligation ? dMin(d(available), d(outstanding(obligation))).toFixed(2) : available,
    })
  }

  const saveAllocation = async () => {
    if (!allocationPayment?.id || allocationForm.obligationId === 'none') {
      setError('Выберите обязательство для распределения.')
      return
    }
    try {
      await paymentRepo.allocate(allocationPayment.id, Number(allocationForm.obligationId), allocationForm.amount)
      setAllocationPayment(null)
      await loadStored()
    } catch (allocationError) {
      setError(allocationError instanceof Error ? allocationError.message : 'Не удалось распределить платёж.')
    }
  }

  const handleExportPayments = () => {
    const csv = buildTaxPaymentCsv(payments, paymentAllocations, obligations)
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `налоговые-платежи-${currentIp?.name || 'ип'}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(href)
  }

  if (!currentIp || !taxSettings) return null

  const nextDue = obligations.find(item => d(outstanding(item)).gt(0))

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">НАЛОГОВЫЙ КОНТУР</p>
          <h1>Платежи</h1>
          <p>Начисления, официальные сроки и фактические оплаты — в одном месте.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPayments} disabled={payments.length === 0}>
            <Download className="size-4" /> Экспорт платежей
          </Button>
          <Button variant="outline" size="sm" onClick={calculate} disabled={recalculating}>
            {recalculating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Пересчитать
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm" onClick={() => openPayment()} />}>
              <Plus className="size-4" /> Внести прошлый платёж
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Фактический налоговый платёж</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="info-note">Платёж закрывает задолженность, но сам по себе не уменьшает доход и налоговую базу УСН.</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Дата оплаты</Label><Input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></div>
                  <div className="space-y-2"><Label>Сумма, ₽</Label><Input type="number" min="0" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value, allocateAmount: form.obligationId === 'none' ? '' : event.target.value })} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Вид платежа</Label>
                  <Select value={form.kind} onValueChange={value => {
                    const kind = value as TaxPaymentKind
                    setForm({
                      ...form,
                      kind,
                      taxYear: form.obligationId === 'none' && kind === 'additional_premium'
                        ? currentIp.year - 1
                        : form.taxYear,
                    })
                  }}>
                    <SelectTrigger className="w-full"><SelectValue>{paymentKindLabels[form.kind]}</SelectValue></SelectTrigger><SelectContent>{Object.entries(paymentKindLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Зачесть в обязательство</Label>
                  <Select value={form.obligationId} onValueChange={selectObligation}>
                    <SelectTrigger className="w-full"><SelectValue>{obligationSelectLabel(form.obligationId, obligations, 'Оставить на ЕНС без распределения')}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Оставить на ЕНС без распределения</SelectItem>
                      {obligations.filter(item => d(outstanding(item)).gt(0)).map(item => <SelectItem key={item.id} value={String(item.id)}>{typeLabels[item.type]} · {formatObligationPeriod(item)} · осталось {outstanding(item)} ₽</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.obligationId !== 'none' && <div className="space-y-2"><Label>Сумма зачёта, ₽</Label><Input type="number" min="0" max={form.amount} value={form.allocateAmount} onChange={event => setForm({ ...form, allocateAmount: event.target.value })} /><p className="text-xs text-muted-foreground">Остаток платежа останется нераспределённым на ЕНС.</p></div>}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Расчётный год</Label><Input type="number" min="2000" max={currentIp.year + 1} value={form.taxYear} onChange={event => setForm({ ...form, taxYear: Number(event.target.value) })} /><p className="helper-text">Для взноса 1%, начисленного с дохода 2025 года, укажите 2025 — даже если оплатили его в 2026 году.</p></div>
                  <div className="space-y-2"><Label>Период</Label><Input value={form.period} onChange={event => setForm({ ...form, period: event.target.value })} placeholder="Например, 2025-additional" /></div>
                  <div className="space-y-2"><Label>№ документа</Label><Input value={form.documentNumber} onChange={event => setForm({ ...form, documentNumber: event.target.value })} placeholder="Необязательно" /></div>
                </div>
                <div className="space-y-2"><Label>Комментарий</Label><Input value={form.comment} onChange={event => setForm({ ...form, comment: event.target.value })} placeholder="Например, платёж от 15.04" /></div>
                {error && <p className="form-error">{error}</p>}
                <Button className="w-full" onClick={handleSavePayment}>Сохранить платёж</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && !dialogOpen && <div className="form-error">{error}</div>}

      <div className="metric-grid metric-grid-four">
        <Card className="metric-card"><CardContent><span>Начислено</span><MoneyDisplay amount={totals.accrued} size="lg" /><small>налоги и взносы</small></CardContent></Card>
        <Card className="metric-card"><CardContent><span>Оплачено</span><MoneyDisplay amount={totals.paid} size="lg" /><small>по введённым платежам</small></CardContent></Card>
        <Card className="metric-card"><CardContent><span>Осталось</span><MoneyDisplay amount={totals.outstanding} size="lg" /><small>по рассчитанным обязательствам</small></CardContent></Card>
        <Card className="metric-card"><CardContent><span>Не распределено</span><MoneyDisplay amount={totals.unallocated} size="lg" /><small>предполагаемый остаток ЕНС</small></CardContent></Card>
      </div>

      {nextDue && (
        <Card className="next-action-card">
          <CardContent>
            <div className="next-action-icon"><CalendarClock className="size-5" /></div>
            <div className="flex-1">
              <p className="eyebrow">БЛИЖАЙШЕЕ ДЕЙСТВИЕ</p>
              <h2>{typeLabels[nextDue.type]} · {formatObligationPeriod(nextDue)}</h2>
              <p>Официальный срок {formatDate(nextDue.dueDate)} · {getDaysUntil(nextDue.dueDate) >= 0 ? `через ${getDaysUntil(nextDue.dueDate)} дн.` : `просрочено на ${Math.abs(getDaysUntil(nextDue.dueDate))} дн.`}</p>
            </div>
            <div className="text-right"><MoneyDisplay amount={outstanding(nextDue)} size="lg" /><Button size="sm" className="mt-2" onClick={() => openPayment(nextDue)}>Внести оплату</Button></div>
          </CardContent>
        </Card>
      )}

      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">ПЛАН</p><h2>Обязательства и сроки</h2></div><Badge variant="outline">УСН «Доходы» · {taxSettings.usnRegionalRate || taxSettings.usnRateIncome}%</Badge></div>
        {loading ? <div className="py-12 flex justify-center"><Loader2 className="size-6 animate-spin" /></div> : (
          <div className="obligation-grid">
            {obligations.filter(item => !item.period.endsWith('-opening')).map(obligation => {
              const left = outstanding(obligation)
              const progress = d(obligation.amount).gt(0)
                ? Math.min(100, d(obligation.paidAmount).div(d(obligation.amount)).times(100).toNumber())
                : 100
              return (
                <Card key={obligation.id} className="obligation-card">
                  <CardContent>
                    <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{formatObligationPeriod(obligation).toUpperCase()}</p><h3>{typeLabels[obligation.type]}</h3>{obligation.dueYear && obligation.dueYear !== taxYearFor(obligation) && <p className="helper-text mt-1">Начислено за {taxYearFor(obligation)} · срок оплаты в {obligation.dueYear}</p>}</div><StatusBadge status={obligation.status} /></div>
                    <MoneyDisplay amount={obligation.amount} size="lg" className="mt-5" />
                    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                    <div className="grid grid-cols-2 gap-3 text-sm"><div><span>Оплачено</span><strong>{formatCurrency(obligation.paidAmount)}</strong></div><div><span>Осталось</span><strong>{formatCurrency(left)}</strong></div></div>
                    <div className="deadline-list">
                      {obligation.notificationDueDate && <p><AlertCircle className="size-4" /> Уведомление до {formatDate(obligation.notificationDueDate)}</p>}
                      <p><CalendarClock className="size-4" /> Оплата до {formatDate(obligation.dueDate)}</p>
                    </div>
                    <div className="flex items-center justify-between border-t pt-3 mt-3">
                      <CalculationDetails obligation={obligation} />
                      {!d(obligation.amount).gt(0)
                        ? <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="size-4" /> Начислений нет</span>
                        : d(left).gt(0)
                          ? <Button variant="outline" size="sm" onClick={() => openPayment(obligation)}>Оплатить</Button>
                          : <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-4" /> Оплачено</span>}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">ИСТОРИЯ</p><h2>Фактические платежи</h2></div><History className="size-5 text-muted-foreground" /></div>
        {payments.length === 0 ? (
          <Card><CardContent className="empty-inline"><WalletCards className="size-6" /><div><strong>Платежей пока нет</strong><p>Добавьте ранее совершённую оплату или налоговую часть операции.</p></div></CardContent></Card>
        ) : (
          <Card className="overflow-hidden"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Дата</TableHead><TableHead>Платёж</TableHead><TableHead>Распределение</TableHead><TableHead className="text-right">Сумма</TableHead><TableHead className="w-36" /></TableRow></TableHeader>
            <TableBody>{payments.map(payment => {
              const links = paymentAllocations.filter(link => link.paymentId === payment.id)
              const linked = links.map(link => obligations.find(item => item.id === link.obligationId)).filter(Boolean) as TaxObligation[]
              const unallocated = unallocatedFor(payment)
              return <TableRow key={payment.id}>
                <TableCell>{formatDate(payment.date)}</TableCell>
                <TableCell><p className="font-medium">{paymentKindLabels[payment.kind ?? 'other_tax']}</p><p className="helper-text">За {payment.taxYear ?? payment.period?.match(/^\d{4}/)?.[0] ?? 'неуказанный'} год · {payment.comment || payment.description}</p></TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{linked.map(item => <Badge key={item.id} variant="outline">{formatObligationPeriod(item)}</Badge>)}{d(unallocated).gt(0) && <Badge variant="secondary">ЕНС · {formatCurrency(unallocated)}</Badge>}</div></TableCell>
                <TableCell className="text-right font-mono font-semibold">{formatCurrency(payment.amount)}</TableCell>
                <TableCell><div className="flex justify-end gap-1">{d(unallocated).gt(0) && <Button variant="outline" size="xs" onClick={() => openAllocation(payment)}><Split className="size-3" /> Распределить</Button>}{payment.source !== 'transaction' && <Button variant="ghost" size="icon" onClick={() => handleDeletePayment(payment)}><Trash2 className="size-4 text-red-500" /></Button>}</div></TableCell>
              </TableRow>
            })}</TableBody>
          </Table></div></Card>
        )}
      </section>

      <Dialog open={Boolean(allocationPayment)} onOpenChange={open => !open && setAllocationPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Распределить платёж</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="info-note">Доступно на ЕНС: {allocationPayment ? formatCurrency(unallocatedFor(allocationPayment)) : '0 ₽'}.</div>
            <div className="space-y-2"><Label>Обязательство</Label><Select value={allocationForm.obligationId} onValueChange={selectAllocationObligation}><SelectTrigger className="w-full"><SelectValue>{obligationSelectLabel(allocationForm.obligationId, obligations, 'Выберите обязательство')}</SelectValue></SelectTrigger><SelectContent><SelectItem value="none">Выберите обязательство</SelectItem>{obligations.filter(item => d(outstanding(item)).gt(0)).map(item => <SelectItem key={item.id} value={String(item.id)}>{typeLabels[item.type]} · {formatObligationPeriod(item)} · осталось {outstanding(item)} ₽</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Сумма зачёта, ₽</Label><Input type="number" min="0" value={allocationForm.amount} onChange={event => setAllocationForm({ ...allocationForm, amount: event.target.value })} /></div>
            {error && <p className="form-error">{error}</p>}
            <Button className="w-full" onClick={saveAllocation}>Зачесть платёж</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(Number(value))
}
